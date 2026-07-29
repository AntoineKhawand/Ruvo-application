package com.ruvo.app.features.runtracking

import android.content.Context
import android.speech.tts.TextToSpeech
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VoiceCoach @Inject constructor(@ApplicationContext private val context: Context) {

    private var tts: TextToSpeech? = null
    var isEnabled: Boolean = true
    private var lastKmAnnounced: Int = 0

    init {
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.US
                tts?.setSpeechRate(0.9f)
                tts?.setPitch(1.05f)
            }
        }
    }

    fun onDistanceUpdate(distanceKm: Double, paceMinPerKm: Double, elapsedSeconds: Int) {
        if (!isEnabled) return
        val km = distanceKm.toInt()
        if (km > lastKmAnnounced) {
            lastKmAnnounced = km
            announceKilometer(km, paceMinPerKm, elapsedSeconds)
        }
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
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, null)
    }

    fun shutdown() {
        tts?.stop()
        tts?.shutdown()
        tts = null
    }
}
