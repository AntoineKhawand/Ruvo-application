import SwiftUI
import FirebaseFirestore
import FirebaseAuth

// Competitor-analysis Tier 2 #6 (Segments) -- Strava's signature feature,
// ported from Android's real implementation (`features/segments/Segment.kt`,
// `SegmentsViewModel.kt`, `SegmentsScreen.kt`). A segment is an immutable
// snapshot of the run that created it (firestore.rules: "allow update,
// delete: if false") -- its creator's own finished route becomes a
// leaderboard other runners can post a time against.
//
// NOTE on what this file does NOT reproduce: Android also runs
// `matchSegmentEfforts()` (`RuvoApp.kt`) after every *subsequent* run save --
// a best-effort, client-side scan of every followed-bounded segment that
// haversine-matches the new run's own GPS route against each segment's
// start/end points and records an effort using real per-point elapsed time
// (`RoutePoint.elapsedSeconds`, `RunTrackingService.appendRoutePoint` on
// Android). iOS's own `RunRecord.RoutePoint` (`Core/Models/RuvoUser.swift`)
// carries only latitude/longitude -- no per-point timestamp -- so there is
// no real elapsed-time-between-two-points to compute on this platform yet.
// Reproducing that matching here would mean either fabricating a fake
// "estimated" time (exactly the kind of invented parallel behavior to
// avoid) or first threading real per-point timing through
// `LocationManager`/`RunTrackingViewModel` -- a change to the live,
// shipped GPS-recording pipeline that can't be verified without a
// compiler or device in this environment. So this feature reproduces the
// real, verifiable parts of Android's pipeline: creating a segment from
// your own finished run (the creator's own time IS the run's own real
// duration, no estimation involved) and browsing/reading the real
// leaderboard data Android's own client reads. See the iOS engineer's
// task report for the full flag.

// MARK: - Model

/// Mirrors Android's `RuvoSegment` (`Segment.kt`) field for field, and the
/// real Firestore shape both `SegmentsViewModel.loadSegments` and
/// `RunDetailScreen.createSegment` share: a top-level "segments" collection,
/// not per-user, since a segment is inherently shared data.
struct RuvoSegment: Identifiable {
    let id: String
    var name: String
    var creatorUid: String
    var creatorName: String
    var distanceKm: Double
    var startLat: Double
    var startLng: Double
    var endLat: Double
    var endLng: Double
    var polyline: [(lat: Double, lng: Double)]
    var sourceRunId: String
}

/// Mirrors Android's `SegmentEffort` (`Segment.kt`). Lives in
/// `segments/{segmentId}/efforts/{uid}` -- the effort doc's own id IS the
/// runner's uid (firestore.rules: "so 'only I can write my own effort' is a
/// direct id check"), so each runner holds exactly one (best) time per
/// segment.
struct SegmentEffort: Identifiable {
    var id: String { uid }
    var uid: String
    var userName: String
    var bestSeconds: Int
    var runId: String
}

private extension Dictionary where Key == String, Value == Any {
    func toSegment(id: String) -> RuvoSegment? {
        guard let name = self["name"] as? String else { return nil }
        let polylineRaw = self["polyline"] as? [[String: Any]] ?? []
        let polyline: [(lat: Double, lng: Double)] = polylineRaw.compactMap { p in
            guard let lat = (p["lat"] as? NSNumber)?.doubleValue,
                  let lng = (p["lng"] as? NSNumber)?.doubleValue else { return nil }
            return (lat, lng)
        }
        return RuvoSegment(
            id: id,
            name: name,
            creatorUid: self["creatorUid"] as? String ?? "",
            creatorName: self["creatorName"] as? String ?? "Runner",
            distanceKm: (self["distanceKm"] as? NSNumber)?.doubleValue ?? 0,
            startLat: (self["startLat"] as? NSNumber)?.doubleValue ?? 0,
            startLng: (self["startLng"] as? NSNumber)?.doubleValue ?? 0,
            endLat: (self["endLat"] as? NSNumber)?.doubleValue ?? 0,
            endLng: (self["endLng"] as? NSNumber)?.doubleValue ?? 0,
            polyline: polyline,
            sourceRunId: self["sourceRunId"] as? String ?? ""
        )
    }

    func toEffort() -> SegmentEffort? {
        guard let uid = self["uid"] as? String else { return nil }
        return SegmentEffort(
            uid: uid,
            userName: self["userName"] as? String ?? "Runner",
            bestSeconds: (self["bestSeconds"] as? NSNumber)?.intValue ?? 0,
            runId: self["runId"] as? String ?? ""
        )
    }
}

