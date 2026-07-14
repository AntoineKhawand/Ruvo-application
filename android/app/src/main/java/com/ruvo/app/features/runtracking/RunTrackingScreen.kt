package com.ruvo.app.features.runtracking

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.*
import com.ruvo.app.core.model.RoutePoint
import com.ruvo.app.core.model.RunRecord
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*

@Composable
fun RunTrackingScreen(
    onFinished: (RunRecord) -> Unit,
    onDismiss: () -> Unit,
    viewModel: RunTrackingViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.bindService() }

    Box(modifier = Modifier.fillMaxSize()) {
        // Map background
        RunMap(routeCoordinates = uiState.routeCoordinates)

        // UI overlay
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            RunHUD(
                elapsedSeconds = uiState.elapsedSeconds,
                isLiveSharingEnabled = uiState.isLiveSharingEnabled,
                onToggleLiveSharing = viewModel::toggleLiveSharing,
                onClose = onDismiss
            )
            Spacer(modifier = Modifier.weight(1f))
            RunControls(
                uiState = uiState,
                onStart = viewModel::startCountdown,
                onPause = viewModel::pause,
                onResume = viewModel::resume,
                onLap = viewModel::lap,
                onStop = viewModel::finishRun,
            )
        }

        // Countdown overlay
        AnimatedVisibility(
            visible = uiState.runState is RunState.Countdown,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            CountdownOverlay(seconds = (uiState.runState as? RunState.Countdown)?.seconds ?: 0)
        }

        // Finished overlay
        AnimatedVisibility(
            visible = uiState.runState is RunState.Finished,
            enter = slideInVertically(initialOffsetY = { it }),
            exit = slideOutVertically(targetOffsetY = { it })
        ) {
            RunFinishedSheet(uiState = uiState, onDone = { run -> onFinished(run) })
        }
    }
}

@Composable
fun RunMap(routeCoordinates: List<Pair<Double, Double>>) {
    val cameraPositionState = rememberCameraPositionState {
        if (routeCoordinates.isNotEmpty()) {
            position = CameraPosition.fromLatLngZoom(
                LatLng(routeCoordinates.last().first, routeCoordinates.last().second), 16f
            )
        }
    }

    LaunchedEffect(routeCoordinates.lastOrNull()) {
        routeCoordinates.lastOrNull()?.let { (lat, lng) ->
            cameraPositionState.animate(
                com.google.android.gms.maps.CameraUpdateFactory.newLatLng(LatLng(lat, lng))
            )
        }
    }

    GoogleMap(
        modifier = Modifier.fillMaxSize(),
        cameraPositionState = cameraPositionState,
        properties = MapProperties(mapType = MapType.NORMAL, isMyLocationEnabled = true),
        uiSettings = MapUiSettings(zoomControlsEnabled = false, myLocationButtonEnabled = false)
    ) {
        if (routeCoordinates.size > 1) {
            Polyline(
                points = routeCoordinates.map { (lat, lng) -> LatLng(lat, lng) },
                color = RuvoColors.lime,
                width = 8f
            )
        }
    }
}

@Composable
fun RunHUD(
    elapsedSeconds: Int,
    isLiveSharingEnabled: Boolean,
    onToggleLiveSharing: () -> Unit,
    onClose: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(RuvoColors.surface.copy(alpha = 0.85f))
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onClose) {
            Icon(Icons.Default.Close, contentDescription = "Close", tint = RuvoColors.textPrimary)
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = elapsedSeconds.toFormattedTime(),
                style = MaterialTheme.typography.displayMedium,
                color = RuvoColors.textPrimary,
            )
            Text("Duration", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textSecondary)
        }
        IconButton(onClick = onToggleLiveSharing) {
            Icon(
                if (isLiveSharingEnabled) Icons.Default.Wifi else Icons.Default.WifiOff,
                contentDescription = "Live sharing",
                tint = if (isLiveSharingEnabled) RuvoColors.lime else RuvoColors.textTertiary
            )
        }
    }
}

