package com.ruvo.app.features.auth

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.ruvo.app.core.model.FitnessLevel
import com.ruvo.app.core.model.RunningGoal
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*

// RN_SOURCE_ARCHIVE.md §7's OnboardingScreen is TOTAL_STEPS = 6: Goal, Fitness
// level, Bio+Units, Frequency, Training days+time, Permissions+account. The
// last two of those (real Location/Notifications permission requests +
// actual notification scheduling) aren't ported here — that's real platform
// integration work, not a data-model gap, and is tracked separately; this
// pass closes the two steps that were previously skipped entirely (Bio,
// Frequency), collecting real fields (gender/dob/weight/height/unitSystem/
// runFrequency) that otherwise had no path to ever be set anywhere in the
// app — e.g. AnalyticsViewModel's VO2/HR-zone math has always fallen back to
// age 30 specifically because dob was never collected.
private const val TOTAL_STEPS = 6

@Composable
fun OnboardingScreen(onComplete: () -> Unit, viewModel: AuthViewModel = hiltViewModel()) {
    var step by remember { mutableIntStateOf(0) }
    var selectedGoal by remember { mutableStateOf<RunningGoal?>(null) }
    var selectedLevel by remember { mutableStateOf<FitnessLevel?>(null) }
    var gender by remember { mutableStateOf("Male") }
    // Screen-local default (2000-01-01) per archive §7 step 3 — distinct from
    // DEFAULT_USER_DATA's own fallback (1990-01-01), which only applies if a
    // user's doc predates this step entirely (never went through it).
    var dobMillis by remember { mutableStateOf(946684800000L) }
    var weightText by remember { mutableStateOf("") }
    var heightText by remember { mutableStateOf("") }
    var unitSystem by remember { mutableStateOf("metric") }
    var runFrequency by remember { mutableIntStateOf(3) }
    var weeklyDays by remember { mutableFloatStateOf(3f) }

    Box(modifier = Modifier.fillMaxSize().background(RuvoColors.background)) {
        Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
            // Progress dots
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                repeat(TOTAL_STEPS) { i ->
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
                    2 -> BioStep(
                        gender = gender, onGenderChange = { gender = it },
                        dobMillis = dobMillis, onDobChange = { dobMillis = it },
                        weightText = weightText, onWeightChange = { weightText = it },
                        heightText = heightText, onHeightChange = { heightText = it },
                        unitSystem = unitSystem, onUnitSystemChange = { unitSystem = it },
                    )
                    3 -> FrequencyStep(frequency = runFrequency, onSelect = { runFrequency = it })
                    4 -> ScheduleStep(days = weeklyDays, onDaysChange = { weeklyDays = it })
                    5 -> ReadyStep()
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
                    // Archive: "Continue requires name/weight/height non-empty" —
                    // name is skipped (already collected at sign-up, see the
                    // account-first-vs-guest-onboarding note elsewhere in this doc).
                    2 -> weightText.isNotBlank() && heightText.isNotBlank()
                    else -> true
                }
                RuvoButton(
                    text = if (step == TOTAL_STEPS - 1) "Let's Go!" else "Continue",
                    onClick = {
                        if (step < TOTAL_STEPS - 1) step++
                        else {
                            viewModel.completeOnboarding(
                                goal = selectedGoal?.name ?: RunningGoal.STAY_HEALTHY.name,
                                level = selectedLevel?.name ?: FitnessLevel.BEGINNER.name,
                                weeklyDays = weeklyDays.toInt(),
                                gender = gender,
                                dob = java.time.Instant.ofEpochMilli(dobMillis).atZone(java.time.ZoneOffset.UTC).toLocalDate().toString(),
                                // Archive's own documented RN quirk: the unit toggle
                                // changes displayed labels only, raw typed numbers are
                                // never actually converted between kg/lb or cm/in —
                                // ported as-is, not "fixed" into real unit conversion.
                                weight = weightText.toDoubleOrNull() ?: 70.0,
                                height = heightText.toDoubleOrNull() ?: 175.0,
                                unitSystem = unitSystem,
                                runFrequency = runFrequency,
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

private val GENDERS = listOf("Male", "Female", "Other")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BioStep(
    gender: String, onGenderChange: (String) -> Unit,
    dobMillis: Long, onDobChange: (Long) -> Unit,
    weightText: String, onWeightChange: (String) -> Unit,
    heightText: String, onHeightChange: (String) -> Unit,
    unitSystem: String, onUnitSystemChange: (String) -> Unit,
) {
    var showDatePicker by remember { mutableStateOf(false) }
    val dobLabel = remember(dobMillis) {
        java.time.Instant.ofEpochMilli(dobMillis).atZone(java.time.ZoneOffset.UTC).toLocalDate()
            .format(java.time.format.DateTimeFormatter.ofPattern("MMM d, yyyy"))
    }
    val isMetric = unitSystem == "metric"

    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column {
            Text("Tell us about you", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)
            Text("Helps us tune your training accurately", style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary)
        }

        // Units toggle — RN's Bio step bundles this in with the same step
        // (archive §7 step 3: "Bio + Units"), not its own step.
        Row(
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(RuvoColors.surface).padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            listOf("metric" to "Metric (kg/cm)", "imperial" to "Imperial (lb/in)").forEach { (value, label) ->
                val selected = unitSystem == value
                Surface(
                    onClick = { onUnitSystemChange(value) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp),
                    color = if (selected) RuvoColors.lime else Color.Transparent,
                ) {
                    Text(
                        label,
                        modifier = Modifier.padding(vertical = 10.dp),
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.labelMedium,
                        color = if (selected) Color.Black else RuvoColors.textSecondary,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                    )
                }
            }
        }

        // Gender pill row
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Gender", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textSecondary)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GENDERS.forEach { g ->
                    val selected = g == gender
                    Surface(
                        onClick = { onGenderChange(g) },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(20.dp),
                        color = if (selected) RuvoColors.limeDim else RuvoColors.surface,
                        border = BorderStroke(if (selected) 2.dp else 1.dp, if (selected) RuvoColors.lime else RuvoColors.border),
                    ) {
                        Text(
                            g,
                            modifier = Modifier.padding(vertical = 12.dp),
                            textAlign = TextAlign.Center,
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (selected) RuvoColors.lime else RuvoColors.textPrimary,
                        )
                    }
                }
            }
        }

        // Date of birth
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Date of Birth", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textSecondary)
            Surface(
                onClick = { showDatePicker = true },
                shape = RoundedCornerShape(14.dp),
                color = RuvoColors.surface,
                border = BorderStroke(1.dp, RuvoColors.border),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(modifier = Modifier.padding(16.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.CalendarMonth, contentDescription = null, tint = RuvoColors.textTertiary)
                    Spacer(Modifier.width(12.dp))
                    Text(dobLabel, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary)
                }
            }
        }

        // Weight / Height — RN documents these as NOT unit-converted on toggle,
        // only the label text changes; same raw number either way, ported as-is.
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedTextField(
                value = weightText,
                onValueChange = { txt -> onWeightChange(txt.filter { it.isDigit() || it == '.' }) },
                label = { Text(if (isMetric) "Weight (kg)" else "Weight (lb)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(14.dp),
                colors = onboardingFieldColors(),
            )
            OutlinedTextField(
                value = heightText,
                onValueChange = { txt -> onHeightChange(txt.filter { it.isDigit() || it == '.' }) },
                label = { Text(if (isMetric) "Height (cm)" else "Height (in)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(14.dp),
                colors = onboardingFieldColors(),
            )
        }
    }

    if (showDatePicker) {
        val pickerState = rememberDatePickerState(initialSelectedDateMillis = dobMillis)
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    pickerState.selectedDateMillis?.let(onDobChange)
                    showDatePicker = false
                }) { Text("OK", color = RuvoColors.lime) }
            },
            dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text("Cancel", color = RuvoColors.textSecondary) } },
        ) { DatePicker(state = pickerState) }
    }
}

