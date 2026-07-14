package com.ruvo.app.features.leaderboard

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*

@Composable
fun LeaderboardScreen(onBack: () -> Unit = {}, viewModel: LeaderboardViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
    ) {
        // Header
        Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary)
                }
                Text("Leaderboard", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)
            }

            // Scope filters: Friends / Country / Global
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LeaderboardScopeTab.values().forEach { scope ->
                    val isActive = uiState.scope == scope
                    Surface(
                        onClick = { viewModel.setScope(scope) },
                        shape = RoundedCornerShape(20.dp),
                        color = if (isActive) RuvoColors.lime else RuvoColors.surface,
                        border = if (!isActive) BorderStroke(1.dp, RuvoColors.border) else null,
                    ) {
                        Text(
                            scope.label,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                            style = MaterialTheme.typography.labelMedium,
                            color = if (isActive) Color.Black else RuvoColors.textSecondary,
                            fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
                        )
                    }
                }
            }

            // Time filters: Weekly / All-Time
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LeaderboardTimePeriod.values().forEach { period ->
                        val isActive = uiState.period == period
                        Surface(
                            onClick = { viewModel.setPeriod(period) },
                            shape = RoundedCornerShape(20.dp),
                            color = if (isActive) RuvoColors.surfaceElev else Color.Transparent,
                            border = BorderStroke(1.dp, if (isActive) RuvoColors.lime else RuvoColors.border),
                        ) {
                            Text(
                                period.label,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = if (isActive) RuvoColors.lime else RuvoColors.textTertiary,
                            )
                        }
                    }
                }
                Text(
                    uiState.dateRangeLabel,
                    style = MaterialTheme.typography.bodySmall,
                    color = RuvoColors.textTertiary,
                    fontSize = 10.sp,
                )
            }
        }

        if (uiState.isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = RuvoColors.lime)
            }
        } else if (uiState.entries.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Default.Group, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(48.dp))
                    Text(
                        if (uiState.scope == LeaderboardScopeTab.Friends) "No friends yet — follow runners in Global!"
                        else "No runners found.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = RuvoColors.textTertiary,
                    )
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(uiState.entries, key = { it.uid }) { entry ->
                    LeaderboardRow(entry = entry)
                }
                item { Spacer(modifier = Modifier.height(80.dp)) }
            }
        }
    }
}

@Composable
private fun LeaderboardRow(entry: LeaderboardEntry) {
    val isCurrentUser = entry.isCurrentUser
    val (bgColor, borderColor) = if (isCurrentUser)
        Pair(RuvoColors.lime.copy(alpha = 0.08f), RuvoColors.lime.copy(alpha = 0.4f))
    else
        Pair(RuvoColors.surface, RuvoColors.border)

    val rankBg = when (entry.rank) {
        1 -> Color(0xFFFFD700)
        2 -> Color(0xFFC0C0C0)
        3 -> Color(0xFFCD7F32)
        else -> if (isCurrentUser) RuvoColors.lime else RuvoColors.surfaceElev
    }
    val rankTextColor = if (entry.rank <= 3 || isCurrentUser) Color.Black else RuvoColors.textSecondary

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = bgColor,
        border = BorderStroke(1.dp, borderColor),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Rank circle
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(rankBg),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "${entry.rank}",
                    style = MaterialTheme.typography.labelLarge,
                    color = rankTextColor,
                    fontWeight = FontWeight.Bold,
                )
            }

            // Avatar
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(CircleShape)
                    .background(RuvoColors.surfaceElev)
                    .border(2.dp, if (isCurrentUser) RuvoColors.lime else RuvoColors.border, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(20.dp))
            }

            // Name + flag
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        entry.displayName,
                        style = MaterialTheme.typography.titleSmall,
                        color = if (isCurrentUser) RuvoColors.lime else RuvoColors.textPrimary,
                        fontWeight = FontWeight.SemiBold,
                    )
                    if (entry.countryFlag.isNotEmpty()) {
                        Text(entry.countryFlag, fontSize = 14.sp)
                    }
                }
                Text(
                    String.format("%.1f km", entry.distanceKm),
                    style = MaterialTheme.typography.bodySmall,
                    color = RuvoColors.textSecondary,
                )
            }

            // Trophy icon for top 3
            when (entry.rank) {
                1 -> Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = Color(0xFFFFD700), modifier = Modifier.size(22.dp))
                2 -> Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = Color(0xFFC0C0C0), modifier = Modifier.size(22.dp))
                3 -> Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = Color(0xFFCD7F32), modifier = Modifier.size(22.dp))
                else -> Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(20.dp))
            }
        }
    }
}
