package com.ruvo.app.features.segments

import com.ruvo.app.core.model.RoutePoint
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

// Competitor-analysis Tier 2 #6 (Segments) — Strava's signature feature and
// the single most-requested "why don't you have this" among serious
// runners. Built on the same routeCoordinates every GPS-tracked run already
// stores, now carrying real per-point elapsed time (see RoutePoint /
// RunTrackingService.appendRoutePoint) so a segment effort's time is a real
// measurement, not an estimate.

data class RuvoSegment(
    val id: String = "",
    val name: String = "",
    val creatorUid: String = "",
    val creatorName: String = "",
    val distanceKm: Double = 0.0,
    val startLat: Double = 0.0,
    val startLng: Double = 0.0,
    val endLat: Double = 0.0,
    val endLng: Double = 0.0,
    val polyline: List<Pair<Double, Double>> = emptyList(),
    val sourceRunId: String = "",
)

data class SegmentEffort(
    val uid: String = "",
    val userName: String = "",
    val bestSeconds: Int = 0,
    val runId: String = "",
)

private const val EARTH_RADIUS_METERS = 6_371_000.0

// Standard haversine great-circle distance — pure so segment matching is
// unit-testable against known real-world distances rather than only ever
// exercised by a live GPS-simulated run.
internal fun haversineMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
    val dLat = Math.toRadians(lat2 - lat1)
    val dLng = Math.toRadians(lng2 - lng1)
    val a = sin(dLat / 2).pow(2) +
        cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLng / 2).pow(2)
    val c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return EARTH_RADIUS_METERS * c
}

// Default GPS-noise tolerance for "did this run pass through the segment's
// start/end" — wide enough to absorb ordinary consumer-GPS drift (RunTrackingService's
// own noise filter already rejects worse than this at the point-capture level),
// tight enough that two parallel streets don't count as the same segment.
internal const val SEGMENT_MATCH_THRESHOLD_METERS = 40.0

// Pure — no Firestore/network involved — so "did this run cover this
// segment, and in how long" is unit testable without a live GPS-simulated
// run reproducing an exact real-world route each time. Returns null when
// the run never comes within threshold of the start point, or comes within
// threshold of the end point only *before* the start point (an out-and-back
// run passing the segment backwards shouldn't score an effort on it).
internal fun matchSegmentEffortSeconds(
    runPoints: List<RoutePoint>,
    segmentStart: Pair<Double, Double>,
    segmentEnd: Pair<Double, Double>,
    matchThresholdMeters: Double = SEGMENT_MATCH_THRESHOLD_METERS,
): Int? {
    val startIdx = runPoints.indexOfFirst {
        haversineMeters(it.latitude, it.longitude, segmentStart.first, segmentStart.second) <= matchThresholdMeters
    }
    if (startIdx == -1) return null
    val endIdx = (startIdx until runPoints.size).firstOrNull { i ->
        haversineMeters(runPoints[i].latitude, runPoints[i].longitude, segmentEnd.first, segmentEnd.second) <= matchThresholdMeters
    } ?: return null
    if (endIdx <= startIdx) return null
    val effort = runPoints[endIdx].elapsedSeconds - runPoints[startIdx].elapsedSeconds
    return if (effort > 0) effort else null
}
