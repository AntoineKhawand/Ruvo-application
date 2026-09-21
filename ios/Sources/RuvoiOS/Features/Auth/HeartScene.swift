//
//  HeartScene.swift
//
//  The 3D anatomical heart for onboarding step 2 (LevelDial.swift): a SceneKit
//  scene loaded from Resources/heart_model.glb via GLTFSceneKit. Port of the web
//  design's three.js scene (and of Android's HeartRenderer.kt): same camera,
//  three-point lighting plus an accent light whose colour and strength follow the
//  fitness level, a heartbeat scale, and drag-to-rotate with a gentle idle sway.
//
//  NOTE: written without a Swift toolchain in the authoring environment --
//  verify it builds, and tune the light intensities on a device (SceneKit's
//  physically based units differ from three.js's).
//

import SceneKit
import SwiftUI
import UIKit
import GLTFSceneKit

/// Values the render loop reads every frame. Written on the main thread by the
/// step, read on SceneKit's render thread; plain floats, so a torn read is harmless.
final class HeartRig {
    var yaw: Float = -0.25
    var pitch: Float = 0.06
    var vYaw: Float = 0
    var dragging = false
    var beat: Float = 0          // smoothed 0...1 heartbeat envelope
    var heat: Float = 0          // 0 (Beginner) ... 1 (Elite)
    var rigScale: Float = 1      // intro grow-in
    var accent: (r: Float, g: Float, b: Float) = (0.29, 0.87, 0.5)   // sRGB 0...1
}

final class HeartScene: NSObject, SCNSceneRendererDelegate {
    let scene = SCNScene()
    let cameraNode = SCNNode()
    let rig = HeartRig()
    private let reduceMotion: Bool

    private let rigNode = SCNNode()
    private let pivot = SCNNode()
    private let rimLight = SCNNode()
    private let accentLight = SCNNode()
    private var materials: [SCNMaterial] = []
    private var lastTime: TimeInterval = 0
    private var t: Float = 0

    private init(reduceMotion: Bool) {
        self.reduceMotion = reduceMotion
        super.init()
    }

    /// Returns nil if the model can't be found or parsed, so the caller can show a static heart.
    static func load(reduceMotion: Bool) -> HeartScene? {
        guard let url = Bundle.module.url(forResource: "heart_model", withExtension: "glb") else { return nil }
        guard let gltf = try? GLTFSceneSource(url: url, options: nil).scene() else { return nil }
        let heart = HeartScene(reduceMotion: reduceMotion)
        heart.build(from: gltf)
        return heart
    }

