package com.ruvo.app.features.auth

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*

private enum class RunningGoal(val label: String, val emoji: String) {
    STAY_HEALTHY("Stay Healthy", "💪"),
    RUN_5K("Run 5K", "🏃"),
    RUN_10K("Run 10K", "🔥"),
    HALF_MARATHON("Half Marathon", "⚡"),
    MARATHON("Full Marathon", "🏆"),
    LOSE_WEIGHT("Lose Weight", "🎯"),
}

private enum class FitnessLevel(val label: String, val description: String) {
    BEGINNER("Beginner", "Just starting out"),
    INTERMEDIATE("Intermediate", "Running 1-3x per week"),
    ADVANCED("Advanced", "Running 4+ times per week"),
    ELITE("Elite", "Competitive runner"),
}

@Composable
fun OnboardingScreen(onComplete: () -> Unit, viewModel: AuthViewModel = hiltViewModel()) {
    var step by remember { mutableIntStateOf(0) }
    var selectedGoal by remember { mutableStateOf<RunningGoal?>(null) }
    var selectedLevel by remember { mutableStateOf<FitnessLevel?>(null) }
    var weeklyDays by remember { mutableFloatStateOf(3f) }

    Box(modifier = Modifier.fillMaxSize().background(RuvoColors.background)) {
        Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
            // Progress dots
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                repeat(4) { i ->
                    Box(
                        modifier = Modifier
                            .padding(horizontal = 4.dp)
                            .size(if (i == step) 24.dp else 8.dp, 8.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(if (i <= step) RuvoColors.lime else RuvoColors.border)
                    )
                }
            }
            Spacer(modifier = Modifier.height(32.dp))

            AnimatedContent(
                targetState = step,
                transitionSpec = {
                    slideInHorizontally { it } + fadeIn() togetherWith slideOutHorizontally { -it } + fadeOut()
                },
                label = "onboarding_step"
            ) { currentStep ->
                when (currentStep) {
                    0 -> GoalStep(selectedGoal = selectedGoal, onSelect = { selectedGoal = it })
                    1 -> LevelStep(selectedLevel = selectedLevel, onSelect = { selectedLevel = it })
                    2 -> ScheduleStep(days = weeklyDays, onDaysChange = { weeklyDays = it })
                    3 -> ReadyStep()
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Navigation buttons
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (step > 0) {
                    RuvoButton(
                        text = "Back",
                        onClick = { step-- },
                        style = RuvoButtonVariant.Secondary,
                        modifier = Modifier.weight(1f)
                    )
                }
                val canProceed = when (step) {
                    0 -> selectedGoal != null
                    1 -> selectedLevel != null
                    else -> true
                }
                RuvoButton(
                    text = if (step == 3) "Let's Go!" else "Continue",
                    onClick = {
                        if (step < 3) step++
                        else {
                            viewModel.completeOnboarding(
                                goal = selectedGoal?.name ?: RunningGoal.STAY_HEALTHY.name,
                                level = selectedLevel?.name ?: FitnessLevel.BEGINNER.name,
                                weeklyDays = weeklyDays.toInt(),
                            )
                            onComplete()
                        }
                    },
                    style = RuvoButtonVariant.Primary,
                    modifier = Modifier.weight(1f),
                    enabled = canProceed,
                )
            }
        }
    }
}

@Composable
private fun GoalStep(selectedGoal: RunningGoal?, onSelect: (RunningGoal) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column {
            Text("What's your goal?", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)
            Text("We'll personalize your training plan", style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary)
        }
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            RunningGoal.entries.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    row.forEach { goal ->
                        val isSelected = goal == selectedGoal
                        Surface(
                            onClick = { onSelect(goal) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(16.dp),
                            color = if (isSelected) RuvoColors.limeDim else RuvoColors.surface,
                            border = BorderStroke(if (isSelected) 2.dp else 1.dp, if (isSelected) RuvoColors.lime else RuvoColors.border),
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(goal.emoji, style = MaterialTheme.typography.headlineMedium)
                                Text(goal.label, style = MaterialTheme.typography.labelLarge, color = if (isSelected) RuvoColors.lime else RuvoColors.textPrimary)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LevelStep(selectedLevel: FitnessLevel?, onSelect: (FitnessLevel) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column {
            Text("Your fitness level?", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)
            Text("Be honest — we'll calibrate from there", style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary)
        }
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            FitnessLevel.entries.forEach { level ->
                val isSelected = level == selectedLevel
                Surface(
                    onClick = { onSelect(level) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    color = if (isSelected) RuvoColors.limeDim else RuvoColors.surface,
                    border = BorderStroke(if (isSelected) 2.dp else 1.dp, if (isSelected) RuvoColors.lime else RuvoColors.border),
                ) {
                    Row(
                        modifier = Modifier.padding(20.dp).fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(level.label, style = MaterialTheme.typography.titleMedium, color = if (isSelected) RuvoColors.lime else RuvoColors.textPrimary)
                            Text(level.description, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                        }
                        if (isSelected) {
                            Box(
                                modifier = Modifier.size(24.dp).clip(CircleShape).background(RuvoColors.lime),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("✓", style = MaterialTheme.typography.labelLarge, color = Color.Black)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ScheduleStep(days: Float, onDaysChange: (Float) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Column {
            Text("Weekly schedule?", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)
            Text("How many days per week can you run?", style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary)
        }
        Box(
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(RuvoColors.surface).padding(32.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("${days.toInt()}", style = MaterialTheme.typography.displayLarge, color = RuvoColors.lime)
                Text("days per week", style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary)
                Slider(
                    value = days,
                    onValueChange = onDaysChange,
                    valueRange = 1f..7f,
                    steps = 5,
                    colors = SliderDefaults.colors(thumbColor = RuvoColors.lime, activeTrackColor = RuvoColors.lime),
                    modifier = Modifier.fillMaxWidth()
                )
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("1", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                    Text("7", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                }
            }
        }
    }
}

@Composable
private fun ReadyStep() {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Box(
            modifier = Modifier.size(120.dp).clip(CircleShape).background(RuvoColors.limeDim),
            contentAlignment = Alignment.Center
        ) {
            Text("🏃", style = MaterialTheme.typography.displayLarge)
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("You're all set!", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary, textAlign = TextAlign.Center)
            Text(
                "Your personalized plan is ready. Let's start crushing those goals — one run at a time.",
                style = MaterialTheme.typography.bodyLarge,
                color = RuvoColors.textSecondary,
                textAlign = TextAlign.Center,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ReadyBadge("🔥", "Streak\nTracking")
            ReadyBadge("🤖", "AI\nCoach")
            ReadyBadge("🏆", "Challenges")
        }
    }
}

@Composable
private fun ReadyBadge(emoji: String, label: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(RuvoColors.surface).padding(12.dp)
    ) {
        Text(emoji, style = MaterialTheme.typography.headlineMedium)
        Text(label, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary, textAlign = TextAlign.Center)
    }
}
