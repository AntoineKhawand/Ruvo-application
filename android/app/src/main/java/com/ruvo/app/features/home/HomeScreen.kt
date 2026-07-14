package com.ruvo.app.features.home

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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*
import com.ruvo.app.features.weather.WeatherWidget
import java.util.*

@Composable
fun HomeScreen(
    navController: NavController,
    onStartRun: () -> Unit = {},
    viewModel: HomeViewModel = hiltViewModel(),
    notificationViewModel: com.ruvo.app.designsystem.components.NotificationViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val unreadCount by notificationViewModel.unreadCount.collectAsStateWithLifecycle()
    var showNotifications by remember { mutableStateOf(false) }

    if (showNotifications) {
        com.ruvo.app.designsystem.components.NotificationSheet(viewModel = notificationViewModel, onDismiss = { showNotifications = false })
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Greeting
        GreetingHeader(userName = uiState.displayName, avatarUrl = uiState.avatarUrl, unreadNotifications = unreadCount, onNotificationsClick = { showNotifications = true })

        // Daily activity rings
        DailyActivityCard(uiState = uiState)

        // Quick start
        QuickStartCard(
            onStart = onStartRun,
            onWorkoutSetup = { navController.navigate("workout_detail") },
        )

        // Mini stats row
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MiniStatCard("🔥", "Streak", "${uiState.streakDays}d", Color(0xFFF97316), modifier = Modifier.weight(1f))
            MiniStatCard("⚡", "Today XP", "+${uiState.todayXP}", RuvoColors.lime, modifier = Modifier.weight(1f))
            MiniStatCard("🪙", "Coins", "${uiState.coins}", Color(0xFFEAB308), modifier = Modifier.weight(1f))
        }

        // Weather-aware run advice
        WeatherWidget()

        // Today's training
        TodaysTrainingCard()

        // Recent activity
        RecentActivitySection(runs = uiState.recentRuns, onSeeAll = { navController.navigate("analytics") })

        Spacer(modifier = Modifier.height(80.dp))
    }
}

@Composable
fun GreetingHeader(
    userName: String,
    avatarUrl: String?,
    unreadNotifications: Int = 0,
    onNotificationsClick: () -> Unit = {},
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column {
            Text(greeting(), style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary)
            Text(
                userName.split(" ").firstOrNull() ?: "Runner",
                style = MaterialTheme.typography.displayMedium,
                color = RuvoColors.textPrimary
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            // Notification bell
            Box {
                IconButton(onClick = onNotificationsClick) {
                    Icon(Icons.Default.Notifications, contentDescription = "Notifications", tint = RuvoColors.textSecondary, modifier = Modifier.size(26.dp))
                }
                if (unreadNotifications > 0) {
                    androidx.compose.foundation.layout.Box(
                        modifier = Modifier
                            .size(16.dp)
                            .clip(CircleShape)
                            .background(RuvoColors.lime)
                            .align(Alignment.TopEnd),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(if (unreadNotifications > 9) "9+" else "$unreadNotifications", style = MaterialTheme.typography.labelSmall, color = Color.Black, fontSize = 8.sp)
                    }
                }
            }
            // Avatar placeholder
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(CircleShape)
                    .background(RuvoColors.surfaceElev)
                    .border(2.dp, RuvoColors.lime, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(28.dp))
            }
        }
    }
}

@Composable
fun DailyActivityCard(uiState: HomeUiState) {
    RuvoCard {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                ActivityRings(
                    rings = listOf(
                        ActivityRing(progress = uiState.distanceRingProgress, color = RuvoColors.lime, strokeWidthDp = 10f),
                        ActivityRing(progress = uiState.caloriesRingProgress, color = Color(0xFFF97316), strokeWidthDp = 10f),
                        ActivityRing(progress = uiState.activeMinutesRingProgress, color = Color(0xFF06B6D4), strokeWidthDp = 10f),
                    ),
                    modifier = Modifier.size(90.dp),
                    gapDp = 6f,
                )
            }

            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Today's Activity", style = MaterialTheme.typography.labelMedium, color = RuvoColors.textTertiary, letterSpacing = 0.5.sp)
                RingStatRow(color = RuvoColors.lime, label = "Distance", value = String.format("%.1f / %.0f km", uiState.todayDistanceKm, uiState.dailyDistanceGoalKm))
                RingStatRow(color = Color(0xFFF97316), label = "Calories", value = "${uiState.todayCalories} / ${uiState.dailyCaloriesGoal} kcal")
                RingStatRow(color = Color(0xFF06B6D4), label = "Active", value = "${uiState.todayActiveMinutes} / ${uiState.dailyActiveMinutesGoal} min")
            }
        }
    }
}

