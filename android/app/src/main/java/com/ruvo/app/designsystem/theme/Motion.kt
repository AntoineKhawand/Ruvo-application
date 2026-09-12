package com.ruvo.app.designsystem.theme

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.ContentTransform
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.ui.unit.IntOffset

/**
 * Shared motion tokens. Extend these instead of reaching for a raw `tween`/`spring`
 * or Compose's built-in easings (FastOutSlowIn etc.) inline -- a parallel, private
 * curve per screen is how motion stops feeling like one product.
 */
object RuvoMotion {
    /** Duration tiers, named by what the motion communicates rather than by number. */
    object Duration {
        const val instant = 120
        const val quick = 160
        const val standard = 220
        const val entrance = 320
        const val modal = 400
        const val screenEntrance = 520
    }

    /** Ease-out: fast start, gentle settle. Default for anything appearing or moving into place. */
    val EaseOut: Easing = CubicBezierEasing(0.23f, 1f, 0.32f, 1f)

    /** Ease-in-out: symmetric acceleration. For things that move between two fixed states. */
    val EaseInOut: Easing = CubicBezierEasing(0.77f, 0f, 0.175f, 1f)

    /** Spacing between successive items in a staggered entrance/list reveal. */
    const val staggerStepMillis = 60

    fun <T> easeOut(durationMillis: Int = Duration.standard): FiniteAnimationSpec<T> =
        tween(durationMillis = durationMillis, easing = EaseOut)

    fun <T> easeInOut(durationMillis: Int = Duration.standard): FiniteAnimationSpec<T> =
        tween(durationMillis = durationMillis, easing = EaseInOut)

    /** Critically damped -- settles without overshoot. The correct default for most UI motion. */
    fun <T> springSettled(): FiniteAnimationSpec<T> = spring(dampingRatio = 1f, stiffness = 380f)

    /** A touch of bounce/momentum. Reserve for gesture-driven or celebratory motion, not routine UI. */
    fun <T> springBouncy(): FiniteAnimationSpec<T> = spring(dampingRatio = 0.65f, stiffness = 380f)

    /**
     * Horizontal step-to-step transition for wizard-style flows (drop into an
     * `AnimatedContent`'s `transitionSpec`). Incoming content eases in from the
     * direction of travel while outgoing content eases the opposite way, both on
     * [EaseOut] at [Duration.entrance] -- the incoming step is "appearing/moving
     * into place," which is exactly EaseOut's documented job above. Reach for this
     * instead of a private `slideInHorizontally`/`fadeIn` pair per screen.
     *
     * Usage inside `AnimatedContent(targetState = step, transitionSpec = { ... })`:
     * ```
     * transitionSpec = { RuvoMotion.stepTransition<Int>(forward = targetState >= initialState)() }
     * ```
     */
    fun <S> stepTransition(forward: Boolean): AnimatedContentTransitionScope<S>.() -> ContentTransform = {
        val offsetSpec = tween<IntOffset>(durationMillis = Duration.entrance, easing = EaseOut)
        val fadeSpec = tween<Float>(durationMillis = Duration.entrance, easing = EaseOut)
        val direction = if (forward) 1 else -1
        (slideInHorizontally(offsetSpec) { width -> direction * width / 4 } + fadeIn(fadeSpec)) togetherWith
            (slideOutHorizontally(offsetSpec) { width -> -direction * width / 4 } + fadeOut(fadeSpec))
    }
}
