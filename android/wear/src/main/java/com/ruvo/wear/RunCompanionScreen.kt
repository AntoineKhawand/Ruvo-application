package com.ruvo.wear

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import com.ruvo.wear.shared.RunStatsPayload

// Phone-tracked companion screen — mirrors whatever RunTrackingService on
// the paired phone is doing; this watch never tracks GPS itself (see the
// scope decision in RN_ANDROID_PORT_MAPPING.md). Deliberately minimal: one
// glanceable stats readout plus one primary action button, matching a
// watch screen's real constraints (small, round/square display, glanced at
// mid-stride) rather than porting the phone's full run-tracking UI.
@Composable
fun RunCompanionScreen(viewModel: RunCompanionViewModel) {
    val stats by viewModel.latestStats.collectAsStateWithLifecycle()

    Scaffold(timeText = { TimeText() }) {
        Column(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            if (stats == null) {
                Text("Start a run\non your phone,\nor tap below", textAlign = androidx.compose.ui.text.style.TextAlign.Center, style = MaterialTheme.typography.body2)
            } else {
                StatsReadout(stats!!)
            }
            Spacer(Modifier.height(12.dp))
            ControlButtons(runState = stats?.runState ?: "Idle", viewModel = viewModel)
        }
    }
}

@Composable
private fun StatsReadout(stats: RunStatsPayload) {
    Text("%.2f km".format(stats.distanceKm), style = MaterialTheme.typography.title1, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(4.dp))
    Text(formatElapsed(stats.elapsedSeconds), style = MaterialTheme.typography.title3)
    Spacer(Modifier.height(2.dp))
    Text(formatPace(stats.paceMinPerKm) + " /km", style = MaterialTheme.typography.body2)
}

@Composable
private fun ControlButtons(runState: String, viewModel: RunCompanionViewModel) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        when (runState) {
            "Running" -> {
                Button(onClick = { viewModel.pause() }, colors = ButtonDefaults.secondaryButtonColors()) { Text("⏸") }
                Button(onClick = { viewModel.stop() }, colors = ButtonDefaults.primaryButtonColors(backgroundColor = androidx.compose.ui.graphics.Color(0xFFEF4444))) { Text("⏹") }
            }
            "Paused" -> {
                Button(onClick = { viewModel.resume() }) { Text("▶") }
                Button(onClick = { viewModel.stop() }, colors = ButtonDefaults.primaryButtonColors(backgroundColor = androidx.compose.ui.graphics.Color(0xFFEF4444))) { Text("⏹") }
            }
            else -> {
                Button(onClick = { viewModel.start() }) { Text("▶ Start") }
            }
        }
    }
}

// Same "MM:SS"/"H:MM:SS" formatting convention every other elapsed-time
// display in this app uses.
internal fun formatElapsed(seconds: Int): String {
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

internal fun formatPace(paceMinPerKm: Double): String {
    if (paceMinPerKm <= 0 || paceMinPerKm > 30) return "--:--"
    val min = paceMinPerKm.toInt()
    val sec = ((paceMinPerKm - min) * 60).toInt()
    return "%d:%02d".format(min, sec)
}
