package com.ruvo.app.designsystem.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.ruvo.app.designsystem.theme.RuvoColors
import com.ruvo.app.designsystem.theme.RuvoMotion

/**
 * Animated segmented step indicator for wizard-style flows (onboarding and
 * beyond) -- replaces a bare `Row` of `Box`es with an instant color swap.
 * The active segment's width morph uses [RuvoMotion.springSettled] (a size
 * change, not a gesture or celebration -- the critically-damped default);
 * the fill color crossfade uses [RuvoMotion.easeInOut] at the quick tier
 * (two fixed states, done fast since it repeats on every step).
 */
@Composable
fun RuvoProgressSteps(
    totalSteps: Int,
    currentStep: Int,
    modifier: Modifier = Modifier,
    activeColor: Color = RuvoColors.lime,
    inactiveColor: Color = RuvoColors.border,
) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.Center) {
        repeat(totalSteps) { i ->
            val isActive = i == currentStep
            val isPast = i < currentStep
            val width by animateDpAsState(
                targetValue = if (isActive) 24.dp else 8.dp,
                animationSpec = RuvoMotion.springSettled(),
                label = "progress_segment_width",
            )
            val color by animateColorAsState(
                targetValue = if (isActive || isPast) activeColor else inactiveColor,
                animationSpec = RuvoMotion.easeInOut(RuvoMotion.Duration.quick),
                label = "progress_segment_color",
            )
            Box(
                modifier = Modifier
                    .padding(horizontal = 4.dp)
                    .size(width = width, height = 8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(color),
            )
        }
    }
}
