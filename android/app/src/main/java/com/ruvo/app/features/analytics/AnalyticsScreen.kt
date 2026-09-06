package com.ruvo.app.features.analytics

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.patrykandpatrick.vico.compose.axis.horizontal.rememberBottomAxis
import com.patrykandpatrick.vico.compose.axis.vertical.rememberStartAxis
import com.patrykandpatrick.vico.compose.chart.Chart
import com.patrykandpatrick.vico.compose.chart.column.columnChart
import com.patrykandpatrick.vico.compose.chart.line.lineChart
import com.patrykandpatrick.vico.compose.component.shape.shader.verticalGradient
import com.patrykandpatrick.vico.core.chart.line.LineChart
import com.patrykandpatrick.vico.core.component.shape.LineComponent
import com.patrykandpatrick.vico.core.component.shape.ShapeComponent
import com.patrykandpatrick.vico.core.component.shape.Shapes
import com.patrykandpatrick.vico.core.component.text.textComponent
import com.patrykandpatrick.vico.core.entry.entryModelOf
import com.patrykandpatrick.vico.core.entry.FloatEntry
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*

private val periods = listOf("1W", "1M", "3M", "1Y", "All")

@Composable
fun AnalyticsDashboardScreen(
    onRunDetail: (String) -> Unit = {},
    onUpgrade: () -> Unit = {},
    viewModel: AnalyticsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(uiState.selectedPeriod) { viewModel.loadData() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Analytics", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)

        // Period selector
        PeriodSelector(selected = uiState.selectedPeriod, onSelect = { viewModel.selectPeriod(it) })

        // Key stats 2x2
        KeyStatsGrid(uiState = uiState)

        // RN's AnalyticsScreen.js: 4 time-series charts, each bucketed per
        // calendar day over the selected period (see AnalyticsViewModel's
        // buildDayBuckets) — Distance bar, Avg Pace line, Elevation line,
        // Heart Rate line, in that order (RN_SOURCE_ARCHIVE.md §2).
        DistanceChart(data = uiState.distanceChart)
        PaceTrendChart(data = uiState.paceChart)
        ElevationChart(data = uiState.elevationChart)
        HeartRateChart(data = uiState.heartRateChart)

        // Heart rate zones
        HeartRateZonesCard(zones = uiState.heartRateZones)

        // Advanced Metrics — RN_SOURCE_ARCHIVE.md §2: "'Advanced Metrics'
        // section (PRO-gated): VO2 Max + Consistency twin boxes, Recovery
        // Score card, Race Predictor card... Personal Records card... →
        // upgrade banner if not Pro." Real, documented RN behavior — Android
        // just never connected Analytics to the existing Pro-entitlement
        // check (AnalyticsViewModel.checkProStatus, same RevenueCat pattern
        // already used by AICoachViewModel) until now.
        if (uiState.isPro) {
            // VO2 Max + Consistency ("twin boxes" per RN's Advanced Metrics section)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                VO2MaxCard(vo2max = uiState.vo2max, modifier = Modifier.weight(1f))
                ConsistencyCard(score = uiState.consistencyScore, modifier = Modifier.weight(1f))
            }

            // Recovery Score card
            uiState.recoveryStatus?.let { RecoveryScoreCard(it) }

            // Race Predictor card
            uiState.racePredictions?.let { RacePredictorCard(it) }

            // Personal Records card — RN_SOURCE_ARCHIVE.md §2: this is RN's real
            // "Personal Records" feature, an embedded card here, not a separate
            // screen (see PersonalRecordsScreen.kt's PersonalRecordsCard doc).
            PersonalRecordsCard()
        } else {
            AdvancedMetricsUpgradeBanner(onUpgrade = onUpgrade)
        }

        // Recent runs
        RecentRunsSection(runs = uiState.recentRuns, onRunDetail = onRunDetail)

        Spacer(modifier = Modifier.height(80.dp))
    }
}

@Composable
private fun PeriodSelector(selected: String, onSelect: (String) -> Unit) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.horizontalScroll(rememberScrollState())
    ) {
        periods.forEach { period ->
            val isSelected = period == selected
            Surface(
                onClick = { onSelect(period) },
                color = if (isSelected) RuvoColors.lime else RuvoColors.surface,
                shape = RoundedCornerShape(20.dp),
                border = if (!isSelected) BorderStroke(1.dp, RuvoColors.border) else null,
            ) {
                Text(
                    period,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    style = MaterialTheme.typography.labelLarge,
                    color = if (isSelected) Color.Black else RuvoColors.textSecondary
                )
            }
        }
    }
}

