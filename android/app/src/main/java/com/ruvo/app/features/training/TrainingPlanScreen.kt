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
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*
import java.util.Date
import javax.inject.Inject
import kotlin.math.roundToInt

// --- Models ---
// Mirrors RN's `trainingPlan` map field on the users/{uid} document — a single
// current plan (no history/subcollection). RN regenerates the last 4 weeks
// whenever the goal or status changes; there's no server-side "AI generation",
// it's a deterministic client-side schedule builder (see generateWeekPlan()).
data class TrainingWorkout(
    val day: String,
    val title: String,
    val detail: String,
    val icon: String,
    val isRest: Boolean,
)

data class TrainingWeek(
    val weekNum: Int,
    val focus: String,
    val totalDist: String,
    val workouts: List<TrainingWorkout>,
)

data class TrainingPlan(
    val activeGoal: String = "10k",
    val status: String = "Active", // "Active" | "Injured" | "Vacation"
    val weeks: List<TrainingWeek> = emptyList(),
)

data class TrainingPlanUiState(
    val plan: TrainingPlan? = null,
    val runDays: List<String> = listOf("Mon", "Wed", "Fri"),
    val isLoading: Boolean = true,
    val showEditMenu: Boolean = false,
    val showGoalPicker: Boolean = false,
)

private val DAY_ORDER = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
private val GOALS = listOf("5k", "10k", "Half Marathon", "Marathon")

// Faithful port of RN UserContext.js's generateWeekPlan().
private fun generateWeekPlan(goal: String, status: String, weekOffset: Int, availableDaysIn: List<String>): TrainingWeek {
    val days = availableDaysIn.ifEmpty { listOf("Mon", "Wed", "Fri") }
    fun getDay(idx: Int) = days[idx % days.size]

    if (status == "Injured") {
        return TrainingWeek(
            weekNum = weekOffset + 1, focus = "Recovery", totalDist = "0-5km",
            workouts = listOf(
                TrainingWorkout(getDay(0), "Rest Day", "Focus on sleep", "bed", isRest = true),
                TrainingWorkout(getDay(1), "Recovery Walk", "20 min low impact", "walk", isRest = false),
                TrainingWorkout(getDay(minOf(2, days.size - 1)), "Mobility Work", "15 min stretching", "body", isRest = false),
            ),
        )
    }
    if (status == "Vacation") {
        val workouts = days.take(2).mapIndexed { i, d ->
            TrainingWorkout(
                day = d,
                title = if (i == 0) "Scenic Run" else "Short Jog",
                detail = if (i == 0) "30 min easy" else "20 min easy",
                icon = if (i == 0) "image" else "walk",
                isRest = false,
            )
        }
        return TrainingWeek(weekNum = weekOffset + 1, focus = "Maintenance", totalDist = "10-15km", workouts = workouts)
    }

    val phases = listOf("Base Building", "Load Increase", "Peak Week", "Taper")
    val phase = phases[weekOffset % 4]
    val volMult = listOf(1.0, 1.1, 1.2, 0.8)[weekOffset % 4]
    val baseDist = when (goal) {
        "Half Marathon" -> 10.0
        "Marathon" -> 15.0
        else -> 5.0
    }

    val workouts = mutableListOf<TrainingWorkout>()
    val longRunDay = days.last()
    workouts.add(TrainingWorkout(longRunDay, "Long Run", "${(baseDist * 1.5 * volMult).roundToInt()}km Steady", "map", isRest = false))

    val speedDay = if (days.size > 1) days[(days.size - 1) / 2] else null
    if (speedDay != null) {
        workouts.add(TrainingWorkout(speedDay, "Speed Work", "${(baseDist * 0.6 * volMult).roundToInt()}km Intervals", "stopwatch", isRest = false))
    }
    days.forEach { d ->
        if (d != longRunDay && (days.size <= 1 || d != speedDay)) {
            workouts.add(TrainingWorkout(d, "Easy Run", "${(baseDist * 0.8 * volMult).roundToInt()}km Zone 2", "walk", isRest = false))
        }
    }
    val sorted = workouts.sortedBy { DAY_ORDER.indexOf(it.day) }
    return TrainingWeek(weekNum = weekOffset + 1, focus = phase, totalDist = "${(baseDist * days.size * volMult).roundToInt()}km", workouts = sorted)
}

