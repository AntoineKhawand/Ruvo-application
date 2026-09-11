import AVFoundation
import SwiftUI
import UIKit

/// A muted, looping video used as a decorative full-bleed background (the
/// Welcome screen's hero). Fills and crops like `.scaledToFill()`
/// (`.resizeAspectFill`), and pauses/resumes with the app's foreground state
/// so the loop isn't burning CPU/battery off-screen.
struct LoopingVideoBackground: UIViewRepresentable {
    let resourceName: String
    let fileExtension: String

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> PlayerContainerView {
        let view = PlayerContainerView()
        guard let url = Bundle.module.url(forResource: resourceName, withExtension: fileExtension) else {
            assertionFailure("Missing bundled video: \(resourceName).\(fileExtension)")
            return view
        }
        context.coordinator.configure(playerLayer: view.playerLayer, url: url)
        return view
    }

    func updateUIView(_ uiView: PlayerContainerView, context: Context) {}

    final class PlayerContainerView: UIView {
        override class var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
    }

    /// Owns the player/looper for as long as this view is alive.
    final class Coordinator {
        private var player: AVQueuePlayer?
        private var looper: AVPlayerLooper?

        func configure(playerLayer: AVPlayerLayer, url: URL) {
            let item = AVPlayerItem(url: url)
            let player = AVQueuePlayer()
            player.isMuted = true
            looper = AVPlayerLooper(player: player, templateItem: item)
            playerLayer.player = player
            playerLayer.videoGravity = .resizeAspectFill
            self.player = player
            player.play()

            NotificationCenter.default.addObserver(
                self, selector: #selector(resume), name: UIApplication.didBecomeActiveNotification, object: nil
            )
            NotificationCenter.default.addObserver(
                self, selector: #selector(pause), name: UIApplication.willResignActiveNotification, object: nil
            )
        }

        @objc private func resume() { player?.play() }
        @objc private func pause() { player?.pause() }

        deinit {
            NotificationCenter.default.removeObserver(self)
        }
    }
}