@Composable
private fun onboardingFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = RuvoColors.lime,
    unfocusedBorderColor = RuvoColors.border,
    focusedLabelColor = RuvoColors.lime,
    focusedTextColor = RuvoColors.textPrimary,
    unfocusedTextColor = RuvoColors.textPrimary,
)

// Archive §7 step 4 quotes only the two endpoints of RN's real 8-entry
// array — "(0→'Perfect! We'll start from the beginning.' … 7→'Elite level!
// You're unstoppable.')" — the middle six were elided with "…" and RN's
// source is gone, so there's no way to recover their exact original text.
// Ported the two known-real endpoints verbatim; the middle six are
// original Android copy in the same voice, not a guess passed off as RN's
// actual wording.
private val FREQUENCY_ENCOURAGEMENT = listOf(
    "Perfect! We'll start from the beginning.",
    "Great start! Building the habit is what matters most.",
    "Nice and steady — consistency beats intensity.",
    "Solid rhythm! You're building real endurance.",
    "Impressive dedication — you're ahead of most runners.",
    "That's serious commitment to your training.",
    "Whoa, you're practically a pro already!",
    "Elite level! You're unstoppable.",
)

@Composable
private fun FrequencyStep(frequency: Int, onSelect: (Int) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Column {
            Text("Current frequency", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)
            Text("How many times a week do you currently run?", style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            (0..7).forEach { n ->
                val isSelected = n == frequency
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .aspectRatio(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (isSelected) RuvoColors.lime else RuvoColors.surface)
                        .border(1.dp, if (isSelected) RuvoColors.lime else RuvoColors.border, RoundedCornerShape(12.dp))
                        .clickable { onSelect(n) },
                    contentAlignment = Alignment.Center,
                ) {
                    Text("$n", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = if (isSelected) Color.Black else RuvoColors.textPrimary)
                }
            }
        }
        Surface(shape = RoundedCornerShape(14.dp), color = RuvoColors.surface, modifier = Modifier.fillMaxWidth()) {
            Text(
                FREQUENCY_ENCOURAGEMENT[frequency],
                modifier = Modifier.padding(16.dp),
                style = MaterialTheme.typography.bodyMedium,
                color = RuvoColors.textSecondary,
            )
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
