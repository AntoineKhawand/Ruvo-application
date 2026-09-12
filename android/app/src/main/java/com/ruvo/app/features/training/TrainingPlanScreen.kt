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
import androidx.compose.ui.graphics.vector.ImageVector
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
import com.ruvo.app.features.runtracking.IntervalStep
import com.ruvo.app.features.runtracking.StepType
import com.ruvo.app.features.weather.RunWeatherAdvice
import com.ruvo.app.features.weather.WeatherService
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

// RN's `workoutSteps` default 3-block plan (RN_SOURCE_ARCHIVE.md §5): warmUp=5min,
// coolDown=5min, mainSetTime = max(totalTime-warmUp-coolDown, 10) where
// totalTime = workout.duration || 30. Android's generator never modeled a numeric
// duration field, so it's estimated here from `detail`'s leading "X min"/"Xkm" text
// (assuming ~6 min/km easy pace), falling back to RN's same 30min default.
private fun TrainingWorkout.estimatedDurationMinutes(): Int {
    val minMatch = Regex("""(\d+)\s*min""").find(detail)
    if (minMatch != null) return minMatch.groupValues[1].toInt()
    val kmMatch = Regex("""(\d+(?:\.\d+)?)\s*km""").find(detail)
    if (kmMatch != null) return (kmMatch.groupValues[1].toDouble() * 6).roundToInt()
    return 30
}

