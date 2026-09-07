package com.ruvo.wear

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.wearable.MessageClient
import com.ruvo.wear.shared.RunControlCommand
import com.ruvo.wear.shared.RunStatsPayload
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

// No Hilt here on purpose — see wear/build.gradle.kts's doc comment on
// keeping this module dependency-light. PhoneConnection is constructed
// directly from the Activity's applicationContext instead.
class RunCompanionViewModel(private val phone: PhoneConnection) : ViewModel() {

    private val _latestStats = MutableStateFlow<RunStatsPayload?>(null)
    val latestStats: StateFlow<RunStatsPayload?> = _latestStats.asStateFlow()

    private var statsListener: MessageClient.OnMessageReceivedListener? = null

    fun startListening() {
        if (statsListener != null) return
        statsListener = phone.listenForStats { stats -> _latestStats.value = stats }
    }

    fun stopListening() {
        statsListener?.let(phone::stopListening)
        statsListener = null
    }

    fun start() = sendCommand(RunControlCommand.START)
    fun pause() = sendCommand(RunControlCommand.PAUSE)
    fun resume() = sendCommand(RunControlCommand.RESUME)
    fun stop() = sendCommand(RunControlCommand.STOP)

    private fun sendCommand(action: String) {
        viewModelScope.launch { phone.sendCommand(action) }
    }

    override fun onCleared() {
        stopListening()
    }
}
