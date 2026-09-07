package com.ruvo.app.features.runtracking

import com.ruvo.app.core.persistence.RunCheckpoint
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// Covers isCheckpointResumable() — a real cross-account data-integrity bug
// found while checking this app's security/data-safety end to end:
// RunCheckpoint used to carry no owner at all and was never cleared on
// sign-out, so a leftover mid-run checkpoint from a previous signed-in
// user on the same device could be silently offered to (and resumed by)
// whoever signs in next, saving the wrong person's GPS trail/distance
// under the new account.
class RunRecoveryTest {

    private val checkpoint = RunCheckpoint(
        runId = "run1", uid = "user-a", startedAtEpochMs = 0, elapsedSeconds = 300,
        distanceMeters = 1000.0, elevationGainMeters = 0.0, isPaused = false,
    )

    @Test
    fun `a checkpoint owned by the current user is resumable`() {
        assertTrue(isCheckpointResumable(checkpoint, currentUid = "user-a"))
    }

    @Test
    fun `bug fix - a checkpoint owned by a different user is not resumable`() {
        assertFalse(isCheckpointResumable(checkpoint, currentUid = "user-b"))
    }

    @Test
    fun `bug fix - a legacy checkpoint with no uid at all is never assumed to be mine`() {
        val legacyCheckpoint = checkpoint.copy(uid = "")
        assertFalse(isCheckpointResumable(legacyCheckpoint, currentUid = "user-a"))
    }

    @Test
    fun `no signed-in user at all means nothing is resumable`() {
        assertFalse(isCheckpointResumable(checkpoint, currentUid = null))
    }
}
