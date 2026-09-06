package com.ruvo.app.features.runtracking

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.Locale
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

// 20 sec/km off target before alerting, at most one repeat alert per 45s in
// the same direction — original thresholds (no RN spec exists for this
// feature), chosen to be noticeable without nagging every tick.
private const val PACE_ALERT_THRESHOLD_MIN_PER_KM = 20.0 / 60.0
private const val PACE_ALERT_COOLDOWN_SECONDS = 45

@Singleton
class VoiceCoach @Inject constructor(@ApplicationContext private val context: Context) {

    private var tts: TextToSpeech? = null
    var isEnabled: Boolean = true
    private var lastKmAnnounced: Int = 0

    // Pace-deviation alerts — RN_SOURCE_ARCHIVE.md §1 explicitly flags that
    // neither distance-milestone callouts nor pace-deviation alerts exist in
    // RN despite splits/target paces being tracked, and lists both as "a
    // deliberate new feature" to consider adding, not a port. Distance
    // milestones (onDistanceUpdate above) already existed; this adds the
    // pace half. Scoped to workout/interval mode's real targetPaceMinPerKm
    // per step (IntervalTrainingScreen.kt) rather than a free run's own
    // average, since "deviation" only means something against an actual
    // target — nothing in this app treats a free run's early, still-settling
    // average as a target to hit.
    private var lastPaceAlertDirection: Int = 0 // -1 too fast, 0 on pace, 1 too slow
    private var lastPaceAlertElapsedSeconds: Int = Int.MIN_VALUE

    // RN loops a silent WAV to hold audio focus and duck the user's music
    // (see RN_SOURCE_ARCHIVE.md §5 WorkoutDetailScreen "Audio ducking hack" —
    // flagged there as a trick to replace with a real platform mechanism, not
    // port as-is). For TTS specifically, the equivalent is AudioFocusRequest
    // with AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK: request it right before each
    // announcement, release it once TTS reports the utterance finished.
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        )
        .setAcceptsDelayedFocusGain(false)
        .build()

    init {
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.US
                tts?.setSpeechRate(0.9f)
                tts?.setPitch(1.05f)
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {}
                    override fun onDone(utteranceId: String?) = abandonAudioFocus()
                    @Deprecated("Deprecated in TTS API, still the only override called on older OS versions")
                    override fun onError(utteranceId: String?) = abandonAudioFocus()
                    override fun onError(utteranceId: String?, errorCode: Int) = abandonAudioFocus()
                    override fun onStop(utteranceId: String?, interrupted: Boolean) = abandonAudioFocus()
                })
            }
        }
    }

    private fun abandonAudioFocus() {
        audioManager.abandonAudioFocusRequest(audioFocusRequest)
    }

    fun onDistanceUpdate(distanceKm: Double, paceMinPerKm: Double, elapsedSeconds: Int) {
        if (!isEnabled) return
        val km = distanceKm.toInt()
        if (km > lastKmAnnounced) {
            lastKmAnnounced = km
            announceKilometer(km, paceMinPerKm, elapsedSeconds)
        }
    }

    // Called on every tick during an active workout step that has a real
    // target pace. Only announces on a direction *change* (on-pace -> too
    // slow/fast, or a flip between the two), plus a cooldown once already
    // alerted in the same direction, so this nags at most a couple of times
    // per step rather than every second the runner is off target.
    fun onPaceCheck(currentPaceMinPerKm: Double, targetPaceMinPerKm: Double?, elapsedSeconds: Int) {
        if (!isEnabled || targetPaceMinPerKm == null || currentPaceMinPerKm <= 0) return
        val decision = decidePaceAlert(currentPaceMinPerKm, targetPaceMinPerKm, elapsedSeconds, lastPaceAlertDirection, lastPaceAlertElapsedSeconds)
        lastPaceAlertDirection = decision.direction
        if (!decision.shouldSpeak) return
        lastPaceAlertElapsedSeconds = elapsedSeconds
        speak(if (decision.direction == 1) "Speed up, you're behind pace." else "Ease up, you're ahead of pace.")
    }

    // New workout step means a new target pace — start each step's deviation
    // tracking fresh rather than carrying over the previous step's state.
    fun resetPaceAlertState() {
        lastPaceAlertDirection = 0
        lastPaceAlertElapsedSeconds = Int.MIN_VALUE
    }

    private fun announceKilometer(km: Int, paceMinPerKm: Double, elapsedSeconds: Int) {
        val paceMin = paceMinPerKm.toInt()
        val paceSec = ((paceMinPerKm - paceMin) * 60).toInt()
        val timeMin = elapsedSeconds / 60
        val timeSec = elapsedSeconds % 60
        val text = "$km kilometer. Pace: $paceMin minutes $paceSec seconds per kilometer. Time: $timeMin minutes $timeSec seconds."
        speak(text)
    }

    // RN: spoken once per screen mount, before the first GPS fix arrives
    // (RN_SOURCE_ARCHIVE.md §1 "Voice/haptic feedback"). Android has no
    // auto-start-on-lock like RN — these just tell the user GPS status while
    // they wait to tap Start.
    fun announceGpsAcquiring() {
        if (!isEnabled) return
        speak("Acquiring GPS, get ready.")
    }

    fun announceGpsReady() {
        if (!isEnabled) return
        speak("GPS ready. Let's run.")
    }

    fun announceRunStart() {
        if (!isEnabled) return
        lastKmAnnounced = 0
        speak("Run started. Good luck!")
    }

    fun announceRunPaused() {
        if (!isEnabled) return
        speak("Workout paused.")
    }

    fun announceRunResumed() {
        if (!isEnabled) return
        speak("Resuming workout.")
    }

    fun announceRunFinished(distanceKm: Double, averagePaceMinPerKm: Double) {
        if (!isEnabled) return
        val dist = String.format("%.2f", distanceKm)
        val paceMin = averagePaceMinPerKm.toInt()
        val paceSec = ((averagePaceMinPerKm - paceMin) * 60).toInt()
        speak("Great run! $dist kilometers completed. Average pace: $paceMin minutes $paceSec seconds per kilometer. Well done!")
    }

    // RN speaks just the bare lap number — the distance/pace detail is a
    // separate non-voice visual notification, not part of the spoken line
    // (RN_SOURCE_ARCHIVE.md §1: `Lap ${n}` + a non-voice "🏁 Lap Recorded" alert).
    fun announceLap(lapNumber: Int) {
        if (!isEnabled) return
        speak("Lap $lapNumber")
    }

    // RN: "Voice toggle-on: 'Voice feedback enabled' (bypasses the enabled-gate
    // intentionally)" (RN_SOURCE_ARCHIVE.md §1) — unlike every announce* above,
    // this one always speaks, even right as isEnabled flips true.
    fun announceVoiceEnabled() {
        speak("Voice feedback enabled")
    }

    fun speak(text: String) {
        // Speak regardless of the focus result — a coaching cue that fails
        // silently because some other app briefly held focus is worse than
        // one that plays without ducking. onDone/onError above release focus
        // if it was granted; nothing to release otherwise.
        audioManager.requestAudioFocus(audioFocusRequest)
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, UUID.randomUUID().toString())
    }

    fun shutdown() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        abandonAudioFocus()
    }
}

