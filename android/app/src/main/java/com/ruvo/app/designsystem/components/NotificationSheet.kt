package com.ruvo.app.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class AppNotification(
    val id: String,
    val type: String,
    val title: String,
    val body: String,
    val timestampMs: Long,
    val isRead: Boolean,
)

@HiltViewModel
class NotificationViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _notifications = MutableStateFlow<List<AppNotification>>(emptyList())
    val notifications: StateFlow<List<AppNotification>> = _notifications.asStateFlow()

    val unreadCount: StateFlow<Int> = _notifications.map { list -> list.count { !it.isRead } }
        .stateIn(viewModelScope, SharingStarted.Eagerly, 0)

    init { listenNotifications() }

    private fun listenNotifications() {
        val uid = auth.currentUser?.uid ?: return
        firestore.collection("users").document(uid).collection("notifications")
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .limit(30)
            .addSnapshotListener { snap, _ ->
                val list = snap?.documents?.mapNotNull { doc ->
                    val d = doc.data ?: return@mapNotNull null
                    AppNotification(
                        id = doc.id,
                        type = d["type"] as? String ?: "general",
                        title = d["title"] as? String ?: "",
                        body = d["body"] as? String ?: "",
                        timestampMs = (d["timestamp"] as? com.google.firebase.Timestamp)?.toDate()?.time ?: 0L,
                        isRead = d["read"] as? Boolean ?: false,
                    )
                } ?: emptyList()
                _notifications.value = list
            }
    }

    fun markAllRead() {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            val unread = _notifications.value.filter { !it.isRead }
            val batch = firestore.batch()
            unread.forEach { notif ->
                val ref = firestore.collection("users").document(uid).collection("notifications").document(notif.id)
                batch.update(ref, "read", true)
            }
            try { batch.commit().await() } catch (_: Exception) {}
        }
    }

    fun markRead(notifId: String) {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            try {
                firestore.collection("users").document(uid).collection("notifications")
                    .document(notifId).update("read", true).await()
            } catch (_: Exception) {}
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationSheet(
    viewModel: NotificationViewModel,
    onDismiss: () -> Unit,
) {
    val notifications by viewModel.notifications.collectAsStateWithLifecycle()

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = RuvoColors.surface,
        dragHandle = { BottomSheetDefaults.DragHandle(color = RuvoColors.border) },
    ) {
        Column(modifier = Modifier.fillMaxWidth().navigationBarsPadding()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Notifications", style = MaterialTheme.typography.titleLarge, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                if (notifications.any { !it.isRead }) {
                    TextButton(onClick = viewModel::markAllRead) {
                        Text("Mark all read", style = MaterialTheme.typography.labelMedium, color = RuvoColors.lime)
                    }
                }
            }

            if (notifications.isEmpty()) {
                Box(modifier = Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.Notifications, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(48.dp))
                        Text("No notifications yet", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textTertiary)
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.heightIn(max = 500.dp),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(notifications, key = { it.id }) { notif ->
                        NotificationItem(notification = notif, onRead = { viewModel.markRead(notif.id) })
                    }
                    item { Spacer(Modifier.height(16.dp)) }
                }
            }
        }
    }
}

@Composable
private fun NotificationItem(notification: AppNotification, onRead: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = if (notification.isRead) RuvoColors.surfaceElev else RuvoColors.lime.copy(alpha = 0.06f),
        border = androidx.compose.foundation.BorderStroke(1.dp, if (!notification.isRead) RuvoColors.lime.copy(alpha = 0.2f) else RuvoColors.border),
        modifier = Modifier.fillMaxWidth().clickable { if (!notification.isRead) onRead() },
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top,
        ) {
            // Icon
            Box(
                modifier = Modifier.size(38.dp).clip(CircleShape).background(notifIconBg(notification.type)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(notifIcon(notification.type), contentDescription = null, tint = notifIconColor(notification.type), modifier = Modifier.size(20.dp))
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(notification.title, style = MaterialTheme.typography.labelMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
                Text(notification.body, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                val minAgo = ((System.currentTimeMillis() - notification.timestampMs) / 60000).toInt()
                val timeStr = when {
                    minAgo < 60 -> "${minAgo}m ago"
                    minAgo < 1440 -> "${minAgo / 60}h ago"
                    else -> "${minAgo / 1440}d ago"
                }
                Text(timeStr, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
            }

            if (!notification.isRead) {
                Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(RuvoColors.lime).align(Alignment.Top))
            }
        }
    }
}

private fun notifIcon(type: String) = when (type) {
    "follow" -> Icons.Default.PersonAdd
    "like" -> Icons.Default.Favorite
    "achievement" -> Icons.Default.EmojiEvents
    "comment" -> Icons.Default.Comment
    "club" -> Icons.Default.Group
    else -> Icons.Default.Notifications
}

private fun notifIconColor(type: String) = when (type) {
    "follow" -> RuvoColors.lime
    "like" -> androidx.compose.ui.graphics.Color(0xFFE53E3E)
    "achievement" -> androidx.compose.ui.graphics.Color(0xFFFFD700)
    "comment" -> androidx.compose.ui.graphics.Color(0xFF5BE9FF)
    "club" -> androidx.compose.ui.graphics.Color(0xFF9C8EFF)
    else -> RuvoColors.textTertiary
}

private fun notifIconBg(type: String) = when (type) {
    "follow" -> RuvoColors.lime.copy(alpha = 0.15f)
    "like" -> androidx.compose.ui.graphics.Color(0xFFE53E3E).copy(alpha = 0.15f)
    "achievement" -> androidx.compose.ui.graphics.Color(0xFFFFD700).copy(alpha = 0.15f)
    "comment" -> androidx.compose.ui.graphics.Color(0xFF5BE9FF).copy(alpha = 0.15f)
    "club" -> androidx.compose.ui.graphics.Color(0xFF9C8EFF).copy(alpha = 0.15f)
    else -> RuvoColors.surfaceElev
}
