package com.ruvo.app.features.training

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Covers computeMissedWorkoutDays()/computeAdaptiveNudgeMessage() —
// competitor-analysis Tier 3 #10. These decide whether TrainingPlanViewModel
// surfaces a proactive "ease this week" nudge, so getting the day-matching
// and the missed-count threshold right here is what keeps the plan from
// either nagging over one skipped run or staying silent through a genuinely
// rough week.
class AdaptivePlanTest {

    // A Monday-start week, matching WeekDayStrip's own reference point.
    private val monday = LocalDate.of(2026, 9, 7)

    private val longRun = TrainingWorkout(day = "Sat", title = "Long Run", detail = "10km Steady", icon = "map", isRest = false)
    private val speedWork = TrainingWorkout(day = "Wed", title = "Speed Work", detail = "5km Intervals", icon = "stopwatch", isRest = false)
    private val easyRun = TrainingWorkout(day = "Mon", title = "Easy Run", detail = "6km Zone 2", icon = "walk", isRest = false)
    private val restDay = TrainingWorkout(day = "Tue", title = "Rest Day", detail = "Focus on sleep", icon = "bed", isRest = true)

    @Test
    fun `a scheduled day with no completed run counts as missed`() {
        // Today is Thu: Mon and Wed have already passed, Sat hasn't yet.
        val missed = computeMissedWorkoutDays(
            workouts = listOf(easyRun, speedWork, longRun),
            todayDay = "Thu",
            weekMonday = monday,
            completedRunDates = emptySet(),
        )
        assertEquals(setOf("Mon", "Wed"), missed)
    }

    @Test
    fun `a completed run on that calendar date clears the miss`() {
        val monRunDate = monday // Mon = weekMonday itself
        val missed = computeMissedWorkoutDays(
            workouts = listOf(easyRun, speedWork),
            todayDay = "Thu",
            weekMonday = monday,
            completedRunDates = setOf(monRunDate),
        )
        assertEquals(setOf("Wed"), missed)
    }

    @Test
    fun `a day that hasn't happened yet this week is never counted as missed`() {
        val missed = computeMissedWorkoutDays(
            workouts = listOf(longRun), // Sat
            todayDay = "Thu",
            weekMonday = monday,
            completedRunDates = emptySet(),
        )
        assertTrue(missed.isEmpty())
    }

    @Test
    fun `rest days are never counted as missed even if unmatched`() {
        val missed = computeMissedWorkoutDays(
            workouts = listOf(restDay), // Tue, isRest
            todayDay = "Thu",
            weekMonday = monday,
            completedRunDates = emptySet(),
        )
        assertTrue(missed.isEmpty())
    }

    @Test
    fun `today itself is not yet counted as missed`() {
        // Today is Wed, and Wed has a scheduled session — it hasn't failed
        // to happen yet just because it's not done at the moment of the check.
        val missed = computeMissedWorkoutDays(
            workouts = listOf(speedWork), // Wed
            todayDay = "Wed",
            weekMonday = monday,
            completedRunDates = emptySet(),
        )
        assertTrue(missed.isEmpty())
    }

    @Test
    fun `nudge message stays null below the 2-missed threshold`() {
        assertNull(computeAdaptiveNudgeMessage(0))
        assertNull(computeAdaptiveNudgeMessage(1))
    }

    @Test
    fun `nudge message appears once 2 or more sessions are missed`() {
        val message = computeAdaptiveNudgeMessage(2)
        assertTrue(message!!.contains("2 sessions"))
        assertTrue(message.contains("ease"))
        assertTrue(computeAdaptiveNudgeMessage(3)!!.contains("3 sessions"))
    }
}
