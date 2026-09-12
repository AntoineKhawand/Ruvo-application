import SwiftUI
import Foundation
import FirebaseAuth
import FirebaseFirestore

// MARK: – Scope & period

/// Mirrors Android's `LeaderboardScopeTab` (`LeaderboardViewModel.kt`) 1:1 --
/// same three scopes, same ordering.
enum LeaderboardScope: Int, CaseIterable, Identifiable {
    case friends, country, global
    var id: Int { rawValue }

    var label: String {
        switch self {
        case .friends: return "Friends"
        case .country: return "Country"
        case .global:  return "Global"
        }
    }
}

/// Mirrors Android's `LeaderboardTimePeriod`. Period is **not** a computed
/// rolling-window query or a Cloud Function -- it's just which denormalized
/// field on `users/{uid}` to sort by (see `sortField` below), exactly what
/// Android's `load()` does (`sortField = if (period == Weekly) "weeklyDistance"
/// else "totalKm"`).
enum LeaderboardPeriod: Int, CaseIterable, Identifiable {
    case weekly, allTime
    var id: Int { rawValue }

    var label: String {
        switch self {
        case .weekly:  return "Weekly"
        case .allTime: return "All-Time"
        }
    }

    var sortField: String {
        switch self {
        case .weekly:  return "weeklyDistance"
        case .allTime: return "totalKm"
        }
    }
}

/// Named `RankedRunnerEntry` (not `LeaderboardEntry`) because
/// `CommunityFeedView.swift` already declares a top-level `struct
/// LeaderboardEntry`/`struct LeaderboardRow` for its own, simpler community-
/// feed leaderboard widget (keyed on `xp`/`weeklyDistanceKm`, no scope or
/// period selectors) -- same reason `AchievementsView.swift` named its model
/// `AchievementDefinition` rather than reusing `GamificationView.swift`'s
/// `Achievement`. This is a deliberately distinct type, not a reuse of that
/// widget's model.
struct RankedRunnerEntry: Identifiable {
    let uid: String
    let displayName: String
    let distanceKm: Double
    let countryFlag: String
    let isCurrentUser: Bool
    var rank: Int = 0
    var id: String { uid }
}

// MARK: – ViewModel

/// Real Firestore query Android's `LeaderboardViewModel` runs: an
/// `orderBy(sortField, DESCENDING).limit(100)` scan of the top-level
/// `users` collection -- not a leaderboard-specific collection, not a
/// Cloud Function, not a computed weekly-window aggregate. "Weekly" just
/// means sorting by whatever is already denormalized into
/// `users/{uid}.weeklyDistance` (a field nothing in this iOS codebase
/// currently writes -- same gap Android's own code comments flag for
/// `totalKm`/`weeklyDistance` elsewhere, e.g. `CommunityViewModel.kt`).
/// This reads the exact same fields/shape Android does rather than
/// inventing a parallel one, so both platforms will show identical rankings
/// once/if those fields are ever populated.
@MainActor
final class LeaderboardViewModel: ObservableObject {
    @Published private(set) var entries: [RankedRunnerEntry] = []
    @Published private(set) var scope: LeaderboardScope = .friends
    @Published private(set) var period: LeaderboardPeriod = .weekly
    @Published private(set) var isLoading = false
    @Published private(set) var dateRangeLabel = ""

    private let db: Firestore
    /// Bumped on every `load()` so a stale async response (from a scope/period
    /// that's since changed) can't clobber a newer one -- Android's
    /// `viewModelScope.launch` doesn't guard against this race at all (a slow
    /// first load can still overwrite a faster second one), but that's a
    /// concurrency footgun worth closing here rather than porting verbatim.
    private var loadGeneration = 0

    init(db: Firestore = Firestore.firestore()) {
        self.db = db
    }

    func start() {
        guard entries.isEmpty, !isLoading else { return }
        load()
    }

    func setScope(_ newScope: LeaderboardScope) {
        guard newScope != scope else { return }
        scope = newScope
        load()
    }

    func setPeriod(_ newPeriod: LeaderboardPeriod) {
        guard newPeriod != period else { return }
        period = newPeriod
        load()
    }

