package com.ruvo.app.features.training

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

// --- Models ---
data class TrainingPlan(
    val id: String,
    val title: String,
    val goal: String,
    val durationWeeks: Int,
    val runsPerWeek: Int,
    val currentWeek: Int,
    val weeks: List<TrainingWeek>,
)

data class TrainingWeek(
    val weekNumber: Int,
    val days: List<TrainingDay>,
)

data class TrainingDay(
    val dayOfWeek: String,
    val type: String, // "Easy", "Tempo", "Long", "Rest", "Interval", "Race"
    val distanceKm: Double?,
    val durationMinutes: Int?,
    val description: String,
    val isCompleted: Boolean,
)

data class TrainingPlanUiState(
    val activePlan: TrainingPlan? = null,
    val isGenerating: Boolean = false,
    val errorMessage: String? = null,
    val showPlanPicker: Boolean = false,
)

// --- ViewModel ---
@HiltViewModel
class TrainingPlanViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
    private val functions: FirebaseFunctions,
) : ViewModel() {

    private val _uiState = MutableStateFlow(TrainingPlanUiState())
    val uiState: StateFlow<TrainingPlanUiState> = _uiState.asStateFlow()

    init { loadActivePlan() }

    private fun loadActivePlan() {
        val uid = auth.currentUser?.uid ?: return
        firestore.collection("users").document(uid).collection("trainingPlans")
            .whereEqualTo("isActive", true)
            .limit(1)
            .addSnapshotListener { snap, _ ->
                val doc = snap?.documents?.firstOrNull()
                if (doc != null) {
                    val data = doc.data ?: return@addSnapshotListener
                    @Suppress("UNCHECKED_CAST")
                    val weeksData = data["weeks"] as? List<Map<String, Any>> ?: emptyList()
                    val weeks = weeksData.mapIndexed { wi, weekMap ->
                        @Suppress("UNCHECKED_CAST")
                        val daysData = weekMap["days"] as? List<Map<String, Any>> ?: emptyList()
                        TrainingWeek(
                            weekNumber = wi + 1,
                            days = daysData.map { d ->
                                TrainingDay(
                                    dayOfWeek = d["day"] as? String ?: "",
                                    type = d["type"] as? String ?: "Rest",
                                    distanceKm = d["distanceKm"] as? Double,
                                    durationMinutes = (d["durationMinutes"] as? Long)?.toInt(),
                                    description = d["description"] as? String ?: "",
                                    isCompleted = d["isCompleted"] as? Boolean ?: false,
                                )
                            }
                        )
                    }
                    _uiState.value = _uiState.value.copy(
                        activePlan = TrainingPlan(
                            id = doc.id,
                            title = data["title"] as? String ?: "",
                            goal = data["goal"] as? String ?: "",
                            durationWeeks = (data["durationWeeks"] as? Long ?: 8L).toInt(),
                            runsPerWeek = (data["runsPerWeek"] as? Long ?: 3L).toInt(),
                            currentWeek = (data["currentWeek"] as? Long ?: 1L).toInt(),
                            weeks = weeks,
                        )
                    )
                }
            }
    }

    fun generateAIPlan(goal: String, fitnessLevel: String, weeksAvailable: Int) {
        val uid = auth.currentUser?.uid ?: return
        _uiState.value = _uiState.value.copy(isGenerating = true, errorMessage = null)
        viewModelScope.launch {
            try {
                val result = functions.getHttpsCallable("generateTrainingPlan").call(
                    mapOf("userId" to uid, "goal" to goal, "fitnessLevel" to fitnessLevel, "weeks" to weeksAvailable)
                ).await()
                @Suppress("UNCHECKED_CAST")
                val data = result.data as? Map<String, Any> ?: emptyMap()
                // Plan is saved to Firestore by the Cloud Function, listener will pick it up
                _uiState.value = _uiState.value.copy(isGenerating = false)
            } catch (e: Exception) {
                // Fallback: create a basic plan locally
                createFallbackPlan(uid, goal, fitnessLevel, weeksAvailable)
                _uiState.value = _uiState.value.copy(isGenerating = false)
            }
        }
    }

    private suspend fun createFallbackPlan(uid: String, goal: String, fitnessLevel: String, weeks: Int) {
        val plan = buildDefaultPlan(goal, fitnessLevel, weeks)
        try {
            firestore.collection("users").document(uid).collection("trainingPlans")
                .add(plan + mapOf("isActive" to true, "createdAt" to com.google.firebase.Timestamp.now()))
                .await()
        } catch (_: Exception) {}
    }

    private fun buildDefaultPlan(goal: String, fitnessLevel: String, weeks: Int): Map<String, Any> {
        val baseDistance = when (fitnessLevel) {
            "beginner" -> 3.0; "intermediate" -> 5.0; "advanced" -> 8.0; else -> 5.0
        }
        val weeksList = (1..weeks).map { week ->
            val progression = 1.0 + (week - 1) * 0.1
            mapOf("days" to listOf(
                mapOf("day" to "Monday",   "type" to "Easy",     "distanceKm" to baseDistance * progression, "description" to "Easy comfortable pace run"),
                mapOf("day" to "Tuesday",  "type" to "Rest",     "distanceKm" to null,                       "description" to "Rest or light stretching"),
                mapOf("day" to "Wednesday","type" to "Tempo",    "distanceKm" to (baseDistance * progression * 0.8), "description" to "Tempo run at comfortably hard pace"),
                mapOf("day" to "Thursday", "type" to "Rest",     "distanceKm" to null,                       "description" to "Rest or cross-training"),
                mapOf("day" to "Friday",   "type" to "Easy",     "distanceKm" to baseDistance * progression * 0.6, "description" to "Short easy recovery run"),
                mapOf("day" to "Saturday", "type" to "Long",     "distanceKm" to baseDistance * progression * 1.5, "description" to "Long slow distance run"),
                mapOf("day" to "Sunday",   "type" to "Rest",     "distanceKm" to null,                       "description" to "Complete rest"),
            ))
        }
        return mapOf("title" to "AI Training Plan for $goal", "goal" to goal, "durationWeeks" to weeks, "runsPerWeek" to 3, "currentWeek" to 1, "weeks" to weeksList)
    }
}

