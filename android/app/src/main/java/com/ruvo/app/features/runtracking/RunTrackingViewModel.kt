package com.ruvo.app.features.runtracking

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.core.model.LapData
import com.ruvo.app.core.model.RunRecord
import com.ruvo.app.features.gamification.GamificationRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.tasks.await
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
    val isLiveSharingEnabled: Boolean = false,
    val currentHeartRate: Int = 0,
)

@HiltViewModel
class RunTrackingViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val gamificationRepo: GamificationRepository,
    private val voiceCoach: VoiceCoach,
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
            ) { dist, pace, elapsed, route ->
                val distKm = dist / 1000.0
                val avgPace = if (distKm > 0 && elapsed > 0) elapsed / 60.0 / distKm else 0.0
                _uiState.value.copy(
                    distanceKm = distKm,
                    currentPaceMinPerKm = pace,
                    elapsedSeconds = elapsed,
                    averagePaceMinPerKm = avgPace,
                    calories = calcCalories(elapsed),
                    routeCoordinates = route,
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
        _uiState.value = _uiState.value.copy(runState = RunState.Paused)
        voiceCoach.announceRunPaused()
    }

    fun resume() {
        _uiState.value = _uiState.value.copy(runState = RunState.Running)
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
        voiceCoach.announceLap(lap.number, lapPace)
    }

    fun finishRun() {
        val current = _uiState.value
        _uiState.value = current.copy(runState = RunState.Finished)
        trackingService?.stopTracking()
        voiceCoach.announceRunFinished(current.distanceKm, current.averagePaceMinPerKm)

        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            saveRun(uid, current)
            gamificationRepo.awardRunXP(current.distanceKm, current.elapsedSeconds)
        }
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

    private suspend fun saveRun(uid: String, state: RunTrackingUiState) {
        val run = mapOf(
            "id" to runId,
            "userId" to uid,
            "startedAt" to com.google.firebase.Timestamp(Date(System.currentTimeMillis() - state.elapsedSeconds * 1000L)),
            "finishedAt" to com.google.firebase.Timestamp.now(),
            "durationSeconds" to state.elapsedSeconds,
            "distanceKm" to state.distanceKm,
            "averagePaceMinPerKm" to state.averagePaceMinPerKm,
            "calories" to state.calories,
            "laps" to state.laps.map { lap ->
                mapOf("number" to lap.number, "distanceKm" to lap.distanceKm, "durationSeconds" to lap.durationSeconds, "paceMinPerKm" to lap.paceMinPerKm)
            }
        )
        firestore.collection("users").document(uid).collection("runs").document(runId).set(run).await()
        updateActiveShoeKm(uid, state.distanceKm)
    }

    private suspend fun updateActiveShoeKm(uid: String, distanceKm: Double) {
        val shoesRef = firestore.collection("users").document(uid).collection("shoes")
        val activeShoe = shoesRef.whereEqualTo("isRetired", false)
            .orderBy("addedAt", com.google.firebase.firestore.Query.Direction.ASCENDING)
            .limit(1).get().await().documents.firstOrNull() ?: return
        shoesRef.document(activeShoe.id).update("currentKm",
            com.google.firebase.firestore.FieldValue.increment(distanceKm)).await()
    }

    private fun calcCalories(seconds: Int): Int {
        return (seconds / 3600.0 * 10 * 70 * 3.5 / 200).toInt()
    }

    override fun onCleared() {
        super.onCleared()
        unbindService()
    }
}
