package com.ruvo.app.core.model

// Shared with OnboardingScreen.kt's own goal/fitness-level steps (previously
// declared private there) so EditProfileSheet (ProfileScreen.kt) can offer
// the exact same options when editing these fields post-signup, instead of
// inventing a second, possibly-inconsistent set of labels/values. The enum
// constant `.name` (e.g. "RUN_5K", "BEGINNER") is what's actually written to
// Firestore's `runningGoal`/`fitnessLevel` fields — see AuthViewModel.
enum class RunningGoal(val label: String, val emoji: String) {
    STAY_HEALTHY("Stay Healthy", "💪"),
    RUN_5K("Run 5K", "🏃"),
    RUN_10K("Run 10K", "🔥"),
    HALF_MARATHON("Half Marathon", "⚡"),
    MARATHON("Full Marathon", "🏆"),
    LOSE_WEIGHT("Lose Weight", "🎯"),
}

enum class FitnessLevel(val label: String, val description: String) {
    BEGINNER("Beginner", "Just starting out"),
    INTERMEDIATE("Intermediate", "Running 1-3x per week"),
    ADVANCED("Advanced", "Running 4+ times per week"),
    ELITE("Elite", "Competitive runner"),
}
