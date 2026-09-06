package com.ruvo.app.features.analytics

import org.junit.Assert.assertEquals
import org.junit.Test

// Covers computeRecoveryStatus() — competitor-analysis Tier 1 #1 replaced a
// pure hours-since-last-run heuristic with real biometrics where available.
// The exact preference order (wearable > Health Connect > heuristic) and the
// WHOOP-style banding are the parts easy to get subtly wrong and previously
// had no way to exercise short of actually connecting a WHOOP/Oura account
// or granting Health Connect permissions on a test device.
class RecoveryStatusTest {

    @Test
    fun `whoop recovery wins over oura and health connect when all present`() {
        val status = computeRecoveryStatus(
            RecoveryBiometrics(whoopRecovery = 80, ouraReadiness = 20, restingHeartRate = 70, sleepHours = 4.0),
            hoursSinceLastRun = 1.0,
        )
        assertEquals("WHOOP", status.source)
        assertEquals(80, status.percent)
        assertEquals("Ready to Train", status.text)
    }

    @Test
    fun `oura wins over health connect when whoop absent`() {
        val status = computeRecoveryStatus(
            RecoveryBiometrics(whoopRecovery = 0, ouraReadiness = 50, restingHeartRate = 70, sleepHours = 4.0),
            hoursSinceLastRun = 1.0,
        )
        assertEquals("Oura", status.source)
        assertEquals(50, status.percent)
        assertEquals("Almost Ready", status.text)
    }

    @Test
    fun `health connect sleep and resting heart rate combine when no wearable connected`() {
        // sleepScore = 8/8*100 = 100, rhrScore = (80-40)/40*100 = 100 -> 100
        val status = computeRecoveryStatus(
            RecoveryBiometrics(whoopRecovery = 0, ouraReadiness = 0, restingHeartRate = 40, sleepHours = 8.0),
            hoursSinceLastRun = 1.0,
        )
        assertEquals("Health Connect", status.source)
        assertEquals(100, status.percent)
    }

    @Test
    fun `poor sleep and high resting heart rate score low via health connect`() {
        // sleepScore = 3/8*100 = 37.5, rhrScore = (80-80)/40*100 = 0 -> (37.5+0)/2 = 18.75 -> 19 (rounds up)
        val status = computeRecoveryStatus(
            RecoveryBiometrics(whoopRecovery = 0, ouraReadiness = 0, restingHeartRate = 80, sleepHours = 3.0),
            hoursSinceLastRun = 1.0,
        )
        assertEquals("Health Connect", status.source)
        assertEquals(19, status.percent)
        assertEquals("Recovering", status.text)
    }

    @Test
    fun `falls back to hours-since-last-run heuristic when no biometrics available at all`() {
        val status = computeRecoveryStatus(RecoveryBiometrics(), hoursSinceLastRun = 12.0)
        assertEquals("", status.source)
        assertEquals("Recovering", status.text)
        assertEquals(40, status.percent)
    }

    @Test
    fun `no biometrics and no run history ever defaults to ready`() {
        val status = computeRecoveryStatus(RecoveryBiometrics(), hoursSinceLastRun = null)
        assertEquals("", status.source)
        assertEquals("Ready to Train", status.text)
        assertEquals(100, status.percent)
    }

    @Test
    fun `a wearable score at the exact recovering-to-almost-ready boundary bands as almost ready`() {
        val status = computeRecoveryStatus(
            RecoveryBiometrics(whoopRecovery = 34),
            hoursSinceLastRun = null,
        )
        assertEquals("Almost Ready", status.text)
    }

    @Test
    fun `a wearable score at the exact almost-ready-to-ready boundary bands as ready`() {
        val status = computeRecoveryStatus(
            RecoveryBiometrics(whoopRecovery = 67),
            hoursSinceLastRun = null,
        )
        assertEquals("Ready to Train", status.text)
    }
}
