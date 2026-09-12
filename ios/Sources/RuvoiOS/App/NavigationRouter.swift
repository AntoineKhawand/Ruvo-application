import SwiftUI

enum AppRoute: Hashable {
    case home
    case runTracking
    case runSummary(runId: String)
    case analytics
    case personalRecords
    case trainingPlan
    case healthIntegrations
    case shoeTracker
    case intervalTraining
    case community
    case clubDetail(clubId: String)
    case challengeDetail(challengeId: String)
    case aiCoach
    case gamification
    case achievements
    case leaderboard
    case rewards
    case referral
    case search
    case profile(userId: String)
    case settings
    case paywall
    case onboarding
}

enum TabItem: Int, CaseIterable {
    case home = 0
    case run
    case community
    case coach
    case profile

    var icon: String {
        switch self {
        case .home:      return "house.fill"
        case .run:       return "figure.run"
        case .community: return "person.3.fill"
        case .coach:     return "sparkles"
        case .profile:   return "person.fill"
        }
    }

    var label: String {
        switch self {
        case .home:      return "Home"
        case .run:       return "Run"
        case .community: return "Community"
        case .coach:     return "Coach"
        case .profile:   return "Profile"
        }
    }
}

@MainActor
final class NavigationRouter: ObservableObject {
    @Published var selectedTab: TabItem = .home
    @Published var homePath = NavigationPath()
    @Published var communityPath = NavigationPath()
    @Published var profilePath = NavigationPath()
    @Published var presentedSheet: AppRoute?
    @Published var isRunActive = false

    func navigate(to route: AppRoute) {
        switch route {
        case .runTracking:
            isRunActive = true
        case .paywall:
            presentedSheet = .paywall
        case .profile, .achievements, .leaderboard, .rewards, .referral, .search:
            selectedTab = .profile
            profilePath.append(route)
        case .clubDetail, .challengeDetail:
            selectedTab = .community
            communityPath.append(route)
        default:
            homePath.append(route)
        }
    }

    func dismissSheet() {
        presentedSheet = nil
    }
}
