package com.ruvo.app.features.analytics

import androidx.compose.ui.graphics.Color
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

data class WeeklyDistanceData(val weekLabel: String, val distanceKm: Double)
data class PacePoint(val label: String, val paceMinPerKm: Double)
data class HeartRateZone(val label: String, val fraction: Float, val color: Color)
data class RecentRunItem(
    val id: String,
    val date: String,
    val distanceKm: Double,
    val paceFormatted: String,
    val durationFormatted: String,
    val xpEarned: Int,
)

data class AnalyticsUiState(
    val selectedPeriod: String = "1M",
    val totalDistanceKm: Double = 0.0,
    val totalRuns: Int = 0,
    val avgPaceFormatted: String = "--:--",
    val totalDurationHours: Double = 0.0,
    val weeklyDistances: List<WeeklyDistanceData> = emptyList(),
    val paceTrend: List<PacePoint> = emptyList(),
    val heartRateZones: List<HeartRateZone> = emptyList(),
    val vo2max: Double = 0.0,
    val recentRuns: List<RecentRunItem> = emptyList(),
)

@HiltViewModel
class AnalyticsViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(AnalyticsUiState())
    val uiState: StateFlow<AnalyticsUiState> = _uiState.asStateFlow()

    init { loadData() }

    fun selectPeriod(period: String) {
        _uiState.value = _uiState.value.copy(selectedPeriod = period)
        loadData()
    }

    fun loadData() {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            try {
                val since = periodStart(_uiState.value.selectedPeriod)
                val query = firestore.collection("users").document(uid).collection("runs")
                    .orderBy("startedAt", Query.Direction.DESCENDING)
                    .let { q -> if (since != null) q.whereGreaterThan("startedAt", com.google.firebase.Timestamp(since.time / 1000, 0)) else q }
                    .limit(200)

                val snap = query.get().await()
                val docs = snap.documents

                val totalDist = docs.sumOf { it.getDouble("distanceKm") ?: 0.0 }
                val totalSec = docs.sumOf { it.getLong("durationSeconds") ?: 0L }
                val avgPace = if (totalDist > 0) totalSec.toDouble() / 60.0 / totalDist else 0.0

                // Weekly buckets
                val cal = Calendar.getInstance()
                val weekMap = TreeMap<String, Double>()
                val sdf = SimpleDateFormat("MMM d", Locale.getDefault())
                docs.forEach { doc ->
                    val ts = doc.getTimestamp("startedAt")?.toDate() ?: return@forEach
                    cal.time = ts
                    val weekNum = cal.get(Calendar.WEEK_OF_YEAR)
                    val year = cal.get(Calendar.YEAR)
                    val key = "$year-W$weekNum"
                    weekMap[key] = (weekMap[key] ?: 0.0) + (doc.getDouble("distanceKm") ?: 0.0)
                }
                val weekly = weekMap.entries.toList().takeLast(8).map { e -> WeeklyDistanceData(e.key.substringAfter("-"), e.value) }

                // Pace trend — last 10 runs
                val pacePoints = docs.take(10).reversed().mapIndexed { i, doc ->
                    val pace = doc.getDouble("averagePaceMinPerKm") ?: 0.0
                    val ts = doc.getTimestamp("startedAt")?.toDate()
                    PacePoint(ts?.let { sdf.format(it) } ?: "Run ${i+1}", pace)
                }

                // Recent runs
                val recent = docs.take(10).mapNotNull { doc ->
                    val dist = doc.getDouble("distanceKm") ?: return@mapNotNull null
                    val pace = doc.getDouble("averagePaceMinPerKm") ?: 0.0
                    val dur = (doc.getLong("durationSeconds") ?: 0L).toInt()
                    val ts = doc.getTimestamp("startedAt")?.toDate()
                    RecentRunItem(
                        id = doc.id,
                        date = ts?.let { SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(it) } ?: "",
                        distanceKm = dist,
                        paceFormatted = pace.toFormattedPace(),
                        durationFormatted = dur.toFormattedDuration(),
                        xpEarned = (doc.getLong("xpEarned") ?: 0L).toInt(),
                    )
                }

                // HR zones placeholder (real data would come from health connect)
                val hrZones = listOf(
                    HeartRateZone("Z1", 0.20f, Color(0xFF4ADE80)),
                    HeartRateZone("Z2", 0.35f, RuvoColors.lime),
                    HeartRateZone("Z3", 0.25f, Color(0xFFFBBF24)),
                    HeartRateZone("Z4", 0.15f, Color(0xFFF97316)),
                    HeartRateZone("Z5", 0.05f, Color(0xFFEF4444)),
                )

                _uiState.value = _uiState.value.copy(
                    totalDistanceKm = totalDist,
                    totalRuns = docs.size,
                    avgPaceFormatted = avgPace.toFormattedPace(),
                    totalDurationHours = totalSec.toDouble() / 3600.0,
                    weeklyDistances = weekly.toList(),
                    paceTrend = pacePoints,
                    heartRateZones = hrZones,
                    recentRuns = recent,
                )
            } catch (_: Exception) {}
        }
    }

    private fun periodStart(period: String): Date? {
        val cal = Calendar.getInstance()
        return when (period) {
            "1W" -> { cal.add(Calendar.WEEK_OF_YEAR, -1); cal.time }
            "1M" -> { cal.add(Calendar.MONTH, -1); cal.time }
            "3M" -> { cal.add(Calendar.MONTH, -3); cal.time }
            "1Y" -> { cal.add(Calendar.YEAR, -1); cal.time }
            else -> null
        }
    }
}

private fun Double.toFormattedPace(): String {
    if (this <= 0 || this > 30) return "--:--"
    val min = this.toInt(); val sec = ((this - min) * 60).toInt()
    return String.format("%d:%02d", min, sec)
}

private fun Int.toFormattedDuration(): String {
    val h = this / 3600; val m = (this % 3600) / 60; val s = this % 60
    return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%d:%02d", m, s)
}
