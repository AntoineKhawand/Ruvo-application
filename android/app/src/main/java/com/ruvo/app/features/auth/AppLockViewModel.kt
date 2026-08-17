package com.ruvo.app.features.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ruvo.app.core.persistence.AppLockStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AppLockViewModel @Inject constructor(
    private val appLockStore: AppLockStore,
) : ViewModel() {

    val biometricLockEnabled: StateFlow<Boolean> = appLockStore.biometricLockEnabled
        .stateIn(viewModelScope, SharingStarted.Eagerly, false)

    fun setBiometricLockEnabled(enabled: Boolean) {
        viewModelScope.launch { appLockStore.setBiometricLockEnabled(enabled) }
    }
}
