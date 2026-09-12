package com.ruvo.app.features.training

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.ruvo.app.designsystem.components.RuvoButton
import com.ruvo.app.designsystem.components.RuvoButtonVariant
import com.ruvo.app.designsystem.theme.RuvoColors
import com.ruvo.app.designsystem.theme.RuvoMotion
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import javax.inject.Inject
import kotlin.math.roundToInt

// Faithful port of RN UserContext.js's users/{uid}/habits/{id} document shape.
data class Habit(
    val id: String = "",
    val name: String = "New Habit",
    val description: String = "",
    val frequency: Int = 3,
    val icon: String = "run-fast",
    val completions: List<String> = emptyList(),
    val createdAt: String = "",
)

private val ISO_DATE: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE
private const val HEATMAP_COLS = 16
private const val HEATMAP_ROWS = 7

private fun todayString(): String = LocalDate.now().format(ISO_DATE)

data class HabitStats(
    val isDoneToday: Boolean,
    val monthCount: Int,
    val weekCount: Int,
    val weekPct: Int,
    val totalCount: Int,
    val heatmapCells: Set<Int>,
)

// Mirrors RN's per-render habit-card calculation (PlanScreen.js "My Habits" section).
fun computeHabitStats(habit: Habit): HabitStats {
    val today = LocalDate.now()
    val isDoneToday = habit.completions.contains(today.format(ISO_DATE))

    val parsed = habit.completions.mapNotNull { runCatching { LocalDate.parse(it, ISO_DATE) }.getOrNull() }

    val monthCount = parsed.count { it.year == today.year && it.monthValue == today.monthValue }

    // RN: weekStart = most recent Sunday (JS getDay(): 0=Sun..6=Sat). java.time DayOfWeek.MONDAY=1..SUNDAY=7,
    // so (value % 7) remaps SUNDAY->0, MONDAY->1, ..., SATURDAY->6 — identical to JS getDay().
    val todayDow0 = today.dayOfWeek.value % 7
    val weekStart = today.minusDays(todayDow0.toLong())
    val weekCount = parsed.count { !it.isBefore(weekStart) && !it.isAfter(today) }

    val freq = maxOf(habit.frequency, 1)
    val weekPct = minOf(((weekCount.toDouble() / freq) * 100).roundToInt(), 100)

    val heatmapCells = parsed.mapNotNull { date ->
        val diffWeeks = (ChronoUnit.DAYS.between(date, today) / 7).toInt()
        if (diffWeeks in 0 until HEATMAP_COLS) {
            val dow0 = date.dayOfWeek.value % 7
            dow0 * HEATMAP_COLS + (HEATMAP_COLS - 1 - diffWeeks)
        } else null
    }.toSet()

    return HabitStats(isDoneToday, monthCount, weekCount, weekPct, habit.completions.size, heatmapCells)
}

private data class HabitIconOption(val id: String, val icon: ImageVector)

private val HABIT_ICONS = listOf(
    HabitIconOption("run-fast", Icons.Filled.DirectionsRun),
    HabitIconOption("dumbbell", Icons.Filled.FitnessCenter),
    HabitIconOption("water", Icons.Filled.WaterDrop),
    HabitIconOption("sleep", Icons.Filled.Bedtime),
    HabitIconOption("food-apple", Icons.Filled.Restaurant),
    HabitIconOption("meditation", Icons.Filled.SelfImprovement),
    HabitIconOption("bike", Icons.Filled.DirectionsBike),
    HabitIconOption("walk", Icons.Filled.DirectionsWalk),
    HabitIconOption("yoga", Icons.Filled.Spa),
    HabitIconOption("heart-pulse", Icons.Filled.MonitorHeart),
    HabitIconOption("book-open-variant", Icons.Filled.MenuBook),
    HabitIconOption("pencil", Icons.Filled.Edit),
)

private fun habitIconFor(id: String): ImageVector = HABIT_ICONS.firstOrNull { it.id == id }?.icon ?: Icons.Filled.DirectionsRun

