package com.ruvo.app.features.aicoach

import com.ruvo.app.features.analytics.TrainingLoadStatus
import com.ruvo.app.features.weather.RunWeatherAdvice
import java.time.LocalDate

// "What would make this app very special" follow-up to the competitor
// analysis: training load, missed sessions, streak, and weather already
// exist as independent signals scattered across different screens — this
// fuses them into ONE prioritized read, the way a real coach opens a
// conversation, instead of leaving a runner to notice and connect several
// separate cards themselves. Deliberately client-side and deterministic,
// not a Gemini call: this lives in AICoachViewModel because it's
// coach-flavored insight, but doesn't depend on the model or hit the
// missing-local-GEMINI_API_KEY gap that already blocks live-testing the
// chat path in this dev environment — it works the same every time.
//
// Deliberately scoped to signals that are already cheap to gather from data
// this ViewModel (or a sibling one) already reads — recovery score (needs
// Health Connect) and segment PRs (needs a second Firestore query) were
// left out of this first version rather than pulled in just to be
// exhaustive; worth adding once this shape proves useful.

data class DailyBriefing(val emoji: String, val message: String)

// Same algorithm as HomeViewModel's/ProfileScreen's own computeStreak()
// (see their doc comments — those two already independently duplicate each
// other for the same reason) — duplicated here rather than forcing a
// cross-package refactor of two other, unrelated, already-shipped screens
// for one small pure function. Same tradeoff already made for
// todayDayAbbrevForPlan elsewhere in this app.
internal fun computeStreakForBriefing(runDates: Set<LocalDate>): Int {
    var day = LocalDate.now()
    if (day !in runDates) day = day.minusDays(1) // today not run yet doesn't break the streak
    var streak = 0
    while (day in runDates) {
        streak++
        day = day.minusDays(1)
    }
    return streak
}

// Pure: given today's gathered signals, picks the ONE most notable thing to
// open with — priority order is "the thing most worth acting on or
// celebrating today", not the order the data happens to be computed in.
// Anything with a real injury-prevention or action stake outranks anything
// merely encouraging.
internal fun composeDailyBriefing(
    trainingLoad: TrainingLoadStatus?,
    missedSessionsThisWeek: Int,
    streakDays: Int,
    weatherAdvice: RunWeatherAdvice?,
): DailyBriefing {
    if (trainingLoad != null && trainingLoad.band == "High Load") {
        return DailyBriefing("⚠️", trainingLoad.message)
    }
    if (missedSessionsThisWeek >= 2) {
        return DailyBriefing(
            "👀",
            "You've missed $missedSessionsThisWeek sessions this week — no judgment, just flagging it. Want to talk through easing the rest of the week?",
        )
    }
    if (weatherAdvice != null && !weatherAdvice.isGoodForRun) {
        return DailyBriefing(weatherAdvice.emoji, "Today's conditions: ${weatherAdvice.condition}. ${weatherAdvice.recommendation}")
    }
    if (trainingLoad != null && trainingLoad.band == "Building Fast") {
        return DailyBriefing("📈", trainingLoad.message)
    }
    if (streakDays >= 3) {
        return DailyBriefing("🔥", "$streakDays days in a row — that consistency is exactly what builds real fitness. Keep it going.")
    }
    if (trainingLoad != null && trainingLoad.band == "Optimal") {
        return DailyBriefing("✅", trainingLoad.message)
    }
    return DailyBriefing("👋", "Ready when you are — no red flags today.")
}
