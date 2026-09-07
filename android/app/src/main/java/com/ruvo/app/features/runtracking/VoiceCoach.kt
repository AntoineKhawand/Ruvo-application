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

// Competitor-analysis Tier 1 #4: Nike Run Club's coaches talk runners through
// breathing/pacing/motivation on a timeline, not just react when something's
// off. Only real gap this closes is the *type* of cue, not new plumbing —
// same TTS/audio-ducking pipeline as every other announce* below. Scoped to
// free runs only (announceWorkoutStep already narrates interval/workout mode
// on its own timeline; layering this on top there would double up cues).
// One-shot per elapsed-second key so a slow tick loop or a paused-then-
// resumed run never repeats or skips a line.
internal val GUIDED_RUN_SCRIPT: List<Pair<Int, String>> = listOf(
    60 to "One minute in. Settle into a rhythm you can hold — relax your shoulders.",
    300 to "Five minutes. Check your breathing: in for three steps, out for two.",
    600 to "Ten minutes in. You're warmed up now — this is your pace to hold.",
    900 to "Fifteen minutes. If it's getting tough, shorten your stride instead of slowing your legs down.",
    1200 to "Twenty minutes. Strong work. Relax your jaw and hands — tension anywhere costs you energy.",
    1800 to "Half an hour. Whatever's left in the tank, this is where it starts to count.",
    2700 to "Forty-five minutes. You're deep in it now — stay tall, eyes up.",
    3600 to "One hour. However this feels right now, you're still moving forward.",
)

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

    private val spokenGuidedMilestones = mutableSetOf<Int>()

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

    // Called every tick during a free (non-workout) run. Speaks at most one
    // scripted line per call, even if several milestones were somehow crossed
    // in one tick (e.g. resuming after a long pause) — a burst of queued
    // speech would be worse than silently skipping the earlier one.
    fun onGuidedRunTick(elapsedSeconds: Int) {
        if (!isEnabled) return
        val due = nextGuidedRunLine(elapsedSeconds, spokenGuidedMilestones) ?: return
        spokenGuidedMilestones += due.first
        speak(due.second)
    }

    // New run means the guided script starts over — otherwise a second run
    // in the same process (VoiceCoach is a singleton) would silently skip
    // every milestone it already spoke during the first one.
    fun resetGuidedRunState() {
        spokenGuidedMilestones.clear()
    }

    // Bug fix: resuming a run from a saved checkpoint after the app process
    // itself was killed (the exact scenario the checkpoint system exists
    // for) restores elapsedSeconds far past several milestones, but
    // spokenGuidedMilestones is in-memory only on this singleton and comes
    // back empty in the new process — without this, the next few ticks
    // would replay every already-passed milestone in a rapid one-per-tick
    // burst (e.g. resuming at 12 minutes would re-speak "One minute in",
    // then "Five minutes", then "Ten minutes" within a few seconds) instead
    // of correctly treating them as already heard. Marks them spoken
    // without speaking them; call once right after restoring elapsedSeconds,
    // before ticking resumes.
    fun catchUpGuidedRunState(elapsedSeconds: Int) {
        spokenGuidedMilestones += guidedMilestonesAtOrBefore(elapsedSeconds)
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
// Extracted the same way as decidePaceAlert above — pure, no Context/TTS
// needed, so the "which milestone (if any) is due" selection is unit
// testable without a live multi-minute run to reach each elapsed-time mark.
internal fun nextGuidedRunLine(
    elapsedSeconds: Int,
    alreadySpoken: Set<Int>,
    script: List<Pair<Int, String>> = GUIDED_RUN_SCRIPT,
): Pair<Int, String>? = script.firstOrNull { (at, _) -> at <= elapsedSeconds && at !in alreadySpoken }

// Bug fix: which milestones a checkpoint-restored run resumed at
// elapsedSeconds should treat as already spoken, so VoiceCoach
// .catchUpGuidedRunState can mark them without replaying them — extracted
// pure for the same reason as nextGuidedRunLine above. See that method's
// doc comment for the process-restart scenario this exists for.
internal fun guidedMilestonesAtOrBefore(
    elapsedSeconds: Int,
    script: List<Pair<Int, String>> = GUIDED_RUN_SCRIPT,
): Set<Int> = script.filter { (at, _) -> at <= elapsedSeconds }.map { it.first }.toSet()

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
