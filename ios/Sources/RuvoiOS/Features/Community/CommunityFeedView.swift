import SwiftUI

struct CommunityFeedView: View {
    @StateObject private var viewModel = CommunityViewModel()
    @State private var selectedTab: CommunityTab = .feed

    enum CommunityTab: String, CaseIterable {
        case feed = "Feed"
        case clubs = "Clubs"
        case challenges = "Challenges"
        case leaderboard = "Leaderboard"
    }

    var body: some View {
        VStack(spacing: 0) {
            // Tab selector
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: RuvoTheme.Spacing.sm) {
                    ForEach(CommunityTab.allCases, id: \.self) { tab in
                        Button {
                            withAnimation(RuvoTheme.Motion.springSettled()) { selectedTab = tab }
                        } label: {
                            Text(tab.rawValue)
                                .font(RuvoTheme.Typography.labelLarge)
                                .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                                .foregroundColor(selectedTab == tab ? .black : RuvoTheme.Colors.textSecondary)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(selectedTab == tab ? RuvoTheme.Colors.primary : Color.clear)
                                .clipShape(Capsule())
                        }
                    }
                }
                .padding(.horizontal, RuvoTheme.Spacing.lg)
                .padding(.vertical, 12)
            }
            .background(RuvoTheme.Colors.surface)
            .overlay(Divider().background(RuvoTheme.Colors.border), alignment: .bottom)

            // Content
            TabView(selection: $selectedTab) {
                FeedTab(viewModel: viewModel).tag(CommunityTab.feed)
                ClubsTab(viewModel: viewModel).tag(CommunityTab.clubs)
                ChallengesTab(viewModel: viewModel).tag(CommunityTab.challenges)
                LeaderboardTab(viewModel: viewModel).tag(CommunityTab.leaderboard)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
        .background(RuvoTheme.Colors.background.ignoresSafeArea())
        .navigationTitle("Community")
        .navigationBarTitleDisplayMode(.large)
        .task { await viewModel.loadFeed() }
    }
}

// MARK: – Feed Tab
struct FeedTab: View {
    @ObservedObject var viewModel: CommunityViewModel

    var body: some View {
        ScrollView {
            LazyVStack(spacing: RuvoTheme.Spacing.sm) {
                ForEach(viewModel.feedItems) { item in
                    FeedCard(item: item, onLike: { viewModel.toggleLike(item) })
                }
                if viewModel.isLoadingMore {
                    ProgressView().tint(RuvoTheme.Colors.primary).padding()
                }
            }
            .padding(RuvoTheme.Spacing.lg)
        }
        .refreshable { await viewModel.loadFeed() }
    }
}

struct FeedCard: View {
    let item: FeedItem
    let onLike: () -> Void

    var body: some View {
        RuvoCard {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
                // User header
                HStack(spacing: 10) {
                    AsyncImage(url: URL(string: item.userAvatarUrl ?? "")) { img in
                        img.resizable().scaledToFill()
                    } placeholder: {
                        Circle().fill(RuvoTheme.Colors.surfaceElevated)
                    }
                    .frame(width: 40, height: 40)
                    .clipShape(Circle())

                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.userDisplayName)
                            .font(RuvoTheme.Typography.labelLarge)
                            .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                        Text(item.createdAt, style: .relative)
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textTertiary)
                    }
                    Spacer()
                    RuvoChip(label: feedTypeLabel, isActive: false)
                }

                // Run stats (if type == "run")
                if let dist = item.distanceKm {
                    HStack(spacing: 0) {
                        FeedStat(label: "Distance", value: String(format: "%.2f km", dist))
                        if let pace = item.paceMinPerKm {
                            FeedStat(label: "Avg. Pace", value: "\(pace.formattedPace)/km")
                        }
                        if let dur = item.durationSeconds {
                            FeedStat(label: "Time", value: dur.formatted)
                        }
                    }
                    .padding(RuvoTheme.Spacing.sm)
                    .background(RuvoTheme.Colors.surfaceElevated)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                // Social row
                HStack(spacing: RuvoTheme.Spacing.md) {
                    Button(action: onLike) {
                        HStack(spacing: 4) {
                            Image(systemName: item.isLikedByMe ? "heart.fill" : "heart")
                                .foregroundColor(item.isLikedByMe ? .red : RuvoTheme.Colors.textTertiary)
                            Text("\(item.likesCount)")
                                .font(RuvoTheme.Typography.bodySmall)
                                .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                                .foregroundColor(RuvoTheme.Colors.textSecondary)
                        }
                    }
                    HStack(spacing: 4) {
                        Image(systemName: "bubble.left")
                            .foregroundColor(RuvoTheme.Colors.textTertiary)
                        Text("\(item.commentsCount)")
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textSecondary)
                    }
                    Spacer()
                    Button {
                        // Share
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                            .foregroundColor(RuvoTheme.Colors.textTertiary)
                    }
                }
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }

    private var feedTypeLabel: String {
        switch item.type {
        case "run": return "🏃 Run"
        case "pr":  return "🏆 PR"
        case "challenge_completed": return "⚡️ Challenge"
        default: return item.type
        }
    }
}

