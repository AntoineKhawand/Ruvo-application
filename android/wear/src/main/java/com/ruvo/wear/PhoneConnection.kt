package com.ruvo.wear

import android.content.Context
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.ruvo.wear.shared.CONTROL_MESSAGE_PATH
import com.ruvo.wear.shared.RunControlCommand
import com.ruvo.wear.shared.RunStatsPayload
import com.ruvo.wear.shared.STATS_MESSAGE_PATH
import com.ruvo.wear.shared.decodeStats
import com.ruvo.wear.shared.encodeControl
import kotlinx.coroutines.tasks.await

// Thin wrapper around the Wearable Data Layer MessageClient — the only
// thing this watch app ever talks to besides its own UI. No Firebase, no
// Auth, nothing else: every real piece of data (the run itself) lives on
// the paired phone, which is the whole point of "phone-tracked companion"
// mode over standalone on-watch tracking (see the scope decision this was
// built under).
class PhoneConnection(private val context: Context) {

    private val messageClient: MessageClient = Wearable.getMessageClient(context)
    private val nodeClient = Wearable.getNodeClient(context)

    // Registers while the companion screen is visible — there's no value
    // in receiving stats pushes when nothing on the watch is showing them,
    // unlike a control command, which the phone side must be able to
    // receive even while backgrounded (see WearSyncService on the phone).
    fun listenForStats(onStats: (RunStatsPayload) -> Unit): MessageClient.OnMessageReceivedListener {
        val listener = MessageClient.OnMessageReceivedListener { event: MessageEvent ->
            if (event.path == STATS_MESSAGE_PATH) {
                decodeStats(event.data)?.let(onStats)
            }
        }
        messageClient.addListener(listener)
        return listener
    }

    fun stopListening(listener: MessageClient.OnMessageReceivedListener) {
        messageClient.removeListener(listener)
    }

    // Best-effort: if no phone is currently connected (out of Bluetooth
    // range, phone app not installed, etc.) this silently does nothing
    // rather than crashing the watch screen — the wearer just sees no
    // stats update, the same as if the phone hadn't started a run yet.
    suspend fun sendCommand(action: String) {
        try {
            val nodes = nodeClient.connectedNodes.await()
            val payload = encodeControl(RunControlCommand(action))
            nodes.forEach { node ->
                messageClient.sendMessage(node.id, CONTROL_MESSAGE_PATH, payload).await()
            }
        } catch (_: Exception) { /* no connected phone right now — nothing to do */ }
    }
}
