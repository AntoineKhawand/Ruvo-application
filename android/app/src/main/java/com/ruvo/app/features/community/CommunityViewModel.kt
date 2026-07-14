package com.ruvo.app.features.community

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

data class CommunityFeedItem(
    val id: String,
    val userId: String,
    val userDisplayName: String,
    val distanceKm: Double?,
    val paceFormatted: String?,
    val durationFormatted: String?,
    val likesCount: Int,
    val commentsCount: Int,
    val isLikedByMe: Boolean,
    val timeAgo: String,
)

data class CommunityClub(
    val id: String,
    val name: String,
    val emoji: String,
    val membersCount: Int,
    val city: String,
)

data class CommunityChallengeItem(
    val id: String,
    val title: String,
    val description: String,
    val xpReward: Int,
    val coinReward: Int,
    val participantsCount: Int,
    val daysLeft: Int,
    val progressFraction: Float,
    val isJoined: Boolean,
)

data class LeaderboardEntry(
    val userId: String,
    val displayName: String,
    val level: Int,
    val xp: Long,
    val totalDistanceKm: Double,
)

data class CommunityUiState(
    val feedItems: List<CommunityFeedItem> = emptyList(),
    val clubs: List<CommunityClub> = emptyList(),
    val challenges: List<CommunityChallengeItem> = emptyList(),
    val leaderboard: List<LeaderboardEntry> = emptyList(),
    val isLoading: Boolean = false,
)

@HiltViewModel
class CommunityViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(CommunityUiState())
    val uiState: StateFlow<CommunityUiState> = _uiState.asStateFlow()

    fun loadAll() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            loadFeed()
            loadClubs()
            loadChallenges()
            loadLeaderboard()
            _uiState.value = _uiState.value.copy(isLoading = false)
        }
    }

    private suspend fun loadFeed() {
        try {
            val snap = firestore.collectionGroup("runs")
                .orderBy("startedAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(20)
                .get().await()
            val items = snap.documents.mapNotNull { doc ->
                val data = doc.data ?: return@mapNotNull null
                val distKm = data["distanceKm"] as? Double
                val pace = data["averagePaceMinPerKm"] as? Double
                val durSec = (data["durationSeconds"] as? Long)?.toInt()
                val ts = data["startedAt"] as? com.google.firebase.Timestamp
                CommunityFeedItem(
                    id = doc.id,
                    userId = data["userId"] as? String ?: "",
                    userDisplayName = data["userDisplayName"] as? String ?: "Runner",
                    distanceKm = distKm,
                    paceFormatted = pace?.toFormattedPace(),
                    durationFormatted = durSec?.toFormattedDuration(),
                    likesCount = (data["likesCount"] as? Long ?: 0L).toInt(),
                    commentsCount = (data["commentsCount"] as? Long ?: 0L).toInt(),
                    isLikedByMe = false,
                    timeAgo = ts?.toDate()?.toTimeAgo() ?: "",
                )
            }
            _uiState.value = _uiState.value.copy(feedItems = items)
        } catch (_: Exception) {}
    }

    private suspend fun loadClubs() {
        try {
            val snap = firestore.collection("clubs").limit(20).get().await()
            val clubs = snap.documents.mapNotNull { doc ->
                val data = doc.data ?: return@mapNotNull null
                CommunityClub(
                    id = doc.id,
                    name = data["name"] as? String ?: "",
                    emoji = data["emoji"] as? String ?: "🏃",
                    membersCount = (data["membersCount"] as? Long ?: 0L).toInt(),
                    city = data["city"] as? String ?: "",
                )
            }
            _uiState.value = _uiState.value.copy(clubs = clubs)
        } catch (_: Exception) {}
    }

    private suspend fun loadChallenges() {
        try {
            val snap = firestore.collection("challenges")
                .whereEqualTo("isActive", true)
                .limit(20)
                .get().await()
            val uid = auth.currentUser?.uid
            val challenges = snap.documents.mapNotNull { doc ->
                val data = doc.data ?: return@mapNotNull null
                val endDate = (data["endDate"] as? com.google.firebase.Timestamp)?.toDate()
                val daysLeft = endDate?.let {
                    ((it.time - System.currentTimeMillis()) / (1000 * 60 * 60 * 24)).toInt().coerceAtLeast(0)
                } ?: 0
                val participants = data["participants"] as? List<*> ?: emptyList<Any>()
                CommunityChallengeItem(
                    id = doc.id,
                    title = data["title"] as? String ?: "",
                    description = data["description"] as? String ?: "",
                    xpReward = (data["xpReward"] as? Long ?: 0L).toInt(),
                    coinReward = (data["coinReward"] as? Long ?: 0L).toInt(),
                    participantsCount = participants.size,
                    daysLeft = daysLeft,
                    progressFraction = 0f,
                    isJoined = uid != null && uid in participants.map { it.toString() },
                )
            }
            _uiState.value = _uiState.value.copy(challenges = challenges)
        } catch (_: Exception) {}
    }

    private suspend fun loadLeaderboard() {
        try {
            val snap = firestore.collection("users")
                .orderBy("xp", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(50)
                .get().await()
            val entries = snap.documents.mapNotNull { doc ->
                val data = doc.data ?: return@mapNotNull null
                LeaderboardEntry(
                    userId = doc.id,
                    displayName = data["displayName"] as? String ?: "Runner",
                    level = (data["level"] as? Long ?: 1L).toInt(),
                    xp = data["xp"] as? Long ?: 0L,
                    totalDistanceKm = data["totalDistanceKm"] as? Double ?: 0.0,
                )
            }
            _uiState.value = _uiState.value.copy(leaderboard = entries)
        } catch (_: Exception) {}
    }

    fun toggleLike(itemId: String) {
        val uid = auth.currentUser?.uid ?: return
        val idx = _uiState.value.feedItems.indexOfFirst { it.id == itemId }
        if (idx < 0) return
        val item = _uiState.value.feedItems[idx]
        val wasLiked = item.isLikedByMe
        val updated = item.copy(isLikedByMe = !wasLiked, likesCount = item.likesCount + if (wasLiked) -1 else 1)
        val newList = _uiState.value.feedItems.toMutableList().also { it[idx] = updated }
        _uiState.value = _uiState.value.copy(feedItems = newList)
        viewModelScope.launch {
            val ref = firestore.collectionGroup("runs") // need specific doc path
            // Optimistic — actual write uses the doc reference from runs subcollection
            try {
                val likeRef = firestore.collection("runs").document(itemId).collection("likes").document(uid)
                if (wasLiked) likeRef.delete().await() else likeRef.set(mapOf("likedAt" to com.google.firebase.Timestamp.now())).await()
            } catch (_: Exception) {}
        }
    }
}

private fun Double.toFormattedPace(): String {
    if (this <= 0 || this > 30) return "--:--"
    val min = this.toInt(); val sec = ((this - min) * 60).toInt()
    return String.format("%d:%02d", min, sec)
}

private fun Int.toFormattedDuration(): String {
    val h = this / 3600; val m = (this % 3600) / 60; val s = this % 60
    return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%d:%02d", m, s)
}

private fun Date.toTimeAgo(): String {
    val diff = System.currentTimeMillis() - this.time
    return when {
        diff < 60_000 -> "just now"
        diff < 3_600_000 -> "${diff / 60_000}m ago"
        diff < 86_400_000 -> "${diff / 3_600_000}h ago"
        else -> "${diff / 86_400_000}d ago"
    }
}
