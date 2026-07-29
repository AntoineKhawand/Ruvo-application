package com.ruvo.app.features.runtracking

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ruvo.app.core.model.LapData
import com.ruvo.app.core.persistence.CheckpointLap
import com.ruvo.app.core.persistence.CheckpointPoint
import com.ruvo.app.core.persistence.RunCheckpoint
import com.ruvo.app.core.persistence.RunCheckpointStore
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import java.util.*
import javax.inject.Inject

sealed interface RunState {
    data object Idle : RunState
    data class Countdown(val seconds: Int) : RunState
    data object Running : RunState
    data object Paused : RunState
    data object Finished : RunState
}

data class RunTrackingUiState(
    val runState: RunState = RunState.Idle,
    val elapsedSeconds: Int = 0,
    val distanceKm: Double = 0.0,
    val currentPaceMinPerKm: Double = 0.0,
    val averagePaceMinPerKm: Double = 0.0,
    val calories: Int = 0,
    val laps: List<LapData> = emptyList(),
    val routeCoordinates: List<Pair<Double, Double>> = emptyList(),
    val elevationGainM: Double = 0.0,
    val isLiveSharingEnabled: Boolean = false,
    val currentHeartRate: Int = 0,
    val averageHeartRate: Int = 0,
    val lastLapBanner: LapData? = null,
    val heartRateHistory: List<Int> = emptyList(),
    val isVoiceEnabled: Boolean = true,
)

// RN: the draggable dashboard's Charts view is a "30-sample HR bar chart"
// (RN_SOURCE_ARCHIVE.md §1, sub-task 7).
private const val HEART_RATE_HISTORY_LIMIT = 30

// Health Connect has no true real-time HR stream (it's a data store synced
// periodically from watches/apps, not a live sensor API) — polling the latest
// sample on this interval is the practical equivalent of RN's iOS-only
// observeHeartRate() listener (RN_SOURCE_ARCHIVE.md §1: "no working Android HR
// source at all" in RN, so this is a genuine new integration, not a port).
private const val HEART_RATE_POLL_INTERVAL_MS = 8000L

