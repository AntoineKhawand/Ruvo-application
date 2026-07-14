package com.ruvo.app.features.gamification

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*

@Composable
fun GamificationScreen(viewModel: GamificationViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showRewardsShop by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Rewards", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)

        // Level card
        LevelCard(
            xp = uiState.xp,
            level = uiState.level,
            levelProgress = uiState.levelProgress,
            xpToNext = uiState.xpToNextLevel
        )

        // Streak + coins row
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StreakCard(streakDays = uiState.streakDays, modifier = Modifier.weight(1f))
            CoinCard(coins = uiState.coins, onRedeem = { showRewardsShop = true }, modifier = Modifier.weight(1f))
        }

        // This week goals
        WeeklyGoalsCard(uiState = uiState)

        // Achievements grid
        if (uiState.achievements.isNotEmpty()) {
            AchievementsGrid(achievements = uiState.achievements)
        }

        Spacer(modifier = Modifier.height(80.dp))
    }

    if (showRewardsShop) {
        RewardsShopBottomSheet(onDismiss = { showRewardsShop = false })
    }
}

@Composable
fun LevelCard(xp: Long, level: Int, levelProgress: Float, xpToNext: Int) {
    var animatedProgress by remember { mutableFloatStateOf(0f) }
    val progress by animateFloatAsState(
        targetValue = animatedProgress,
        animationSpec = tween(durationMillis = 1200, easing = FastOutSlowInEasing),
        label = "xp_progress"
    )
    LaunchedEffect(levelProgress) { animatedProgress = levelProgress }

    RuvoCard(isHighlighted = true) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Level $level", style = MaterialTheme.typography.displayMedium, color = RuvoColors.lime)
                    Text("Runner Class", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                }
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .background(RuvoColors.limeDim),
                    contentAlignment = Alignment.Center
                ) {
                    Text(levelEmoji(level), style = MaterialTheme.typography.displayMedium)
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("$xp XP", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textPrimary)
                    Text("$xpToNext XP to Level ${level + 1}", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                }
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                    color = RuvoColors.lime,
                    trackColor = RuvoColors.border,
                )
            }
        }
    }
}

private fun levelEmoji(level: Int) = when {
    level <= 5  -> "🏃"
    level <= 10 -> "⚡"
    level <= 20 -> "🔥"
    level <= 30 -> "💎"
    else        -> "🏆"
}

@Composable
fun StreakCard(streakDays: Int, modifier: Modifier = Modifier) {
    RuvoCard(modifier = modifier, glowColor = Color(0xFFF97316), isHighlighted = streakDays >= 7) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text("🔥", style = MaterialTheme.typography.displayMedium)
            Text("$streakDays Days", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
            Text("Streak", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
        }
    }
}

@Composable
fun CoinCard(coins: Long, onRedeem: () -> Unit, modifier: Modifier = Modifier) {
    RuvoCard(modifier = modifier) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text("🪙", style = MaterialTheme.typography.displayMedium)
            Text("$coins", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
            Text("Coins", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            RuvoButton(text = "Redeem", onClick = onRedeem, style = RuvoButtonVariant.Primary)
        }
    }
}

@Composable
fun WeeklyGoalsCard(uiState: GamificationUiState) {
    RuvoCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("This Week", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
            GoalRow("Distance Goal", uiState.weeklyDistanceKm, uiState.weeklyDistanceTarget, "km", RuvoColors.lime)
            GoalRow("Runs Logged", uiState.weeklyRuns.toDouble(), uiState.weeklyRunTarget.toDouble(), "runs", RuvoColors.teal)
            GoalRow("Active Days", uiState.weeklyActiveDays.toDouble(), 5.0, "days", RuvoColors.purple)
        }
    }
}

@Composable
fun GoalRow(label: String, current: Double, target: Double, unit: String, color: Color) {
    val progress = (current / target).coerceIn(0.0, 1.0).toFloat()
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            Text("${current.toInt()}/${target.toInt()} $unit", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textPrimary)
        }
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
            color = color,
            trackColor = RuvoColors.border,
        )
    }
}

data class AchievementItem(val id: String, val title: String, val emoji: String, val isNew: Boolean = false)

@Composable
fun AchievementsGrid(achievements: List<AchievementItem>) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Achievements", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.height(((achievements.size / 3 + 1) * 120).dp),
        ) {
            items(achievements, key = { it.id }) { ach ->
                RuvoCard(isHighlighted = ach.isNew) {
                    Column(
                        modifier = Modifier.padding(12.dp).fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(ach.emoji, style = MaterialTheme.typography.headlineLarge)
                        Text(ach.title, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textPrimary)
                        if (ach.isNew) RuvoChip(label = "NEW", isActive = true)
                    }
                }
            }
        }
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun RewardsShopBottomSheet(onDismiss: () -> Unit) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = RuvoColors.surface,
    ) {
        Column(modifier = Modifier.padding(16.dp).navigationBarsPadding()) {
            Text("Rewards Shop", style = MaterialTheme.typography.headlineLarge, color = RuvoColors.textPrimary)
            Spacer(modifier = Modifier.height(8.dp))
            Text("Coming soon — redeem coins for discounts at local Lebanese health brands.",
                style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}
