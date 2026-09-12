package com.ruvo.app.designsystem.components

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.ruvo.app.designsystem.theme.RuvoColors
import kotlinx.coroutines.delay

data class AchievementData(
    val emoji: String,
    val title: String,
    val description: String,
    val coinsAwarded: Int = 0,
)

@Composable
fun AchievementOverlay(
    achievement: AchievementData?,
    onDismiss: () -> Unit,
) {
    AnimatedVisibility(
        visible = achievement != null,
        enter = fadeIn() + scaleIn(initialScale = 0.8f),
        exit = fadeOut() + scaleOut(targetScale = 0.8f),
    ) {
        if (achievement != null) {
            LaunchedEffect(achievement) {
                delay(4000)
                onDismiss()
            }

            Dialog(
                onDismissRequest = onDismiss,
                properties = DialogProperties(dismissOnClickOutside = true),
            ) {
                AchievementCard(achievement = achievement, onDismiss = onDismiss)
            }
        }
    }
}

@Composable
fun AchievementCard(achievement: AchievementData, onDismiss: () -> Unit = {}) {
    val infiniteTransition = rememberInfiniteTransition(label = "glow")
    val glow by infiniteTransition.animateFloat(
        initialValue = 0.6f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "glow",
    )

    val bounceScale by animateFloatAsState(
        targetValue = 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium),
        label = "bounce",
    )

    Surface(
        shape = RoundedCornerShape(24.dp),
        color = RuvoColors.glassSurface,
        modifier = Modifier.fillMaxWidth().scale(bounceScale),
        shadowElevation = 24.dp,
    ) {
        Box {
            // Background gradient
            Box(
                modifier = Modifier.fillMaxWidth().height(120.dp).background(
                    Brush.verticalGradient(listOf(RuvoColors.lime.copy(alpha = 0.2f * glow), Color.Transparent))
                )
            )

            Column(
                modifier = Modifier.fillMaxWidth().padding(28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                // Earned badge
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = RuvoColors.lime.copy(alpha = 0.15f),
                ) {
                    Text(
                        "🏆 Achievement Unlocked!",
                        style = MaterialTheme.typography.labelMedium,
                        color = RuvoColors.lime,
                        fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                    )
                }

                // Emoji
                Box(
                    modifier = Modifier.size(80.dp).background(
                        Brush.radialGradient(listOf(RuvoColors.lime.copy(alpha = 0.3f * glow), Color.Transparent)),
                        CircleShape,
                    ),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(achievement.emoji, fontSize = 44.sp)
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        achievement.title,
                        style = MaterialTheme.typography.headlineSmall,
                        color = RuvoColors.textPrimary,
                        fontWeight = FontWeight.ExtraBold,
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        achievement.description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = RuvoColors.textSecondary,
                        textAlign = TextAlign.Center,
                    )
                }

                if (achievement.coinsAwarded > 0) {
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = Color(0xFFFFD700).copy(alpha = 0.15f),
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("🪙", fontSize = 20.sp)
                            Text("+${achievement.coinsAwarded} coins", style = MaterialTheme.typography.titleSmall, color = Color(0xFFFFD700), fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Button(
                    onClick = onDismiss,
                    shape = RoundedCornerShape(20.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Awesome!", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}
