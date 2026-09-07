package com.ruvo.app.features.profile

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import com.ruvo.app.core.content.ContentRepository
import com.ruvo.app.core.model.FitnessLevel
import com.ruvo.app.core.model.RunningGoal
import com.ruvo.app.core.model.Tip
import com.ruvo.app.features.gear.Shoe
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

// Active Challenges — RN_ANDROID_PORT_MAPPING.md Roadmap item #3 flagged this
// as blocked: RN hardcodes 3 monthly challenges in getMonthlyChallenges(),
// but that function's actual definitions (titles/targets) were never
// archived before the RN source was deleted — no real source to port from.
// Per the user's explicit choice, these three are an original Android
// design (not RN parity) covering the three challenge shapes the roadmap
// note described — distance, count, elevation — each resetting every
// calendar month off the same runHistory[] already used everywhere else.
enum class ChallengeType { DISTANCE, COUNT, ELEVATION }

data class MonthlyChallenge(
    val id: String,
    val title: String,
    val icon: String,
    val type: ChallengeType,
    val target: Double,
    val unit: String,
)

data class ChallengeProgress(val challenge: MonthlyChallenge, val current: Double) {
    val fraction: Float get() = if (challenge.target > 0) (current / challenge.target).toFloat().coerceIn(0f, 1f) else 0f
    val isComplete: Boolean get() = current >= challenge.target
}

val MONTHLY_CHALLENGES = listOf(
    MonthlyChallenge(id = "distance", title = "50K Month", icon = "🏃", type = ChallengeType.DISTANCE, target = 50.0, unit = "km"),
    MonthlyChallenge(id = "count", title = "Consistency Club", icon = "🔥", type = ChallengeType.COUNT, target = 12.0, unit = "runs"),
    MonthlyChallenge(id = "elevation", title = "Hill Climber", icon = "⛰️", type = ChallengeType.ELEVATION, target = 500.0, unit = "m"),
)

data class ProfileRunItem(
    val id: String,
    val distanceKm: Double,
    val title: String,
    val activityType: String,
    val date: java.time.LocalDate,
    val durationSeconds: Long,
) {
    val paceMinPerKm: Double get() = if (distanceKm > 0) (durationSeconds / 60.0) / distanceKm else 0.0
}

