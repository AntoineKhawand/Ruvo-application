package com.ruvo.wear.shared

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// Covers the encode/decode round-trip for both Data Layer message types —
// this is the one contract the phone and watch modules must never disagree
// on, so it's tested here independently of either module, and independently
// of ever having a real watch paired to test against live.
class RunCompanionProtocolTest {

    @Test
    fun `stats payload round-trips exactly`() {
        val original = RunStatsPayload(distanceKm = 5.23, paceMinPerKm = 5.75, elapsedSeconds = 1830, runState = "Running")
        val decoded = decodeStats(encodeStats(original))
        assertEquals(original, decoded)
    }

    @Test
    fun `control command round-trips exactly`() {
        val original = RunControlCommand(RunControlCommand.PAUSE)
        val decoded = decodeControl(encodeControl(original))
        assertEquals(original, decoded)
    }

    @Test
    fun `decoding garbage bytes returns null instead of throwing`() {
        assertNull(decodeStats("not valid json at all".encodeToByteArray()))
        assertNull(decodeControl(byteArrayOf(0, 1, 2, 3)))
    }

    @Test
    fun `decoding the wrong message type's bytes fails closed rather than misreading fields`() {
        // A stats payload's bytes handed to decodeControl (path mix-up) —
        // "action" isn't a field on RunStatsPayload's JSON, so this must
        // come back null, not a RunControlCommand with a garbage action.
        val statsBytes = encodeStats(RunStatsPayload(1.0, 5.0, 60, "Running"))
        assertNull(decodeControl(statsBytes))
    }

    @Test
    fun `unknown extra fields don't break decoding`() {
        // ignoreUnknownKeys — a newer phone talking to an older watch (or
        // vice versa) shouldn't hard-fail just because one side added a
        // field the other doesn't know about yet.
        val json = """{"distanceKm":1.0,"paceMinPerKm":5.0,"elapsedSeconds":60,"runState":"Running","futureField":"x"}"""
        assertEquals(RunStatsPayload(1.0, 5.0, 60, "Running"), decodeStats(json.encodeToByteArray()))
    }
}
