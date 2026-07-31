package com.ruvo.app.features.runtracking

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.UUID
import javax.inject.Inject

// --- Models ---
data class IntervalStep(
    val type: StepType,
    val durationSeconds: Int,
    val targetPaceMinPerKm: Double? = null,  // null = free effort
    val label: String = "",
)

enum class StepType { WarmUp, Work, Rest, CoolDown }

data class IntervalWorkout(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val repeats: Int,
    val workSeconds: Int,
    val restSeconds: Int,
    val warmUpSeconds: Int,
    val coolDownSeconds: Int,
    val targetPaceMinPerKm: Double? = null,
) {
    fun buildSteps(): List<IntervalStep> = buildList {
        if (warmUpSeconds > 0) add(IntervalStep(StepType.WarmUp, warmUpSeconds, label = "Warm Up"))
        repeat(repeats) { i ->
            add(IntervalStep(StepType.Work, workSeconds, targetPaceMinPerKm, "Interval ${i + 1}"))
            if (i < repeats - 1) add(IntervalStep(StepType.Rest, restSeconds, label = "Recovery"))
        }
        if (coolDownSeconds > 0) add(IntervalStep(StepType.CoolDown, coolDownSeconds, label = "Cool Down"))
    }

    fun totalSeconds(): Int = warmUpSeconds + (workSeconds + restSeconds) * repeats - restSeconds + coolDownSeconds
}

fun StepType.color(): Color = when (this) {
    StepType.Work     -> RuvoColors.lime
    StepType.Rest     -> Color(0xFF2DD4BF)
    StepType.WarmUp   -> Color(0xFFF97316)
    StepType.CoolDown -> Color(0xFF60A5FA)
}

// Shared with WorkoutDetailScreen's "Intervals" run-type picker.
val DEFAULT_INTERVAL_PRESETS = listOf(
    IntervalWorkout("1", "5×1 km Intervals", 5, 300, 90, 600, 600, targetPaceMinPerKm = 4.5),
    IntervalWorkout("2", "10×400m Speed",     10, 100, 60, 300, 300, targetPaceMinPerKm = 4.0),
    IntervalWorkout("3", "Fartlek 20 min",    6,  120, 60, 300, 300),
    IntervalWorkout("4", "Tempo 3×1 km",      3,  300, 120, 600, 600, targetPaceMinPerKm = 5.0),
    IntervalWorkout("5", "Beginner 8×30s",    8,  30, 90, 300, 300),
)

data class IntervalSessionState(
    val workout: IntervalWorkout? = null,
    val steps: List<IntervalStep> = emptyList(),
    val currentStepIndex: Int = 0,
    val elapsedInStep: Int = 0,
    val totalElapsed: Int = 0,
    val isRunning: Boolean = false,
    val isFinished: Boolean = false,
) {
    val currentStep: IntervalStep? get() = steps.getOrNull(currentStepIndex)
    val remainingInStep: Int get() = (currentStep?.durationSeconds ?: 0) - elapsedInStep
    val progressInStep: Float get() = if ((currentStep?.durationSeconds ?: 0) > 0)
        elapsedInStep.toFloat() / (currentStep?.durationSeconds ?: 1) else 0f
}

data class IntervalUiState(
    val presets: List<IntervalWorkout> = emptyList(),
    val session: IntervalSessionState = IntervalSessionState(),
    val showBuilder: Boolean = false,
)

