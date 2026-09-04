package com.ruvo.app.core.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.ruvo.app.MainActivity

// Fires on each alarm RunReminderScheduler schedules. Copy verbatim from
// RN_SOURCE_ARCHIVE.md §7 step 6: per-day weekly reminder ("Time to Run!
// 🏃‍♂️" / "It's {day}. Let's hit your goal: {goal}!") or, if the user
// selected no specific days, one daily reminder ("Daily Reminder" /
// "Don't forget to run today!").
class RunReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val dayName = intent.getStringExtra(RunReminderScheduler.EXTRA_DAY_NAME)
        val goal = intent.getStringExtra(RunReminderScheduler.EXTRA_GOAL) ?: "your goal"
        val (title, body) = if (dayName != null) {
            "Time to Run! 🏃‍♂️" to "It's $dayName. Let's hit your goal: $goal!"
        } else {
            "Daily Reminder" to "Don't forget to run today!"
        }

        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        // Reuses FcmService's real "Training" channel id — one channel for
        // both remote push and these local reminders, not a second one users
        // would have to separately manage notification settings for.
        val channelId = FcmService.CHANNEL_TRAINING
        if (manager.getNotificationChannel(channelId) == null) {
            manager.createNotificationChannel(
                NotificationChannel(channelId, "Training", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Training plan reminders and AI coach tips"
                },
            )
        }

        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pending = PendingIntent.getActivity(
            context, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        manager.notify(System.currentTimeMillis().toInt(), notification)
    }
}
