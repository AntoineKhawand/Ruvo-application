import SwiftUI
import FirebaseFirestore

struct OnboardingView: View {
    @EnvironmentObject private var authService: AuthService
    @State private var currentStep = 0
    @State private var selectedGoal: RunningGoal?
    @State private var selectedLevel: FitnessLevel?
    @State private var weeklyTarget: Int = 3
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let steps = ["Goal", "Level", "Schedule", "Ready"]

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Progress dots
                RuvoProgressSteps(totalSteps: steps.count, currentStep: currentStep)
                    .padding(.top, RuvoTheme.Spacing.xl)

                // A plain switch rather than a paging TabView: step 1's card deck
                // owns horizontal swipes, and a page swipe would also let people
                // skip past a step without answering it.
                ZStack(alignment: .top) {
                    switch currentStep {
                    case 0: GoalStep(selected: $selectedGoal)
                    case 1: LevelStep(selected: $selectedLevel)
                    case 2: ScheduleStep(weeklyTarget: $weeklyTarget)
                    default: ReadyStep()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .animation(.easeInOut, value: currentStep)

                // Navigation
                HStack {
                    if currentStep > 0 {
                        RuvoButton(title: "Back", style: .ghost, isFullWidth: false) {
                            withAnimation(RuvoTheme.Motion.easeOut(RuvoTheme.Motion.Duration.entrance)) { currentStep -= 1 }
                        }
                    }

                    Spacer()

                    RuvoButton(
                        title: currentStep == steps.count - 1 ? "Start Running" : "Continue",
                        style: .primary,
                        isLoading: isSaving,
                        isFullWidth: false
                    ) {
                        if currentStep < steps.count - 1 {
                            withAnimation(RuvoTheme.Motion.easeOut(RuvoTheme.Motion.Duration.entrance)) { currentStep += 1 }
                        } else {
                            finishOnboarding()
                        }
                    }
                    .disabled(currentStep == 0 && selectedGoal == nil)
                }
                .padding(.horizontal, RuvoTheme.Spacing.lg)
                .padding(.bottom, RuvoTheme.Spacing.xl)
            }
        }
        .alert("Couldn't Save Your Answers", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("Try Again", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func finishOnboarding() {
        guard let uid = authService.currentUserId else { return }
        isSaving = true
        Task {
            do {
                try await Firestore.firestore().collection("users").document(uid).updateData([
                    "runningGoal": selectedGoal?.rawValue ?? RunningGoal.stayHealthy.rawValue,
                    "fitnessLevel": selectedLevel?.rawValue ?? FitnessLevel.beginner.rawValue,
                    "weeklyRunTarget": weeklyTarget,
                    "onboardingCompleted": true
                ])
                // Only advance past onboarding once the write actually lands --
                // completing locally on a failed write would leave the user stuck
                // authenticated with a profile that still says
                // onboardingCompleted: false, unable to re-enter this screen.
                authService.completeOnboarding()
            } catch {
                errorMessage = error.localizedDescription
            }
            isSaving = false
        }
    }
}

enum RunningGoal: String, CaseIterable {
    case stayHealthy = "stay_healthy"
    case run5k = "run_5k"
    case run10k = "run_10k"
    case halfMarathon = "half_marathon"
    case marathon = "marathon"
    case loseWeight = "lose_weight"

    var title: String {
        switch self {
        case .stayHealthy:   return "Stay Healthy"
        case .run5k:         return "Run a 5K"
        case .run10k:        return "Run a 10K"
        case .halfMarathon:  return "Half Marathon"
        case .marathon:      return "Full Marathon"
        case .loseWeight:    return "Lose Weight"
        }
    }

    var icon: String {
        switch self {
        case .stayHealthy:   return "heart.fill"
        case .run5k:         return "figure.run"
        case .run10k:        return "flag.fill"
        case .halfMarathon:  return "trophy.fill"
        case .marathon:      return "trophy.fill"
        case .loseWeight:    return "scalemass.fill"
        }
    }
}

enum FitnessLevel: String, CaseIterable {
    case beginner     = "beginner"
    case intermediate = "intermediate"
    case advanced     = "advanced"
    case elite        = "elite"

    var title: String { rawValue.capitalized }
    var subtitle: String {
        switch self {
        case .beginner:     return "I rarely run"
        case .intermediate: return "A few times/week"
        case .advanced:     return "Daily runner"
        case .elite:        return "Competitive runner"
        }
    }
}

// MARK: – Step Views
struct LevelStep: View {
    @Binding var selected: FitnessLevel?

    var body: some View {
        VStack(alignment: .leading, spacing: RuvoTheme.Spacing.lg) {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.xs) {
                Text("Your fitness\nlevel?")
                    .font(RuvoTheme.Typography.displayMedium)
                    .tracking(RuvoTheme.Typography.Tracking.displayMedium)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Text("Be honest — we'll calibrate intensity for you.")
                    .font(RuvoTheme.Typography.bodyMedium)
                    .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
            }

            VStack(spacing: RuvoTheme.Spacing.sm) {
                ForEach(FitnessLevel.allCases, id: \.self) { level in
                    LevelRow(level: level, isSelected: selected == level) { selected = level }
                }
            }
            Spacer()
        }
        .padding(.horizontal, RuvoTheme.Spacing.lg)
        .padding(.top, RuvoTheme.Spacing.xl)
    }
}

struct LevelRow: View {
    let level: FitnessLevel
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        RuvoSelectableCard(isSelected: isSelected, action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(level.title)
                        .font(RuvoTheme.Typography.headingSmall)
                        .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                        .foregroundColor(RuvoTheme.Colors.textPrimary)
                    Text(level.subtitle)
                        .font(RuvoTheme.Typography.bodySmall)
                        .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(RuvoTheme.Colors.primary)
                        .font(.title2)
                }
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}

struct ScheduleStep: View {
    @Binding var weeklyTarget: Int

