package com.ruvo.app.features.analytics

import androidx.compose.ui.graphics.Color
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.getCustomerInfoWith
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

// RN_SOURCE_ARCHIVE.md §2 "Calculations": AnalyticsScreen.js's processChartData
// buckets every chart series by CALENDAR DAY across the selected period (not
// week, not "last N runs") and downsamples X-axis labels per period so ticks
// don't overlap. One shared point type for all four charts below.
data class ChartPoint(val label: String, val value: Double)
data class HeartRateZone(val label: String, val fraction: Float, val color: Color)
data class RecentRunItem(
    val id: String,
    val date: String,
    val distanceKm: Double,
    val paceFormatted: String,
    val durationFormatted: String,
    val xpEarned: Int,
)

// useAnalytics.js "3. RACE PREDICTOR" — Riegel's formula off the best
// 5k-normalized effort in history. null when no run has ever covered ≥5km.
data class RacePredictions(
    val fiveK: String,
    val tenK: String,
    val half: String,
    val marathon: String,
)

// useAnalytics.js "5. RECOVERY STATUS" — heuristic off time since last run.
data class RecoveryStatus(val text: String, val color: Color, val percent: Int)

data class AnalyticsUiState(
    val selectedPeriod: String = "1M",
    val totalDistanceKm: Double = 0.0,
    val totalRuns: Int = 0,
    val avgPaceFormatted: String = "--:--",
    val totalDurationHours: Double = 0.0,
    // Day-bucketed chart series, matching RN's processChartData exactly:
    // distance/elevation are per-day SUMS, pace/heartRate use RN's
    // recency-weighted running "half-blend" (see buildDayBuckets below).
    val distanceChart: List<ChartPoint> = emptyList(),
    val paceChart: List<ChartPoint> = emptyList(),
    val elevationChart: List<ChartPoint> = emptyList(),
    val heartRateChart: List<ChartPoint> = emptyList(),
    val heartRateZones: List<HeartRateZone> = emptyList(),
    val vo2max: Double = 0.0,
    // RN's useAnalytics.js "8. CONSISTENCY SCORE" — avg runs/week over the
    // last 28 days, one decimal, computed off the full lifetime history
    // (not the period selector) same as VO2 Max/HR zones below.
    val consistencyScore: Double = 0.0,
    val racePredictions: RacePredictions? = null,
    val recoveryStatus: RecoveryStatus? = null,
    val recentRuns: List<RecentRunItem> = emptyList(),
    // RN_SOURCE_ARCHIVE.md §2: "Advanced Metrics section (PRO-gated) ...
    // upgrade banner if not Pro" — real, documented RN behavior. Android
    // already has a working RevenueCat entitlement check (see
    // AICoachViewModel's identical pattern); this just connects Analytics
    // to it too, which it never was.
    val isPro: Boolean = false,
)

