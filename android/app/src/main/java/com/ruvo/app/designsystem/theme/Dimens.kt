package com.ruvo.app.designsystem.theme

import androidx.compose.ui.unit.dp

/** Mirrors iOS's RuvoTheme.Spacing/Radius/Shadow so both platforms scale off the same values. */
object RuvoSpacing {
    val xs = 4.dp
    val sm = 8.dp
    val md = 16.dp
    val lg = 24.dp
    val xl = 32.dp
    val xxl = 48.dp

    /**
     * Gap between elements inside a card, or between sibling cards in a row/column --
     * sits between sm(8) and md(16). Not mirrored on iOS, but kept as its own token
     * rather than snapped either direction: the design-system audit found this exact
     * 12dp value hand-rolled 50+ times across Analytics/Community/Rewards/Referral/
     * Training/Privacy screens, consistently at this one value, which is a stronger
     * signal of a real, deliberate scale step than of six screens independently
     * guessing the same "wrong" number.
     */
    val cardGap = 12.dp
}

object RuvoRadius {
    val sm = 8.dp
    val md = 16.dp
    val lg = 24.dp
    val pill = 999.dp

    /**
     * Card/badge corner radius sitting between sm(8) and md(16). Flagged by the
     * design-system audit as appearing 6+ times in TrainingPlanScreen alone (and
     * repeated in Rewards/Community/Referral/Analytics too) at exactly 14dp --
     * common enough, and far enough from both neighbors, that snapping it to sm or
     * md would visibly change those cards' rounding rather than just deduplicating.
     */
    val card = 14.dp
}

object RuvoShadow {
    val primaryGlow = LimeDim
    val cardElevation = 20.dp
}
