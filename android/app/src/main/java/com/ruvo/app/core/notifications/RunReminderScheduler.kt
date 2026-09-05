package com.ruvo.app.core.notifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.ruvo.app.core.persistence.RunReminderStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.TextStyle
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

// Real port of RN_SOURCE_ARCHIVE.md §7 step 6's notification-scheduling half.
// OnboardingScreen's Schedule step previously only ever collected a day
// *count* (a 1-7 slider), so there were never specific days to schedule
// reminders against — this closes that gap: the step now collects real days
// + a reminder time, and this scheduler turns that into actual local
// notifications, matching RN's real behavior: per-selected-day weekly
// reminders, or one daily reminder if no days were chosen.
//
// Uses AlarmManager.setRepeating (inexact) rather than setExactAndAllowWhileIdle
// — a run reminder doesn't need to-the-second precision, and inexact alarms
// don't require the separate SCHEDULE_EXACT_ALARM permission/dialog, which
// would be a much bigger ask for a "don't forget to run" nudge.
//
// Known, deliberate scope boundary (not a bug): AlarmManager alarms don't
// survive a device reboot, and this doesn't add a BOOT_COMPLETED receiver +
// persisted-schedule store to restore them — that's a real, separate follow-up,
// not something to fold into an already-large "give onboarding a working
// Schedule step" change.
@Singleton
class RunReminderScheduler @Inject constructor(
    @ApplicationContext private val context: Context,
    private val store: RunReminderStore,
) {

    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    // Fire-and-forget persistence for the local-only RunReminderStore below —
    // scheduleWeeklyReminders()/cancelAll() are called synchronously from UI
    // code (AuthViewModel/SettingsViewModel), not suspend functions, so this
    // is a small dedicated scope rather than plumbing a suspend signature
    // through every call site for what's genuinely a best-effort side write.
    private val storeScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // Request codes 1-7 map to DayOfWeek.value (Monday=1..Sunday=7); 0 is the
    // no-days-selected daily fallback. Cancelling all 8 before rescheduling
    // means calling this twice (e.g. a user redoing onboarding) never leaves
    // a stale day's alarm still firing after they deselect it.
    fun scheduleWeeklyReminders(selectedDays: Set<DayOfWeek>, hour: Int, minute: Int, goal: String) {
        cancelAllAlarms()
        if (selectedDays.isEmpty()) {
            schedule(day = null, hour = hour, minute = minute, goal = goal)
        } else {
            selectedDays.forEach { day -> schedule(day, hour, minute, goal) }
        }
        // Real gap found 2026-09-05: these alarms don't survive a reboot —
        // AlarmManager itself never persists them — and nothing restored them
        // afterward. Saved locally (not just Firestore) so
        // RunReminderBootReceiver can resubmit them on BOOT_COMPLETED without
        // needing network access at boot.
        storeScope.launch { store.save(selectedDays, hour, minute, goal) }
    }

    fun cancelAll() {
        cancelAllAlarms()
        storeScope.launch { store.setDisabled() }
    }

    private fun cancelAllAlarms() {
        (0..7).forEach { requestCode -> alarmManager.cancel(pendingIntentFor(requestCode)) }
    }

    private fun schedule(day: DayOfWeek?, hour: Int, minute: Int, goal: String) {
        val requestCode = day?.value ?: 0
        val triggerAtMillis = nextTriggerMillis(day, hour, minute)
        val pending = pendingIntentFor(requestCode, day, goal)
        alarmManager.setRepeating(AlarmManager.RTC_WAKEUP, triggerAtMillis, AlarmManager.INTERVAL_DAY * 7, pending)
    }

    private fun nextTriggerMillis(day: DayOfWeek?, hour: Int, minute: Int): Long {
        val now = ZonedDateTime.now(ZoneId.systemDefault())
        var target = now.withHour(hour).withMinute(minute).withSecond(0).withNano(0)
        if (day != null) {
            while (target.dayOfWeek != day || !target.isAfter(now)) target = target.plusDays(1)
        } else if (!target.isAfter(now)) {
            target = target.plusDays(1)
        }
        return target.toInstant().toEpochMilli()
    }

    private fun pendingIntentFor(requestCode: Int, day: DayOfWeek? = null, goal: String? = null): PendingIntent {
        val intent = Intent(context, RunReminderReceiver::class.java).apply {
            action = ACTION_RUN_REMINDER
            putExtra(EXTRA_DAY_NAME, day?.getDisplayName(TextStyle.FULL, Locale.US))
            putExtra(EXTRA_GOAL, goal)
        }
        // PendingIntent matching for cancel() only looks at requestCode +
        // the intent's component/action (not extras), so cancelAll() above
        // correctly matches these even without re-supplying day/goal.
        return PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    companion object {
        const val ACTION_RUN_REMINDER = "com.ruvo.app.RUN_REMINDER"
        const val EXTRA_DAY_NAME = "dayName"
        const val EXTRA_GOAL = "goal"
    }
}
