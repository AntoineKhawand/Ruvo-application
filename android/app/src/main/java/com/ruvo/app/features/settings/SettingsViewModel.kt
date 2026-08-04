package com.ruvo.app.features.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class SettingsUiState(
    val workoutReminders: Boolean = true,
    val tips: Boolean = true,
    val newFollowers: Boolean = true,
    val communityActivity: Boolean = true,
    val clubUpdates: Boolean = false,
    val unitSystem: String = "metric",
)

// RN's SettingsDetailScreen.js `notifications`/`units` variants
// (RN_SOURCE_ARCHIVE.md §6b) read/write these exact
// `users/{uid}.notificationSettings.*`/`unitSystem` fields via
// updateUserProfile() — SettingsScreen.kt previously had these as
// unpersisted local toggle state under different names/groupings, so
// every toggle silently reset on next launch. This ports the real
// read/write contract; the toggle-vs-radio-row UI difference for units
// is a deliberate Android-idiom choice, not a fidelity gap.
@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    private val uid: String? get() = auth.currentUser?.uid

    fun loadSettings() {
        val userId = uid ?: return
        viewModelScope.launch {
            try {
                val data = firestore.collection("users").document(userId).get().await().data
                @Suppress("UNCHECKED_CAST")
                val notif = data?.get("notificationSettings") as? Map<String, Any>
                _uiState.value = SettingsUiState(
                    workoutReminders = notif?.get("workoutReminders") as? Boolean ?: true,
                    tips = notif?.get("tips") as? Boolean ?: true,
                    newFollowers = notif?.get("newFollowers") as? Boolean ?: true,
                    communityActivity = notif?.get("communityActivity") as? Boolean ?: true,
                    clubUpdates = notif?.get("clubUpdates") as? Boolean ?: false,
                    unitSystem = data?.get("unitSystem") as? String ?: "metric",
                )
            } catch (_: Exception) {}
        }
    }

    fun toggleNotification(key: String, current: Boolean) {
        val userId = uid ?: return
        val newValue = !current
        applyNotificationState(key, newValue)
        viewModelScope.launch {
            try {
                firestore.collection("users").document(userId)
                    .update("notificationSettings.$key", newValue).await()
            } catch (_: Exception) {
                applyNotificationState(key, current)
            }
        }
    }

    private fun applyNotificationState(key: String, value: Boolean) {
        _uiState.value = when (key) {
            "workoutReminders" -> _uiState.value.copy(workoutReminders = value)
            "tips" -> _uiState.value.copy(tips = value)
            "newFollowers" -> _uiState.value.copy(newFollowers = value)
            "communityActivity" -> _uiState.value.copy(communityActivity = value)
            "clubUpdates" -> _uiState.value.copy(clubUpdates = value)
            else -> _uiState.value
        }
    }

    fun setUnitSystem(system: String) {
        val userId = uid ?: return
        val previous = _uiState.value.unitSystem
        _uiState.value = _uiState.value.copy(unitSystem = system)
        viewModelScope.launch {
            try {
                firestore.collection("users").document(userId).update("unitSystem", system).await()
            } catch (_: Exception) {
                _uiState.value = _uiState.value.copy(unitSystem = previous)
            }
        }
    }
}
