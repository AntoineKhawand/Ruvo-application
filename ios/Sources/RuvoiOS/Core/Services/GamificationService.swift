import Foundation
import FirebaseFirestore
import FirebaseFunctions

@MainActor
final class GamificationService: ObservableObject {
    @Published private(set) var xp: Int = 0
    @Published private(set) var coins: Int = 0
    @Published private(set) var level: Int = 1
    @Published private(set) var streakDays: Int = 0
    @Published private(set) var todayXP: Int = 0
    @Published private(set) var recentAchievements: [Achievement] = []

    var levelProgress: Double { Double(xp % 1000) / 1000.0 }
    var xpToNextLevel: Int { level * 1000 }

    private let db: Firestore
    private let functions: Functions

    init(db: Firestore, functions: Functions) {
        self.db = db
        self.functions = functions
    }

    func loadForUser(uid: String) {
        db.collection("users").document(uid).addSnapshotListener { [weak self] snap, _ in
            guard let data = snap?.data() else { return }
            Task { @MainActor in
                self?.xp = data["xp"] as? Int ?? 0
                self?.coins = data["coins"] as? Int ?? 0
                self?.level = data["level"] as? Int ?? 1
                self?.streakDays = data["streakDays"] as? Int ?? 0
            }
        }
    }

    func awardRunXP(distanceKm: Double, durationSeconds: Int) async {
        guard let uid = FirebaseAuth.Auth.auth().currentUser?.uid else { return }
        do {
            let callable = functions.httpsCallable("awardRunXP")
            let _ = try await callable.call([
                "userId": uid,
                "distanceKm": distanceKm,
                "durationSeconds": durationSeconds
            ])
        } catch {
            // Fallback: local optimistic update until Cloud Function runs
            let earnedXP = Int(distanceKm * 10) + (durationSeconds / 60)
            let earnedCoins = Int(distanceKm * 2)
            xp += earnedXP
            coins += earnedCoins
            todayXP += earnedXP
        }
    }

    func checkAndUpdateStreak(uid: String) async {
        do {
            let callable = functions.httpsCallable("updateStreak")
            let _ = try await callable.call(["userId": uid])
        } catch {
            print("[Gamification] Streak update failed: \(error)")
        }
    }
}

final class RunTrackingService {
    private let db: Firestore

    init(db: Firestore) { self.db = db }

    func saveRun(_ run: RunRecord) async throws {
        guard let uid = run.userId.isEmpty ? nil : run.userId,
              let runId = run.id else { return }
        try db.collection("users").document(uid).collection("runs").document(runId).setData(from: run)

        // Mirror to top-level runs for feed
        try db.collection("runs").document(runId).setData(from: run)
    }

    func startLiveSharing(runId: String, userId: String) async throws {
        try await db.collection("runs").document(runId).setData([
            "isLive": true, "userId": userId, "startedAt": Timestamp(date: Date())
        ])
    }

    func stopLiveSharing(runId: String) async throws {
        try await db.collection("runs").document(runId).updateData(["isLive": false])
    }

    func updateLiveLocation(runId: String, coordinate: CLLocationCoordinate2D, pace: Double, distanceKm: Double) async throws {
        try await db.collection("runs").document(runId)
            .collection("liveLocation").document("current")
            .setData([
                "lat": coordinate.latitude,
                "lng": coordinate.longitude,
                "pace": pace,
                "distanceKm": distanceKm,
                "updatedAt": Timestamp(date: Date())
            ])
    }
}

final class AnalyticsService {
    private let db: Firestore
    init(db: Firestore) { self.db = db }
}

final class CommunityService {
    private let db: Firestore
    init(db: Firestore) { self.db = db }
}

final class AICoachService {
    private let functions: Functions
    init(functions: Functions) { self.functions = functions }
}

final class SocialService {
    private let db: Firestore
    init(db: Firestore) { self.db = db }
}

final class PaywallService {
    init() {}
}
