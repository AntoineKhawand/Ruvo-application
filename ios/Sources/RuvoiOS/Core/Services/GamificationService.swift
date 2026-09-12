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

    /// Calls the real `redeemReward` Cloud Function (functions/index.js), matching
    /// the exact input shape Android's RewardsViewModel.redeem() sends (rewardId,
    /// price, title) and the exact output shape the function returns
    /// (success, newCoinBalance). The function itself validates the balance and
    /// deducts coins server-side inside a Firestore transaction — this call never
    /// writes `coins` directly. On success the local balance is set from the
    /// server's authoritative response (same as Android), so the UI updates
    /// immediately instead of waiting on the snapshot listener to catch up.
    @discardableResult
    func redeem(rewardId: String, price: Int, title: String) async throws -> Int {
        let callable = functions.httpsCallable("redeemReward")
        let result = try await callable.call([
            "rewardId": rewardId,
            "price": price,
            "title": title,
        ])
        guard let data = result.data as? [String: Any],
              data["success"] as? Bool == true,
              let newBalance = (data["newCoinBalance"] as? NSNumber)?.intValue else {
            throw RedemptionError.invalidResponse
        }
        coins = newBalance
        return newBalance
    }

    enum RedemptionError: LocalizedError {
        case invalidResponse
        var errorDescription: String? {
            "An error occurred while processing your reward."
        }
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
