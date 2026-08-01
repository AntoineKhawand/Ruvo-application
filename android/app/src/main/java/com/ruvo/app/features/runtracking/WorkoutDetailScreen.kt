package com.ruvo.app.features.runtracking

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ruvo.app.designsystem.components.RuvoButton
import com.ruvo.app.designsystem.components.RuvoCard
import com.ruvo.app.designsystem.theme.RuvoColors
import com.ruvo.app.features.training.TrainingWorkout
import com.ruvo.app.features.training.toWorkoutSteps

data class MusicSource(
    val id: String,
    val name: String,
    val subtitle: String,
    val color: Color,
    val emoji: String,
    val androidDeepLink: String,
    val playStoreUrl: String,
)

private val MUSIC_SOURCES = listOf(
    MusicSource("anghami", "Anghami", "Play Your Likes", Color(0xFF945CFF), "🎵", "anghami://", "https://play.google.com/store/apps/details?id=com.anghami"),
    MusicSource("spotify", "Spotify", "Open App", Color(0xFF1DB954), "🎧", "spotify://", "https://play.google.com/store/apps/details?id=com.spotify.music"),
    MusicSource("youtube", "YouTube Music", "Open App", Color(0xFFFF0000), "▶️", "vnd.youtube://", "https://play.google.com/store/apps/details?id=com.google.android.apps.youtube.music"),
    MusicSource("none", "No Music", "Focus Mode", Color(0xFF888888), "🔇", "", ""),
)

private val WARM_UP_TYPES = listOf("None", "5 min walk", "10 min walk", "Dynamic stretch", "Light jog")
private val RUN_TYPES = listOf("Easy", "Tempo", "Intervals", "Long Run", "Race Pace", "Recovery")
private val GOALS = listOf("Distance", "Time", "Calories", "Free run")

