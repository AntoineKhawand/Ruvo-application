import SwiftUI

struct GamificationView: View {
    @EnvironmentObject private var gamificationService: GamificationService
    @State private var showRewards = false
    @State private var xpAnimating = false

    var body: some View {
        ScrollView {
            VStack(spacing: RuvoTheme.Spacing.lg) {
                // Level + XP header
                LevelCard(service: gamificationService)
                    .padding(.horizontal, RuvoTheme.Spacing.lg)

                // Streak banner
                StreakBanner(streakDays: gamificationService.streakDays)
                    .padding(.horizontal, RuvoTheme.Spacing.lg)

                // Coins + Redeem
                CoinBalanceCard(coins: gamificationService.coins) {
                    showRewards = true
                }
                .padding(.horizontal, RuvoTheme.Spacing.lg)

                // Recent achievements
                AchievementsSection(achievements: gamificationService.recentAchievements)
                    .padding(.horizontal, RuvoTheme.Spacing.lg)

                // Weekly challenges progress
                WeeklyChallengesSection()
                    .padding(.horizontal, RuvoTheme.Spacing.lg)
            }
            .padding(.vertical, RuvoTheme.Spacing.lg)
        }
        .background(RuvoTheme.Colors.background.ignoresSafeArea())
        .navigationTitle("Rewards")
        .sheet(isPresented: $showRewards) {
            RewardsShopView()
        }
    }
}

struct LevelCard: View {
    @ObservedObject var service: GamificationService
    @State private var progressAnimation: Double = 0

    var body: some View {
        RuvoCard(isHighlighted: true) {
            VStack(spacing: RuvoTheme.Spacing.lg) {
                // Level badge + XP
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Level \(service.level)")
                            .font(RuvoTheme.Typography.displayMedium)
                            .foregroundColor(RuvoTheme.Colors.primary)
                        Text("Runner Class")
                            .font(RuvoTheme.Typography.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textSecondary)
                    }
                    Spacer()
                    ZStack {
                        Circle()
                            .fill(RuvoTheme.Colors.primaryDim)
                            .frame(width: 72, height: 72)
                        Text(levelEmoji)
                            .font(.system(size: 36))
                    }
                }

                // XP progress bar
                VStack(spacing: 8) {
                    HStack {
                        Text("\(service.xp) XP")
                            .font(RuvoTheme.Typography.labelLarge)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                        Spacer()
                        Text("\(service.xpToNextLevel) XP to Level \(service.level + 1)")
                            .font(RuvoTheme.Typography.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textSecondary)
                    }

                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(RuvoTheme.Colors.border)
                                .frame(height: 8)
                            Capsule()
                                .fill(
                                    LinearGradient(
                                        colors: [RuvoTheme.Colors.primary, Color(hex: "#A8CC00")],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(width: geo.size.width * progressAnimation, height: 8)
                        }
                    }
                    .frame(height: 8)
                    .onAppear {
                        withAnimation(.easeOut(duration: 1.2)) {
                            progressAnimation = service.levelProgress
                        }
                    }
                }
            }
            .padding(RuvoTheme.Spacing.lg)
        }
    }

    private var levelEmoji: String {
        switch service.level {
        case 1...5:   return "🏃"
        case 6...10:  return "⚡️"
        case 11...20: return "🔥"
        case 21...30: return "💎"
        default:      return "🏆"
        }
    }
}

struct StreakBanner: View {
    let streakDays: Int

