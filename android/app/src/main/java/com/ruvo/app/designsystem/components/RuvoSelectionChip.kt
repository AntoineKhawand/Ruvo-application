package com.ruvo.app.designsystem.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ruvo.app.designsystem.theme.RuvoColors
import com.ruvo.app.designsystem.theme.RuvoMotion
import com.ruvo.app.designsystem.theme.RuvoTypography

/**
 * A compact selectable tile/pill/chip -- the shared shape behind the gender
 * pills, the 0-7 frequency number tiles, and the day-of-week chips in
 * onboarding (and any future "pick one" strip that isn't card-sized). Caller
 * owns sizing (`.weight()`/`.aspectRatio()`/`.size()`) and [shape] (pill,
 * `CircleShape`, rounded-square, whatever the strip calls for); this owns the
 * press-scale + selection-crossfade motion so those three call sites stop
 * hand-rolling their own instant color swap.
 */
@Composable
fun RuvoSelectionChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(12.dp),
    selectedColor: Color = RuvoColors.lime,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.97f else 1f,
        animationSpec = RuvoMotion.springBouncy(),
        label = "chip_scale",
    )
    // Selection crossfade: two fixed states (selected/unselected), so
    // RuvoMotion.EaseInOut per its own doc -- quick tier, since these are
    // small, high-repetition targets where a standard-tier fade would read
    // as sluggish next to the press-scale.
    val backgroundColor by animateColorAsState(
        targetValue = if (selected) selectedColor else RuvoColors.surfaceElev,
        animationSpec = RuvoMotion.easeInOut(RuvoMotion.Duration.quick),
        label = "chip_background",
    )
    val borderColor by animateColorAsState(
        targetValue = if (selected) selectedColor else RuvoColors.border,
        animationSpec = RuvoMotion.easeInOut(RuvoMotion.Duration.quick),
        label = "chip_border",
    )
    val contentColor by animateColorAsState(
        targetValue = if (selected) Color.Black else RuvoColors.textPrimary,
        animationSpec = RuvoMotion.easeInOut(RuvoMotion.Duration.quick),
        label = "chip_content",
    )

    Box(
        modifier = modifier
            .scale(scale)
            .clip(shape)
            .background(backgroundColor)
            .border(1.dp, borderColor, shape)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                role = Role.Button,
                onClick = onClick,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = RuvoTypography.labelLarge,
            fontWeight = FontWeight.Bold,
            color = contentColor,
        )
    }
}
