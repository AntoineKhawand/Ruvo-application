package com.ruvo.app.core.wear

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import com.ruvo.app.features.runtracking.RunTrackingService
import com.ruvo.wear.shared.CONTROL_MESSAGE_PATH
import com.ruvo.wear.shared.RunControlCommand
import com.ruvo.wear.shared.RunStatsPayload
import com.ruvo.wear.shared.STATS_MESSAGE_PATH
import com.ruvo.wear.shared.decodeControl
import com.ruvo.wear.shared.encodeStats
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

// Wear OS companion, phone-tracked mode (the shape chosen over standalone
// on-watch GPS tracking — see the scope decision this was built under).
// The watch never talks to Firebase/Auth directly; every real bit of data
// still lives here on the phone, and this is the one file that bridges
// RunTrackingService to a paired watch over the Wearable Data Layer, using
// the shared message schema in :wearshared so both ends agree on the wire
// format. **Compiled and unit-tested (the schema itself, in :wearshared)
// but never live-verified against a real watch or a Wear emulator** — see
// RN_ANDROID_PORT_MAPPING.md's "Wear OS companion" log entry for exactly
// why and what closing that out would require.

// Phone -> watch. Injected into RunTrackingService the same way
// VoiceCoach/HapticsCoach are — a small, separately-testable-in-shape
// collaborator the service calls into, rather than inlining Wearable API
// calls directly into an already-large service class.
@Singleton
class WearStatsBroadcaster @Inject constructor(@dagger.hilt.android.qualifiers.ApplicationContext private val context: Context) {
    private val messageClient by lazy { Wearable.getMessageClient(context) }
    private val nodeClient by lazy { Wearable.getNodeClient(context) }

    // Best-effort and non-blocking, same principle as every other
    // "nice-to-have, never hold up the real run" side effect in this app
    // (segment matching, badge awarding): most users have no watch paired
    // at all, and that must never be an error path.
    suspend fun broadcast(distanceKm: Double, paceMinPerKm: Double, elapsedSeconds: Int, runState: String) {
        try {
            val nodes = nodeClient.connectedNodes.await()
            if (nodes.isEmpty()) return
            val payload = encodeStats(RunStatsPayload(distanceKm, paceMinPerKm, elapsedSeconds, runState))
            nodes.forEach { node -> messageClient.sendMessage(node.id, STATS_MESSAGE_PATH, payload) }
        } catch (_: Exception) { /* no paired watch right now — not an error */ }
    }
}

// Watch -> phone. Manifest-registered (see AndroidManifest.xml) so a
// control command reaches the phone even while the app itself isn't in
// the foreground — the same reason FCM/notification listener services are
// always manifest-declared rather than only registered while an Activity
// is alive.
@AndroidEntryPoint
class WearSyncService : WearableListenerService() {
    override fun onMessageReceived(event: MessageEvent) {
        if (event.path != CONTROL_MESSAGE_PATH) return
        val command = decodeControl(event.data) ?: return

        // "Stop" deliberately maps to pause, not RunTrackingService's real
        // stopTracking() — finishing a run for real means the rating/XP/
        // Firestore-save flow, which only exists as phone UI
        // (RunTrackingViewModel.finishRun()); a watch tap can't drive that
        // UI. Pausing leaves the run intact and resumable/finishable from
        // the phone, rather than a watch tap silently discarding it.
        val action = when (command.action) {
            RunControlCommand.START -> ACTION_WEAR_START
            RunControlCommand.PAUSE, RunControlCommand.STOP -> ACTION_WEAR_PAUSE
            RunControlCommand.RESUME -> ACTION_WEAR_RESUME
            else -> return
        }
        val intent = Intent(this, RunTrackingService::class.java).setAction(action)
        ContextCompat.startForegroundService(this, intent)
    }
}

const val ACTION_WEAR_START = "com.ruvo.app.action.WEAR_START"
const val ACTION_WEAR_PAUSE = "com.ruvo.app.action.WEAR_PAUSE"
const val ACTION_WEAR_RESUME = "com.ruvo.app.action.WEAR_RESUME"