@Composable
private fun KeyStatsGrid(uiState: AnalyticsUiState) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatMiniCard("Total Distance", String.format("%.1f km", uiState.totalDistanceKm), RuvoColors.lime, modifier = Modifier.weight(1f))
            StatMiniCard("Total Runs", "${uiState.totalRuns}", RuvoColors.teal, modifier = Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatMiniCard("Avg Pace", uiState.avgPaceFormatted, RuvoColors.purple, modifier = Modifier.weight(1f))
            StatMiniCard("Total Time", String.format("%.1fh", uiState.totalDurationHours), Color(0xFFF97316), modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun StatMiniCard(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    RuvoCard(modifier = modifier) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
            Text(value, style = MaterialTheme.typography.headlineSmall, color = color)
        }
    }
}

@Composable
private fun DistanceChart(data: List<ChartPoint>) {
    DayBucketBarChart(title = "Distance", emptyText = "Run to see your chart", data = data)
}

@Composable
private fun PaceTrendChart(data: List<ChartPoint>) {
    DayBucketLineChart(title = "Pace Trend", emptyText = "No pace data yet", data = data, lineColor = RuvoColors.lime)
}

@Composable
private fun ElevationChart(data: List<ChartPoint>) {
    DayBucketLineChart(title = "Elevation", emptyText = "No elevation data yet", data = data, lineColor = RuvoColors.teal)
}

@Composable
private fun HeartRateChart(data: List<ChartPoint>) {
    DayBucketLineChart(title = "Heart Rate", emptyText = "No heart rate data yet", data = data, lineColor = Color(0xFFEF4444))
}

// Shared bar-chart shell for the day-bucketed Distance series. RN's own
// per-day bucketing (see AnalyticsViewModel.buildDayBuckets) can produce many
// more points than the old weekly view did — the bottomAxis valueFormatter
// already prints "" for downsampled-out labels, so this stays readable.
@Composable
private fun DayBucketBarChart(title: String, emptyText: String, data: List<ChartPoint>) {
    RuvoCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
            if (data.isEmpty() || data.all { it.value == 0.0 }) {
                Box(modifier = Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                    Text(emptyText, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textTertiary)
                }
            } else {
                val entries = data.mapIndexed { i, d -> FloatEntry(i.toFloat(), d.value.toFloat()) }
                val model = entryModelOf(entries)
                Chart(
                    chart = columnChart(
                        columns = listOf(
                            LineComponent(
                                color = android.graphics.Color.parseColor("#DFFF00"),
                                thicknessDp = 16f,
                                shape = Shapes.roundedCornerShape(topLeftPercent = 40, topRightPercent = 40),
                            )
                        )
                    ),
                    model = model,
                    startAxis = rememberStartAxis(),
                    bottomAxis = rememberBottomAxis(
                        valueFormatter = { value, _ -> data.getOrNull(value.toInt())?.label ?: "" }
                    ),
                    modifier = Modifier.fillMaxWidth().height(180.dp)
                )
            }
        }
    }
}

// Shared line-chart shell for the day-bucketed Pace/Elevation/Heart Rate
// series, all of which follow the exact same day-bucket + label-downsample
// shape as Distance above, just plotted as a line instead of columns.
@Composable
private fun DayBucketLineChart(title: String, emptyText: String, data: List<ChartPoint>, lineColor: Color) {
    RuvoCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
            if (data.isEmpty() || data.all { it.value == 0.0 }) {
                Box(modifier = Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                    Text(emptyText, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textTertiary)
                }
            } else {
                val entries = data.mapIndexed { i, p -> FloatEntry(i.toFloat(), p.value.toFloat()) }
                val model = entryModelOf(entries)
                Chart(
                    chart = lineChart(
                        lines = listOf(
                            LineChart.LineSpec(
                                lineColor = lineColor.hashCode(),
                                lineBackgroundShader = verticalGradient(
                                    arrayOf(lineColor.copy(alpha = 0.3f), Color.Transparent)
                                )
                            )
                        )
                    ),
                    model = model,
                    startAxis = rememberStartAxis(),
                    bottomAxis = rememberBottomAxis(
                        valueFormatter = { value, _ -> data.getOrNull(value.toInt())?.label ?: "" }
                    ),
                    modifier = Modifier.fillMaxWidth().height(180.dp)
                )
            }
        }
    }
}

@Composable
private fun HeartRateZonesCard(zones: List<HeartRateZone>) {
    if (zones.isEmpty()) return
    RuvoCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Heart Rate Zones", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
            zones.forEach { zone ->
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(zone.label, style = MaterialTheme.typography.labelSmall, color = zone.color, modifier = Modifier.width(36.dp))
                    LinearProgressIndicator(
                        progress = { zone.fraction },
                        modifier = Modifier.weight(1f).height(8.dp).clip(RoundedCornerShape(4.dp)),
                        color = zone.color,
                        trackColor = RuvoColors.border,
                    )
                    Text("${(zone.fraction * 100).toInt()}%", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, modifier = Modifier.width(36.dp))
                }
            }
        }
    }
}