    var body: some View {
        RuvoCard(isHighlighted: streakDays >= 7, glowColor: .orange) {
            HStack(spacing: RuvoTheme.Spacing.md) {
                Text("🔥")
                    .font(.system(size: 36))
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(streakDays)-Day Streak!")
                        .font(RuvoTheme.Typography.headingSmall)
                        .foregroundColor(RuvoTheme.Colors.textPrimary)
                    Text(streakDays > 0 ? "Keep it up — run today to extend your streak." : "Start a new streak today!")
                        .font(RuvoTheme.Typography.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                }
                Spacer()
                if streakDays >= 7 {
                    RuvoChip(label: "BONUS", isActive: true, color: .orange)
                }
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}

struct CoinBalanceCard: View {
    let coins: Int
    let onRedeem: () -> Void

    var body: some View {
        RuvoCard {
            HStack {
                HStack(spacing: RuvoTheme.Spacing.sm) {
                    Text("🪙")
                        .font(.system(size: 32))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(coins)")
                            .font(RuvoTheme.Typography.statNumber)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                        Text("Coins")
                            .font(RuvoTheme.Typography.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textSecondary)
                    }
                }
                Spacer()
                RuvoButton(title: "Redeem", style: .primary, isFullWidth: false, action: onRedeem)
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}

struct AchievementsSection: View {
    let achievements: [Achievement]

    var body: some View {
        VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
            Text("Achievements")
                .font(RuvoTheme.Typography.headingSmall)
                .foregroundColor(RuvoTheme.Colors.textPrimary)

            if achievements.isEmpty {
                RuvoCard {
                    HStack {
                        Spacer()
                        VStack(spacing: 8) {
                            Text("🏅").font(.system(size: 40))
                            Text("Complete runs to unlock achievements!")
                                .font(RuvoTheme.Typography.bodyMedium)
                                .foregroundColor(RuvoTheme.Colors.textSecondary)
                        }
                        Spacer()
                    }
                    .padding(RuvoTheme.Spacing.xl)
                }
            } else {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: RuvoTheme.Spacing.sm) {
                    ForEach(achievements) { ach in
                        AchievementBadge(achievement: ach)
                    }
                }
            }
        }
    }
}

struct AchievementBadge: View {
    let achievement: Achievement

    var body: some View {
        RuvoCard(isHighlighted: achievement.isNew) {
            VStack(spacing: 8) {
                Text(achievement.emoji)
                    .font(.system(size: 32))
                Text(achievement.title)
                    .font(RuvoTheme.Typography.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                if achievement.isNew {
                    RuvoChip(label: "NEW", isActive: true)
                }
            }
            .padding(RuvoTheme.Spacing.sm)
            .frame(maxWidth: .infinity)
        }
    }
}

struct Achievement: Identifiable {
    let id: String
    var title: String
    var emoji: String
    var isNew: Bool = false
    var earnedAt: Date?
}

struct WeeklyChallengesSection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
            Text("This Week")
                .font(RuvoTheme.Typography.headingSmall)
                .foregroundColor(RuvoTheme.Colors.textPrimary)
            // Placeholder — populated from CommunityService
            RuvoCard {
                VStack(alignment: .leading, spacing: 12) {
                    WeeklyGoalRow(label: "Distance Goal", current: 18.5, target: 30, unit: "km", color: RuvoTheme.Colors.primary)
                    WeeklyGoalRow(label: "Runs Logged", current: 3, target: 4, unit: "runs", color: RuvoTheme.Colors.teal)
                    WeeklyGoalRow(label: "Active Days", current: 4, target: 5, unit: "days", color: RuvoTheme.Colors.purple)
                }
                .padding(RuvoTheme.Spacing.md)
            }
        }
    }
}

struct WeeklyGoalRow: View {
    let label: String
    let current: Double
    let target: Double
    let unit: String
    let color: Color

    private var progress: Double { min(current / target, 1) }

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Text(label).font(RuvoTheme.Typography.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
                Spacer()
                Text("\(Int(current))/\(Int(target)) \(unit)").font(RuvoTheme.Typography.labelLarge).foregroundColor(RuvoTheme.Colors.textPrimary)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(RuvoTheme.Colors.border).frame(height: 6)
                    Capsule().fill(color).frame(width: geo.size.width * progress, height: 6)
                }
            }.frame(height: 6)
        }
    }
}

// MARK: – Rewards shop
struct RewardsShopView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var rewards: [Reward] = []

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: RuvoTheme.Spacing.md) {
                    ForEach(rewards) { reward in
                        RewardCard(reward: reward)
                    }
                }
                .padding(RuvoTheme.Spacing.lg)
            }
            .background(RuvoTheme.Colors.background.ignoresSafeArea())
            .navigationTitle("Rewards Shop")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    RuvoIconButton(icon: "xmark", action: { dismiss() })
                }
            }
        }
    }
}

struct Reward: Identifiable {
    let id: String
    var title: String
    var brandName: String
    var coinsCost: Int
    var discountPercent: Int
    var logoUrl: String?
}

struct RewardCard: View {
    let reward: Reward

    var body: some View {
        RuvoCard {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
                AsyncImage(url: URL(string: reward.logoUrl ?? "")) { img in
                    img.resizable().scaledToFit()
                } placeholder: {
                    RoundedRectangle(cornerRadius: 8).fill(RuvoTheme.Colors.surfaceElevated)
                }
                .frame(height: 60)
                .frame(maxWidth: .infinity)

                Text(reward.brandName)
                    .font(RuvoTheme.Typography.caption)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
                    .tracking(2)
                Text(reward.title)
                    .font(RuvoTheme.Typography.labelLarge)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Text("\(reward.discountPercent)% OFF")
                    .font(RuvoTheme.Typography.headingSmall)
                    .foregroundColor(RuvoTheme.Colors.primary)

                HStack {
                    Text("🪙 \(reward.coinsCost)")
                        .font(RuvoTheme.Typography.labelLarge)
                        .foregroundColor(RuvoTheme.Colors.textPrimary)
                    Spacer()
                    RuvoButton(title: "Claim", style: .primary, isFullWidth: false) {}
                }
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}
