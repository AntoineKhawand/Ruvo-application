import Foundation
import FirebaseFirestore

struct RuvoUser: Codable, Identifiable {
    @DocumentID var id: String?
    var email: String
    var displayName: String
    var avatarUrl: String?
    var createdAt: Date
    var xp: Int
    var coins: Int
    var level: Int
    var streakDays: Int
    var lastActivityDate: Date?
    var totalDistanceKm: Double
    var totalRuns: Int
    var runningGoal: String?
    var fitnessLevel: String?
    var weeklyRunTarget: Int?
    var followersCount: Int = 0
    var followingCount: Int = 0
    var bio: String?
    var location: UserLocation?
    var isVerified: Bool = false

    var xpToNextLevel: Int { level * 1000 }
    var levelProgress: Double { Double(xp % 1000) / 1000.0 }
}

/// Real Firestore shape of `users/{uid}.location`: a nested `{country: String}`
/// map, written via a `"location.country"` dot-path merge -- Android's real
/// behavior (`ProfileViewModel.kt`'s `updateProfile()`), and what
/// `LeaderboardView.swift`/`SearchView.swift` already read. iOS's own
/// `ProfileViewModel.updateProfile()` used to write a flat `"location": String`
/// instead (mismatched with `RuvoUser.location: String?`, and clobbering the
/// nested map for both platforms on save) -- this type plus the tolerant
/// `init(from:)` below is the fix.
struct UserLocation: Codable, Equatable {
    var country: String?

    init(country: String? = nil) {
        self.country = country
    }

    enum CodingKeys: String, CodingKey {
        case country
    }

    /// Tolerant decode: a document written before this fix (or by any other
    /// stray writer) may still carry the OLD flat string instead of this
    /// nested shape. Decoding a scalar string as a keyed container throws
    /// `DecodingError.typeMismatch` -- left uncaught, that would fail
    /// `RuvoUser`'s entire `Codable` decode (the live bug this type closes,
    /// since `ProfileViewModel.loadProfile()` decodes the whole document in
    /// one shot). Swallow it here and treat it as "no location set" instead.
    init(from decoder: Decoder) throws {
        guard let container = try? decoder.container(keyedBy: CodingKeys.self) else {
            country = nil
            return
        }
        country = try? container.decodeIfPresent(String.self, forKey: .country)
    }
}

struct RunRecord: Codable, Identifiable {
    @DocumentID var id: String?
    var userId: String
    var startedAt: Date
    var finishedAt: Date
    var durationSeconds: Int
    var distanceKm: Double
    var averagePaceMinPerKm: Double
    var calories: Int
    var elevationGainM: Double = 0
    var route: [RoutePoint] = []
    var laps: [LapData] = []
    var heartRateSamples: [HeartRateSample] = []
    var title: String?
    var notes: String?
    var xpEarned: Int = 0
    var coinsEarned: Int = 0

    struct RoutePoint: Codable {
        var latitude: Double
        var longitude: Double
    }
}

struct HeartRateSample: Codable {
    var timestamp: Date
    var bpm: Int
}

struct LapData: Codable {
    var number: Int
    var distanceKm: Double
    var durationSeconds: Int
    var paceMinPerKm: Double
}

struct Club: Codable, Identifiable {
    @DocumentID var id: String?
    var name: String
    var description: String
    var emoji: String?
    var avatarUrl: String?
    var memberCount: Int
    var isPrivate: Bool
    var adminId: String
    var city: String?
    var country: String?
    var weeklyDistanceKm: Double = 0
}

struct Challenge: Codable, Identifiable {
    @DocumentID var id: String?
    var title: String
    var description: String
    var targetValue: Double
    var unit: String
    var type: ChallengeType
    var startsAt: Date
    var endsAt: Date
    var participantCount: Int
    var rewardXP: Int
    var rewardCoins: Int
    var badgeUrl: String?

    enum ChallengeType: String, Codable {
        case distance = "distance"
        case speed = "speed"
        case elevation = "elevation"
        case streak = "streak"
        case social = "social"
    }
}
