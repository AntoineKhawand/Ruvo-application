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

data class RunSplit(val lapNumber: Int, val distanceKm: Double, val paceSecondsPerKm: Int)

data class RunDetailUiState(
    val title: String = "Run Detail",
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
                // The real saveRunActivity Cloud Function (functions/index.js) writes
                // each finished run as an entry in the users/{uid}.runHistory ARRAY
                // field — there is no per-run subcollection document. RN's own
                // RunDetailScreen.js tries to hydrate from users/{uid}/runs/{id} for
                // "full detail", but nothing in the real save path (Cloud Function or
                // client) ever writes there — a dead RN read path, not something to
                // port (RN_SOURCE_ARCHIVE.md §9's runEntry already carries every field
                // this screen needs, undenormalized).
                val doc = firestore.collection("users").document(uid).get().await()
                val data = doc.data ?: return@launch
                @Suppress("UNCHECKED_CAST")
                val runHistory = data["runHistory"] as? List<Map<String, Any>> ?: emptyList()
                val run = runHistory.firstOrNull { it["id"] == runId } ?: return@launch

                @Suppress("UNCHECKED_CAST")
                val splitsRaw = (run["kmSplits"] as? List<Map<String, Any>>) ?: emptyList()
                val splits = splitsRaw.mapNotNull { s ->
                    val lapNumber = (s["lapNumber"] as? Number)?.toInt() ?: return@mapNotNull null
                    val splitDistKm = (s["distanceKm"] as? Number)?.toDouble() ?: 0.0
                    val splitDurSec = (s["durationSeconds"] as? Number)?.toInt() ?: 0
                    val paceSec = if (splitDistKm > 0) (splitDurSec / splitDistKm).toInt() else 0
                    RunSplit(lapNumber = lapNumber, distanceKm = splitDistKm, paceSecondsPerKm = paceSec)
                }

                // "date" is an ISO-8601 Instant string (java.time.Instant.now().toString()
                // from RuvoApp.kt), not a Firestore Timestamp field.
                val dateStr = (run["date"] as? String)?.let { iso ->
                    runCatching {
                        val sdf = java.text.SimpleDateFormat("MMM d, yyyy", java.util.Locale.getDefault())
                        sdf.format(java.util.Date.from(java.time.Instant.parse(iso)))
                    }.getOrNull()
                } ?: ""

                val dist = (run["distance"] as? Number)?.toDouble() ?: 0.0
                // "duration" is an "MM:SS"/"H:MM:SS" string, matching the same format
                // saveRunActivity itself parses server-side — not a numeric seconds field.
                val durSec = parseDurationToSeconds(run["duration"] as? String)
                val avgPace = if (dist > 0) (durSec / dist).toInt() else 0

                val insight = buildAiInsight(dist, avgPace, splits)

                _uiState.value = RunDetailUiState(
                    title = (run["title"] as? String)?.takeIf { it.isNotBlank() } ?: "Run Detail",
                    distanceKm = dist,
                    durationSeconds = durSec,
                    avgPaceSecondsPerKm = avgPace,
                    calories = (run["calories"] as? Number)?.toInt() ?: 0,
                    // heartRate is the run's single average BPM (RuvoApp.kt's
                    // averageHeartRate) — not a per-split value, and not present at all
                    // pre-2026-07-29 or when Health Connect had no data during the run.
                    avgHeartRate = (run["heartRate"] as? Number)?.toInt()?.takeIf { it > 0 },
                    elevationGainM = (run["elevationGain"] as? Number)?.toDouble() ?: 0.0,
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

    private fun parseDurationToSeconds(duration: String?): Long {
        val parts = duration?.split(":")?.mapNotNull { it.toLongOrNull() } ?: return 0L
        return when (parts.size) {
            2 -> parts[0] * 60 + parts[1]
            3 -> parts[0] * 3600 + parts[1] * 60 + parts[2]
            else -> 0L
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
                Text(uiState.title, style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
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
                    StatBlock(if (uiState.avgPaceSecondsPerKm > 0) formatPace(uiState.avgPaceSecondsPerKm) + "/km" else "--:--", "avg pace", Color(0xFF5BE9FF))
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
                        Text("LAP", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, modifier = Modifier.weight(1f))
                        Text("DISTANCE", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
                        Text("PACE", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
                    }
                    HorizontalDivider(color = RuvoColors.border)
                    uiState.splits.forEachIndexed { index, split ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("${split.lapNumber}", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                            Text(String.format("%.2f km", split.distanceKm), style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
                            Text(formatPace(split.paceSecondsPerKm) + "/km", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.lime, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
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