// MARK: - ViewModel

@MainActor
final class SegmentsViewModel: ObservableObject {
    struct ListItem: Identifiable {
        var id: String { segment.id }
        var segment: RuvoSegment
        var topEfforts: [SegmentEffort]
    }

    @Published private(set) var items: [ListItem] = []
    @Published private(set) var isLoading = false

    private let db = Firestore.firestore()
    private var didLoad = false

    func loadSegments() async {
        guard !didLoad else { return }
        didLoad = true
        await reload()
    }

    /// Same Following+self bounded scope as Android's own
    /// `SegmentsViewModel.loadSegments` (and every other Firestore fan-out in
    /// this app -- Search, Leaderboard's "Friends" scope): no server-side geo
    /// index backs a true "segments anywhere" browse, so this reads
    /// `whereIn("creatorUid", ...)` against the people you follow plus
    /// yourself, capped at Firestore's own 30-value `in` limit -- a real
    /// query, not a client-side fan-out read.
    func reload() async {
        isLoading = true
        defer { isLoading = false }
        guard let uid = Auth.auth().currentUser?.uid else { return }
        do {
            let meDoc = try await db.collection("users").document(uid).getDocument()
            let following = meDoc.data()?["following"] as? [String] ?? []
            let creatorUids = Array(Set(following + [uid]).prefix(30))
            guard !creatorUids.isEmpty else {
                items = []
                return
            }

            let snap = try await db.collection("segments")
                .whereField("creatorUid", in: creatorUids)
                .getDocuments()

            var built: [ListItem] = []
            for doc in snap.documents {
                guard let segment = doc.data().toSegment(id: doc.documentID) else { continue }
                let effortsSnap = try? await db.collection("segments").document(doc.documentID)
                    .collection("efforts")
                    .order(by: "bestSeconds")
                    .limit(to: 3)
                    .getDocuments()
                let efforts = (effortsSnap?.documents ?? []).compactMap { $0.data().toEffort() }
                built.append(ListItem(segment: segment, topEfforts: efforts))
            }
            items = built.sorted { $0.topEfforts.count > $1.topEfforts.count }
        } catch {
            print("[Segments] Load error: \(error)")
            items = []
        }
    }
}

// MARK: - Creation

/// Real port of Android's `RunDetailViewModel.createSegment`
/// (`RunDetailScreen.kt`): the whole finished run becomes the segment (no
/// manual start/end picker), its actual route the segment's polyline, its
/// own duration recorded automatically as the creator's first effort --
/// called from `RunSummaryView`'s "Create Segment" action, the same entry
/// point Android exposes this from (a run's own detail screen), not a
/// separate creation flow.
enum SegmentCreationService {
    static func createSegment(from run: RunRecord, name: String) async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              run.route.count >= 2,
              let start = run.route.first,
              let end = run.route.last,
              let uid = Auth.auth().currentUser?.uid else { return }
        let db = Firestore.firestore()
        do {
            let meDoc = try await db.collection("users").document(uid).getDocument()
            let myName = (meDoc.data()?["name"] as? String) ?? (meDoc.data()?["displayName"] as? String) ?? "Runner"
            let polyline = run.route.map { ["lat": $0.latitude, "lng": $0.longitude] }
            let segmentRef = db.collection("segments").document()
            try await segmentRef.setData([
                "name": trimmed,
                "creatorUid": uid,
                "creatorName": myName,
                "distanceKm": run.distanceKm,
                "startLat": start.latitude,
                "startLng": start.longitude,
                "endLat": end.latitude,
                "endLng": end.longitude,
                "polyline": polyline,
                "sourceRunId": run.id ?? "",
            ])
            // Creator's own first effort -- the run *is* the segment here,
            // so its real total duration is used directly, same as Android
            // (`state.durationSeconds`), no per-point matching involved.
            try await segmentRef.collection("efforts").document(uid).setData([
                "uid": uid,
                "userName": myName,
                "bestSeconds": run.durationSeconds,
                "runId": run.id ?? "",
            ])
        } catch {
            print("[Segments] createSegment error: \(error)")
        }
    }
}

// MARK: - View

/// Embedded as a Community tab (`CommunityFeedView.swift`), matching how
/// Android surfaces this exact feature -- `CommunityScreen.kt`'s own tab
/// list ends in "Routes, Segments", both reading the same underlying route
/// data as sibling tabs rather than a separate top-level destination.
struct SegmentsTab: View {
    @StateObject private var viewModel = SegmentsViewModel()