// Direction: -1 too fast, 0 on pace, 1 too slow — mirrors lastPaceAlertDirection above.
internal data class PaceAlertDecision(val direction: Int, val shouldSpeak: Boolean)

// Extracted from onPaceCheck as a pure function (no Context/TextToSpeech/
// AudioManager involved) specifically so this decision — direction-change-or-
// cooldown gating — is unit testable without constructing a real VoiceCoach,
// which needs a live Android Context to even initialize TTS. This is the
// exact logic a live GPS-simulated workout run was needed to exercise during
// development (feeding synthetic slow/fast pace to confirm "Speed up"/"Ease
// up" actually fire); a test covers the same scenarios in milliseconds.
internal fun decidePaceAlert(
    currentPaceMinPerKm: Double,
    targetPaceMinPerKm: Double,
    elapsedSeconds: Int,
    lastDirection: Int,
    lastAlertElapsedSeconds: Int,
    thresholdMinPerKm: Double = PACE_ALERT_THRESHOLD_MIN_PER_KM,
    cooldownSeconds: Int = PACE_ALERT_COOLDOWN_SECONDS,
): PaceAlertDecision {
    val deviationMinPerKm = currentPaceMinPerKm - targetPaceMinPerKm
    val direction = when {
        deviationMinPerKm > thresholdMinPerKm -> 1
        deviationMinPerKm < -thresholdMinPerKm -> -1
        else -> 0
    }
    if (direction == 0) return PaceAlertDecision(direction = 0, shouldSpeak = false)
    val cooledDown = elapsedSeconds - lastAlertElapsedSeconds >= cooldownSeconds
    if (direction == lastDirection && !cooledDown) return PaceAlertDecision(direction = direction, shouldSpeak = false)
    return PaceAlertDecision(direction = direction, shouldSpeak = true)
}