@Composable
fun RunControls(
    uiState: RunTrackingUiState,
    onStart: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onLap: () -> Unit,
    onStop: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
            .background(RuvoColors.surface.copy(alpha = 0.95f))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // Metrics row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            MetricCell("Distance", String.format("%.2f", uiState.distanceKm), "km")
            VerticalDivider()
            MetricCell("Pace", uiState.currentPaceMinPerKm.toFormattedPace(), "/km")
            VerticalDivider()
            MetricCell("Calories", "${uiState.calories}", "kcal")
        }

        // Control buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            CircleControlBtn(
                icon = Icons.Default.Flag,
                label = "Lap",
                enabled = uiState.runState is RunState.Running,
                onClick = onLap
            )
            MainRunBtn(runState = uiState.runState, onStart = onStart, onPause = onPause, onResume = onResume)
            CircleControlBtn(
                icon = Icons.Default.Stop,
                label = "Stop",
                enabled = uiState.runState is RunState.Running || uiState.runState is RunState.Paused,
                onClick = onStop
            )
        }
    }
}

@Composable
fun MetricCell(label: String, value: String, unit: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.headlineLarge, color = RuvoColors.textPrimary, fontWeight = FontWeight.Black)
        Text("$label $unit", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textSecondary)
    }
}

@Composable
fun VerticalDivider() {
    Box(modifier = Modifier.width(1.dp).height(40.dp).background(RuvoColors.border))
}

@Composable
fun MainRunBtn(
    runState: RunState,
    onStart: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(72.dp)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(RuvoColors.lime, Color(0xFFA8CC00))))
            .clickable {
                when (runState) {
                    is RunState.Idle -> onStart()
                    is RunState.Running -> onPause()
                    is RunState.Paused -> onResume()
                    else -> {}
                }
            },
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = when (runState) {
                is RunState.Running -> Icons.Default.Pause
                is RunState.Paused  -> Icons.Default.PlayArrow
                else                -> Icons.Default.DirectionsRun
            },
            contentDescription = "Run control",
            tint = Color.Black,
            modifier = Modifier.size(32.dp)
        )
    }
}

@Composable
fun CircleControlBtn(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, enabled: Boolean, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(
            modifier = Modifier
                .size(52.dp)
                .clip(CircleShape)
                .background(RuvoColors.surfaceElev)
                .border(1.dp, RuvoColors.border, CircleShape)
                .setAlpha(if (enabled) 1f else 0.3f)
                .clickable(enabled = enabled) { onClick() },
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = label, tint = RuvoColors.textSecondary, modifier = Modifier.size(20.dp))
        }
        Text(label, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textSecondary)
    }
}

@Composable
fun CountdownOverlay(seconds: Int) {
    Box(
        modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.6f)),
        contentAlignment = Alignment.Center
    ) {
        AnimatedContent(targetState = seconds, label = "countdown") { s ->
            Text(
                text = "$s",
                fontSize = 120.sp,
                fontWeight = FontWeight.Black,
                color = RuvoColors.lime,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
fun RunFinishedSheet(uiState: RunTrackingUiState, onDone: (RunRecord) -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.8f)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp)
                .clip(RoundedCornerShape(28.dp))
                .background(RuvoColors.surface)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Text("Run Complete!", style = MaterialTheme.typography.displayMedium, color = RuvoColors.lime)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                RuvoStatCard(label = "Distance", value = String.format("%.2f", uiState.distanceKm), unit = "km", modifier = Modifier.weight(1f))
                RuvoStatCard(label = "Duration", value = uiState.elapsedSeconds.toFormattedTime(), unit = "", modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                RuvoStatCard(label = "Avg. Pace", value = uiState.averagePaceMinPerKm.toFormattedPace(), unit = "/km", modifier = Modifier.weight(1f))
                RuvoStatCard(label = "Calories", value = "${uiState.calories}", unit = "kcal", modifier = Modifier.weight(1f))
            }
            RuvoButton(text = "See Summary", onClick = {
                val run = RunRecord(
                    distanceKm = uiState.distanceKm,
                    durationSeconds = uiState.elapsedSeconds,
                    averagePaceMinPerKm = uiState.averagePaceMinPerKm,
                    calories = uiState.calories,
                    laps = uiState.laps,
                    route = uiState.routeCoordinates.map { (lat, lng) -> RoutePoint(lat, lng) },
                    xpEarned = uiState.distanceKm.toInt() * 10,
                    coinsEarned = uiState.distanceKm.toInt() * 5,
                )
                onDone(run)
            })
        }
    }
}

private fun Int.toFormattedTime(): String {
    val h = this / 3600; val m = (this % 3600) / 60; val s = this % 60
    return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%d:%02d", m, s)
}

private fun Double.toFormattedPace(): String {
    if (this <= 0 || this > 30) return "--:--"
    val min = this.toInt(); val sec = ((this - min) * 60).toInt()
    return String.format("%d:%02d", min, sec)
}

private fun Modifier.setAlpha(a: Float): Modifier = this.alpha(a)