// --- ViewModel ---
@HiltViewModel
class TrainingPlanViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(TrainingPlanUiState())
    val uiState: StateFlow<TrainingPlanUiState> = _uiState.asStateFlow()

    init { loadPlan() }

    private fun loadPlan() {
        val uid = auth.currentUser?.uid ?: return
        firestore.collection("users").document(uid).addSnapshotListener { doc, _ ->
            @Suppress("UNCHECKED_CAST")
            val runDays = (doc?.get("runDays") as? List<String>)?.takeIf { it.isNotEmpty() } ?: listOf("Mon", "Wed", "Fri")
            @Suppress("UNCHECKED_CAST")
            val planMap = doc?.get("trainingPlan") as? Map<String, Any>
            if (planMap == null) {
                _uiState.value = _uiState.value.copy(plan = null, runDays = runDays, isLoading = false)
                val goal = doc?.getString("goal") ?: "10k"
                updateTrainingPlan(newStatus = "Active", newGoal = goal)
                return@addSnapshotListener
            }
            @Suppress("UNCHECKED_CAST")
            val weeksData = planMap["weeks"] as? List<Map<String, Any>> ?: emptyList()
            val weeks = weeksData.map { w ->
                @Suppress("UNCHECKED_CAST")
                val workoutsData = w["workouts"] as? List<Map<String, Any>> ?: emptyList()
                TrainingWeek(
                    weekNum = (w["weekNum"] as? Long ?: 1L).toInt(),
                    focus = w["focus"] as? String ?: "",
                    totalDist = w["totalDist"] as? String ?: "",
                    workouts = workoutsData.map { wo ->
                        TrainingWorkout(
                            day = wo["day"] as? String ?: "",
                            title = wo["title"] as? String ?: "",
                            detail = wo["detail"] as? String ?: "",
                            icon = wo["icon"] as? String ?: "",
                            isRest = wo["isRest"] as? Boolean ?: false,
                        )
                    },
                )
            }
            _uiState.value = _uiState.value.copy(
                plan = TrainingPlan(
                    activeGoal = planMap["activeGoal"] as? String ?: "10k",
                    status = planMap["status"] as? String ?: "Active",
                    weeks = weeks,
                ),
                runDays = runDays,
                isLoading = false,
            )
        }
    }

    fun updateTrainingPlan(newStatus: String?, newGoal: String? = null) {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            val current = _uiState.value.plan
            val oldStatus = current?.status ?: "Active"
            val activeGoal = newGoal ?: current?.activeGoal ?: "10k"
            val status = newStatus ?: oldStatus
            val runDays = _uiState.value.runDays

            val weeks = (0 until 4).map { generateWeekPlan(activeGoal, status, it, runDays) }
            val planMap = mapOf(
                "generatedAt" to Date().toString(),
                "activeGoal" to activeGoal,
                "status" to status,
                "weeks" to weeks.map { w ->
                    mapOf(
                        "weekNum" to w.weekNum, "focus" to w.focus, "totalDist" to w.totalDist,
                        "workouts" to w.workouts.map { wo -> mapOf("day" to wo.day, "title" to wo.title, "detail" to wo.detail, "icon" to wo.icon, "isRest" to wo.isRest) },
                    )
                },
            )
            val goalUpdate = when (status) {
                "Injured" -> "Recovery"
                "Vacation" -> "Maintenance"
                else -> activeGoal
            }
            try {
                firestore.collection("users").document(uid).update(
                    mapOf("trainingPlan" to planMap, "goal" to goalUpdate)
                ).await()
            } catch (_: Exception) { /* offline-safe: listener will retry the read; write failures surface as unchanged state */ }
        }
    }

    fun openEditMenu() { _uiState.value = _uiState.value.copy(showEditMenu = true) }
    fun closeEditMenu() { _uiState.value = _uiState.value.copy(showEditMenu = false) }
    fun openGoalPicker() { _uiState.value = _uiState.value.copy(showEditMenu = false, showGoalPicker = true) }
    fun closeGoalPicker() { _uiState.value = _uiState.value.copy(showGoalPicker = false) }

    fun toggleInjured() {
        val isInjured = _uiState.value.plan?.status == "Injured"
        updateTrainingPlan(if (isInjured) "Active" else "Injured")
        _uiState.value = _uiState.value.copy(showEditMenu = false)
    }

    fun toggleVacation() {
        val isVacation = _uiState.value.plan?.status == "Vacation"
        updateTrainingPlan(if (isVacation) "Active" else "Vacation")
        _uiState.value = _uiState.value.copy(showEditMenu = false)
    }

    fun selectGoal(goal: String) {
        updateTrainingPlan("Active", goal)
        _uiState.value = _uiState.value.copy(showGoalPicker = false)
    }
}

