package com.ruvo.app.designsystem.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.ruvo.app.designsystem.theme.*

@Composable
fun RuvoCard(
    modifier: Modifier = Modifier,
    isHighlighted: Boolean = false,
    glowColor: Color = RuvoColors.lime,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(24.dp)
    // isHighlighted moves the card between two fixed visual states (resting /
    // selected) rather than something appearing -- RuvoMotion.EaseInOut is the
    // token documented for exactly that, at the standard tier. Callers that
    // toggle this per user tap (RuvoSelectableCard, Paywall plan cards, connected-
    // device rows, etc.) get a real transition instead of an instant color swap.
    val glowAlpha by animateFloatAsState(
        targetValue = if (isHighlighted) 1f else 0f,
        animationSpec = RuvoMotion.easeInOut(RuvoMotion.Duration.standard),
        label = "ruvo_card_glow_alpha",
    )
    val borderColor by animateColorAsState(
        targetValue = if (isHighlighted) glowColor.copy(alpha = 0.4f) else RuvoColors.border,
        animationSpec = RuvoMotion.easeInOut(RuvoMotion.Duration.standard),
        label = "ruvo_card_border_color",
    )
    // Compose's shadow() paints no shadow geometry at elevation = 0.dp, so the
    // ambient/spot alpha values below were previously invisible in every state --
    // the elevation itself has to animate too, not just the color alpha riding on it.
    val glowElevation by animateDpAsState(
        targetValue = if (isHighlighted) RuvoShadow.cardElevation else 0.dp,
        animationSpec = RuvoMotion.easeInOut(RuvoMotion.Duration.standard),
        label = "ruvo_card_glow_elevation",
    )
    Surface(
        modifier = modifier
            .shadow(
                elevation = glowElevation,
                shape = shape,
                ambientColor = glowColor.copy(alpha = 0.2f * glowAlpha),
                spotColor = glowColor.copy(alpha = 0.15f * glowAlpha)
            )
            .border(width = 1.dp, color = borderColor, shape = shape),
        shape = shape,
        color = RuvoColors.glassSurface,
    ) {
        Column(content = content)
    }
}

@Composable
fun RuvoStatCard(
    label: String,
    value: String,
    unit: String,
    modifier: Modifier = Modifier,
    accentColor: Color = RuvoColors.lime,
) {
    RuvoCard(modifier = modifier) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = label.uppercase(),
                style = RuvoTypography.labelSmall,
                color = RuvoColors.textTertiary,
            )
            Row(
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = value,
                    style = RuvoTypography.displayMedium,
                    color = accentColor,
                )
                Text(
                    text = unit,
                    style = RuvoTypography.bodySmall,
                    color = RuvoColors.textSecondary,
                    modifier = Modifier.padding(bottom = 6.dp)
                )
            }
        }
    }
}

@Composable
fun RuvoChip(
    label: String,
    modifier: Modifier = Modifier,
    isActive: Boolean = false,
    color: Color = RuvoColors.lime,
) {
    Surface(
        modifier = modifier
            .border(
                width = 1.dp,
                color = color.copy(alpha = 0.3f),
                shape = RoundedCornerShape(50)
            ),
        shape = RoundedCornerShape(50),
        color = if (isActive) color else color.copy(alpha = 0.1f),
    ) {
        Text(
            text = label,
            style = RuvoTypography.labelSmall,
            color = if (isActive) Color.Black else color,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
        )
    }
}
