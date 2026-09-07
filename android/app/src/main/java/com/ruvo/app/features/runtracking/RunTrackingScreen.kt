package com.ruvo.app.features.runtracking

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.health.connect.client.PermissionController
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap as RawGoogleMap
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MapStyleOptions
import com.google.maps.android.compose.*
import com.ruvo.app.R
import com.ruvo.app.core.model.RoutePoint
import com.ruvo.app.core.model.RunRecord
import com.ruvo.app.core.persistence.RunCheckpoint
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*
import kotlinx.coroutines.delay

private fun hasLocationPermission(context: android.content.Context): Boolean {
    return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
}

// RN spec: "dark/light/satellite/hybrid style picker modal" + a recenter
// button that "fades in when user pans the map away from follow mode"
// (RN_SOURCE_ARCHIVE.md §1, sub-task 8). Dark mode has no built-in MapType —
// it's a custom style JSON (res/raw/map_style_dark.json) layered on NORMAL.
enum class MapStyleChoice(val label: String, val mapType: MapType) {
    Light("Light", MapType.NORMAL),
    Dark("Dark", MapType.NORMAL),
    Satellite("Satellite", MapType.SATELLITE),
    Hybrid("Hybrid", MapType.HYBRID),
}

@Composable
fun RunTrackingScreen(
    onFinished: (RunRecord) -> Unit,
    onDismiss: () -> Unit,
    resumeCheckpoint: RunCheckpoint? = null,
    workoutSteps: List<IntervalStep>? = null,
    viewModel: RunTrackingViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    var hasPermission by remember { mutableStateOf(hasLocationPermission(context)) }
    var permissionPermanentlyDenied by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions(),
    ) { results ->
        hasPermission = results.values.any { it }
        if (!hasPermission) permissionPermanentlyDenied = true
    }

    LaunchedEffect(Unit) {
        if (!hasPermission) {
            permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        }
    }

    // RN: background location is requested non-blocking after foreground is granted
    // — a denial just shows a "set Always Allow in Settings" warning and the run
    // proceeds foreground-only, no forced dialog (RN_SOURCE_ARCHIVE.md §1,
    // sub-task 1). Android can't even ask for this permission before API 29, and
    // asking when it's already granted is a no-op.
    var showBackgroundLocationWarning by remember { mutableStateOf(false) }
    val backgroundLocationLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted -> if (!granted) showBackgroundLocationWarning = true }

    // Chained from the Health Connect launcher's own callback rather than fired
    // back-to-back with it in the same effect: launching two permission-request
    // Activities without waiting for the first one's result is a known Android
    // pitfall — the second launch() call gets silently dropped since only one
    // ActivityResultRegistry transition can be in flight at a time.
    fun maybeRequestBackgroundLocation() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED
        ) {
            backgroundLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }
    }

    val healthPermissionLauncher = rememberLauncherForActivityResult(
        contract = PermissionController.createRequestPermissionResultContract(),
    ) { /* denial is non-blocking: the run proceeds with no HR data */ maybeRequestBackgroundLocation() }

    LaunchedEffect(hasPermission) {
        if (hasPermission) {
            if (resumeCheckpoint != null) viewModel.resumeFromCheckpoint(resumeCheckpoint) else viewModel.bindService()
            if (workoutSteps != null) viewModel.startWorkoutMode(workoutSteps)
            val healthConnectPermissions = viewModel.healthConnectPermissionsNeeded()
            if (healthConnectPermissions != null) {
                healthPermissionLauncher.launch(healthConnectPermissions)
            } else {
                maybeRequestBackgroundLocation()
            }
        }
    }

    if (!hasPermission) {
        LocationPermissionRequired(
            permanentlyDenied = permissionPermanentlyDenied,
            onRequest = { permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) },
            onOpenSettings = {
                context.startActivity(
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
                )
            },
            onDismiss = onDismiss,
        )
        return
    }

    var mapStyleChoice by remember { mutableStateOf(MapStyleChoice.Light) }
    var showStyleMenu by remember { mutableStateOf(false) }
    var isFollowing by remember { mutableStateOf(true) }
    var recenterSignal by remember { mutableIntStateOf(0) }

    Box(modifier = Modifier.fillMaxSize()) {
        // Map background
        RunMap(
            routeCoordinates = uiState.routeCoordinates,
            mapStyleChoice = mapStyleChoice,
            isFollowing = isFollowing,
            onUserPanned = { isFollowing = false },
            recenterSignal = recenterSignal,
        )

        // UI overlay
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            RunHUD(
                elapsedSeconds = uiState.elapsedSeconds,
                workoutStep = uiState.currentWorkoutStep,
                workoutStepIndex = uiState.currentWorkoutStepIndex,
                workoutStepCount = uiState.workoutSteps.size,
                workoutStepRemainingSeconds = uiState.workoutStepRemainingSeconds,
                isLiveSharingEnabled = uiState.isLiveSharingEnabled,
                onToggleLiveSharing = {
                    // RN's live-share design calls startLiveRun/endLiveRun Cloud
                    // Functions that don't exist (RN itself never had a working
                    // shareUrl to send) and has no viewer for the result anyway.
                    // This shares a real deep link into LiveRunViewerScreen, which
                    // reads the same runs/{runId}/liveLocation/current doc this
                    // service already writes — a genuinely working first version.
                    val turningOn = !uiState.isLiveSharingEnabled
                    viewModel.toggleLiveSharing()
                    if (turningOn) {
                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(
                                Intent.EXTRA_TEXT,
                                "I'm live on a run with Ruvo! Follow along: com.ruvo.app://live/${viewModel.runId}",
                            )
                        }
                        context.startActivity(Intent.createChooser(shareIntent, "Share your live run"))
                    }
                },
                onClose = onDismiss,
                mapStyleChoice = mapStyleChoice,
                showStyleMenu = showStyleMenu,
                onToggleStyleMenu = { showStyleMenu = !showStyleMenu },
                onStyleSelected = { mapStyleChoice = it; showStyleMenu = false },
            )
            Spacer(modifier = Modifier.weight(1f))
            RunControls(
                uiState = uiState,
                isGpsReady = uiState.isGpsReady,
                onStart = viewModel::startCountdown,
                onPause = viewModel::pause,
                onResume = viewModel::resume,
                onLap = viewModel::lap,
                onStop = viewModel::finishRun,
                onToggleVoice = viewModel::toggleVoice,
            )
        }

        // RN: a non-voice "🏁 Lap Recorded" alert alongside the spoken "Lap N"
        // line (RN_SOURCE_ARCHIVE.md §1) — carries the distance/pace detail the
        // voice line no longer speaks.
        LaunchedEffect(uiState.lastLapBanner) {
            if (uiState.lastLapBanner != null) {
                delay(2500)
                viewModel.clearLapBanner()
            }
        }
        AnimatedVisibility(
            visible = uiState.lastLapBanner != null,
            enter = fadeIn() + slideInVertically(initialOffsetY = { -it / 2 }),
            exit = fadeOut(),
            modifier = Modifier.align(Alignment.TopCenter).padding(top = 110.dp),
        ) {
            uiState.lastLapBanner?.let { lap ->
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(RuvoColors.surfaceElev)
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("🏁", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Lap ${lap.number} recorded — ${String.format("%.2f", lap.distanceKm)} km · ${lap.paceMinPerKm.toFormattedPace()}/km",
                        style = MaterialTheme.typography.labelLarge,
                        color = RuvoColors.textPrimary,
                    )
                }
            }
        }

        AnimatedVisibility(
            visible = !isFollowing,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.align(Alignment.BottomEnd).padding(end = 20.dp, bottom = 220.dp),
        ) {
            FloatingActionButton(
                onClick = { isFollowing = true; recenterSignal++ },
                containerColor = RuvoColors.surfaceElev,
                contentColor = RuvoColors.lime,
            ) {
                Icon(Icons.Default.MyLocation, contentDescription = "Recenter")
            }
        }

        // RN: "'Acquiring GPS...' spinner overlay until gpsReady" (RN_SOURCE_ARCHIVE.md
        // §1). Only relevant in Idle — once Running/Paused/Finished a fix has
        // already landed (isGpsReady gates the Start countdown from ever firing
        // without one).
        AnimatedVisibility(
            visible = !uiState.isGpsReady && uiState.runState is RunState.Idle,
            enter = fadeIn(),
            exit = fadeOut(),
        ) {
            GpsAcquiringOverlay()
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
            RunFinishedSheet(
                uiState = uiState,
                runId = viewModel.runId,
                userId = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid ?: "",
                onDone = { run -> onFinished(run) },
            )
        }

        // RN: "Background permission denied → non-blocking warning, run proceeds
        // foreground-only" (RN_SOURCE_ARCHIVE.md §1, Edge cases) — dismissible,
        // doesn't block the run.
        if (showBackgroundLocationWarning) {
            AlertDialog(
                onDismissRequest = { showBackgroundLocationWarning = false },
                title = { Text("Background Location") },
                text = {
                    Text(
                        "For uninterrupted tracking while your screen is off, set " +
                            "location access to \"Allow all the time\" in Settings. " +
                            "Your run will still track normally while the app is open."
                    )
                },
                confirmButton = {
                    TextButton(onClick = {
                        showBackgroundLocationWarning = false
                        context.startActivity(
                            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
                        )
                    }) { Text("Open Settings") }
                },
                dismissButton = { TextButton(onClick = { showBackgroundLocationWarning = false }) { Text("Continue") } },
            )
        }

        // RN: "GPS acquisition failure → two-tier accuracy fallback, then blocking
        // alert + goBack()" (RN_SOURCE_ARCHIVE.md §1, Edge cases) — unlike the
        // permission-denied dialog, RN offers no retry-in-place here, so both the
        // button and dismissing the dialog exit the screen.
        if (uiState.isGpsAcquisitionFailed) {
            AlertDialog(
                onDismissRequest = onDismiss,
                title = { Text("GPS Error") },
                text = { Text("We couldn't get a GPS fix. Make sure location services are on and you have a clear view of the sky, then try again.") },
                confirmButton = { TextButton(onClick = onDismiss) { Text("OK") } },
            )
        }
    }
}

