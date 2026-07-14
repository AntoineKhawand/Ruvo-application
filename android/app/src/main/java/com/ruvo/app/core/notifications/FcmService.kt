package com.ruvo.app.core.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.ruvo.app.MainActivity

class FcmService : FirebaseMessagingService() {

    companion object {
        const val CHANNEL_GENERAL = "ruvo_general"
        const val CHANNEL_SOCIAL  = "ruvo_social"
        const val CHANNEL_TRAINING = "ruvo_training"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        FcmTokenRepository.saveToken(applicationContext, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val title   = message.notification?.title ?: message.data["title"] ?: return
        val body    = message.notification?.body  ?: message.data["body"]  ?: return
        val channel = message.data["channel"] ?: CHANNEL_GENERAL
        showNotification(title, body, channel)
    }

    private fun showNotification(title: String, body: String, channel: String) {
        val manager = getSystemService(NotificationManager::class.java) ?: return
        ensureChannels(manager)

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pending = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channel)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    private fun ensureChannels(manager: NotificationManager) {
        val channels = listOf(
            NotificationChannel(CHANNEL_GENERAL,  "General",  NotificationManager.IMPORTANCE_DEFAULT),
            NotificationChannel(CHANNEL_SOCIAL,   "Social",   NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Likes, comments, club activity"
            },
            NotificationChannel(CHANNEL_TRAINING, "Training", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Training plan reminders and AI coach tips"
            },
        )
        channels.forEach { manager.createNotificationChannel(it) }
    }
}
