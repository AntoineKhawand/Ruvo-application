package com.ruvo.app.features.training

import java.time.LocalDate

// Competitor-analysis Tier 3 #10 (continuously-adaptive AI plan) — Runna's
// biggest 2026 change was that plans stopped resetting and started building
// on what a runner actually did. This formalizes Tier 1 #3's AI Coach bridge
// (AICoachViewModel's rest_today/ease_this_week, triggered only by a chat
// message) into a standing background check: every time the plan screen
// loads, it looks at how many of this week's already-passed scheduled
// sessions have no completed run to match, and if enough were missed,
// offers to ease the rest of the week on its own. It calls the exact same
// easeWorkouts() the chat path calls (see TrainingPlanViewModel
// .acceptAdaptiveNudge()), so "the AI Coach suggests it" and "the plan
// notices on its own" can never disagree about what "ease this week" means.

private val DAY_ORDER_ADAPTIVE = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

// Pure: which of this week's scheduled non-rest days — strictly before
// today, so a session scheduled for later today isn't judged as "missed"
// before it's even had a chance to happen — have no completed run logged
// on their calendar date. Takes plain data a Firestore doc already has, no
// I/O of its own, so the day-matching itself is unit-testable without a
// live plan or run history.
internal fun computeMissedWorkoutDays(
    workouts: List<TrainingWorkout>,
    todayDay: String,
    weekMonday: LocalDate,
    completedRunDates: Set<LocalDate>,
): Set<String> {
    val todayIdx = DAY_ORDER_ADAPTIVE.indexOf(todayDay)
    if (todayIdx < 0) return emptySet()
    return workouts
        .filter { !it.isRest }
        .filter { DAY_ORDER_ADAPTIVE.indexOf(it.day) in 0 until todayIdx }
        .filterNot { weekMonday.plusDays(DAY_ORDER_ADAPTIVE.indexOf(it.day).toLong()) in completedRunDates }
        .map { it.day }
        .toSet()
}

// Pure: the actual "should we nudge, and what does it say" decision, kept
// separate from the day-matching above so the threshold itself (currently
// 2+ missed sessions — one missed session happens to anyone and isn't worth
// interrupting a runner over) is independently testable and tunable.
internal fun computeAdaptiveNudgeMessage(missedDayCount: Int): String? =
    if (missedDayCount >= 2) "You've missed $missedDayCount sessions this week. Want me to ease up the rest of it?" else null