fun TrainingWorkout.toWorkoutSteps(): List<IntervalStep> {
    val mainSetMinutes = maxOf(estimatedDurationMinutes() - 10, 10)
    return listOf(
        IntervalStep(StepType.WarmUp, 300, label = "Warm Up"),
        IntervalStep(StepType.Work, mainSetMinutes * 60, label = title),
        IntervalStep(StepType.CoolDown, 300, label = "Cool Down"),
    )
}

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
    val showSchedulePicker: Boolean = false,
    // Competitor gap: Runna adjusts sessions around real weather; Ruvo's
    // WeatherService/WeatherWidget only ever advised on the Home screen for
    // *today's* run, never touching the plan a session actually comes from.
    // Reuses that same service/advice type rather than a second weather path.
    val todayWeatherAdvice: RunWeatherAdvice? = null,
    // Competitor-analysis Tier 3 #10: a proactive nudge when the plan
    // notices missed sessions on its own, rather than only reacting to a
    // chat message. Dismissal is session-scoped only (resets if this
    // ViewModel is recreated) — the same "not persisted" tradeoff already
    // accepted for TipDetailScreen's Mark-as-Helpful toggle elsewhere in
    // this app, rather than spending a Firestore write just to remember a
    // dismiss.
    val adaptiveNudge: String? = null,
    val adaptiveNudgeDismissed: Boolean = false,
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
    private val weatherService: WeatherService,
) : ViewModel() {

    private val _uiState = MutableStateFlow(TrainingPlanUiState())
    val uiState: StateFlow<TrainingPlanUiState> = _uiState.asStateFlow()

    init {
        loadPlan()
        loadWeatherAdvice()
    }

    private fun loadWeatherAdvice() {
        viewModelScope.launch {
            val weather = weatherService.fetchCurrentWeather() ?: return@launch
            _uiState.value = _uiState.value.copy(todayWeatherAdvice = weatherService.buildAdvice(weather))
        }
    }

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

            // Tier 3 #10: same runHistory array saveRunActivity writes (see
            // AICoachViewModel.loadUserContext) — already on this same user
            // doc, so no extra read is needed to know which of this week's
            // scheduled days actually have a completed run against them.
            @Suppress("UNCHECKED_CAST")
            val runHistory = doc?.data?.get("runHistory") as? List<Map<String, Any>> ?: emptyList()
            val completedRunDates = runHistory.mapNotNull { r ->
                (r["date"] as? String)?.let {
                    runCatching { java.time.Instant.parse(it).atZone(java.time.ZoneId.systemDefault()).toLocalDate() }.getOrNull()
                }
            }.toSet()
            val weekMonday = java.time.LocalDate.now().with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))
            val missedDays = computeMissedWorkoutDays(weeks.firstOrNull()?.workouts ?: emptyList(), todayDayAbbrev(), weekMonday, completedRunDates)
            // Only (re)compute the nudge while it hasn't been dismissed this
            // session — otherwise an unrelated field changing elsewhere on
            // this doc (any snapshot re-fire) would silently un-dismiss it.
            val status = planMap["status"] as? String ?: "Active"
            val nudge = if (_uiState.value.adaptiveNudgeDismissed) null else computeAdaptiveNudgeMessage(missedDays.size, status)

            _uiState.value = _uiState.value.copy(
                plan = TrainingPlan(
                    activeGoal = planMap["activeGoal"] as? String ?: "10k",
                    status = status,
                    weeks = weeks,
                ),
                runDays = runDays,
                isLoading = false,
                adaptiveNudge = nudge,
            )
        }
    }

    fun dismissAdaptiveNudge() {
        _uiState.value = _uiState.value.copy(adaptiveNudge = null, adaptiveNudgeDismissed = true)
    }

    // Applies the exact same change AI Coach's "ease_this_week" chat action
    // does (AICoachViewModel.easeWorkouts) — just triggered by the plan
    // noticing missed sessions on its own instead of a chat message asking
    // for it. Same targeted read/replace-weeks[0]/write shape as
    // AICoachViewModel.applyPlanAdjustment (not updateTrainingPlan(), which
    // regenerates all 4 weeks from scratch and would discard this exact
    // in-place edit).
    fun acceptAdaptiveNudge() {
        val uid = auth.currentUser?.uid ?: return
        _uiState.value = _uiState.value.copy(adaptiveNudge = null, adaptiveNudgeDismissed = true)
        viewModelScope.launch {
            try {
                val doc = firestore.collection("users").document(uid).get().await()
                @Suppress("UNCHECKED_CAST")
                val planMap = doc.get("trainingPlan") as? Map<String, Any> ?: return@launch
                @Suppress("UNCHECKED_CAST")
                val weeksData = planMap["weeks"] as? List<Map<String, Any>> ?: return@launch
                if (weeksData.isEmpty()) return@launch
                @Suppress("UNCHECKED_CAST")
                val week0Workouts = (weeksData[0]["workouts"] as? List<Map<String, Any>>)?.map { wo ->
                    TrainingWorkout(
                        day = wo["day"] as? String ?: "",
                        title = wo["title"] as? String ?: "",
                        detail = wo["detail"] as? String ?: "",
                        icon = wo["icon"] as? String ?: "",
                        isRest = wo["isRest"] as? Boolean ?: false,
                    )
                } ?: emptyList()
                val (updatedWorkouts, _) = com.ruvo.app.features.aicoach.easeWorkouts(week0Workouts, "Missed a couple sessions this week")
                val updatedWeek0 = weeksData[0] + mapOf(
                    "workouts" to updatedWorkouts.map { wo -> mapOf("day" to wo.day, "title" to wo.title, "detail" to wo.detail, "icon" to wo.icon, "isRest" to wo.isRest) }
                )
                val updatedPlanMap = planMap + mapOf("weeks" to (listOf(updatedWeek0) + weeksData.drop(1)))
                firestore.collection("users").document(uid).update("trainingPlan", updatedPlanMap).await()
            } catch (_: Exception) { /* nudge already cleared client-side; listener re-syncs once connectivity returns */ }
        }
    }

    fun updateTrainingPlan(newStatus: String?, newGoal: String? = null, newRunDays: List<String>? = null) {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            val current = _uiState.value.plan
            val oldStatus = current?.status ?: "Active"
            val activeGoal = newGoal ?: current?.activeGoal ?: "10k"
            val status = newStatus ?: oldStatus
            val runDays = newRunDays ?: _uiState.value.runDays

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
                    mapOf("trainingPlan" to planMap, "goal" to goalUpdate, "runDays" to runDays)
                ).await()
                _uiState.value = _uiState.value.copy(runDays = runDays)
            } catch (_: Exception) { /* offline-safe: listener will retry the read; write failures surface as unchanged state */ }
        }
    }

    fun openEditMenu() { _uiState.value = _uiState.value.copy(showEditMenu = true) }
    fun closeEditMenu() { _uiState.value = _uiState.value.copy(showEditMenu = false) }
    fun openGoalPicker() { _uiState.value = _uiState.value.copy(showEditMenu = false, showGoalPicker = true) }
    fun closeGoalPicker() { _uiState.value = _uiState.value.copy(showGoalPicker = false) }
    fun openSchedulePicker() { _uiState.value = _uiState.value.copy(showEditMenu = false, showSchedulePicker = true) }
    fun closeSchedulePicker() { _uiState.value = _uiState.value.copy(showSchedulePicker = false) }

    // RN's schedule modal (RN_ANDROID_PORT_MAPPING.md item #1) — runDays was
    // previously read-only on Android, always falling back to Mon/Wed/Fri.
    fun updateRunDays(days: List<String>) {
        if (days.isEmpty()) return
        _uiState.value = _uiState.value.copy(showSchedulePicker = false)
        updateTrainingPlan(newStatus = null, newRunDays = days.sortedBy { DAY_ORDER.indexOf(it) })
    }

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
fun TrainingPlanScreen(viewModel: TrainingPlanViewModel = hiltViewModel(), onStartWorkout: (TrainingWorkout) -> Unit = {}) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier.fillMaxSize().background(RuvoColors.background).verticalScroll(rememberScrollState()).padding(RuvoSpacing.md),
        verticalArrangement = Arrangement.spacedBy(RuvoSpacing.md)
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
                    DropdownMenuItem(text = { Text("Edit Schedule") }, onClick = { viewModel.openSchedulePicker() })
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
                if (plan.status == "Injured") StatusBanner(icon = Icons.Default.Healing, title = "Recovery Mode", desc = "Taking it easy while you heal.", color = RuvoColors.error)
                if (plan.status == "Vacation") StatusBanner(icon = Icons.Default.FlightTakeoff, title = "Vacation Mode", desc = "Short, scenic runs until you're back.", color = RuvoColors.teal)
                PlanProgressCard(plan = plan)
                val nudge = uiState.adaptiveNudge
                if (nudge != null) {
                    AdaptiveNudgeBanner(
                        message = nudge,
                        onEase = { viewModel.acceptAdaptiveNudge() },
                        onDismiss = { viewModel.dismissAdaptiveNudge() },
                    )
                }
                CurrentWeekCard(plan = plan, todayWeatherAdvice = uiState.todayWeatherAdvice, onStartWorkout = onStartWorkout)
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

    if (uiState.showSchedulePicker) {
        SchedulePickerSheet(
            currentRunDays = uiState.runDays,
            onDismiss = { viewModel.closeSchedulePicker() },
            onSave = { viewModel.updateRunDays(it) },
        )
    }
}

