package com.ruvo.app.features.auth

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ruvo.app.designsystem.theme.RuvoColors
import java.time.DayOfWeek

private val OnLime = Color(0xFF121212)

private val WEEK_DAYS = listOf(
    DayOfWeek.MONDAY to "Mo",
    DayOfWeek.TUESDAY to "Tu",
    DayOfWeek.WEDNESDAY to "We",
    DayOfWeek.THURSDAY to "Th",
    DayOfWeek.FRIDAY to "Fr",
    DayOfWeek.SATURDAY to "Sa",
    DayOfWeek.SUNDAY to "Su",
)

private fun insightFor(count: Int): Pair<String, String> = when (count) {
    0 -> "Pick at least one day" to "Choose the days you can realistically run."
    1 -> "A gentle start" to "One run keeps the habit alive. Add a second when it feels easy."
    2 -> "A gentle start" to "Two runs a week builds a base without wearing you out."
    3 -> "A steady rhythm" to "Three runs with rest between is the classic way to build fitness."
    4 -> "A solid routine" to "Four runs works well. Keep at least two of them easy."
    5 -> "An ambitious week" to "Five runs is a lot. Plan easy days so you stay injury-free."
    6 -> "A heavy week" to "Six runs needs careful pacing. Keep one full rest day."
    else -> "Every day" to "Seven days leaves no recovery. Make some of them very short."
}

/** Lime card: day pills, a stacked run/rest semicircle, a legend and a coaching line. */
@Composable
fun WeekCard(selectedDays: Set<DayOfWeek>, onDaysChange: (Set<DayOfWeek>) -> Unit) {
    val count = selectedDays.size
    val rest = 7 - count
    val (headline, detail) = insightFor(count)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(32.dp))
            .background(RuvoColors.lime)
            .padding(start = 14.dp, end = 14.dp, top = 18.dp, bottom = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 6.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
            Text("Your week", color = OnLime, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
            Text("RUN · REST", color = OnLime.copy(alpha = 0.6f), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.5.sp)
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            WEEK_DAYS.forEach { (day, label) ->
                val on = day in selectedDays
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(46.dp)
                        .clip(CircleShape)
                        .background(if (on) OnLime else Color.White.copy(alpha = 0.38f))
                        .semantics {
                            contentDescription = day.name.lowercase().replaceFirstChar { it.uppercase() }
                            selected = on
                        }
                        .clickable { onDaysChange(if (on) selectedDays - day else selectedDays + day) },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(label, color = if (on) RuvoColors.lime else OnLime, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                }
            }
        }

        WeekGauge(count = count)

        Row(horizontalArrangement = Arrangement.spacedBy(18.dp), verticalAlignment = Alignment.CenterVertically) {
            LegendDot(OnLime, if (count == 1) "1 run day" else "$count run days")
            LegendDot(OnLime.copy(alpha = 0.25f), if (rest == 1) "1 rest day" else "$rest rest days")
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(18.dp))
                .background(OnLime.copy(alpha = 0.09f))
                .padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(Icons.AutoMirrored.Filled.TrendingUp, contentDescription = null, tint = OnLime, modifier = Modifier.size(18.dp).padding(top = 1.dp))
            Column {
                Text(headline, color = OnLime, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
                Text(detail, color = OnLime.copy(alpha = 0.7f), fontSize = 12.5.sp, fontWeight = FontWeight.Medium, lineHeight = 17.sp)
            }
        }
    }
}

@Composable
private fun LegendDot(color: Color, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(color))
        Text(text, color = OnLime, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Start)
    }
}