// --- Screen ---
@Composable
fun TrainingPlanScreen(viewModel: TrainingPlanViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier.fillMaxSize().background(RuvoColors.background).verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Training Plan", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)
            Box {
                IconButton(onClick = { viewModel.openEditMenu() }) {
                    Icon(Icons.Default.MoreVert, contentDescription = "Edit plan", tint = RuvoColors.textSecondary)
                }
                DropdownMenu(expanded = uiState.showEditMenu, onDismissRequest = { viewModel.closeEditMenu() }) {
                    val status = uiState.plan?.status ?: "Active"
                    DropdownMenuItem(
                        text = { Text(if (status == "Injured") "I'm Recovered" else "I'm Injured") },
                        onClick = { viewModel.toggleInjured() },
                    )
                    DropdownMenuItem(
                        text = { Text(if (status == "Vacation") "Back from Vacation" else "I'm on Vacation") },
                        onClick = { viewModel.toggleVacation() },
                    )
                    DropdownMenuItem(text = { Text("Change Goal") }, onClick = { viewModel.openGoalPicker() })
                }
            }
        }

        if (uiState.isLoading) {
            Box(Modifier.fillMaxWidth().padding(vertical = 60.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = RuvoColors.lime)
            }
        } else {
            val plan = uiState.plan
            if (plan == null) {
                NoPlanCard()
            } else {
                if (plan.status == "Injured") StatusBanner(emoji = "🩹", title = "Recovery Mode", desc = "Taking it easy while you heal.", color = RuvoColors.error)
                if (plan.status == "Vacation") StatusBanner(emoji = "✈️", title = "Vacation Mode", desc = "Short, scenic runs until you're back.", color = RuvoColors.teal)
                PlanProgressCard(plan = plan)
                CurrentWeekCard(plan = plan)
                AllWeeksOverview(plan = plan)
            }
            HabitsSection()
        }

        Spacer(modifier = Modifier.height(80.dp))
    }

    if (uiState.showGoalPicker) {
        GoalPickerSheet(
            currentGoal = uiState.plan?.activeGoal ?: "10k",
            onDismiss = { viewModel.closeGoalPicker() },
            onSelect = { viewModel.selectGoal(it) },
        )
    }
}

@Composable
private fun StatusBanner(emoji: String, title: String, desc: String, color: Color) {
    Surface(shape = RoundedCornerShape(14.dp), color = color.copy(alpha = 0.1f), border = BorderStroke(1.dp, color.copy(alpha = 0.3f)), modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(emoji, style = MaterialTheme.typography.headlineSmall)
            Column {
                Text(title, style = MaterialTheme.typography.titleSmall, color = color)
                Text(desc, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            }
        }
    }
}