@Composable
private fun StatusBanner(icon: ImageVector, title: String, desc: String, color: Color) {
    Surface(shape = RoundedCornerShape(RuvoRadius.card), color = color.copy(alpha = 0.1f), border = BorderStroke(1.dp, color.copy(alpha = 0.3f)), modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(RuvoSpacing.cardGap), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.sm)) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(24.dp))
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
        Column(modifier = Modifier.padding(RuvoSpacing.lg).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(RuvoSpacing.md)) {
            Icon(Icons.Default.DirectionsRun, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(48.dp))
            Text("Setting up your plan…", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
            CircularProgressIndicator(color = RuvoColors.lime)
        }
    }
}

@Composable
private fun PlanProgressCard(plan: TrainingPlan) {
    RuvoCard(isHighlighted = true) {
        Column(modifier = Modifier.padding(RuvoSpacing.md), verticalArrangement = Arrangement.spacedBy(RuvoSpacing.cardGap)) {
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

private fun todayDayAbbrev(): String {
    val name = java.time.LocalDate.now().dayOfWeek.name // e.g. "MONDAY"
    return name.substring(0, 1) + name.substring(1, 3).lowercase()
}

// RN's weekDates/selectedDate today-selector (RN_ANDROID_PORT_MAPPING.md item
// #1) — replaces the old plain list with a day-by-day calendar strip; tapping
// a day shows just that day's workout instead of the whole week at once.
@Composable
private fun CurrentWeekCard(plan: TrainingPlan, todayWeatherAdvice: RunWeatherAdvice?, onStartWorkout: (TrainingWorkout) -> Unit) {
    val currentWeek = plan.weeks.firstOrNull() ?: return
    val today = remember { todayDayAbbrev() }
    var selectedDay by remember(currentWeek.weekNum) { mutableStateOf(today) }
    val workoutDays = remember(currentWeek) { currentWeek.workouts.map { it.day }.toSet() }

    Column(verticalArrangement = Arrangement.spacedBy(RuvoSpacing.cardGap)) {
        Text("This Week", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
        WeekDayStrip(selectedDay = selectedDay, todayDay = today, workoutDays = workoutDays, onSelectDay = { selectedDay = it })
        val workout = currentWeek.workouts.find { it.day == selectedDay }
        if (workout != null) {
            // Runna-style weather-aware nudge (RN_ANDROID_PORT_MAPPING.md
            // competitor-analysis Tier 1 #2): only surface it on TODAY's card,
            // for a real training session, and only when conditions actually
            // warrant caution — never on rest days or on a day the user is
            // just browsing ahead to.
            if (selectedDay == today && !workout.isRest && todayWeatherAdvice != null && !todayWeatherAdvice.isGoodForRun) {
                WeatherCautionBanner(todayWeatherAdvice)
            }
            WorkoutCard(workout = workout, onClick = { onStartWorkout(workout) })
        } else {
            RuvoCard {
                Box(modifier = Modifier.fillMaxWidth().padding(RuvoSpacing.md), contentAlignment = Alignment.Center) {
                    Text("No workout scheduled", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
                }
            }
        }
    }
}

// Tier 3 #10: the plan noticing missed sessions on its own, distinct from
// WeatherCautionBanner below (a per-day advisory) — this one offers a real
// action (ease the week), so it gets its own accent color and buttons
// rather than reusing StatusBanner's read-only shape.
@Composable
private fun AdaptiveNudgeBanner(message: String, onEase: () -> Unit, onDismiss: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(RuvoRadius.card),
        color = RuvoColors.lime.copy(alpha = 0.1f),
        border = BorderStroke(1.dp, RuvoColors.lime.copy(alpha = 0.3f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(RuvoSpacing.cardGap), verticalArrangement = Arrangement.spacedBy(RuvoSpacing.sm)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.sm)) {
                Icon(Icons.Default.SmartToy, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(24.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text("Your coach noticed something", style = MaterialTheme.typography.titleSmall, color = RuvoColors.lime)
                    Text(message, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.sm)) {
                TextButton(onClick = onDismiss) { Text("Not now", color = RuvoColors.textSecondary) }
                Button(
                    onClick = onEase,
                    shape = RoundedCornerShape(RuvoRadius.pill),
                    colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black),
                ) { Text("Ease this week") }
            }
        }
    }
}

@Composable
private fun WeatherCautionBanner(advice: RunWeatherAdvice) {
    Surface(
        shape = RoundedCornerShape(RuvoRadius.card),
        color = RuvoColors.error.copy(alpha = 0.1f),
        border = BorderStroke(1.dp, RuvoColors.error.copy(alpha = 0.3f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(modifier = Modifier.padding(RuvoSpacing.cardGap), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.sm)) {
            Text(advice.emoji, style = MaterialTheme.typography.headlineSmall)
            Column {
                Text("Today's conditions: ${advice.condition}", style = MaterialTheme.typography.titleSmall, color = RuvoColors.error)
                Text(advice.recommendation, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            }
        }
    }
}

@Composable
private fun WeekDayStrip(selectedDay: String, todayDay: String, workoutDays: Set<String>, onSelectDay: (String) -> Unit) {
    val monday = remember {
        java.time.LocalDate.now().with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))
    }
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.xs)) {
        DAY_ORDER.forEachIndexed { i, day ->
            val date = monday.plusDays(i.toLong())
            val isSelected = day == selectedDay
            val isToday = day == todayDay
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(RuvoRadius.card))
                    .background(if (isSelected) RuvoColors.lime else RuvoColors.surface)
                    .border(
                        width = if (isToday && !isSelected) 1.dp else 0.dp,
                        color = if (isToday && !isSelected) RuvoColors.lime else Color.Transparent,
                        shape = RoundedCornerShape(RuvoRadius.card),
                    )
                    .clickable { onSelectDay(day) }
                    .padding(vertical = RuvoSpacing.sm),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(RuvoSpacing.xs),
            ) {
                Text(day.take(1), style = MaterialTheme.typography.labelSmall, color = if (isSelected) Color.Black else RuvoColors.textSecondary)
                Text(
                    date.dayOfMonth.toString(),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = if (isSelected) Color.Black else RuvoColors.textPrimary,
                )
                Box(
                    modifier = Modifier
                        .size(4.dp)
                        .clip(CircleShape)
                        .background(if (day in workoutDays) (if (isSelected) Color.Black else RuvoColors.lime) else Color.Transparent),
                )
            }
        }
    }
}

