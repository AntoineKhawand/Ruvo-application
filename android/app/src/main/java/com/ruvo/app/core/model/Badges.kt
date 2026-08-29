package com.ruvo.app.core.model

import java.time.DayOfWeek
import java.time.Instant
import java.time.ZoneId

// A run's fields relevant to badge conditions, parsed once from the raw
// Firestore map shape (see RunSaveViewModel/SaveActivityViewModel's
// runEntry) rather than re-parsing dates/duration inline in every
// condition lambda below.
data class NormalizedRun(
    val date: Instant,
    val distanceKm: Double,
    val elevationGainM: Double,
    val durationSeconds: Long,
) {
    val paceMinPerKm: Double get() = if (distanceKm > 0) (durationSeconds / 60.0) / distanceKm else Double.MAX_VALUE
}

data class Badge(
    val id: String,
    val name: String,
    val emoji: String,
    val description: String,
    val colorHex: String,
    val category: String,
    val unlocked: Boolean = false,
    // (run just saved, prior history — NOT including this run) -> earned?
    // Matches RN's real `condition(run, history)` shape (badges.js) so this
    // stays a direct, checkable port rather than a reinterpretation.
    val condition: (NormalizedRun, List<NormalizedRun>) -> Boolean = { _, _ -> false },
)

// All badge definitions — verbatim from RN's src/constants/badges.js (the
// authoritative BADGES array, copied raw to docs/rn-reference/badges.js).
// This previously invented its own catalogue (different ids, extra badges
// like "streak_30"/"gear_tracker" that don't exist in RN, and missing real
// RN ones like b_perfect_week/b_weekend_warrior/b_hill_hunter/b_sub4_specialist)
// — a real divergence, not a stylistic choice, since `hasBadge()` matches by
// id and any persisted `badges` entries use RN's real ids. Category strings
// are the exact display names archive §3 documents (milestone→"Distance
// Milestones" etc.) since buildCategories() groups by this field directly.
//
// Unlock conditions (archive §3's exact-copy table) now backed by real
// condition lambdas — RN's checkNewBadges()/badgeService.js was never
// ported at all before this, so every account showed all 12 permanently
// locked regardless of actual run history.
val ALL_BADGES = listOf(
    // --- Distance Milestones ---
    Badge("b_first_run", "First Steps", "👣", "Completed your first run!", "#CCFF00", "Distance Milestones",
        condition = { _, history -> history.isEmpty() }),
    Badge("b_5k", "High Five", "🖐️", "Ran 5km in a single session.", "#CCFF00", "Distance Milestones",
        condition = { run, _ -> run.distanceKm >= 5.0 }),
    Badge("b_10k", "10K Finisher", "🎗️", "Ran 10km in a single session.", "#FF4500", "Distance Milestones",
        condition = { run, _ -> run.distanceKm >= 10.0 }),
    Badge("b_half", "Half Marathon", "🏅", "Ran 21.1km in a single session.", "#FFD700", "Distance Milestones",
        condition = { run, _ -> run.distanceKm >= 21.097 }),
    Badge("b_century_club", "Century Club", "🏆", "Ran 100km total distance.", "#9C27B0", "Distance Milestones",
        condition = { run, history -> history.sumOf { it.distanceKm } + run.distanceKm >= 100.0 }),

    // --- Lifestyle & Habits ---
    Badge("b_early_bird", "Early Bird", "☀️", "Finished a run before 7 AM.", "#FDD835", "Lifestyle & Habits",
        condition = { run, _ -> localHour(run.date) < 7 }),
    Badge("b_night_owl", "Night Owl", "🌙", "Finished a run after 8 PM.", "#536DFE", "Lifestyle & Habits",
        condition = { run, _ -> localHour(run.date) >= 20 }),
    Badge("b_weekend_warrior", "Weekend Warrior", "🍺", "Ran on both Saturday and Sunday.", "#FF9800", "Lifestyle & Habits",
        condition = { run, history -> hasWeekendPair(run, history) }),

    // --- Consistency & Streaks ---
    Badge("b_10_runs", "Dedicated", "🔥", "Completed 10 total runs.", "#FF5722", "Consistency & Streaks",
        condition = { _, history -> history.size == 9 }),
    Badge("b_perfect_week", "Perfect Week", "📅", "Ran 7 days in a row.", "#00E676", "Consistency & Streaks",
        condition = { run, history -> hasSevenConsecutiveDays(run, history) }),

    // --- Elevation Challenges ---
    // Archive §3 flags RN's real condition as reading `run.elevation` — a
    // field name that doesn't exist anywhere real runs are ever written
    // (the actual field is `elevationGain`), so this "likely never actually
    // fires in RN" per the archive's own note, which explicitly says to fix
    // this when porting rather than replicate the dead condition verbatim.
    Badge("b_hill_hunter", "Hill Hunter", "📈", "Completed 10 runs with 100m+ elevation.", "#795548", "Elevation Challenges",
        condition = { run, history -> run.elevationGainM >= 100.0 && history.count { it.elevationGainM >= 100.0 } >= 9 }),

    // --- Speed & Performance ---
    Badge("b_sub4_specialist", "Sub-4 Specialist", "⚡", "Completed 5 runs under 4:00/km pace.", "#00BCD4", "Speed & Performance",
        condition = { run, history -> run.paceMinPerKm < 4.0 && history.count { it.paceMinPerKm < 4.0 } >= 4 }),
)

