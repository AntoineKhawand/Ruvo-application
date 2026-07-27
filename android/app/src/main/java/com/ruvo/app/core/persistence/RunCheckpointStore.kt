package com.ruvo.app.core.persistence

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

private val Context.runCheckpointDataStore: DataStore<Preferences> by preferencesDataStore(name = "run_checkpoint")
private val CHECKPOINT_KEY = stringPreferencesKey("run_checkpoint_json")

@Singleton
class RunCheckpointStore @Inject constructor(@ApplicationContext private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun save(checkpoint: RunCheckpoint) {
        context.runCheckpointDataStore.edit { prefs ->
            prefs[CHECKPOINT_KEY] = json.encodeToString(checkpoint)
        }
    }

    suspend fun load(): RunCheckpoint? {
        val raw = context.runCheckpointDataStore.data.first()[CHECKPOINT_KEY] ?: return null
        return try {
            json.decodeFromString<RunCheckpoint>(raw)
        } catch (_: Exception) {
            null
        }
    }

    suspend fun clear() {
        context.runCheckpointDataStore.edit { it.remove(CHECKPOINT_KEY) }
    }
}