struct FeedStat: View {
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(RuvoTheme.Typography.labelLarge)
                .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                .foregroundColor(RuvoTheme.Colors.textPrimary)
            Text(label)
                .font(RuvoTheme.Typography.caption)
                .foregroundColor(RuvoTheme.Colors.textTertiary)
                .tracking(RuvoTheme.Typography.Tracking.caption)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: – Leaderboard Tab
struct LeaderboardTab: View {
    @ObservedObject var viewModel: CommunityViewModel

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(Array(viewModel.leaderboard.enumerated()), id: \.element.id) { idx, entry in
                    LeaderboardRow(rank: idx + 1, entry: entry)
                    if idx < viewModel.leaderboard.count - 1 {
                        Divider().background(RuvoTheme.Colors.border).padding(.leading, 72)
                    }
                }
            }
            .padding(RuvoTheme.Spacing.lg)
        }
    }
}

struct LeaderboardEntry: Identifiable {
    let id: String
    var displayName: String
    var avatarUrl: String?
    var weeklyDistanceKm: Double
    var xp: Int
    var isCurrentUser: Bool = false
}

struct LeaderboardRow: View {
    let rank: Int
    let entry: LeaderboardEntry

    var body: some View {
        HStack(spacing: RuvoTheme.Spacing.sm) {
            // Rank
            Text(rankDisplay)
                .font(RuvoTheme.Typography.statNumber)
                .tracking(RuvoTheme.Typography.Tracking.statNumber)
                .foregroundColor(rankColor)
                .frame(width: 40)

            // Avatar
            AsyncImage(url: URL(string: entry.avatarUrl ?? "")) { img in
                img.resizable().scaledToFill()
            } placeholder: {
                Circle().fill(RuvoTheme.Colors.surfaceElevated)
            }
            .frame(width: 44, height: 44)
            .clipShape(Circle())
            .overlay(
                entry.isCurrentUser
                ? Circle().stroke(RuvoTheme.Colors.primary, lineWidth: 2)
                : nil
            )

            // Name + stats
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.displayName + (entry.isCurrentUser ? " (You)" : ""))
                    .font(RuvoTheme.Typography.labelLarge)
                    .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Text(String(format: "%.1f km this week", entry.weeklyDistanceKm))
                    .font(RuvoTheme.Typography.bodySmall)
                    .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
            }

            Spacer()

            Text("\(entry.xp) XP")
                .font(RuvoTheme.Typography.labelLarge)
                .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                .foregroundColor(RuvoTheme.Colors.primary)
        }
        .padding(.vertical, 12)
        .background(entry.isCurrentUser ? RuvoTheme.Colors.primaryDim : .clear)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var rankDisplay: String {
        switch rank {
        case 1: return "🥇"
        case 2: return "🥈"
        case 3: return "🥉"
        default: return "\(rank)"
        }
    }

    private var rankColor: Color {
        switch rank {
        case 1: return .yellow
        case 2: return Color(hex: "#C0C0C0")
        case 3: return Color(hex: "#CD7F32")
        default: return RuvoTheme.Colors.textSecondary
        }
    }
}

