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
    private val functions: FirebaseFunctions,
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
            val xp = data["xp"] as? Long ?: 0L
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

    fun awardRunXP(distanceKm: Double, durationSeconds: Int) {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            try {
                functions.getHttpsCallable("awardRunXP").call(
                    mapOf("userId" to uid, "distanceKm" to distanceKm, "durationSeconds" to durationSeconds)
                ).await()
            } catch (e: Exception) {
                // Optimistic local update as fallback
                val earnedXP = (distanceKm * 10 + durationSeconds / 60).toLong()
                val earnedCoins = (distanceKm * 2).toLong()
                _uiState.value = _uiState.value.copy(
                    xp = _uiState.value.xp + earnedXP,
                    coins = _uiState.value.coins + earnedCoins,
                )
            }
        }
    }
}

// Expose as injectable for RunTrackingViewModel
class GamificationRepository @Inject constructor(
    private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions,
) {
    suspend fun awardRunXP(distanceKm: Double, durationSeconds: Int) {
        val uid = auth.currentUser?.uid ?: return
        try {
            functions.getHttpsCallable("awardRunXP").call(
                mapOf("userId" to uid, "distanceKm" to distanceKm, "durationSeconds" to durationSeconds)
            ).await()
        } catch (_: Exception) {}
    }
}