    private func build(from gltf: SCNScene) {
        scene.background.contents = UIColor.clear

        // Model: re-centred on the origin and scaled to 3.8 units tall, like the web scene,
        // so rotation and the beat pivot around the heart itself.
        let model = SCNNode()
        gltf.rootNode.childNodes.forEach { model.addChildNode($0) }
        let (mn, mx) = model.boundingBox
        let h = max(mx.y - mn.y, 0.0001)
        let s = 3.8 / h
        let c = SCNVector3((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, (mn.z + mx.z) / 2)
        model.scale = SCNVector3(s, s, s)
        model.position = SCNVector3(-c.x * s, -c.y * s, -c.z * s)
        model.enumerateHierarchy { node, _ in
            node.geometry?.materials.forEach { m in
                m.metalness.contents = 0.0
                m.emission.contents = UIColor.black
                materials.append(m)
            }
        }
        pivot.addChildNode(model)
        rigNode.addChildNode(pivot)
        scene.rootNode.addChildNode(rigNode)

        // Camera: 26 degree vertical FOV on +Z, looking slightly down.
        let cam = SCNCamera()
        cam.fieldOfView = 26
        cam.zNear = 0.1
        cam.zFar = 100
        cam.wantsHDR = true
        cam.wantsExposureAdaptation = false
        cameraNode.camera = cam
        cameraNode.position = SCNVector3(0, 0.1, 12.2)
        cameraNode.eulerAngles = SCNVector3(-Float(atan2(0.15, 12.2)), 0, 0)
        scene.rootNode.addChildNode(cameraNode)

        // Lights: same rig as the web scene (ambient + key + fill + rim), plus an accent light.
        addLight(.ambient, color: UIColor(white: 1, alpha: 1), intensity: 600)
        addLight(.directional, color: UIColor(red: 1, green: 0.95, blue: 0.91, alpha: 1), intensity: 3000, at: SCNVector3(3, 4, 5))
        addLight(.directional, color: UIColor(red: 0.9, green: 0.93, blue: 1, alpha: 1), intensity: 1000, at: SCNVector3(-4, 1, 3))
        configure(rimLight, .directional, intensity: 2200, at: SCNVector3(-4, 2, -4))
        configure(accentLight, .omni, intensity: 600, at: SCNVector3(0.6, -0.4, 2.2))
    }

    private func addLight(_ type: SCNLight.LightType, color: UIColor, intensity: CGFloat, at p: SCNVector3? = nil) {
        let node = SCNNode()
        configure(node, type, intensity: intensity, at: p)
        node.light?.color = color
    }

    private func configure(_ node: SCNNode, _ type: SCNLight.LightType, intensity: CGFloat, at p: SCNVector3?) {
        let light = SCNLight()
        light.type = type
        light.intensity = intensity
        node.light = light
        if let p = p {
            node.position = p
            if type == .directional { node.look(at: SCNVector3Zero) }
        }
        scene.rootNode.addChildNode(node)
    }

    // MARK: Render loop

    func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
        let dt = lastTime == 0 ? 1.0 / 60 : min(0.05, time - lastTime)
        lastTime = time
        t += Float(dt)

        if !rig.dragging {
            rig.vYaw *= Float(pow(0.02, dt))
            rig.yaw += rig.vYaw
            let sway: Float = reduceMotion ? -0.25 : -0.1 + sin(t * 0.45) * 0.42
            rig.yaw += (sway - rig.yaw) * min(1, Float(dt) * 1.1)
            rig.pitch += (0.06 - rig.pitch) * min(1, Float(dt) * 2)
        }

        let heat = rig.heat, beat = rig.beat
        pivot.scale = SCNVector3Make(1, 1, 1) * (1 + (0.03 + 0.05 * heat) * beat)
        rigNode.scale = SCNVector3Make(1, 1, 1) * rig.rigScale
        rigNode.eulerAngles = SCNVector3(rig.pitch, rig.yaw, 0)

        let accent = UIColor(red: CGFloat(rig.accent.r), green: CGFloat(rig.accent.g), blue: CGFloat(rig.accent.b), alpha: 1)
        let emissive = CGFloat(0.03 + 0.1 * heat + (0.12 + 0.25 * heat) * beat)
        for m in materials {
            m.emission.contents = accent
            m.emission.intensity = emissive
        }
        rimLight.light?.color = accent
        accentLight.light?.color = accent
        accentLight.light?.intensity = CGFloat(600 * (0.5 + 1.1 * heat + (0.5 + 1.0 * heat) * beat))
    }
}

private func * (v: SCNVector3, k: Float) -> SCNVector3 { SCNVector3(v.x * k, v.y * k, v.z * k) }

/// Transparent SceneKit view showing the heart. Touches are handled by the SwiftUI
/// parent (drag-to-rotate), so this view itself is non-interactive.
struct HeartSceneView: UIViewRepresentable {
    let heart: HeartScene

    func makeUIView(context: Context) -> SCNView {
        let v = SCNView(frame: .zero)
        v.scene = heart.scene
        v.pointOfView = heart.cameraNode
        v.backgroundColor = .clear
        v.isOpaque = false
        v.antialiasingMode = .multisampling4X
        v.preferredFramesPerSecond = 60
        v.rendersContinuously = true
        v.isPlaying = true
        v.delegate = heart
        v.isUserInteractionEnabled = false
        return v
    }

    func updateUIView(_ uiView: SCNView, context: Context) {}
}

/// Loads the heart once, off the main thread, so it is ready when step 2 opens.
/// OnboardingView starts it while the user is still on step 1; LevelStep asks for the
/// result (immediately if it is already there). Main thread only.
final class HeartPreloader {
    private var scene: HeartScene?
    private var failed = false
    private var loading = false
    private var waiting: [(HeartScene?) -> Void] = []

    func load(reduceMotion: Bool, completion: ((HeartScene?) -> Void)? = nil) {
        if let scene = scene { completion?(scene); return }
        if failed { completion?(nil); return }
        if let completion = completion { waiting.append(completion) }
        guard !loading else { return }
        loading = true
        DispatchQueue.global(qos: .userInitiated).async {
            let loaded = HeartScene.load(reduceMotion: reduceMotion)
            DispatchQueue.main.async {
                self.loading = false
                self.scene = loaded
                self.failed = loaded == nil
                let callbacks = self.waiting
                self.waiting = []
                callbacks.forEach { $0(loaded) }
            }
        }
    }
}
