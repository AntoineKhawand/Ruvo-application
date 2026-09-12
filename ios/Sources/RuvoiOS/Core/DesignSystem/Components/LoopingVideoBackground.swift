import AVFoundation
import SwiftUI
import UIKit

/// A looping video with sound used as the Welcome screen's hero background.
/// Fills and crops like `.scaledToFill()` (`.resizeAspectFill`), and
/// pauses/resumes with the app's foreground state so the loop isn't burning
/// CPU/battery (or playing audio) off-screen.
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
            // .playback (vs. the default .soloAmbient) so this actually plays
            // through the silent/ring switch, like any other video-with-sound.
            try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
            try? AVAudioSession.sharedInstance().setActive(true)

            let item = AVPlayerItem(url: url)
            let player = AVQueuePlayer()
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
