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

@Serializable
data class CheckpointPoint(val lat: Double, val lng: Double)

@Serializable
data class CheckpointLap(
    val number: Int,
    val distanceKm: Double,
    val durationSeconds: Int,
    val paceMinPerKm: Double,
)
