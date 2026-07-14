package com.ruvo.app.features.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
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

    fun loadProfile(targetUserId: String? = null) {
        val userId = targetUserId ?: uid ?: return
        val isOwn = userId == uid
        viewModelScope.launch {
            try {
                val doc = firestore.collection("users").document(userId).get().await()
                val data = doc.data ?: return@launch
                _uiState.value = _uiState.value.copy(
                    displayName = data["displayName"] as? String ?: auth.currentUser?.displayName ?: "Runner",
                    avatarUrl = data["avatarUrl"] as? String,
                    bio = data["bio"] as? String ?: "",
                    location = data["location"] as? String ?: "",
                    totalRuns = (data["totalRuns"] as? Long ?: 0L).toInt(),
                    totalDistanceKm = data["totalDistanceKm"] as? Double ?: 0.0,
                    followersCount = (data["followersCount"] as? Long ?: 0L).toInt(),
                    followingCount = (data["followingCount"] as? Long ?: 0L).toInt(),
                    isOwnProfile = isOwn,
                )
                loadRecentRuns(userId)
                if (!isOwn) checkFollowStatus(userId)
            } catch (_: Exception) {}
        }
    }

    private suspend fun loadRecentRuns(userId: String) {
        try {
            val snap = firestore.collection("users").document(userId).collection("runs")
                .orderBy("startedAt", Query.Direction.DESCENDING)
                .limit(9)
                .get().await()
            val runs = snap.documents.mapNotNull { doc ->
                val dist = doc.getDouble("distanceKm") ?: return@mapNotNull null
                ProfileRunItem(id = doc.id, distanceKm = dist)
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
        val targetUid = if (_uiState.value.isOwnProfile) return else _uiState.value.displayName // need real target UID
        val wasFollowing = _uiState.value.isFollowing
        _uiState.value = _uiState.value.copy(
            isFollowing = !wasFollowing,
            followersCount = _uiState.value.followersCount + if (wasFollowing) -1 else 1
        )
    }

    fun updateProfile(displayName: String, bio: String, location: String) {
        val myUid = uid ?: return
        _uiState.value = _uiState.value.copy(displayName = displayName, bio = bio, location = location)
        viewModelScope.launch {
            try {
                firestore.collection("users").document(myUid).update(
                    mapOf("displayName" to displayName, "bio" to bio, "location" to location)
                ).await()
            } catch (_: Exception) {}
        }
    }

    fun signOut() {
        auth.signOut()
    }
}
