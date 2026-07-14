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
    var location: String?
    var isVerified: Bool = false

    var xpToNextLevel: Int { level * 1000 }
    var levelProgress: Double { Double(xp % 1000) / 1000.0 }
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
