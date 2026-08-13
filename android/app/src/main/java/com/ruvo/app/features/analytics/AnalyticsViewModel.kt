package com.ruvo.app.features.analytics

import androidx.compose.ui.graphics.Color
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
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
    // RN's useAnalytics.js "8. CONSISTENCY SCORE" — avg runs/week over the
    // last 28 days, one decimal, computed off the full lifetime history
    // (not the period selector) same as VO2 Max/HR zones below.
    val consistencyScore: Double = 0.0,
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

                // The real saveRunActivity Cloud Function (functions/index.js) writes
                // each finished run as one entry in the users/{uid}.runHistory ARRAY
                // field — there is no users/{uid}/runs subcollection. RN's own
                // AnalyticsScreen (via loadFullRunHistory() in UserContext.js) queries
                // that same nonexistent subcollection, so this was never real data in
                // either app (see RN_ANDROID_PORT_MAPPING.md's 2026-07-29 log entry for
                // the RunDetailScreen fix that uncovered this identical bug here).
                val doc = firestore.collection("users").document(uid).get().await()
                @Suppress("UNCHECKED_CAST")
                val runHistory = (doc.data?.get("runHistory") as? List<Map<String, Any>>) ?: emptyList()

                val sdf = SimpleDateFormat("MMM d", Locale.getDefault())
                // RN's useAnalytics.js computes VO2 Max/Consistency/HR-zones off the
                // FULL lifetime runHistory, independent of the period selector — only
                // the charts/period-total stats below are period-filtered. Parse once
                // from the full history, then derive both views from it.
                val allRuns = runHistory.mapNotNull { r ->
                    val id = r["id"] as? String ?: return@mapNotNull null
                    val dist = (r["distance"] as? Number)?.toDouble() ?: return@mapNotNull null
                    val durSec = parseDurationToSeconds(r["duration"] as? String)
                    val date = (r["date"] as? String)?.let { runCatching { Date.from(java.time.Instant.parse(it)) }.getOrNull() }
                    val avgPace = if (dist > 0) durSec / 60.0 / dist else 0.0
                    val hr = (r["heartRate"] as? Number)?.toDouble() ?: 0.0
                    ParsedRun(id, date, dist, durSec, avgPace, hr)
                }.sortedByDescending { it.date ?: Date(0) }

                val runs = allRuns.filter { since == null || (it.date != null && it.date >= since) }

                val totalDist = runs.sumOf { it.distanceKm }
                val totalSec = runs.sumOf { it.durationSeconds }
                val avgPace = if (totalDist > 0) totalSec.toDouble() / 60.0 / totalDist else 0.0

                // Weekly buckets
                val cal = Calendar.getInstance()
                val weekMap = TreeMap<String, Double>()
                runs.forEach { run ->
                    val d = run.date ?: return@forEach
                    cal.time = d
                    val weekNum = cal.get(Calendar.WEEK_OF_YEAR)
                    val year = cal.get(Calendar.YEAR)
                    val key = "$year-W$weekNum"
                    weekMap[key] = (weekMap[key] ?: 0.0) + run.distanceKm
                }
                val weekly = weekMap.entries.toList().takeLast(8).map { e -> WeeklyDistanceData(e.key.substringAfter("-"), e.value) }

                // Pace trend — last 10 runs
                val pacePoints = runs.take(10).reversed().mapIndexed { i, run ->
                    PacePoint(run.date?.let { sdf.format(it) } ?: "Run ${i + 1}", run.avgPaceMinPerKm)
                }

                // Recent runs. xpEarned isn't stored per-run (saveRunActivity only
                // applies it as a global currentXP increment) — replicate the exact
                // public server formula (functions/index.js, also RN_SOURCE_ARCHIVE.md
                // §9) rather than leave it wrong/zero.
                val recent = runs.take(10).map { run ->
                    RecentRunItem(
                        id = run.id,
                        date = run.date?.let { SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(it) } ?: "",
                        distanceKm = run.distanceKm,
                        paceFormatted = run.avgPaceMinPerKm.toFormattedPace(),
                        durationFormatted = run.durationSeconds.toInt().toFormattedDuration(),
                        xpEarned = kotlin.math.floor(run.distanceKm * 100 + (run.durationSeconds / 60.0) * 2).toInt(),
                    )
                }

                // --- 2. VO2 MAX ESTIMATION (useAnalytics.js) ---
                // 15 + (avgSpeedKmh * 3.5) + (200 - avgHR) * 0.15, over the last 5
                // runs (full history, not period-filtered) that have a heart rate.
                val last5WithHr = allRuns.take(5).filter { it.heartRate > 0 }
                val vo2max = if (last5WithHr.isNotEmpty()) {
                    val fiveRunDist = last5WithHr.sumOf { it.distanceKm }
                    val fiveRunHours = last5WithHr.sumOf { it.durationSeconds / 3600.0 }
                    val avgSpeedKmh = if (fiveRunHours > 0) fiveRunDist / fiveRunHours else 0.0
                    val avgHr = last5WithHr.sumOf { it.heartRate } / last5WithHr.size
                    if (avgSpeedKmh > 0 && avgHr > 0) 15 + (avgSpeedKmh * 3.5) + (200 - avgHr) * 0.15 else 0.0
                } else 0.0

                // --- 4. HEART RATE ZONES (useAnalytics.js) ---
                // maxHR = 220 - age; Android doesn't collect age at onboarding either,
                // so this uses RN's own fallback default of 30 (`userData.age || 30`),
                // not a fabricated Android-only default.
                val maxHr = 220 - 30
                val zoneCounts = IntArray(5)
                allRuns.forEach { run ->
                    if (run.heartRate > 0) {
                        val pct = run.heartRate / maxHr
                        val zoneIdx = when {
                            pct < 0.6 -> 0
                            pct < 0.7 -> 1
                            pct < 0.8 -> 2
                            pct < 0.9 -> 3
                            else -> 4
                        }
                        zoneCounts[zoneIdx]++
                    }
                }
                val maxZoneCount = (zoneCounts.maxOrNull() ?: 0).coerceAtLeast(1)
                val zoneColors = listOf(Color(0xFF4ADE80), RuvoColors.lime, Color(0xFFFBBF24), Color(0xFFF97316), Color(0xFFEF4444))
                val hrZones = zoneCounts.mapIndexed { i, count ->
                    HeartRateZone("Z${i + 1}", count.toFloat() / maxZoneCount, zoneColors[i])
                }

                // --- 8. CONSISTENCY SCORE (useAnalytics.js) --- avg runs/week, last 28 days.
                val twentyEightDaysAgo = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -28) }.time
                val consistencyScore = allRuns.count { it.date != null && it.date >= twentyEightDaysAgo } / 4.0

                _uiState.value = _uiState.value.copy(
                    totalDistanceKm = totalDist,
                    totalRuns = runs.size,
                    avgPaceFormatted = avgPace.toFormattedPace(),
                    totalDurationHours = totalSec.toDouble() / 3600.0,
                    weeklyDistances = weekly.toList(),
                    paceTrend = pacePoints,
                    heartRateZones = hrZones,
                    vo2max = vo2max,
                    consistencyScore = consistencyScore,
                    recentRuns = recent,
                )
            } catch (_: Exception) {}
        }
    }

    private data class ParsedRun(
        val id: String,
        val date: Date?,
        val distanceKm: Double,
        val durationSeconds: Long,
        val avgPaceMinPerKm: Double,
        val heartRate: Double = 0.0,
    )

    private fun parseDurationToSeconds(duration: String?): Long {
        val parts = duration?.split(":")?.mapNotNull { it.toLongOrNull() } ?: return 0L
        return when (parts.size) {
            2 -> parts[0] * 60 + parts[1]
            3 -> parts[0] * 3600 + parts[1] * 60 + parts[2]
            else -> 0L
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
