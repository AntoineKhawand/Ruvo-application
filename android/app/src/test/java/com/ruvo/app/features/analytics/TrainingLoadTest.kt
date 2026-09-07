package com.ruvo.app.features.analytics

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Covers computeTrainingLoad() — the acute:chronic workload ratio (ACWR)
// added as a "what would make this app very special" feature, not an RN
// port. Verifies the window math (7-day acute over 28-day/4-week chronic
// average) and the standard sports-science risk bands independently of
// waiting real weeks of real training to happen.
class TrainingLoadTest {

    private val today = LocalDate.of(2026, 9, 7)

    // Evenly-spaced runs so acute == chronic weekly average exactly — the
    // "nothing has changed" baseline case.
    private fun steadyHistory(weeklyKm: Double, weeks: Int): List<Pair<LocalDate, Double>> =
        (0 until weeks).map { w -> today.minusWeeks(w.toLong()) to weeklyKm }

    @Test
    fun `not enough history returns null rather than a misleading ratio`() {
        // A single 5km run, nowhere near the minimum chronic distance/count.
        val status = computeTrainingLoad(listOf(today to 5.0), today = today)
        assertNull(status)
    }

    @Test
    fun `steady training with no change lands in the Optimal band`() {
        // 4 runs of 5km each spread across the last 4 weeks: chronic total
        // 20km, weekly avg 5km; the most recent run's week has 5km acute too.
        val status = computeTrainingLoad(steadyHistory(weeklyKm = 5.0, weeks = 4), today = today)
        assertEquals("Optimal", status!!.band)
        assertEquals(1.0, status.acwr, 0.01)
    }

    @Test
    fun `a big recent spike over a light base lands in High Load`() {
        // Light base for 3 weeks (2km each = 6km chronic before this week),
        // then a heavy 20km run this week: chronic total 26km / 4 = 6.5km
        // avg; acute (this week only) = 20km -> acwr ~= 3.08.
        val history = listOf(
            today to 20.0,
            today.minusWeeks(1) to 2.0,
            today.minusWeeks(2) to 2.0,
            today.minusWeeks(3) to 2.0,
        )
        val status = computeTrainingLoad(history, today = today)
        assertEquals("High Load", status!!.band)
        assertTrue(status.acwr > 1.5)
    }

    @Test
    fun `a big drop in recent training lands in Detraining`() {
        // Solid base for 3 prior weeks (8km each = 24km), nothing this week.
        val history = listOf(
            today.minusWeeks(1) to 8.0,
            today.minusWeeks(2) to 8.0,
            today.minusWeeks(3) to 8.0,
        )
        val status = computeTrainingLoad(history, today = today)
        assertEquals("Detraining", status!!.band)
        assertTrue(status.acwr < 0.8)
    }

    @Test
    fun `moderately ramping up lands in Building Fast, not High Load`() {
        // Chronic total 8 (base) + 8 + 8 + 12 (this week) = 36 / 4 = 9 avg;
        // acute = 12 -> acwr = 1.33, inside the 1.3-1.5 caution band.
        val history = listOf(
            today to 12.0,
            today.minusWeeks(1) to 8.0,
            today.minusWeeks(2) to 8.0,
            today.minusWeeks(3) to 8.0,
        )
        val status = computeTrainingLoad(history, today = today)
        assertEquals("Building Fast", status!!.band)
    }

    @Test
    fun `runs older than the 28-day chronic window are ignored`() {
        // Only ancient history — nothing in the last 28 days at all.
        val history = listOf(today.minusDays(90) to 50.0)
        assertNull(computeTrainingLoad(history, today = today))
    }
}