@HiltViewModel
class HabitsViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
) : ViewModel() {

    private val _habits = MutableStateFlow<List<Habit>>(emptyList())
    val habits: StateFlow<List<Habit>> = _habits.asStateFlow()

    private val _showAddSheet = MutableStateFlow(false)
    val showAddSheet: StateFlow<Boolean> = _showAddSheet.asStateFlow()

    init { listenHabits() }

    private fun listenHabits() {
        val uid = auth.currentUser?.uid ?: return
        firestore.collection("users").document(uid).collection("habits")
            .orderBy("createdAt", Query.Direction.ASCENDING)
            .addSnapshotListener { snap, _ ->
                _habits.value = snap?.documents?.mapNotNull { doc ->
                    val d = doc.data ?: return@mapNotNull null
                    @Suppress("UNCHECKED_CAST")
                    Habit(
                        id = doc.id,
                        name = d["name"] as? String ?: "New Habit",
                        description = d["description"] as? String ?: "",
                        frequency = (d["frequency"] as? Long)?.toInt() ?: 3,
                        icon = d["icon"] as? String ?: "run-fast",
                        completions = d["completions"] as? List<String> ?: emptyList(),
                        createdAt = d["createdAt"] as? String ?: "",
                    )
                } ?: emptyList()
            }
    }

    fun openAddSheet() { _showAddSheet.value = true }
    fun closeAddSheet() { _showAddSheet.value = false }

    fun addHabit(name: String, description: String, frequency: Int, icon: String) {
        val uid = auth.currentUser?.uid ?: return
        if (name.isBlank()) return
        viewModelScope.launch {
            try {
                firestore.collection("users").document(uid).collection("habits").add(
                    mapOf(
                        "name" to name,
                        "description" to description,
                        "frequency" to frequency,
                        "icon" to icon,
                        "completions" to emptyList<String>(),
                        "createdAt" to java.util.Date().toString(),
                    )
                ).await()
                _showAddSheet.value = false
            } catch (_: Exception) { /* offline-safe: listener reflects last-known state */ }
        }
    }

    fun deleteHabit(habitId: String) {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            try {
                firestore.collection("users").document(uid).collection("habits").document(habitId).delete().await()
            } catch (_: Exception) {}
        }
    }

    fun toggleCompletion(habit: Habit) {
        val uid = auth.currentUser?.uid ?: return
        val today = todayString()
        val newCompletions = if (habit.completions.contains(today)) habit.completions - today else habit.completions + today
        viewModelScope.launch {
            try {
                firestore.collection("users").document(uid).collection("habits").document(habit.id)
                    .update("completions", newCompletions).await()
            } catch (_: Exception) {}
        }
    }
}

@Composable
fun HabitsSection(viewModel: HabitsViewModel = hiltViewModel()) {
    val habits by viewModel.habits.collectAsStateWithLifecycle()
    val showAddSheet by viewModel.showAddSheet.collectAsStateWithLifecycle()

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text("My Habits", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
                Text(
                    "${habits.size} habit${if (habits.size == 1) "" else "s"} tracked",
                    style = MaterialTheme.typography.bodySmall,
                    color = RuvoColors.textSecondary,
                )
            }
            TextButton(onClick = { viewModel.openAddSheet() }) {
                Icon(Icons.Default.Add, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text("Add", color = RuvoColors.lime)
            }
        }

        if (habits.isEmpty()) {
            Surface(
                onClick = { viewModel.openAddSheet() },
                shape = RoundedCornerShape(16.dp),
                color = RuvoColors.surface,
                border = BorderStroke(1.dp, RuvoColors.border),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    modifier = Modifier.padding(20.dp).fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text("🎯", style = MaterialTheme.typography.headlineMedium)
                    Text("Build a habit", style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary)
                    Text("Track daily habits alongside your training", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                }
            }
        } else {
            habits.forEach { habit ->
                HabitCard(
                    habit = habit,
                    onToggle = { viewModel.toggleCompletion(habit) },
                    onDelete = { viewModel.deleteHabit(habit.id) },
                )
            }
        }
    }

    if (showAddSheet) {
        AddHabitSheet(onDismiss = { viewModel.closeAddSheet() }, onCreate = viewModel::addHabit)
    }
}

