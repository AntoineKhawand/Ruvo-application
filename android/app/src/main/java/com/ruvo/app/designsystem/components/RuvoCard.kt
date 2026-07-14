package com.ruvo.app.designsystem.components

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
    Surface(
        modifier = modifier
            .then(
                if (isHighlighted) Modifier.shadow(
                    elevation = 0.dp,
                    shape = shape,
                    ambientColor = glowColor.copy(alpha = 0.2f),
                    spotColor = glowColor.copy(alpha = 0.15f)
                ) else Modifier
            )
            .border(
                width = 1.dp,
                color = if (isHighlighted) glowColor.copy(alpha = 0.4f) else RuvoColors.border,
                shape = shape
            ),
        shape = shape,
        color = RuvoColors.surface,
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
