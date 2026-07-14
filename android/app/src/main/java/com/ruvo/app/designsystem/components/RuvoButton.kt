package com.ruvo.app.designsystem.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ruvo.app.designsystem.theme.RuvoColors
import com.ruvo.app.designsystem.theme.RuvoTypography

@Composable
fun RuvoButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    style: RuvoButtonVariant = RuvoButtonVariant.Primary,
    icon: ImageVector? = null,
    isLoading: Boolean = false,
    enabled: Boolean = true,
    fullWidth: Boolean = true,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.97f else 1f,
        animationSpec = spring(dampingRatio = 0.6f),
        label = "button_scale"
    )

    val shape = CircleShape
    val height = 52.dp

    Box(
        modifier = modifier
            .then(if (fullWidth) Modifier.fillMaxWidth() else Modifier)
            .height(height)
            .scale(scale)
            .clip(shape)
            .background(style.background())
            .then(
                if (style == RuvoButtonVariant.Secondary)
                    Modifier.border(1.dp, Color.White.copy(alpha = 0.2f), shape)
                else Modifier
            ),
        contentAlignment = Alignment.Center
    ) {
        Button(
            onClick = onClick,
            modifier = Modifier.fillMaxSize(),
            enabled = enabled && !isLoading,
            shape = shape,
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Transparent,
                contentColor = style.contentColor(),
                disabledContainerColor = Color.Transparent,
                disabledContentColor = style.contentColor().copy(alpha = 0.4f)
            ),
            contentPadding = PaddingValues(horizontal = if (fullWidth) 0.dp else 32.dp),
            interactionSource = interactionSource,
            elevation = null,
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = style.contentColor(),
                    strokeWidth = 2.dp
                )
            } else {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (icon != null) {
                        Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(18.dp))
                    }
                    Text(
                        text = text,
                        style = RuvoTypography.labelLarge,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

enum class RuvoButtonVariant {
    Primary, Secondary, Ghost, Destructive;

    @Composable
    fun background() = when (this) {
        Primary -> Brush.linearGradient(listOf(RuvoColors.lime, Color(0xFFA8CC00)))
        Secondary -> Brush.linearGradient(listOf(Color.White.copy(alpha = 0.05f), Color.White.copy(alpha = 0.05f)))
        Ghost -> Brush.linearGradient(listOf(Color.Transparent, Color.Transparent))
        Destructive -> Brush.linearGradient(listOf(RuvoColors.error, RuvoColors.error))
    }

    @Composable
    fun contentColor() = when (this) {
        Primary -> Color.Black
        Secondary -> Color.White
        Ghost -> RuvoColors.lime
        Destructive -> Color.White
    }
}

@Composable
fun RuvoIconButton(
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    tint: Color = RuvoColors.textPrimary,
) {
    IconButton(
        onClick = onClick,
        modifier = modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(RuvoColors.surface)
    ) {
        Icon(imageVector = icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
    }
}
