import SwiftUI
import MapKit
import CoreLocation
import FirebaseFirestore
import FirebaseAuth

// Public entry point — can be initialized with a RunRecord directly
// (after a live run) or with just a runId (from history/navigation).
struct RunSummaryView: View {
    @Environment(\.dismiss) private var dismiss
    private let source: Source

    private enum Source {
        case record(RunRecord)
        case runId(String)
    }

    @State private var loadedRun: RunRecord? = nil
    @State private var isLoading = false

    init(run: RunRecord) { source = .record(run) }
    init(runId: String)  { source = .runId(runId) }

    var body: some View {
        Group {
            if let run = resolvedRun {
                RunSummaryContent(run: run, onDismiss: { dismiss() })
            } else if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(RuvoTheme.Colors.background.ignoresSafeArea())
            }
        }
        .task { await loadIfNeeded() }
    }

    private var resolvedRun: RunRecord? {
        if case .record(let r) = source { return r }
        return loadedRun
    }

    private func loadIfNeeded() async {
        guard case .runId(let id) = source else { return }
        isLoading = true
        defer { isLoading = false }
        guard let uid = Auth.auth().currentUser?.uid else { return }
        do {
            let doc = try await Firestore.firestore()
                .collection("users").document(uid)
                .collection("runs").document(id)
                .getDocument()
            loadedRun = try doc.data(as: RunRecord.self)
        } catch {}
    }
}

// MARK: – Content (private)

private struct RunSummaryContent: View {
    let run: RunRecord
    let onDismiss: () -> Void

    @State private var region: MKCoordinateRegion
    @State private var showShareCard = false

    // Competitor-analysis Tier 2 #6 (Segments) -- same "Create Segment from
    // this route" entry point Android exposes on its own run detail screen
    // (`RunDetailScreen.kt`'s `openCreateSegmentDialog`/`CreateSegmentDialog`).
    // Ephemeral per screen instance, same as Android's own `segmentCreated`
    // flag -- not persisted, so reopening this screen offers the button again.
    @State private var showCreateSegmentAlert = false
    @State private var isCreatingSegment = false
    @State private var segmentCreated = false
    @State private var segmentName = ""