@Composable
fun WorkoutDetailScreen(
    onStartRun: (List<IntervalStep>?) -> Unit,
    onBack: () -> Unit,
    presetWorkout: TrainingWorkout? = null,
) {
    val context = LocalContext.current
    var selectedMusic by remember { mutableStateOf(MUSIC_SOURCES.last()) }
    var selectedWarmUp by remember { mutableStateOf(WARM_UP_TYPES[0]) }
    var selectedRunType by remember { mutableStateOf(RUN_TYPES[0]) }
    var selectedGoal by remember { mutableStateOf(GOALS[0]) }
    var goalValue by remember { mutableStateOf("") }
    var selectedIntervalPreset by remember { mutableStateOf(DEFAULT_INTERVAL_PRESETS.first()) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
            .verticalScroll(rememberScrollState()),
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary) }
            Text("Workout Setup", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
        }

        // Sub-task 1 follow-up: a workout tapped from the training plan's "This
        // Week" list arrives here instead of the freeform Run Type/Warm-up/Goal
        // chips below — those don't apply to a pre-structured scheduled workout,
        // so this preview replaces them; Start Workout drives RunTrackingScreen's
        // workout mode with the same warm-up/main-set/cool-down step shape
        // WorkoutDetailScreen's own "Intervals" flow already uses.
        if (presetWorkout != null) {
            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                RuvoCard {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(presetWorkout.day.uppercase(), style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, fontWeight = FontWeight.Bold)
                        Text(presetWorkout.title, style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
                        Text(presetWorkout.detail, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
        }

        // Music section
        SectionHeader("🎵 Music")
        Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            MUSIC_SOURCES.forEach { source ->
                val isSelected = source.id == selectedMusic.id
                Surface(
                    onClick = {
                        selectedMusic = source
                        if (source.id != "none") {
                            launchMusicApp(context, source)
                        }
                    },
                    shape = RoundedCornerShape(16.dp),
                    color = if (isSelected) source.color.copy(alpha = 0.15f) else RuvoColors.surface,
                    border = BorderStroke(if (isSelected) 2.dp else 1.dp, if (isSelected) source.color else RuvoColors.border),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        Text(source.emoji, fontSize = 26.sp)
                        Column(modifier = Modifier.weight(1f)) {
                            Text(source.name, style = MaterialTheme.typography.titleSmall, color = if (isSelected) source.color else RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
                            Text(source.subtitle, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                        }
                        if (isSelected) Icon(Icons.Default.CheckCircle, contentDescription = null, tint = source.color)
                    }
                }
            }
        }

        if (presetWorkout == null) {
            Spacer(Modifier.height(20.dp))

            // Run type
            SectionHeader("🏃 Run Type")
            ChipRow(options = RUN_TYPES, selected = selectedRunType, onSelect = { selectedRunType = it })

            // Sub-task 13: picking a structured preset here is what actually puts
            // RunTrackingScreen into workout mode (countdown/auto-advance/step-
            // colored header/voice announcements) — previously this chip was
            // cosmetic only, "Intervals" behaved identically to every other type.
            AnimatedVisibility(visible = selectedRunType == "Intervals") {
                Column(modifier = Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    DEFAULT_INTERVAL_PRESETS.forEach { preset ->
                        val isSelected = preset.id == selectedIntervalPreset.id
                        Surface(
                            onClick = { selectedIntervalPreset = preset },
                            shape = RoundedCornerShape(16.dp),
                            color = if (isSelected) RuvoColors.lime.copy(alpha = 0.15f) else RuvoColors.surface,
                            border = BorderStroke(if (isSelected) 2.dp else 1.dp, if (isSelected) RuvoColors.lime else RuvoColors.border),
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Column {
                                    Text(preset.name, style = MaterialTheme.typography.titleSmall, color = if (isSelected) RuvoColors.lime else RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
                                    Text("${preset.repeats}× ${preset.workSeconds}s work / ${preset.restSeconds}s rest", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                                }
                                if (isSelected) Icon(Icons.Default.CheckCircle, contentDescription = null, tint = RuvoColors.lime)
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(20.dp))

            // Warm-up
            SectionHeader("🔥 Warm-up")
            ChipRow(options = WARM_UP_TYPES, selected = selectedWarmUp, onSelect = { selectedWarmUp = it })

            Spacer(Modifier.height(20.dp))

            // Goal
            SectionHeader("🎯 Set a Goal")
            Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                ChipRow(options = GOALS, selected = selectedGoal, onSelect = { selectedGoal = it; goalValue = "" })

                AnimatedVisibility(visible = selectedGoal != "Free run") {
                    val (label, suffix) = when (selectedGoal) {
                        "Distance"  -> "Target km" to "km"
                        "Time"      -> "Target minutes" to "min"
                        "Calories"  -> "Target kcal" to "kcal"
                        else        -> "" to ""
                    }
                    OutlinedTextField(
                        value = goalValue,
                        onValueChange = { goalValue = it.filter { c -> c.isDigit() || c == '.' } },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(label) },
                        suffix = { Text(suffix, color = RuvoColors.textTertiary) },
                        shape = RoundedCornerShape(14.dp),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = RuvoColors.lime,
                            unfocusedBorderColor = RuvoColors.border,
                            focusedLabelColor = RuvoColors.lime,
                            focusedContainerColor = RuvoColors.surfaceElev,
                            unfocusedContainerColor = RuvoColors.surfaceElev,
                            focusedTextColor = RuvoColors.textPrimary,
                            unfocusedTextColor = RuvoColors.textPrimary,
                        ),
                    )
                }
            }
        }

        Spacer(Modifier.height(28.dp))

        RuvoButton(
            text = if (presetWorkout != null) "Start Workout 🏃" else "Start Run 🏃",
            onClick = {
                val steps = when {
                    presetWorkout != null -> presetWorkout.toWorkoutSteps()
                    selectedRunType == "Intervals" -> selectedIntervalPreset.buildSteps()
                    else -> null
                }
                onStartRun(steps)
            },
            modifier = Modifier.padding(horizontal = 16.dp),
        )

        Spacer(Modifier.height(40.dp))
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        title,
        style = MaterialTheme.typography.titleMedium,
        color = RuvoColors.textPrimary,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
    )
}

@Composable
private fun ChipRow(options: List<String>, selected: String, onSelect: (String) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        options.forEach { option ->
            val isSelected = option == selected
            Surface(
                onClick = { onSelect(option) },
                shape = RoundedCornerShape(20.dp),
                color = if (isSelected) RuvoColors.lime else RuvoColors.surface,
                border = if (isSelected) null else BorderStroke(1.dp, RuvoColors.border),
            ) {
                Text(
                    option,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                    color = if (isSelected) Color.Black else RuvoColors.textSecondary,
                )
            }
        }
    }
}

private fun launchMusicApp(context: Context, source: MusicSource) {
    try {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(source.androidDeepLink))
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        context.startActivity(intent)
    } catch (_: Exception) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(source.playStoreUrl))
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(intent)
        } catch (_: Exception) {}
    }
}
