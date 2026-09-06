package com.ruvo.app.core.persistence

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import java.time.DayOfWeek
import javax.inject.Inject
import javax.inject.Singleton

private val Context.runReminderDataStore: DataStore<Preferences> by preferencesDataStore(name = "run_reminder")

// Real gap found 2026-09-05: RunReminderScheduler's AlarmManager alarms don't
// survive a device reboot — AlarmManager itself has no persistence, that's
// standard platform behavior, not a bug — but nothing in this app restored
// them afterward either, a real, deliberate scope boundary called out when
// the reminder feature was first built ("known, deliberate scope boundary:
// alarms don't survive a reboot; no BOOT_COMPLETED receiver + persisted-
// schedule store to restore them"). This is that store: same DataStore
// Preferences pattern as RateLimitStore/AppLockStore, holding just enough
// (enabled + the same days/time/goal AuthViewModel/SettingsViewModel already
// persist to Firestore) for RunReminderBootReceiver to resubmit the real
// alarms on BOOT_COMPLETED without needing network access at boot.
@Singleton
class RunReminderStore @Inject constructor(@ApplicationContext private val context: Context) {

    private val enabledKey = booleanPreferencesKey("run_reminder_enabled")
    private val daysKey = stringPreferencesKey("run_reminder_days") // comma-joined DayOfWeek.value ints
    private val hourKey = intPreferencesKey("run_reminder_hour")
    private val minuteKey = intPreferencesKey("run_reminder_minute")
    private val goalKey = stringPreferencesKey("run_reminder_goal")

    data class Snapshot(
        val enabled: Boolean,
        val days: Set<DayOfWeek>,
        val hour: Int,
        val minute: Int,
        val goal: String,
    )

    suspend fun save(days: Set<DayOfWeek>, hour: Int, minute: Int, goal: String) {
        context.runReminderDataStore.edit { prefs ->
            prefs[enabledKey] = true
            prefs[daysKey] = formatReminderDays(days)
            prefs[hourKey] = hour
            prefs[minuteKey] = minute
            prefs[goalKey] = goal
        }
    }

    // Keeps the last-known days/time/goal so re-enabling later restores them,
    // same as SettingsViewModel already does for its own in-memory state.
    suspend fun setDisabled() {
        context.runReminderDataStore.edit { prefs -> prefs[enabledKey] = false }
    }

    suspend fun load(): Snapshot {
        val prefs = context.runReminderDataStore.data.first()
        return Snapshot(
            enabled = prefs[enabledKey] ?: false,
            days = parseReminderDays(prefs[daysKey] ?: ""),
            hour = prefs[hourKey] ?: 7,
            minute = prefs[minuteKey] ?: 0,
            goal = prefs[goalKey] ?: "your goal",
        )
    }
}

// Extracted as pure functions (no DataStore/Context involved) specifically so
// the CSV<->Set<DayOfWeek> round-trip is unit testable in isolation — an easy
// place for a silent bug (an unparseable value, an empty string, an
// out-of-range ordinal) to make every scheduled day quietly vanish.
internal fun formatReminderDays(days: Set<DayOfWeek>): String =
    days.sortedBy { it.value }.joinToString(",") { it.value.toString() }

internal fun parseReminderDays(csv: String): Set<DayOfWeek> =
    csv.split(",")
        .mapNotNull { it.toIntOrNull() }
        .mapNotNull { value -> DayOfWeek.entries.find { it.value == value } }
        .toSet()
