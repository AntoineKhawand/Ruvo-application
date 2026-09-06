package com.ruvo.app.features.community

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

// Covers clusterRoutesByStartPoint() — competitor-analysis Tier 2 #8. The
// grid-cell + distance-bucket heuristic is the part easiest to get subtly
// wrong (a route split into two "different" clusters because of a rounding
// edge, or two unrelated routes merged because they happen to start near
// each other), and previously had no way to check it short of comparing
// real GPS-simulated runs by eye on the Community screen.
class RouteDiscoveryTest {

    private fun route(
        id: String,
        owner: String,
        startLat: Double,
        startLng: Double,
        distanceKm: Double,
        daysAgo: Long = 0,
    ) = RunRoute(
        runId = id,
        ownerName = owner,
        points = listOf(startLat to startLng, startLat + 0.01 to startLng + 0.01),
        distanceKm = distanceKm,
        date = Instant.now().minusSeconds(daysAgo * 86_400),
    )

    @Test
    fun `two runs from the same start point and similar distance cluster together`() {
        val routes = listOf(
            route("r1", "Alice", 40.7128, -74.0060, 5.0),
            route("r2", "Bob", 40.7129, -74.0061, 5.1),
        )
        val clusters = clusterRoutesByStartPoint(routes)
        assertEquals(1, clusters.size)
        assertEquals(2, clusters.first().runCount)
    }

    @Test
    fun `runs from clearly different start points do not cluster together`() {
        val routes = listOf(
            route("r1", "Alice", 40.7128, -74.0060, 5.0),
            route("r2", "Bob", 34.0522, -118.2437, 5.0), // New York vs Los Angeles
        )
        val clusters = clusterRoutesByStartPoint(routes)
        assertEquals(2, clusters.size)
    }

    @Test
    fun `same start point but very different distance does not cluster together`() {
        val routes = listOf(
            route("r1", "Alice", 40.7128, -74.0060, 3.0),
            route("r2", "Bob", 40.7128, -74.0060, 10.0),
        )
        val clusters = clusterRoutesByStartPoint(routes)
        assertEquals(2, clusters.size)
    }

    @Test
    fun `a route with fewer than two points is skipped rather than crashing`() {
        val emptyRoute = RunRoute(runId = "r1", ownerName = "Alice", points = emptyList(), distanceKm = 5.0, date = Instant.now())
        val singlePointRoute = RunRoute(runId = "r2", ownerName = "Bob", points = listOf(40.7128 to -74.0060), distanceKm = 5.0, date = Instant.now())
        // clusterRoutesByStartPoint only needs a first point to bucket, so a
        // single-point route still clusters fine — only truly empty is skipped.
        val clusters = clusterRoutesByStartPoint(listOf(emptyRoute, singlePointRoute))
        assertEquals(1, clusters.size)
        assertEquals(1, clusters.first().runCount)
    }

    @Test
    fun `clusters are sorted by run count descending`() {
        val routes = listOf(
            route("r1", "Alice", 40.7128, -74.0060, 5.0),
            route("r2", "Bob", 34.0522, -118.2437, 5.0),
            route("r3", "Carol", 34.0523, -118.2438, 5.0),
        )
        val clusters = clusterRoutesByStartPoint(routes)
        assertEquals(2, clusters.first().runCount) // LA cluster (2 runs) ranks above NY (1 run)
        assertEquals(1, clusters.last().runCount)
    }

    @Test
    fun `the same runner appearing twice in one cluster is only listed once`() {
        val routes = listOf(
            route("r1", "Alice", 40.7128, -74.0060, 5.0, daysAgo = 1),
            route("r2", "Alice", 40.7128, -74.0060, 5.0, daysAgo = 0),
        )
        val clusters = clusterRoutesByStartPoint(routes)
        assertEquals(1, clusters.size)
        assertEquals(2, clusters.first().runCount)
        assertEquals(listOf("Alice"), clusters.first().runnerNames)
    }

    @Test
    fun `preview points come from the most recently run route in the cluster`() {
        val older = route("r1", "Alice", 40.7128, -74.0060, 5.0, daysAgo = 5)
        val newer = route("r2", "Bob", 40.7128, -74.0060, 5.0, daysAgo = 0)
        val clusters = clusterRoutesByStartPoint(listOf(older, newer))
        assertEquals(newer.points, clusters.first().previewPoints)
    }

    @Test
    fun `empty input produces no clusters`() {
        assertTrue(clusterRoutesByStartPoint(emptyList()).isEmpty())
    }
}
