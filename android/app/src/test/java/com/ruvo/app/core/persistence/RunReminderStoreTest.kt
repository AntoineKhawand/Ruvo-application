package com.ruvo.app.core.persistence

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.DayOfWeek

// Covers the CSV<->Set<DayOfWeek> round-trip used to persist the reminder
// schedule locally — an easy place for a silent bug (a bad ordinal, an empty
// string, an unsorted set producing a different string each save) to make
// every scheduled day quietly vanish after a reboot with no visible error.
class RunReminderStoreTest {

    @Test
    fun `formats days sorted by weekday regardless of input order`() {
        val csv = formatReminderDays(setOf(DayOfWeek.FRIDAY, DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY))
        assertEquals("1,3,5", csv)
    }

    @Test
    fun `parses a comma-joined ordinal list back into the same days`() {
        val days = parseReminderDays("1,3,5")
        assertEquals(setOf(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY), days)
    }

    @Test
    fun `empty string parses to no days, not a crash`() {
        assertTrue(parseReminderDays("").isEmpty())
    }

    @Test
    fun `unparseable entries are dropped instead of failing the whole parse`() {
        val days = parseReminderDays("garbage,3,,9")
        // "garbage" isn't an int, "" isn't an int, 9 isn't a valid
        // DayOfWeek.value (1-7) — only "3" (Wednesday) should survive.
        assertEquals(setOf(DayOfWeek.WEDNESDAY), days)
    }

    @Test
    fun `format then parse round-trips to the original set`() {
        val original = setOf(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY, DayOfWeek.TUESDAY)
        assertEquals(original, parseReminderDays(formatReminderDays(original)))
    }

    @Test
    fun `empty set round-trips to empty`() {
        assertTrue(parseReminderDays(formatReminderDays(emptySet())).isEmpty())
    }
}
