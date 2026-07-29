package com.ruvo.app.features.analytics

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.unit.dp
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
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

// --- Models ---
data class DistancePR(val label: String, val bestTime: String?, val date: String?, val isNew: Boolean = false)
data class PRRecord(val id: String, val label: String, val value: String, val date: String)

data class PRUiState(
    val distancePRs: List<DistancePR> = emptyList(),
    val otherRecords: List<PRRecord> = emptyList(),
    val isLoading: Boolean = false,
)

// --- ViewModel ---
@HiltViewModel
class PersonalRecordsViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PRUiState())
    val uiState: StateFlow<PRUiState> = _uiState.asStateFlow()

    init { loadPRs() }

    private data class ValidRun(val distanceKm: Double, val durationSeconds: Long, val calories: Int, val date: Date?)

    // The real saveRunActivity Cloud Function (functions/index.js) writes each
    // finished run as one entry in the users/{uid}.runHistory ARRAY field — there
    // is no users/{uid}/runs subcollection (see RN_ANDROID_PORT_MAPPING.md's
    // "Known Data-Layer Bugs" section). Also fixed the bucket algorithm itself to
    // match RN's real one (useAnalytics.js §7 "PERSONAL RECORDS", see
    // RN_SOURCE_ARCHIVE.md §2): each bucket is a minimum-distance THRESHOLD
    // (>=1/5/10/21.09km), not a narrow band around that exact distance, and the
    // record is whichever qualifying run has the BEST (lowest) average pace — not
    // literally the fastest time for a run near that exact distance. A 10K run at
    // a great pace legitimately counts as your 5K PR too, same as in RN.
    private fun loadPRs() {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val data = firestore.collection("users").document(uid).get().await().data
                @Suppress("UNCHECKED_CAST")
                val runHistory = data?.get("runHistory") as? List<Map<String, Any>> ?: emptyList()
                val sdf = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())

                // RN: a run is "valid" if distance>0 or duration>60s.
                val validRuns = runHistory.mapNotNull { r ->
                    val distanceKm = (r["distance"] as? Number)?.toDouble() ?: 0.0
                    val durParts = (r["duration"] as? String)?.split(":")?.mapNotNull { it.toLongOrNull() }
                    val durationSeconds = when (durParts?.size) {
                        2 -> durParts[0] * 60 + durParts[1]
                        3 -> durParts[0] * 3600 + durParts[1] * 60 + durParts[2]
                        else -> 0L
                    }
                    if (distanceKm <= 0 && durationSeconds <= 60) return@mapNotNull null
                    val date = (r["date"] as? String)?.let { runCatching { Date.from(java.time.Instant.parse(it)) }.getOrNull() }
                    ValidRun(distanceKm, durationSeconds, (r["calories"] as? Number)?.toInt() ?: 0, date)
                }

                // "Full" (Marathon) isn't computed in RN at all (a confirmed gap —
                // the UI row there silently never renders) — kept here since Android
                // already had a Marathon bucket and the same threshold/best-pace
                // algorithm applies naturally; not inventing new RN behavior, just
                // giving an existing bucket the correct data.
                val brackets = listOf(
                    "1K" to 1.0,
                    "5K" to 5.0,
                    "10K" to 10.0,
                    "Half" to 21.09,
                    "Full" to 42.195,
                )
                val prs = brackets.map { (label, threshold) ->
                    val best = validRuns
                        .filter { it.distanceKm >= threshold }
                        .minByOrNull { it.durationSeconds / it.distanceKm }
                    val dur = best?.durationSeconds?.toInt() ?: 0
                    val date = best?.date?.let { sdf.format(it) }
                    DistancePR(label = label, bestTime = if (dur > 0) dur.toFormattedDuration() else null, date = date)
                }

                val longest = validRuns.maxByOrNull { it.distanceKm }
                val fastest = validRuns.filter { it.distanceKm >= 1.0 }
                    .minByOrNull { it.durationSeconds / it.distanceKm }

                val others = buildList {
                    longest?.let {
                        add(PRRecord("longest", "Longest Run", String.format("%.2f km", it.distanceKm), it.date?.let(sdf::format) ?: ""))
                    }
                    fastest?.let {
                        val paceMinPerKm = it.durationSeconds / 60.0 / it.distanceKm
                        add(PRRecord("pace", "Best Pace", paceMinPerKm.toFormattedPace() + "/km", it.date?.let(sdf::format) ?: ""))
                    }
                    val maxCal = validRuns.maxOfOrNull { it.calories } ?: 0
                    if (maxCal > 0) add(PRRecord("cal", "Most Calories", "$maxCal kcal", ""))
                }

                _uiState.value = _uiState.value.copy(distancePRs = prs, otherRecords = others, isLoading = false)
            } catch (_: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }
}

// --- Screen ---
@Composable
fun PersonalRecordsScreen(viewModel: PersonalRecordsViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier.fillMaxSize().background(RuvoColors.background).verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text("Personal Records", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)
                Text("Your all-time bests", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            }
            Text("🏆", style = MaterialTheme.typography.displayMedium)
        }

        if (uiState.isLoading) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = RuvoColors.lime)
            }
        } else {
            // Distance PRs grid
            Text("Race Distances", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.height(260.dp),
                userScrollEnabled = false,
            ) {
                items(uiState.distancePRs) { pr ->
                    PRCard(pr = pr)
                }
            }

            // Other records
            if (uiState.otherRecords.isNotEmpty()) {
                Text("Other Bests", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
                uiState.otherRecords.forEach { record ->
                    PRRowCard(record = record)
                }
            }
        }

        Spacer(modifier = Modifier.height(80.dp))
    }
}

@Composable
private fun PRCard(pr: DistancePR) {
    RuvoCard(isHighlighted = pr.isNew) {
        Column(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(pr.label, style = MaterialTheme.typography.headlineSmall, color = RuvoColors.lime)
            if (pr.bestTime != null) {
                Text(pr.bestTime, style = MaterialTheme.typography.titleLarge, color = RuvoColors.textPrimary)
                Text(pr.date ?: "", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            } else {
                Text("Not yet run", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }
            if (pr.isNew) RuvoChip(label = "NEW PR! 🎉", isActive = true)
        }
    }
}

@Composable
private fun PRRowCard(record: PRRecord) {
    RuvoCard {
        Row(modifier = Modifier.padding(14.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text(record.label, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary)
                if (record.date.isNotEmpty()) Text(record.date, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }
            Text(record.value, style = MaterialTheme.typography.headlineSmall, color = RuvoColors.lime)
        }
    }
}

private fun Int.toFormattedDuration(): String {
    val h = this / 3600; val m = (this % 3600) / 60; val s = this % 60
    return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%d:%02d", m, s)
}

private fun Double.toFormattedPace(): String {
    if (this <= 0 || this > 30) return "--:--"
    val min = this.toInt(); val sec = ((this - min) * 60).toInt()
    return String.format("%d:%02d", min, sec)
}
