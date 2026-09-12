package com.ruvo.app.features.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.functions.FirebaseFunctions
import com.ruvo.app.core.model.RunningGoal
import com.ruvo.app.core.notifications.RunReminderScheduler
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.time.DayOfWeek
import java.time.format.TextStyle
import java.util.Locale
import javax.inject.Inject

data class SettingsUiState(
    val workoutReminders: Boolean = true,
    val tips: Boolean = true,
    val newFollowers: Boolean = true,
    val communityActivity: Boolean = true,
    val clubUpdates: Boolean = false,
    val unitSystem: String = "metric",
    // Real gap found 2026-09-04: RunReminderScheduler.scheduleWeeklyReminders()
    // was only ever called once, from OnboardingScreen's Ready step — nothing
    // read these back afterward, so there was no way to see or change which
    // days/time a reminder fires on short of reinstalling. These mirror the
    // exact users/{uid}.selectedDays/notificationTime fields onboarding
    // writes (AuthViewModel.completeOnboarding), read back in loadSettings().
    val reminderDays: Set<DayOfWeek> = emptySet(),
    val reminderHour: Int = 7,
    val reminderMinute: Int = 0,
    val goalLabel: String = "your goal",
    // RN's SettingsDetailScreen.js "regenerate" variant (RN_SOURCE_ARCHIVE.md
    // §6b) — confirm-then-write flow, exact copy/fields there.
    val isRegeneratingPlan: Boolean = false,
    val regenerateResultMessage: String? = null,
    // RN's "About" variant fetches system/app_config (read-only), silently
    // falling back to hardcoded defaults on error — these defaults ARE that
    // fallback (same copy already hardcoded in SettingsScreen.kt before this
    // change), not new content.
    val appConfig: AppConfig = AppConfig(),
    // Delete-account flow: calls the real `deleteAccountData` Cloud Function
    // (functions/index.js) instead of just FirebaseAuth's client-side
    // currentUser?.delete(), which left the Firestore user doc and avatar
    // Storage files orphaned (firestore.rules only allows that Admin-SDK
    // function to delete users/{uid}). Mirrors iOS's SettingsViewModel.deleteAccount().
    val isDeletingAccount: Boolean = false,
    val deleteAccountError: String? = null,
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
    private val reminderScheduler: RunReminderScheduler,
    private val functions: FirebaseFunctions,
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
                @Suppress("UNCHECKED_CAST")
                val selectedDayNames = data?.get("selectedDays") as? List<String>
                val reminderDays = selectedDayNames
                    ?.mapNotNull { name -> DayOfWeek.entries.find { it.getDisplayName(TextStyle.FULL, Locale.US) == name } }
                    ?.toSet()
                    ?: emptySet()
                val (reminderHour, reminderMinute) = (data?.get("notificationTime") as? String)
                    ?.split(":")
                    ?.takeIf { it.size == 2 }
                    ?.let { (h, m) -> h.toIntOrNull()?.let { hh -> m.toIntOrNull()?.let { mm -> hh to mm } } }
                    ?: (7 to 0)
                val goalLabel = (data?.get("goal") as? String)
                    ?.let { raw -> runCatching { RunningGoal.valueOf(raw) }.getOrNull()?.label }
                    ?: "your goal"
                // .copy(), not a fresh SettingsUiState(...) — this must not
                // clobber appConfig/regenerate state loaded independently below.
                _uiState.value = _uiState.value.copy(
                    workoutReminders = notif?.get("workoutReminders") as? Boolean ?: true,
                    tips = notif?.get("tips") as? Boolean ?: true,
                    newFollowers = notif?.get("newFollowers") as? Boolean ?: true,
                    communityActivity = notif?.get("communityActivity") as? Boolean ?: true,
                    clubUpdates = notif?.get("clubUpdates") as? Boolean ?: false,
                    unitSystem = data?.get("unitSystem") as? String ?: "metric",
                    reminderDays = reminderDays,
                    reminderHour = reminderHour,
                    reminderMinute = reminderMinute,
                    goalLabel = goalLabel,
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
        // Real bug found 2026-09-04: this toggle only ever wrote a Firestore
        // preference flag — the real AlarmManager alarms RunReminderScheduler
        // sets (from onboarding, or updateReminderSchedule() below) kept
        // firing regardless of this switch's state, so turning it off gave a
        // false sense reminders had stopped. Now it actually controls them:
        // off cancels every scheduled alarm, on reschedules using whatever
        // days/time/goal loadSettings() read back above.
        if (key == "workoutReminders") {
            val state = _uiState.value
            if (newValue) {
                reminderScheduler.scheduleWeeklyReminders(state.reminderDays, state.reminderHour, state.reminderMinute, state.goalLabel)
            } else {
                reminderScheduler.cancelAll()
            }
        }
        viewModelScope.launch {
            try {
                firestore.collection("users").document(userId)
                    .update("notificationSettings.$key", newValue).await()
            } catch (_: Exception) {
                applyNotificationState(key, current)
                if (key == "workoutReminders") {
                    val state = _uiState.value
                    if (current) {
                        reminderScheduler.scheduleWeeklyReminders(state.reminderDays, state.reminderHour, state.reminderMinute, state.goalLabel)
                    } else {
                        reminderScheduler.cancelAll()
                    }
                }
            }
        }
    }

    // Real gap found 2026-09-04: there was no way to change which days/time a
    // reminder fires on after onboarding — the day/time picker only ever
    // existed on OnboardingScreen's Schedule step. Persists the selection the
    // same way onboarding does (selectedDays/runDays/notificationTime, RN's
    // real redundant-field shape — see AuthViewModel.completeOnboarding) and,
    // if reminders are currently on, re-applies it immediately via the same
    // scheduler onboarding uses so the change takes effect without a relaunch.
    fun updateReminderSchedule(days: Set<DayOfWeek>, hour: Int, minute: Int) {
        val userId = uid ?: return
        val previous = _uiState.value
        _uiState.value = previous.copy(reminderDays = days, reminderHour = hour, reminderMinute = minute)
        if (previous.workoutReminders) {
            reminderScheduler.scheduleWeeklyReminders(days, hour, minute, previous.goalLabel)
        }
        viewModelScope.launch {
            try {
                val dayNames = days.sortedBy { it.value }.map { it.getDisplayName(TextStyle.FULL, Locale.US) }
                firestore.collection("users").document(userId).set(
                    mapOf(
                        "selectedDays" to dayNames,
                        "runDays" to dayNames,
                        "notificationTime" to String.format("%02d:%02d", hour, minute),
                    ),
                    SetOptions.merge(),
                ).await()
            } catch (_: Exception) {
                _uiState.value = previous
                if (previous.workoutReminders) {
                    reminderScheduler.scheduleWeeklyReminders(previous.reminderDays, previous.reminderHour, previous.reminderMinute, previous.goalLabel)
                }
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

    // Real bug: this used to be FirebaseAuth's client-side
    // currentUser?.delete(), which only removes the Auth identity — the
    // Firestore users/{uid} doc (runs, achievements, coins...) and avatar
    // Storage files were left behind forever. firestore.rules' `allow delete:
    // if false` on users/{uid} exists specifically because only the
    // `deleteAccountData` Cloud Function (Admin SDK) is allowed to remove that
    // doc. That function takes no arguments — it deletes the caller's own
    // users/{uid} doc, avatars/{uid}/* storage files, and the Auth identity
    // itself, keyed off request.auth.uid. Mirrors iOS's
    // SettingsViewModel.deleteAccount() (same callable, same "no args, return
    // Bool" shape) so the confirm dialog can sign the user out locally only
    // on success.
    suspend fun deleteAccount(): Boolean {
        _uiState.value = _uiState.value.copy(isDeletingAccount = true, deleteAccountError = null)
        return try {
            functions.getHttpsCallable("deleteAccountData").call().await()
            true
        } catch (e: Exception) {
            _uiState.value = _uiState.value.copy(deleteAccountError = e.message ?: "Couldn't delete your account. Please try again.")
            false
        } finally {
            _uiState.value = _uiState.value.copy(isDeletingAccount = false)
        }
    }

    fun dismissDeleteAccountError() {
        _uiState.value = _uiState.value.copy(deleteAccountError = null)
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
