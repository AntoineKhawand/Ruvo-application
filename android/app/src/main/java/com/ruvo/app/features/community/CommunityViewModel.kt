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
    // Competitor-analysis Tier 1 #5 — null for every run saved before this,
    // and for any run whose upload failed/was skipped; the feed card omits
    // the photo block entirely rather than showing a broken image.
    val photoUrl: String? = null,
)

// weeklyKm added for competitor-analysis Tier 2 #7 (club-vs-club
// challenges) — see loadClubs()'s own comment for why this replaces the
// club doc's own "weeklyKm" field (a real, previously-undiscovered dead
// stat: CreateClubScreen.kt only ever writes it once, as a static 0.0, and
// nothing anywhere — client or Cloud Function — ever increments it again).
data class CommunityClub(
    val id: String,
    val name: String,
    val emoji: String,
    val membersCount: Int,
    val city: String,
    val weeklyKm: Double = 0.0,
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

// Competitor-analysis Tier 2 #8 (Route Discovery) — deliberately scoped to
// the same bounded Following+self pool loadFeed() already uses, not a true
// global "near you" search: runHistory is a plain array field per user, not
// a queryable subcollection (see loadFeed()'s own comment on why a true
// global feed needs a Cloud Function this app doesn't have). "Popular
// routes among people you follow" is the honest version of this feature
// buildable client-side today.
data class RunRoute(
    val runId: String,
    val ownerName: String,
    val points: List<Pair<Double, Double>>, // (lat, lng), in run order
    val distanceKm: Double,
    val date: java.time.Instant,
)

data class PopularRoute(
    val clusterId: String,
    val previewPoints: List<Pair<Double, Double>>,
    val approxDistanceKm: Double,
    val runCount: Int,
    val runnerNames: List<String>,
)

data class CommunityUiState(
    val feedItems: List<CommunityFeedItem> = emptyList(),
    val clubs: List<CommunityClub> = emptyList(),
    val challenges: List<CommunityChallengeItem> = emptyList(),
    val leaderboard: List<LeaderboardEntry> = emptyList(),
    val routes: List<PopularRoute> = emptyList(),
    val isLoading: Boolean = false,
    val commentsPostId: String? = null,
    val commentsPostUserId: String? = null,
    val comments: List<CommentItem> = emptyList(),
    val commentText: String = "",
    val replyTo: String? = null,
)

// Same routeCoordinates every GPS-tracked run already stores (RuvoApp.kt's
// submitRunActivity writes it as "routePath") — segments (Tier 2 #6) would
// draw on this exact same field once per-point timing exists; this reads
// it purely for display/grouping, no timing needed.
//
// Clustering is a cheap grid-cell heuristic, not real polyline-similarity
// matching (Fréchet distance etc. would be overkill for a first version):
// two routes are "the same route" if they start within roughly the same
// ~300m cell AND cover roughly the same distance (nearest 0.5km) — good
// enough to group an out-and-back loop run repeatedly from the same
// trailhead, without conflating it with an unrelated run that happens to
// pass through the same corner.
internal const val ROUTE_CLUSTER_GRID_DEGREES = 0.003
internal const val ROUTE_CLUSTER_DISTANCE_BUCKET_KM = 0.5

internal fun clusterRoutesByStartPoint(
    routes: List<RunRoute>,
    gridDegrees: Double = ROUTE_CLUSTER_GRID_DEGREES,
    distanceBucketKm: Double = ROUTE_CLUSTER_DISTANCE_BUCKET_KM,
): List<PopularRoute> {
    fun bucketKey(route: RunRoute): String? {
        val start = route.points.firstOrNull() ?: return null
        val gridLat = Math.round(start.first / gridDegrees)
        val gridLng = Math.round(start.second / gridDegrees)
        val distanceBucket = Math.round(route.distanceKm / distanceBucketKm)
        return "$gridLat:$gridLng:$distanceBucket"
    }

    return routes
        .mapNotNull { route -> bucketKey(route)?.let { key -> key to route } }
        .groupBy({ it.first }, { it.second })
        .map { (key, group) ->
            val mostRecent = group.maxBy { it.date }
            PopularRoute(
                clusterId = key,
                previewPoints = mostRecent.points,
                approxDistanceKm = group.map { it.distanceKm }.average(),
                runCount = group.size,
                runnerNames = group.map { it.ownerName }.distinct(),
            )
        }
        .sortedWith(compareByDescending<PopularRoute> { it.runCount }.thenByDescending { it.approxDistanceKm })
}

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
            loadRoutes()
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
                            photoUrl = entry.run["photoUrl"] as? String,
                        )
                    }
                }.awaitAll()
            }
            _uiState.value = _uiState.value.copy(feedItems = items)
        } catch (_: Exception) {}
    }

    // Route Discovery (competitor-analysis Tier 2 #8) — same Following+self
    // fetch shape as loadFeed() above (same reason: runHistory is a plain
    // array per user, not a queryable subcollection, so a bounded fan-out
    // over people you follow is what's actually buildable client-side), but
    // pulling routePath/distance instead of the feed-card fields.
    private suspend fun loadRoutes() {
        try {
            val myUid = auth.currentUser?.uid ?: return
            val meDoc = firestore.collection("users").document(myUid).get().await()
            @Suppress("UNCHECKED_CAST")
            val following = (meDoc.data?.get("following") as? List<String>) ?: emptyList()
            val routeUids = (following + myUid).distinct()

            val runRoutes = coroutineScope {
                routeUids.map { uid ->
                    async {
                        try {
                            val data = firestore.collection("users").document(uid).get().await().data ?: return@async emptyList()
                            val name = data["name"] as? String ?: data["displayName"] as? String ?: "Runner"
                            @Suppress("UNCHECKED_CAST")
                            val runHistory = data["runHistory"] as? List<Map<String, Any>> ?: emptyList()
                            runHistory.mapNotNull { run ->
                                val runId = run["id"] as? String ?: return@mapNotNull null
                                val instant = (run["date"] as? String)
                                    ?.let { runCatching { java.time.Instant.parse(it) }.getOrNull() } ?: return@mapNotNull null
                                val distanceKm = (run["distance"] as? Number)?.toDouble() ?: return@mapNotNull null
                                @Suppress("UNCHECKED_CAST")
                                val routeRaw = run["routePath"] as? List<Map<String, Any>> ?: return@mapNotNull null
                                val points = routeRaw.mapNotNull { p ->
                                    val lat = (p["latitude"] as? Number)?.toDouble() ?: return@mapNotNull null
                                    val lng = (p["longitude"] as? Number)?.toDouble() ?: return@mapNotNull null
                                    lat to lng
                                }
                                if (points.isEmpty()) return@mapNotNull null
                                RunRoute(runId = runId, ownerName = name, points = points, distanceKm = distanceKm, date = instant)
                            }
                        } catch (_: Exception) { emptyList() }
                    }
                }.awaitAll().flatten()
            }
            _uiState.value = _uiState.value.copy(routes = clusterRoutesByStartPoint(runRoutes))
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

    // Real fields per CreateClubScreen.kt's actual write (which ClubDetailScreen.kt's
    // already-fixed read path also matches): "icon" (an id like "trophy", mapped to
    // an emoji via the shared CLUB_ICONS table — Firestore never stores a raw
    // emoji), "memberCount" (singular "member"), and no "city"/location field at
    // all — club creation never collects one, so that's a genuine scope gap, not a
    // wrong-field-name bug; left blank rather than inventing a value. This tab
    // previously showed the generic 🏃 fallback and "0" members for every real club.
    // Competitor-analysis Tier 2 #7 (club-vs-club) — joins two features that
    // already existed separately (Clubs, individual Challenges) but had
    // never met, per the competitor report's own framing: this list is now
    // a real leaderboard ranked by each club's aggregate current-week
    // distance, not just an unordered directory. Real per-member data (each
    // user's own "weeklyDistance", already incremented by saveRunActivity)
    // replaces the club doc's own "weeklyKm" field, which turned out to be
    // a dead stat — CreateClubScreen.kt only ever writes it once as a
    // static 0.0, and nothing anywhere increments it again, so every club
    // showed "0 km this week" forever regardless of real member activity.
    private suspend fun loadClubs() {
        try {
            val snap = firestore.collection("clubs").limit(20).get().await()
            val clubs = coroutineScope {
                snap.documents.map { doc ->
                    async {
                        val data = doc.data ?: return@async null
                        @Suppress("UNCHECKED_CAST")
                        val memberUids = (data["members"] as? List<String>) ?: emptyList()
                        val weeklyKm = memberUids.map { uid ->
                            async {
                                try {
                                    firestore.collection("users").document(uid).get().await().getDouble("weeklyDistance") ?: 0.0
                                } catch (_: Exception) { 0.0 }
                            }
                        }.awaitAll().sum()
                        CommunityClub(
                            id = doc.id,
                            name = data["name"] as? String ?: "",
                            emoji = com.ruvo.app.core.model.clubEmojiFor(data["icon"] as? String),
                            membersCount = (data["memberCount"] as? Number)?.toInt() ?: memberUids.size,
                            city = data["city"] as? String ?: "",
                            weeklyKm = weeklyKm,
                        )
                    }
                }.awaitAll().filterNotNull()
            }
            _uiState.value = _uiState.value.copy(clubs = clubs.sortedByDescending { it.weeklyKm })
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
