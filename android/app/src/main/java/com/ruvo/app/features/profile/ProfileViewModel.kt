package com.ruvo.app.features.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
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
    val totalRuns: Int = 0,
    val totalDistanceKm: Double = 0.0,
    val followersCount: Int = 0,
    val followingCount: Int = 0,
    val isFollowing: Boolean = false,
    val isOwnProfile: Boolean = true,
    val recentRuns: List<ProfileRunItem> = emptyList(),
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
        viewModelScope.launch {
            try {
                val doc = firestore.collection("users").document(userId).get().await()
                val data = doc.data ?: return@launch
                @Suppress("UNCHECKED_CAST")
                val locationMap = data["location"] as? Map<String, Any>
                _uiState.value = _uiState.value.copy(
                    displayName = data["name"] as? String ?: data["displayName"] as? String ?: auth.currentUser?.displayName ?: "Runner",
                    avatarUrl = data["avatar"] as? String,
                    bio = data["bio"] as? String ?: "",
                    location = locationMap?.get("country") as? String ?: "",
                    level = (data["level"] as? Long ?: 1L).toInt(),
                    totalRuns = (data["totalRuns"] as? Long ?: 0L).toInt(),
                    totalDistanceKm = data["totalKm"] as? Double ?: data["totalDistanceKm"] as? Double ?: 0.0,
                    followersCount = (data["followers"] as? List<*>)?.size ?: 0,
                    followingCount = (data["following"] as? List<*>)?.size ?: 0,
                    isOwnProfile = isOwn,
                )
                loadRecentRuns(userId)
                if (!isOwn) checkFollowStatus(userId)
            } catch (_: Exception) {}
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
            _uiState.value = _uiState.value.copy(recentRuns = runs)
        } catch (_: Exception) {}
    }

    private suspend fun checkFollowStatus(targetUserId: String) {
        val myUid = uid ?: return
        try {
            val doc = firestore.collection("users").document(myUid).collection("following").document(targetUserId).get().await()
            _uiState.value = _uiState.value.copy(isFollowing = doc.exists())
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
                if (wasFollowing) {
                    myRef.update("following", com.google.firebase.firestore.FieldValue.arrayRemove(targetUid)).await()
                    targetRef.update("followersCount", com.google.firebase.firestore.FieldValue.increment(-1L)).await()
                } else {
                    myRef.update("following", com.google.firebase.firestore.FieldValue.arrayUnion(targetUid)).await()
                    targetRef.update("followersCount", com.google.firebase.firestore.FieldValue.increment(1L)).await()
                }
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