data class ProfileUiState(
    val displayName: String = "",
    val avatarUrl: String? = null,
    val bio: String = "",
    val location: String = "",
    val level: Int = 1,
    val currentXP: Int = 0,
    val xpToNextLevel: Int = 1000,
    val totalRuns: Int = 0,
    val totalDistanceKm: Double = 0.0,
    val followersCount: Int = 0,
    val followingCount: Int = 0,
    val isFollowing: Boolean = false,
    val isOwnProfile: Boolean = true,
    val recentRuns: List<ProfileRunItem> = emptyList(),
    val runDates: Set<java.time.LocalDate> = emptySet(),
    val isRefreshing: Boolean = false,
    val primaryShoe: Shoe? = null,
    val earnedBadgeIds: Set<String> = emptySet(),
    val isUploadingAvatar: Boolean = false,
    val savedTips: List<Tip> = emptyList(),
    // RN's onboarding wizard collects these but neither app ever let a user
    // edit them again afterward (RN_ANDROID_PORT_MAPPING.md Roadmap item #3
    // flagged this as "plausibly a real gap" before real RN source for
    // EditProfileScreen.js's actual field list was confirmed unrecoverable).
    // Reusing the exact same option sets AuthViewModel.completeOnboarding()
    // already writes (RunningGoal/FitnessLevel enum names, weeklyRunDays) —
    // not a new/invented schema, just making already-real fields editable.
    val runningGoal: RunningGoal? = null,
    val fitnessLevel: FitnessLevel? = null,
    val weeklyRunDays: Int? = null,
    val monthlyChallenges: List<ChallengeProgress> = emptyList(),
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
    private val storage: FirebaseStorage,
    private val contentRepository: ContentRepository,
    private val checkpointStore: com.ruvo.app.core.persistence.RunCheckpointStore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    private val uid: String? get() = auth.currentUser?.uid
    private var targetUserId: String? = null

    fun loadProfile(targetUserId: String? = null) {
        val userId = targetUserId ?: uid ?: return
        val isOwn = userId == uid
        this.targetUserId = userId
        _uiState.value = _uiState.value.copy(isRefreshing = true)
        viewModelScope.launch {
            try {
                val doc = firestore.collection("users").document(userId).get().await()
                val data = doc.data
                if (data == null) {
                    _uiState.value = _uiState.value.copy(isRefreshing = false)
                    return@launch
                }
                @Suppress("UNCHECKED_CAST")
                val locationMap = data["location"] as? Map<String, Any>
                // Same `gearList` array field ShoeTrackerScreen.kt reads (no
                // separate shoes subcollection) — the "primary" shoe is
                // whichever entry has isDefault=true, matching that screen's
                // own default-shoe concept, falling back to the first entry.
                val gearList = (data["gearList"] as? List<*>)?.mapNotNull { entry ->
                    val map = entry as? Map<*, *> ?: return@mapNotNull null
                    Shoe(
                        id = (map["id"] as? String) ?: return@mapNotNull null,
                        name = map["name"] as? String ?: "",
                        limit = (map["limit"] as? Number)?.toDouble() ?: 800.0,
                        distance = (map["distance"] as? Number)?.toDouble() ?: 0.0,
                        isDefault = map["isDefault"] as? Boolean ?: false,
                    )
                } ?: emptyList()
                // Same `badges` array `AchievementsViewModel` reads (matched by
                // id, not recomputed here — condition-checking only happens in
                // RN's badgeService.js after a run save, which this app has no
                // client-side equivalent of yet, so `badges` is empty for every
                // account today; this just displays whatever's actually there).
                @Suppress("UNCHECKED_CAST")
                val earnedBadgeIds = (data["badges"] as? List<*>)
                    ?.filterIsInstance<Map<String, Any>>()
                    ?.mapNotNull { it["id"] as? String }
                    ?.toSet() ?: emptySet()
                // ContentRepository.toggleBookmark()/TipDetailScreen.kt already write/read
                // this same `savedTips` array field — just a personal bookmark shelf, so
                // (like Edit Profile / avatar upload) only surfaced on one's own profile.
                @Suppress("UNCHECKED_CAST")
                val savedTipIds = (data["savedTips"] as? List<String>)?.toSet() ?: emptySet()
                _uiState.value = _uiState.value.copy(
                    displayName = data["name"] as? String ?: data["displayName"] as? String ?: auth.currentUser?.displayName ?: "Runner",
                    avatarUrl = data["avatar"] as? String,
                    bio = data["bio"] as? String ?: "",
                    location = locationMap?.get("country") as? String ?: "",
                    level = (data["level"] as? Long ?: 1L).toInt(),
                    currentXP = (data["currentXP"] as? Number)?.toInt() ?: 0,
                    xpToNextLevel = (data["xpToNextLevel"] as? Number)?.toInt() ?: 1000,
                    totalRuns = (data["totalRuns"] as? Long ?: 0L).toInt(),
                    totalDistanceKm = data["totalKm"] as? Double ?: data["totalDistanceKm"] as? Double ?: 0.0,
                    followersCount = (data["followers"] as? List<*>)?.size ?: 0,
                    followingCount = (data["following"] as? List<*>)?.size ?: 0,
                    isOwnProfile = isOwn,
                    isRefreshing = false,
                    primaryShoe = gearList.find { it.isDefault } ?: gearList.firstOrNull(),
                    earnedBadgeIds = earnedBadgeIds,
                    runningGoal = (data["runningGoal"] as? String)?.let { name -> RunningGoal.entries.find { it.name == name } },
                    fitnessLevel = (data["fitnessLevel"] as? String)?.let { name -> FitnessLevel.entries.find { it.name == name } },
                    weeklyRunDays = (data["weeklyRunDays"] as? Number)?.toInt(),
                )
                loadRecentRuns(userId)
                if (!isOwn) checkFollowStatus(userId)
                if (isOwn) loadSavedTips(savedTipIds)
            } catch (_: Exception) {
                _uiState.value = _uiState.value.copy(isRefreshing = false)
            }
        }
    }

    // The real saveRunActivity Cloud Function (functions/index.js) writes each
    // finished run as one entry in the users/{uid}.runHistory ARRAY field — there
    // is no users/{uid}/runs subcollection (see RN_ANDROID_PORT_MAPPING.md's
    // "Known Data-Layer Bugs" section). This was silently always empty before.
    private suspend fun loadRecentRuns(userId: String) {
        try {
            val data = firestore.collection("users").document(userId).get().await().data
            @Suppress("UNCHECKED_CAST")
            val runHistory = data?.get("runHistory") as? List<Map<String, Any>> ?: emptyList()
            val runsWithInstant = runHistory.mapNotNull { r ->
                val instant = (r["date"] as? String)?.let { runCatching { java.time.Instant.parse(it) }.getOrNull() } ?: return@mapNotNull null
                r to instant
            }.sortedByDescending { it.second }
            val runs = runsWithInstant
                .take(30)
                .mapNotNull { (r, instant) ->
                    val id = r["id"] as? String ?: return@mapNotNull null
                    val dist = (r["distance"] as? Number)?.toDouble() ?: return@mapNotNull null
                    ProfileRunItem(
                        id = id,
                        distanceKm = dist,
                        title = (r["title"] as? String)?.takeIf { it.isNotBlank() } ?: "Run",
                        activityType = (r["activityType"] as? String)?.takeIf { it.isNotBlank() } ?: "Run",
                        date = instant.atZone(java.time.ZoneId.systemDefault()).toLocalDate(),
                        durationSeconds = parseDurationToSeconds(r["duration"] as? String),
                    )
                }
            // RN has no persisted streak/weekly-activity field anywhere (see
            // RN_SOURCE_ARCHIVE.md §3/§9: `b_perfect_week` and the "streak" concept
            // are both recomputed from scratch off run-history dates every time,
            // never read from a stored counter) — derive the same way here from
            // the full history, not just the 30 shown in Recent Activity.
            val runDates = runsWithInstant.map { (_, instant) ->
                instant.atZone(java.time.ZoneId.systemDefault()).toLocalDate()
            }.toSet()
            _uiState.value = _uiState.value.copy(
                recentRuns = runs,
                runDates = runDates,
                monthlyChallenges = computeMonthlyChallenges(runsWithInstant),
            )
        } catch (_: Exception) {}
    }

    private fun computeMonthlyChallenges(runsWithInstant: List<Pair<Map<String, Any>, java.time.Instant>>): List<ChallengeProgress> {
        val now = java.time.ZonedDateTime.now(java.time.ZoneId.systemDefault())
        val thisMonthRuns = runsWithInstant.filter { (_, instant) ->
            val d = instant.atZone(java.time.ZoneId.systemDefault())
            d.year == now.year && d.month == now.month
        }.map { it.first }
        val distanceKm = thisMonthRuns.sumOf { (it["distance"] as? Number)?.toDouble() ?: 0.0 }
        val elevationM = thisMonthRuns.sumOf { (it["elevationGain"] as? Number)?.toDouble() ?: 0.0 }
        val runCount = thisMonthRuns.size.toDouble()
        return MONTHLY_CHALLENGES.map { challenge ->
            val current = when (challenge.type) {
                ChallengeType.DISTANCE -> distanceKm
                ChallengeType.COUNT -> runCount
                ChallengeType.ELEVATION -> elevationM
            }
            ChallengeProgress(challenge, current)
        }
    }

    // TipsLibrary.ALL is always the source of truth for tip content (see
    // ContentRepository.fetchTips() comment) — this just filters that same
    // full list down to whatever ids are on `savedTips`, same as
    // TipDetailScreen.kt's own bookmark toggle reads/writes.
    private suspend fun loadSavedTips(savedTipIds: Set<String>) {
        if (savedTipIds.isEmpty()) {
            _uiState.value = _uiState.value.copy(savedTips = emptyList())
            return
        }
        try {
            val saved = contentRepository.fetchTips().filter { it.id in savedTipIds }
            _uiState.value = _uiState.value.copy(savedTips = saved)
        } catch (_: Exception) {}
    }

    private fun parseDurationToSeconds(duration: String?): Long {
        val parts = duration?.split(":")?.mapNotNull { it.toLongOrNull() } ?: return 0L
        return when (parts.size) {
            2 -> parts[0] * 60 + parts[1]
            3 -> parts[0] * 3600 + parts[1] * 60 + parts[2]
            else -> 0L
        }
    }

    // RN has no `following` subcollection — `checkFollowStatus`/`toggleFollow` used
    // to read/write one anyway (a `users/{uid}/following/{targetId}` doc that's
    // never created), so `isFollowing` always showed false and follows made from
    // this screen never actually landed. The real schema is a `following`/
    // `followers` ARRAY field directly on each user doc (see commit `7d36f08` and
    // `UserProfileScreen.kt`'s correct implementation, which this now matches).
    private suspend fun checkFollowStatus(targetUserId: String) {
        val myUid = uid ?: return
        try {
            val myDoc = firestore.collection("users").document(myUid).get().await()
            @Suppress("UNCHECKED_CAST")
            val myFollowing = (myDoc.data?.get("following") as? List<String>) ?: emptyList()
            _uiState.value = _uiState.value.copy(isFollowing = targetUserId in myFollowing)
        } catch (_: Exception) {}
    }

    fun toggleFollow() {
        val myUid = uid ?: return
        if (_uiState.value.isOwnProfile) return
        val targetUid = targetUserId ?: return
        val wasFollowing = _uiState.value.isFollowing
        _uiState.value = _uiState.value.copy(
            isFollowing = !wasFollowing,
            followersCount = _uiState.value.followersCount + if (wasFollowing) -1 else 1
        )
        viewModelScope.launch {
            try {
                val myRef = firestore.collection("users").document(myUid)
                val targetRef = firestore.collection("users").document(targetUid)
                val batch = firestore.batch()
                if (wasFollowing) {
                    batch.update(myRef, "following", com.google.firebase.firestore.FieldValue.arrayRemove(targetUid))
                    batch.update(targetRef, "followers", com.google.firebase.firestore.FieldValue.arrayRemove(myUid))
                } else {
                    batch.update(myRef, "following", com.google.firebase.firestore.FieldValue.arrayUnion(targetUid))
                    batch.update(targetRef, "followers", com.google.firebase.firestore.FieldValue.arrayUnion(myUid))
                }
                batch.commit().await()
            } catch (_: Exception) {
                // Revert optimistic update on failure
                _uiState.value = _uiState.value.copy(
                    isFollowing = wasFollowing,
                    followersCount = _uiState.value.followersCount + if (wasFollowing) 1 else -1
                )
            }
        }
    }

    fun updateProfile(
        displayName: String,
        bio: String,
        location: String,
        runningGoal: RunningGoal?,
        fitnessLevel: FitnessLevel?,
        weeklyRunDays: Int?,
    ) {
        val myUid = uid ?: return
        val previous = _uiState.value
        _uiState.value = previous.copy(
            displayName = displayName, bio = bio, location = location,
            runningGoal = runningGoal, fitnessLevel = fitnessLevel, weeklyRunDays = weeklyRunDays,
        )
        viewModelScope.launch {
            try {
                val updates = mutableMapOf<String, Any>(
                    "name" to displayName, "displayName" to displayName, "bio" to bio, "location.country" to location,
                )
                // Same field names AuthViewModel.completeOnboarding() already writes —
                // these are optional edits, so only touch a field the user actually set.
                runningGoal?.let { updates["runningGoal"] = it.name }
                fitnessLevel?.let { updates["fitnessLevel"] = it.name }
                weeklyRunDays?.let { updates["weeklyRunDays"] = it }
                firestore.collection("users").document(myUid).update(updates).await()
            } catch (_: Exception) {
                _uiState.value = previous
            }
        }
    }

    // RN's AvatarPickerModal → updateUserProfile({avatar}) (see
    // RN_ANDROID_PORT_MAPPING.md Roadmap item #3). RN's own avatar storage
    // mechanism no longer exists to inspect (source deleted), so this uses
    // Firebase Storage directly — one object per user at a fixed path, so a
    // re-upload naturally overwrites the old avatar rather than accumulating
    // orphaned files.
    fun uploadAvatar(uri: Uri) {
        val myUid = uid ?: return
        _uiState.value = _uiState.value.copy(isUploadingAvatar = true)
        viewModelScope.launch {
            try {
                // Pre-warm a cached ID token via the already-signed-in Auth path
                // before Storage's own internal token wrapper asks for one — cheap
                // and avoids a redundant fetch if Storage would need to anyway.
                auth.currentUser?.getIdToken(false)?.await()
                val ref = storage.reference.child("avatars/$myUid.jpg")
                ref.putFile(uri).await()
                val downloadUrl = ref.downloadUrl.await().toString()
                firestore.collection("users").document(myUid).update("avatar", downloadUrl).await()
                _uiState.value = _uiState.value.copy(avatarUrl = downloadUrl, isUploadingAvatar = false)
            } catch (_: Exception) {
                _uiState.value = _uiState.value.copy(isUploadingAvatar = false)
            }
        }
    }

    fun signOut() {
        auth.signOut()
        // Data-integrity fix — see AuthViewModel.signOut()'s doc comment
        // and RunRecoveryViewModel's: defense in depth alongside the real
        // fix (checkpoints are now uid-stamped and checked on load).
        viewModelScope.launch { checkpointStore.clear() }
    }
}