// --- ViewModel ---
@HiltViewModel
class IntervalTrainingViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
    private val voiceCoach: VoiceCoach,
) : ViewModel() {

    private val _uiState = MutableStateFlow(IntervalUiState())
    val uiState: StateFlow<IntervalUiState> = _uiState.asStateFlow()

    private var timerJob: Job? = null

    init { loadPresets() }

    private fun loadPresets() {
        val uid = auth.currentUser?.uid
        val defaults = DEFAULT_INTERVAL_PRESETS
        if (uid != null) {
            viewModelScope.launch {
                try {
                    val snap = firestore.collection("users").document(uid)
                        .collection("intervalWorkouts").get().await()
                    val saved = snap.documents.mapNotNull { doc ->
                        IntervalWorkout(
                            id = doc.id,
                            name = doc.getString("name") ?: return@mapNotNull null,
                            repeats = (doc.getLong("repeats") ?: 5).toInt(),
                            workSeconds = (doc.getLong("workSeconds") ?: 300).toInt(),
                            restSeconds = (doc.getLong("restSeconds") ?: 90).toInt(),
                            warmUpSeconds = (doc.getLong("warmUpSeconds") ?: 600).toInt(),
                            coolDownSeconds = (doc.getLong("coolDownSeconds") ?: 600).toInt(),
                            targetPaceMinPerKm = doc.getDouble("targetPaceMinPerKm"),
                        )
                    }
                    _uiState.value = _uiState.value.copy(presets = saved + defaults)
                } catch (_: Exception) {
                    _uiState.value = _uiState.value.copy(presets = defaults)
                }
            }
        } else {
            _uiState.value = _uiState.value.copy(presets = defaults)
        }
    }

    fun startWorkout(workout: IntervalWorkout) {
        val steps = workout.buildSteps()
        _uiState.value = _uiState.value.copy(
            session = IntervalSessionState(
                workout = workout,
                steps = steps,
                isRunning = true,
            )
        )
        announceStep(steps.firstOrNull())
        startTimer()
    }

    fun pauseResume() {
        val session = _uiState.value.session
        if (session.isRunning) {
            timerJob?.cancel()
            _uiState.value = _uiState.value.copy(session = session.copy(isRunning = false))
        } else {
            _uiState.value = _uiState.value.copy(session = session.copy(isRunning = true))
            startTimer()
        }
    }

    fun stopWorkout() {
        timerJob?.cancel()
        _uiState.value = _uiState.value.copy(session = IntervalSessionState())
    }

    fun saveCustomWorkout(workout: IntervalWorkout) {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            val data = mapOf(
                "name" to workout.name,
                "repeats" to workout.repeats,
                "workSeconds" to workout.workSeconds,
                "restSeconds" to workout.restSeconds,
                "warmUpSeconds" to workout.warmUpSeconds,
                "coolDownSeconds" to workout.coolDownSeconds,
                "targetPaceMinPerKm" to workout.targetPaceMinPerKm,
            )
            firestore.collection("users").document(uid)
                .collection("intervalWorkouts").add(data).await()
            loadPresets()
        }
        _uiState.value = _uiState.value.copy(showBuilder = false)
    }

    private fun startTimer() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (true) {
                delay(1000)
                val session = _uiState.value.session
                if (!session.isRunning || session.isFinished) break

                val newElapsedInStep = session.elapsedInStep + 1
                val currentStep = session.currentStep ?: break

                if (newElapsedInStep >= currentStep.durationSeconds) {
                    val nextIndex = session.currentStepIndex + 1
                    if (nextIndex >= session.steps.size) {
                        _uiState.value = _uiState.value.copy(
                            session = session.copy(
                                elapsedInStep = currentStep.durationSeconds,
                                totalElapsed = session.totalElapsed + 1,
                                isFinished = true,
                                isRunning = false,
                            )
                        )
                        voiceCoach.speak("Workout complete! Great job!")
                        break
                    } else {
                        val nextStep = session.steps[nextIndex]
                        _uiState.value = _uiState.value.copy(
                            session = session.copy(
                                currentStepIndex = nextIndex,
                                elapsedInStep = 0,
                                totalElapsed = session.totalElapsed + 1,
                            )
                        )
                        announceStep(nextStep)
                    }
                } else {
                    _uiState.value = _uiState.value.copy(
                        session = session.copy(
                            elapsedInStep = newElapsedInStep,
                            totalElapsed = session.totalElapsed + 1,
                        )
                    )
                    // Countdown at 3s remaining
                    val remaining = currentStep.durationSeconds - newElapsedInStep
                    if (remaining in 1..3) voiceCoach.speak("$remaining")
                }
            }
        }
    }

    private fun announceStep(step: IntervalStep?) {
        step ?: return
        val pace = step.targetPaceMinPerKm
        val paceStr = if (pace != null) " at ${pace.toInt()}:${String.format("%02d", ((pace % 1) * 60).toInt())} per km" else ""
        val durMin = step.durationSeconds / 60
        val durSec = step.durationSeconds % 60
        val durStr = if (durMin > 0) "${durMin} minute${if (durMin > 1) "s" else ""}" else "${durSec} seconds"
        voiceCoach.speak("${step.label}. $durStr$paceStr.")
    }

    override fun onCleared() {
        super.onCleared()
        timerJob?.cancel()
    }
}

// --- Screen ---
@Composable
fun IntervalTrainingScreen(viewModel: IntervalTrainingViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val session = uiState.session

    AnimatedContent(targetState = session.workout != null, label = "interval_state") { inSession ->
        if (inSession) {
            ActiveIntervalSession(session = session, onPauseResume = { viewModel.pauseResume() }, onStop = { viewModel.stopWorkout() })
        } else {
            IntervalWorkoutPicker(
                presets = uiState.presets,
                showBuilder = uiState.showBuilder,
                onSelect = { viewModel.startWorkout(it) },
                onShowBuilder = { viewModel.uiState.value.copy(showBuilder = true) },
                onSaveCustom = { viewModel.saveCustomWorkout(it) },
            )
        }
    }
}