// --- Screen ---
@Composable
fun TrainingPlanScreen(viewModel: TrainingPlanViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showGenerator by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxSize().background(RuvoColors.background).verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Training Plan", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)
            if (uiState.activePlan != null) {
                RuvoButton(text = "New Plan", onClick = { showGenerator = true }, style = RuvoButtonVariant.Secondary, fullWidth = false)
            }
        }

        if (uiState.isGenerating) {
            GeneratingCard()
        } else if (uiState.activePlan == null) {
            NoPlanCard(onGenerate = { showGenerator = true })
        } else {
            val plan = uiState.activePlan!!
            PlanProgressCard(plan = plan)
            CurrentWeekCard(plan = plan)
            AllWeeksOverview(plan = plan)
        }

        Spacer(modifier = Modifier.height(80.dp))
    }

    if (showGenerator) {
        PlanGeneratorSheet(
            onDismiss = { showGenerator = false },
            onGenerate = { goal, level, weeks ->
                viewModel.generateAIPlan(goal, level, weeks)
                showGenerator = false
            }
        )
    }
}

@Composable
private fun GeneratingCard() {
    RuvoCard(isHighlighted = true) {
        Column(modifier = Modifier.padding(32.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CircularProgressIndicator(color = RuvoColors.lime, modifier = Modifier.size(48.dp))
            Text("AI is building your plan...", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
            Text("Analyzing your fitness level and goal", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
        }
    }
}

@Composable
private fun NoPlanCard(onGenerate: () -> Unit) {
    RuvoCard {
        Column(modifier = Modifier.padding(24.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("🤖", style = MaterialTheme.typography.displayLarge)
            Text("No Active Plan", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
            Text("Let our AI build a personalized training plan based on your goal and fitness level.", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
            RuvoButton(text = "Generate My Plan", onClick = onGenerate, style = RuvoButtonVariant.Primary)
        }
    }
}

@Composable
private fun PlanProgressCard(plan: TrainingPlan) {
    RuvoCard(isHighlighted = true) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text(plan.title, style = MaterialTheme.typography.titleMedium, color = RuvoColors.lime)
                    Text("Goal: ${plan.goal}", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                }
                Text("W${plan.currentWeek}/${plan.durationWeeks}", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
            }
            LinearProgressIndicator(
                progress = { plan.currentWeek.toFloat() / plan.durationWeeks },
                modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                color = RuvoColors.lime,
                trackColor = RuvoColors.border,
            )
            Text("${plan.runsPerWeek} runs/week · ${plan.durationWeeks} weeks total", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
        }
    }
}

@Composable
private fun CurrentWeekCard(plan: TrainingPlan) {
    val currentWeek = plan.weeks.getOrNull(plan.currentWeek - 1) ?: return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("This Week", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
        currentWeek.days.forEach { day ->
            DayCard(day = day)
        }
    }
}

@Composable
private fun DayCard(day: TrainingDay) {
    val typeColor = when (day.type) {
        "Easy"     -> Color(0xFF30D158)
        "Tempo"    -> Color(0xFFFF9F0A)
        "Long"     -> Color(0xFFFF9F0A)
        "Interval" -> Color(0xFFFF453A)
        "Race"     -> Color(0xFFFF453A)
        else       -> Color(0xFF6E6E73)
    }
    val typeLabel = when (day.type) {
        "Easy" -> "EASY RUN"
        "Tempo" -> "TEMPO RUN"
        "Long" -> "LONG RUN"
        "Interval" -> "INTERVALS"
        "Race" -> "RACE DAY"
        else -> "REST DAY"
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .clip(RoundedCornerShape(12.dp))
            .background(if (day.isCompleted) RuvoColors.limeDim else RuvoColors.surface)
            .border(1.dp, if (day.isCompleted) RuvoColors.lime.copy(alpha = 0.5f) else RuvoColors.border, RoundedCornerShape(12.dp)),
    ) {
        Box(modifier = Modifier.width(4.dp).fillMaxHeight().background(typeColor))
        Row(
            modifier = Modifier.padding(start = 12.dp, top = 14.dp, bottom = 14.dp, end = 14.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(day.dayOfWeek.take(3).uppercase(), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = RuvoColors.textTertiary, modifier = Modifier.width(36.dp))
            Column(modifier = Modifier.weight(1f)) {
                Surface(shape = RoundedCornerShape(4.dp), color = typeColor.copy(alpha = 0.15f)) {
                    Text(typeLabel, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = typeColor, letterSpacing = 0.5.sp, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), fontSize = 9.sp)
                }
                Spacer(Modifier.height(4.dp))
                Text(day.description, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            }
            Column(horizontalAlignment = Alignment.End) {
                day.distanceKm?.let { Text(String.format("%.1f km", it), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, color = RuvoColors.textPrimary) }
                day.durationMinutes?.let { Text("${it} min", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary) }
            }
            if (day.isCompleted) {
                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(20.dp))
            }
        }
    }
}

@Composable
private fun AllWeeksOverview(plan: TrainingPlan) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Full Plan", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
        plan.weeks.forEachIndexed { idx, week ->
            WeekRow(weekNumber = idx + 1, week = week, isCurrent = idx + 1 == plan.currentWeek)
        }
    }
}

@Composable
private fun WeekRow(weekNumber: Int, week: TrainingWeek, isCurrent: Boolean) {
    val completedDays = week.days.count { it.isCompleted }
    val totalRunDays = week.days.count { it.type != "Rest" }
    Surface(
        color = if (isCurrent) RuvoColors.limeDim else RuvoColors.surface,
        shape = RoundedCornerShape(12.dp),
        border = if (isCurrent) BorderStroke(1.dp, RuvoColors.lime) else null,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(modifier = Modifier.padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Week $weekNumber", style = MaterialTheme.typography.titleSmall, color = if (isCurrent) RuvoColors.lime else RuvoColors.textPrimary)
            Text("$completedDays/$totalRunDays runs", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            LinearProgressIndicator(
                progress = { if (totalRunDays > 0) completedDays.toFloat() / totalRunDays else 0f },
                modifier = Modifier.width(80.dp).height(6.dp).clip(RoundedCornerShape(3.dp)),
                color = RuvoColors.lime,
                trackColor = RuvoColors.border,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PlanGeneratorSheet(onDismiss: () -> Unit, onGenerate: (String, String, Int) -> Unit) {
    var goal by remember { mutableStateOf("5K") }
    var fitnessLevel by remember { mutableStateOf("beginner") }
    var weeks by remember { mutableFloatStateOf(8f) }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = RuvoColors.surface) {
        Column(modifier = Modifier.padding(24.dp).navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Text("Generate AI Plan", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
            Text("🤖 Our AI will create a week-by-week plan tailored to you.", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)

            Text("Goal", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textTertiary)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("5K", "10K", "Half", "Full", "Fitness").forEach { g ->
                    FilterChip(selected = goal == g, onClick = { goal = g }, label = { Text(g) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = RuvoColors.lime, selectedLabelColor = Color.Black))
                }
            }

            Text("Fitness Level", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textTertiary)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("beginner", "intermediate", "advanced").forEach { l ->
                    FilterChip(selected = fitnessLevel == l, onClick = { fitnessLevel = l }, label = { Text(l.replaceFirstChar { it.uppercase() }) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = RuvoColors.lime, selectedLabelColor = Color.Black))
                }
            }

            Column {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Duration", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textTertiary)
                    Text("${weeks.toInt()} weeks", style = MaterialTheme.typography.labelLarge, color = RuvoColors.lime)
                }
                Slider(value = weeks, onValueChange = { weeks = it }, valueRange = 4f..24f, steps = 19,
                    colors = SliderDefaults.colors(thumbColor = RuvoColors.lime, activeTrackColor = RuvoColors.lime))
            }

            RuvoButton(text = "🤖 Generate Plan", onClick = { onGenerate(goal, fitnessLevel, weeks.toInt()) }, style = RuvoButtonVariant.Primary)
        }
    }
}