@Composable
private fun WeekGauge(count: Int) {
    val fraction = remember { Animatable(count / 7f) }
    LaunchedEffect(count) { fraction.animateTo(count / 7f, spring(dampingRatio = 0.8f, stiffness = Spring.StiffnessMediumLow)) }

    Box(modifier = Modifier.width(280.dp).height(154.dp), contentAlignment = Alignment.TopCenter) {
        Canvas(Modifier.fillMaxSize()) {
            val thickness = 30.dp.toPx()
            val diameter = size.width - thickness
            val radius = diameter / 2
            val topLeft = Offset(thickness / 2, thickness / 2)
            val arcSize = Size(diameter, diameter)
            val capDeg = Math.toDegrees((thickness / 2 / radius).toDouble()).toFloat()
            val gapDeg = 3f
            val stroke = Stroke(width = thickness, cap = StrokeCap.Round)

            fun segment(fromDeg: Float, toDeg: Float, color: Color, gapStart: Boolean, gapEnd: Boolean) {
                val a = fromDeg + capDeg + if (gapStart) gapDeg / 2 else 0f
                val b = toDeg - capDeg - if (gapEnd) gapDeg / 2 else 0f
                if (b - a > 0.2f) drawArc(color, 180f + a, b - a, false, topLeft, arcSize, style = stroke)
            }

            val split = 180f * fraction.value
            segment(0f, split, OnLime, gapStart = false, gapEnd = split < 179.9f)
            segment(split, 180f, OnLime.copy(alpha = 0.25f), gapStart = split > 0.1f, gapEnd = false)
        }
        Column(Modifier.align(Alignment.BottomCenter), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("$count", color = OnLime, fontSize = 56.sp, fontWeight = FontWeight.ExtraBold)
            Text("runs a week", color = OnLime.copy(alpha = 0.65f), fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

// MARK: - iOS-style time wheels

private val WheelItemHeight = 40.dp
private const val WheelVisible = 5

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun TimeWheelSheet(hour24: Int, minute: Int, onConfirm: (Int, Int) -> Unit, onDismiss: () -> Unit) {
    var h12 by remember { mutableIntStateOf(if (hour24 % 12 == 0) 12 else hour24 % 12) }
    var min by remember { mutableIntStateOf(minute) }
    var pm by remember { mutableStateOf(hour24 >= 12) }

    androidx.compose.material3.ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF161616),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("Preferred run time", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
            Box(
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Color(0xFF1C1C1E)),
                contentAlignment = Alignment.Center,
            ) {
                Box(Modifier.padding(horizontal = 8.dp).fillMaxWidth().height(WheelItemHeight).clip(RoundedCornerShape(10.dp)).background(Color.White.copy(alpha = 0.12f)))
                Row(Modifier.fillMaxWidth()) {
                    Wheel(List(12) { "${it + 1}" }, h12 - 1, Modifier.weight(1f), Alignment.CenterEnd) { h12 = it + 1 }
                    Wheel(List(60) { "%02d".format(it) }, min, Modifier.weight(1f), Alignment.CenterStart) { min = it }
                    Wheel(listOf("AM", "PM"), if (pm) 1 else 0, Modifier.weight(0.9f), Alignment.Center) { pm = it == 1 }
                }
            }
            com.ruvo.app.designsystem.components.RuvoButton(
                text = "Done",
                onClick = { onConfirm((h12 % 12) + if (pm) 12 else 0, min) },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun Wheel(items: List<String>, selected: Int, modifier: Modifier, align: Alignment, onSelect: (Int) -> Unit) {
    val state = androidx.compose.foundation.lazy.rememberLazyListState(initialFirstVisibleItemIndex = selected)
    val fling = androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior(state)
    val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current
    val pad = WheelItemHeight * (WheelVisible / 2)

    LaunchedEffect(state) {
        snapshotFlow { state.firstVisibleItemIndex }.collect { i ->
            val idx = i.coerceIn(0, items.lastIndex)
            if (idx != selected) {
                onSelect(idx)
                haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.TextHandleMove)
            }
        }
    }

    androidx.compose.foundation.lazy.LazyColumn(
        state = state,
        flingBehavior = fling,
        contentPadding = PaddingValues(vertical = pad),
        modifier = modifier.height(WheelItemHeight * WheelVisible),
    ) {
        items(items.size) { i ->
            val dist = kotlin.math.abs(i - state.firstVisibleItemIndex)
            Box(
                Modifier.fillMaxWidth().height(WheelItemHeight).padding(horizontal = 12.dp),
                contentAlignment = align,
            ) {
                Text(
                    items[i],
                    color = Color.White.copy(alpha = when (dist) { 0 -> 1f; 1 -> 0.55f; else -> 0.28f }),
                    fontSize = 23.sp,
                )
            }
        }
    }
}
