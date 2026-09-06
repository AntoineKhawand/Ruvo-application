package com.ruvo.app.core.persistence

import kotlinx.serialization.Serializable

// Net-new feature: RN has no crash-recovery/mid-run persistence at all (see
// RN_SOURCE_ARCHIVE.md §1, ActiveRunScreen sub-task 15) despite tracking a
// run's state entirely in memory. This is a periodic snapshot of an
// in-progress run so a killed process (crash, OS memory pressure, force-stop)
// can offer to resume instead of silently losing the whole GPS track.
@Serializable
data class RunCheckpoint(
    val runId: String,
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
