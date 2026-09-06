package com.ruvo.app.core.notifications

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.DayOfWeek
import java.time.ZoneOffset
import java.time.ZonedDateTime

// Covers nextRunReminderTriggerMillis() — the "which real instant does this
// alarm land on" math that previously needed a live emulator run each time to
// confirm (e.g. discovering live that a Friday-6:46pm alarm set after 6:46pm
// on a Friday correctly rolls to *next* Friday, not tomorrow). Fixed `now`
// values make every case deterministic instead of depending on wall-clock
// time at test-run time.
class RunReminderSchedulerTest {

    // Wednesday 2026-09-09, 12:00:00 UTC — an arbitrary fixed "now" fixed to a
    // known weekday so day-of-week arithmetic below is easy to reason about.
    private val now = ZonedDateTime.of(2026, 9, 9, 12, 0, 0, 0, ZoneOffset.UTC)

    @Test
    fun `specific day later today schedules today`() {
        // Same day (Wednesday), time later than now (18:00 > 12:00).
        val trigger = nextRunReminderTriggerMillis(DayOfWeek.WEDNESDAY, 18, 0, now)
        val expected = ZonedDateTime.of(2026, 9, 9, 18, 0, 0, 0, ZoneOffset.UTC).toInstant().toEpochMilli()
        assertEquals(expected, trigger)
    }

    @Test
    fun `specific day earlier today rolls to next week, not tomorrow`() {
        // Same day (Wednesday), time already passed (06:00 < 12:00) — must
        // land on *next* Wednesday, not Thursday.
        val trigger = nextRunReminderTriggerMillis(DayOfWeek.WEDNESDAY, 6, 0, now)
        val expected = ZonedDateTime.of(2026, 9, 16, 6, 0, 0, 0, ZoneOffset.UTC).toInstant().toEpochMilli()
        assertEquals(expected, trigger)
    }

    @Test
    fun `different day later this week schedules that day`() {
        // now is Wednesday; Friday is later this week.
        val trigger = nextRunReminderTriggerMillis(DayOfWeek.FRIDAY, 18, 46, now)
        val expected = ZonedDateTime.of(2026, 9, 11, 18, 46, 0, 0, ZoneOffset.UTC).toInstant().toEpochMilli()
        assertEquals(expected, trigger)
    }

    @Test
    fun `different day earlier in the week rolls to next week`() {
        // now is Wednesday; Monday already passed this week.
        val trigger = nextRunReminderTriggerMillis(DayOfWeek.MONDAY, 18, 46, now)
        val expected = ZonedDateTime.of(2026, 9, 14, 18, 46, 0, 0, ZoneOffset.UTC).toInstant().toEpochMilli()
        assertEquals(expected, trigger)
    }

    @Test
    fun `no day selected and time still ahead today falls back to today`() {
        val trigger = nextRunReminderTriggerMillis(day = null, hour = 18, minute = 0, now = now)
        val expected = ZonedDateTime.of(2026, 9, 9, 18, 0, 0, 0, ZoneOffset.UTC).toInstant().toEpochMilli()
        assertEquals(expected, trigger)
    }

    @Test
    fun `no day selected and time already passed today falls back to tomorrow`() {
        val trigger = nextRunReminderTriggerMillis(day = null, hour = 6, minute = 0, now = now)
        val expected = ZonedDateTime.of(2026, 9, 10, 6, 0, 0, 0, ZoneOffset.UTC).toInstant().toEpochMilli()
        assertEquals(expected, trigger)
    }

    @Test
    fun `target exactly equal to now does not fire immediately`() {
        // Uses isAfter (strict), not isAfter-or-equal — landing exactly on
        // `now` must roll forward a full cycle, not fire this instant.
        val exactNow = ZonedDateTime.of(2026, 9, 9, 12, 0, 0, 0, ZoneOffset.UTC)
        val trigger = nextRunReminderTriggerMillis(DayOfWeek.WEDNESDAY, 12, 0, exactNow)
        val expected = ZonedDateTime.of(2026, 9, 16, 12, 0, 0, 0, ZoneOffset.UTC).toInstant().toEpochMilli()
        assertEquals(expected, trigger)
    }
}
