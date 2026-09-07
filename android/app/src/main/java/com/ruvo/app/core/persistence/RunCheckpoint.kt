package com.ruvo.app.core.persistence

import kotlinx.serialization.Serializable

// Net-new feature: RN has no crash-recovery/mid-run persistence at all (see
// RN_SOURCE_ARCHIVE.md §1, ActiveRunScreen sub-task 15) despite tracking a
// run's state entirely in memory. This is a periodic snapshot of an
// in-progress run so a killed process (crash, OS memory pressure, force-stop)
// can offer to resume instead of silently losing the whole GPS track.
// Security/data-integrity fix: checkpoints used to carry no owner at all
// and were never cleared on sign-out — on a shared or reused device, a
// leftover mid-run checkpoint from whoever was signed in before could be
// silently offered to (and resumed by) the NEXT signed-in user, and the
// resulting run would save under the new user's account despite
// containing the previous user's actual GPS trail/distance. `uid`
// defaults to "" so an old persisted checkpoint (saved before this field
// existed) still deserializes — RunRecoveryViewModel treats a blank or
// mismatched uid as unrecoverable rather than crashing on it.
@Serializable
data class RunCheckpoint(
    val runId: String,
    val uid: String = "",
    val startedAtEpochMs: Long,
    val elapsedSeconds: Int,
    val distanceMeters: Double,
    val elevationGainMeters: Double,
    val isPaused: Boolean,
    val route: List<CheckpointPoint> = emptyList(),
    val laps: List<CheckpointLap> = emptyList(),
)

// elapsedSeconds defaults to 0 so an old persisted checkpoint (saved before
// this field existed) still deserializes fine — a crash-recovered run just
// starts with unknown per-point timing rather than failing to resume at all.
@Serializable
data class CheckpointPoint(val lat: Double, val lng: Double, val elapsedSeconds: Int = 0)

@Serializable
data class CheckpointLap(
    val number: Int,
    val distanceKm: Double,
    val durationSeconds: Int,
    val paceMinPerKm: Double,
)
