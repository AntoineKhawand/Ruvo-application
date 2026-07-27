package com.ruvo.app.features.runtracking

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

// RN: Haptics.lightTap() on nearly every run-tracking button (start/pause/
// resume/lap), Haptics.successFeedback() on Finish. See RN_SOURCE_ARCHIVE.md
// §1 "Voice/haptic feedback (exact templates)".
@Singleton
class HapticsCoach @Inject constructor(@ApplicationContext private val context: Context) {

    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    fun lightTap() {
        vibrate(longArrayOf(0, 15), intArrayOf(0, 80))
    }

    fun success() {
        vibrate(longArrayOf(0, 20, 60, 35), intArrayOf(0, 120, 0, 200))
    }

    private fun vibrate(timings: LongArray, amplitudes: IntArray) {
        val v = vibrator ?: return
        if (!v.hasVibrator()) return
        v.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
    }
}
