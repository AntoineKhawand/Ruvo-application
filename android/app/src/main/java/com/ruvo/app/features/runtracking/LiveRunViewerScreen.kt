package com.ruvo.app.features.runtracking

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.maps.android.compose.CameraPositionState
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.rememberCameraPositionState
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

// Net-new: reads the same runs/{runId}/liveLocation/current doc
// RunTrackingService.pushLiveLocation() already writes every 5s. RN's own live-share
// design (startLiveRun/endLiveRun Cloud Functions + a liveRuns/{token} doc) has no
// real backend to call — those functions don't exist and RN itself never had a working
// viewer for the shareUrl it requests. This is a first, genuinely-working version of
// "someone else can watch your live run," client-only, no fictitious backend calls.
data class LiveRunViewerUiState(
    val isLoading: Boolean = true,
    val found: Boolean = false,
    val lat: Double? = null,
    val lng: Double? = null,
    val distanceKm: Double = 0.0,
    val paceMinPerKm: Double = 0.0,
    val updatedAtMillis: Long = 0L,
)

@HiltViewModel
class LiveRunViewerViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LiveRunViewerUiState())
    val uiState: StateFlow<LiveRunViewerUiState> = _uiState.asStateFlow()

    private var listener: ListenerRegistration? = null

    fun observe(runId: String) {
        listener?.remove()
        listener = firestore.collection("runs").document(runId)
            .collection("liveLocation").document("current")
            .addSnapshotListener { snap, _ ->
                val data = snap?.data
                if (data == null) {
                    _uiState.value = LiveRunViewerUiState(isLoading = false, found = false)
                    return@addSnapshotListener
                }
                _uiState.value = LiveRunViewerUiState(
                    isLoading = false,
                    found = true,
                    lat = data["lat"] as? Double,
                    lng = data["lng"] as? Double,
                    distanceKm = data["distanceKm"] as? Double ?: 0.0,
                    paceMinPerKm = data["pace"] as? Double ?: 0.0,
                    updatedAtMillis = (data["updatedAt"] as? Timestamp)?.toDate()?.time ?: 0L,
                )
            }
    }

    override fun onCleared() {
        listener?.remove()
        super.onCleared()
    }
}

// A stopped/finished sharer's doc just stops updating — there's no explicit
// "sharing ended" signal to read, so staleness is the only real signal available.
private const val STALE_THRESHOLD_MS = 30_000L

@Composable
fun LiveRunViewerScreen(
    runId: String,
    onBack: () -> Unit = {},
    viewModel: LiveRunViewerViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    LaunchedEffect(runId) { viewModel.observe(runId) }

    var nowMillis by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(1000)
            nowMillis = System.currentTimeMillis()
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(RuvoColors.background)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary) }
            Text("Live Run", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
        }

        when {
            uiState.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = RuvoColors.lime)
            }
            !uiState.found -> Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("📍", style = MaterialTheme.typography.displayMedium)
                    Text(
                        "This run isn't being shared live right now",
                        style = MaterialTheme.typography.bodyMedium,
                        color = RuvoColors.textSecondary,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                }
            }
            else -> {
                val isStale = uiState.updatedAtMillis > 0 && (nowMillis - uiState.updatedAtMillis) > STALE_THRESHOLD_MS
                Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                    if (uiState.lat != null && uiState.lng != null) {
                        val cameraPositionState = rememberCameraPositionState {
                            position = CameraPosition.fromLatLngZoom(LatLng(uiState.lat!!, uiState.lng!!), 16f)
                        }
                        LaunchedEffect(uiState.lat, uiState.lng) {
                            cameraPositionState.animate(
                                com.google.android.gms.maps.CameraUpdateFactory.newLatLng(LatLng(uiState.lat!!, uiState.lng!!))
                            )
                        }
                        LiveRunMap(cameraPositionState = cameraPositionState, lat = uiState.lat!!, lng = uiState.lng!!)
                    }
                    if (isStale) {
                        Surface(
                            modifier = Modifier.align(Alignment.TopCenter).padding(16.dp),
                            shape = RoundedCornerShape(16.dp),
                            color = RuvoColors.surface.copy(alpha = 0.95f),
                        ) {
                            Text(
                                "This runner may have stopped sharing",
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                                style = MaterialTheme.typography.labelLarge,
                                color = RuvoColors.textSecondary,
                            )
                        }
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth().padding(20.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    MetricCell("Distance", String.format("%.2f", uiState.distanceKm), "km")
                    VerticalDivider()
                    MetricCell("Pace", uiState.paceMinPerKm.toFormattedPaceForViewer(), "/km")
                    VerticalDivider()
                    val secondsAgo = ((nowMillis - uiState.updatedAtMillis) / 1000).coerceAtLeast(0)
                    MetricCell("Updated", if (secondsAgo < 60) "${secondsAgo}s" else "${secondsAgo / 60}m", "ago")
                }
            }
        }
    }
}

@Composable
private fun LiveRunMap(cameraPositionState: CameraPositionState, lat: Double, lng: Double) {
    GoogleMap(modifier = Modifier.fillMaxSize(), cameraPositionState = cameraPositionState) {
        Marker(state = MarkerState(position = LatLng(lat, lng)), title = "Live location")
    }
}

private fun Double.toFormattedPaceForViewer(): String {
    if (this <= 0 || this > 30) return "--:--"
    val min = this.toInt(); val sec = ((this - min) * 60).toInt()
    return String.format("%d:%02d", min, sec)
}