    init(run: RunRecord, onDismiss: @escaping () -> Void) {
        self.run = run
        self.onDismiss = onDismiss
        let coords = run.route.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
        let center = coords.first ?? CLLocationCoordinate2D(latitude: 33.8938, longitude: 35.5018)
        _region = State(initialValue: MKCoordinateRegion(center: center, span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)))
    }

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 24) {
                    headerSection
                    statsGrid
                    if !run.route.isEmpty { routeMapView }
                    if run.route.count > 1 { segmentSection }
                    lapSection
                    actionButtons
                }
                .padding()
                .padding(.bottom, 40)
            }
        }
        .sheet(isPresented: $showShareCard) {
            ShareCardPreviewSheet(run: run)
        }
        .alert("Create Segment", isPresented: $showCreateSegmentAlert) {
            TextField("Segment name", text: $segmentName)
            Button("Cancel", role: .cancel) {}
            Button("Create") {
                let name = segmentName
                Task {
                    isCreatingSegment = true
                    await SegmentCreationService.createSegment(from: run, name: name)
                    isCreatingSegment = false
                    segmentCreated = true
                    segmentName = ""
                }
            }
        } message: {
            Text("This run's exact route becomes a leaderboard people you follow can compete on. Your own time on it is recorded automatically.")
        }
    }

    // MARK: Segment creation
    private var segmentSection: some View {
        RuvoCard {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("SEGMENT")
                        .font(RuvoTheme.Typography.labelSmall)
                        .tracking(RuvoTheme.Typography.Tracking.labelSmall)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                    Text(segmentCreated ? "This route is now a leaderboard" : "Turn this route into a leaderboard")
                        .font(RuvoTheme.Typography.bodyMedium)
                        .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                }
                Spacer()
                if segmentCreated {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark")
                            .foregroundColor(RuvoTheme.Colors.primary)
                        Text("Segment created")
                            .font(RuvoTheme.Typography.labelLarge)
                            .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                            .foregroundColor(RuvoTheme.Colors.primary)
                    }
                } else {
                    RuvoButton(
                        title: "Create Segment",
                        style: .secondary,
                        icon: "flag.fill",
                        isLoading: isCreatingSegment,
                        isFullWidth: false
                    ) {
                        showCreateSegmentAlert = true
                    }
                }
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }

    // MARK: Header
    private var headerSection: some View {
        VStack(spacing: 8) {
            Text("Run Complete")
                .font(RuvoTheme.Typography.headingLarge)
                .foregroundColor(RuvoTheme.Colors.primary)
            Text(run.startedAt.formatted(date: .abbreviated, time: .shortened))
                .font(RuvoTheme.Typography.bodySmall)
                .foregroundColor(RuvoTheme.Colors.textSecondary)
            HStack(spacing: 8) {
                Text("⚡")
                Text("+\(run.xpEarned) XP")
                    .font(RuvoTheme.Typography.labelLarge)
                    .foregroundColor(RuvoTheme.Colors.primary)
                Text("🪙")
                Text("+\(run.coinsEarned) coins")
                    .font(RuvoTheme.Typography.labelLarge)
                    .foregroundColor(Color(hex: "#EAB308"))
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(RuvoTheme.Colors.primary.opacity(0.1))
            .cornerRadius(RuvoTheme.Radius.pill)
        }
    }

    // MARK: Stats grid
    private var statsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            SummaryStat(label: "DISTANCE",  value: String(format: "%.2f", run.distanceKm), unit: "km",   color: RuvoTheme.Colors.primary)
            SummaryStat(label: "DURATION",  value: run.durationSeconds.summaryDuration,     unit: "",     color: .white)
            SummaryStat(label: "AVG PACE",  value: run.averagePaceMinPerKm.summaryPace,     unit: "/km",  color: Color(hex: "#A855F7"))
            SummaryStat(label: "CALORIES",  value: "\(run.calories)",                       unit: "kcal", color: Color(hex: "#F97316"))
            if run.elevationGainM > 0 {
                SummaryStat(label: "ELEVATION", value: String(format: "%.0f", run.elevationGainM), unit: "m", color: Color(hex: "#2DD4BF"))
            }
            if !run.laps.isEmpty {
                SummaryStat(label: "LAPS",  value: "\(run.laps.count)", unit: "", color: Color(hex: "#EAB308"))
            }
        }
    }

    // MARK: Route map
    private var routeMapView: some View {
        Map(coordinateRegion: .constant(region))
            .disabled(true)
            .frame(height: 200)
            .cornerRadius(RuvoTheme.Radius.lg)
            .overlay(
                RoundedRectangle(cornerRadius: RuvoTheme.Radius.lg)
                    .stroke(RuvoTheme.Colors.border, lineWidth: 1)
            )
    }

    // MARK: Lap breakdown
    @ViewBuilder
    private var lapSection: some View {
        if !run.laps.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Lap Breakdown")
                    .font(RuvoTheme.Typography.headingMedium)
                    .foregroundColor(.white)
                ForEach(run.laps) { lap in
                    LapRow(lap: lap)
                }
            }
        }
    }

    // MARK: Actions
    private var actionButtons: some View {
        VStack(spacing: 12) {
            RuvoButton(title: "Share Art Card", style: .secondary) { showShareCard = true }
            RuvoButton(title: "Done", style: .primary, action: onDismiss)
        }
    }
}

// MARK: – Sub-components

private struct SummaryStat: View {
    let label: String; let value: String; let unit: String; let color: Color

    var body: some View {
        RuvoCard {
            VStack(spacing: 4) {
                Text(label)
                    .font(RuvoTheme.Typography.labelSmall)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
                HStack(alignment: .lastTextBaseline, spacing: 2) {
                    Text(value).font(RuvoTheme.Typography.displayMedium).foregroundColor(color)
                    if !unit.isEmpty {
                        Text(unit).font(RuvoTheme.Typography.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity)
        }
    }
}

private struct LapRow: View {
    let lap: LapData

    var body: some View {
        HStack {
            Text("Lap \(lap.number)").font(RuvoTheme.Typography.labelLarge).foregroundColor(.white).frame(width: 60, alignment: .leading)
            Text(String(format: "%.2f km", lap.distanceKm)).font(RuvoTheme.Typography.bodyMedium).foregroundColor(RuvoTheme.Colors.textSecondary)
            Spacer()
            Text(lap.paceMinPerKm.summaryPace + "/km").font(RuvoTheme.Typography.labelLarge).foregroundColor(RuvoTheme.Colors.primary)
            Text(lap.durationSeconds.summaryDuration).font(RuvoTheme.Typography.bodySmall).foregroundColor(RuvoTheme.Colors.textTertiary).frame(width: 55, alignment: .trailing)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
        .background(RuvoTheme.Colors.surfaceElevated)
        .cornerRadius(12)
    }
}

extension LapData: Identifiable {
    public var id: Int { number }
}

private extension Int {
    var summaryDuration: String {
        let h = self / 3600; let m = (self % 3600) / 60; let s = self % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
    }
}

private extension Double {
    var summaryPace: String {
        guard self > 0, self < 30 else { return "--:--" }
        let min = Int(self); let sec = Int((self - Double(min)) * 60)
        return String(format: "%d:%02d", min, sec)
    }
}
