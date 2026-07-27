package com.ruvo.app.features.runtracking

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ruvo.app.core.model.LapData
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
)

@HiltViewModel
class RunTrackingViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val voiceCoach: VoiceCoach,
    private val hapticsCoach: HapticsCoach,
) : ViewModel() {

    private val _uiState = MutableStateFlow(RunTrackingUiState())
    val uiState: StateFlow<RunTrackingUiState> = _uiState.asStateFlow()

    private var trackingService: RunTrackingService? = null
    val runId = UUID.randomUUID().toString()
    private var lapStartDistance = 0.0
    private var lapStartTime = 0

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            trackingService = (binder as RunTrackingService.LocalBinder).getService()
            observeService()
        }
        override fun onServiceDisconnected(name: ComponentName?) {
            trackingService = null
        }
    }

    fun bindService() {
        val intent = Intent(context, RunTrackingService::class.java)
        context.startService(intent)
        context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    fun unbindService() {
        context.unbindService(serviceConnection)
    }

    private fun observeService() {
        val service = trackingService ?: return
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
            }
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
        }
    }

    fun pause() {
        hapticsCoach.lightTap()
        _uiState.value = _uiState.value.copy(runState = RunState.Paused)
        trackingService?.pauseTracking()
        voiceCoach.announceRunPaused()
    }

    fun resume() {
        hapticsCoach.lightTap()
        _uiState.value = _uiState.value.copy(runState = RunState.Running)
        trackingService?.resumeTracking()
        voiceCoach.announceRunResumed()
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
        _uiState.value = current.copy(laps = current.laps + lap)
        hapticsCoach.lightTap()
        voiceCoach.announceLap(lap.number, lapPace)
    }

    // Persistence intentionally does NOT happen here. RN's real save point is
    // SaveActivityScreen.js::handleSave() — reached only after the user rates
    // effort — which builds the complete runEntry (distance/duration/pace/rpe/
    // notes/tags/etc.) and calls saveRunActivity exactly once (see
    // RN_SOURCE_ARCHIVE.md §9). Android mirrors that: this just stops tracking:
    // RuvoApp.kt's RateEffort step calls GamificationRepository.saveRunActivity
    // once it has RPE/notes/tags from the user.
    fun finishRun() {
        val current = _uiState.value
        _uiState.value = current.copy(runState = RunState.Finished)
        trackingService?.stopTracking()
        hapticsCoach.success()
        voiceCoach.announceRunFinished(current.distanceKm, current.averagePaceMinPerKm)
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
