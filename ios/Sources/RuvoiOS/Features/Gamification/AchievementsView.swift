import SwiftUI
import Foundation
import FirebaseAuth
import FirebaseFirestore

// MARK: – Catalogue

/// One entry in RUVO's fixed achievement catalogue -- mirrors Android's
/// `Badge` (`core/model/Badges.kt`'s `ALL_BADGES`), itself a verbatim port of
/// RN's `src/constants/badges.js`. The catalogue (id, title, description,
/// emoji, accent color, category) lives in code on every platform, not in
/// Firestore -- only *unlock state* is server data: each earned badge is
/// appended to `users/{uid}.badges` as a denormalized map
/// `{id, name, description, icon, color, category, earnedAt}`
/// (`checkNewBadges()`'s real write shape). `AchievementsViewModel` below
/// reads that same field/shape so a badge unlocked by any platform's write
/// path renders correctly here.
///
/// Named `AchievementDefinition` rather than `Badge`/`Achievement` because
/// `GamificationView.swift` (owned by another change this round) already
/// declares top-level `struct Achievement` and `struct AchievementBadge` --
/// this is a deliberately distinct type, not a reuse of those.
struct AchievementDefinition: Identifiable {
    let id: String
    let title: String
    let emoji: String
    let description: String
    let colorHex: String
    let category: String
}

/// Verbatim port of Android's `ALL_BADGES` -- same ids, titles, emoji,
/// colors, categories, and category ordering (so grouping below matches
/// Android's `groupBy` exactly). Unlock *conditions* are intentionally not
/// ported: there is no client-side badge-award evaluator on iOS yet (no
/// counterpart to `checkNewBadges()` wired into a save path), so this screen
/// only ever reads whichever ids are already present in `users/{uid}.badges`
/// -- it never computes a new unlock locally. That's a pre-existing gap
/// (iOS has never awarded any badge), not something a screen alone can fix.
enum AchievementCatalog {
    static let all: [AchievementDefinition] = [
        // Distance Milestones
        AchievementDefinition(id: "b_first_run", title: "First Steps", emoji: "👣", description: "Completed your first run!", colorHex: "#CCFF00", category: "Distance Milestones"),
        AchievementDefinition(id: "b_5k", title: "High Five", emoji: "🖐️", description: "Ran 5km in a single session.", colorHex: "#CCFF00", category: "Distance Milestones"),
        AchievementDefinition(id: "b_10k", title: "10K Finisher", emoji: "🎗️", description: "Ran 10km in a single session.", colorHex: "#FF4500", category: "Distance Milestones"),
        AchievementDefinition(id: "b_half", title: "Half Marathon", emoji: "🏅", description: "Ran 21.1km in a single session.", colorHex: "#FFD700", category: "Distance Milestones"),
        AchievementDefinition(id: "b_century_club", title: "Century Club", emoji: "🏆", description: "Ran 100km total distance.", colorHex: "#9C27B0", category: "Distance Milestones"),
        // Lifestyle & Habits
        AchievementDefinition(id: "b_early_bird", title: "Early Bird", emoji: "☀️", description: "Finished a run before 7 AM.", colorHex: "#FDD835", category: "Lifestyle & Habits"),
        AchievementDefinition(id: "b_night_owl", title: "Night Owl", emoji: "🌙", description: "Finished a run after 8 PM.", colorHex: "#536DFE", category: "Lifestyle & Habits"),
        AchievementDefinition(id: "b_weekend_warrior", title: "Weekend Warrior", emoji: "🍺", description: "Ran on both Saturday and Sunday.", colorHex: "#FF9800", category: "Lifestyle & Habits"),
        // Consistency & Streaks
        AchievementDefinition(id: "b_10_runs", title: "Dedicated", emoji: "🔥", description: "Completed 10 total runs.", colorHex: "#FF5722", category: "Consistency & Streaks"),
        AchievementDefinition(id: "b_perfect_week", title: "Perfect Week", emoji: "📅", description: "Ran 7 days in a row.", colorHex: "#00E676", category: "Consistency & Streaks"),
        // Elevation Challenges
        AchievementDefinition(id: "b_hill_hunter", title: "Hill Hunter", emoji: "📈", description: "Completed 10 runs with 100m+ elevation.", colorHex: "#795548", category: "Elevation Challenges"),
        // Speed & Performance
        AchievementDefinition(id: "b_sub4_specialist", title: "Sub-4 Specialist", emoji: "⚡", description: "Completed 5 runs under 4:00/km pace.", colorHex: "#00BCD4", category: "Speed & Performance"),
    ]
}