@Composable
private fun ActiveIntervalSession(
    session: IntervalSessionState,
    onPauseResume: () -> Unit,
    onStop: () -> Unit,
) {
    val step = session.currentStep
    val stepColor = when (step?.type) {
        StepType.Work     -> RuvoColors.lime
        StepType.Rest     -> Color(0xFF2DD4BF)
        StepType.WarmUp   -> Color(0xFFF97316)
        StepType.CoolDown -> Color(0xFF60A5FA)
        null              -> RuvoColors.textSecondary
    }

    Box(modifier = Modifier.fillMaxSize().background(RuvoColors.background), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp),
            modifier = Modifier.padding(24.dp)
        ) {
            Text(session.workout?.name ?: "", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textSecondary)

            // Step label
            Text(step?.label ?: "Done", style = MaterialTheme.typography.headlineLarge, color = stepColor)

            // Circular countdown
            Box(contentAlignment = Alignment.Center, modifier = Modifier.size(200.dp)) {
                CircularProgressIndicator(
                    progress = { session.progressInStep },
                    modifier = Modifier.fillMaxSize(),
                    color = stepColor, trackColor = RuvoColors.border, strokeWidth = 10.dp,
                )
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        session.remainingInStep.formatDuration(),
                        style = MaterialTheme.typography.displayLarge,
                        color = RuvoColors.textPrimary,
                    )
                    Text("remaining", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                }
            }

            // Target pace
            step?.targetPaceMinPerKm?.let { pace ->
                RuvoCard {
                    Column(modifier = Modifier.padding(14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Target Pace", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                        Text(
                            "${pace.toInt()}:${String.format("%02d", ((pace % 1) * 60).toInt())}/km",
                            style = MaterialTheme.typography.headlineMedium,
                            color = stepColor,
                        )
                    }
                }
            }

            // Step overview
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                session.steps.forEachIndexed { idx, s ->
                    val c = when (s.type) {
                        StepType.Work -> RuvoColors.lime; StepType.Rest -> Color(0xFF2DD4BF)
                        StepType.WarmUp -> Color(0xFFF97316); StepType.CoolDown -> Color(0xFF60A5FA)
                    }
                    Box(
                        modifier = Modifier
                            .height(8.dp)
                            .weight(s.durationSeconds.toFloat())
                            .clip(RoundedCornerShape(4.dp))
                            .background(if (idx <= session.currentStepIndex) c else RuvoColors.border)
                    )
                }
            }

            // Total time
            Text("Total: ${session.totalElapsed.formatDuration()}", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)

            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                FilledTonalButton(onClick = onStop,
                    colors = ButtonDefaults.filledTonalButtonColors(containerColor = RuvoColors.surfaceElev)) {
                    Icon(Icons.Default.Stop, contentDescription = null, tint = Color(0xFFEF4444))
                    Spacer(Modifier.width(6.dp))
                    Text("Stop", color = Color(0xFFEF4444))
                }
                Button(onClick = onPauseResume,
                    colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black)) {
                    Icon(if (session.isRunning) Icons.Default.Pause else Icons.Default.PlayArrow, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text(if (session.isRunning) "Pause" else "Resume")
                }
            }
        }
    }
}

@Composable
private fun IntervalWorkoutPicker(
    presets: List<IntervalWorkout>,
    showBuilder: Boolean,
    onSelect: (IntervalWorkout) -> Unit,
    onShowBuilder: () -> Unit,
    onSaveCustom: (IntervalWorkout) -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().background(RuvoColors.background).verticalScroll(rememberScrollState())) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Interval Training", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)
            IconButton(onClick = onShowBuilder) {
                Icon(Icons.Default.Add, contentDescription = "Create", tint = RuvoColors.lime)
            }
        }
        Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            presets.forEach { workout ->
                WorkoutPresetCard(workout = workout, onStart = { onSelect(workout) })
            }
            Spacer(Modifier.height(80.dp))
        }
    }
}

@Composable
private fun WorkoutPresetCard(workout: IntervalWorkout, onStart: () -> Unit) {
    RuvoCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.CenterVertically) {
                Text(workout.name, style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
                Text(workout.totalSeconds().formatDuration(), style = MaterialTheme.typography.labelSmall, color = RuvoColors.textSecondary)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                IntervalChip("${workout.repeats}×", RuvoColors.lime)
                IntervalChip("${workout.workSeconds}s work", Color(0xFF4ADE80))
                IntervalChip("${workout.restSeconds}s rest", Color(0xFF2DD4BF))
                workout.targetPaceMinPerKm?.let { pace ->
                    IntervalChip("${pace.toInt()}:${String.format("%02d", ((pace % 1) * 60).toInt())}/km", Color(0xFFA855F7))
                }
            }
            Button(
                onClick = onStart,
                modifier = Modifier.fillMaxWidth().height(44.dp),
                shape = RoundedCornerShape(999.dp),
                colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black)
            ) { Text("Start Workout") }
        }
    }
}

@Composable
private fun IntervalChip(label: String, color: Color) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(color.copy(alpha = 0.15f))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) { Text(label, style = MaterialTheme.typography.labelSmall, color = color) }
}

private fun Int.formatDuration(): String {
    val m = this / 60; val s = this % 60
    return if (m > 0) "${m}:${String.format("%02d", s)}" else "${s}s"
}
