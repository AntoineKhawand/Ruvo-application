package com.ruvo.app.features.analytics

import androidx.compose.ui.graphics.Color
import com.ruvo.app.designsystem.theme.RuvoColors
import java.time.LocalDate

// "Do we need to build additional things to make this app very special" —
// none of the 7 competitors in the competitor-analysis report compute a
// personalized, ongoing injury-risk signal, and this app already collects
// everything it needs to (runHistory date + distance) without any new data
// collection. Formula and bands are the standard, citable acute:chronic
// workload ratio (ACWR) from sports-science injury-prevention research
// (Gabbett, "The training—injury prevention paradox", Br J Sports Med
// 2016) — deliberately the simple rolling-average version, not an EWMA
// variant: EWMA is smoother but its smoothing constant is itself a tuned,
// harder-to-justify choice, where the plain rolling ratio is the version
// most commonly cited and is straightforward to test and explain.
//
// Distance-based load, not RPE-weighted: RPE is collected on
// RateEffortScreen but frequently skipped, so a load metric that depends
// on it being present would silently degrade for exactly the runners who
// skip that step. Worth revisiting as an enhancement once real RPE
// completion rates are known, not before.

data class TrainingLoadStatus(
    val acwr: Double,
    val band: String,
    val message: String,
    val color: Color,
)

private const val ACUTE_WINDOW_DAYS = 7L
private const val CHRONIC_WINDOW_DAYS = 28L
private const val CHRONIC_WEEKS = 4.0

// Below this much real running in the last 28 days, an ACWR is more noise
// than signal — a runner's first couple of weeks would otherwise produce
// wildly extreme (and misleading) ratios off almost no history. Returns
// null rather than a number that looks authoritative but isn't.
private const val MIN_CHRONIC_KM_FOR_SIGNAL = 8.0
private const val MIN_CHRONIC_RUNS_FOR_SIGNAL = 3

private val DETRAINING_COLOR = Color(0xFF64B5F6)
private val ELEVATED_COLOR = Color(0xFFFF9500)
private val HIGH_LOAD_COLOR = Color(0xFFEF4444)

// Pure — no Firestore/Android involved — so the window math and band
// thresholds are unit-testable against synthetic run histories rather than
// only ever exercised by waiting real weeks of real training to happen.
internal fun computeTrainingLoad(
    runs: List<Pair<LocalDate, Double>>, // (date, distanceKm), any order, any window
    today: LocalDate = LocalDate.now(),
): TrainingLoadStatus? {
    val acuteStart = today.minusDays(ACUTE_WINDOW_DAYS - 1)
    val chronicStart = today.minusDays(CHRONIC_WINDOW_DAYS - 1)

    val chronicRuns = runs.filter { (date, _) -> !date.isBefore(chronicStart) && !date.isAfter(today) }
    val chronicTotalKm = chronicRuns.sumOf { it.second }
    if (chronicTotalKm < MIN_CHRONIC_KM_FOR_SIGNAL || chronicRuns.size < MIN_CHRONIC_RUNS_FOR_SIGNAL) return null

    val acuteKm = chronicRuns.filter { (date, _) -> !date.isBefore(acuteStart) }.sumOf { it.second }
    val chronicWeeklyAvgKm = chronicTotalKm / CHRONIC_WEEKS
    val acwr = acuteKm / chronicWeeklyAvgKm

    return when {
        acwr < 0.8 -> TrainingLoadStatus(
            acwr, "Detraining",
            "Your training load has dropped below your recent normal — a good time for a comeback long run once you're ready.",
            DETRAINING_COLOR,
        )
        acwr <= 1.3 -> TrainingLoadStatus(
            acwr, "Optimal",
            "Your training load is well-balanced against your recent base — a healthy ratio of effort to build on.",
            RuvoColors.lime,
        )
        acwr <= 1.5 -> TrainingLoadStatus(
            acwr, "Building Fast",
            "You've ramped up quickly this week. Consider an easier day so your body can catch up.",
            ELEVATED_COLOR,
        )
        else -> TrainingLoadStatus(
            acwr, "High Load",
            "Your training load has spiked well above your recent normal — this is when running injuries most often happen. An easy day or extra rest would help.",
            HIGH_LOAD_COLOR,
        )
    }
}