    private func load() {
        guard let currentUid = Auth.auth().currentUser?.uid else {
            isLoading = false
            return
        }
        isLoading = true
        loadGeneration += 1
        let generation = loadGeneration
        let sortField = period.sortField
        let requestedScope = scope
        let requestedPeriod = period

        Task {
            do {
                let snapshot = try await db.collection("users")
                    .order(by: sortField, descending: true)
                    .limit(to: 100)
                    .getDocuments()

                var resolved: [RankedRunnerEntry] = snapshot.documents.map { doc in
                    let data = doc.data()
                    // Real field is nested location.country (ProfileViewModel/
                    // EditProfileSheet's field), same as Android's own fix --
                    // NOT a top-level "country" that nothing writes.
                    let location = data["location"] as? [String: Any]
                    return RankedRunnerEntry(
                        uid: doc.documentID,
                        displayName: (data["name"] as? String) ?? (data["displayName"] as? String) ?? "Runner",
                        distanceKm: Self.doubleValue(data[sortField]),
                        countryFlag: Self.countryFlag(for: (location?["country"] as? String) ?? ""),
                        isCurrentUser: doc.documentID == currentUid
                    )
                }

                // Friends scope: filters against the array field `following`
                // on `users/{uid}` -- the shape every Android follow/unfollow
                // write path uses (arrayUnion/arrayRemove). NOTE: this app's
                // own ProfileViewModel.toggleFollow instead writes follows to
                // a *subcollection* (`users/{uid}/following/{targetUid}`) --
                // a pre-existing cross-platform data-shape split, not
                // something introduced here. Porting Android's real query
                // faithfully means this Friends scope reflects whichever
                // write path actually populates that array field; reconciling
                // the split (picking one canonical shape and migrating every
                // read/write site on both platforms) is out of scope for a
                // Leaderboard-only pass. "Country" scope has no additional
                // server-side filter in Android's own `load()` either --
                // only Friends branches -- so Country here behaves like
                // Global too, matching Android's real (likely unintentional)
                // behavior rather than inventing filtering Android doesn't have.
                if requestedScope == .friends {
                    let meDoc = try await self.db.collection("users").document(currentUid).getDocument()
                    let following = meDoc.data()?["following"] as? [String] ?? []
                    resolved = resolved.filter { $0.uid == currentUid || following.contains($0.uid) }
                }

                let ranked = resolved
                    .sorted { $0.distanceKm > $1.distanceKm }
                    .enumerated()
                    .map { index, entry -> RankedRunnerEntry in
                        var e = entry
                        e.rank = index + 1
                        return e
                    }

                guard generation == self.loadGeneration else { return }
                self.entries = ranked
                self.isLoading = false
                self.dateRangeLabel = requestedPeriod == .weekly ? Self.weekRangeLabel() : "All Time"
            } catch {
                guard generation == self.loadGeneration else { return }
                self.entries = []
                self.isLoading = false
            }
        }
    }

    private static func doubleValue(_ raw: Any?) -> Double {
        if let d = raw as? Double { return d }
        if let n = raw as? NSNumber { return n.doubleValue }
        if let i = raw as? Int { return Double(i) }
        return 0
    }

    /// Verbatim port of Android's `weekRange()`: Monday-start week, "d MMM"
    /// endpoints.
    private static func weekRangeLabel() -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2 // Monday
        let now = Date()
        let weekday = calendar.component(.weekday, from: calendar.startOfDay(for: now)) // 1=Sun...7=Sat
        let daysSinceMonday = (weekday + 5) % 7
        guard let monday = calendar.date(byAdding: .day, value: -daysSinceMonday, to: calendar.startOfDay(for: now)),
              let sunday = calendar.date(byAdding: .day, value: 6, to: monday) else {
            return ""
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM"
        return "\(formatter.string(from: monday)) - \(formatter.string(from: sunday))"
    }

    /// Verbatim port of Android's `countryFlag()` lookup table.
    private static func countryFlag(for country: String) -> String {
        switch country.lowercased() {
        case "lebanon":                        return "🇱🇧"
        case "usa", "united states":           return "🇺🇸"
        case "france":                         return "🇫🇷"
        case "germany":                        return "🇩🇪"
        case "uk", "united kingdom":           return "🇬🇧"
        case "canada":                         return "🇨🇦"
        case "australia":                      return "🇦🇺"
        case "japan":                          return "🇯🇵"
        case "brazil":                         return "🇧🇷"
        case "kenya":                          return "🇰🇪"
        case "ethiopia":                       return "🇪🇹"
        case "saudi arabia":                   return "🇸🇦"
        case "uae":                            return "🇦🇪"
        case "egypt":                          return "🇪🇬"
        case "morocco":                        return "🇲🇦"
        default:                               return "🏃"
        }
    }
}

// MARK: – View

/// Standalone Leaderboard -- mirrors Android's `LeaderboardScreen.kt`: scope
/// (Friends/Country/Global) and period (Weekly/All-Time) selectors up top,
/// a ranked list below with the signed-in user's own row highlighted.
/// Reachable from the Profile tab via `AppRoute.leaderboard`.
struct LeaderboardView: View {
    @StateObject private var viewModel = LeaderboardViewModel()