    var body: some View {
        ScrollView {
            LazyVStack(spacing: RuvoTheme.Spacing.sm) {
                if viewModel.items.isEmpty && !viewModel.isLoading {
                    emptyState
                } else {
                    ForEach(viewModel.items) { item in
                        SegmentCard(item: item)
                    }
                }
                if viewModel.isLoading {
                    ProgressView().tint(RuvoTheme.Colors.primary).padding()
                }
            }
            .padding(RuvoTheme.Spacing.lg)
            .padding(.bottom, RuvoTheme.Spacing.xxl)
        }
        .refreshable { await viewModel.reload() }
        .task { await viewModel.loadSegments() }
    }

    private var emptyState: some View {
        VStack(spacing: RuvoTheme.Spacing.sm) {
            Text("🏁").font(RuvoTheme.Typography.displayLarge)
            Text("No segments yet. Create one from a finished run's summary to start a leaderboard.")
                .font(RuvoTheme.Typography.bodyMedium)
                .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                .foregroundColor(RuvoTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, RuvoTheme.Spacing.xxl)
    }
}

private struct SegmentCard: View {
    let item: SegmentsViewModel.ListItem

    var body: some View {
        RuvoCard {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
                SegmentSketch(points: item.segment.polyline)
                    .frame(height: 90)

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.segment.name)
                        .font(RuvoTheme.Typography.headingSmall)
                        .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                        .foregroundColor(RuvoTheme.Colors.textPrimary)
                    Text(String(format: "%.2f km", item.segment.distanceKm))
                        .font(RuvoTheme.Typography.bodySmall)
                        .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                }

                if item.topEfforts.isEmpty {
                    Text("No efforts recorded yet — be the first.")
                        .font(RuvoTheme.Typography.bodySmall)
                        .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                } else {
                    VStack(spacing: 6) {
                        ForEach(Array(item.topEfforts.enumerated()), id: \.element.id) { idx, effort in
                            HStack {
                                HStack(spacing: RuvoTheme.Spacing.xs) {
                                    Text("#\(idx + 1)")
                                        .font(RuvoTheme.Typography.labelMedium)
                                        .tracking(RuvoTheme.Typography.Tracking.labelMedium)
                                        .foregroundColor(RuvoTheme.Colors.primary)
                                    Text(effort.userName)
                                        .font(RuvoTheme.Typography.bodyMedium)
                                        .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                                        .foregroundColor(RuvoTheme.Colors.textPrimary)
                                }
                                Spacer()
                                Text(effort.bestSeconds.segmentEffortTime)
                                    .font(RuvoTheme.Typography.bodyMedium)
                                    .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                                    .foregroundColor(RuvoTheme.Colors.textSecondary)
                            }
                        }
                    }
                }
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}

/// Same lightweight `Canvas`-sketch approach Android's own `SegmentSketch`
/// (`SegmentsScreen.kt`) uses for these list cards -- deliberately not a
/// real `MapKit` `Map` instance per row (that's reserved for the single
/// focused route in `RunTrackingView`/`RunSummaryView`); a normalized line
/// drawing is enough for a scrolling list of many cards and avoids
/// instantiating many live map views at once.
private struct SegmentSketch: View {
    let points: [(lat: Double, lng: Double)]

    var body: some View {
        Canvas { context, size in
            guard points.count > 1 else { return }
            let lats = points.map(\.lat)
            let lngs = points.map(\.lng)
            guard let minLat = lats.min(), let maxLat = lats.max(),
                  let minLng = lngs.min(), let maxLng = lngs.max() else { return }
            let latSpan = max(maxLat - minLat, 0.00001)
            let lngSpan = max(maxLng - minLng, 0.00001)
            let span = max(latSpan, lngSpan)
            let offsetX = (span - lngSpan) / 2
            let offsetY = (span - latSpan) / 2
            let inset: CGFloat = 12
            let w = size.width - inset * 2
            let h = size.height - inset * 2

            var path = Path()
            for (i, p) in points.enumerated() {
                let nx = inset + CGFloat((p.lng - minLng + offsetX) / span) * w
                let ny = inset + (1 - CGFloat((p.lat - minLat + offsetY) / span)) * h
                if i == 0 {
                    path.move(to: CGPoint(x: nx, y: ny))
                } else {
                    path.addLine(to: CGPoint(x: nx, y: ny))
                }
            }
            context.stroke(path, with: .color(RuvoTheme.Colors.purple), lineWidth: 3)
        }
        .background(RuvoTheme.Colors.surfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: RuvoTheme.Radius.md))
    }
}

private extension Int {
    var segmentEffortTime: String {
        let m = self / 60
        let s = self % 60
        return String(format: "%d:%02d", m, s)
    }
}