/// A catalogue definition combined with this user's unlock state. `earnedAt`
/// comes straight off the matching entry in `users/{uid}.badges` when
/// present (Android stores it as an ISO-8601 string via
/// `Instant.now().toString()`; a Firestore `Timestamp` is accepted too in
/// case a future write path stores one instead).
struct ResolvedAchievement: Identifiable {
    let definition: AchievementDefinition
    var isUnlocked: Bool
    var earnedAt: Date?
    var id: String { definition.id }
}

struct AchievementGroup: Identifiable {
    let category: String
    let items: [ResolvedAchievement]
    var id: String { category }
    var unlockedCount: Int { items.filter { $0.isUnlocked }.count }
}

// MARK: – ViewModel

@MainActor
final class AchievementsViewModel: ObservableObject {
    @Published private(set) var groups: [AchievementGroup]
    @Published private(set) var isLoading = true

    private let db: Firestore
    private var listener: ListenerRegistration?

    var unlockedCount: Int { groups.flatMap { $0.items }.filter { $0.isUnlocked }.count }
    var totalCount: Int { AchievementCatalog.all.count }
    var progressFraction: Double { totalCount == 0 ? 0 : Double(unlockedCount) / Double(totalCount) }

    init(db: Firestore = Firestore.firestore()) {
        self.db = db
        // Seed every badge as locked immediately so the full catalogue (and
        // its real category grouping) renders on first frame instead of a
        // blank scroll view while the Firestore round-trip is in flight.
        self.groups = Self.buildGroups(earned: [:])
    }

    func start() {
        guard let uid = Auth.auth().currentUser?.uid else {
            isLoading = false
            return
        }
        listener = db.collection("users").document(uid).addSnapshotListener { [weak self] snapshot, _ in
            guard let self else { return }
            let earned = Self.parseEarned(snapshot?.data()?["badges"])
            self.groups = Self.buildGroups(earned: earned)
            self.isLoading = false
        }
    }

    func stop() {
        listener?.remove()
        listener = nil
    }

    private static func parseEarned(_ raw: Any?) -> [String: Date?] {
        guard let entries = raw as? [[String: Any]] else { return [:] }
        var result: [String: Date?] = [:]
        for entry in entries {
            guard let id = entry["id"] as? String else { continue }
            result[id] = parseDate(entry["earnedAt"])
        }
        return result
    }

    private static func parseDate(_ raw: Any?) -> Date? {
        if let timestamp = raw as? Timestamp { return timestamp.dateValue() }
        if let string = raw as? String { return ISO8601DateFormatter().date(from: string) }
        return nil
    }

    /// Groups by category, preserving `ALL_BADGES`' own category ordering
    /// (Kotlin's `groupBy` preserves first-seen-key order, so this matches
    /// Android's `buildCategories()` rather than alphabetizing).
    private static func buildGroups(earned: [String: Date?]) -> [AchievementGroup] {
        let resolved = AchievementCatalog.all.map { def -> ResolvedAchievement in
            if let earnedAt = earned[def.id] {
                return ResolvedAchievement(definition: def, isUnlocked: true, earnedAt: earnedAt)
            }
            return ResolvedAchievement(definition: def, isUnlocked: false, earnedAt: nil)
        }
        let byCategory = Dictionary(grouping: resolved, by: { $0.definition.category })
        return byCategory
            .map { AchievementGroup(category: $0.key, items: $0.value) }
            .sorted { lhs, rhs in categoryOrder(lhs.category) < categoryOrder(rhs.category) }
    }

