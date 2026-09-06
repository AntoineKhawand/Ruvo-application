package com.ruvo.app.features.segments

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ruvo.app.designsystem.components.RuvoCard
import com.ruvo.app.designsystem.theme.RuvoColors

// Competitor-analysis Tier 2 #6 (Segments) — same-stretch leaderboards,
// Strava's single most-requested missing feature per the competitor
// analysis. Embedded as a Community tab (see CommunityScreen.kt) rather
// than its own top-level destination, matching how Routes (Tier 2 #8) is
// surfaced, since both read the same underlying route data.
@Composable
fun SegmentsTab(viewModel: SegmentsViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.loadSegments() }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(uiState.segments, key = { it.segment.id }) { item -> SegmentCard(item) }
        if (uiState.segments.isEmpty() && !uiState.isLoading) {
            item {
                androidx.compose.foundation.layout.Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    androidx.compose.foundation.layout.Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("🏁", style = MaterialTheme.typography.displayLarge)
                        Text(
                            "No segments yet. Create one from a finished run's detail screen to start a leaderboard.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = RuvoColors.textSecondary,
                        )
                    }
                }
            }
        }
        item { Spacer(modifier = Modifier.height(80.dp)) }
    }
}

@Composable
private fun SegmentCard(item: SegmentListItem) {
    RuvoCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SegmentSketch(points = item.segment.polyline, modifier = Modifier.fillMaxWidth().height(90.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text(item.segment.name, style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
                    Text(String.format("%.2f km", item.segment.distanceKm), style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                }
            }
            if (item.topEfforts.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    item.topEfforts.forEachIndexed { i, effort ->
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("#${i + 1}", style = MaterialTheme.typography.labelMedium, color = RuvoColors.lime)
                                Text(effort.userName, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary)
                            }
                            Text(formatEffortTime(effort.bestSeconds), style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
                        }
                    }
                }
            } else {
                Text("No efforts recorded yet — be the first.", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }
        }
    }
}

private fun formatEffortTime(totalSeconds: Int): String {
    val m = totalSeconds / 60
    val s = totalSeconds % 60
    return String.format("%d:%02d", m, s)
}

// Same lightweight Canvas-sketch approach RouteSketch (CommunityScreen.kt)
// uses for Route Discovery previews, not a real GoogleMap+Polyline instance
// per card — see that composable's own comment for why.
@Composable
private fun SegmentSketch(points: List<Pair<Double, Double>>, modifier: Modifier = Modifier) {
    androidx.compose.foundation.layout.Box(modifier = modifier.clip(RoundedCornerShape(12.dp)).background(RuvoColors.surfaceElev)) {
        if (points.size < 2) return@Box
        val lats = points.map { it.first }
        val lngs = points.map { it.second }
        val latSpan = (lats.max() - lats.min()).coerceAtLeast(0.00001)
        val lngSpan = (lngs.max() - lngs.min()).coerceAtLeast(0.00001)
        val minLat = lats.min(); val minLng = lngs.min()
        Canvas(modifier = Modifier.fillMaxSize().padding(12.dp)) {
            val span = maxOf(latSpan, lngSpan)
            val offsetX = (span - lngSpan) / 2.0
            val offsetY = (span - latSpan) / 2.0
            val path = Path()
            points.forEachIndexed { i, (lat, lng) ->
                val nx = ((lng - minLng + offsetX) / span).toFloat() * size.width
                val ny = (1f - ((lat - minLat + offsetY) / span).toFloat()) * size.height
                if (i == 0) path.moveTo(nx, ny) else path.lineTo(nx, ny)
            }
            drawPath(path, color = RuvoColors.purple, style = Stroke(width = 5f))
        }
    }
}
