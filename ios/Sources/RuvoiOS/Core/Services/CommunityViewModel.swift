import Foundation
import FirebaseFirestore
import FirebaseAuth

@MainActor
final class CommunityViewModel: ObservableObject {
    @Published var feedItems: [FeedItem] = []
    @Published var clubs: [Club] = []
    @Published var challenges: [Challenge] = []
    @Published var leaderboard: [LeaderboardEntry] = []
    @Published var isLoadingMore = false

    private let db = Firestore.firestore()
    private var lastFeedDocument: DocumentSnapshot?

    func loadFeed() async {
        do {
            let snap = try await db.collectionGroup("runs")
                .order(by: "startedAt", descending: true)
                .limit(to: 20)
                .getDocuments()
            lastFeedDocument = snap.documents.last
            feedItems = snap.documents.compactMap { doc -> FeedItem? in
                let data = doc.data()
                return FeedItem(
                    id: doc.documentID,
                    type: "run",
                    userId: data["userId"] as? String ?? "",
                    userDisplayName: data["userDisplayName"] as? String ?? "Runner",
                    userAvatarUrl: data["userAvatarUrl"] as? String,
                    distanceKm: data["distanceKm"] as? Double,
                    paceMinPerKm: data["averagePaceMinPerKm"] as? Double,
                    durationSeconds: data["durationSeconds"] as? Int,
                    likesCount: data["likesCount"] as? Int ?? 0,
                    commentsCount: data["commentsCount"] as? Int ?? 0,
                    isLikedByMe: false,
                    createdAt: (data["startedAt"] as? Timestamp)?.dateValue() ?? Date()
                )
            }
        } catch {
            print("[Community] Feed load error: \(error)")
        }
    }

    func toggleLike(_ item: FeedItem) {
        guard let idx = feedItems.firstIndex(where: { $0.id == item.id }),
              let uid = Auth.auth().currentUser?.uid else { return }

        let wasLiked = feedItems[idx].isLikedByMe
        feedItems[idx].isLikedByMe = !wasLiked
        feedItems[idx].likesCount += wasLiked ? -1 : 1

        Task {
            let ref = db.collection("runs").document(item.id).collection("likes").document(uid)
            if wasLiked {
                try? await ref.delete()
            } else {
                try? await ref.setData(["likedAt": Timestamp(date: Date())])
            }
        }
    }
}

final class AnalyticsViewModel: ObservableObject {
    @Published var selectedPeriod: AnalyticsPeriod = .month
    @Published var summary = AnalyticsSummary(totalDistanceKm: 0, totalRuns: 0, averagePaceMinPerKm: 0, totalDurationHours: 0, totalElevationM: 0)
    @Published var weeklyDistances: [WeeklyDistance] = []
    @Published var paceTrend: [PacePoint] = []
    @Published var heartRateZones: [HeartRateZone] = []
    @Published var vo2max: Double = 0
    @Published var recentRuns: [RunRecord] = []

    private let db = Firestore.firestore()

    func loadData() async {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        do {
            let snap = try await db.collection("users").document(uid).collection("runs")
                .order(by: "startedAt", descending: true)
                .limit(to: 50)
                .getDocuments()
            let runs = snap.documents.compactMap { try? $0.data(as: RunRecord.self) }
            recentRuns = Array(runs.prefix(10))

            let totalDist = runs.reduce(0) { $0 + $1.distanceKm }
            let totalSec = runs.reduce(0) { $0 + $1.durationSeconds }
            let avgPace = totalDist > 0 ? Double(totalSec) / 60 / totalDist : 0

            summary = AnalyticsSummary(
                totalDistanceKm: totalDist,
                totalRuns: runs.count,
                averagePaceMinPerKm: avgPace,
                totalDurationHours: Double(totalSec) / 3600,
                totalElevationM: 0
            )

            // Build weekly chart data from last 8 weeks
            weeklyDistances = buildWeeklyData(runs: runs)
            paceTrend = buildPaceTrend(runs: runs)
        } catch {
            print("[Analytics] Load error: \(error)")
        }
    }

    private func buildWeeklyData(runs: [RunRecord]) -> [WeeklyDistance] {
        let calendar = Calendar.current
        var weeks: [String: Double] = [:]
        for run in runs {
            let weekOfYear = calendar.component(.weekOfYear, from: run.startedAt)
            let key = "W\(weekOfYear)"
            weeks[key, default: 0] += run.distanceKm
        }
        return weeks.sorted(by: { $0.key < $1.key }).suffix(8).map {
            WeeklyDistance(weekLabel: $0.key, distanceKm: $0.value)
        }
    }

    private func buildPaceTrend(runs: [RunRecord]) -> [PacePoint] {
        runs.suffix(10).map { PacePoint(date: $0.startedAt, paceMinPerKm: $0.averagePaceMinPerKm) }
    }
}