@Composable
private fun HabitCard(habit: Habit, onToggle: () -> Unit, onDelete: () -> Unit) {
    val stats = remember(habit) { computeHabitStats(habit) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = RuvoColors.surface,
        border = BorderStroke(1.dp, RuvoColors.border),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(modifier = Modifier.height(IntrinsicSize.Min)) {
            Box(modifier = Modifier.width(4.dp).fillMaxHeight().background(if (stats.isDoneToday) RuvoColors.lime else RuvoColors.border))
            Column(modifier = Modifier.padding(16.dp).weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    // Small, celebratory state flip on Mark Done -- gesture-driven,
                    // so RuvoMotion.springBouncy() per its own doc, not the settled spring.
                    val doneScale by animateFloatAsState(
                        targetValue = if (stats.isDoneToday) 1.08f else 1f,
                        animationSpec = RuvoMotion.springBouncy(),
                        label = "habit_done_scale",
                    )
                    Box(
                        modifier = Modifier.size(40.dp).scale(doneScale).clip(RoundedCornerShape(10.dp))
                            .background(if (stats.isDoneToday) RuvoColors.limeDim else RuvoColors.surfaceElev),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            habitIconFor(habit.icon), contentDescription = null,
                            tint = if (stats.isDoneToday) RuvoColors.lime else RuvoColors.textSecondary,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(habit.name, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
                        Text(
                            habit.description.ifBlank { "${maxOf(habit.frequency, 1)}× per week" },
                            style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary,
                        )
                    }
                    if (stats.weekPct >= 100) {
                        Surface(shape = RoundedCornerShape(50), color = RuvoColors.warning.copy(alpha = 0.15f)) {
                            Text("🔥 On fire", style = MaterialTheme.typography.labelSmall, color = RuvoColors.warning, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                        }
                    }
                    IconButton(onClick = { showDeleteConfirm = true }, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete habit", tint = RuvoColors.textTertiary, modifier = Modifier.size(18.dp))
                    }
                }

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    HabitStatCell("This month", "${stats.monthCount}")
                    HabitStatCell("This week", "${stats.weekPct}%", highlight = stats.weekPct >= 100)
                    HabitStatCell("Total", "${stats.totalCount}")
                }

                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    val animatedWeekFraction by animateFloatAsState(
                        targetValue = (stats.weekPct / 100f).coerceIn(0f, 1f),
                        animationSpec = RuvoMotion.springSettled(),
                        label = "habit_week_progress",
                    )
                    Box(modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(RuvoColors.surfaceElev)) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(fraction = animatedWeekFraction)
                                .fillMaxHeight()
                                .clip(RoundedCornerShape(3.dp))
                                .background(if (stats.weekPct >= 100) RuvoColors.lime else RuvoColors.lime.copy(alpha = 0.6f)),
                        )
                    }
                    Text(
                        "${stats.weekCount}/${maxOf(habit.frequency, 1)} this week",
                        style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary,
                    )
                }

                HeatmapGrid(activeCells = stats.heatmapCells)

                RuvoButton(
                    text = if (stats.isDoneToday) "Done Today ✓" else "Mark Done",
                    onClick = onToggle,
                    style = if (stats.isDoneToday) RuvoButtonVariant.Secondary else RuvoButtonVariant.Primary,
                )
            }
        }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Delete Habit?") },
            text = { Text("This will remove \"${habit.name}\" and its history.") },
            confirmButton = {
                TextButton(onClick = { showDeleteConfirm = false; onDelete() }) { Text("Delete", color = RuvoColors.error) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) { Text("Cancel") }
            },
            containerColor = RuvoColors.surface,
            titleContentColor = RuvoColors.textPrimary,
            textContentColor = RuvoColors.textSecondary,
        )
    }
}

