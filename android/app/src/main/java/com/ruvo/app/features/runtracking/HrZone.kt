package com.ruvo.app.features.runtracking

import androidx.compose.ui.graphics.Color

// RN: getHrZone(hr, age=30) — RN_SOURCE_ARCHIVE.md §1. maxHr = 220-age, pct = hr/maxHr.
enum class HrZone(val label: String, val color: Color) {
    Resting("Resting", Color(0xFF8E8E93)),
    WarmUp("Warm Up", Color(0xFF5AC8FA)),
    FatBurn("Fat Burn", Color(0xFF34C759)),
    Aerobic("Aerobic", Color(0xFFFFCC00)),
    Threshold("Threshold", Color(0xFFFF9500)),
    Max("Max", Color(0xFFFF3B30)),
}

fun hrZoneFor(bpm: Int, age: Int = 30): HrZone? {
    if (bpm <= 0) return null
    val maxHr = 220 - age
    val pct = bpm.toDouble() / maxHr
    return when {
        pct >= 0.9 -> HrZone.Max
        pct >= 0.8 -> HrZone.Threshold
        pct >= 0.7 -> HrZone.Aerobic
        pct >= 0.6 -> HrZone.FatBurn
        pct >= 0.5 -> HrZone.WarmUp
        else -> HrZone.Resting
    }
}