// MARK: – Stub tabs (full implementations omitted for length)
struct ClubsTab: View {
    @ObservedObject var viewModel: CommunityViewModel
    var body: some View {
        ScrollView {
            LazyVStack(spacing: RuvoTheme.Spacing.sm) {
                ForEach(viewModel.clubs) { club in
                    ClubCard(club: club)
                }
            }.padding(RuvoTheme.Spacing.lg)
        }
    }
}

struct ClubCard: View {
    let club: Club
    var body: some View {
        RuvoCard {
            HStack(spacing: RuvoTheme.Spacing.sm) {
                AsyncImage(url: URL(string: club.avatarUrl ?? "")) { img in img.resizable().scaledToFill() } placeholder: { Circle().fill(RuvoTheme.Colors.surfaceElevated) }
                    .frame(width: 52, height: 52).clipShape(Circle())
                VStack(alignment: .leading, spacing: 4) {
                    Text(club.name).font(RuvoTheme.Typography.headingSmall).tracking(RuvoTheme.Typography.Tracking.headingSmall).foregroundColor(RuvoTheme.Colors.textPrimary)
                    Text("\(club.memberCount) members · \(club.city ?? "Global")")
                        .font(RuvoTheme.Typography.bodySmall).tracking(RuvoTheme.Typography.Tracking.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
                }
                Spacer()
                RuvoButton(title: "Join", style: .primary, isFullWidth: false) {}
            }.padding(RuvoTheme.Spacing.md)
        }
    }
}

struct ChallengesTab: View {
    @ObservedObject var viewModel: CommunityViewModel
    var body: some View {
        ScrollView {
            LazyVStack(spacing: RuvoTheme.Spacing.sm) {
                ForEach(viewModel.challenges) { challenge in
                    ChallengeCard(challenge: challenge)
                }
            }.padding(RuvoTheme.Spacing.lg)
        }
    }
}

struct ChallengeCard: View {
    let challenge: Challenge
    var body: some View {
        RuvoCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    RuvoChip(label: challenge.type.rawValue.uppercased(), isActive: false)
                    Spacer()
                    Text(challenge.endsAt, style: .relative)
                        .font(RuvoTheme.Typography.caption).tracking(RuvoTheme.Typography.Tracking.caption).foregroundColor(RuvoTheme.Colors.textTertiary)
                }
                Text(challenge.title).font(RuvoTheme.Typography.headingSmall).tracking(RuvoTheme.Typography.Tracking.headingSmall).foregroundColor(RuvoTheme.Colors.textPrimary)
                Text(challenge.description).font(RuvoTheme.Typography.bodySmall).tracking(RuvoTheme.Typography.Tracking.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
                HStack {
                    HStack(spacing: 4) {
                        Image(systemName: "bolt.fill").foregroundColor(RuvoTheme.Colors.primary).font(.caption)
                        Text("+\(challenge.rewardXP) XP").font(RuvoTheme.Typography.labelSmall).tracking(RuvoTheme.Typography.Tracking.labelSmall).foregroundColor(RuvoTheme.Colors.primary)
                    }
                    HStack(spacing: 4) {
                        Text("🪙").font(.caption)
                        Text("+\(challenge.rewardCoins)").font(RuvoTheme.Typography.labelSmall).tracking(RuvoTheme.Typography.Tracking.labelSmall).foregroundColor(RuvoTheme.Colors.textSecondary)
                    }
                    Spacer()
                    Text("\(challenge.participantCount) joined").font(RuvoTheme.Typography.bodySmall).tracking(RuvoTheme.Typography.Tracking.bodySmall).foregroundColor(RuvoTheme.Colors.textTertiary)
                }
            }.padding(RuvoTheme.Spacing.md)
        }
    }
}

// Placeholder structs for compilation
struct FeedItem: Identifiable {
    let id: String
    var type: String
    var userId: String
    var userDisplayName: String
    var userAvatarUrl: String?
    var distanceKm: Double?
    var paceMinPerKm: Double?
    var durationSeconds: Int?
    var likesCount: Int
    var commentsCount: Int
    var isLikedByMe: Bool
    var createdAt: Date
}
