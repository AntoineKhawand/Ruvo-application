import Foundation
import AVFoundation

@MainActor
final class VoiceCoach: NSObject, ObservableObject {
    @Published var isEnabled: Bool = true

    private let synthesizer = AVSpeechSynthesizer()
    private var lastKmAnnounced: Int = 0

    func onDistanceUpdate(distanceKm: Double, paceMinPerKm: Double, elapsedSeconds: Int) {
        guard isEnabled else { return }
        let km = Int(distanceKm)
        if km > lastKmAnnounced {
            lastKmAnnounced = km
            announceKilometer(km: km, paceMinPerKm: paceMinPerKm, elapsedSeconds: elapsedSeconds)
        }
    }

    private func announceKilometer(km: Int, paceMinPerKm: Double, elapsedSeconds: Int) {
        let paceMin = Int(paceMinPerKm)
        let paceSec = Int((paceMinPerKm - Double(paceMin)) * 60)
        let timeMin = elapsedSeconds / 60
        let timeSec = elapsedSeconds % 60
        let text = "\(km) kilometer. Pace: \(paceMin) minutes \(paceSec) seconds per kilometer. Time: \(timeMin) minutes \(timeSec) seconds."
        speak(text)
    }

    func announceRunStart() {
        guard isEnabled else { return }
        lastKmAnnounced = 0
        speak("Run started. Good luck!")
    }

    func announceRunPaused() {
        guard isEnabled else { return }
        speak("Run paused.")
    }

    func announceRunResumed() {
        guard isEnabled else { return }
        speak("Run resumed.")
    }

    func announceRunFinished(distanceKm: Double, averagePaceMinPerKm: Double) {
        guard isEnabled else { return }
        let dist = String(format: "%.2f", distanceKm)
        let paceMin = Int(averagePaceMinPerKm)
        let paceSec = Int((averagePaceMinPerKm - Double(paceMin)) * 60)
        speak("Great run! \(dist) kilometers completed. Average pace: \(paceMin) minutes \(paceSec) seconds per kilometer. Well done!")
    }

    func announceLap(lapNumber: Int, lapPace: Double) {
        guard isEnabled else { return }
        let paceMin = Int(lapPace)
        let paceSec = Int((lapPace - Double(paceMin)) * 60)
        speak("Lap \(lapNumber). Pace: \(paceMin) minutes \(paceSec) seconds.")
    }

    func speak(_ text: String) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.48
        utterance.pitchMultiplier = 1.05
        synthesizer.speak(utterance)
    }
}
