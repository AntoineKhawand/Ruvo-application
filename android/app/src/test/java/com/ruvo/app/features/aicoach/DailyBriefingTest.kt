package com.ruvo.app.features.aicoach

import com.ruvo.app.features.analytics.TrainingLoadStatus
import com.ruvo.app.features.weather.RunWeatherAdvice
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// Covers composeDailyBriefing()/computeStreakForBriefing() — the "what
// would make this app very special" data-fusion feature: several signals
// that already exist independently (training load, missed sessions,
// streak, weather), fused into the ONE thing worth opening with. The
// priority order between them is the actual product logic here, so it's
// what these tests exercise.
class DailyBriefingTest {

    private val highLoad = TrainingLoadStatus(2.0, "High Load", "high load message", androidx.compose.ui.graphics.Color.Red)
    private val buildingFast = TrainingLoadStatus(1.4, "Building Fast", "building fast message", androidx.compose.ui.graphics.Color.Yellow)
    private val optimal = TrainingLoadStatus(1.0, "Optimal", "optimal message", androidx.compose.ui.graphics.Color.Green)
    private val badWeather = RunWeatherAdvice("🥵", "Extreme heat", "38°C", "Move your run earlier.", isGoodForRun = false, tipTitle = "", tip = "")

    @Test
    fun `High Load outranks everything else, even a bad-weather day`() {
        val briefing = composeDailyBriefing(highLoad, missedSessionsThisWeek = 3, streakDays = 10, weatherAdvice = badWeather)
        assertEquals("high load message", briefing.message)
    }

    @Test
    fun `2 or more missed sessions outranks weather and a lower training-load band`() {
        val briefing = composeDailyBriefing(buildingFast, missedSessionsThisWeek = 2, streakDays = 10, weatherAdvice = badWeather)
        assertTrue(briefing.message.contains("2 sessions"))
    }

    @Test
    fun `bad weather outranks Building Fast and a streak`() {
        val briefing = composeDailyBriefing(buildingFast, missedSessionsThisWeek = 0, streakDays = 10, weatherAdvice = badWeather)
        assertTrue(briefing.message.contains("Extreme heat"))
    }

    @Test
    fun `Building Fast surfaces when nothing more urgent is present`() {
        val briefing = composeDailyBriefing(buildingFast, missedSessionsThisWeek = 0, streakDays = 1, weatherAdvice = null)
        assertEquals("building fast message", briefing.message)
    }

    @Test
    fun `a real streak is celebrated when there's no bad news`() {
        val briefing = composeDailyBriefing(null, missedSessionsThisWeek = 0, streakDays = 5, weatherAdvice = null)
        assertTrue(briefing.message.contains("5 days"))
    }

    @Test
    fun `Optimal load surfaces below a streak worth mentioning`() {
        // Only 1 day streak (not yet "worth mentioning" at the 3-day bar),
        // so Optimal load is the next thing down the priority list.
        val briefing = composeDailyBriefing(optimal, missedSessionsThisWeek = 0, streakDays = 1, weatherAdvice = null)
        assertEquals("optimal message", briefing.message)
    }

    @Test
    fun `nothing notable falls back to a calm, non-alarming default`() {
        val briefing = composeDailyBriefing(null, missedSessionsThisWeek = 0, streakDays = 0, weatherAdvice = null)
        assertTrue(briefing.message.contains("no red flags"))
    }

    // --- computeStreakForBriefing ---

    @Test
    fun `streak counts consecutive days ending today`() {
        val today = LocalDate.now()
        val dates = setOf(today, today.minusDays(1), today.minusDays(2))
        assertEquals(3, computeStreakForBriefing(dates))
    }

    @Test
    fun `a gap breaks the streak`() {
        val today = LocalDate.now()
        val dates = setOf(today, today.minusDays(2)) // yesterday missing
        assertEquals(1, computeStreakForBriefing(dates))
    }

    @Test
    fun `not having run yet today doesn't break a streak still active from yesterday`() {
        val today = LocalDate.now()
        val dates = setOf(today.minusDays(1), today.minusDays(2))
        assertEquals(2, computeStreakForBriefing(dates))
    }
}
