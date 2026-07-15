package com.ruvo.app.features.healthintegrations

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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*

@Composable
fun HealthIntegrationsScreen(viewModel: HealthIntegrationsViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.refresh() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Health", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)

        // Today's snapshot
        TodayHealthCard(uiState = uiState)

        // Connected services
        ConnectedServicesSection(
            uiState = uiState,
            onConnectHealthConnect = { viewModel.requestHealthConnectPermissions() },
            onConnectOura = { viewModel.connectOura() },
            onConnectWhoop = { viewModel.connectWhoop() },
        )

        // HealthKit / Health Connect metrics
        if (uiState.isHealthConnectAvailable) {
            HealthMetricsSection(uiState = uiState)
        }

        // Oura metrics
        if (uiState.isOuraConnected) {
            OuraSection(uiState = uiState)
        }

        // WHOOP metrics
        if (uiState.isWhoopConnected) {
            WhoopSection(uiState = uiState)
        }

        Spacer(modifier = Modifier.height(80.dp))
    }
}

@Composable
private fun TodayHealthCard(uiState: HealthIntegrationsUiState) {
    RuvoCard(isHighlighted = true) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Today's Overview", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                HealthMetric(label = "Steps", value = "${uiState.todaySteps}", unit = "steps", color = RuvoColors.lime, icon = "👟")
                HealthMetric(label = "Heart Rate", value = "${uiState.currentHeartRate}", unit = "bpm", color = Color(0xFFEF4444), icon = "❤️")
                HealthMetric(label = "Calories", value = "${uiState.todayCalories}", unit = "kcal", color = Color(0xFFF97316), icon = "🔥")
            }
            Divider(color = RuvoColors.border)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                HealthMetric(label = "Sleep", value = uiState.lastNightSleepHours.let { if (it > 0) String.format("%.1f", it) else "--" }, unit = "hrs", color = RuvoColors.purple, icon = "😴")
                HealthMetric(label = "Resting HR", value = "${uiState.restingHeartRate}", unit = "bpm", color = RuvoColors.teal, icon = "💙")
                HealthMetric(label = "VO2 Max", value = if (uiState.vo2max > 0) String.format("%.1f", uiState.vo2max) else "--", unit = "ml/kg", color = Color(0xFFEAB308), icon = "⚡")
            }
        }
    }
}

@Composable
private fun HealthMetric(label: String, value: String, unit: String, color: Color, icon: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(icon, style = MaterialTheme.typography.titleLarge)
        Text(value, style = MaterialTheme.typography.titleLarge, color = color)
        Text(unit, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
        Text(label, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textSecondary)
    }
}

@Composable
private fun ConnectedServicesSection(
    uiState: HealthIntegrationsUiState,
    onConnectHealthConnect: () -> Unit,
    onConnectOura: () -> Unit,
    onConnectWhoop: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Connected Services", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
        ServiceCard(
            name = "Health Connect",
            description = "Steps, heart rate, sleep, workouts",
            icon = "🏥",
            isConnected = uiState.isHealthConnectAvailable,
            onConnect = onConnectHealthConnect,
        )
        ServiceCard(
            name = "Oura Ring",
            description = "Sleep score, readiness, HRV",
            icon = "💍",
            isConnected = uiState.isOuraConnected,
            onConnect = onConnectOura,
        )
        ServiceCard(
            name = "WHOOP",
            description = "Recovery score, strain, sleep stages",
            icon = "⌚",
            isConnected = uiState.isWhoopConnected,
            onConnect = onConnectWhoop,
        )
    }
}