    private static func categoryOrder(_ category: String) -> Int {
        AchievementCatalog.all.firstIndex { $0.category == category } ?? Int.max
    }
}

// MARK: – View

/// Standalone "Trophy Room" -- mirrors Android's `AchievementsScreen.kt`:
/// a completion header, badges grouped by category in a 3-column grid,
/// locked (dimmed/grayscale) vs. unlocked (full color + accent border +
/// unlock date) states, and a tap-for-detail sheet. Reachable from the
/// Profile tab (own profile only, since unlock state is always the signed-in
/// user's) via `AppRoute.achievements`.
struct AchievementsView: View {
    @StateObject private var viewModel = AchievementsViewModel()
    @State private var selected: ResolvedAchievement?

    var body: some View {
        ScrollView {
            VStack(spacing: RuvoTheme.Spacing.lg) {
                progressCard

                ForEach(viewModel.groups) { group in
                    AchievementGroupSection(group: group, onSelect: { selected = $0 })
                }
            }
            .padding(RuvoTheme.Spacing.lg)
        }
        .background(RuvoTheme.Colors.background.ignoresSafeArea())
        .navigationTitle("Trophy Room")
        .navigationBarTitleDisplayMode(.large)
        .onAppear { viewModel.start() }
        .onDisappear { viewModel.stop() }
        .sheet(item: $selected) { achievement in
            AchievementDetailSheet(achievement: achievement)
        }
    }

    private var progressCard: some View {
        RuvoCard(isHighlighted: true) {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.md) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("COMPLETION")
                            .font(RuvoTheme.Typography.caption)
                            .tracking(RuvoTheme.Typography.Tracking.caption)
                            .foregroundColor(RuvoTheme.Colors.textTertiary)
                        Text("\(Int(viewModel.progressFraction * 100))%")
                            .font(RuvoTheme.Typography.displayLarge)
                            .tracking(RuvoTheme.Typography.Tracking.displayLarge)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                    }
                    Spacer()
                    VStack(spacing: 4) {
                        Image(systemName: "trophy.fill")
                            .font(.system(size: 24))
                            .foregroundColor(RuvoTheme.Colors.primary)
                        Text("\(viewModel.unlockedCount) / \(viewModel.totalCount)")
                            .font(RuvoTheme.Typography.labelLarge)
                            .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                            .foregroundColor(RuvoTheme.Colors.primary)
                    }
                    .padding(.horizontal, RuvoTheme.Spacing.md)
                    .padding(.vertical, RuvoTheme.Spacing.sm)
                    .background(RuvoTheme.Colors.primaryDim)
                    .clipShape(RoundedRectangle(cornerRadius: RuvoTheme.Radius.md))
                }
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(RuvoTheme.Colors.border).frame(height: 8)
                        Capsule()
                            .fill(RuvoTheme.Colors.primary)
                            .frame(width: geo.size.width * viewModel.progressFraction, height: 8)
                            .animation(RuvoTheme.Motion.easeOut(RuvoTheme.Motion.Duration.entrance), value: viewModel.progressFraction)
                    }
                }
                .frame(height: 8)
            }
            .padding(RuvoTheme.Spacing.lg)
        }
    }
}

