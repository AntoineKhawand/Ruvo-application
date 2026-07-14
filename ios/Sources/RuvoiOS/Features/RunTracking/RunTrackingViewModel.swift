import Foundation
import CoreLocation
import Combine
import FirebaseAuth

enum RunState {
    case idle
    case countdown(seconds: Int)
    case running
    case paused
    case finished
}

@MainActor
final class RunTrackingViewModel: ObservableObject {
    @Published private(set) var runState: RunState = .idle
    @Published private(set) var elapsedSeconds: Int = 0
    @Published private(set) var distanceKm: Double = 0
    @Published private(set) var currentPace: Double = 0     // min/km
    @Published private(set) var averagePace: Double = 0     // min/km
    @Published private(set) var currentHeartRate: Int = 0
    @Published private(set) var calories: Int = 0
    @Published private(set) var currentLapPace: Double = 0
    @Published private(set) var laps: [LapData] = []
    @Published private(set) var isLiveSharingEnabled = false
    @Published private(set) var savedRun: RunRecord? = nil

    var isRunning:   Bool { if case .running   = runState { return true }; return false }
    var isPaused:    Bool { if case .paused    = runState { return true }; return false }
    var isIdle:      Bool { if case .idle      = runState { return true }; return false }
    var isCountdown: Bool { if case .countdown = runState { return true }; return false }

    let locationManager = LocationManager()

    private let service: RunTrackingService
    private let gamificationService: GamificationService
    private let voiceCoach = VoiceCoach()
    private var timer: Timer?
    private var lapStartDistance: Double = 0
    private var lapStartTime: Int = 0
    private var runId: String?
    private var cancellables = Set<AnyCancellable>()

    init(service: RunTrackingService, gamification: GamificationService) {
        self.service = service
        self.gamificationService = gamification
        bindLocationUpdates()
    }

    private func bindLocationUpdates() {
        locationManager.$distanceMeters
            .map { $0 / 1000 }
            .assign(to: &$distanceKm)

        locationManager.$currentPaceMinPerKm
            .assign(to: &$currentPace)
    }

    func startCountdown() {
        runState = .countdown(seconds: 3)
        var countdown = 3
        Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] t in
            countdown -= 1
            if countdown == 0 {
                t.invalidate()
                Task { @MainActor in
                    self?.beginRun()
                }
            } else {
                Task { @MainActor in
                    self?.runState = .countdown(seconds: countdown)
                }
            }
        }
    }

    private func beginRun() {
        runId = UUID().uuidString
        locationManager.startTracking()
        runState = .running
        startTimer()
        voiceCoach.announceRunStart()
    }

    func pause() {
        guard case .running = runState else { return }
        runState = .paused
        timer?.invalidate()
        locationManager.stopTracking()
        voiceCoach.announceRunPaused()
    }

    func resume() {
        guard case .paused = runState else { return }
        locationManager.startTracking()
        runState = .running
        startTimer()
        voiceCoach.announceRunResumed()
    }

    func lap() {
        let lapDistance = distanceKm - lapStartDistance
        let lapTime = elapsedSeconds - lapStartTime
        let lapPace = lapTime > 0 && lapDistance > 0 ? Double(lapTime) / 60.0 / lapDistance : 0
        laps.append(LapData(number: laps.count + 1, distanceKm: lapDistance, durationSeconds: lapTime, paceMinPerKm: lapPace))
        lapStartDistance = distanceKm
        lapStartTime = elapsedSeconds
        voiceCoach.announceLap(lapNumber: laps.count, lapPace: lapPace)
    }

    func finishRun() {
        timer?.invalidate()
        locationManager.stopTracking()
        runState = .finished
        voiceCoach.announceRunFinished(distanceKm: distanceKm, averagePaceMinPerKm: averagePace)

        guard let uid = Auth.auth().currentUser?.uid, let runId else { return }
        let run = RunRecord(
            id: runId,
            userId: uid,
            startedAt: Date().addingTimeInterval(-Double(elapsedSeconds)),
            finishedAt: Date(),
            durationSeconds: elapsedSeconds,
            distanceKm: distanceKm,
            averagePaceMinPerKm: averagePace,
            calories: calories,
            route: locationManager.route.map { RunRecord.RoutePoint(latitude: $0.latitude, longitude: $0.longitude) },
            laps: laps
        )
        savedRun = run
        Task {
            try? await service.saveRun(run)
            await gamificationService.awardRunXP(distanceKm: distanceKm, durationSeconds: elapsedSeconds)
        }
    }

    func toggleLiveSharing() {
        isLiveSharingEnabled.toggle()
        guard let uid = Auth.auth().currentUser?.uid, let runId else { return }
        if isLiveSharingEnabled {
            Task { try? await service.startLiveSharing(runId: runId, userId: uid) }
        } else {
            Task { try? await service.stopLiveSharing(runId: runId) }
        }
    }

    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.elapsedSeconds += 1
                self.updateAveragePace()
                self.updateCalories()
                self.pushLiveLocation()
            }
        }
    }

    private func updateAveragePace() {
        guard distanceKm > 0 && elapsedSeconds > 0 else { return }
        averagePace = Double(elapsedSeconds) / 60.0 / distanceKm
        voiceCoach.onDistanceUpdate(distanceKm: distanceKm, paceMinPerKm: currentPace, elapsedSeconds: elapsedSeconds)
    }

    private func updateCalories() {
        // MET-based estimate: ~10 METs for running, 70kg avg
        calories = Int(Double(elapsedSeconds) / 3600.0 * 10 * 70 * 3.5 / 200)
    }

    private func pushLiveLocation() {
        guard isLiveSharingEnabled,
              let coord = locationManager.location?.coordinate,
              let runId,
              elapsedSeconds % 5 == 0 else { return }
        Task {
            try? await service.updateLiveLocation(
                runId: runId,
                coordinate: coord,
                pace: currentPace,
                distanceKm: distanceKm
            )
        }
    }
}