@Composable
private fun WorkoutCard(workout: TrainingWorkout, onClick: () -> Unit = {}) {
    val typeColor = when {
        // Was a hardcoded #6E6E73 -- at 9sp bold on RuvoColors.surface that's ~3.73:1,
        // under the 4.5:1 WCAG AA minimum for normal text. textSecondary is the
        // token already tuned to clear AA on this background.
        workout.isRest -> RuvoColors.textSecondary
        workout.title == "Long Run" -> Color(0xFFFF9F0A)
        workout.icon == "stopwatch" -> Color(0xFFFF453A)
        else -> Color(0xFF30D158)
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .clip(RoundedCornerShape(RuvoRadius.card))
            .let { if (workout.isRest) it else it.clickable(onClick = onClick) }
            .background(RuvoColors.surface)
            .border(1.dp, RuvoColors.border, RoundedCornerShape(RuvoRadius.card)),
    ) {
        Box(modifier = Modifier.width(4.dp).fillMaxHeight().background(typeColor))
        Row(
            modifier = Modifier.padding(start = RuvoSpacing.cardGap, top = RuvoSpacing.cardGap, bottom = RuvoSpacing.cardGap, end = RuvoSpacing.cardGap).fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.cardGap),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(workout.day.take(3).uppercase(), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = RuvoColors.textTertiary, modifier = Modifier.width(36.dp))
            Column(modifier = Modifier.weight(1f)) {
                // 4dp/6dp/2dp intentionally left un-tokenized: at this badge's ~15dp
                // height, sm(8dp) radius/padding would clip to a full pill instead of
                // the compact, subtly-rounded tag this is meant to be.
                Surface(shape = RoundedCornerShape(4.dp), color = typeColor.copy(alpha = 0.15f)) {
                    Text(workout.title.uppercase(), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = typeColor, letterSpacing = 0.5.sp, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), fontSize = 9.sp)
                }
                Spacer(Modifier.height(RuvoSpacing.xs))
                Text(workout.detail, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            }
        }
    }
}

