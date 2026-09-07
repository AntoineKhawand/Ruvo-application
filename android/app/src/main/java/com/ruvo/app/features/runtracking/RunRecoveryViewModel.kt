package com.ruvo.app.features.runtracking

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
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
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _pendingCheckpoint = MutableStateFlow<RunCheckpoint?>(null)
    val pendingCheckpoint: StateFlow<RunCheckpoint?> = _pendingCheckpoint.asStateFlow()

    init {
        viewModelScope.launch {
            val checkpoint = checkpointStore.load()
            if (checkpoint != null && !isCheckpointResumable(checkpoint, auth.currentUser?.uid)) {
                checkpointStore.clear()
                _pendingCheckpoint.value = null
            } else {
                _pendingCheckpoint.value = checkpoint
            }
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

// Data-integrity fix: a checkpoint left behind by a PREVIOUS signed-in
// user on this device (never explicitly cleared on sign-out until now)
// must never be offered to whoever is signed in now — resuming it would
// save that stranger's GPS trail/distance under the current user's
// account. Pure so the ownership rule itself — including the "blank uid
// (an old checkpoint saved before this field existed) is unrecoverable,
// not assumed to be mine" case — is unit-testable without a real
// DataStore-backed checkpoint or a live sign-out/sign-in cycle to
// reproduce.
internal fun isCheckpointResumable(checkpoint: RunCheckpoint, currentUid: String?): Boolean =
    currentUid != null && checkpoint.uid.isNotBlank() && checkpoint.uid == currentUid