@Composable
private fun HabitStatCell(label: String, value: String, highlight: Boolean = false) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleMedium, color = if (highlight) RuvoColors.lime else RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
    }
}

// GitHub-contributions-style grid: 7 rows (day-of-week) x 16 cols (weeks back, oldest→newest left→right).
@Composable
private fun HeatmapGrid(activeCells: Set<Int>) {
    val cellSize = 13.dp
    val gap = 3.dp
    val dayLabels = listOf("S", "M", "T", "W", "T", "F", "S")

    Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
        Column(verticalArrangement = Arrangement.spacedBy(gap)) {
            dayLabels.forEach { label ->
                Box(modifier = Modifier.size(cellSize), contentAlignment = Alignment.Center) {
                    Text(label, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, fontSize = 8.sp)
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(gap)) {
            for (row in 0 until HEATMAP_ROWS) {
                Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                    for (col in 0 until HEATMAP_COLS) {
                        val isActive = activeCells.contains(row * HEATMAP_COLS + col)
                        Box(
                            modifier = Modifier
                                .size(cellSize)
                                .clip(RoundedCornerShape(3.dp))
                                .background(if (isActive) RuvoColors.lime else RuvoColors.surfaceElev),
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun AddHabitSheet(onDismiss: () -> Unit, onCreate: (String, String, Int, String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var frequency by remember { mutableIntStateOf(3) }
    var selectedIcon by remember { mutableStateOf(HABIT_ICONS[0].id) }

    val textFieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = RuvoColors.lime, unfocusedBorderColor = RuvoColors.border,
        focusedLabelColor = RuvoColors.lime, focusedContainerColor = RuvoColors.surfaceElev,
        unfocusedContainerColor = RuvoColors.surfaceElev, focusedTextColor = RuvoColors.textPrimary, unfocusedTextColor = RuvoColors.textPrimary,
    )

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = RuvoColors.glassSurface,
        dragHandle = { BottomSheetDefaults.DragHandle(color = RuvoColors.border) },
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp).verticalScroll(rememberScrollState()).heightIn(max = 560.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("Add Habit", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)

            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Habit name (e.g. Daily Run)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = textFieldColors,
            )

            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("Description / goal (optional)") },
                modifier = Modifier.fillMaxWidth(),
                maxLines = 2,
                shape = RoundedCornerShape(14.dp),
                colors = textFieldColors,
            )

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Days per week", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textSecondary)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    (1..7).forEach { n ->
                        val isSelected = n == frequency
                        Surface(
                            onClick = { frequency = n },
                            shape = RoundedCornerShape(10.dp),
                            color = if (isSelected) RuvoColors.lime else RuvoColors.surfaceElev,
                            border = BorderStroke(1.dp, if (isSelected) RuvoColors.lime else RuvoColors.border),
                            modifier = Modifier.size(36.dp),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("$n", color = if (isSelected) Color.Black else RuvoColors.textPrimary, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Icon", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textSecondary)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    HABIT_ICONS.forEach { option ->
                        val isSelected = option.id == selectedIcon
                        Surface(
                            onClick = { selectedIcon = option.id },
                            shape = RoundedCornerShape(12.dp),
                            color = if (isSelected) RuvoColors.limeDim else RuvoColors.surfaceElev,
                            border = BorderStroke(if (isSelected) 2.dp else 1.dp, if (isSelected) RuvoColors.lime else RuvoColors.border),
                            modifier = Modifier.size(48.dp),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(option.icon, contentDescription = option.id, tint = if (isSelected) RuvoColors.lime else RuvoColors.textSecondary, modifier = Modifier.size(22.dp))
                            }
                        }
                    }
                }
            }

            RuvoButton(
                text = "Create Habit",
                onClick = { onCreate(name.trim(), description.trim(), frequency, selectedIcon) },
                enabled = name.isNotBlank(),
            )

            Spacer(Modifier.height(20.dp))
        }
    }
}