    var body: some View {
        VStack(spacing: 0) {
            filters

            Group {
                if viewModel.isLoading {
                    ProgressView()
                        .tint(RuvoTheme.Colors.primary)
                } else if viewModel.entries.isEmpty {
                    emptyState
                } else {
                    listContent
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(RuvoTheme.Colors.background.ignoresSafeArea())
        .navigationTitle("Leaderboard")
        .navigationBarTitleDisplayMode(.large)
        .onAppear { viewModel.start() }
    }

    private var filters: some View {
        VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
            // Scope tabs: Friends / Country / Global -- RuvoSelectionChip
            // already carries the same crossfade-on-select treatment as
            // Android's `animateColorAsState(... RuvoMotion.easeInOut(quick))`.
            HStack(spacing: RuvoTheme.Spacing.sm) {
                ForEach(LeaderboardScope.allCases) { scope in
                    RuvoSelectionChip(
                        label: scope.label,
                        isSelected: viewModel.scope == scope,
                        shape: AnyShape(Capsule()),
                        action: { viewModel.setScope(scope) }
                    )
                    .frame(width: 92, height: 36)
                }
            }

            // Period tabs: Weekly / All-Time, with the resolved date range.
            HStack {
                HStack(spacing: RuvoTheme.Spacing.sm) {
                    ForEach(LeaderboardPeriod.allCases) { period in
                        RuvoSelectionChip(
                            label: period.label,
                            isSelected: viewModel.period == period,
                            shape: AnyShape(Capsule()),
                            action: { viewModel.setPeriod(period) }
                        )
                        .frame(width: 88, height: 30)
                    }
                }
                Spacer()
                Text(viewModel.dateRangeLabel)
                    .font(RuvoTheme.Typography.caption)
                    .tracking(RuvoTheme.Typography.Tracking.caption)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
            }
        }
        .padding(.horizontal, RuvoTheme.Spacing.lg)
        .padding(.vertical, RuvoTheme.Spacing.md)
    }

    private var listContent: some View {
        ScrollView {
            LazyVStack(spacing: RuvoTheme.Spacing.sm) {
                ForEach(viewModel.entries) { entry in
                    RankedRunnerRow(entry: entry)
                }
                Spacer(minLength: RuvoTheme.Spacing.xl)
            }
            .padding(RuvoTheme.Spacing.lg)
        }
    }

    private var emptyState: some View {
        VStack(spacing: RuvoTheme.Spacing.sm) {
            Image(systemName: "person.3.fill")
                .font(.system(size: 40))
                .foregroundColor(RuvoTheme.Colors.textTertiary)
            Text(
                viewModel.scope == .friends
                    ? "No friends yet — follow runners in Global!"
                    : "No runners found."
            )
            .font(RuvoTheme.Typography.bodyMedium)
            .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
            .foregroundColor(RuvoTheme.Colors.textTertiary)
            .multilineTextAlignment(.center)
        }
        .padding(RuvoTheme.Spacing.xl)
    }
}

private struct RankedRunnerRow: View {
    let entry: RankedRunnerEntry

    // Neither platform has a RuvoTheme/RuvoColors token for rank medals --
    // Android hardcodes these same three colors as one-off literals too
    // (`Color(0xFFFFD700)` / `0xFFC0C0C0` / `0xFFCD7F32` in
    // `LeaderboardScreen.kt`), so this mirrors that rather than inventing a
    // new theme color for a one-place-only use.
    private static let gold = Color(hex: "#FFD700")
    private static let silver = Color(hex: "#C0C0C0")
    private static let bronze = Color(hex: "#CD7F32")

    private var rankBackground: Color {
        switch entry.rank {
        case 1: return Self.gold
        case 2: return Self.silver
        case 3: return Self.bronze
        default: return entry.isCurrentUser ? RuvoTheme.Colors.primary : RuvoTheme.Colors.surfaceElevated
        }
    }

    private var rankTextColor: Color {
        (entry.rank <= 3 || entry.isCurrentUser) ? .black : RuvoTheme.Colors.textSecondary
    }

    var body: some View {
        RuvoCard(isHighlighted: entry.isCurrentUser, glowColor: RuvoTheme.Colors.primary) {
            HStack(spacing: RuvoTheme.Spacing.md) {
                ZStack {
                    Circle()
                        .fill(rankBackground)
                        .frame(width: 32, height: 32)
                    Text("\(entry.rank)")
                        .font(RuvoTheme.Typography.labelLarge)
                        .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                        .foregroundColor(rankTextColor)
                }

                ZStack {
                    Circle()
                        .fill(RuvoTheme.Colors.surfaceElevated)
                        .frame(width: 42, height: 42)
                    Circle()
                        .stroke(entry.isCurrentUser ? RuvoTheme.Colors.primary : RuvoTheme.Colors.border, lineWidth: 2)
                        .frame(width: 42, height: 42)
                    Image(systemName: "person.fill")
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                }

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(entry.displayName)
                            .font(RuvoTheme.Typography.labelLarge)
                            .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                            .foregroundColor(entry.isCurrentUser ? RuvoTheme.Colors.primary : RuvoTheme.Colors.textPrimary)
                            .lineLimit(1)
                        if !entry.countryFlag.isEmpty {
                            Text(entry.countryFlag)
                                .font(.system(size: 14))
                        }
                    }
                    Text(String(format: "%.1f km", entry.distanceKm))
                        .font(RuvoTheme.Typography.bodySmall)
                        .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                }

                Spacer()

                Image(systemName: entry.rank <= 3 ? "trophy.fill" : "person.fill")
                    .foregroundColor(entry.rank <= 3 ? rankBackground : RuvoTheme.Colors.textTertiary)
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}
