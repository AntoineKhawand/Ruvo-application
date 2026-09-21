//
//  LevelDial.swift
//
//  Onboarding step 2: fitness level -- SwiftUI port of the approved "Ruvo
//  Onboarding: Fitness Level" web design (and of Android's LevelDial.kt).
//
//  * A ruler (drag, tap a label, or use - / +) picks one of four levels. The
//    level drives a 3D anatomical heart (HeartScene.swift): its resting pulse
//    speeds up from calm to racing, and its glow, spark halo and accent colour
//    intensify (Beginner green -> Elite red).
//  * "Not sure?" opens a two-question finder that suggests a level; it only
//    moves the ruler, the user still confirms with Continue.
//  * The pulse is animation only. It never claims to measure the user's heart rate.
//  * If the model can't load, the heart falls back to a static icon.
//
//  NOTE: written without a Swift toolchain in the authoring environment --
//  verify it builds and feels right on a Mac/simulator.
//

import SwiftUI
import UIKit

// MARK: - Content

private struct LevelStyle {
    let level: FitnessLevel
    let hex: UInt32

    var color: Color { Color(.sRGB, red: rgb.r, green: rgb.g, blue: rgb.b, opacity: 1) }
    var rgb: (r: Double, g: Double, b: Double) {
        (Double((hex >> 16) & 0xFF) / 255, Double((hex >> 8) & 0xFF) / 255, Double(hex & 0xFF) / 255)
    }
}

private let levelStyles: [LevelStyle] = [
    LevelStyle(level: .beginner,     hex: 0x4ADE80),
    LevelStyle(level: .intermediate, hex: 0xDFFF00),
    LevelStyle(level: .advanced,     hex: 0xFB923C),
    LevelStyle(level: .elite,        hex: 0xFB7185),
]

private let levelCount = 4
private let rulerSpacing: CGFloat = 100      // points between levels on the ruler
private let subTicks = 8                     // ticks per level
private let bpmLow = 58.0
private let bpmHigh = 108.0                  // animation speed only
private let onLime = Color(hex: "#121212")

// Icons: Hugeicons (free set, MIT), 24x24 stroke paths.
private enum LevelIcons {
    static let plus = ["M12 4V20M20 12H4"]
    static let minus = ["M20 12L4 12"]
    static let help = [
        "M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z",
        "M9.5 9.5C9.5 8.11929 10.6193 7 12 7C13.3807 7 14.5 8.11929 14.5 9.5C14.5 10.3569 14.0689 11.1131 13.4117 11.5636C12.7283 12.0319 12 12.6716 12 13.5",
        "M12.125 16.75H12",
    ]
    static let heart = [
        "M10.4107 19.9677C7.58942 17.858 2 13.0348 2 8.69444C2 5.82563 4.10526 3.5 7 3.5C8.5 3.5 10 4 12 6C14 4 15.5 3.5 17 3.5C19.8947 3.5 22 5.82563 22 8.69444C22 13.0348 16.4106 17.858 13.5893 19.9677C12.6399 20.6776 11.3601 20.6776 10.4107 19.9677Z",
    ]
}

// MARK: - Dial state + pulse clock

private struct LevelFrame {
    let now: TimeInterval
    let pos: CGFloat
    let idx: Int
    let heat: CGFloat
    let beat: CGFloat
    let color: Color
    let ripples: [TimeInterval]
}

/// Ruler position, its tween, and the shared heartbeat clock: one clock drives the
/// 3D heart, the ripples and the glow. The tempo eases toward its target, the beat is a
/// soft raised-cosine curve and a follower smooths it, so nothing pops.
private final class LevelDialModel {
    var pos: CGFloat = -1                    // -1 = intro (small heart), 0...3 = levels
    var reduce = false
    weak var rig: HeartRig?

    // drag
    var dragPos0: CGFloat = 0
    var dragMoved: CGFloat = 0
    var dragging = false

    private var tween: (from: CGFloat, to: CGFloat, t0: TimeInterval, dur: TimeInterval)?
    private var idx = 0
    private var started = false
    private var lastNow: TimeInterval = 0
    private var beats = 0.0
    private var bpm = bpmLow
    private var beat: CGFloat = 0
    private var heat: CGFloat = 0
    private var col: (r: Double, g: Double, b: Double) = levelStyles[0].rgb
    private var ripples: [TimeInterval] = []
    private var lastBeatId = 0
    private let selection = UISelectionFeedbackGenerator()