@Composable
private fun GpsAcquiringOverlay() {
    Box(
        modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.35f)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            CircularProgressIndicator(color = RuvoColors.lime)
            Text("Acquiring GPS…", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
        }
    }
}

@Composable
fun RunMap(
    routeCoordinates: List<RoutePoint>,
    mapStyleChoice: MapStyleChoice = MapStyleChoice.Light,
    isFollowing: Boolean = true,
    onUserPanned: () -> Unit = {},
    recenterSignal: Int = 0,
) {
    val context = LocalContext.current
    val cameraPositionState = rememberCameraPositionState {
        if (routeCoordinates.isNotEmpty()) {
            position = CameraPosition.fromLatLngZoom(
                LatLng(routeCoordinates.last().latitude, routeCoordinates.last().longitude), 16f
            )
        }
    }

    // Follow mode auto-centers on every new fix; a user gesture (detected via
    // MapEffect below) drops follow mode until the recenter button is tapped.
    //
    // Bug fix: this used to call newLatLng() only, which pans but never
    // touches zoom. The camera starts this composable with no route yet
    // (rememberCameraPositionState's init block above only sets a zoomed-in
    // position when routeCoordinates is already non-empty, which it never
    // is on first launch), so it sits at the Google Maps SDK's default —
    // effectively a whole-world view — and every future fix just panned
    // that same zoomed-out camera around the globe instead of zooming in.
    // The dot and the route line were technically there, just microscopic.
    // newLatLngZoom() fixes both the empty-start case and every update
    // after it by re-asserting a real zoom level each time.
    LaunchedEffect(routeCoordinates.lastOrNull(), isFollowing, recenterSignal) {
        if (!isFollowing) return@LaunchedEffect
        routeCoordinates.lastOrNull()?.let { (lat, lng) ->
            cameraPositionState.animate(CameraUpdateFactory.newLatLngZoom(LatLng(lat, lng), 16f))
        }
    }

    val mapStyleOptions = remember(mapStyleChoice) {
        if (mapStyleChoice == MapStyleChoice.Dark) MapStyleOptions.loadRawResourceStyle(context, R.raw.map_style_dark) else null
    }

    GoogleMap(
        modifier = Modifier.fillMaxSize(),
        cameraPositionState = cameraPositionState,
        properties = MapProperties(mapType = mapStyleChoice.mapType, mapStyleOptions = mapStyleOptions, isMyLocationEnabled = true),
        uiSettings = MapUiSettings(zoomControlsEnabled = false, myLocationButtonEnabled = false)
    ) {
        MapEffect(Unit) { googleMap ->
            googleMap.setOnCameraMoveStartedListener { reason ->
                if (reason == RawGoogleMap.OnCameraMoveStartedListener.REASON_GESTURE) onUserPanned()
            }
        }
        routeCoordinates.firstOrNull()?.let { (lat, lng) ->
            Marker(state = MarkerState(position = LatLng(lat, lng)), title = "Start")
        }
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
    mapStyleChoice: MapStyleChoice = MapStyleChoice.Light,
    showStyleMenu: Boolean = false,
    onToggleStyleMenu: () -> Unit = {},
    onStyleSelected: (MapStyleChoice) -> Unit = {},
    workoutStep: IntervalStep? = null,
    workoutStepIndex: Int = 0,
    workoutStepCount: Int = 0,
    workoutStepRemainingSeconds: Int = 0,
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
        if (workoutStep != null) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = workoutStep.label,
                    style = MaterialTheme.typography.titleMedium,
                    color = workoutStep.type.color(),
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = workoutStepRemainingSeconds.coerceAtLeast(0).toFormattedTime(),
                    style = MaterialTheme.typography.displayMedium,
                    color = RuvoColors.textPrimary,
                )
                Text("Step ${workoutStepIndex + 1}/$workoutStepCount", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textSecondary)
            }
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = elapsedSeconds.toFormattedTime(),
                    style = MaterialTheme.typography.displayMedium,
                    color = RuvoColors.textPrimary,
                )
                Text("Duration", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textSecondary)
            }
        }
        Row {
            Box {
                IconButton(onClick = onToggleStyleMenu) {
                    Icon(Icons.Default.Layers, contentDescription = "Map style", tint = RuvoColors.textPrimary)
                }
                DropdownMenu(expanded = showStyleMenu, onDismissRequest = onToggleStyleMenu) {
                    MapStyleChoice.entries.forEach { choice ->
                        DropdownMenuItem(
                            text = { Text(choice.label) },
                            onClick = { onStyleSelected(choice) },
                            leadingIcon = if (choice == mapStyleChoice) {
                                { Icon(Icons.Default.Check, contentDescription = null, tint = RuvoColors.lime) }
                            } else null,
                        )
                    }
                }
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
}

// RN: "Draggable bottom dashboard | Pan-gesture expand/collapse; ... toggle body
// is either a 30-sample HR bar chart or a stats list (voice toggle, lap count,
// workout time, active calories, avg pace, elevation, 5-zone HR card)"
// (RN_SOURCE_ARCHIVE.md §1, sub-task 7).
@Composable
fun RunControls(
    uiState: RunTrackingUiState,
    isGpsReady: Boolean,
    onStart: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onLap: () -> Unit,
    onStop: () -> Unit,
    onToggleVoice: () -> Unit,
) {
    var isExpanded by remember { mutableStateOf(false) }
    var showCharts by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
            .background(RuvoColors.surface.copy(alpha = 0.95f))
            .pointerInput(Unit) {
                detectVerticalDragGestures { _, dragAmount ->
                    if (dragAmount < -12f) isExpanded = true
                    else if (dragAmount > 12f) isExpanded = false
                }
            }
            .animateContentSize()
            .padding(top = 10.dp, start = 20.dp, end = 20.dp, bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Box(
            modifier = Modifier
                .align(Alignment.CenterHorizontally)
                .size(width = 40.dp, height = 4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(RuvoColors.border)
                .clickable { isExpanded = !isExpanded }
        )

        // Always-visible metrics row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            MetricCell("Distance", String.format("%.2f", uiState.distanceKm), "km")
            VerticalDivider()
            MetricCell("Pace", uiState.currentPaceMinPerKm.toFormattedPace(), "/km")
            VerticalDivider()
            MetricCell("Calories", "${uiState.calories}", "kcal")
            VerticalDivider()
            val hrZone = hrZoneFor(uiState.currentHeartRate)
            MetricCell(
                label = hrZone?.label ?: "BPM",
                value = if (uiState.currentHeartRate > 0) "${uiState.currentHeartRate}" else "--",
                unit = if (hrZone != null) "bpm" else "",
                valueColor = hrZone?.color ?: RuvoColors.textPrimary,
            )
        }

        if (isExpanded) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ChartsOverviewTab("Overview", selected = !showCharts, onClick = { showCharts = false })
                ChartsOverviewTab("Charts", selected = showCharts, onClick = { showCharts = true })
            }

            if (showCharts) {
                HrBarChart(samples = uiState.heartRateHistory)
            } else {
                OverviewStatsList(uiState = uiState, onToggleVoice = onToggleVoice)
            }
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
            MainRunBtn(runState = uiState.runState, isGpsReady = isGpsReady, onStart = onStart, onPause = onPause, onResume = onResume)
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
private fun ChartsOverviewTab(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(if (selected) RuvoColors.lime else RuvoColors.surfaceElev)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            color = if (selected) Color.Black else RuvoColors.textSecondary,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun HrBarChart(samples: List<Int>) {
    Column {
        Text("Heart Rate", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
        Spacer(Modifier.height(8.dp))
        if (samples.isEmpty()) {
            Box(Modifier.fillMaxWidth().height(80.dp), contentAlignment = Alignment.Center) {
                Text("No heart rate data yet", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }
        } else {
            val maxBpm = (samples.maxOrNull() ?: 1).coerceAtLeast(1)
            Row(
                modifier = Modifier.fillMaxWidth().height(80.dp),
                horizontalArrangement = Arrangement.spacedBy(3.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                samples.forEach { bpm ->
                    val zone = hrZoneFor(bpm)
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight(fraction = (bpm.toFloat() / maxBpm).coerceIn(0.05f, 1f))
                            .clip(RoundedCornerShape(2.dp))
                            .background(zone?.color ?: RuvoColors.textTertiary)
                    )
                }
            }
        }
    }
}

@Composable
private fun OverviewStatsList(uiState: RunTrackingUiState, onToggleVoice: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Voice Coaching", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
            Switch(
                checked = uiState.isVoiceEnabled,
                onCheckedChange = { onToggleVoice() },
                colors = SwitchDefaults.colors(checkedTrackColor = RuvoColors.lime),
            )
        }
        StatOverviewRow("Laps", "${uiState.laps.size}")
        StatOverviewRow("Workout Time", uiState.elapsedSeconds.toFormattedTime())
        StatOverviewRow("Active Calories", "${uiState.calories} kcal")
        StatOverviewRow("Avg Pace", uiState.averagePaceMinPerKm.toFormattedPace() + "/km")
        StatOverviewRow("Elevation", String.format("%.0f m", uiState.elevationGainM))
        HrZoneCard(currentBpm = uiState.currentHeartRate)
    }
}

@Composable
private fun StatOverviewRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
        Text(value, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun HrZoneCard(currentBpm: Int) {
    val currentZone = hrZoneFor(currentBpm)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(RuvoColors.surfaceElev)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text("Heart Rate Zones", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
        HrZone.entries.forEach { zone ->
            val isCurrent = currentZone == zone
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(zone.color))
                    Text(
                        zone.label,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (isCurrent) RuvoColors.textPrimary else RuvoColors.textTertiary,
                        fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
                    )
                }
                if (isCurrent) Text("now", style = MaterialTheme.typography.labelSmall, color = zone.color)
            }
        }
    }
}

@Composable
fun MetricCell(label: String, value: String, unit: String, valueColor: Color = RuvoColors.textPrimary) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.headlineLarge, color = valueColor, fontWeight = FontWeight.Black)
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
    isGpsReady: Boolean,
    onStart: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
) {
    // Closest Android equivalent to RN auto-starting on GPS lock: the manual
    // Start button simply can't be tapped until a fix has landed
    // (RN_SOURCE_ARCHIVE.md §1, sub-task 1).
    val startDisabled = runState is RunState.Idle && !isGpsReady
    Box(
        modifier = Modifier
            .size(72.dp)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(RuvoColors.lime, Color(0xFFA8CC00))))
            .alpha(if (startDisabled) 0.4f else 1f)
            .clickable(enabled = !startDisabled) {
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
fun RunFinishedSheet(uiState: RunTrackingUiState, runId: String, userId: String, onDone: (RunRecord) -> Unit) {
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
            if (uiState.averageHeartRate > 0) {
                RuvoStatCard(label = "Avg. Heart Rate", value = "${uiState.averageHeartRate}", unit = "bpm", modifier = Modifier.fillMaxWidth())
            }
            RuvoButton(text = "See Summary", onClick = {
                val run = RunRecord(
                    id = runId,
                    userId = userId,
                    distanceKm = uiState.distanceKm,
                    durationSeconds = uiState.elapsedSeconds,
                    averagePaceMinPerKm = uiState.averagePaceMinPerKm,
                    calories = uiState.calories,
                    laps = uiState.laps,
                    route = uiState.routeCoordinates,
                    elevationGainM = uiState.elevationGainM,
                    xpEarned = uiState.distanceKm.toInt() * 10,
                    coinsEarned = uiState.distanceKm.toInt() * 5,
                    averageHeartRate = uiState.averageHeartRate,
                )
                onDone(run)
            })
        }
    }
}

@Composable
private fun LocationPermissionRequired(
    permanentlyDenied: Boolean,
    onRequest: () -> Unit,
    onOpenSettings: () -> Unit,
    onDismiss: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize().background(RuvoColors.background)) {
        IconButton(onClick = onDismiss, modifier = Modifier.align(Alignment.TopStart).padding(16.dp)) {
            Icon(Icons.Default.Close, contentDescription = "Close", tint = RuvoColors.textSecondary)
        }
        Column(
            modifier = Modifier.align(Alignment.Center).padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Icon(Icons.Default.LocationOn, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(56.dp))
            Text("Location Access Needed", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, textAlign = TextAlign.Center)
            Text(
                "Ruvo tracks your run using GPS. Grant location access to start tracking your route, pace, and distance.",
                style = MaterialTheme.typography.bodyMedium,
                color = RuvoColors.textSecondary,
                textAlign = TextAlign.Center,
            )
            RuvoButton(
                text = if (permanentlyDenied) "Open Settings" else "Grant Location Access",
                onClick = if (permanentlyDenied) onOpenSettings else onRequest,
                style = RuvoButtonVariant.Primary,
            )
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
