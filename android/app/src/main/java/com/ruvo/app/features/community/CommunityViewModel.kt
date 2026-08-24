package com.ruvo.app.features.community

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
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

data class CommentItem(
    val id: String,
    val userId: String,
    val userName: String,
    val text: String,
    val timeAgo: String,
)

data class CommunityUiState(
    val feedItems: List<CommunityFeedItem> = emptyList(),
    val clubs: List<CommunityClub> = emptyList(),
    val challenges: List<CommunityChallengeItem> = emptyList(),
    val leaderboard: List<LeaderboardEntry> = emptyList(),
    val isLoading: Boolean = false,
    val commentsPostId: String? = null,
    val commentsPostUserId: String? = null,
    val comments: List<CommentItem> = emptyList(),
    val commentText: String = "",
    val replyTo: String? = null,
)

@HiltViewModel
class CommunityViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(CommunityUiState())
    val uiState: StateFlow<CommunityUiState> = _uiState.asStateFlow()

    private var commentsListener: com.google.firebase.firestore.ListenerRegistration? = null

    fun openComments(postUserId: String, postId: String) {
        _uiState.update { it.copy(commentsPostId = postId, commentsPostUserId = postUserId, comments = emptyList(), commentText = "", replyTo = null) }
        commentsListener?.remove()
        commentsListener = firestore.collection("users").document(postUserId).collection("runInteractions").document(postId).collection("comments")
            .orderBy("createdAt", com.google.firebase.firestore.Query.Direction.ASCENDING)
            .addSnapshotListener { snap, _ ->
                val items = snap?.documents?.map { doc ->
                    val data = doc.data ?: emptyMap<String, Any>()
                    val ts = (data["createdAt"] as? com.google.firebase.Timestamp)?.toDate()
                    CommentItem(
                        id = doc.id,
                        userId = data["userId"] as? String ?: "",
                        userName = data["userName"] as? String ?: "Runner",
                        text = data["text"] as? String ?: "",
                        timeAgo = ts?.toTimeAgo() ?: "now",
                    )
                } ?: emptyList()
                _uiState.update { it.copy(comments = items) }
            }
    }

    fun closeComments() {
        commentsListener?.remove()
        commentsListener = null
        _uiState.update { it.copy(commentsPostId = null, commentsPostUserId = null, comments = emptyList(), commentText = "", replyTo = null) }
    }

    fun updateCommentText(text: String) {
        _uiState.update { it.copy(commentText = text) }
    }

    fun setReplyTo(userName: String?) {
        _uiState.update { it.copy(replyTo = userName) }
    }

    fun sendComment() {
        val postId = _uiState.value.commentsPostId ?: return
        val postUserId = _uiState.value.commentsPostUserId ?: return
        val text = _uiState.value.commentText.trim()
        if (text.isEmpty()) return
        val uid = auth.currentUser?.uid ?: return
        val replyTo = _uiState.value.replyTo
        val finalText = if (replyTo != null) "@$replyTo $text" else text

        _uiState.update { it.copy(commentText = "", replyTo = null) }
        viewModelScope.launch {
            try {
                // Real "name" field first (see loadFeed()'s comment on why),
                // falling back the same way every other screen does.
                val displayName = firestore.collection("users").document(uid).get().await().let {
                    it.getString("name") ?: it.getString("displayName")
                } ?: auth.currentUser?.displayName?.takeIf { it.isNotBlank() } ?: "Runner"
                val interactionRef = firestore.collection("users").document(postUserId).collection("runInteractions").document(postId)
                interactionRef.collection("comments").add(
                    mapOf(
                        "userId" to uid,
                        "userName" to displayName,
                        "text" to finalText,
                        "createdAt" to com.google.firebase.Timestamp.now(),
                    )
                ).await()
                // set(merge=true), not update() — this doc is created on-demand
                // (nothing pre-creates a runInteractions doc for a run), so
                // update() would fail outright on the first ever comment/like
                // for that run, same failure mode fixed elsewhere for
                // completeOnboarding()'s .update() (see AuthViewModel).
                interactionRef.set(
                    mapOf("commentsCount" to com.google.firebase.firestore.FieldValue.increment(1)),
                    com.google.firebase.firestore.SetOptions.merge(),
                ).await()
            } catch (_: Exception) {}
        }
    }

    override fun onCleared() {
        commentsListener?.remove()
        super.onCleared()
    }

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

    // Rebuilt 2026-08-25 — the previous design queried
    // collectionGroup("runs") against users/{uid}/runs/{runId}, a
    // subcollection nothing in this app (or, per grepping every preserved
    // RN file, RN itself) ever writes to. The real run data lives in each
    // user's users/{uid}.runHistory ARRAY field (see the "Known Data-Layer
    // Bugs" section) — arrays can't be queried across users the way a
    // subcollection can, so a true global feed isn't buildable client-side
    // without a Cloud Function maintaining a separate posts collection
    // (out of scope here). Feed scope is Following + self instead — the
    // exact same bounded-fan-out shape already proven correct by
    // LeaderboardViewModel's "Friends" scope. Likes/comments now live under
    // a users/{ownerUid}/runInteractions/{runId} doc, created on demand
    // (see sendComment()/toggleLike()'s use of set(merge=true) instead of
    // update()) — runHistory array entries can't have their own
    // subcollections, so this is the nearest equivalent.
    private suspend fun loadFeed() {
        try {
            val myUid = auth.currentUser?.uid ?: run {
                _uiState.value = _uiState.value.copy(feedItems = emptyList())
                return
            }
            val meDoc = firestore.collection("users").document(myUid).get().await()
            @Suppress("UNCHECKED_CAST")
            val following = (meDoc.data?.get("following") as? List<String>) ?: emptyList()
            val feedUids = (following + myUid).distinct()

            data class RawEntry(val ownerUid: String, val ownerName: String, val run: Map<String, Any>, val instant: java.time.Instant)

            val rawEntries = coroutineScope {
                feedUids.map { uid ->
                    async {
                        try {
                            val doc = firestore.collection("users").document(uid).get().await()
                            val data = doc.data ?: return@async emptyList()
                            @Suppress("UNCHECKED_CAST")
                            val privacy = data["privacySettings"] as? Map<String, Any>
                            // RN's real privacySettings.showActivityOnFeed field
                            // (UserContext.js DEFAULT_USER_DATA) — respected here
                            // even though the feed itself is a new client-side
                            // design, since the setting already exists and is
                            // user-facing in PrivacyControlsScreen.kt.
                            val showOnFeed = privacy?.get("showActivityOnFeed") as? Boolean ?: true
                            if (!showOnFeed && uid != myUid) return@async emptyList()
                            val name = data["name"] as? String ?: data["displayName"] as? String ?: "Runner"
                            @Suppress("UNCHECKED_CAST")
                            val runHistory = data["runHistory"] as? List<Map<String, Any>> ?: emptyList()
                            runHistory.mapNotNull { run ->
                                val instant = (run["date"] as? String)
                                    ?.let { runCatching { java.time.Instant.parse(it) }.getOrNull() } ?: return@mapNotNull null
                                if (run["id"] as? String == null) return@mapNotNull null
                                RawEntry(uid, name, run, instant)
                            }
                        } catch (_: Exception) { emptyList() }
                    }
                }.awaitAll().flatten()
            }
            val recent = rawEntries.sortedByDescending { it.instant }.take(20)

            val items = coroutineScope {
                recent.map { entry ->
                    async {
                        val runId = entry.run["id"] as String
                        val distKm = (entry.run["distance"] as? Number)?.toDouble()
                        val durSec = parseRunDurationSeconds(entry.run)
                        val pace = if (distKm != null && distKm > 0) durSec / 60.0 / distKm else null
                        val interactionRef = firestore.collection("users").document(entry.ownerUid)
                            .collection("runInteractions").document(runId)
                        val interactionDoc = try { interactionRef.get().await() } catch (_: Exception) { null }
                        val likesCount = (interactionDoc?.getLong("likesCount") ?: 0L).toInt()
                        val commentsCount = (interactionDoc?.getLong("commentsCount") ?: 0L).toInt()
                        val isLiked = try {
                            interactionRef.collection("likes").document(myUid).get().await().exists()
                        } catch (_: Exception) { false }
                        CommunityFeedItem(
                            id = runId,
                            userId = entry.ownerUid,
                            userDisplayName = entry.ownerName,
                            distanceKm = distKm,
                            paceFormatted = pace?.toFormattedPace(),
                            durationFormatted = durSec.toInt().toFormattedDuration(),
                            likesCount = likesCount,
                            commentsCount = commentsCount,
                            isLikedByMe = isLiked,
                            timeAgo = Date.from(entry.instant).toTimeAgo(),
                        )
                    }
                }.awaitAll()
            }
            _uiState.value = _uiState.value.copy(feedItems = items)
        } catch (_: Exception) {}
    }

    // Same "MM:SS"/"HH:MM:SS" duration-string parsing every other screen
    // reading runHistory already uses (HomeViewModel, ProfileViewModel).
    private fun parseRunDurationSeconds(run: Map<String, Any>): Long {
        val parts = (run["duration"] as? String)?.split(":")?.mapNotNull { it.toLongOrNull() } ?: return 0L
        return when (parts.size) {
            2 -> parts[0] * 60 + parts[1]
            3 -> parts[0] * 3600 + parts[1] * 60 + parts[2]
            else -> 0L
        }
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

    // Same schema this doc's "Known Data-Layer Bugs" section already
    // documents elsewhere: the real cumulative-XP field is "currentXP" (see
    // functions_index.js's saveRunActivity), not "xp" — this was ordering
    // and reading a field nothing ever writes, so this tab's leaderboard was
    // always either empty or arbitrarily ordered. "totalDistanceKm" isn't a
    // real field either; the real one is "totalKm" (same as SearchScreen /
    // GamificationRepository's calculatedUpdates).
    private suspend fun loadLeaderboard() {
        try {
            val snap = firestore.collection("users")
                .orderBy("currentXP", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(50)
                .get().await()
            val entries = snap.documents.mapNotNull { doc ->
                val data = doc.data ?: return@mapNotNull null
                LeaderboardEntry(
                    userId = doc.id,
                    displayName = data["name"] as? String ?: data["displayName"] as? String ?: "Runner",
                    level = (data["level"] as? Number)?.toInt() ?: 1,
                    xp = (data["currentXP"] as? Number)?.toLong() ?: 0L,
                    totalDistanceKm = (data["totalKm"] as? Number)?.toDouble() ?: 0.0,
                )
            }
            _uiState.value = _uiState.value.copy(leaderboard = entries)
        } catch (_: Exception) {}
    }

    fun joinChallenge(challengeId: String) {
        val uid = auth.currentUser?.uid ?: return
        val idx = _uiState.value.challenges.indexOfFirst { it.id == challengeId }
        if (idx < 0) return
        val challenge = _uiState.value.challenges[idx]
        if (challenge.isJoined) return
        val updated = challenge.copy(isJoined = true, participantsCount = challenge.participantsCount + 1)
        val newList = _uiState.value.challenges.toMutableList().also { it[idx] = updated }
        _uiState.value = _uiState.value.copy(challenges = newList)
        viewModelScope.launch {
            try {
                firestore.collection("challenges").document(challengeId)
                    .update("participants", com.google.firebase.firestore.FieldValue.arrayUnion(uid))
                    .await()
            } catch (_: Exception) {
                // revert optimistic update on failure
                val revertList = _uiState.value.challenges.toMutableList().also { it[idx] = challenge }
                _uiState.value = _uiState.value.copy(challenges = revertList)
            }
        }
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
            try {
                val interactionRef = firestore.collection("users").document(item.userId).collection("runInteractions").document(itemId)
                val likeRef = interactionRef.collection("likes").document(uid)
                if (wasLiked) {
                    likeRef.delete().await()
                    // set(merge=true) — see loadFeed()'s comment; this doc may
                    // not exist yet (first like ever removed isn't reachable,
                    // but keeping both branches symmetric/self-healing).
                    interactionRef.set(
                        mapOf("likesCount" to com.google.firebase.firestore.FieldValue.increment(-1)),
                        com.google.firebase.firestore.SetOptions.merge(),
                    ).await()
                } else {
                    likeRef.set(mapOf("likedAt" to com.google.firebase.Timestamp.now())).await()
                    interactionRef.set(
                        mapOf("likesCount" to com.google.firebase.firestore.FieldValue.increment(1)),
                        com.google.firebase.firestore.SetOptions.merge(),
                    ).await()
                }
            } catch (_: Exception) {
                // revert optimistic update on failure
                val revertList = _uiState.value.feedItems.toMutableList()
                val curIdx = revertList.indexOfFirst { it.id == itemId }
                if (curIdx >= 0) revertList[curIdx] = item
                _uiState.value = _uiState.value.copy(feedItems = revertList)
            }
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
