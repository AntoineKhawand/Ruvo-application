package com.ruvo.app.features.runtracking

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.maps.android.compose.*
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
    // RN_SOURCE_ARCHIVE.md §4's "still missing" sub-features, built 2026-08-25
    // using only fields the real save path actually writes — see comments below.
    val routePoints: List<Pair<Double, Double>> = emptyList(),
    val tags: List<String> = emptyList(),
    // Same maxHR=220-30 / 60-70-80-90% thresholds AnalyticsViewModel's HR
    // Zones card already uses, applied to this one run's average BPM instead
    // of a distribution across many runs — kept identical so the two screens
    // can never disagree about what zone a given BPM falls in.
    val hrZoneIndex: Int? = null,
    val coachPrompt: String = "",
    // Competitor-analysis Tier 2 #6 (Segments) — this run's own route/distance
    // become a segment's definition and first effort. showCreateSegmentDialog
    // gates the naming prompt; segmentCreated flips once so the button can
    // show a brief confirmation instead of silently doing nothing visible.
    val showCreateSegmentDialog: Boolean = false,
    val isCreatingSegment: Boolean = false,
    val segmentCreated: Boolean = false,
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

                // routePath entries are written by RuvoApp.kt::submitRunActivity as
                // {"latitude":.., "longitude":..} maps — only present for GPS-tracked
                // runs (RunTrackingViewModel), never for SaveActivityScreen's manual
                // "Log Activity" entries. Matches archive §4's documented "GPS data
                // not available" empty state for exactly that case.
                @Suppress("UNCHECKED_CAST")
                val routeRaw = (run["routePath"] as? List<Map<String, Any>>) ?: emptyList()
                val routePoints = routeRaw.mapNotNull { p ->
                    val lat = (p["latitude"] as? Number)?.toDouble() ?: return@mapNotNull null
                    val lng = (p["longitude"] as? Number)?.toDouble() ?: return@mapNotNull null
                    lat to lng
                }

                // "tags" is RateEffortScreen's real context-condition chips
                // ("Strong 💪", "Hilly ⛰️", ...), flowing through
                // RuvoApp.kt::submitRunActivity's runEntry — not invented for this card.
                @Suppress("UNCHECKED_CAST")
                val tags = (run["tags"] as? List<String>) ?: emptyList()

                val avgHr = (run["heartRate"] as? Number)?.toInt()?.takeIf { it > 0 }
                // Real age from "dob" (OnboardingScreen's Bio step, 2026-08-25) when
                // present, else RN's own documented age-30 fallback — identical
                // computation to AnalyticsViewModel's HR Zones card, kept in sync
                // deliberately (see that file's comment).
                val age = (data["dob"] as? String)?.let { runCatching { java.time.LocalDate.parse(it) }.getOrNull() }
                    ?.let { java.time.Period.between(it, java.time.LocalDate.now()).years }
                    ?.takeIf { it in 5..110 }
                    ?: 30
                val maxHr = 220 - age
                val hrZoneIndex = avgHr?.let { hr ->
                    when (val pct = hr.toDouble() / maxHr) {
                        in 0.0..<0.6 -> 0
                        in 0.6..<0.7 -> 1
                        in 0.7..<0.8 -> 2
                        in 0.8..<0.9 -> 3
                        else -> if (pct >= 0.9) 4 else 0
                    }
                }

                // RN_SOURCE_ARCHIVE.md §4's exact hand-off template: `Based on my
                // ${distance}km run at ${pace}/km: "${aiInsight}" — what should my next
                // training week look like?`. RN's aiInsight comes from a stored
                // Gemini-generated field this app never had (no per-run AI insight is
                // ever generated/stored anywhere) — substituting the same locally-
                // computed summary this screen's own "AI Coach Insight" card already
                // shows, not inventing new content for the prompt.
                val paceStr = if (avgPace > 0) formatPace(avgPace) else "--:--"
                val coachPrompt = "Based on my ${String.format("%.2f", dist)}km run at $paceStr/km: " +
                    "\"$insight\" — what should my next training week look like?"

                _uiState.value = RunDetailUiState(
                    title = (run["title"] as? String)?.takeIf { it.isNotBlank() } ?: "Run Detail",
                    distanceKm = dist,
                    durationSeconds = durSec,
                    avgPaceSecondsPerKm = avgPace,
                    calories = (run["calories"] as? Number)?.toInt() ?: 0,
                    // heartRate is the run's single average BPM (RuvoApp.kt's
                    // averageHeartRate) — not a per-split value, and not present at all
                    // pre-2026-07-29 or when Health Connect had no data during the run.
                    avgHeartRate = avgHr,
                    elevationGainM = (run["elevationGain"] as? Number)?.toDouble() ?: 0.0,
                    splits = splits,
                    aiInsight = insight,
                    date = dateStr,
                    isLoading = false,
                    routePoints = routePoints,
                    tags = tags,
                    hrZoneIndex = hrZoneIndex,
                    coachPrompt = coachPrompt,
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

    fun openCreateSegmentDialog() { _uiState.update { it.copy(showCreateSegmentDialog = true) } }
    fun closeCreateSegmentDialog() { _uiState.update { it.copy(showCreateSegmentDialog = false) } }

    // Competitor-analysis Tier 2 #6 — the whole run becomes the segment (no
    // manual start/end point picker in this first version): its actual
    // route is the segment's polyline, its own duration is automatically
    // recorded as the creator's first effort. Firestore writes are a plain
    // "segments" top-level collection (not per-user) since a segment is
    // inherently shared, not owned data the way runHistory is.
    fun createSegment(runId: String, name: String) {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return
        val state = _uiState.value
        if (state.routePoints.size < 2) return
        viewModelScope.launch {
            _uiState.update { it.copy(isCreatingSegment = true) }
            try {
                val uid = auth.currentUser?.uid ?: return@launch
                val myName = firestore.collection("users").document(uid).get().await()
                    .let { it.getString("name") ?: it.getString("displayName") ?: "Runner" }
                val start = state.routePoints.first()
                val end = state.routePoints.last()
                val segmentDoc = mapOf(
                    "name" to trimmed,
                    "creatorUid" to uid,
                    "creatorName" to myName,
                    "distanceKm" to state.distanceKm,
                    "startLat" to start.first,
                    "startLng" to start.second,
                    "endLat" to end.first,
                    "endLng" to end.second,
                    // Downsampled — a full GPS-rate polyline is overkill for a
                    // list-card sketch and a leaderboard's map preview.
                    "polyline" to state.routePoints
                        .filterIndexed { i, _ -> i % maxOf(state.routePoints.size / 40, 1) == 0 }
                        .map { mapOf("lat" to it.first, "lng" to it.second) },
                    "sourceRunId" to runId,
                    "createdAt" to com.google.firebase.Timestamp.now(),
                )
                val ref = firestore.collection("segments").add(segmentDoc).await()
                ref.collection("efforts").document(uid).set(
                    mapOf(
                        "uid" to uid,
                        "userName" to myName,
                        "bestSeconds" to state.durationSeconds.toInt(),
                        "runId" to runId,
                    )
                ).await()
                _uiState.update { it.copy(isCreatingSegment = false, showCreateSegmentDialog = false, segmentCreated = true) }
            } catch (_: Exception) {
                _uiState.update { it.copy(isCreatingSegment = false) }
            }
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
    onCoachHandoff: (String) -> Unit = {},
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

        // Tags — RateEffortScreen's context chips ("Strong 💪", "Hilly ⛰️", ...),
        // conditional per archive §4 ("Private Notes / Description cards
        // (conditional) → Tags row").
        if (uiState.tags.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                uiState.tags.forEach { tag ->
                    Surface(shape = RoundedCornerShape(20.dp), color = RuvoColors.surfaceElev, border = BorderStroke(1.dp, RuvoColors.border)) {
                        Text(tag, modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp), style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                    }
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // Route map — archive §4: "map/route section (static polyline...);
        // 'GPS data not available' empty state". Manually-logged runs
        // (SaveActivityScreen) never have a routePath, so this is the
        // expected/common empty case for those, not a bug.
        Text(
            "Route",
            style = MaterialTheme.typography.titleMedium,
            color = RuvoColors.textPrimary,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
        )
        Surface(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(220.dp),
            shape = RoundedCornerShape(16.dp),
            color = RuvoColors.surface,
            border = BorderStroke(1.dp, RuvoColors.border),
        ) {
            if (uiState.routePoints.size > 1) {
                RunRouteMap(points = uiState.routePoints)
            } else {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(Icons.Default.Map, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(32.dp))
                        Text("GPS data not available", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                    }
                }
            }
        }

        // Competitor-analysis Tier 2 #6 — turn this run's own route into a
        // Segment leaderboard other people you follow can compete on.
        if (uiState.routePoints.size > 1) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (uiState.segmentCreated) {
                    Text("✓ Segment created", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.lime)
                } else {
                    TextButton(onClick = { viewModel.openCreateSegmentDialog() }) {
                        Icon(Icons.Default.Flag, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Create Segment from this route", color = RuvoColors.lime)
                    }
                }
            }
        }

        // Heart Rate Zone — archive §4: "Heart Rate Analysis card (big BPM,
        // zone badge, 5-segment zone bar)". Same maxHR=220-30 / 60-70-80-90%
        // thresholds as AnalyticsViewModel's HR Zones card (see that file's
        // comment on the age fallback), applied to just this run's average BPM.
        if (uiState.avgHeartRate != null && uiState.hrZoneIndex != null) {
            Spacer(Modifier.height(16.dp))
            Text(
                "Heart Rate",
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
                HrZoneCard(avgBpm = uiState.avgHeartRate!!, zoneIndex = uiState.hrZoneIndex!!)
            }
        }

        Spacer(Modifier.height(16.dp))

        // AI Insight — archive §4: "AI Insight card (shows run.aiInsight,
        // 'Continue with AI Coach' button)"; Navigation: navigate('AICoach',
        // { initialPrompt }) using the exact template built in coachPrompt above.
        if (uiState.aiInsight.isNotBlank()) {
            Surface(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                shape = RoundedCornerShape(16.dp),
                color = RuvoColors.lime.copy(alpha = 0.1f),
                border = BorderStroke(1.dp, RuvoColors.lime.copy(alpha = 0.3f)),
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("🤖", fontSize = 20.sp)
                        Column {
                            Text("AI Coach Insight", style = MaterialTheme.typography.labelMedium, color = RuvoColors.lime, fontWeight = FontWeight.Bold)
                            Text(uiState.aiInsight, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                        }
                    }
                    TextButton(
                        onClick = { onCoachHandoff(uiState.coachPrompt) },
                        modifier = Modifier.align(Alignment.End),
                    ) {
                        Text("Continue with AI Coach", color = RuvoColors.lime, fontWeight = FontWeight.SemiBold)
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(18.dp))
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

    if (uiState.showCreateSegmentDialog) {
        CreateSegmentDialog(
            isSaving = uiState.isCreatingSegment,
            onDismiss = { viewModel.closeCreateSegmentDialog() },
            onCreate = { name -> viewModel.createSegment(runId, name) },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateSegmentDialog(isSaving: Boolean, onDismiss: () -> Unit, onCreate: (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = RuvoColors.surface,
        title = { Text("Create Segment", color = RuvoColors.textPrimary) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "This run's exact route becomes a leaderboard people you follow can compete on. Your own time on it is recorded automatically.",
                    style = MaterialTheme.typography.bodySmall,
                    color = RuvoColors.textSecondary,
                )
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Segment name") },
                    singleLine = true,
                    enabled = !isSaving,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = RuvoColors.textPrimary, unfocusedTextColor = RuvoColors.textPrimary,
                        focusedBorderColor = RuvoColors.lime, unfocusedBorderColor = RuvoColors.border,
                    ),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onCreate(name) }, enabled = name.isNotBlank() && !isSaving) {
                Text(if (isSaving) "Creating…" else "Create", color = RuvoColors.lime)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !isSaving) { Text("Cancel", color = RuvoColors.textTertiary) } },
    )
}

@Composable
private fun StatBlock(value: String, label: String, valueColor: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(value, style = MaterialTheme.typography.titleLarge, color = valueColor, fontWeight = FontWeight.Bold, fontSize = 22.sp)
        Text(label, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
    }
}

// Static (non-following, no live-location dot) route polyline — same
// GoogleMap/Polyline pattern RunTrackingScreen.kt's live RunMap already
// uses, camera fit to the whole route's bounds instead of following the
// last point.
@Composable
private fun RunRouteMap(points: List<Pair<Double, Double>>) {
    val latLngs = remember(points) { points.map { (lat, lng) -> LatLng(lat, lng) } }
    val cameraPositionState = rememberCameraPositionState()
    LaunchedEffect(latLngs) {
        if (latLngs.isEmpty()) return@LaunchedEffect
        val bounds = LatLngBounds.builder().apply { latLngs.forEach { include(it) } }.build()
        runCatching { cameraPositionState.move(com.google.android.gms.maps.CameraUpdateFactory.newLatLngBounds(bounds, 64)) }
            .onFailure {
                // newLatLngBounds needs a laid-out map view; fall back to a
                // plain center+zoom if that hasn't happened yet.
                cameraPositionState.position = CameraPosition.fromLatLngZoom(latLngs.first(), 15f)
            }
    }
    GoogleMap(
        modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(16.dp)),
        cameraPositionState = cameraPositionState,
        uiSettings = MapUiSettings(zoomControlsEnabled = false, scrollGesturesEnabled = false, zoomGesturesEnabled = false),
    ) {
        Marker(state = MarkerState(position = latLngs.first()), title = "Start")
        if (latLngs.size > 1) Marker(state = MarkerState(position = latLngs.last()), title = "Finish")
        Polyline(points = latLngs, color = RuvoColors.lime, width = 7f)
    }
}

// "5-segment zone bar" per archive §4 — one segment per HR zone, the run's
// own zone highlighted; same Z1..Z5 colors AnalyticsViewModel's HR Zones
// card uses, kept in sync deliberately.
@Composable
private fun HrZoneCard(avgBpm: Int, zoneIndex: Int) {
    val zoneColors = listOf(Color(0xFF4ADE80), RuvoColors.lime, Color(0xFFFBBF24), Color(0xFFF97316), Color(0xFFEF4444))
    val zoneLabels = listOf("Z1 Easy", "Z2 Fat Burn", "Z3 Aerobic", "Z4 Threshold", "Z5 Max")
    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("$avgBpm", style = MaterialTheme.typography.displaySmall, color = zoneColors[zoneIndex], fontWeight = FontWeight.Bold)
            Column {
                Text("avg bpm", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                Surface(shape = RoundedCornerShape(8.dp), color = zoneColors[zoneIndex].copy(alpha = 0.15f)) {
                    Text(zoneLabels[zoneIndex], modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp), style = MaterialTheme.typography.labelSmall, color = zoneColors[zoneIndex], fontWeight = FontWeight.Bold)
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
            zoneColors.forEachIndexed { i, color ->
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(if (i == zoneIndex) 14.dp else 8.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(if (i == zoneIndex) color else color.copy(alpha = 0.3f)),
                )
            }
        }
    }
}
