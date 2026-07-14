package com.ruvo.app.core.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId

data class RuvoUser(
    @DocumentId val id: String = "",
    val email: String = "",
    val displayName: String = "",
    val avatarUrl: String? = null,
    val createdAt: Timestamp = Timestamp.now(),
    val xp: Long = 0,
    val coins: Long = 0,
    val level: Int = 1,
    val streakDays: Int = 0,
    val lastActivityDate: Timestamp? = null,
    val totalDistanceKm: Double = 0.0,
    val totalRuns: Int = 0,
    val runningGoal: String? = null,
    val fitnessLevel: String? = null,
    val weeklyRunTarget: Int? = null,
    val followersCount: Int = 0,
    val followingCount: Int = 0,
    val bio: String? = null,
    val location: String? = null,
    val isVerified: Boolean = false,
    val savedTips: List<String> = emptyList(),
    val tipViews: Map<String, Long> = emptyMap(),
) {
    val xpToNextLevel: Int get() = level * 1000
    val levelProgress: Float get() = (xp % 1000).toFloat() / 1000f
}

data class RoutePoint(val latitude: Double = 0.0, val longitude: Double = 0.0)

data class RunRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val startedAt: Timestamp = Timestamp.now(),
    val finishedAt: Timestamp = Timestamp.now(),
    val durationSeconds: Int = 0,
    val distanceKm: Double = 0.0,
    val averagePaceMinPerKm: Double = 0.0,
    val calories: Int = 0,
    val elevationGainM: Double = 0.0,
    val laps: List<LapData> = emptyList(),
    val route: List<RoutePoint> = emptyList(),
    val title: String? = null,
    val xpEarned: Int = 0,
    val coinsEarned: Int = 0,
)

data class LapData(
    val number: Int = 0,
    val distanceKm: Double = 0.0,
    val durationSeconds: Int = 0,
    val paceMinPerKm: Double = 0.0,
)

data class Club(
    @DocumentId val id: String = "",
    val name: String = "",
    val description: String = "",
    val avatarUrl: String? = null,
    val memberCount: Int = 0,
    val isPrivate: Boolean = false,
    val adminId: String = "",
    val city: String? = null,
    val country: String? = null,
    val weeklyDistanceKm: Double = 0.0,
)

data class Challenge(
    @DocumentId val id: String = "",
    val title: String = "",
    val description: String = "",
    val targetValue: Double = 0.0,
    val unit: String = "",
    val type: String = "distance",
    val startsAt: Timestamp = Timestamp.now(),
    val endsAt: Timestamp = Timestamp.now(),
    val participantCount: Int = 0,
    val rewardXP: Int = 0,
    val rewardCoins: Int = 0,
    val badgeUrl: String? = null,
)

data class FeedItem(
    @DocumentId val id: String = "",
    val type: String = "run",           // "run" | "challenge_completed" | "pr" | "club_joined"
    val userId: String = "",
    val userDisplayName: String = "",
    val userAvatarUrl: String? = null,
    val runId: String? = null,
    val distanceKm: Double? = null,
    val paceMinPerKm: Double? = null,
    val durationSeconds: Int? = null,
    val likesCount: Int = 0,
    val commentsCount: Int = 0,
    val createdAt: Timestamp = Timestamp.now(),
)

data class TipStep(
    val title: String = "",
    val desc: String = "",
)

data class Tip(
    val id: String = "",
    val category: String = "",
    val tag: String = "",
    val title: String = "",
    val readTime: Int = 3,
    val desc: String = "",
    val img: String = "",
    val why: String = "",
    val keyTakeaway: String = "",
    val steps: List<TipStep> = emptyList(),
    val viewCount: Long = 0,
)

data class Reward(
    @DocumentId val id: String = "",
    val title: String = "",
    val description: String = "",
    val brandName: String = "",
    val logoUrl: String? = null,
    val coinsCost: Int = 0,
    val discountPercent: Int = 0,
    val category: String = "fitness",
    val expiresAt: Timestamp? = null,
    val isActive: Boolean = true,
)