    func tweenTo(_ target: CGFloat, dur: TimeInterval = 0.46) {
        if reduce || pos == target { tween = nil; pos = target; return }
        tween = (pos, target, CACurrentMediaTime(), dur)
    }

    func cancelTween() { tween = nil }

    func seed(idx: Int) {
        self.idx = idx
        col = levelStyles[idx].rgb
    }

    private func bump(_ ph: Double, _ s: Double, _ w: Double) -> Double {
        let x = (ph - s) / w
        return x > 0 && x < 1 ? pow(sin(Double.pi * x), 2) : 0
    }
    private func beatShape(_ ph: Double) -> Double { bump(ph, 0, 0.26) + 0.55 * bump(ph, 0.29, 0.26) }

    /// Advance once per display frame (idempotent for the same timestamp) and snapshot.
    func advance(now: TimeInterval) -> LevelFrame {
        if now > lastNow {
            let dt = lastNow == 0 ? 1.0 / 60 : min(0.05, now - lastNow)
            lastNow = now

            if let tw = tween {
                let k = min(max((now - tw.t0) / tw.dur, 0), 1)
                let e = 1 - pow(1 - k, 4)                                   // ease-out quart
                pos = tw.from + (tw.to - tw.from) * CGFloat(e)
                if k >= 1 { tween = nil }
            }

            let newIdx = Int(min(max(pos, 0), CGFloat(levelCount - 1)).rounded())
            if newIdx != idx {
                idx = newIdx
                if started { selection.selectionChanged() }
            }
            started = true

            heat = min(max(pos / CGFloat(levelCount - 1), 0), 1)
            let target = bpmLow + (bpmHigh - bpmLow) * Double(heat)
            bpm += (target - bpm) * (1 - exp(-dt * 2.2))                    // tempo eases, never jumps
            if !reduce { beats += dt * bpm / 60 }
            let raw = reduce ? 0 : beatShape(beats.truncatingRemainder(dividingBy: 1))
            beat += (CGFloat(raw) - beat) * CGFloat(1 - exp(-dt * 16))      // smoothed envelope

            let want = levelStyles[idx].rgb, k = 1 - exp(-dt * 6)
            col.r += (want.r - col.r) * k
            col.g += (want.g - col.g) * k
            col.b += (want.b - col.b) * k

            let id = Int(floor(beats - 0.13))
            if id != lastBeatId {
                lastBeatId = id
                if pos >= 0 && !reduce { ripples.append(now) }
            }
            ripples.removeAll { now - $0 > 1.2 }

            if let rig = rig {
                rig.beat = Float(beat)
                rig.heat = Float(heat)
                rig.rigScale = Float(0.86 + 0.14 * min(max(pos + 1, 0), 1))
                rig.accent = (Float(col.r), Float(col.g), Float(col.b))
            }
        }
        return LevelFrame(
            now: now, pos: pos, idx: idx, heat: heat, beat: beat,
            color: Color(.sRGB, red: col.r, green: col.g, blue: col.b, opacity: 1), ripples: ripples
        )
    }
}

private struct Spark { let angle: Double; let r: Double; let y: Double }

/// Fixed halo of 170 sparks (deterministic, so the halo looks the same every visit).
private let sparkField: [Spark] = {
    var seed: UInt64 = 7
    func next() -> Double {
        seed = seed &* 6364136223846793005 &+ 1442695040888963407
        return Double(seed >> 11) / Double(1 << 53)
    }
    return (0..<170).map { _ in
        Spark(angle: next() * 2 * .pi, r: 2 + pow(next(), 1.6), y: (next() - 0.5) * 4.2)
    }
}()

// MARK: - Step

