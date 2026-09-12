import XCTest
@testable import RuvoiOS

/// First real test in this target — Package.swift declared a `RuvoiOSTests`
/// target whose `Tests/RuvoiOSTests` directory didn't exist at all, which
/// would fail `swift build`/`swift test` immediately on a missing-sources
/// error, unrelated to any real code issue. Covers the segment-matching
/// geometry ported from Android today, since it's pure logic with no
/// Firestore/network dependency — a good first real test rather than a
/// placeholder.
final class SegmentMatchingTests: XCTestCase {
    func testHaversineMetersIsZeroForIdenticalPoints() {
        XCTAssertEqual(haversineMeters(33.8938, 35.5018, 33.8938, 35.5018), 0, accuracy: 0.001)
    }

    func testHaversineMetersMatchesKnownDistance() {
        // Beirut (33.8938, 35.5018) to Jounieh (33.9808, 35.6178) is
        // roughly 13.5km along the coast; haversine (straight-line) is a
        // bit shorter than that. Assert a sane order of magnitude, not an
        // exact figure only a map tool could confirm.
        let meters = haversineMeters(33.8938, 35.5018, 33.9808, 35.6178)
        XCTAssertGreaterThan(meters, 10_000)
        XCTAssertLessThan(meters, 16_000)
    }

    func testMatchSegmentEffortSecondsFindsFirstEntryNotNearest() {
        // Points at increasing distance from the segment start, then back
        // closer, then far again -- the match must snap to the FIRST point
        // within threshold (index 1), not whichever point is nearest
        // overall (index 3 is closer here), matching Android's
        // `indexOfFirst` semantics exactly.
        let start = (lat: 0.0, lng: 0.0)
        let end = (lat: 0.001, lng: 0.0) // ~111m north
        let points = [
            RunRecord.RoutePoint(latitude: 0.01, longitude: 0.0, elapsedSeconds: 0),   // far
            RunRecord.RoutePoint(latitude: 0.0002, longitude: 0.0, elapsedSeconds: 10), // within 40m of start -- first entry
            RunRecord.RoutePoint(latitude: 0.0005, longitude: 0.0, elapsedSeconds: 20),
            RunRecord.RoutePoint(latitude: 0.00005, longitude: 0.0, elapsedSeconds: 30), // nearest overall, but too late
            RunRecord.RoutePoint(latitude: 0.001, longitude: 0.0, elapsedSeconds: 40),  // within 40m of end
        ]
        let effort = matchSegmentEffortSeconds(runPoints: points, segmentStart: start, segmentEnd: end)
        XCTAssertEqual(effort, 30) // elapsedSeconds(40) - elapsedSeconds(10) at the matched indices
    }

    func testMatchSegmentEffortSecondsRejectsBackwardsTraversal() {
        // Runner passes the segment's END first, then its START -- an
        // out-and-back run traversing backwards must not score an effort.
        let start = (lat: 0.0, lng: 0.0)
        let end = (lat: 0.001, lng: 0.0)
        let points = [
            RunRecord.RoutePoint(latitude: 0.001, longitude: 0.0, elapsedSeconds: 0),   // hits "end" first
            RunRecord.RoutePoint(latitude: 0.0005, longitude: 0.0, elapsedSeconds: 10),
            RunRecord.RoutePoint(latitude: 0.0, longitude: 0.0, elapsedSeconds: 20),    // hits "start" after
        ]
        XCTAssertNil(matchSegmentEffortSeconds(runPoints: points, segmentStart: start, segmentEnd: end))
    }

    func testMatchSegmentEffortSecondsReturnsNilWhenSegmentNeverEntered() {
        let start = (lat: 10.0, lng: 10.0)
        let end = (lat: 10.001, lng: 10.0)
        let points = [
            RunRecord.RoutePoint(latitude: 0.0, longitude: 0.0, elapsedSeconds: 0),
            RunRecord.RoutePoint(latitude: 0.001, longitude: 0.001, elapsedSeconds: 30),
        ]
        XCTAssertNil(matchSegmentEffortSeconds(runPoints: points, segmentStart: start, segmentEnd: end))
    }
}
