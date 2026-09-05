package com.ruvo.app.core.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.ruvo.app.core.persistence.RunReminderStore
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

// Real gap found 2026-09-05: AlarmManager alarms don't survive a device
// reboot — RunReminderScheduler.scheduleWeeklyReminders() only ever ran once
// per user action (onboarding, or later a Settings edit), so a rebooted
// device silently lost every scheduled run reminder with no error, no retry,
// and no indication to the user anything had changed. This resubmits them:
// reads the local RunReminderStore snapshot RunReminderScheduler now saves on
// every real schedule/cancel, and if reminders were left enabled, calls the
// same scheduler onboarding/Settings use to recreate the real alarms.
//
// Deliberately reads RunReminderStore (local DataStore), not Firestore — a
// BroadcastReceiver reacting to BOOT_COMPLETED runs before the device
// necessarily has network, and goAsync() only grants a short window before
// the system may kill the process; a local read that can't fail on
// connectivity is the right tool here, not a network round trip.
//
// Known real risk, confirmed live 2026-09-06 (not theoretical): a cold boot
// spawns this receiver's process from scratch, and Application.onCreate()
// (RuvoApplication's Firebase/WorkManager/Room init) runs unconditionally
// before onReceive() ever gets called — regardless of what this receiver
// itself does or how little work it performs. Reproduced on an emulator: that
// init took 40+ seconds in a bare broadcast-only process (vs. ~a few seconds
// with a foreground Activity warming the same process) — broadcast-receiver
// processes get materially throttled CPU scheduling versus foreground ones —
// long enough to trip the OS's broadcast-delivery ANR timeout, which killed
// the process before onReceive() ran at all, silently skipping this restore
// for that boot. goAsync() protects this receiver's own async work from
// being reclaimed early; it can't protect against Application.onCreate()
// itself never finishing in time. A real fix needs Application.onCreate() to
// do less synchronous work at boot (defer non-critical init) or move this
// restore off the broadcast-delivery path entirely (e.g. a Hilt-integrated
// WorkManager job, not currently wired into this project) — both are a
// larger, separate change than this feature's own scope. Until then: this
// correctly restores reminders whenever the process happens to start fast
// enough, which is most of the time on a real device, but is not guaranteed.
@AndroidEntryPoint
class RunReminderBootReceiver : BroadcastReceiver() {

    @Inject lateinit var store: RunReminderStore
    @Inject lateinit var scheduler: RunReminderScheduler

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val snapshot = store.load()
                if (snapshot.enabled) {
                    scheduler.scheduleWeeklyReminders(snapshot.days, snapshot.hour, snapshot.minute, snapshot.goal)
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}
