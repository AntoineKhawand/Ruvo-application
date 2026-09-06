package com.ruvo.app.features.runtracking

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// Covers decidePaceAlert() — the direction/threshold/cooldown gating that
// previously needed a live GPS-simulated workout run each time to confirm
// (feeding synthetic slow-then-fast pace via `adb emu geo fix` to check
// "Speed up"/"Ease up" actually fire, and only as often as intended).
class VoiceCoachTest {

    private val target = 4.0 // min/km
    private val threshold = 20.0 / 60.0 // matches VoiceCoach's real default

    @Test
    fun `on pace within threshold does not alert`() {
        val decision = decidePaceAlert(
            currentPaceMinPerKm = target + threshold / 2,
            targetPaceMinPerKm = target,
            elapsedSeconds = 100,
            lastDirection = 0,
            lastAlertElapsedSeconds = Int.MIN_VALUE,
        )
        assertEquals(0, decision.direction)
        assertFalse(decision.shouldSpeak)
    }

    @Test
    fun `deviation exactly at threshold does not alert (strict greater-than)`() {
        // Uses an explicit, exactly-representable threshold (0.5) rather than
        // the real default (20/60, a repeating binary fraction) — computing
        // target + threshold and having the code subtract target back out
        // isn't guaranteed to reproduce the same double bit-for-bit, so that
        // combination doesn't reliably test the boundary it looks like it
        // does. 0.5 round-trips exactly, so this genuinely exercises `>` vs
        // `>=` at the boundary (confirmed by deliberately mutating the
        // implementation to `>=` during development: only this rewritten
        // version caught it, the original threshold/60.0 version didn't).
        val decision = decidePaceAlert(
            currentPaceMinPerKm = target + 0.5,
            targetPaceMinPerKm = target,
            elapsedSeconds = 100,
            lastDirection = 0,
            lastAlertElapsedSeconds = Int.MIN_VALUE,
            thresholdMinPerKm = 0.5,
        )
        assertEquals(0, decision.direction)
        assertFalse(decision.shouldSpeak)
    }

    @Test
    fun `slower than target beyond threshold alerts Speed up`() {
        val decision = decidePaceAlert(
            currentPaceMinPerKm = target + threshold + 1.0, // much slower
            targetPaceMinPerKm = target,
            elapsedSeconds = 100,
            lastDirection = 0,
            lastAlertElapsedSeconds = Int.MIN_VALUE,
        )
        assertEquals(1, decision.direction)
        assertTrue(decision.shouldSpeak)
    }

    @Test
    fun `faster than target beyond threshold alerts Ease up`() {
        val decision = decidePaceAlert(
            currentPaceMinPerKm = target - threshold - 1.0, // much faster
            targetPaceMinPerKm = target,
            elapsedSeconds = 100,
            lastDirection = 0,
            lastAlertElapsedSeconds = Int.MIN_VALUE,
        )
        assertEquals(-1, decision.direction)
        assertTrue(decision.shouldSpeak)
    }

    @Test
    fun `repeat in same direction within cooldown does not alert again`() {
        val decision = decidePaceAlert(
            currentPaceMinPerKm = target + threshold + 1.0,
            targetPaceMinPerKm = target,
            elapsedSeconds = 120, // 20s after the previous alert
            lastDirection = 1,
            lastAlertElapsedSeconds = 100,
            cooldownSeconds = 45,
        )
        assertEquals(1, decision.direction)
        assertFalse(decision.shouldSpeak)
    }

    @Test
    fun `repeat in same direction after cooldown alerts again`() {
        val decision = decidePaceAlert(
            currentPaceMinPerKm = target + threshold + 1.0,
            targetPaceMinPerKm = target,
            elapsedSeconds = 146, // exactly 46s after the previous alert
            lastDirection = 1,
            lastAlertElapsedSeconds = 100,
            cooldownSeconds = 45,
        )
        assertEquals(1, decision.direction)
        assertTrue(decision.shouldSpeak)
    }

    @Test
    fun `direction change bypasses cooldown immediately`() {
        // Was alerted "too slow" 5s ago (well within a 45s cooldown), but the
        // runner has now swung to "too fast" — a direction change should
        // still fire right away, not wait out the cooldown.
        val decision = decidePaceAlert(
            currentPaceMinPerKm = target - threshold - 1.0,
            targetPaceMinPerKm = target,
            elapsedSeconds = 105,
            lastDirection = 1,
            lastAlertElapsedSeconds = 100,
            cooldownSeconds = 45,
        )
        assertEquals(-1, decision.direction)
        assertTrue(decision.shouldSpeak)
    }

    @Test
    fun `returning to on-pace resets direction without alerting`() {
        val decision = decidePaceAlert(
            currentPaceMinPerKm = target,
            targetPaceMinPerKm = target,
            elapsedSeconds = 110,
            lastDirection = 1,
            lastAlertElapsedSeconds = 100,
            cooldownSeconds = 45,
        )
        assertEquals(0, decision.direction)
        assertFalse(decision.shouldSpeak)
    }
}
