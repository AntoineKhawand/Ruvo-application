package com.ruvo.app.features.aicoach

import com.ruvo.app.features.training.TrainingWorkout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// Covers restTodayInWorkouts()/easeWorkouts() — competitor-analysis Tier 1 #3
// ("Not Feeling 100%"). These are the exact mutations applyPlanAdjustment
// writes back to Firestore's trainingPlan.weeks[0], so getting the matching
// and idempotency rules right here is what keeps the AI Coach from silently
// resting the wrong day or compounding an "ease" on every follow-up message.
class AICoachPlanAdjustmentTest {

    private val longRun = TrainingWorkout(day = "Sat", title = "Long Run", detail = "10km Steady", icon = "map", isRest = false)
    private val speedWork = TrainingWorkout(day = "Wed", title = "Speed Work", detail = "5km Intervals", icon = "stopwatch", isRest = false)
    private val easyRun = TrainingWorkout(day = "Mon", title = "Easy Run", detail = "6km Zone 2", icon = "walk", isRest = false)
    private val restDay = TrainingWorkout(day = "Sun", title = "Rest Day", detail = "Focus on sleep", icon = "bed", isRest = true)

    @Test
    fun `rest_today marks only the workout matching today's day as rest`() {
        val (updated, outcome) = restTodayInWorkouts(listOf(easyRun, speedWork, longRun), today = "Wed", note = "")
        assertTrue(updated.first { it.day == "Wed" }.isRest)
        assertFalse(updated.first { it.day == "Mon" }.isRest)
        assertFalse(updated.first { it.day == "Sat" }.isRest)
        assertTrue(outcome.contains("rest day"))
    }

    @Test
    fun `rest_today uses the coach's note as the new detail when provided`() {
        val (updated, _) = restTodayInWorkouts(listOf(speedWork), today = "Wed", note = "Sore calves")
        assertEquals("Sore calves", updated.first().detail)
    }

    @Test
    fun `rest_today falls back to a generic note when none is given`() {
        val (updated, _) = restTodayInWorkouts(listOf(speedWork), today = "Wed", note = "")
        assertEquals("Adjusted by your AI Coach.", updated.first().detail)
    }

    @Test
    fun `rest_today does nothing and says so when today has no scheduled session`() {
        val (updated, outcome) = restTodayInWorkouts(listOf(speedWork, longRun), today = "Tue", note = "")
        assertEquals(listOf(speedWork, longRun), updated)
        assertTrue(outcome.contains("don't have a scheduled session"))
    }

    @Test
    fun `rest_today never touches an already-rest day even if it matches today`() {
        val (updated, outcome) = restTodayInWorkouts(listOf(restDay), today = "Sun", note = "")
        assertEquals(restDay, updated.first())
        assertTrue(outcome.contains("don't have a scheduled session"))
    }

    @Test
    fun `ease_this_week reduces every non-rest workout's distance by 30 percent`() {
        val (updated, outcome) = easeWorkouts(listOf(longRun, speedWork, restDay), note = "")
        // 10km * 0.7 = 7km, 5km * 0.7 = 3.5km
        assertEquals("7km Steady", updated.first { it.day == "Sat" }.detail)
        assertEquals("3.5km Intervals", updated.first { it.day == "Wed" }.detail)
        assertEquals(restDay, updated.first { it.day == "Sun" }) // untouched
        assertTrue(outcome.contains("eased"))
    }

    @Test
    fun `ease_this_week prefixes the title so a repeat call is a no-op, not a double ease`() {
        val (firstPass, _) = easeWorkouts(listOf(longRun), note = "")
        val (secondPass, outcome) = easeWorkouts(firstPass, note = "")
        assertEquals(firstPass, secondPass) // unchanged the second time
        assertTrue(outcome.contains("already"))
    }

    @Test
    fun `ease_this_week reports nothing to ease when the week is entirely rest days`() {
        val (updated, outcome) = easeWorkouts(listOf(restDay), note = "")
        assertEquals(listOf(restDay), updated)
        assertTrue(outcome.contains("already"))
    }
}
