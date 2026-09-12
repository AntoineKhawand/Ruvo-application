package com.ruvo.app.designsystem.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import com.ruvo.app.designsystem.theme.RuvoColors
import com.ruvo.app.designsystem.theme.RuvoMotion

/**
 * A [RuvoCard] that is tappable and carries a selected/unselected state --
 * the shared shape behind Goal cards, Level rows, and any other "pick one of
 * these" option in onboarding (and beyond). Reach for this instead of a bare
 * `Surface(onClick = ...)` with an instant border/background swap: it adds the
 * same press-scale feedback [RuvoButton] uses (gesture-driven, so
 * [RuvoMotion.springBouncy]) plus [RuvoCard]'s own animated selection
 * crossfade for the border/glow.
 *
 * Purely a behavior wrapper -- padding/layout stays entirely up to [content],
 * same as [RuvoCard].
 */
@Composable
fun RuvoSelectableCard(
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    glowColor: Color = RuvoColors.lime,
    content: @Composable ColumnScope.() -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.97f else 1f,
        animationSpec = RuvoMotion.springBouncy(),
        label = "selectable_card_scale",
    )

    RuvoCard(
        modifier = modifier
            .scale(scale)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                role = Role.Button,
                onClick = onClick,
            ),
        isHighlighted = selected,
        glowColor = glowColor,
        content = content,
    )
}
