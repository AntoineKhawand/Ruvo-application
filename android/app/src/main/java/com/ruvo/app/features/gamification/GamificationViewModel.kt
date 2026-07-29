package com.ruvo.app.features.gamification

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class GamificationUiState(
    val xp: Long = 0,
    val coins: Long = 0,
    val level: Int = 1,
    val streakDays: Int = 0,
    val levelProgress: Float = 0f,
    val xpToNextLevel: Int = 1000,
    val achievements: List<AchievementItem> = emptyList(),
    val weeklyDistanceKm: Double = 0.0,
    val weeklyDistanceTarget: Double = 30.0,
    val weeklyRuns: Int = 0,
    val weeklyRunTarget: Int = 4,
    val weeklyActiveDays: Int = 0,
)

@HiltViewModel
class GamificationViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(GamificationUiState())
    val uiState: StateFlow<GamificationUiState> = _uiState.asStateFlow()

    init {
        loadUserData()
    }

    private fun loadUserData() {
        val uid = auth.currentUser?.uid ?: return
        firestore.collection("users").document(uid).addSnapshotListener { snap, _ ->
            val data = snap?.data ?: return@addSnapshotListener
            val xp = data["currentXP"] as? Long ?: 0L
            val level = (data["level"] as? Long ?: 1L).toInt()
            _uiState.value = _uiState.value.copy(
                xp = xp,
                coins = data["coins"] as? Long ?: 0L,
                level = level,
                streakDays = (data["streakDays"] as? Long ?: 0L).toInt(),
                levelProgress = (xp % 1000).toFloat() / 1000f,
                xpToNextLevel = level * 1000,
            )
        }
    }

}

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
@HiltViewModel
class RunSaveViewModel @Inject constructor(val repository: GamificationRepository) : ViewModel()
