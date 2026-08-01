package com.ruvo.app.features.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.features.gear.Shoe
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class ProfileRunItem(val id: String, val distanceKm: Double)

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
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
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
                )
                loadRecentRuns(userId)
                if (!isOwn) checkFollowStatus(userId)
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
            val runs = runHistory
                .sortedByDescending { r ->
                    (r["date"] as? String)?.let { runCatching { java.time.Instant.parse(it) }.getOrNull() } ?: java.time.Instant.EPOCH
                }
                .take(9)
                .mapNotNull { r ->
                    val id = r["id"] as? String ?: return@mapNotNull null
                    val dist = (r["distance"] as? Number)?.toDouble() ?: return@mapNotNull null
                    ProfileRunItem(id = id, distanceKm = dist)
                }
            // RN has no persisted streak/weekly-activity field anywhere (see
            // RN_SOURCE_ARCHIVE.md §3/§9: `b_perfect_week` and the "streak" concept
            // are both recomputed from scratch off run-history dates every time,
            // never read from a stored counter) — derive the same way here from
            // the full history, not just the 9 shown in the Recent Runs grid.
            val runDates = runHistory.mapNotNull { r ->
                (r["date"] as? String)?.let { runCatching { java.time.Instant.parse(it) }.getOrNull() }
            }.map { it.atZone(java.time.ZoneId.systemDefault()).toLocalDate() }.toSet()
            _uiState.value = _uiState.value.copy(recentRuns = runs, runDates = runDates)
        } catch (_: Exception) {}
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

    fun updateProfile(displayName: String, bio: String, location: String) {
        val myUid = uid ?: return
        _uiState.value = _uiState.value.copy(displayName = displayName, bio = bio, location = location)
        viewModelScope.launch {
            try {
                firestore.collection("users").document(myUid).update(
                    mapOf("name" to displayName, "displayName" to displayName, "bio" to bio, "location.country" to location)
                ).await()
            } catch (_: Exception) {}
        }
    }

    fun signOut() {
        auth.signOut()
    }
}
