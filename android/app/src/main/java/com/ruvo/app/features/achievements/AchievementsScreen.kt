package com.ruvo.app.features.achievements

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*

@Composable
fun AchievementsScreen(
    onBack: () -> Unit = {},
    viewModel: AchievementsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var selectedBadge by remember { mutableStateOf<Badge?>(null) }

    val fadeIn by animateFloatAsState(
        targetValue = if (uiState.badges.isNotEmpty()) 1f else 0f,
        animationSpec = tween(600),
        label = "fade"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary)
            }
            Text("Trophy Room", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.width(40.dp))
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
        ) {
            // Progress header card
            RuvoCard(isHighlighted = true) {
                Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column {
                            Text("COMPLETION", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, letterSpacing = 1.5.sp)
                            Text(
                                "${uiState.progressPercent.toInt()}%",
                                style = MaterialTheme.typography.displayLarge,
                                color = RuvoColors.textPrimary,
                                fontWeight = FontWeight.ExtraBold,
                            )
                        }
                        Column(
                            modifier = Modifier
                                .clip(RoundedCornerShape(16.dp))
                                .background(RuvoColors.lime.copy(alpha = 0.1f))
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(32.dp))
                            Text(
                                "${uiState.unlockedCount} / ${uiState.totalCount}",
                                style = MaterialTheme.typography.labelLarge,
                                color = RuvoColors.lime,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                    LinearProgressIndicator(
                        progress = { uiState.progressPercent / 100f },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp)
                            .clip(RoundedCornerShape(4.dp)),
                        color = RuvoColors.lime,
                        trackColor = RuvoColors.border,
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Badge categories
            uiState.categories.forEach { category ->
                BadgeCategorySection(
                    category = category,
                    onBadgeTap = { selectedBadge = it }
                )
                Spacer(modifier = Modifier.height(28.dp))
            }

            Spacer(modifier = Modifier.height(80.dp))
        }
    }

    // Badge detail dialog
    selectedBadge?.let { badge ->
        BadgeDetailDialog(
            badge = badge,
            onDismiss = { selectedBadge = null }
        )
    }
}

@Composable
private fun BadgeCategorySection(
    category: BadgeCategory,
    onBadgeTap: (Badge) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .border(BorderStroke(0.dp, Color.Transparent))
                .padding(bottom = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom,
        ) {
            Text(
                category.name.uppercase(),
                style = MaterialTheme.typography.titleSmall,
                color = RuvoColors.textPrimary,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
            )
            Text(
                "${category.unlockedCount}/${category.badges.size}",
                style = MaterialTheme.typography.bodySmall,
                color = RuvoColors.textTertiary,
            )
        }
        HorizontalDivider(color = RuvoColors.border)
        Spacer(modifier = Modifier.height(4.dp))

        // 3-column grid
        val rows = category.badges.chunked(3)
        rows.forEach { rowBadges ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                rowBadges.forEach { badge ->
                    BadgeCell(badge = badge, onClick = { onBadgeTap(badge) }, modifier = Modifier.weight(1f))
                }
                // Fill empty cells
                repeat(3 - rowBadges.size) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun BadgeCell(badge: Badge, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val accentColor = Color(android.graphics.Color.parseColor(badge.colorHex))

    Column(
        modifier = modifier
            .clickable(onClick = onClick)
            .padding(4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(modifier = Modifier.size(70.dp)) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(CircleShape)
                    .background(if (badge.unlocked) accentColor.copy(alpha = 0.1f) else RuvoColors.surfaceElev)
                    .border(
                        2.dp,
                        if (badge.unlocked) accentColor else RuvoColors.border,
                        CircleShape,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    badge.emoji,
                    fontSize = 30.sp,
                    color = if (badge.unlocked) Color.Unspecified else Color.Gray,
                )
            }
            if (badge.unlocked) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .size(18.dp)
                        .clip(CircleShape)
                        .background(RuvoColors.background)
                        .border(1.dp, accentColor, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Default.Check,
                        contentDescription = null,
                        tint = accentColor,
                        modifier = Modifier.size(10.dp),
                    )
                }
            }
        }
        Text(
            badge.name,
            style = MaterialTheme.typography.bodySmall,
            color = if (badge.unlocked) RuvoColors.textPrimary else RuvoColors.textTertiary,
            fontWeight = if (badge.unlocked) FontWeight.SemiBold else FontWeight.Normal,
            maxLines = 1,
            fontSize = 11.sp,
        )
    }
}

@Composable
private fun BadgeDetailDialog(badge: Badge, onDismiss: () -> Unit) {
    val accentColor = Color(android.graphics.Color.parseColor(badge.colorHex))

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = RuvoColors.surface,
            border = BorderStroke(1.dp, RuvoColors.border),
        ) {
            Column(
                modifier = Modifier.padding(30.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                // Close
                Box(modifier = Modifier.fillMaxWidth()) {
                    IconButton(onClick = onDismiss, modifier = Modifier.align(Alignment.TopEnd)) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = RuvoColors.textTertiary, modifier = Modifier.size(20.dp))
                    }
                }

                // Badge icon
                Box(
                    modifier = Modifier
                        .size(100.dp)
                        .clip(CircleShape)
                        .background(if (badge.unlocked) accentColor.copy(alpha = 0.1f) else RuvoColors.surfaceElev)
                        .border(3.dp, if (badge.unlocked) accentColor else RuvoColors.border, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(badge.emoji, fontSize = 48.sp)
                }

                Text(badge.name, style = MaterialTheme.typography.headlineMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.ExtraBold)

                // Status chip
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = if (badge.unlocked) RuvoColors.lime.copy(alpha = 0.15f) else RuvoColors.surfaceElev,
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            if (badge.unlocked) Icons.Default.CheckCircle else Icons.Default.Lock,
                            contentDescription = null,
                            tint = if (badge.unlocked) RuvoColors.lime else RuvoColors.textTertiary,
                            modifier = Modifier.size(16.dp),
                        )
                        Text(
                            if (badge.unlocked) "UNLOCKED" else "LOCKED",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (badge.unlocked) RuvoColors.lime else RuvoColors.textTertiary,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                        )
                    }
                }

                Text(
                    badge.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = RuvoColors.textSecondary,
                )

                if (!badge.unlocked) {
                    Text(
                        "Keep running to unlock this achievement!",
                        style = MaterialTheme.typography.bodySmall,
                        color = RuvoColors.textTertiary,
                    )
                }
            }
        }
    }
}