@Composable
private fun NoPlanCard() {
    RuvoCard {
        Column(modifier = Modifier.padding(24.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("🏃", style = MaterialTheme.typography.displayLarge)
            Text("Setting up your plan…", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
            CircularProgressIndicator(color = RuvoColors.lime)
        }
    }
}

@Composable
private fun PlanProgressCard(plan: TrainingPlan) {
    RuvoCard(isHighlighted = true) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text(plan.activeGoal.replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.titleMedium, color = RuvoColors.lime)
                    Text(plan.weeks.firstOrNull()?.focus ?: "", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                }
                Text(plan.weeks.firstOrNull()?.totalDist ?: "—", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
            }
        }
    }
}

@Composable
private fun CurrentWeekCard(plan: TrainingPlan) {
    val currentWeek = plan.weeks.firstOrNull() ?: return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("This Week", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
        currentWeek.workouts.forEach { workout -> WorkoutCard(workout = workout) }
    }
}

@Composable
private fun WorkoutCard(workout: TrainingWorkout) {
    val typeColor = when {
        workout.isRest -> Color(0xFF6E6E73)
        workout.title == "Long Run" -> Color(0xFFFF9F0A)
        workout.icon == "stopwatch" -> Color(0xFFFF453A)
        else -> Color(0xFF30D158)
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .clip(RoundedCornerShape(12.dp))
            .background(RuvoColors.surface)
            .border(1.dp, RuvoColors.border, RoundedCornerShape(12.dp)),
    ) {
        Box(modifier = Modifier.width(4.dp).fillMaxHeight().background(typeColor))
        Row(
            modifier = Modifier.padding(start = 12.dp, top = 14.dp, bottom = 14.dp, end = 14.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(workout.day.take(3).uppercase(), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = RuvoColors.textTertiary, modifier = Modifier.width(36.dp))
            Column(modifier = Modifier.weight(1f)) {
                Surface(shape = RoundedCornerShape(4.dp), color = typeColor.copy(alpha = 0.15f)) {
                    Text(workout.title.uppercase(), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = typeColor, letterSpacing = 0.5.sp, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), fontSize = 9.sp)
                }
                Spacer(Modifier.height(4.dp))
                Text(workout.detail, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            }
        }
    }
}

@Composable
private fun AllWeeksOverview(plan: TrainingPlan) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Next 4 Weeks", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
        plan.weeks.forEach { week -> WeekRow(week = week, isCurrent = week.weekNum == 1) }
    }
}

@Composable
private fun WeekRow(week: TrainingWeek, isCurrent: Boolean) {
    Surface(
        color = if (isCurrent) RuvoColors.limeDim else RuvoColors.surface,
        shape = RoundedCornerShape(12.dp),
        border = if (isCurrent) BorderStroke(1.dp, RuvoColors.lime) else null,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(modifier = Modifier.padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text("Week ${week.weekNum}", style = MaterialTheme.typography.titleSmall, color = if (isCurrent) RuvoColors.lime else RuvoColors.textPrimary)
                Text(week.focus, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            }
            Text(week.totalDist, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textTertiary)
        }
    }
}

@Composable
private fun GoalPickerSheet(currentGoal: String, onDismiss: () -> Unit, onSelect: (String) -> Unit) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(20.dp), color = RuvoColors.surface) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text("Change Goal", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
                GOALS.forEach { goal ->
                    Surface(
                        onClick = { onSelect(goal) },
                        shape = RoundedCornerShape(12.dp),
                        color = if (goal == currentGoal) RuvoColors.limeDim else RuvoColors.surfaceElev,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp).fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(goal.replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.bodyLarge, color = if (goal == currentGoal) RuvoColors.lime else RuvoColors.textPrimary)
                            if (goal == currentGoal) Icon(Icons.Default.CheckCircle, contentDescription = null, tint = RuvoColors.lime)
                        }
                    }
                }
            }
        }
    }
}
