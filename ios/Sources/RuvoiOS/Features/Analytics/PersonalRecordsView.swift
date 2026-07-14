import SwiftUI
import FirebaseFirestore
import FirebaseAuth

struct PersonalRecordsView: View {
    @StateObject private var vm = PersonalRecordsViewModel()

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 20) {
                    // Header
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Personal Records")
                                .font(RuvoTheme.Typography.displayMedium)
                                .foregroundColor(.white)
                            Text("Your all-time bests")
                                .font(RuvoTheme.Typography.bodySmall)
                                .foregroundColor(RuvoTheme.Colors.textSecondary)
                        }
                        Spacer()
                        Text("🏆")
                            .font(.system(size: 40))
                    }

                    // Distance PRs
                    distancePRSection

                    // Time PRs
                    timePRSection

                    // Other records
                    otherRecordsSection
                }
                .padding()
            }
        }
        .task { await vm.load() }
    }

    // MARK: Distance PRs (fastest times)
    private var distancePRSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Race Distances")
                .font(RuvoTheme.Typography.headingMedium)
                .foregroundColor(.white)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(vm.distancePRs) { pr in
                    PRCard(pr: pr)
                }
            }
        }
    }

    // MARK: Time PRs (longest runs)
    private var timePRSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Distance Records")
                .font(RuvoTheme.Typography.headingMedium)
                .foregroundColor(.white)
            ForEach(vm.distanceRecords) { record in
                PRRowCard(record: record)
            }
        }
    }

    // MARK: Other
    private var otherRecordsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Other Bests")
                .font(RuvoTheme.Typography.headingMedium)
                .foregroundColor(.white)
            ForEach(vm.otherRecords) { record in
                PRRowCard(record: record)
            }
        }
    }
}

// MARK: – Sub-components

private struct PRCard: View {
    let pr: DistancePR

    var body: some View {
        RuvoCard(isHighlighted: pr.isNew) {
            VStack(spacing: 8) {
                Text(pr.distance)
                    .font(RuvoTheme.Typography.headingLarge)
                    .foregroundColor(RuvoTheme.Colors.primary)
                if let time = pr.bestTime {
                    Text(time)
                        .font(RuvoTheme.Typography.displaySmall)
                        .foregroundColor(.white)
                    Text(pr.dateAchieved ?? "")
                        .font(RuvoTheme.Typography.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                } else {
                    Text("Not yet run")
                        .font(RuvoTheme.Typography.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                }
                if pr.isNew {
                    RuvoChip(label: "NEW PR!", color: RuvoTheme.Colors.primary, isActive: true)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity)
        }
    }
}

private struct PRRowCard: View {
    let record: RecordItem

    var body: some View {
        RuvoCard {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(record.label)
                        .font(RuvoTheme.Typography.labelLarge)
                        .foregroundColor(.white)
                    Text(record.date)
                        .font(RuvoTheme.Typography.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                }
                Spacer()
                Text(record.value)
                    .font(RuvoTheme.Typography.headingMedium)
                    .foregroundColor(RuvoTheme.Colors.primary)
            }
            .padding(14)
        }
    }
}

// MARK: – Models

struct DistancePR: Identifiable {
    let id: String
    let distance: String       // "5K", "10K", "Half", "Full"
    let bestTime: String?      // "23:45"
    let dateAchieved: String?
    let isNew: Bool
}

struct RecordItem: Identifiable {
    let id: String
    let label: String
    let value: String
    let date: String
}

// MARK: – ViewModel

@MainActor
final class PersonalRecordsViewModel: ObservableObject {
    @Published var distancePRs: [DistancePR] = []
    @Published var distanceRecords: [RecordItem] = []
    @Published var otherRecords: [RecordItem] = []

    private let db = Firestore.firestore()

    func load() async {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        do {
            let snap = try await db.collection("users").document(uid).collection("runs")
                .order(by: "startedAt", descending: false)
                .getDocuments()
            let runs = snap.documents.compactMap { try? $0.data(as: RunRecord.self) }
            computePRs(from: runs)
        } catch {}
    }

    private func computePRs(from runs: [RunRecord]) {
        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .medium

        // Distance bracket PRs — fastest time for each standard distance
        let brackets: [(label: String, minKm: Double, maxKm: Double)] = [
            ("5K",   4.9, 5.5),
            ("10K",  9.8, 11.0),
            ("Half", 20.5, 22.0),
            ("Full", 41.0, 43.5),
        ]
        distancePRs = brackets.map { b in
            let candidates = runs.filter { $0.distanceKm >= b.minKm && $0.distanceKm <= b.maxKm }
            let best = candidates.min(by: { $0.durationSeconds < $1.durationSeconds })
            return DistancePR(
                id: b.label,
                distance: b.label,
                bestTime: best.map { formatDuration($0.durationSeconds) },
                dateAchieved: best.map { dateFormatter.string(from: $0.startedAt) },
                isNew: false
            )
        }

        // Longest run
        if let longest = runs.max(by: { $0.distanceKm < $1.distanceKm }) {
            distanceRecords = [
                RecordItem(id: "longest", label: "Longest Run", value: String(format: "%.2f km", longest.distanceKm), date: dateFormatter.string(from: longest.startedAt)),
            ]
        }

        // Fastest pace
        let fastRuns = runs.filter { $0.distanceKm >= 1.0 && $0.averagePaceMinPerKm > 0 }
        if let fastest = fastRuns.min(by: { $0.averagePaceMinPerKm < $1.averagePaceMinPerKm }) {
            otherRecords = [
                RecordItem(id: "pace", label: "Best Pace", value: formatPace(fastest.averagePaceMinPerKm) + "/km", date: dateFormatter.string(from: fastest.startedAt)),
                RecordItem(id: "cal", label: "Most Calories", value: "\(runs.map(\.calories).max() ?? 0) kcal", date: ""),
            ]
        }
    }

    private func formatDuration(_ sec: Int) -> String {
        let h = sec / 3600; let m = (sec % 3600) / 60; let s = sec % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
    }

    private func formatPace(_ pace: Double) -> String {
        guard pace > 0, pace < 30 else { return "--:--" }
        return String(format: "%d:%02d", Int(pace), Int((pace - Double(Int(pace))) * 60))
    }
}