private fun localHour(instant: Instant): Int = instant.atZone(ZoneId.systemDefault()).hour

// Sorts all run dates (history + the just-saved run) and checks for 7
// consecutive calendar days each having at least one run — archive §3's
// exact b_perfect_week spec.
private fun hasSevenConsecutiveDays(run: NormalizedRun, history: List<NormalizedRun>): Boolean {
    val dates = (history.map { it.date } + run.date)
        .map { it.atZone(ZoneId.systemDefault()).toLocalDate() }
        .toSortedSet()
    if (dates.size < 7) return false
    var streak = 1
    var prev: java.time.LocalDate? = null
    for (d in dates) {
        streak = if (prev != null && d == prev.plusDays(1)) streak + 1 else 1
        if (streak >= 7) return true
        prev = d
    }
    return false
}

// Within the trailing 7 days ending on the just-saved run's date, both a
// Saturday run and a Sunday run exist — archive §3's exact b_weekend_warrior
// spec (the window includes the run just saved, since RN's own version
// checks `run.date` alongside history too).
private fun hasWeekendPair(run: NormalizedRun, history: List<NormalizedRun>): Boolean {
    val windowEnd = run.date.atZone(ZoneId.systemDefault()).toLocalDate()
    val windowStart = windowEnd.minusDays(6)
    val datesInWindow = (history.map { it.date } + run.date)
        .map { it.atZone(ZoneId.systemDefault()).toLocalDate() }
        .filter { !it.isBefore(windowStart) && !it.isAfter(windowEnd) }
    return datesInWindow.any { it.dayOfWeek == DayOfWeek.SATURDAY } &&
        datesInWindow.any { it.dayOfWeek == DayOfWeek.SUNDAY }
}

private fun parseDurationSecondsForBadge(duration: String?): Long {
    val parts = duration?.split(":")?.mapNotNull { it.toLongOrNull() } ?: return 0L
    return when (parts.size) {
        2 -> parts[0] * 60 + parts[1]
        3 -> parts[0] * 3600 + parts[1] * 60 + parts[2]
        else -> 0L
    }
}

fun Map<String, Any?>.toNormalizedRunOrNull(): NormalizedRun? {
    val instant = (this["date"] as? String)?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return null
    val distance = (this["distance"] as? Number)?.toDouble() ?: return null
    val elevation = (this["elevationGain"] as? Number)?.toDouble() ?: 0.0
    val durationSeconds = parseDurationSecondsForBadge(this["duration"] as? String)
    return NormalizedRun(instant, distance, elevation, durationSeconds)
}

// Real port of RN's checkNewBadges() (src/services/badgeService.js) —
// strips the condition fn before returning (functions aren't persistable
// anyway), stamps earnedAt, and skips already-owned ids. Callers persist
// the result via FieldValue.arrayUnion(...) on users/{uid}.badges, same as
// RN's real (client-side, not server-validated) write path — see archive
// §3's "Firestore" note on why this stays client-side rather than moving
// to the Kotlin backend as a separate, larger change.
fun checkNewBadges(
    runEntry: Map<String, Any?>,
    priorHistory: List<Map<String, Any?>>,
    alreadyEarnedIds: Set<String>,
): List<Map<String, Any>> {
    val run = runEntry.toNormalizedRunOrNull() ?: return emptyList()
    val history = priorHistory.mapNotNull { it.toNormalizedRunOrNull() }
    val earnedAt = Instant.now().toString()
    return ALL_BADGES.filter { badge ->
        badge.id !in alreadyEarnedIds && badge.condition(run, history)
    }.map { badge ->
        mapOf(
            "id" to badge.id,
            "name" to badge.name,
            "description" to badge.description,
            "icon" to badge.emoji,
            "color" to badge.colorHex,
            "category" to badge.category,
            "earnedAt" to earnedAt,
        )
    }
}
