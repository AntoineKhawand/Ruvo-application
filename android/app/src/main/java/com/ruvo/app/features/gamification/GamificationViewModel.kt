package com.ruvo.app.features.gamification

import androidx.lifecycle.ViewModel
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

// GamificationScreen.kt / GamificationViewModel / GamificationUiState — a
// full Level/Streak/Coins/Achievements/Weekly-Goals hub screen — were
// deleted 2026-08-25 as confirmed-dead code: grep-confirmed zero
// navigation call sites anywhere in the app (no `navigate("gamification")`
// / `onNavigate("gamification")`), same class of cleanup as the
// ForgotPasswordScreen.kt deletion. Its content was also fully redundant
// with already-wired, already-correct screens (AchievementsScreen for
// achievements, RewardsScreen for redemption, ProfileScreen's XP/streak
// cards), and its own `streakDays`/weekly-goal fields read Firestore
// fields nothing ever writes — not worth fixing in unreachable code. The
// still-live pieces below (the real save path + its thin Hilt entry point)
// are unaffected.

data class RunActivityResult(val earnedXp: Long, val earnedCoins: Long)

// Faithful port of RN's UserContext.js::addRunToHistory() — the real (and only) save
// path for a completed run. Calls the real `saveRunActivity` Cloud Function (server
// computes and atomically applies XP/coins/runHistory/totalRuns/weeklyDistance —
// see functions_index.js and RN_SOURCE_ARCHIVE.md §9). There is no `awardRunXP`
// function on the backend; a prior version of this repo called one that doesn't
// exist, which always failed and silently fell back to a fabricated local XP value.
class GamificationRepository @Inject constructor(
    private val functions: FirebaseFunctions,
) {
    // `isPro` is a caller-supplied, already-known value (e.g. cached RevenueCat
    // entitlement state) rather than a fresh network lookup here — RN reads
    // `userData?.isPro` from already-loaded local state at this point too, it never
    // blocks the save on a live entitlement check. Doing that network call inside this
    // critical path previously caused the whole save to hang indefinitely if RevenueCat
    // was slow/unreachable, with no timeout and no user-facing feedback.
    suspend fun saveRunActivity(
        runEntry: Map<String, Any?>,
        calculatedUpdates: Map<String, Any?> = emptyMap(),
        isPro: Boolean = false,
    ): RunActivityResult {
        val result = functions.getHttpsCallable("saveRunActivity").call(
            mapOf("runEntry" to runEntry, "calculatedUpdates" to calculatedUpdates)
        ).await()
        @Suppress("UNCHECKED_CAST")
        val data = result.data as? Map<String, Any?> ?: emptyMap()
        val serverXp = (data["earnedXp"] as? Number)?.toLong() ?: 0L
        var serverCoins = (data["earnedCoins"] as? Number)?.toLong() ?: 0L
        // RN applies a client-side 2x coin bonus for Pro users (genuinely client-side
        // in RN, not a server behavior to "fix" — see RN_SOURCE_ARCHIVE.md §9).
        if (isPro && serverCoins > 0) serverCoins *= 2
        return RunActivityResult(serverXp, serverCoins)
    }
}

// Thin Hilt entry point so RuvoApp.kt's Composable-scoped save flow gets the
// DI-provided GamificationRepository (whose FirebaseFunctions instance respects
// USE_FIREBASE_EMULATOR, see AppModule.kt) instead of constructing its own with
// FirebaseFunctions.getInstance() — that raw instance is never emulator-configured,
// so it silently hit production with a local-emulator auth token and always failed.
// firestore/auth added 2026-08-25 so RuvoApp.kt's top-level submitRunActivity() can
// do the same one-shot gear-mileage read+update SaveActivityViewModel already does
// for manually-logged runs, without constructing its own un-configured instances
// (same emulator-respecting reasoning as the FirebaseFunctions comment above).
@HiltViewModel
class RunSaveViewModel @Inject constructor(
    val repository: GamificationRepository,
    val firestore: FirebaseFirestore,
    val auth: FirebaseAuth,
) : ViewModel()