@HiltViewModel
class RunTrackingViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val voiceCoach: VoiceCoach,
    private val hapticsCoach: HapticsCoach,
    private val checkpointStore: RunCheckpointStore,
    private val healthConnectManager: HealthConnectManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(RunTrackingUiState())
    val uiState: StateFlow<RunTrackingUiState> = _uiState.asStateFlow()

    private var trackingService: RunTrackingService? = null
    var runId = UUID.randomUUID().toString()
        private set
    private var lapStartDistance = 0.0
    private var lapStartTime = 0
    private var runStartedAtEpochMs = System.currentTimeMillis()
    private var pendingResumeCheckpoint: RunCheckpoint? = null
    private var heartRateJob: Job? = null
    private val heartRateSamples = mutableListOf<Int>()

    // Non-blocking, mirrors RN's background-location-permission pattern: if Health
    // Connect isn't installed or the user denies it, the run proceeds with no HR data.
    fun healthConnectPermissionsNeeded(): Set<String>? =
        if (healthConnectManager.isAvailable()) healthConnectManager.permissions else null

    private fun startHeartRatePolling() {
        heartRateJob?.cancel()
        heartRateJob = viewModelScope.launch {
            while (isActive) {
                val bpm = healthConnectManager.fetchLatestHeartRate().toInt()
                if (bpm > 0) {
                    heartRateSamples.add(bpm)
                    val history = (_uiState.value.heartRateHistory + bpm).takeLast(HEART_RATE_HISTORY_LIMIT)
                    _uiState.value = _uiState.value.copy(currentHeartRate = bpm, heartRateHistory = history)
                }
                delay(HEART_RATE_POLL_INTERVAL_MS)
            }
        }
    }

    private fun stopHeartRatePolling() {
        heartRateJob?.cancel()
        heartRateJob = null
    }

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            trackingService = (binder as RunTrackingService.LocalBinder).getService()
            pendingResumeCheckpoint?.let { trackingService?.restoreFromCheckpoint(it) }
            pendingResumeCheckpoint = null
            observeService()
        }
        override fun onServiceDisconnected(name: ComponentName?) {
            trackingService = null
        }
    }

    // Net-new: resumes a run whose process died mid-track (see RunCheckpoint
    // doc comment). Seeds the ViewModel's own state (laps, lap boundaries)
    // immediately; the service-owned state (distance/elapsed/route/elevation)
    // is seeded once the service connects, via pendingResumeCheckpoint.
    fun resumeFromCheckpoint(checkpoint: RunCheckpoint) {
        runId = checkpoint.runId
        runStartedAtEpochMs = checkpoint.startedAtEpochMs
        lapStartDistance = checkpoint.distanceMeters / 1000.0
        lapStartTime = checkpoint.elapsedSeconds
        pendingResumeCheckpoint = checkpoint
        _uiState.value = _uiState.value.copy(
            runState = if (checkpoint.isPaused) RunState.Paused else RunState.Running,
            elapsedSeconds = checkpoint.elapsedSeconds,
            distanceKm = checkpoint.distanceMeters / 1000.0,
            elevationGainM = checkpoint.elevationGainMeters,
            routeCoordinates = checkpoint.route.map { it.lat to it.lng },
            laps = checkpoint.laps.map { LapData(it.number, it.distanceKm, it.durationSeconds, it.paceMinPerKm) },
        )
        if (!checkpoint.isPaused) startHeartRatePolling()
        bindService()
    }

    fun bindService() {
        voiceCoach.announceGpsAcquiring()
        val intent = Intent(context, RunTrackingService::class.java)
        context.startService(intent)
        context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    fun unbindService() {
        context.unbindService(serviceConnection)
    }

    private fun observeService() {
        val service = trackingService ?: return
        // RN: "on lock" — spoken once the first GPS fix arrives after mount
        // (RN_SOURCE_ARCHIVE.md §1). first() completes this coroutine after one emission.
        viewModelScope.launch {
            service.location.filterNotNull().first()
            voiceCoach.announceGpsReady()
        }
        viewModelScope.launch {
            combine(
                service.distanceMeters,
                service.currentPaceMinPerKm,
                service.elapsedSeconds,
                service.routeCoordinates,
                service.elevationGainMeters,
            ) { dist, pace, elapsed, route, elevationGain ->
                val distKm = dist / 1000.0
                val avgPace = if (distKm > 0 && elapsed > 0) elapsed / 60.0 / distKm else 0.0
                _uiState.value.copy(
                    distanceKm = distKm,
                    currentPaceMinPerKm = pace,
                    elapsedSeconds = elapsed,
                    averagePaceMinPerKm = avgPace,
                    calories = calcCalories(distKm),
                    routeCoordinates = route,
                    elevationGainM = elevationGain,
                )
            }.collect { newState ->
                _uiState.value = newState
                if (newState.runState == RunState.Running) {
                    voiceCoach.onDistanceUpdate(newState.distanceKm, newState.currentPaceMinPerKm, newState.elapsedSeconds)
                }
                // Checkpoint every 5s while actively tracked, so a crash never loses
                // more than a few seconds of progress.
                if ((newState.runState == RunState.Running || newState.runState == RunState.Paused) &&
                    newState.elapsedSeconds % 5 == 0
                ) {
                    saveCheckpoint(newState)
                }
            }
        }
    }

    private fun saveCheckpoint(state: RunTrackingUiState) {
        viewModelScope.launch {
            checkpointStore.save(
                RunCheckpoint(
                    runId = runId,
                    startedAtEpochMs = runStartedAtEpochMs,
                    elapsedSeconds = state.elapsedSeconds,
                    distanceMeters = state.distanceKm * 1000.0,
                    elevationGainMeters = state.elevationGainM,
                    isPaused = state.runState == RunState.Paused,
                    route = state.routeCoordinates.map { (lat, lng) -> CheckpointPoint(lat, lng) },
                    laps = state.laps.map { CheckpointLap(it.number, it.distanceKm, it.durationSeconds, it.paceMinPerKm) },
                )
            )
        }
    }

    fun startCountdown() {
        hapticsCoach.lightTap()
        viewModelScope.launch {
            for (i in 3 downTo 1) {
                _uiState.value = _uiState.value.copy(runState = RunState.Countdown(i))
                delay(1000)
            }
            _uiState.value = _uiState.value.copy(runState = RunState.Running)
            voiceCoach.announceRunStart()
            startHeartRatePolling()
        }
    }

    fun pause() {
        hapticsCoach.lightTap()
        _uiState.value = _uiState.value.copy(runState = RunState.Paused)
        trackingService?.pauseTracking()
        voiceCoach.announceRunPaused()
        stopHeartRatePolling()
        saveCheckpoint(_uiState.value)
    }

    fun resume() {
        hapticsCoach.lightTap()
        _uiState.value = _uiState.value.copy(runState = RunState.Running)
        trackingService?.resumeTracking()
        voiceCoach.announceRunResumed()
        startHeartRatePolling()
    }

    fun lap() {
        val current = _uiState.value
        val lapDist = current.distanceKm - lapStartDistance
        val lapTime = current.elapsedSeconds - lapStartTime
        val lapPace = if (lapDist > 0 && lapTime > 0) lapTime / 60.0 / lapDist else 0.0
        val lap = LapData(
            number = current.laps.size + 1,
            distanceKm = lapDist,
            durationSeconds = lapTime,
            paceMinPerKm = lapPace
        )
        lapStartDistance = current.distanceKm
        lapStartTime = current.elapsedSeconds
        _uiState.value = current.copy(laps = current.laps + lap, lastLapBanner = lap)
        hapticsCoach.lightTap()
        voiceCoach.announceLap(lap.number)
        saveCheckpoint(_uiState.value)
    }

    // RN's lap distance/pace detail is a non-voice visual alert, separate from
    // the spoken "Lap N" line (RN_SOURCE_ARCHIVE.md §1). Screen auto-clears
    // this after showing the banner briefly.
    fun clearLapBanner() {
        _uiState.value = _uiState.value.copy(lastLapBanner = null)
    }

    // Persistence intentionally does NOT happen here. RN's real save point is
    // SaveActivityScreen.js::handleSave() — reached only after the user rates
    // effort — which builds the complete runEntry (distance/duration/pace/rpe/
    // notes/tags/etc.) and calls saveRunActivity exactly once (see
    // RN_SOURCE_ARCHIVE.md §9). Android mirrors that: this just stops tracking:
    // RuvoApp.kt's RateEffort step calls GamificationRepository.saveRunActivity
    // once it has RPE/notes/tags from the user.
    fun finishRun() {
        stopHeartRatePolling()
        val current = _uiState.value
        val avgHr = if (heartRateSamples.isNotEmpty()) heartRateSamples.average().toInt() else 0
        _uiState.value = current.copy(runState = RunState.Finished, averageHeartRate = avgHr)
        trackingService?.stopTracking()
        hapticsCoach.success()
        voiceCoach.announceRunFinished(current.distanceKm, current.averagePaceMinPerKm)
        viewModelScope.launch { checkpointStore.clear() }
    }

    // RN: "Voice toggle-on: 'Voice feedback enabled' (bypasses the enabled-gate
    // intentionally)" (RN_SOURCE_ARCHIVE.md §1) — only the on-transition announces,
    // and it does so even though every other announce* call is gated on isEnabled.
    fun toggleVoice() {
        val enabled = !voiceCoach.isEnabled
        voiceCoach.isEnabled = enabled
        _uiState.value = _uiState.value.copy(isVoiceEnabled = enabled)
        if (enabled) voiceCoach.announceVoiceEnabled()
    }

    fun toggleLiveSharing() {
        val enabled = !_uiState.value.isLiveSharingEnabled
        _uiState.value = _uiState.value.copy(isLiveSharingEnabled = enabled)
        if (enabled) {
            trackingService?.enableLiveSharing(runId)
        } else {
            trackingService?.disableLiveSharing()
        }
    }

    // RN: `calories += distanceIncrementKm * userWeightKg * 1.036` per accepted GPS
    // point, accumulated over distance (not elapsed time). `userWeight = userData?.weight
    // || 70` — Android doesn't yet thread the user's real weight through, so this uses
    // RN's same 70kg fallback default (see RN_SOURCE_ARCHIVE.md §1).
    private fun calcCalories(distanceKm: Double): Int = (distanceKm * 70.0 * 1.036).toInt()

    override fun onCleared() {
        super.onCleared()
        unbindService()
    }
}