private struct AchievementGroupSection: View {
    let group: AchievementGroup
    let onSelect: (ResolvedAchievement) -> Void
    private let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
            HStack(alignment: .bottom) {
                Text(group.category.uppercased())
                    .font(RuvoTheme.Typography.labelSmall)
                    .tracking(RuvoTheme.Typography.Tracking.labelSmall)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Spacer()
                Text("\(group.unlockedCount)/\(group.items.count)")
                    .font(RuvoTheme.Typography.bodySmall)
                    .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
            }
            Divider().background(RuvoTheme.Colors.border)
            LazyVGrid(columns: columns, spacing: RuvoTheme.Spacing.sm) {
                ForEach(group.items) { item in
                    AchievementCell(achievement: item, onSelect: { onSelect(item) })
                }
            }
        }
    }
}

private struct AchievementCell: View {
    let achievement: ResolvedAchievement
    let onSelect: () -> Void
    private var accentColor: Color { Color(hex: achievement.definition.colorHex) }

    var body: some View {
        RuvoSelectableCard(isSelected: achievement.isUnlocked, glowColor: accentColor, action: onSelect) {
            VStack(spacing: RuvoTheme.Spacing.xs) {
                // Emoji-as-reward: full color when unlocked, desaturated +
                // dimmed while locked (BRAND_GUIDELINES.md §6 -- emoji are
                // reserved for the reward itself, so the locked/unlocked
                // contrast has to live on the emoji, not a substituted icon).
                Text(achievement.definition.emoji)
                    .font(.system(size: 30))
                    .grayscale(achievement.isUnlocked ? 0 : 1)
                    .opacity(achievement.isUnlocked ? 1 : 0.4)
                Text(achievement.definition.title)
                    .font(RuvoTheme.Typography.bodySmall)
                    .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                    .foregroundColor(achievement.isUnlocked ? RuvoTheme.Colors.textPrimary : RuvoTheme.Colors.textTertiary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .multilineTextAlignment(.center)
            }
            .padding(RuvoTheme.Spacing.sm)
            .frame(maxWidth: .infinity)
        }
    }
}

private struct AchievementDetailSheet: View {
    let achievement: ResolvedAchievement
    @Environment(\.dismiss) private var dismiss
    private var accentColor: Color { Color(hex: achievement.definition.colorHex) }

    var body: some View {
        VStack(spacing: RuvoTheme.Spacing.lg) {
            HStack {
                Spacer()
                RuvoIconButton(icon: "xmark", action: { dismiss() })
            }

            ZStack {
                Circle()
                    .fill(achievement.isUnlocked ? accentColor.opacity(0.12) : RuvoTheme.Colors.surfaceElevated)
                    .overlay(Circle().stroke(achievement.isUnlocked ? accentColor : RuvoTheme.Colors.border, lineWidth: 3))
                    .frame(width: 100, height: 100)
                Text(achievement.definition.emoji)
                    .font(.system(size: 46))
                    .grayscale(achievement.isUnlocked ? 0 : 1)
                    .opacity(achievement.isUnlocked ? 1 : 0.5)
            }

            Text(achievement.definition.title)
                .font(RuvoTheme.Typography.headingLarge)
                .tracking(RuvoTheme.Typography.Tracking.headingLarge)
                .foregroundColor(RuvoTheme.Colors.textPrimary)

            RuvoChip(
                label: achievement.isUnlocked ? "UNLOCKED" : "LOCKED",
                isActive: achievement.isUnlocked,
                color: achievement.isUnlocked ? RuvoTheme.Colors.primary : RuvoTheme.Colors.textTertiary
            )

            Text(achievement.definition.description)
                .font(RuvoTheme.Typography.bodyMedium)
                .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                .foregroundColor(RuvoTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)

            if let earnedAt = achievement.earnedAt {
                Text("Unlocked \(earnedAt, style: .date)")
                    .font(RuvoTheme.Typography.bodySmall)
                    .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
            } else {
                Text("Keep running to unlock this achievement!")
                    .font(RuvoTheme.Typography.bodySmall)
                    .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
            }

            Spacer(minLength: 0)
        }
        .padding(RuvoTheme.Spacing.xl)
        .background(RuvoTheme.Colors.background.ignoresSafeArea())
        .presentationDetents([.medium])
    }
}