// Same visual pattern as AICoachScreen's "Unlock Full Coaching" banner — kept
// consistent rather than inventing a second upgrade-prompt style.
@Composable
private fun AdvancedMetricsUpgradeBanner(onUpgrade: () -> Unit) {
    Surface(
        onClick = onUpgrade,
        shape = RoundedCornerShape(18.dp),
        color = Color(0xFF0D1A00),
        border = BorderStroke(1.dp, RuvoColors.lime.copy(alpha = 0.3f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(modifier = Modifier.size(40.dp).clip(CircleShape).background(RuvoColors.lime), contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.Bolt, contentDescription = null, tint = Color.Black, modifier = Modifier.size(18.dp))
                }
                Column {
                    Text("Unlock Advanced Metrics", style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary)
                    Text("VO2 Max, Race Predictor, Recovery Score & Personal Records", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                }
            }
            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = RuvoColors.lime)
        }
    }
}

@Composable
private fun VO2MaxCard(vo2max: Double, modifier: Modifier = Modifier) {
    if (vo2max <= 0) {
        // RN shows "N/A" here rather than hiding the box entirely when the
        // last 5 runs have no heart-rate data — matches that instead of a
        // silent gap in the twin-box row.
        RuvoCard(modifier = modifier) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("VO2 Max", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                Text("N/A", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textSecondary)
                Text("Needs HR data", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
            }
        }
        return
    }
    RuvoCard(modifier = modifier) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("VO2 Max", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
            Text(String.format("%.0f", vo2max), style = MaterialTheme.typography.headlineSmall, color = RuvoColors.lime)
            Text(vo2maxCategory(vo2max), style = MaterialTheme.typography.labelSmall, color = RuvoColors.lime)
        }
    }
}

@Composable
private fun ConsistencyCard(score: Double, modifier: Modifier = Modifier) {
    RuvoCard(modifier = modifier) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Consistency", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
            Text(String.format("%.1f", score), style = MaterialTheme.typography.headlineSmall, color = RuvoColors.lime)
            Text(consistencyLabel(score), style = MaterialTheme.typography.labelSmall, color = RuvoColors.lime)
        }
    }
}

// RN's useAnalytics.js "8. CONSISTENCY SCORE" doesn't itself label these
// thresholds — the archive's parsed §2 summary documents them separately
// (Elite ≥5 runs/week, Solid ≥3, Building ≥1, else Start).
private fun consistencyLabel(score: Double) = when {
    score >= 5 -> "Elite"
    score >= 3 -> "Solid"
    score >= 1 -> "Building"
    else -> "Start"
}

// RN_SOURCE_ARCHIVE.md §2: "VO2 Max descriptor thresholds: Superior ≥55,
// Good ≥45, Fair ≥35, else Basic" — the labels/cutoffs this replaced
// ("Below Average"/<30 etc.) didn't match RN's own descriptor at all.
private fun vo2maxCategory(v: Double) = when {
    v >= 55 -> "Superior"
    v >= 45 -> "Good"
    v >= 35 -> "Fair"
    else -> "Basic"
}

@Composable
private fun RecoveryScoreCard(status: RecoveryStatus) {
    RuvoCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Recovery Status", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
                if (status.source.isNotBlank()) {
                    Text(
                        "· ${status.source}",
                        style = MaterialTheme.typography.labelSmall,
                        color = RuvoColors.textTertiary,
                    )
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                LinearProgressIndicator(
                    progress = { status.percent / 100f },
                    modifier = Modifier.weight(1f).height(8.dp).clip(RoundedCornerShape(4.dp)),
                    color = status.color,
                    trackColor = RuvoColors.border,
                )
                Text("${status.percent}%", style = MaterialTheme.typography.labelMedium, color = status.color)
            }
            Text(status.text, style = MaterialTheme.typography.bodyMedium, color = status.color)
        }
    }
}

@Composable
private fun RacePredictorCard(predictions: RacePredictions) {
    RuvoCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Race Predictor", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                RacePredictionBox("5K", predictions.fiveK, Modifier.weight(1f))
                RacePredictionBox("10K", predictions.tenK, Modifier.weight(1f))
                RacePredictionBox("Half", predictions.half, Modifier.weight(1f))
                RacePredictionBox("Marathon", predictions.marathon, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun RacePredictionBox(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.clip(RoundedCornerShape(12.dp)).background(RuvoColors.surfaceElev).padding(vertical = 12.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
        Text(value, style = MaterialTheme.typography.labelLarge, color = RuvoColors.lime)
    }
}

@Composable
private fun RecentRunsSection(runs: List<RecentRunItem>, onRunDetail: (String) -> Unit = {}) {
    if (runs.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Recent Runs", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
        runs.forEach { run ->
            RuvoCard(modifier = Modifier.clickable { onRunDetail(run.id) }) {
                Row(
                    modifier = Modifier.padding(14.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(run.date, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                        Text(String.format("%.2f km", run.distanceKm), style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
                        Text("${run.paceFormatted}/km · ${run.durationFormatted}", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("+${run.xpEarned} XP", style = MaterialTheme.typography.labelLarge, color = RuvoColors.lime)
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }
    }
}
