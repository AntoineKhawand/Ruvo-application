package com.ruvo.app.core.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

// Real gap found 2026-09-05: AlarmManager alarms don't survive a device
// reboot — RunReminderScheduler.scheduleWeeklyReminders() only ever ran once
// per user action (onboarding, or later a Settings edit), so a rebooted
// device silently lost every scheduled run reminder with no error, no retry,
// and no indication to the user anything had changed.
//
// Deliberately NOT a Hilt entry point, and deliberately does nothing but
// enqueue a job: real ANR found live 2026-09-06 while this receiver *was*
// Hilt-injected and did the restore inline — a cold BOOT_COMPLETED-triggered
// process failed to complete startup (a process-attach timeout, confirmed via
// "Process ... failed to complete startup" in the ActivityManager log, during
// a boot-storm CPU/memory congestion window with many apps cold-starting at
// once) before this receiver's onReceive() ever ran. That failure sits in
// Application.onCreate() itself, before any component callback — a lighter
// receiver can't dodge it, but it can avoid adding its own inline work on top
// of that already-fragile window, and hand off to WorkManager
// (RunReminderRestoreWorker), which persists the pending job in its own
// database and retries it once the system has a free scheduling slot,
// instead of the restore being silently lost forever if this process dies
// mid-run. Re-verified live 2026-09-06 on an uncongested reboot: process
// started for this receiver, RunReminderRestoreWorker ran and returned
// SUCCESS ~8s later, alarm correctly restored — no ANR this time.
class RunReminderBootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        WorkManager.getInstance(context).enqueue(
            OneTimeWorkRequestBuilder<RunReminderRestoreWorker>().build()
        )
    }
}
