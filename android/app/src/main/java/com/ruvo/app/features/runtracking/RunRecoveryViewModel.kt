package com.ruvo.app.features.runtracking

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ruvo.app.core.persistence.RunCheckpoint
import com.ruvo.app.core.persistence.RunCheckpointStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class RunRecoveryViewModel @Inject constructor(
    private val checkpointStore: RunCheckpointStore,
) : ViewModel() {

    private val _pendingCheckpoint = MutableStateFlow<RunCheckpoint?>(null)
    val pendingCheckpoint: StateFlow<RunCheckpoint?> = _pendingCheckpoint.asStateFlow()

    init {
        viewModelScope.launch {
            _pendingCheckpoint.value = checkpointStore.load()
        }
    }

    fun discard() {
        viewModelScope.launch {
            checkpointStore.clear()
            _pendingCheckpoint.value = null
        }
    }

    fun consume(): RunCheckpoint? {
        val checkpoint = _pendingCheckpoint.value
        _pendingCheckpoint.value = null
        return checkpoint
    }
}