struct LevelStep: View {
    @Binding var selected: FitnessLevel?
    let heartLoader: HeartPreloader

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var model = LevelDialModel()
    @State private var heart: HeartScene?
    @State private var heartFailed = false
    @State private var heartShown = false
    @State private var helpOpen = false
    @State private var suggested = false
    @State private var busy = false
    @State private var rotLast: CGPoint?

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: RuvoTheme.Spacing.xs) {
                Text("Your fitness level?")
                    .font(RuvoTheme.Typography.displayMedium)
                    .tracking(RuvoTheme.Typography.Tracking.displayMedium)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text("Be honest — we'll calibrate from there")
                    .font(RuvoTheme.Typography.bodyLarge)
                    .tracking(RuvoTheme.Typography.Tracking.bodyLarge)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
            }
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)

            TimelineView(.animation) { _ in
                let f = model.advance(now: CACurrentMediaTime())
                VStack(spacing: 0) {
                    hero(f)
                    levelSheet(f)
                }
            }
        }
        .padding(.horizontal, RuvoTheme.Spacing.lg)
        .padding(.top, RuvoTheme.Spacing.xl)
        .onAppear(perform: start)
        .sheet(isPresented: $helpOpen) {
            LevelFinderSheet { level in
                helpOpen = false
                busy = true
                DispatchQueue.main.asyncAfter(deadline: .now() + (reduceMotion ? 0 : 0.32)) {
                    goTo(level)
                    suggested = true
                    busy = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2.6) { suggested = false }
                }
            }
            .presentationDetents([.height(470)])
            .presentationDragIndicator(.visible)
            .presentationBackground(Color(hex: "#141414"))
            .presentationCornerRadius(32)
        }
    }

    // MARK: Lifecycle

    private func start() {
        model.reduce = reduceMotion
        let startIdx = selected.flatMap { FitnessLevel.allCases.firstIndex(of: $0) } ?? 0
        if selected == nil { selected = .beginner }         // Continue is enabled straight away
        model.seed(idx: startIdx)
        model.pos = reduceMotion ? CGFloat(startIdx) : -1
        if !reduceMotion {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { model.tweenTo(CGFloat(startIdx), dur: 0.9) }
        }
        // Normally already loaded by OnboardingView during step 1; otherwise this loads it now.
        let reduce = reduceMotion
        heartLoader.load(reduceMotion: reduce) { loaded in
            if let loaded = loaded {
                model.rig = loaded.rig
                heart = loaded
                withAnimation(.easeOut(duration: reduce ? 0.01 : 0.35)) { heartShown = true }
            } else {
                heartFailed = true
            }
        }
    }

    private func goTo(_ i: Int, dur: TimeInterval = 0.46) {
        let target = min(max(i, 0), levelCount - 1)
        selected = FitnessLevel.allCases[target]
        model.tweenTo(CGFloat(target), dur: dur)
    }

    // MARK: Hero

    private func hero(_ f: LevelFrame) -> some View {
        GeometryReader { geo in
            let figW = min(327, geo.size.width)
            let figH = max(120, min(figW * 300 / 327, geo.size.height - 44))
            let figWFit = figH * 327 / 300

            ZStack(alignment: .top) {
                figure(f, size: CGSize(width: figWFit, height: figH))
                    .position(x: geo.size.width / 2, y: geo.size.height / 2)

                Button { if !busy { helpOpen = true } } label: {
                    HStack(spacing: 7) {
                        StrokeIcon(paths: LevelIcons.help, size: 15, color: RuvoTheme.Colors.primary, lineWidth: 1.7)
                        Text("Not sure?")
                            .font(.custom("Poppins-SemiBold", size: 12))
                            .foregroundColor(RuvoTheme.Colors.primary)
                    }
                    .padding(.leading, 9).padding(.trailing, 12)
                    .frame(height: 30)
                    .background(Capsule().fill(RuvoTheme.Colors.primary.opacity(0.08)))
                    .overlay(Capsule().stroke(RuvoTheme.Colors.primary.opacity(0.32), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Not sure? Find my level")
                .padding(.top, 28)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func figure(_ f: LevelFrame, size: CGSize) -> some View {
        ZStack {
            Canvas { ctx, sz in drawBackdrop(ctx, sz, f) }

            if heartFailed {
                // No model available: a calm static heart. Never shown as a loading placeholder.
                StrokeIcon(paths: LevelIcons.heart, size: 96, color: f.color, lineWidth: 1.1)
            }
            if let heart = heart {
                HeartSceneView(heart: heart)
                    .opacity(heartShown ? 1 : 0)
                    .allowsHitTesting(false)
            }

            Canvas { ctx, sz in drawSparks(ctx, sz, f, front: true) }
                .allowsHitTesting(false)
        }
        .frame(width: size.width, height: size.height)
        .contentShape(Rectangle())
        .gesture(rotateGesture)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("3D heart. Drag to rotate.")
    }

    /// Drag to spin the heart; it keeps its momentum, then eases back to a gentle sway.
    private var rotateGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { v in
                guard let rig = heart?.rig else { return }
                if rotLast == nil { rotLast = v.startLocation; rig.dragging = true; rig.vYaw = 0 }
                let last = rotLast ?? v.startLocation
                let dx = Float(v.location.x - last.x), dy = Float(v.location.y - last.y)
                rotLast = v.location
                rig.yaw += dx * 0.013
                rig.vYaw = dx * 0.013
                rig.pitch = min(max(rig.pitch + dy * 0.008, -0.45), 0.45)
            }
            .onEnded { _ in
                rotLast = nil
                heart?.rig.dragging = false
            }
    }

    private func drawBackdrop(_ ctx: GraphicsContext, _ size: CGSize, _ f: LevelFrame) {
        let k = size.height / 300
        let c = CGPoint(x: size.width / 2, y: size.height / 2)
        let t = f.now
        let heat = Double(f.heat)

        // Breathing glow
        let breath = 1 + 0.04 * (sin(t * 2 * .pi / 4.6) + 1)
        let gr = 200 * max(0.7, k) * breath
        ctx.fill(
            Path(ellipseIn: CGRect(x: c.x - gr, y: c.y - gr, width: gr * 2, height: gr * 2)),
            with: .radialGradient(
                Gradient(colors: [f.color.opacity(0.30 * (0.5 + heat * 0.5)), .clear]),
                center: c, startRadius: 0, endRadius: gr
            )
        )

        // Ripples on every beat
        for start in f.ripples {
            let dur = 1.1 - 0.3 * heat
            let p = min(max((t - start) / dur, 0), 1)
            guard p < 1 else { continue }
            let peak = 0.2 + 0.3 * heat
            let scale = p < 0.18 ? 0.55 + 0.2 * (p / 0.18) : 0.75 + ((1.15 + 0.3 * heat) - 0.75) * ((p - 0.18) / 0.82)
            let alpha = p < 0.18 ? peak * (p / 0.18) : peak * (1 - (p - 0.18) / 0.82)
            let r = 105 * k * scale
            ctx.stroke(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)),
                       with: .color(f.color.opacity(alpha)), lineWidth: 2)
        }

        // Platform
        let py = size.height * 277 / 300
        ctx.fill(
            Path(ellipseIn: CGRect(x: c.x - 112 * k, y: py - 16 * k, width: 224 * k, height: 32 * k)),
            with: .radialGradient(Gradient(colors: [Color.white.opacity(0.14), .clear]),
                                  center: CGPoint(x: c.x, y: py), startRadius: 0, endRadius: 112 * k)
        )
        ctx.stroke(Path(ellipseIn: CGRect(x: c.x - 84 * k, y: py - 10 * k, width: 168 * k, height: 20 * k)),
                   with: .color(f.color.opacity(0.45)), lineWidth: 1.5)

        drawSparks(ctx, size, f, front: false)
    }

    /// Orbiting spark halo, projected with the same camera as the 3D scene. Half sits behind the heart, half in front.
    private func drawSparks(_ ctx: GraphicsContext, _ size: CGSize, _ f: LevelFrame, front: Bool) {
        let clamped = min(max(f.pos, 0), CGFloat(levelCount - 1))
        let count = min(Int(floor(Double(clamped) * 57)), sparkField.count)
        guard count > 0 else { return }
        let k = size.height / 300
        let heat = Double(f.heat)
        let pxPerUnit = 150 * k / 2.816
        let rot = f.now * 0.22
        let cr = cos(rot), sr = sin(rot)
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        for i in 0..<count {
            let s = sparkField[i]
            let x0 = cos(s.angle) * s.r * 1.05
            let z0 = sin(s.angle) * s.r * 0.75
            let x = x0 * cr + z0 * sr
            let z = -x0 * sr + z0 * cr
            guard (z > 0) == front else { continue }
            let persp = 12.2 / (12.2 - z)
            let rad = 1.9 * k * persp
            let p = CGPoint(x: center.x + x * persp * pxPerUnit, y: center.y - s.y * persp * pxPerUnit)
            ctx.fill(Path(ellipseIn: CGRect(x: p.x - rad, y: p.y - rad, width: rad * 2, height: rad * 2)),
                     with: .color(f.color.opacity((0.35 + 0.4 * heat) * 0.7)))
        }
    }

    // MARK: Level sheet

    private func levelSheet(_ f: LevelFrame) -> some View {
        VStack(spacing: 0) {
            Text(suggested ? "SUGGESTED" : "FITNESS LEVEL")
                .font(.custom("Poppins-SemiBold", size: 11))
                .tracking(1.1)
                .foregroundColor(suggested ? RuvoTheme.Colors.primary : RuvoTheme.Colors.textTertiary)
                .frame(maxWidth: .infinity)
                .padding(.bottom, 10)

            HStack {
                stepButton(icon: LevelIcons.minus, label: "Lower level", enabled: f.idx > 0) { goTo(f.idx - 1) }
                ZStack {
                    Text(levelStyles[f.idx].level.title)
                        .id(f.idx)
                        .font(.custom("Poppins-Bold", size: 21))
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .transition(reduceMotion ? .opacity : .asymmetric(
                            insertion: .opacity.combined(with: .offset(y: 8)), removal: .opacity))
                }
                .frame(maxWidth: .infinity)
                .animation(reduceMotion ? nil : .easeOut(duration: 0.24), value: f.idx)
                stepButton(icon: LevelIcons.plus, label: "Higher level", enabled: f.idx < levelCount - 1) { goTo(f.idx + 1) }
            }

            ruler(f)
                .padding(.top, 8)
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 10)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(LinearGradient(colors: [Color(hex: "#181818"), Color(hex: "#101010")], startPoint: .top, endPoint: .bottom))
        )
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(Color(hex: "#262626"), lineWidth: 1))
        .padding(.bottom, RuvoTheme.Spacing.md)
    }

    private func stepButton(icon: [String], label: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            StrokeIcon(paths: icon, size: 22, color: onLime, lineWidth: 2.2)
                .frame(width: 44, height: 44)
                .background(Circle().fill(RuvoTheme.Colors.primary))
                .opacity(enabled ? 1 : 0.28)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityLabel(label)
    }

    private func ruler(_ f: LevelFrame) -> some View {
        GeometryReader { geo in
            let cx = geo.size.width / 2
            ZStack(alignment: .topLeading) {
                Canvas { ctx, size in
                    let base = size.height - 30
                    let step = rulerSpacing / CGFloat(subTicks)
                    for t in -14...((levelCount - 1) * subTicks + 14) {
                        let major = t % subTicks == 0 && t >= 0 && t <= (levelCount - 1) * subTicks
                        let h: CGFloat = major ? 26 : (t % 4 == 0 ? 16 : 9)
                        let on = major && t / subTicks == f.idx
                        let color: Color = on ? RuvoTheme.Colors.primary
                            : major ? Color(hex: "#5A5A5A") : (t % 4 == 0 ? Color(hex: "#3B3B3B") : Color(hex: "#333333"))
                        let x = cx + CGFloat(t) * step - f.pos * rulerSpacing
                        ctx.fill(Path(roundedRect: CGRect(x: x - 1, y: base - h, width: 2, height: h), cornerRadius: 1), with: .color(color))
                    }
                    // Needle with a soft glow
                    ctx.fill(Path(roundedRect: CGRect(x: cx - 5, y: -2, width: 10, height: 40), cornerRadius: 5),
                             with: .color(RuvoTheme.Colors.primary.opacity(0.25)))
                    ctx.fill(Path(roundedRect: CGRect(x: cx - 1.5, y: 0, width: 3, height: 36), cornerRadius: 1.5),
                             with: .color(RuvoTheme.Colors.primary))
                }
                ForEach(0..<levelCount, id: \.self) { i in
                    Text(levelStyles[i].level.title)
                        .font(.custom("Poppins-SemiBold", size: 11))
                        .foregroundColor(i == f.idx ? .white : RuvoTheme.Colors.textTertiary)
                        .fixedSize()
                        .position(x: cx + (CGFloat(i) - f.pos) * rulerSpacing, y: 46)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .mask(
                LinearGradient(stops: [
                    .init(color: .clear, location: 0), .init(color: .black, location: 0.09),
                    .init(color: .black, location: 0.91), .init(color: .clear, location: 1),
                ], startPoint: .leading, endPoint: .trailing)
            )
            .contentShape(Rectangle())
            .gesture(rulerGesture(width: geo.size.width))
        }
        .frame(height: 62)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Fitness level")
        .accessibilityValue("\(levelStyles[min(max(Int(model.pos.rounded()), 0), levelCount - 1)].level.title)")
        .accessibilityAdjustableAction { direction in
            let cur = min(max(Int(model.pos.rounded()), 0), levelCount - 1)
            switch direction {
            case .increment: goTo(cur + 1)
            case .decrement: goTo(cur - 1)
            @unknown default: break
            }
        }
    }

    private func rulerGesture(width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { v in
                guard !busy else { return }
                if !model.dragging {
                    model.dragging = true
                    model.cancelTween()
                    model.dragPos0 = model.pos
                    model.dragMoved = 0
                }
                let dx = v.translation.width
                model.dragMoved = max(model.dragMoved, abs(dx))
                var p = model.dragPos0 - dx / rulerSpacing
                if p < 0 { p *= 0.35 }                                              // rubber-band at the ends
                if p > CGFloat(levelCount - 1) { p = CGFloat(levelCount - 1) + (p - CGFloat(levelCount - 1)) * 0.35 }
                model.pos = p
            }
            .onEnded { v in
                guard model.dragging else { return }
                model.dragging = false
                if model.dragMoved < 6 {
                    // Tap on a label
                    if v.startLocation.y > 30 {
                        for i in 0..<levelCount {
                            let lx = width / 2 + (CGFloat(i) - model.pos) * rulerSpacing
                            if abs(v.startLocation.x - lx) < 46 { goTo(i); return }
                        }
                    }
                    goTo(Int(model.pos.rounded()))
                    return
                }
                // Snap with momentum
                let target = Int((model.pos - v.velocity.width * 0.24 / rulerSpacing).rounded())
                goTo(target, dur: 0.38)
            }
    }
}

// MARK: - "Not sure?" level finder

private struct LevelFinderSheet: View {
    let onSuggest: (Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var freq: Int?
    @State private var five: Int?          // 0 not yet, 1 with effort, 2 easily

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Let's find your level")
                    .font(.custom("Poppins-Bold", size: 20))
                    .foregroundColor(.white)
                Spacer()
                Button { dismiss() } label: {
                    StrokeIcon(paths: ["M18 6L6.00081 17.9992M17.9992 18L6 6.00085"], size: 18, color: .white, lineWidth: 2)
                        .frame(width: 34, height: 34)
                        .background(Circle().fill(Color(hex: "#222222")))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
            }
            .padding(.top, 24)

            question("How often do you run right now?")
            options(["Rarely or never", "1-3 times a week", "4+ times a week", "I follow a race plan"], columns: 2, selected: $freq)
            question("Can you run 5 km without stopping?")
            options(["Not yet", "With effort", "Easily"], columns: 3, selected: $five)

            Button {
                if let freq = freq, let five = five { onSuggest(Self.suggest(freq: freq, five: five)) }
            } label: {
                Text("Suggest my level")
                    .font(.custom("Poppins-Bold", size: 17))
                    .foregroundColor(onLime)
                    .frame(maxWidth: .infinity)
                    .frame(height: 54)
                    .background(Capsule().fill(LinearGradient(colors: [RuvoTheme.Colors.primary, Color(hex: "#A8CC00")], startPoint: .leading, endPoint: .trailing)))
            }
            .buttonStyle(.plain)
            .disabled(freq == nil || five == nil)
            .opacity(freq == nil || five == nil ? 0.4 : 1)
            .padding(.top, 20)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 30)
    }

    /// Rule of thumb from the design; tune with the coaching team.
    private static func suggest(freq: Int, five: Int) -> Int {
        var lvl = freq
        if five == 0 { lvl = max(0, lvl - 1) }
        else if five == 2 && lvl <= 1 { lvl = min(levelCount - 1, lvl + 1) }
        return lvl
    }

    private func question(_ text: String) -> some View {
        Text(text)
            .font(.custom("Poppins-SemiBold", size: 13.5))
            .foregroundColor(RuvoTheme.Colors.textSecondary)
            .padding(.top, 16).padding(.bottom, 8)
    }

    private func options(_ labels: [String], columns: Int, selected: Binding<Int?>) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: columns), spacing: 8) {
            ForEach(labels.indices, id: \.self) { i in
                let on = selected.wrappedValue == i
                Button {
                    selected.wrappedValue = i
                    UISelectionFeedbackGenerator().selectionChanged()
                } label: {
                    Text(labels[i])
                        .font(.custom("Poppins-SemiBold", size: 13))
                        .foregroundColor(on ? onLime : .white)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity, minHeight: 46)
                        .padding(.horizontal, 6)
                        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(on ? RuvoTheme.Colors.primary : Color(hex: "#141414")))
                        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(on ? RuvoTheme.Colors.primary : Color(hex: "#2A2A2A"), lineWidth: 1.5))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? [.isSelected] : [])
            }
        }
    }
}
