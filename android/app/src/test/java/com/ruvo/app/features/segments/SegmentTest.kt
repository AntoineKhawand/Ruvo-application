package com.ruvo.app.features.segments

import com.ruvo.app.core.model.RoutePoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Covers haversineMeters()/matchSegmentEffortSeconds() — competitor-analysis
// Tier 2 #6. Getting the start/end matching and effort-time math right here
// is what stood between "real leaderboard" and "silently awards a wrong
// time (or none at all) with no way to notice short of comparing a live
// GPS-simulated run's real duration by hand every time."
class SegmentTest {

    @Test
    fun `haversine distance between two known real-world points is accurate`() {
        // Empire State Building to Times Square, NYC — well-documented ~1.4km.
        val meters = haversineMeters(40.7484, -73.9857, 40.7580, -73.9855)
        assertTrue("expected ~1060m, got $meters", meters in 900.0..1200.0)
    }

    @Test
    fun `haversine distance between the same point is zero`() {
        assertEquals(0.0, haversineMeters(40.0, -74.0, 40.0, -74.0), 0.001)
    }

    private fun point(lat: Double, lng: Double, elapsed: Int) = RoutePoint(lat, lng, elapsed)

    @Test
    fun `a run that passes through both start and end scores the elapsed time between them`() {
        val runPoints = listOf(
            point(40.0000, -74.0000, 0),
            point(40.0010, -74.0000, 60), // segment start, matched here
            point(40.0020, -74.0000, 120),
            point(40.0030, -74.0000, 180), // segment end, matched here
            point(40.0040, -74.0000, 240),
        )
        val effort = matchSegmentEffortSeconds(
            runPoints,
            segmentStart = 40.0010 to -74.0000,
            segmentEnd = 40.0030 to -74.0000,
        )
        assertEquals(120, effort) // 180 - 60
    }

    @Test
    fun `a run that never comes near the segment start does not match`() {
        val runPoints = listOf(point(10.0, 10.0, 0), point(10.001, 10.001, 60))
        val effort = matchSegmentEffortSeconds(runPoints, segmentStart = 40.0 to -74.0, segmentEnd = 41.0 to -74.0)
        assertNull(effort)
    }

    @Test
    fun `a run that reaches start but never reaches end does not match`() {
        val runPoints = listOf(
            point(40.0000, -74.0000, 0),
            point(40.0010, -74.0000, 60), // matches start
            point(40.0011, -74.0000, 70), // never gets near "end"
        )
        val effort = matchSegmentEffortSeconds(runPoints, segmentStart = 40.0010 to -74.0000, segmentEnd = 50.0 to -74.0)
        assertNull(effort)
    }

    @Test
    fun `passing the end point before the start point does not count as an effort`() {
        // Runner goes end -> start (backwards along the segment), never start -> end.
        val runPoints = listOf(
            point(40.0030, -74.0000, 0),  // matches "end" first
            point(40.0020, -74.0000, 60),
            point(40.0010, -74.0000, 120), // matches "start" second
        )
        val effort = matchSegmentEffortSeconds(runPoints, segmentStart = 40.0010 to -74.0000, segmentEnd = 40.0030 to -74.0000)
        assertNull(effort)
    }

    @Test
    fun `points outside the match threshold are not treated as reaching the segment`() {
        val runPoints = listOf(
            point(40.0000, -74.0000, 0),
            // roughly 500m away — well outside the default 40m threshold
            point(40.0045, -74.0000, 60),
        )
        val effort = matchSegmentEffortSeconds(runPoints, segmentStart = 40.0010 to -74.0000, segmentEnd = 40.0030 to -74.0000)
        assertNull(effort)
    }

    @Test
    fun `the threshold is a hard cutoff at the exact match distance`() {
        val runPoints = listOf(
            point(40.0000, -74.0000, 0),
            point(40.0010, -74.0000, 60),
            point(40.0030, -74.0000, 180),
        )
        // Shift the "true" segment start slightly off the run's actual point
        // and derive the real distance via the already-tested haversine
        // function, rather than hand-computing it — a threshold just under
        // that distance must miss, one just over it must catch, regardless
        // of exactly how far the shift really is.
        val shiftedStart = 40.00105 to -74.0010
        val actualDistance = haversineMeters(40.0010, -74.0000, shiftedStart.first, shiftedStart.second)
        val missedWithDefault = matchSegmentEffortSeconds(
            runPoints, segmentStart = shiftedStart, segmentEnd = 40.0030 to -74.0000, matchThresholdMeters = actualDistance - 1.0,
        )
        val caughtWithWiderThreshold = matchSegmentEffortSeconds(
            runPoints, segmentStart = shiftedStart, segmentEnd = 40.0030 to -74.0000, matchThresholdMeters = actualDistance + 1.0,
        )
        assertNull(missedWithDefault)
        assertEquals(120, caughtWithWiderThreshold)
    }

    @Test
    fun `an empty route never matches`() {
        assertNull(matchSegmentEffortSeconds(emptyList(), 40.0 to -74.0, 41.0 to -74.0))
    }
}
