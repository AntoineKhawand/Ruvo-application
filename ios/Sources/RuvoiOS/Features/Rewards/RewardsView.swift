import SwiftUI

/// Standalone Rewards screen -- mirrors Android's `RewardsScreen.kt`, which is
/// its own top-level route (`composable("rewards")` in `RuvoApp.kt`'s nav
/// graph) reachable from `ProfileScreen`'s account menu, not something nested
/// inside another feature screen. Reachable here the same way: pushed onto
/// the Profile tab's `NavigationStack` via `AppRoute.rewards` from
/// `RewardsEntryRow` on `ProfileView`.
///
/// All reward-catalog data, coin-balance display, category filtering, and
/// `redeemReward` Cloud Function claim handling live in this one file --
/// `Features/Gamification/GamificationView.swift`'s `RewardsShopView` is now
/// just a `NavigationStack` + close-button wrapper around this same view, so
/// there is exactly one copy of the fetch/claim logic, not two.
///
/// NOTE on data source (carried over from the previous pass): there is no
/// Firestore collection backing a rewards catalog anywhere in this codebase
/// (checked `firestore.rules` and every Firestore read/write site). Android's
/// `RewardsScreen.kt` doesn't read one either -- its `REWARD_CATALOG` is a
/// hardcoded Kotlin list, not fetched from the server. So `Reward.catalog`
/// below mirrors that list verbatim (same ids/titles/brands/categories/
/// prices) rather than inventing a Firestore shape nobody writes to.
/// Redemption itself already has a real server-side implementation
/// (`functions/index.js`'s `redeemReward` -- validates balance in a Firestore
/// transaction) that both platforms call.
///
/// Android's Rewards screen also has a "My Rewards" pill button in its header
/// row (next to the back button and title) that pushes `MyRedemptionsScreen`
/// -- a redemption-history list backed by `users/{uid}/redemptions`
/// (`RedemptionHistoryView.swift` here, reached via `AppRoute.redemptionHistory`).
/// iOS has no custom header row (this screen uses the system nav bar's large
/// title instead of Android's back+title+pill row), so the equivalent pill
/// is rendered as the first row of this screen's scroll content instead --
/// same lime-tinted pill look, same "My Rewards" label, same always-visible
/// placement (not conditional on any redemptions existing).
struct RewardsView: View {
    @EnvironmentObject private var gamificationService: GamificationService
    @EnvironmentObject private var router: NavigationRouter
    @State private var selectedCategory: String = "All"
    @State private var claimingRewardId: String?
    @State private var claimedRewardTitle: String?
    @State private var errorMessage: String?

    private var filteredRewards: [Reward] {
        Reward.catalog.filter { selectedCategory == "All" || $0.category == selectedCategory }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: RuvoTheme.Spacing.lg) {
                MyRewardsPillRow(onTap: { router.navigate(to: .redemptionHistory) })
                    .padding(.horizontal, RuvoTheme.Spacing.lg)

                RewardsBalanceHeader(coins: gamificationService.coins)
                    .padding(.horizontal, RuvoTheme.Spacing.lg)

                CategoryChipsRow(categories: Reward.categories, selected: $selectedCategory)

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: RuvoTheme.Spacing.md) {
                    ForEach(filteredRewards) { reward in
                        RewardCard(
                            reward: reward,
                            userCoins: gamificationService.coins,
                            isClaiming: claimingRewardId == reward.id,
                            onClaim: { claim(reward) }
                        )
                    }
                }
                .padding(.horizontal, RuvoTheme.Spacing.lg)
            }
            .padding(.vertical, RuvoTheme.Spacing.lg)
        }
        .background(RuvoTheme.Colors.background.ignoresSafeArea())
        .navigationTitle("Rewards")
        .navigationBarTitleDisplayMode(.large)
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

    // Calls the real redeemReward Cloud Function via GamificationService --
    // same input shape (rewardId, price, title) Android's RewardsViewModel
    // sends, same server-side balance check. Coin balance shown here comes
    // from the shared GamificationService (already fed by a users/{uid}
    // snapshot listener), so a successful redemption updates the same
    // balance shown on CoinBalanceCard and this screen's own header.
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

