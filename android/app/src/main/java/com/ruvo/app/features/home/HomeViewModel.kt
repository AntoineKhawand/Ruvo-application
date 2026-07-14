package com.ruvo.app.features.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.Timestamp
import com.ruvo.app.core.model.RunRecord
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.*
import javax.inject.Inject

data class HomeUiState(
    val displayName: String = "",
    val avatarUrl: String? = null,
    val streakDays: Int = 0,
    val todayXP: Long = 0,
    val coins: Long = 0,
    val recentRuns: List<RunRecord> = emptyList(),
    val todayDistanceKm: Double = 0.0,
    val todayCalories: Int = 0,
    val todayActiveMinutes: Int = 0,
    val dailyDistanceGoalKm: Double = 5.0,
    val dailyCaloriesGoal: Int = 500,
    val dailyActiveMinutesGoal: Int = 30,
) {
    val distanceRingProgress get() = (todayDistanceKm / dailyDistanceGoalKm).toFloat().coerceIn(0f, 1f)
    val caloriesRingProgress get() = (todayCalories / dailyCaloriesGoal.toFloat()).coerceIn(0f, 1f)
    val activeMinutesRingProgress get() = (todayActiveMinutes / dailyActiveMinutesGoal.toFloat()).coerceIn(0f, 1f)
}

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadUserData()
        loadRecentRuns()
        loadTodayActivity()
    }

    private fun loadUserData() {
        val uid = auth.currentUser?.uid ?: return
        firestore.collection("users").document(uid).addSnapshotListener { snap, _ ->
            val data = snap?.data ?: return@addSnapshotListener
            _uiState.value = _uiState.value.copy(
                displayName = data["displayName"] as? String ?: auth.currentUser?.displayName ?: "Runner",
                avatarUrl = data["avatarUrl"] as? String,
                streakDays = (data["streakDays"] as? Long ?: 0L).toInt(),
                coins = data["coins"] as? Long ?: 0L,
                todayXP = (data["todayXP"] as? Long) ?: 0L,
            )
        }
    }

    private fun loadTodayActivity() {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            try {
                val startOfDay = Calendar.getInstance().apply {
                    set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0)
                }.time
                val snap = firestore.collection("users").document(uid).collection("runs")
                    .whereGreaterThan("startedAt", Timestamp(startOfDay))
                    .get().await()

                val todayDist = snap.documents.sumOf { it.getDouble("distanceKm") ?: 0.0 }
                val todayCals = snap.documents.sumOf { (it.getLong("calories") ?: 0L).toInt() }
                val todayMins = snap.documents.sumOf { ((it.getLong("durationSeconds") ?: 0L) / 60).toInt() }

                _uiState.update { it.copy(todayDistanceKm = todayDist, todayCalories = todayCals, todayActiveMinutes = todayMins) }
            } catch (_: Exception) {}
        }
    }

    private fun loadRecentRuns() {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            try {
                val snap = firestore.collection("users").document(uid).collection("runs")
                    .orderBy("startedAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
                    .limit(5)
                    .get().await()
                val runs = snap.documents.mapNotNull { doc ->
                    try {
                        RunRecord(
                            id = doc.id,
                            distanceKm = doc.getDouble("distanceKm") ?: 0.0,
                            durationSeconds = (doc.getLong("durationSeconds") ?: 0L).toInt(),
                            averagePaceMinPerKm = doc.getDouble("averagePaceMinPerKm") ?: 0.0,
                            calories = (doc.getLong("calories") ?: doc.getDouble("calories")?.toLong() ?: 0L).toInt(),
                            xpEarned = (doc.getLong("xpEarned") ?: 0L).toInt(),
                        )
                    } catch (_: Exception) { null }
                }
                _uiState.value = _uiState.value.copy(recentRuns = runs)
            } catch (_: Exception) {}
        }
    }
}