@Composable
private fun ServiceCard(name: String, description: String, icon: String, isConnected: Boolean, onConnect: () -> Unit) {
    RuvoCard(isHighlighted = isConnected) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).background(if (isConnected) RuvoColors.limeDim else RuvoColors.surfaceElev),
                contentAlignment = Alignment.Center
            ) {
                Text(icon, style = MaterialTheme.typography.headlineMedium)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(name, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary)
                Text(description, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            }
            if (isConnected) {
                RuvoChip(label = "Connected", isActive = true)
            } else {
                Surface(
                    onClick = onConnect,
                    shape = RoundedCornerShape(20.dp),
                    color = Color.White.copy(alpha = 0.05f),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.2f)),
                ) {
                    Text(
                        "Connect",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun HealthMetricsSection(uiState: HealthIntegrationsUiState) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Health Connect", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MetricCard("Step Count", "${uiState.weeklySteps}", "this week", RuvoColors.lime, modifier = Modifier.weight(1f))
            MetricCard("Active Days", "${uiState.weeklyActiveDays}/7", "this week", RuvoColors.teal, modifier = Modifier.weight(1f))
        }
        HeartRateCard(uiState = uiState)
    }
}

@Composable
private fun MetricCard(label: String, value: String, sub: String, color: Color, modifier: Modifier = Modifier) {
    RuvoCard(modifier = modifier) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
            Text(value, style = MaterialTheme.typography.headlineSmall, color = color)
            Text(sub, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
        }
    }
}

@Composable
private fun HeartRateCard(uiState: HealthIntegrationsUiState) {
    RuvoCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Heart Rate", style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary)
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Column {
                    Text("Current", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                    Text("${uiState.currentHeartRate} bpm", style = MaterialTheme.typography.titleMedium, color = Color(0xFFEF4444))
                }
                Column {
                    Text("Resting", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                    Text("${uiState.restingHeartRate} bpm", style = MaterialTheme.typography.titleMedium, color = RuvoColors.teal)
                }
                Column {
                    Text("Max (run)", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                    Text("${uiState.maxHeartRate} bpm", style = MaterialTheme.typography.titleMedium, color = Color(0xFFF97316))
                }
            }
        }
    }
}

@Composable
private fun OuraSection(uiState: HealthIntegrationsUiState) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Oura Ring", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
            Text("💍 Synced", style = MaterialTheme.typography.labelSmall, color = RuvoColors.lime)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ScoreCard("Readiness", uiState.ouraReadiness, Color(0xFF4ADE80), modifier = Modifier.weight(1f))
            ScoreCard("Sleep", uiState.ouraSleepScore, RuvoColors.purple, modifier = Modifier.weight(1f))
            ScoreCard("Activity", uiState.ouraActivity, RuvoColors.lime, modifier = Modifier.weight(1f))
        }
        if (uiState.ouraHrv > 0) {
            RuvoCard {
                Row(modifier = Modifier.padding(16.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text("HRV", style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary)
                        Text("Heart Rate Variability", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                    }
                    Text("${uiState.ouraHrv} ms", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.teal)
                }
            }
        }
    }
}

@Composable
private fun ScoreCard(label: String, score: Int, color: Color, modifier: Modifier = Modifier) {
    var animTarget by remember { mutableFloatStateOf(0f) }
    val progress by animateFloatAsState(targetValue = animTarget, animationSpec = tween(1000), label = "score")
    LaunchedEffect(score) { animTarget = score / 100f }

    RuvoCard(modifier = modifier, isHighlighted = score >= 85) {
        Column(modifier = Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(modifier = Modifier.size(60.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxSize(), color = color, strokeWidth = 6.dp, trackColor = RuvoColors.border)
                Text("$score", style = MaterialTheme.typography.titleMedium, color = color)
            }
            Text(label, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textSecondary)
        }
    }
}

@Composable
private fun WhoopSection(uiState: HealthIntegrationsUiState) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("WHOOP", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
            Text("⌚ Synced", style = MaterialTheme.typography.labelSmall, color = RuvoColors.lime)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ScoreCard("Recovery", uiState.whoopRecovery, Color(0xFF4ADE80), modifier = Modifier.weight(1f))
            ScoreCard("Strain", (uiState.whoopStrain * 100 / 21).toInt().coerceIn(0, 100), Color(0xFF3B82F6), modifier = Modifier.weight(1f))
            ScoreCard("Sleep", uiState.whoopSleepScore, RuvoColors.purple, modifier = Modifier.weight(1f))
        }
    }
}