@Composable
private fun RingStatRow(color: Color, label: String, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(modifier = Modifier.size(8.dp).clip(androidx.compose.foundation.shape.CircleShape).background(color))
        Text("$label  ", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
        Text(value, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun QuickStartCard(onStart: () -> Unit, onWorkoutSetup: () -> Unit = {}) {
    RuvoCard(isHighlighted = true) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onStart() }
                    .padding(20.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Start a Run", style = MaterialTheme.typography.headlineLarge, color = RuvoColors.textPrimary)
                    Text("Tap to begin GPS tracking", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                }
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .clip(CircleShape)
                        .background(Brush.linearGradient(listOf(RuvoColors.lime, Color(0xFFA8CC00)))),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.DirectionsRun, contentDescription = null, tint = Color.Black, modifier = Modifier.size(28.dp))
                }
            }
            HorizontalDivider(color = RuvoColors.border)
            TextButton(
                onClick = onWorkoutSetup,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
            ) {
                Icon(Icons.Default.Tune, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Workout Setup", style = MaterialTheme.typography.labelMedium, color = RuvoColors.textTertiary)
            }
        }
    }
}

@Composable
fun MiniStatCard(emoji: String, label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    RuvoCard(modifier = modifier) {
        Column(
            modifier = Modifier.padding(12.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(emoji, style = MaterialTheme.typography.headlineMedium)
            Text(value, style = MaterialTheme.typography.titleLarge, color = color)
            Text(label, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
        }
    }
}

@Composable
fun TodaysTrainingCard() {
    RuvoCard {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(RuvoColors.limeDim),
                contentAlignment = Alignment.Center
            ) {
                Text("5K", style = MaterialTheme.typography.titleLarge, color = RuvoColors.lime)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text("Today's Training", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                Text("Easy 5K Run", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
                Text("Target: 5:30-6:00/km · ~30 min", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            }
            RuvoChip(label = "Active", isActive = true)
        }
    }
}

@Composable
fun RecentActivitySection(runs: List<com.ruvo.app.core.model.RunRecord>, onSeeAll: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Recent Activity", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
            TextButton(onClick = onSeeAll) { Text("See All", color = RuvoColors.lime) }
        }
        if (runs.isEmpty()) {
            RuvoCard {
                Column(
                    modifier = Modifier.padding(32.dp).fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.DirectionsRun, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(40.dp))
                    Text("No runs yet — start your first run!", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
                }
            }
        } else {
            runs.take(3).forEach { run ->
                RunRow(run = run)
            }
        }
    }
}

@Composable
fun RunRow(run: com.ruvo.app.core.model.RunRecord) {
    RuvoCard {
        Row(modifier = Modifier.padding(14.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text(String.format("%.2f km", run.distanceKm), style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
                Text(String.format("%d cal · %s/km", run.calories, run.averagePaceMinPerKm.toFormattedPace()), style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            }
            Text("+${run.xpEarned} XP", style = MaterialTheme.typography.labelLarge, color = RuvoColors.lime)
        }
    }
}

private fun greeting(): String {
    return when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
        in 5..11  -> "Good Morning,"
        in 12..16 -> "Good Afternoon,"
        else      -> "Good Evening,"
    }
}

private fun Double.toFormattedPace(): String {
    if (this <= 0 || this > 30) return "--:--"
    val min = this.toInt(); val sec = ((this - min) * 60).toInt()
    return String.format("%d:%02d", min, sec)
}
