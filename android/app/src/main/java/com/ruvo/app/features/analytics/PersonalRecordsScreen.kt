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
import com.google.firebase.firestore.Query
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

    private fun loadPRs() {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val snap = firestore.collection("users").document(uid).collection("runs")
                    .orderBy("startedAt", Query.Direction.ASCENDING)
                    .get().await()
                val docs = snap.documents
                val sdf = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())

                val brackets = listOf(
                    Triple("5K", 4.9, 5.5),
                    Triple("10K", 9.8, 11.0),
                    Triple("Half", 20.5, 22.0),
                    Triple("Full", 41.0, 43.5),
                )
                val prs = brackets.map { (label, min, max) ->
                    val candidates = docs.filter { (it.getDouble("distanceKm") ?: 0.0) in min..max }
                    val best = candidates.minByOrNull { it.getLong("durationSeconds") ?: Long.MAX_VALUE }
                    val dur = (best?.getLong("durationSeconds") ?: 0L).toInt()
                    val date = best?.getTimestamp("startedAt")?.toDate()?.let { sdf.format(it) }
                    DistancePR(label = label, bestTime = if (dur > 0) dur.toFormattedDuration() else null, date = date)
                }

                val allDist = docs.map { it.getDouble("distanceKm") ?: 0.0 }
                val allPaces = docs.filter { (it.getDouble("distanceKm") ?: 0.0) >= 1.0 }
                    .map { it.getDouble("averagePaceMinPerKm") ?: Double.MAX_VALUE }
                val longestDoc = docs.maxByOrNull { it.getDouble("distanceKm") ?: 0.0 }
                val fastestPaceDoc = allPaces.filter { it < 30 && it > 0 }.minOrNull()

                val others = buildList {
                    longestDoc?.let {
                        val d = it.getDouble("distanceKm") ?: 0.0
                        val date = it.getTimestamp("startedAt")?.toDate()?.let { d2 -> sdf.format(d2) } ?: ""
                        add(PRRecord("longest", "Longest Run", String.format("%.2f km", d), date))
                    }
                    fastestPaceDoc?.let { pace ->
                        val fastDoc = docs.minByOrNull { (it.getDouble("averagePaceMinPerKm") ?: Double.MAX_VALUE) }
                        val date = fastDoc?.getTimestamp("startedAt")?.toDate()?.let { d -> sdf.format(d) } ?: ""
                        add(PRRecord("pace", "Best Pace", pace.toFormattedPace() + "/km", date))
                    }
                    val maxCal = docs.maxOfOrNull { (it.getLong("calories") ?: 0L).toInt() } ?: 0
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
