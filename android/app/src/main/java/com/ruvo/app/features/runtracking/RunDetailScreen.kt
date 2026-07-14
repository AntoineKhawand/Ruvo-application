package com.ruvo.app.features.runtracking

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class RunSplit(val km: Int, val paceSecondsPerKm: Int, val heartRate: Int?)

data class RunDetailUiState(
    val distanceKm: Double = 0.0,
    val durationSeconds: Long = 0,
    val avgPaceSecondsPerKm: Int = 0,
    val calories: Int = 0,
    val avgHeartRate: Int? = null,
    val elevationGainM: Double = 0.0,
    val splits: List<RunSplit> = emptyList(),
    val aiInsight: String = "",
    val date: String = "",
    val isLoading: Boolean = true,
)

@HiltViewModel
class RunDetailViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _uiState = MutableStateFlow(RunDetailUiState())
    val uiState: StateFlow<RunDetailUiState> = _uiState.asStateFlow()

    fun load(runId: String) {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            try {
                val doc = firestore.collection("users").document(uid)
                    .collection("runs").document(runId).get().await()
                val d = doc.data ?: return@launch

                @Suppress("UNCHECKED_CAST")
                val splitsRaw = (d["splits"] as? List<Map<String, Any>>) ?: emptyList()
                val splits = splitsRaw.mapIndexed { i, s ->
                    RunSplit(
                        km = i + 1,
                        paceSecondsPerKm = (s["paceSecondsPerKm"] as? Number)?.toInt() ?: 0,
                        heartRate = (s["heartRate"] as? Number)?.toInt(),
                    )
                }

                val ts = d["startedAt"] as? com.google.firebase.Timestamp
                val dateStr = if (ts != null) {
                    val sdf = java.text.SimpleDateFormat("MMM d, yyyy", java.util.Locale.getDefault())
                    sdf.format(ts.toDate())
                } else ""

                val dist = (d["distanceKm"] as? Number)?.toDouble() ?: 0.0
                val dur = (d["durationSeconds"] as? Number)?.toLong() ?: 0L
                val avgPace = if (dist > 0) (dur / dist).toInt() else 0

                val insight = buildAiInsight(dist, avgPace, splits)

                _uiState.value = RunDetailUiState(
                    distanceKm = dist,
                    durationSeconds = dur,
                    avgPaceSecondsPerKm = avgPace,
                    calories = (d["calories"] as? Number)?.toInt() ?: 0,
                    avgHeartRate = (d["avgHeartRate"] as? Number)?.toInt(),
                    elevationGainM = (d["elevationGainM"] as? Number)?.toDouble() ?: 0.0,
                    splits = splits,
                    aiInsight = insight,
                    date = dateStr,
                    isLoading = false,
                )
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }

    private fun buildAiInsight(dist: Double, avgPace: Int, splits: List<RunSplit>): String {
        if (splits.size < 2) return "Great effort on your run! Keep it up."
        val firstHalf = splits.take(splits.size / 2).map { it.paceSecondsPerKm }.average()
        val secondHalf = splits.drop(splits.size / 2).map { it.paceSecondsPerKm }.average()
        return when {
            secondHalf < firstHalf * 0.97 -> "Excellent negative split! Your second half was faster — a sign of strong pacing strategy."
            secondHalf > firstHalf * 1.05 -> "You started strong but faded slightly in the second half. Try a more conservative early pace next time."
            else -> "Solid, even-paced effort across ${String.format("%.1f", dist)} km. Consistency is the foundation of improvement!"
        }
    }
}

private fun formatPace(seconds: Int): String {
    val m = seconds / 60
    val s = seconds % 60
    return "%d:%02d".format(m, s)
}

private fun formatDuration(seconds: Long): String {
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

@Composable
fun RunDetailScreen(
    runId: String,
    onBack: () -> Unit = {},
    viewModel: RunDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(runId) { viewModel.load(runId) }

    Column(
        modifier = Modifier.fillMaxSize().background(RuvoColors.background).verticalScroll(rememberScrollState()),
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary) }
            Column(modifier = Modifier.weight(1f)) {
                Text("Run Detail", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
                if (uiState.date.isNotBlank()) Text(uiState.date, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }
        }

        if (uiState.isLoading) {
            Box(modifier = Modifier.fillMaxWidth().height(300.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = RuvoColors.lime) }
            return@Column
        }

        // Key stats
        Surface(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            shape = RoundedCornerShape(20.dp),
            color = RuvoColors.surface,
            border = BorderStroke(1.dp, RuvoColors.border),
        ) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                    StatBlock("${String.format("%.2f", uiState.distanceKm)}", "km", RuvoColors.lime)
                    StatBlock(formatDuration(uiState.durationSeconds), "duration", RuvoColors.textPrimary)
                    StatBlock(formatPace(uiState.avgPaceSecondsPerKm) + "/km", "avg pace", Color(0xFF5BE9FF))
                }
                HorizontalDivider(color = RuvoColors.border)
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                    StatBlock("${uiState.calories}", "kcal", Color(0xFFFF6D40))
                    StatBlock(if (uiState.avgHeartRate != null) "${uiState.avgHeartRate} bpm" else "—", "avg HR", Color(0xFFE53E3E))
                    StatBlock("${String.format("%.0f", uiState.elevationGainM)} m", "elevation", Color(0xFF9C8EFF))
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // AI Insight
        if (uiState.aiInsight.isNotBlank()) {
            Surface(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                shape = RoundedCornerShape(16.dp),
                color = RuvoColors.lime.copy(alpha = 0.1f),
                border = BorderStroke(1.dp, RuvoColors.lime.copy(alpha = 0.3f)),
            ) {
                Row(modifier = Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("🤖", fontSize = 20.sp)
                    Column {
                        Text("AI Coach Insight", style = MaterialTheme.typography.labelMedium, color = RuvoColors.lime, fontWeight = FontWeight.Bold)
                        Text(uiState.aiInsight, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                    }
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // Splits
        if (uiState.splits.isNotEmpty()) {
            Text(
                "Splits",
                style = MaterialTheme.typography.titleMedium,
                color = RuvoColors.textPrimary,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
            )
            Surface(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                shape = RoundedCornerShape(16.dp),
                color = RuvoColors.surface,
                border = BorderStroke(1.dp, RuvoColors.border),
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text("KM", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, modifier = Modifier.weight(1f))
                        Text("PACE", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
                        Text("HR", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
                    }
                    HorizontalDivider(color = RuvoColors.border)
                    uiState.splits.forEachIndexed { index, split ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("${split.km}", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                            Text(formatPace(split.paceSecondsPerKm) + "/km", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.lime, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
                            Text(if (split.heartRate != null) "${split.heartRate} bpm" else "—", style = MaterialTheme.typography.bodySmall, color = Color(0xFFE53E3E), textAlign = TextAlign.End, modifier = Modifier.weight(1f))
                        }
                        if (index < uiState.splits.size - 1) HorizontalDivider(color = RuvoColors.border.copy(alpha = 0.5f))
                    }
                }
            }
        }

        Spacer(Modifier.height(80.dp))
    }
}

@Composable
private fun StatBlock(value: String, label: String, valueColor: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(value, style = MaterialTheme.typography.titleLarge, color = valueColor, fontWeight = FontWeight.Bold, fontSize = 22.sp)
        Text(label, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
    }
}
