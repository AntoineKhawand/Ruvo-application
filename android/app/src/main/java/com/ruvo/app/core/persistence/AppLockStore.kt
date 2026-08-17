package com.ruvo.app.core.persistence

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.appLockDataStore: DataStore<Preferences> by preferencesDataStore(name = "app_lock")
private val BIOMETRIC_LOCK_ENABLED_KEY = booleanPreferencesKey("biometric_lock_enabled")

// RN's LockScreen (RN_SOURCE_ARCHIVE.md §7) is a pure biometric gate on an
// *already-authenticated* Firebase session — it never re-submits credentials,
// so there is no password (plaintext or otherwise) to store here. This store
// only ever persists the user's on/off preference for the gate itself; the
// backgrounded-at timestamp used to compute the 30-minute lock window is kept
// in-memory only (see RuvoApp.kt), matching RN's own in-memory AppState-timer
// approach rather than inventing cross-restart persistence RN doesn't have.
//
// This intentionally does NOT replicate RN's separate LoginScreen feature
// (SecureStore'd plaintext email+password, replayed via biometric to silently
// re-`login()` a *signed-out* user) — that is the real security smell the
// archive flags, and Firebase Auth's Android SDK already keeps a
// signed-in session alive across restarts on its own, so there's no
// signed-out-but-was-just-signed-in gap here to paper over with a stored
// password in the first place.
@Singleton
class AppLockStore @Inject constructor(@ApplicationContext private val context: Context) {

    val biometricLockEnabled: Flow<Boolean> =
        context.appLockDataStore.data.map { it[BIOMETRIC_LOCK_ENABLED_KEY] ?: false }

    suspend fun setBiometricLockEnabled(enabled: Boolean) {
        context.appLockDataStore.edit { prefs -> prefs[BIOMETRIC_LOCK_ENABLED_KEY] = enabled }
    }
}