@HiltViewModel
class AnalyticsViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(AnalyticsUiState())
    val uiState: StateFlow<AnalyticsUiState> = _uiState.asStateFlow()

    init {
        loadData()
        checkProStatus()
    }

    fun selectPeriod(period: String) {
        _uiState.value = _uiState.value.copy(selectedPeriod = period)
        loadData()
    }

    private fun checkProStatus() {
        Purchases.sharedInstance.getCustomerInfoWith(
            onError = {},
            onSuccess = { customerInfo ->
                _uiState.value = _uiState.value.copy(isPro = customerInfo.entitlements["pro"]?.isActive == true)
            }
        )
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
                    val elevation = (r["elevationGain"] as? Number)?.toDouble() ?: 0.0
                    ParsedRun(id, date, dist, durSec, avgPace, hr, elevation)
                }.sortedByDescending { it.date ?: Date(0) }

                val runs = allRuns.filter { since == null || (it.date != null && it.date >= since) }

                val totalDist = runs.sumOf { it.distanceKm }
                val totalSec = runs.sumOf { it.durationSeconds }
                val avgPace = if (totalDist > 0) totalSec.toDouble() / 60.0 / totalDist else 0.0

                // Day-bucketed Distance/Pace/Elevation/Heart Rate charts — see
                // buildDayBuckets for the exact per-day sum vs. half-blend rules.
                val dayBuckets = buildDayBuckets(runs, _uiState.value.selectedPeriod, since)

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
                // maxHR = 220 - age. OnboardingScreen's Bio step (built 2026-08-25)
                // finally gives Android a real "dob" field to compute age from — same
                // real field name UserContext.js's DEFAULT_USER_DATA always had.
                // Still falls back to RN's own documented default (`userData.age || 30`)
                // for any account that predates that step / skipped it.
                val dobStr = doc.getString("dob")
                val age = dobStr?.let { runCatching { java.time.LocalDate.parse(it) }.getOrNull() }
                    ?.let { java.time.Period.between(it, java.time.LocalDate.now()).years }
                    ?.takeIf { it in 5..110 } // sanity-guard against corrupt/garbage dob values
                    ?: 30
                val maxHr = 220 - age
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

                // --- 3. RACE PREDICTOR (useAnalytics.js) --- best 5k-normalized
                // effort from any run ≥5km, then Riegel's formula T2 = T1*(D2/D1)^1.06.
                val best5kSec = allRuns
                    .filter { it.distanceKm >= 5 }
                    .minOfOrNull { (it.durationSeconds / it.distanceKm) * 5 }
                val racePredictions = best5kSec?.let { t1 ->
                    fun predict(distKm: Double): String {
                        val t = t1 * Math.pow(distKm / 5.0, 1.06)
                        val h = (t / 3600).toInt()
                        val m = ((t % 3600) / 60).toInt()
                        return if (h > 0) "${h}h ${m}m" else "${m}m"
                    }
                    RacePredictions(fiveK = predict(5.0), tenK = predict(10.0), half = predict(21.1), marathon = predict(42.2))
                }

                // --- 5. RECOVERY STATUS (useAnalytics.js) --- heuristic off hours
                // since the most recent run in the full history.
                val recoveryStatus = allRuns.firstOrNull { it.date != null }?.date?.let { lastRunDate ->
                    val hoursSince = (Date().time - lastRunDate.time) / (1000.0 * 60 * 60)
                    when {
                        hoursSince < 24 -> RecoveryStatus("Recovering", Color(0xFFFF9500), 40)
                        hoursSince < 48 -> RecoveryStatus("Almost Ready", RuvoColors.lime, 80)
                        else -> RecoveryStatus("Ready to Train", Color(0xFF4CD964), 100)
                    }
                } ?: RecoveryStatus("Ready to Train", Color(0xFF4CD964), 100)

                _uiState.value = _uiState.value.copy(
                    totalDistanceKm = totalDist,
                    totalRuns = runs.size,
                    avgPaceFormatted = avgPace.toFormattedPace(),
                    totalDurationHours = totalSec.toDouble() / 3600.0,
                    distanceChart = dayBuckets.distance,
                    paceChart = dayBuckets.pace,
                    elevationChart = dayBuckets.elevation,
                    heartRateChart = dayBuckets.heartRate,
                    heartRateZones = hrZones,
                    vo2max = vo2max,
                    consistencyScore = consistencyScore,
                    racePredictions = racePredictions,
                    recoveryStatus = recoveryStatus,
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
        val elevationGainM: Double = 0.0,
    )

    // RN_SOURCE_ARCHIVE.md §2: "X-axis label downsampling per range:
    // {1W:1, 1M:5, 3M:15, 6M:30, 1Y:60}." Android has no 6M period; "All" is
    // an Android-only addition RN never had a range for, so it gets a
    // proportional factor instead of an invented RN value.
    private fun labelDownsampleFactor(period: String, dayCount: Int): Int = when (period) {
        "1W" -> 1
        "1M" -> 5
        "3M" -> 15
        "1Y" -> 60
        else -> (dayCount / 12).coerceAtLeast(1) // "All"
    }

    private fun startOfDay(date: Date): Date {
        val cal = Calendar.getInstance()
        cal.time = date
        cal.set(Calendar.HOUR_OF_DAY, 0); cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0)
        return cal.time
    }

    private fun daysBetween(a: Date, b: Date): Int =
        ((b.time - a.time) / (1000L * 60 * 60 * 24)).toInt()

    // RN_SOURCE_ARCHIVE.md §2 "Calculations" — processChartData: per-day
    // bucketing where distance/elevationGain are SUMMED, but HR and pace use
    // a recency-weighted running "half-blend" rather than a true mean:
    // hrData[idx] = hrData[idx] ? (hrData[idx]+hr)/2 : hr (same for pace).
    // A day with no run keeps its initial 0 — RN's own fixed-size arrays
    // aren't sparse, so this is matched as-is rather than smoothed/filtered.
    private fun buildDayBuckets(runs: List<ParsedRun>, period: String, since: Date?): DayBuckets {
        val now = startOfDay(Date())
        val periodRuns = runs.filter { it.date != null }
        val earliestRunDay = periodRuns.minOfOrNull { startOfDay(it.date!!) }
        val rawStart = since?.let { startOfDay(it) } ?: (earliestRunDay ?: now)
        // Safety cap so an old "All" account can't allocate an unbounded
        // number of day-buckets; RN never had an unbounded range to compare
        // against here, so this cap is an Android-only guard, not a fidelity gap.
        val cappedDays = daysBetween(rawStart, now).coerceAtMost(729) + 1
        val bucketStart = Date(now.time - (cappedDays - 1) * 86_400_000L)

        val distance = DoubleArray(cappedDays)
        val elevation = DoubleArray(cappedDays)
        val pace = DoubleArray(cappedDays)
        val heartRate = DoubleArray(cappedDays)
        val hasPace = BooleanArray(cappedDays)
        val hasHr = BooleanArray(cappedDays)

        periodRuns.sortedBy { it.date }.forEach { run ->
            val runDay = startOfDay(run.date!!)
            if (runDay.before(bucketStart)) return@forEach
            val idx = daysBetween(bucketStart, runDay)
            if (idx !in 0 until cappedDays) return@forEach
            distance[idx] += run.distanceKm
            elevation[idx] += run.elevationGainM
            if (run.distanceKm > 0) {
                pace[idx] = if (hasPace[idx]) (pace[idx] + run.avgPaceMinPerKm) / 2 else run.avgPaceMinPerKm
                hasPace[idx] = true
            }
            if (run.heartRate > 0) {
                heartRate[idx] = if (hasHr[idx]) (heartRate[idx] + run.heartRate) / 2 else run.heartRate
                hasHr[idx] = true
            }
        }

        val factor = labelDownsampleFactor(period, cappedDays)
        val sdf = SimpleDateFormat("MMM d", Locale.getDefault())
        val labels = (0 until cappedDays).map { idx ->
            if (idx % factor == 0 || idx == cappedDays - 1) sdf.format(Date(bucketStart.time + idx * 86_400_000L)) else ""
        }

        return DayBuckets(
            distance = distance.indices.map { ChartPoint(labels[it], distance[it]) },
            pace = pace.indices.map { ChartPoint(labels[it], pace[it]) },
            elevation = elevation.indices.map { ChartPoint(labels[it], elevation[it]) },
            heartRate = heartRate.indices.map { ChartPoint(labels[it], heartRate[it]) },
        )
    }

    private data class DayBuckets(
        val distance: List<ChartPoint>,
        val pace: List<ChartPoint>,
        val elevation: List<ChartPoint>,
        val heartRate: List<ChartPoint>,
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