@Composable
private fun AllWeeksOverview(plan: TrainingPlan) {
    Column(verticalArrangement = Arrangement.spacedBy(RuvoSpacing.sm)) {
        Text("Next 4 Weeks", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
        plan.weeks.forEach { week -> WeekRow(week = week, isCurrent = week.weekNum == 1) }
    }
}

@Composable
private fun WeekRow(week: TrainingWeek, isCurrent: Boolean) {
    Surface(
        color = if (isCurrent) RuvoColors.limeDim else RuvoColors.surface,
        shape = RoundedCornerShape(RuvoRadius.card),
        border = if (isCurrent) BorderStroke(1.dp, RuvoColors.lime) else null,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(modifier = Modifier.padding(RuvoSpacing.cardGap), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
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
        Surface(shape = RoundedCornerShape(RuvoRadius.md), color = RuvoColors.glassSurface) {
            Column(modifier = Modifier.padding(RuvoSpacing.md), verticalArrangement = Arrangement.spacedBy(RuvoSpacing.cardGap)) {
                Text("Change Goal", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
                GOALS.forEach { goal ->
                    Surface(
                        onClick = { onSelect(goal) },
                        shape = RoundedCornerShape(RuvoRadius.card),
                        color = if (goal == currentGoal) RuvoColors.limeDim else RuvoColors.surfaceElev,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Row(
                            modifier = Modifier.padding(RuvoSpacing.md).fillMaxWidth(),
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

@Composable
private fun SchedulePickerSheet(currentRunDays: List<String>, onDismiss: () -> Unit, onSave: (List<String>) -> Unit) {
    var selected by remember(currentRunDays) { mutableStateOf(currentRunDays.toSet()) }
    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(RuvoRadius.md), color = RuvoColors.glassSurface) {
            Column(modifier = Modifier.padding(RuvoSpacing.md), verticalArrangement = Arrangement.spacedBy(RuvoSpacing.cardGap)) {
                Text("Edit Schedule", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
                Text("Which days do you want to run?", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                Row(horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.xs)) {
                    DAY_ORDER.forEach { day ->
                        val isSelected = day in selected
                        Surface(
                            onClick = {
                                selected = if (isSelected) selected - day else selected + day
                            },
                            shape = RoundedCornerShape(RuvoRadius.pill),
                            color = if (isSelected) RuvoColors.lime else RuvoColors.surfaceElev,
                            modifier = Modifier.weight(1f),
                        ) {
                            Box(modifier = Modifier.padding(vertical = RuvoSpacing.sm), contentAlignment = Alignment.Center) {
                                Text(
                                    day.take(1),
                                    style = MaterialTheme.typography.labelLarge,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) Color.Black else RuvoColors.textSecondary,
                                )
                            }
                        }
                    }
                }
                if (selected.isEmpty()) {
                    Text("Pick at least one day.", style = MaterialTheme.typography.labelSmall, color = RuvoColors.error)
                }
                Button(
                    onClick = { onSave(selected.toList()) },
                    enabled = selected.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(RuvoRadius.pill),
                    colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black),
                ) { Text("Save") }
            }
        }
    }
}
