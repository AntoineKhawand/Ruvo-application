import SwiftUI
import FirebaseFirestore

struct OnboardingView: View {
    @EnvironmentObject private var authService: AuthService
    @State private var currentStep = 0
    @State private var selectedGoal: RunningGoal?
    @State private var selectedLevel: FitnessLevel?
    @State private var weeklyTarget: Int = 3
    @State private var heartLoader = HeartPreloader()
    @StateObject private var bio = BioState()
    @State private var bioNudge = 0
    @State private var ctaPulse: CGFloat = 1
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let steps = ["Goal", "Level", "About you", "Schedule", "Ready"]

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Progress dots
                RuvoProgressSteps(totalSteps: steps.count, currentStep: currentStep, partialActive: currentStep == 2 && bio.page == 0)
                    .padding(.top, RuvoTheme.Spacing.xl)

                // A plain switch rather than a paging TabView: step 1's card deck
                // owns horizontal swipes, and a page swipe would also let people
                // skip past a step without answering it.
                ZStack(alignment: .top) {
                    switch currentStep {
                    case 0: GoalStep(selected: $selectedGoal)
                    case 1: LevelStep(selected: $selectedLevel, heartLoader: heartLoader)
                    case 2: BioStep(state: bio, nudge: bioNudge)
                    case 3: ScheduleStep(weeklyTarget: $weeklyTarget)
                    default: ReadyStep()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .animation(.easeInOut, value: currentStep)

                // Navigation
                HStack {
                    if currentStep > 0 {
                        RuvoButton(title: "Back", style: .ghost, isFullWidth: false) {
                            withAnimation(RuvoTheme.Motion.easeOut(RuvoTheme.Motion.Duration.entrance)) {
                                if currentStep == 2 && bio.page == 1 { bio.page = 0 } else { currentStep -= 1 }
                            }
                        }
                    }

                    Spacer()

                    RuvoButton(
                        title: currentStep == steps.count - 1 ? "Start Running" : "Continue",
                        style: .primary,
                        isLoading: isSaving,
                        isFullWidth: false
                    ) {
                        if currentStep == 2 && bio.page == 0 {
                            bio.page = 1
                        } else if currentStep == 2 && !bio.valid {
                            bioNudge += 1                                   // page 2 needs both rulers set
                        } else if currentStep < steps.count - 1 {
                            withAnimation(RuvoTheme.Motion.easeOut(RuvoTheme.Motion.Duration.entrance)) { currentStep += 1 }
                        } else {
                            finishOnboarding()
                        }
                    }
                    .disabled(currentStep == 0 && selectedGoal == nil)
                    // Page 2 of step 3 stays dimmed until both are set; it is still tappable so it can nudge.
                    .opacity(currentStep == 2 && bio.page == 1 && !bio.valid ? 0.45 : 1)
                    .scaleEffect(ctaPulse)
                    .onChange(of: bio.valid) { valid in                     // small "you're ready" pulse
                        guard valid else { return }
                        withAnimation(.easeOut(duration: 0.2)) { ctaPulse = 1.045 }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { withAnimation(.easeOut(duration: 0.45)) { ctaPulse = 1 } }
                    }
                }
                .padding(.horizontal, RuvoTheme.Spacing.lg)
                .padding(.bottom, RuvoTheme.Spacing.xl)
            }
        }
        .onAppear {
            // Load the 3D heart for step 2 while the user is still on step 1, so it is ready
            // the moment step 2 opens. Waits a beat so it never competes with the first screen.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
                heartLoader.load(reduceMotion: UIAccessibility.isReduceMotionEnabled)
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
                var fields: [String: Any] = [
                    "runningGoal": selectedGoal?.rawValue ?? RunningGoal.stayHealthy.rawValue,
                    "fitnessLevel": selectedLevel?.rawValue ?? FitnessLevel.beginner.rawValue,
                    "weeklyRunTarget": weeklyTarget,
                    "gender": bio.gender,
                    "dob": bio.dob.iso,
                    "unitSystem": bio.unit,
                    "onboardingCompleted": true
                ]
                // Always kg and cm, whatever unit the user was shown; only what they actually set.
                if bio.weightSet { fields["weight"] = (bio.kg * 10).rounded() / 10 }
                if bio.heightSet { fields["height"] = bio.cm.rounded() }
                try await Firestore.firestore().collection("users").document(uid).updateData(fields)
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
