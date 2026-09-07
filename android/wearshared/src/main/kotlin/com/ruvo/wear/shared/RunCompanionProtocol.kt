package com.ruvo.wear.shared

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

// Wear OS companion (phone-tracked mode) — see WearSync.kt on the phone
// side and MainActivity.kt on the watch side for how each end uses this.
// Deliberately the simplest possible message shape: the watch never talks
// to Firebase/Auth/Firestore directly at all, only to the phone, over two
// Wearable Data Layer MessageClient paths. Both ends must agree on this
// schema byte-for-byte, which is the entire reason this lives in its own
// dependency-free module rather than being duplicated in :app and :wear.

const val STATS_MESSAGE_PATH = "/ruvo/stats"
const val CONTROL_MESSAGE_PATH = "/ruvo/control"

// Phone -> watch, sent on every stats tick while a run is active (see
// RunTrackingService's existing 1s timer — this piggybacks on it, throttled,
// rather than running its own clock).
@Serializable
data class RunStatsPayload(
    val distanceKm: Double,
    val paceMinPerKm: Double,
    val elapsedSeconds: Int,
    // Mirrors RunTrackingViewModel's RunState sealed type as a flat string
    // (Idle/Countdown/Running/Paused/Finished) — a flat enum-ish string is
    // simpler to keep in lockstep across two modules than trying to share
    // the phone's own sealed class here too.
    val runState: String,
)

// Watch -> phone, sent when the wearer taps a control button.
@Serializable
data class RunControlCommand(val action: String) {
    companion object {
        const val START = "start"
        const val PAUSE = "pause"
        const val RESUME = "resume"
        const val STOP = "stop"
    }
}

private val json = Json { ignoreUnknownKeys = true }

// Pure encode/decode — no MessageClient/Android involved — so the wire
// format itself is unit-testable without a paired watch or an emulator
// pair to exercise it against.
fun encodeStats(stats: RunStatsPayload): ByteArray = json.encodeToString(stats).encodeToByteArray()

fun decodeStats(bytes: ByteArray): RunStatsPayload? =
    runCatching { json.decodeFromString<RunStatsPayload>(bytes.decodeToString()) }.getOrNull()

fun encodeControl(command: RunControlCommand): ByteArray = json.encodeToString(command).encodeToByteArray()

fun decodeControl(bytes: ByteArray): RunControlCommand? =
    runCatching { json.decodeFromString<RunControlCommand>(bytes.decodeToString()) }.getOrNull()
