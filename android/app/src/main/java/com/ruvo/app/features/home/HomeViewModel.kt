package com.ruvo.app.features.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.core.content.ContentRepository
import com.ruvo.app.core.model.RunRecord
import com.ruvo.app.core.model.Tip
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
    val dailyTips: List<Tip> = emptyList(),
) {
    val distanceRingProgress get() = (todayDistanceKm / dailyDistanceGoalKm).toFloat().coerceIn(0f, 1f)
    val caloriesRingProgress get() = (todayCalories / dailyCaloriesGoal.toFloat()).coerceIn(0f, 1f)
    val activeMinutesRingProgress get() = (todayActiveMinutes / dailyActiveMinutesGoal.toFloat()).coerceIn(0f, 1f)
}

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
    private val contentRepository: ContentRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadUserData()
        loadRecentRuns()
        loadTodayActivity()
        loadDailyTips()
    }

    private fun loadDailyTips() {
        viewModelScope.launch {
            try {
                val tips = contentRepository.fetchTips().shuffled().take(4)
                _uiState.update { it.copy(dailyTips = tips) }
            } catch (_: Exception) { }
        }
    }

    private fun loadUserData() {
        val uid = auth.currentUser?.uid ?: return
        firestore.collection("users").document(uid).addSnapshotListener { snap, _ ->
            val data = snap?.data ?: return@addSnapshotListener
            // Real Firestore fields are "name" and "avatar" (UserContext.js's
            // DEFAULT_USER_DATA) — same fallback chain ProfileViewModel already
            // uses for its own profile. This screen previously read "displayName"
            // (never written on its own) and "avatarUrl" (not a real field at
            // all), so the greeting name silently fell back to auth's cached
            // display name and the avatar never rendered. "streakDays" and
            // "todayXP" aren't real fields either (see computeStreak()/
            // loadTodayActivity() below, same "no persisted counter" pattern
            // already fixed on ProfileScreen's Streak card) — no longer read here.
            _uiState.value = _uiState.value.copy(
                displayName = data["name"] as? String ?: data["displayName"] as? String
                    ?: auth.currentUser?.displayName ?: "Runner",
                avatarUrl = data["avatar"] as? String,
                coins = data["coins"] as? Long ?: 0L,
            )
        }
    }

    // The real saveRunActivity Cloud Function (functions/index.js) writes each
    // finished run as one entry in the users/{uid}.runHistory ARRAY field — there
    // is no users/{uid}/runs subcollection (see RN_ANDROID_PORT_MAPPING.md's
    // "Known Data-Layer Bugs" section). Both loadTodayActivity() and
    // loadRecentRuns() used to query that nonexistent subcollection, so Home's
    // "Today's Activity" ring and "Recent Activity" list were always empty.
    private suspend fun fetchRunHistory(uid: String): List<Map<String, Any>> {
        val data = firestore.collection("users").document(uid).get().await().data ?: return emptyList()
        @Suppress("UNCHECKED_CAST")
        return data["runHistory"] as? List<Map<String, Any>> ?: emptyList()
    }

    private fun parseRunDate(run: Map<String, Any>): Date? =
        (run["date"] as? String)?.let { runCatching { Date.from(java.time.Instant.parse(it)) }.getOrNull() }

    private fun parseRunDurationSeconds(run: Map<String, Any>): Long {
        val parts = (run["duration"] as? String)?.split(":")?.mapNotNull { it.toLongOrNull() } ?: return 0L
        return when (parts.size) {
            2 -> parts[0] * 60 + parts[1]
            3 -> parts[0] * 3600 + parts[1] * 60 + parts[2]
            else -> 0L
        }
    }

    private fun loadTodayActivity() {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            try {
                val startOfDay = Calendar.getInstance().apply {
                    set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0)
                }.time
                val todayRuns = fetchRunHistory(uid).filter { run ->
                    parseRunDate(run)?.let { it >= startOfDay } == true
                }

                val todayDist = todayRuns.sumOf { (it["distance"] as? Number)?.toDouble() ?: 0.0 }
                val todayCals = todayRuns.sumOf { (it["calories"] as? Number)?.toInt() ?: 0 }
                val todayMins = todayRuns.sumOf { (parseRunDurationSeconds(it) / 60).toInt() }
                // Same public saveRunActivity formula used in loadRecentRuns() —
                // there's no persisted per-day XP counter, only cumulative
                // currentXP, so "Today XP" is derived from today's runs here too.
                val todayXp = todayRuns.sumOf { run ->
                    val distanceKm = (run["distance"] as? Number)?.toDouble() ?: 0.0
                    val durationMinutes = parseRunDurationSeconds(run) / 60.0
                    kotlin.math.floor(distanceKm * 100 + durationMinutes * 2).toLong()
                }

                _uiState.update { it.copy(todayDistanceKm = todayDist, todayCalories = todayCals, todayActiveMinutes = todayMins, todayXP = todayXp) }
            } catch (_: Exception) {}
        }
    }

    // RN has no persisted streak counter anywhere (see RN_ANDROID_PORT_MAPPING.md's
    // "Known Data-Layer Bugs" entry / ProfileScreen.kt's own computeStreak()) —
    // walked backward from today over actual run dates, same algorithm as Profile's
    // Streak card so both screens always agree.
    private fun computeStreak(runDates: Set<Date>): Int {
        val cal = Calendar.getInstance()
        fun dayKey(d: Date): Long {
            cal.time = d
            cal.set(Calendar.HOUR_OF_DAY, 0); cal.set(Calendar.MINUTE, 0)
            cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0)
            return cal.timeInMillis
        }
        val days = runDates.map(::dayKey).toSet()
        var day = dayKey(Date())
        val oneDayMs = 24L * 60 * 60 * 1000
        if (day !in days) day -= oneDayMs // today not run yet doesn't break the streak
        var streak = 0
        while (day in days) {
            streak++
            day -= oneDayMs
        }
        return streak
    }

    private fun loadRecentRuns() {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            try {
                val allRuns = fetchRunHistory(uid)
                val runDates = allRuns.mapNotNull { parseRunDate(it) }.toSet()
                _uiState.update { it.copy(streakDays = computeStreak(runDates)) }

                val runs = allRuns
                    .sortedByDescending { parseRunDate(it) ?: Date(0) }
                    .take(5)
                    .map { run ->
                        val distanceKm = (run["distance"] as? Number)?.toDouble() ?: 0.0
                        val durationSeconds = parseRunDurationSeconds(run)
                        val avgPace = if (distanceKm > 0) durationSeconds / 60.0 / distanceKm else 0.0
                        RunRecord(
                            id = run["id"] as? String ?: "",
                            distanceKm = distanceKm,
                            durationSeconds = durationSeconds.toInt(),
                            averagePaceMinPerKm = avgPace,
                            calories = (run["calories"] as? Number)?.toInt() ?: 0,
                            // xpEarned isn't stored per-run (only ever a global currentXP
                            // increment) — replicate the exact public saveRunActivity formula.
                            xpEarned = kotlin.math.floor(distanceKm * 100 + (durationSeconds / 60.0) * 2).toInt(),
                        )
                    }
                _uiState.value = _uiState.value.copy(recentRuns = runs)
            } catch (_: Exception) {}
        }
    }
}
