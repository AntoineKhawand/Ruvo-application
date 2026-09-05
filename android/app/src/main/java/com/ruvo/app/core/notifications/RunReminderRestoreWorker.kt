package com.ruvo.app.core.notifications

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.ruvo.app.core.persistence.RunReminderStore
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

// Does the actual restore work RunReminderBootReceiver used to do inline.
// Moved here deliberately: a plain BroadcastReceiver's goAsync() work has no
// recovery if the hosting process dies before it finishes (confirmed live —
// see RunReminderBootReceiver's and RuvoApplication's comments for the real
// process-startup-timeout ANR this reproduced during a boot-storm CPU/memory
// congestion window). A WorkManager job is durable: it's tracked in
// WorkManager's own database, survives this process dying mid-run, and gets
// picked up again once the system has a scheduling slot free — instead of
// the restore being silently lost for that boot with no second chance.
@HiltWorker
class RunReminderRestoreWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val store: RunReminderStore,
    private val scheduler: RunReminderScheduler,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            val snapshot = store.load()
            if (snapshot.enabled) {
                scheduler.scheduleWeeklyReminders(snapshot.days, snapshot.hour, snapshot.minute, snapshot.goal)
            }
            Result.success()
        } catch (e: Exception) {
            // Transient (e.g. DataStore I/O contention during the same boot
            // congestion that motivated this class) — let WorkManager retry
            // with its default backoff rather than losing the restore.
            Result.retry()
        }
    }
}
