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
    // RN's SettingsDetailScreen.js "regenerate" variant (RN_SOURCE_ARCHIVE.md
    // §6b) — confirm-then-write flow, exact copy/fields there.
    val isRegeneratingPlan: Boolean = false,
    val regenerateResultMessage: String? = null,
    // RN's "About" variant fetches system/app_config (read-only), silently
    // falling back to hardcoded defaults on error — these defaults ARE that
    // fallback (same copy already hardcoded in SettingsScreen.kt before this
    // change), not new content.
    val appConfig: AppConfig = AppConfig(),
)

data class AppConfig(
    val activeVersion: String = "v1.0.0",
    val aboutDescription: String = "The AI running coach that adapts to you — training plans, live tracking, and a community of runners in your pocket.",
    val instagramUrl: String = "https://instagram.com/ruvo.app",
    val facebookUrl: String? = null,
    val websiteUrl: String = "https://ruvo.app",
    val email: String = "admin@ruvo.run",
    val termsUrl: String = "https://ruvo.app/terms",
    val privacyUrl: String = "https://ruvo.app/privacy",
    val playStoreUrl: String = "https://play.google.com/store/apps/details?id=com.ruvo.app",
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
                // .copy(), not a fresh SettingsUiState(...) — this must not
                // clobber appConfig/regenerate state loaded independently below.
                _uiState.value = _uiState.value.copy(
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

    // RN_SOURCE_ARCHIVE.md §6b "About": fetches system/app_config (read-only)
    // on mount, silently falling back to hardcoded defaults on error — same
    // behavior here, AppConfig()'s defaults ARE that fallback.
    fun loadAppConfig() {
        viewModelScope.launch {
            try {
                val doc = firestore.collection("system").document("app_config").get().await()
                if (!doc.exists()) return@launch
                val data = doc.data ?: return@launch
                @Suppress("UNCHECKED_CAST")
                val legal = data["legal"] as? Map<String, Any>
                @Suppress("UNCHECKED_CAST")
                val socials = data["socials"] as? Map<String, Any>
                @Suppress("UNCHECKED_CAST")
                val store = data["store"] as? Map<String, Any>
                val current = _uiState.value.appConfig
                _uiState.value = _uiState.value.copy(
                    appConfig = current.copy(
                        activeVersion = data["activeVersion"] as? String ?: current.activeVersion,
                        aboutDescription = data["aboutDescription"] as? String ?: current.aboutDescription,
                        instagramUrl = socials?.get("instagram") as? String ?: current.instagramUrl,
                        facebookUrl = socials?.get("facebook") as? String ?: current.facebookUrl,
                        websiteUrl = socials?.get("website") as? String ?: current.websiteUrl,
                        email = socials?.get("email") as? String ?: current.email,
                        termsUrl = legal?.get("termsUrl") as? String ?: current.termsUrl,
                        privacyUrl = legal?.get("privacyUrl") as? String ?: current.privacyUrl,
                        playStoreUrl = store?.get("playStore") as? String ?: current.playStoreUrl,
                    )
                )
            } catch (_: Exception) {
                // Silent fallback to the hardcoded defaults already in state — matches RN.
            }
        }
    }

    // RN_SOURCE_ARCHIVE.md §6b "regenerate" — exact write shape and copy.
    // `savedGoal`/`isTransitionWeek` aren't read anywhere else in this
    // codebase; written as-is to match RN's real contract, not guessed.
    fun regenerateTrainingPlan() {
        val userId = uid ?: return
        _uiState.value = _uiState.value.copy(isRegeneratingPlan = true, regenerateResultMessage = null)
        viewModelScope.launch {
            try {
                firestore.collection("users").document(userId).update(
                    mapOf("goal" to "5k", "savedGoal" to null, "isTransitionWeek" to false)
                ).await()
                _uiState.value = _uiState.value.copy(
                    isRegeneratingPlan = false,
                    regenerateResultMessage = "Your run plan has been recalibrated.",
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isRegeneratingPlan = false,
                    regenerateResultMessage = e.message ?: "Couldn't recalibrate your plan. Try again.",
                )
            }
        }
    }

    fun dismissRegenerateResult() {
        _uiState.value = _uiState.value.copy(regenerateResultMessage = null)
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
