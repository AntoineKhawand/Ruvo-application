import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var router: NavigationRouter
    @State private var showRunSheet = false

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $router.selectedTab) {
                HomeTab()
                    .tag(TabItem.home)

                // Run tab triggers active tracking, not a normal nav stack
                Color.clear
                    .tag(TabItem.run)

                CommunityTab()
                    .tag(TabItem.community)

                AICoachTab()
                    .tag(TabItem.coach)

                ProfileTab()
                    .tag(TabItem.profile)
            }
            .accentColor(RuvoTheme.Colors.primary)

            RuvoTabBar(selected: $router.selectedTab) {
                showRunSheet = true
            }
        }
        .fullScreenCover(isPresented: $router.isRunActive) {
            RunTrackingView()
        }
        .sheet(item: $router.presentedSheet) { route in
            switch route {
            case .paywall:
                PaywallView()
            default:
                EmptyView()
            }
        }
        .onChange(of: router.selectedTab) { tab in
            if tab == .run {
                router.selectedTab = .home
                router.isRunActive = true
            }
        }
    }
}

struct HomeTab: View {
    @EnvironmentObject private var router: NavigationRouter

    var body: some View {
        NavigationStack(path: $router.homePath) {
            HomeView()
                .navigationDestination(for: AppRoute.self) { route in
                    destinationView(for: route)
                }
        }
    }

    @ViewBuilder
    private func destinationView(for route: AppRoute) -> some View {
        switch route {
        case .analytics:           AnalyticsDashboardView()
        case .personalRecords:     PersonalRecordsView()
        case .trainingPlan:        TrainingPlanView()
        case .healthIntegrations:  HealthIntegrationsView()
        case .shoeTracker:         ShoeTrackerView()
        case .intervalTraining:    IntervalTrainingView()
        case .runSummary(let id):  RunSummaryView(runId: id)
        case .gamification:        GamificationView()
        case .achievements:        AchievementsView()
        case .tips:                TipsView()
        case .tipDetail(let id):   TipDetailView(tipId: id)
        default:                   EmptyView()
        }
    }
}

struct CommunityTab: View {
    @EnvironmentObject private var router: NavigationRouter

    var body: some View {
        NavigationStack(path: $router.communityPath) {
            CommunityFeedView()
                .navigationDestination(for: AppRoute.self) { route in
                    switch route {
                    case .clubDetail(let id):       ClubDetailView(clubId: id)
                    case .challengeDetail(let id):  ChallengeDetailView(challengeId: id)
                    default:                        EmptyView()
                    }
                }
        }
    }
}

struct AICoachTab: View {
    var body: some View {
        NavigationStack {
            AICoachView()
        }
    }
}

struct ProfileTab: View {
    @EnvironmentObject private var router: NavigationRouter
    @EnvironmentObject private var authService: AuthService

    var body: some View {
        NavigationStack(path: $router.profilePath) {
            ProfileView(userId: authService.currentUserId ?? "")
                .navigationDestination(for: AppRoute.self) { route in
                    switch route {
                    case .profile(let id): ProfileView(userId: id)
                    case .achievements:     AchievementsView()
                    case .leaderboard:      LeaderboardView()
                    case .rewards:          RewardsView()
                    case .redemptionHistory: RedemptionHistoryView()
                    case .referral:         ReferralView()
                    case .search:           SearchView()
                    default:                EmptyView()
                    }
                }
        }
    }
}
