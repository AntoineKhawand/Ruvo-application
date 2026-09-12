package com.ruvo.app.core.model

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.MonitorWeight
import androidx.compose.ui.graphics.vector.ImageVector

// Shared with OnboardingScreen.kt's own goal/fitness-level steps (previously
// declared private there) so EditProfileSheet (ProfileScreen.kt) can offer
// the exact same options when editing these fields post-signup, instead of
// inventing a second, possibly-inconsistent set of labels/values. The enum
// constant `.name` (e.g. "RUN_5K", "BEGINNER") is what's actually written to
// Firestore's `runningGoal`/`fitnessLevel` fields — see AuthViewModel.
//
// `emoji` stays as-is for existing emoji-as-accent call sites (ProfileScreen's
// goal picker). `icon` is a parallel Material-icon mapping for OnboardingScreen's
// GoalStep cards, which moved from emoji to functional icons -- kept as a
// property here (not a second local map in OnboardingScreen.kt) so the two
// representations can't drift apart.
enum class RunningGoal(val label: String, val emoji: String, val icon: ImageVector) {
    STAY_HEALTHY("Stay Healthy", "💪", Icons.Filled.Favorite),
    RUN_5K("Run 5K", "🏃", Icons.AutoMirrored.Filled.DirectionsRun),
    RUN_10K("Run 10K", "🔥", Icons.Filled.Flag),
    HALF_MARATHON("Half Marathon", "⚡", Icons.Filled.Bolt),
    MARATHON("Full Marathon", "🏆", Icons.Filled.EmojiEvents),
    LOSE_WEIGHT("Lose Weight", "🎯", Icons.Filled.MonitorWeight),
}

enum class FitnessLevel(val label: String, val description: String) {
    BEGINNER("Beginner", "Just starting out"),
    INTERMEDIATE("Intermediate", "Running 1-3x per week"),
    ADVANCED("Advanced", "Running 4+ times per week"),
    ELITE("Elite", "Competitive runner"),
}
