package com.ruvo.app.features.runtracking

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.*
import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.Timestamp
import com.ruvo.app.core.model.LapData
import com.ruvo.app.core.model.RoutePoint
import com.ruvo.app.core.model.RunRecord
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*

// ─────────────────────────────────────────────────────────────────────────────
// Run Summary Screen
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun RunSummaryScreen(
    run: RunRecord,
    onDone: () -> Unit,
) {
    var showShareSheet by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background),
        contentPadding = PaddingValues(bottom = 100.dp)
    ) {
        item {
            // Header
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("Run Complete", fontSize = 28.sp, fontWeight = FontWeight.Black, color = RuvoColors.lime)
                Text(
                    run.startedAt.toDate().let { SimpleDateFormat("MMM d, yyyy · h:mm a", Locale.getDefault()).format(it) },
                    style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(RuvoColors.limeDim)
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Text("⚡", fontSize = 14.sp)
                    Text("+${run.xpEarned} XP", style = MaterialTheme.typography.labelLarge, color = RuvoColors.lime, fontWeight = FontWeight.Bold)
                    Text("·", color = RuvoColors.textTertiary)
                    Text("🪙", fontSize = 14.sp)
                    Text("+${run.coinsEarned} coins", style = MaterialTheme.typography.labelLarge, color = RuvoColors.coinGold, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Stats grid
        item {
            Column(modifier = Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SummaryStatCard("DISTANCE", String.format("%.2f", run.distanceKm), "km", RuvoColors.lime, Modifier.weight(1f))
                    SummaryStatCard("DURATION", run.durationSeconds.toRunTime(), "", Color.White, Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SummaryStatCard("AVG PACE", run.averagePaceMinPerKm.toPace(), "/km", Color(0xFFA855F7), Modifier.weight(1f))
                    SummaryStatCard("CALORIES", "${run.calories}", "kcal", RuvoColors.calorieOrange, Modifier.weight(1f))
                }
                if (run.elevationGainM > 0) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        SummaryStatCard("ELEVATION", String.format("%.0f", run.elevationGainM), "m", Color(0xFF2DD4BF), Modifier.weight(1f))
                        SummaryStatCard("LAPS", "${run.laps.size}", "", RuvoColors.coinGold, Modifier.weight(1f))
                    }
                }
            }
        }

        // Route art card preview
        if (run.route.size >= 2) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "Route",
                    style = MaterialTheme.typography.headlineSmall,
                    color = RuvoColors.textPrimary,
                    modifier = Modifier.padding(horizontal = 20.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))
                RoutePolylineCanvas(
                    route = run.route,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .padding(horizontal = 20.dp)
                        .clip(RoundedCornerShape(20.dp))
                )
            }
        }

        // Lap breakdown
        if (run.laps.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "Lap Breakdown",
                    style = MaterialTheme.typography.headlineSmall,
                    color = RuvoColors.textPrimary,
                    modifier = Modifier.padding(horizontal = 20.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))
            }
            items(run.laps) { lap -> LapRow(lap = lap) }
        }

        // Actions
        item {
            Spacer(modifier = Modifier.height(20.dp))
            Column(
                modifier = Modifier.padding(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = { showShareSheet = true },
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, RuvoColors.lime),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Icon(Icons.Default.Share, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Share Art Card", color = RuvoColors.lime, fontWeight = FontWeight.SemiBold)
                }
                RuvoButton(text = "Done", onClick = onDone)
            }
        }
    }

    if (showShareSheet) {
        ShareCardBottomSheet(run = run, onDismiss = { showShareSheet = false })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Share Card Bottom Sheet
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareCardBottomSheet(run: RunRecord, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = RuvoColors.surface,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 40.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Text("Share Your Run", style = MaterialTheme.typography.headlineMedium, color = RuvoColors.textPrimary)

            // Card preview
            RunShareArtCard(run = run, modifier = Modifier.fillMaxWidth())

            // Action buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f),
                    border = BorderStroke(1.dp, RuvoColors.border),
                    shape = RoundedCornerShape(16.dp)
                ) { Text("Cancel", color = RuvoColors.textSecondary) }

                Button(
                    onClick = {
                        scope.launch {
                            shareRunCard(context, run)
                            onDismiss()
                        }
                    },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Icon(Icons.Default.Share, contentDescription = null, tint = Color.Black, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Share", color = Color.Black, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Run Share Art Card (Compose-rendered shareable card)
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun RunShareArtCard(run: RunRecord, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .aspectRatio(390f / 620f)
            .clip(RoundedCornerShape(24.dp))
            .background(Color(0xFF050505))
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 20.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        "RUVO",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        color = RuvoColors.lime,
                        letterSpacing = 4.sp
                    )
                    Text(
                        run.startedAt.toDate().let { SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(it) },
                        fontSize = 11.sp,
                        // Was a hardcoded #777777, computed to fail WCAG AA (4.5:1) at this
                        // size against this card's #050505 background. This bitmap-style
                        // card can't read the live Compose theme, but RuvoColors are just
                        // Kotlin Color values, so referencing the token directly still works.
                        color = RuvoColors.textSecondary
                    )
                }
                Icon(Icons.Default.DirectionsRun, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(36.dp))
            }

            // Route canvas
            RoutePolylineCanvas(
                route = run.route,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .background(Color(0xFF0A0A0A))
            )

            // Stats section
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Primary: distance
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(String.format("%.2f", run.distanceKm), fontSize = 52.sp, fontWeight = FontWeight.Black, color = Color.White)
                        // Was a hardcoded #666666 -- ~3.5:1 against this card's #050505
                        // background, failing WCAG AA. textTertiary is tuned to clear it.
                        Text("km", fontSize = 18.sp, color = RuvoColors.textTertiary, modifier = Modifier.padding(bottom = 6.dp))
                    }
                    Text("DISTANCE", fontSize = 11.sp, color = RuvoColors.lime, letterSpacing = 3.sp, fontWeight = FontWeight.Bold)
                }

                // Secondary row
                Row(modifier = Modifier.fillMaxWidth()) {
                    ShareStatCell(value = run.durationSeconds.toRunTime(), label = "TIME", modifier = Modifier.weight(1f))
                    Box(modifier = Modifier.width(1.dp).height(36.dp).background(Color(0xFF222222)).align(Alignment.CenterVertically))
                    ShareStatCell(value = run.averagePaceMinPerKm.toPace(), label = "PACE /KM", modifier = Modifier.weight(1f))
                    Box(modifier = Modifier.width(1.dp).height(36.dp).background(Color(0xFF222222)).align(Alignment.CenterVertically))
                    ShareStatCell(value = "${run.calories}", label = "KCAL", modifier = Modifier.weight(1f))
                }

                // XP pill
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(RuvoColors.lime)
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Bolt, contentDescription = null, tint = Color.Black, modifier = Modifier.size(14.dp))
                    Text("+${run.xpEarned} XP earned", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.Black)
                }

                // Was a hardcoded #444444 -- only ~2.1:1 against this card's #050505
                // background, a much worse WCAG AA failure than even the other grays
                // here. textTertiary is the darkest token that still clears 4.5:1.
                Text("ruvo.app", fontSize = 11.sp, color = RuvoColors.textTertiary)
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Polyline Canvas
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun RoutePolylineCanvas(route: List<RoutePoint>, modifier: Modifier = Modifier) {
    val limeColor = RuvoColors.lime
    Canvas(modifier = modifier) {
        val w = size.width; val h = size.height
        val gridColor = limeColor.copy(alpha = 0.04f)
        val cols = 8; val rows = 6
        for (i in 0..cols) {
            val x = w / cols * i
            drawLine(gridColor, Offset(x, 0f), Offset(x, h), strokeWidth = 1f)
        }
        for (i in 0..rows) {
            val y = h / rows * i
            drawLine(gridColor, Offset(0f, y), Offset(w, y), strokeWidth = 1f)
        }

        if (route.size < 2) return@Canvas

        val lats = route.map { it.latitude }
        val lons = route.map { it.longitude }
        val minLat = lats.min(); val maxLat = lats.max()
        val minLon = lons.min(); val maxLon = lons.max()
        val latRange = maxLat - minLat; val lonRange = maxLon - minLon
        val span = maxOf(latRange, lonRange) * 1.25
        val padding = 30f

        fun toOffset(pt: RoutePoint): Offset {
            val x = padding + ((pt.longitude - minLon + (span - lonRange) / 2) / span * (w - padding * 2)).toFloat()
            val y = padding + ((1.0 - (pt.latitude - minLat + (span - latRange) / 2) / span) * (h - padding * 2)).toFloat()
            return Offset(x, y)
        }

        val offsets = route.map { toOffset(it) }

        // Glow pass
        val glowPath = Path()
        glowPath.moveTo(offsets[0].x, offsets[0].y)
        offsets.drop(1).forEach { glowPath.lineTo(it.x, it.y) }
        drawPath(glowPath, color = limeColor.copy(alpha = 0.2f), style = Stroke(width = 10f, cap = StrokeCap.Round, join = StrokeJoin.Round))

        // Main line
        val path = Path()
        path.moveTo(offsets[0].x, offsets[0].y)
        offsets.drop(1).forEach { path.lineTo(it.x, it.y) }
        drawPath(path, color = limeColor, style = Stroke(width = 3f, cap = StrokeCap.Round, join = StrokeJoin.Round))

        // Start dot (green)
        drawCircle(Color(0xFF22C55E), radius = 8f, center = offsets.first())
        drawCircle(Color.White, radius = 4f, center = offsets.first())

        // End dot (red)
        drawCircle(Color(0xFFEF4444), radius = 8f, center = offsets.last())
        drawCircle(Color.White, radius = 4f, center = offsets.last())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun SummaryStatCard(label: String, value: String, unit: String, color: Color, modifier: Modifier = Modifier) {
    RuvoCard(modifier = modifier) {
        Column(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, letterSpacing = 1.5.sp)
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(value, style = MaterialTheme.typography.displayMedium, color = color)
                if (unit.isNotEmpty()) {
                    Text(unit, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary, modifier = Modifier.padding(bottom = 3.dp))
                }
            }
        }
    }
}

