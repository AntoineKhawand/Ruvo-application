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
                            .tracking(RuvoTheme.Typography.Tracking.displayMedium)
                            .foregroundColor(RuvoTheme.Colors.primary)
                        Text("Runner Class")
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
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
                            .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                        Spacer()
                        Text("\(service.xpToNextLevel) XP to Level \(service.level + 1)")
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
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
                        .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                        .foregroundColor(RuvoTheme.Colors.textPrimary)
                    Text(streakDays > 0 ? "Keep it up — run today to extend your streak." : "Start a new streak today!")
                        .font(RuvoTheme.Typography.bodySmall)
                        .tracking(RuvoTheme.Typography.Tracking.bodySmall)
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
                    Image(systemName: "dollarsign.circle.fill")
                        .font(.system(size: 32))
                        .foregroundColor(RuvoTheme.Colors.coinGold)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(coins)")
                            .font(RuvoTheme.Typography.statNumber)
                            .tracking(RuvoTheme.Typography.Tracking.statNumber)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                        Text("Coins")
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
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
                .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                .foregroundColor(RuvoTheme.Colors.textPrimary)

            if achievements.isEmpty {
                RuvoCard {
                    HStack {
                        Spacer()
                        VStack(spacing: 8) {
                            Text("🏅").font(.system(size: 40))
                            Text("Complete runs to unlock achievements!")
                                .font(RuvoTheme.Typography.bodyMedium)
                                .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
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
                    .tracking(RuvoTheme.Typography.Tracking.bodySmall)
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
                .tracking(RuvoTheme.Typography.Tracking.headingSmall)
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
                Text(label).font(RuvoTheme.Typography.bodySmall).tracking(RuvoTheme.Typography.Tracking.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
                Spacer()
                Text("\(Int(current))/\(Int(target)) \(unit)").font(RuvoTheme.Typography.labelLarge).tracking(RuvoTheme.Typography.Tracking.labelLarge).foregroundColor(RuvoTheme.Colors.textPrimary)
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
    @EnvironmentObject private var gamificationService: GamificationService
    // See the NOTE on `Reward` below: there is no Firestore-backed rewards
    // catalog anywhere in this codebase (iOS or Android), so this is
    // populated from the same static catalog Android actually ships, not a
    // fetch -- that's what makes the shop show real data instead of nothing.
    @State private var rewards: [Reward] = Reward.catalog

    @State private var claimingRewardId: String?
    @State private var claimedRewardTitle: String?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: RuvoTheme.Spacing.md) {
                    ForEach(rewards) { reward in
                        RewardCard(
                            reward: reward,
                            userCoins: gamificationService.coins,
                            isClaiming: claimingRewardId == reward.id,
                            onClaim: { claim(reward) }
                        )
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
        .alert("Reward Claimed!", isPresented: Binding(
            get: { claimedRewardTitle != nil },
            set: { if !$0 { claimedRewardTitle = nil } }
        )) {
            Button("Done", role: .cancel) {}
        } message: {
            Text("Your code for \(claimedRewardTitle ?? "this reward") has been sent to your email. Open it to find your QR code and instructions.")
        }
        .alert("Couldn't Claim Reward", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    // Calls the real redeemReward Cloud Function via GamificationService —
    // same input shape (rewardId, price, title) Android's RewardsViewModel
    // sends, same server-side balance check. Coin balance shown here comes
    // from the shared GamificationService (already fed by a users/{uid}
    // snapshot listener), so a successful redemption updates the same
    // balance shown on CoinBalanceCard.
    private func claim(_ reward: Reward) {
        guard claimingRewardId == nil else { return }
        guard gamificationService.coins >= reward.price else {
            errorMessage = "Not enough coins. You need \(reward.price - gamificationService.coins) more."
            return
        }
        claimingRewardId = reward.id
        Task {
            defer { claimingRewardId = nil }
            do {
                try await gamificationService.redeem(rewardId: reward.id, price: reward.price, title: reward.title)
                claimedRewardTitle = reward.title
            } catch {
                // The Cloud Function surfaces plausibility failures (insufficient
                // coins, etc.) as HttpsError, whose message Firebase's SDK maps
                // straight into localizedDescription -- so this already shows the
                // exact server message rather than a generic one. A network/offline
                // failure falls back to whatever description FirebaseFunctions gives.
                errorMessage = (error as NSError).localizedDescription
            }
        }
    }
}

/// NOTE on data source: there is no Firestore collection backing a rewards
/// catalog anywhere in this codebase (checked `firestore.rules` and every
/// Firestore read/write site). Android's equivalent screen
/// (`RewardsScreen.kt`) doesn't read one either -- its `REWARD_CATALOG` is a
/// hardcoded Kotlin list, not fetched from the server. So "wire up a real
/// fetch" here would mean inventing a Firestore shape nobody writes to,
/// which would render empty forever in a different, harder-to-notice way
/// (no error, just always zero documents) -- the exact failure mode this is
/// meant to fix. Instead this mirrors Android's actual, shipped approach: a
/// local catalog with the same ids/titles/brands/categories/prices as
/// `REWARD_CATALOG`, so both platforms genuinely show the same rewards.
/// Redemption itself already has a real server-side implementation
/// (`functions/index.js`'s `redeemReward` -- validates balance in a Firestore
/// transaction) that Android calls; wiring iOS's "Claim" button to it is a
/// natural follow-up but is a separate change from fixing the empty shop.
struct Reward: Identifiable {
    let id: String
    var title: String
    var brand: String
    var category: String
    var price: Int
    var description: String
    var terms: String
    var gradientStart: Color
    var gradientEnd: Color
    var badgeMark: String

    static let catalog: [Reward] = [
        Reward(id: "1", title: "20% Off Sportswear", brand: "Nike Lebanon", category: "Gear", price: 2500, description: "Get 20% off your total purchase at any Nike branch in Lebanon. Valid on all sportswear.", terms: "Expires in 30 days • One use per customer", gradientStart: Color(hex: "#1A1A1A"), gradientEnd: Color(hex: "#111111"), badgeMark: "NIKE"),
        Reward(id: "2", title: "25% Off Sportswear", brand: "Adidas Lebanon", category: "Gear", price: 3000, description: "Enjoy 25% off sportswear at any Adidas branch in Lebanon. Perfect to gear up for your next run.", terms: "Valid in-store only • Cannot be combined with sales", gradientStart: Color(hex: "#F5F5F5"), gradientEnd: Color(hex: "#E8E8E8"), badgeMark: "ADI"),
        Reward(id: "3", title: "15% Off Equipment", brand: "Decathlon Lebanon", category: "Gear", price: 1500, description: "Save 15% on all running equipment at Decathlon.", terms: "Valid on running gear only • One use per account", gradientStart: Color(hex: "#003087"), gradientEnd: Color(hex: "#0056B3"), badgeMark: "DEC"),
        Reward(id: "4", title: "Free Recovery Session", brand: "FitRecovery", category: "Wellness", price: 2000, description: "Enjoy a complimentary 45-min recovery session (compression therapy or ice bath).", terms: "Book online • Requires valid RUVO PRO membership", gradientStart: Color(hex: "#1A1A2E"), gradientEnd: Color(hex: "#0F3460"), badgeMark: "FIT"),
        Reward(id: "5", title: "10% Off Supplements", brand: "Nutrisport Lebanon", category: "Nutrition", price: 1000, description: "10% off all sports nutrition products including protein, electrolytes, and energy gels.", terms: "Valid online and in-store • Excludes sale items", gradientStart: Color(hex: "#0A2A0A"), gradientEnd: Color(hex: "#143314"), badgeMark: "NUT"),
        Reward(id: "6", title: "Free Premium Month", brand: "RUVO PRO", category: "Subscription", price: 5000, description: "Unlock one month of RUVO PRO — AI coaching, advanced analytics, and no ads.", terms: "Applied instantly to your account", gradientStart: Color(hex: "#050505"), gradientEnd: Color(hex: "#1A1A0A"), badgeMark: "PRO"),
        Reward(id: "7", title: "Coffee Voucher", brand: "Starbucks Lebanon", category: "Food", price: 800, description: "A free grande-size drink at any Starbucks Lebanon — you've earned it!", terms: "Valid 7 days from redemption • Dine-in/Takeaway", gradientStart: Color(hex: "#00704A"), gradientEnd: Color(hex: "#004B32"), badgeMark: "SBX"),
        Reward(id: "8", title: "15% Off Race Entry", brand: "Beirut Marathon", category: "Events", price: 3500, description: "Save 15% on your next Beirut Marathon or half marathon registration.", terms: "Valid for one registration • Non-transferable", gradientStart: Color(hex: "#8B0000"), gradientEnd: Color(hex: "#4A0000"), badgeMark: "BMA"),
    ]
}

struct RewardCard: View {
    let reward: Reward
    var userCoins: Int = 0
    var isClaiming: Bool = false
    var onClaim: () -> Void = {}

    private var canAfford: Bool { userCoins >= reward.price }

    var body: some View {
        RuvoCard {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
                ZStack(alignment: .topTrailing) {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(LinearGradient(colors: [reward.gradientStart, reward.gradientEnd], startPoint: .topLeading, endPoint: .bottomTrailing))
                        .frame(height: 60)
                        .overlay(
                            Text(reward.badgeMark)
                                .font(RuvoTheme.Typography.labelLarge)
                                .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                                .foregroundColor(.white.opacity(0.55))
                        )
                    Text(reward.category.uppercased())
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color.black.opacity(0.7))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                        .padding(6)
                }
                .frame(maxWidth: .infinity)

                Text(reward.brand)
                    .font(RuvoTheme.Typography.caption)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
                    .tracking(RuvoTheme.Typography.Tracking.caption)
                Text(reward.title)
                    .font(RuvoTheme.Typography.labelLarge)
                    .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                    .lineLimit(2)

                HStack {
                    HStack(spacing: 4) {
                        Image(systemName: "dollarsign.circle.fill")
                            .foregroundColor(RuvoTheme.Colors.coinGold)
                        Text("\(reward.price)")
                            .font(RuvoTheme.Typography.labelLarge)
                            .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                    }
                    Spacer()
                    RuvoButton(
                        title: canAfford ? "Claim" : "Locked",
                        style: .primary,
                        isLoading: isClaiming,
                        isFullWidth: false,
                        action: onClaim
                    )
                    .disabled(!canAfford || isClaiming)
                }
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}