    var body: some View {
        VStack(alignment: .leading, spacing: RuvoTheme.Spacing.lg) {
            Text("How often\ncan you run?")
                .font(RuvoTheme.Typography.displayMedium)
                .tracking(RuvoTheme.Typography.Tracking.displayMedium)
                .foregroundColor(RuvoTheme.Colors.textPrimary)

            RuvoCard {
                VStack(spacing: RuvoTheme.Spacing.lg) {
                    Text("\(weeklyTarget)")
                        .font(RuvoTheme.Typography.statNumber)
                        .tracking(RuvoTheme.Typography.Tracking.statNumber)
                        .foregroundColor(RuvoTheme.Colors.primary)
                    Text("days per week")
                        .font(RuvoTheme.Typography.bodyMedium)
                        .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                    Slider(value: Binding(
                        get: { Double(weeklyTarget) },
                        set: { weeklyTarget = Int($0) }
                    ), in: 1...7, step: 1)
                    .accentColor(RuvoTheme.Colors.primary)
                }
                .padding(RuvoTheme.Spacing.xl)
                .frame(maxWidth: .infinity)
            }
            Spacer()
        }
        .padding(.horizontal, RuvoTheme.Spacing.lg)
        .padding(.top, RuvoTheme.Spacing.xl)
    }
}

struct ReadyStep: View {
    // Drives the one deliberately celebratory beat in onboarding: the badge
    // scales/fades in on appear instead of sitting there static. Matches
    // Android's central Ready badge treatment.
    @State private var badgeAppeared = false

    var body: some View {
        VStack(spacing: RuvoTheme.Spacing.lg) {
            Spacer()
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 80))
                .foregroundColor(RuvoTheme.Colors.primary)
                .frame(width: 160, height: 160)
                .background(
                    Circle()
                        .fill(RuvoTheme.Colors.glassSurface)
                        .shadow(color: RuvoTheme.Shadow.primaryGlow, radius: 30, x: 0, y: 0)
                )
                .scaleEffect(badgeAppeared ? 1 : 0.7)
                .opacity(badgeAppeared ? 1 : 0)
                .onAppear {
                    withAnimation(RuvoTheme.Motion.springBouncy()) {
                        badgeAppeared = true
                    }
                }
            Text("You're All Set!")
                .font(RuvoTheme.Typography.displayMedium)
                .tracking(RuvoTheme.Typography.Tracking.displayMedium)
                .foregroundColor(RuvoTheme.Colors.textPrimary)
            Text("Your personalized training plan is ready.\nLet's start your first run.")
                .font(RuvoTheme.Typography.bodyLarge)
                .tracking(RuvoTheme.Typography.Tracking.bodyLarge)
                .foregroundColor(RuvoTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding(RuvoTheme.Spacing.lg)
    }
}