/// The "My Rewards" entry point into `RedemptionHistoryView` -- iOS
/// equivalent of Android's `RewardsScreen.kt` header pill (`Surface(onClick =
/// onMyRedemptions ...)` with a `Receipt` icon and lime tint at 0.1
/// background / 0.25 border alpha over the lime color). Right-aligned to
/// match Android's placement at the trailing edge of its header row.
private struct MyRewardsPillRow: View {
    let onTap: () -> Void

    var body: some View {
        HStack {
            Spacer()
            Button(action: onTap) {
                HStack(spacing: RuvoTheme.Spacing.xs) {
                    Image(systemName: "doc.text.fill")
                        .font(.system(size: 12))
                    Text("My Rewards")
                        .font(RuvoTheme.Typography.labelSmall)
                        .tracking(RuvoTheme.Typography.Tracking.labelSmall)
                }
                .foregroundColor(RuvoTheme.Colors.primary)
                .padding(.horizontal, RuvoTheme.Spacing.md)
                .padding(.vertical, RuvoTheme.Spacing.sm)
                .background(
                    Capsule()
                        .fill(RuvoTheme.Colors.primary.opacity(0.1))
                        .overlay(
                            Capsule()
                                .stroke(RuvoTheme.Colors.primary.opacity(0.25), lineWidth: 1)
                        )
                )
            }
            .buttonStyle(.plain)
        }
    }
}

/// Balance header shown at the top of the standalone screen -- unlike the
/// sheet-only presentation this replaces, `RewardsView` can now be reached
/// directly from Profile without having passed through `GamificationView`'s
/// own `CoinBalanceCard` first, so the coin balance needs to be visible here
/// too. Reuses the same icon/color language as `CoinBalanceCard`
/// (`GamificationView.swift`) rather than inventing a new visual style for
/// the same balance.
private struct RewardsBalanceHeader: View {
    let coins: Int

    var body: some View {
        RuvoCard(isHighlighted: true) {
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
                        Text("AVAILABLE BALANCE")
                            .font(RuvoTheme.Typography.caption)
                            .tracking(RuvoTheme.Typography.Tracking.caption)
                            .foregroundColor(RuvoTheme.Colors.textSecondary)
                    }
                }
                Spacer()
                Text("Keep running\nto earn more.")
                    .font(RuvoTheme.Typography.bodySmall)
                    .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
                    .multilineTextAlignment(.trailing)
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}

/// Horizontally-scrolling category filter -- the one real feature gap the
/// old sheet had versus Android's `RewardsScreen` (its `CATEGORIES` chip row
/// filtering `REWARD_CATALOG` by `selectedCategory`). Built on the existing
/// `RuvoChip` token wrapped in a plain `Button` rather than a new component,
/// since no tappable-filter-chip pattern exists elsewhere in this codebase
/// yet to reuse.
private struct CategoryChipsRow: View {
    let categories: [String]
    @Binding var selected: String

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: RuvoTheme.Spacing.sm) {
                ForEach(categories, id: \.self) { category in
                    Button(action: { selected = category }) {
                        RuvoChip(label: category, isActive: selected == category)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, RuvoTheme.Spacing.lg)
        }
    }
}

// MARK: – Reward model + catalog

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

    /// Verbatim port of Android's `CATEGORIES` constant (`RewardsScreen.kt`) --
    /// same fixed order, "All" first, rather than deriving/sorting categories
    /// from the catalog at runtime.
    static let categories: [String] = ["All", "Gear", "Wellness", "Nutrition", "Subscription", "Food", "Events"]
}

// MARK: – Reward card

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
