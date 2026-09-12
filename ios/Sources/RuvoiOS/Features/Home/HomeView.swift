import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var authService: AuthService
    @EnvironmentObject private var gamificationService: GamificationService
    @EnvironmentObject private var router: NavigationRouter
    @State private var showQuickStart = false

    var body: some View {
        ScrollView {
            LazyVStack(spacing: RuvoTheme.Spacing.md) {
                // Greeting
                GreetingHeader(user: authService.currentUser)
                    .padding(.horizontal, RuvoTheme.Spacing.lg)

                // Quick start run button
                QuickStartCard {
                    router.isRunActive = true
                }
                .padding(.horizontal, RuvoTheme.Spacing.lg)

                // Streak + XP
                if let user = authService.currentUser {
                    HStack(spacing: RuvoTheme.Spacing.sm) {
                        MiniStatCard(
                            icon: "flame.fill", label: "Day Streak",
                            value: "\(user.streakDays)", color: .orange
                        )
                        MiniStatCard(
                            icon: "bolt.fill", label: "XP Today",
                            value: "+\(gamificationService.todayXP)", color: RuvoTheme.Colors.primary
                        )
                        MiniStatCard(
                            icon: "dollarsign.circle.fill", label: "Coins",
                            value: "\(gamificationService.coins)", color: RuvoTheme.Colors.coinGold
                        )
                    }
                    .padding(.horizontal, RuvoTheme.Spacing.lg)
                }

                // Weather-aware run advice
                WeatherWidget()
                    .padding(.horizontal, RuvoTheme.Spacing.lg)

                // Today's training
                TodaysTrainingSection()
                    .padding(.horizontal, RuvoTheme.Spacing.lg)

                // Recent activity preview
                RecentActivitySection()
                    .padding(.horizontal, RuvoTheme.Spacing.lg)
            }
            .padding(.vertical, RuvoTheme.Spacing.lg)
        }
        .background(RuvoTheme.Colors.background.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                RuvoIconButton(icon: "bell") {}
            }
        }
    }
}

struct GreetingHeader: View {
    let user: RuvoUser?

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return "Good Morning"
        case 12..<17: return "Good Afternoon"
        default: return "Good Evening"
        }
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(greeting + ",")
                    .font(RuvoTheme.Typography.bodyLarge)
                    .tracking(RuvoTheme.Typography.Tracking.bodyLarge)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
                Text(user?.displayName.components(separatedBy: " ").first ?? "Runner")
                    .font(RuvoTheme.Typography.displayMedium)
                    .tracking(RuvoTheme.Typography.Tracking.displayMedium)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
            }
            Spacer()
            AsyncImage(url: URL(string: user?.avatarUrl ?? "")) { img in
                img.resizable().scaledToFill()
            } placeholder: {
                Circle().fill(RuvoTheme.Colors.surfaceElevated)
            }
            .frame(width: 48, height: 48)
            .clipShape(Circle())
            .overlay(Circle().stroke(RuvoTheme.Colors.primary, lineWidth: 2))
        }
    }
}

struct QuickStartCard: View {
    let onStart: () -> Void

    var body: some View {
        Button(action: onStart) {
            RuvoCard(isHighlighted: true) {
                HStack {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Start a Run")
                            .font(RuvoTheme.Typography.headingLarge)
                            .tracking(RuvoTheme.Typography.Tracking.headingLarge)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                        Text("Tap to begin tracking your run with GPS")
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textSecondary)
                    }
                    Spacer()
                    ZStack {
                        Circle()
                            .fill(LinearGradient(
                                colors: [RuvoTheme.Colors.primary, Color(hex: "#A8CC00")],
                                startPoint: .topLeading, endPoint: .bottomTrailing
                            ))
                            .frame(width: 60, height: 60)
                            .shadow(color: RuvoTheme.Colors.primary.opacity(0.4), radius: 12)
                        Image(systemName: "figure.run")
                            .font(.system(size: 24, weight: .bold))
                            .foregroundColor(.black)
                    }
                }
                .padding(RuvoTheme.Spacing.lg)
            }
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

struct MiniStatCard: View {
    let icon: String
    let label: String
    let value: String
    let color: Color

    var body: some View {
        RuvoCard {
            VStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 22)).foregroundColor(color)
                Text(value)
                    .font(RuvoTheme.Typography.headingMedium)
                    .tracking(RuvoTheme.Typography.Tracking.headingMedium)
                    .foregroundColor(color)
                Text(label)
                    .font(RuvoTheme.Typography.caption)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
                    .tracking(RuvoTheme.Typography.Tracking.caption)
            }
            .padding(RuvoTheme.Spacing.sm)
            .frame(maxWidth: .infinity)
        }
    }
}

struct TodaysTrainingSection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
            HStack {
                Text("Today's Training")
                    .font(RuvoTheme.Typography.headingSmall)
                    .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Spacer()
                Button("View Plan") {}
                    .font(RuvoTheme.Typography.labelSmall)
                    .tracking(RuvoTheme.Typography.Tracking.labelSmall)
                    .foregroundColor(RuvoTheme.Colors.primary)
            }

            RuvoCard {
                HStack(spacing: RuvoTheme.Spacing.md) {
                    ZStack {
                        Circle()
                            .fill(RuvoTheme.Colors.primaryDim)
                            .frame(width: 48, height: 48)
                        Text("5K").font(RuvoTheme.Typography.labelLarge).tracking(RuvoTheme.Typography.Tracking.labelLarge).foregroundColor(RuvoTheme.Colors.primary)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Easy 5K Run")
                            .font(RuvoTheme.Typography.headingSmall)
                            .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                        Text("Target: 5:30-6:00/km · ~30 min")
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textSecondary)
                    }
                    Spacer()
                    RuvoChip(label: "Active", isActive: true)
                }
                .padding(RuvoTheme.Spacing.md)
            }
        }
    }
}

struct RecentActivitySection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
            HStack {
                Text("Recent Activity")
                    .font(RuvoTheme.Typography.headingSmall)
                    .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Spacer()
                NavigationLink("See All", value: AppRoute.analytics)
                    .font(RuvoTheme.Typography.labelSmall)
                    .tracking(RuvoTheme.Typography.Tracking.labelSmall)
                    .foregroundColor(RuvoTheme.Colors.primary)
            }
            // Placeholder — populated from analyticsService
            RuvoCard {
                VStack(alignment: .center, spacing: 12) {
                    Image(systemName: "figure.run")
                        .font(.system(size: 32))
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                    Text("No runs yet — start your first run!")
                        .font(RuvoTheme.Typography.bodyMedium)
                        .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(RuvoTheme.Spacing.xl)
                .frame(maxWidth: .infinity)
            }
        }
    }
}
