import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject private var authService: AuthService
    @State private var currentStep = 0
    @State private var selectedGoal: RunningGoal?
    @State private var selectedLevel: FitnessLevel?
    @State private var weeklyTarget: Int = 3
    @State private var isSaving = false

    private let steps = ["Goal", "Level", "Schedule", "Ready"]

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Progress dots
                HStack(spacing: 8) {
                    ForEach(0..<steps.count, id: \.self) { i in
                        Capsule()
                            .fill(i <= currentStep ? RuvoTheme.Colors.primary : RuvoTheme.Colors.border)
                            .frame(width: i == currentStep ? 24 : 8, height: 8)
                            .animation(.spring(), value: currentStep)
                    }
                }
                .padding(.top, RuvoTheme.Spacing.xl)

                TabView(selection: $currentStep) {
                    GoalStep(selected: $selectedGoal).tag(0)
                    LevelStep(selected: $selectedLevel).tag(1)
                    ScheduleStep(weeklyTarget: $weeklyTarget).tag(2)
                    ReadyStep().tag(3)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut, value: currentStep)

                // Navigation
                HStack {
                    if currentStep > 0 {
                        RuvoButton(title: "Back", style: .ghost, isFullWidth: false) {
                            withAnimation { currentStep -= 1 }
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
                            withAnimation { currentStep += 1 }
                        } else {
                            finishOnboarding()
                        }
                    }
                }
                .padding(.horizontal, RuvoTheme.Spacing.lg)
                .padding(.bottom, RuvoTheme.Spacing.xl)
            }
        }
    }

    private func finishOnboarding() {
        guard let uid = authService.currentUserId else { return }
        isSaving = true
        Task {
            try? await Firestore.firestore().collection("users").document(uid).updateData([
                "runningGoal": selectedGoal?.rawValue ?? RunningGoal.stayHealthy.rawValue,
                "fitnessLevel": selectedLevel?.rawValue ?? FitnessLevel.beginner.rawValue,
                "weeklyRunTarget": weeklyTarget,
                "onboardingCompleted": true
            ])
            authService.state = .authenticated
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
        case .marathon:      return "star.fill"
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
struct GoalStep: View {
    @Binding var selected: RunningGoal?

    var body: some View {
        VStack(alignment: .leading, spacing: RuvoTheme.Spacing.lg) {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.xs) {
                Text("What's your\nmain goal?")
                    .font(RuvoTheme.Typography.displayMedium)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Text("We'll personalize your training plan.")
                    .font(RuvoTheme.Typography.bodyMedium)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: RuvoTheme.Spacing.sm) {
                ForEach(RunningGoal.allCases, id: \.self) { goal in
                    GoalCard(goal: goal, isSelected: selected == goal) {
                        selected = goal
                    }
                }
            }
            Spacer()
        }
        .padding(.horizontal, RuvoTheme.Spacing.lg)
        .padding(.top, RuvoTheme.Spacing.xl)
    }
}

struct GoalCard: View {
    let goal: RunningGoal
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            RuvoCard(isHighlighted: isSelected) {
                VStack(spacing: RuvoTheme.Spacing.sm) {
                    Image(systemName: goal.icon)
                        .font(.system(size: 28))
                        .foregroundColor(isSelected ? .black : RuvoTheme.Colors.primary)
                        .frame(width: 52, height: 52)
                        .background(isSelected ? RuvoTheme.Colors.primary : RuvoTheme.Colors.primaryDim)
                        .clipShape(Circle())
                    Text(goal.title)
                        .font(RuvoTheme.Typography.labelLarge)
                        .foregroundColor(RuvoTheme.Colors.textPrimary)
                        .multilineTextAlignment(.center)
                }
                .padding(RuvoTheme.Spacing.md)
                .frame(maxWidth: .infinity)
            }
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

struct LevelStep: View {
    @Binding var selected: FitnessLevel?

    var body: some View {
        VStack(alignment: .leading, spacing: RuvoTheme.Spacing.lg) {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.xs) {
                Text("Your fitness\nlevel?")
                    .font(RuvoTheme.Typography.displayMedium)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Text("Be honest — we'll calibrate intensity for you.")
                    .font(RuvoTheme.Typography.bodyMedium)
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
        Button(action: action) {
            RuvoCard(isHighlighted: isSelected) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(level.title).font(RuvoTheme.Typography.headingSmall).foregroundColor(RuvoTheme.Colors.textPrimary)
                        Text(level.subtitle).font(RuvoTheme.Typography.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
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
        .buttonStyle(ScaleButtonStyle())
    }
}

struct ScheduleStep: View {
    @Binding var weeklyTarget: Int

    var body: some View {
        VStack(alignment: .leading, spacing: RuvoTheme.Spacing.lg) {
            Text("How often\ncan you run?")
                .font(RuvoTheme.Typography.displayMedium)
                .foregroundColor(RuvoTheme.Colors.textPrimary)

            RuvoCard {
                VStack(spacing: RuvoTheme.Spacing.lg) {
                    Text("\(weeklyTarget)")
                        .font(RuvoTheme.Typography.statNumber)
                        .foregroundColor(RuvoTheme.Colors.primary)
                    Text("days per week")
                        .font(RuvoTheme.Typography.bodyMedium)
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
    var body: some View {
        VStack(spacing: RuvoTheme.Spacing.lg) {
            Spacer()
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 80))
                .foregroundColor(RuvoTheme.Colors.primary)
            Text("You're All Set!")
                .font(RuvoTheme.Typography.displayMedium)
                .foregroundColor(RuvoTheme.Colors.textPrimary)
            Text("Your personalized training plan is ready.\nLet's start your first run.")
                .font(RuvoTheme.Typography.bodyLarge)
                .foregroundColor(RuvoTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding(RuvoTheme.Spacing.lg)
    }
}