@Composable
private fun ShareStatCell(value: String, label: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(value, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.White)
        // Was a hardcoded #666666 -- ~3.5:1 at 9sp against this card's #050505
        // background, well under WCAG AA's 4.5:1. textTertiary clears it.
        Text(label, fontSize = 9.sp, color = RuvoColors.textTertiary, letterSpacing = 1.sp)
    }
}

@Composable
private fun LapRow(lap: LapData) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 4.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(RuvoColors.surfaceElev)
            .padding(14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text("Lap ${lap.number}", style = MaterialTheme.typography.labelLarge, color = Color.White, modifier = Modifier.width(55.dp))
        Text(String.format("%.2f km", lap.distanceKm), style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
        Text(lap.paceMinPerKm.toPace() + "/km", style = MaterialTheme.typography.labelLarge, color = RuvoColors.lime)
        Text(lap.durationSeconds.toRunTime(), style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Share via Android Share Sheet
// ─────────────────────────────────────────────────────────────────────────────

private suspend fun shareRunCard(context: Context, run: RunRecord) = withContext(Dispatchers.IO) {
    // Text-only fallback for now — bitmap capture from Compose requires AndroidView in production
    val text = String.format(
        "Just ran %.2f km in %s at %s/km with Ruvo! ⚡ #Ruvo #Running",
        run.distanceKm, run.durationSeconds.toRunTime(), run.averagePaceMinPerKm.toPace()
    )
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, text)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(Intent.createChooser(intent, "Share your run").apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) })
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

internal fun Int.toRunTime(): String {
    val h = this / 3600; val m = (this % 3600) / 60; val s = this % 60
    return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%d:%02d", m, s)
}

internal fun Double.toPace(): String {
    if (this <= 0 || this > 30) return "--:--"
    val min = this.toInt(); val sec = ((this - min) * 60).toInt()
    return String.format("%d:%02d", min, sec)
}
