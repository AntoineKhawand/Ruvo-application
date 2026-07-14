import SwiftUI

struct RootView: View {
    @EnvironmentObject private var authService: AuthService
    @EnvironmentObject private var router: NavigationRouter

    var body: some View {
        Group {
            switch authService.state {
            case .loading:
                SplashView()
            case .unauthenticated:
                AuthRootView()
            case .authenticated:
                MainTabView()
            case .onboarding:
                OnboardingView()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: authService.state)
    }
}

struct SplashView: View {
    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()
            VStack(spacing: 16) {
                Image("ruvo-logo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 80, height: 80)
                Text("RUVO")
                    .font(RuvoTheme.Typography.displayLarge)
                    .foregroundColor(RuvoTheme.Colors.primary)
            }
        }
    }
}
