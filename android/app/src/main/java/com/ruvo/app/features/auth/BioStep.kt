package com.ruvo.app.features.auth

import android.provider.Settings
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.drag
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.layout.boundsInParent
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ruvo.app.designsystem.theme.RuvoColors
import com.ruvo.app.designsystem.theme.RuvoMotion
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.Month
import java.time.Period
import java.time.YearMonth
import java.time.format.TextStyle as MonthStyle
import java.util.Locale
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.roundToInt

// Onboarding step 3: "About you" -- native port of the approved "Ruvo Onboarding: About You
// (2 pages)" design. One step, two pages:
//   page 1  gender, date of birth (wheel sheet) and a live age readout
//   page 2  metric/imperial toggle and two rulers (weight, height); drag a ruler, or tap its
//           number / the pencil to type an exact value
// The surrounding screen's Back/Continue move between the pages: Back on page 2 returns to page
// 1, and Continue on page 2 stays dimmed until both measurements are set (tapping it early
// nudges the missing ruler). Swiping sideways on empty space also changes page.
//
// Weight and height are kept canonically in kg and cm and converted for display, so switching
// units never changes what is saved (the old form saved the raw typed number with a unit label).
// The ruler start positions are typical values per gender, shown until the user moves the
// ruler; nothing is saved from them until the user does.

private val Ink = RuvoColors.textPrimary
private val Muted = Color(0xFF7A7A85)
private val OnLime = Color(0xFF121212)
private val Panel = Color(0xFF111111)
private const val LB = 2.20462
private const val INCH = 2.54
private const val MIN_AGE = 13

internal enum class Measure { WEIGHT, HEIGHT }

private class RulerCfg(val min: Int, val max: Int, val ppu: Float, val major: Int, val mid: Int, val lab: Int)

private fun rulerCfg(m: Measure, imperial: Boolean) = when (m) {
    Measure.WEIGHT -> if (!imperial) RulerCfg(30, 200, 12f, 10, 5, 5) else RulerCfg(66, 440, 10f, 10, 5, 10)
    Measure.HEIGHT -> if (!imperial) RulerCfg(120, 230, 12f, 10, 5, 5) else RulerCfg(48, 90, 14f, 12, 6, 6)
}

private fun rulerLabel(m: Measure, imperial: Boolean, u: Int) =
    if (m == Measure.HEIGHT && imperial) (if (u % 12 == 0) "${u / 12}′" else "${u / 12}′6″") else "$u"

/** Typical starting positions for the rulers (placeholders, tune with real data). */
private val TYPICAL = mapOf(
    "Male" to (75.0 to 176.0), "Female" to (62.0 to 163.0),
    "Other" to (68.0 to 170.0), "Undisclosed" to (68.0 to 170.0),
)

/** US, Liberia and Myanmar use imperial units; everyone else metric. */
internal fun defaultBioUnit(): String = if (Locale.getDefault().country in setOf("US", "LR", "MM")) "imperial" else "metric"

@Stable
internal class BioState(initialUnit: String) {
    var page by mutableIntStateOf(0)
    var gender by mutableStateOf("Male")
    var dob by mutableStateOf(LocalDate.of(2000, 1, 1))
    var unit by mutableStateOf(initialUnit)                 // "metric" | "imperial"
    var kg by mutableDoubleStateOf(75.0)
    var cm by mutableDoubleStateOf(176.0)
    var weightSet by mutableStateOf(false)
    var heightSet by mutableStateOf(false)
    var resetKey by mutableIntStateOf(0)
    internal var weightHinted = false
    internal var heightHinted = false

    val imperial get() = unit == "imperial"
    val valid get() = weightSet && heightSet
    val age: Int get() = Period.between(dob, LocalDate.now()).years

    internal fun display(m: Measure): Int = when (m) {
        Measure.WEIGHT -> if (imperial) (kg * LB).roundToInt() else kg.roundToInt()
        Measure.HEIGHT -> if (imperial) (cm / INCH).roundToInt() else cm.roundToInt()
    }

    internal fun commit(m: Measure, v: Int) {
        when (m) {
            Measure.WEIGHT -> kg = if (imperial) v / LB else v.toDouble()
            Measure.HEIGHT -> cm = if (imperial) v * INCH else v.toDouble()
        }
    }

    /** Start unset rulers near a typical value for the chosen gender. */
    fun applyGenderDefaults() {
        val (w, h) = TYPICAL[gender] ?: TYPICAL.getValue("Other")
        if (!weightSet) kg = w
        if (!heightSet) cm = h
        resetKey++
    }
}

@Composable
private fun rememberReduceMotion(): Boolean {
    val context = LocalContext.current
    return remember { Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f }
}

// Icons: Hugeicons (free set, MIT), 24x24 stroke paths.
private object BioIcons {
    val male = listOf(
        "M21 9C21 12.3137 18.3137 15 15 15C11.6863 15 9 12.3137 9 9C9 5.68629 11.6863 3 15 3C18.3137 3 21 5.68629 21 9Z",
        "M3 15V17C3 18.8856 3 19.8284 3.58579 20.4142C4.17157 21 5.11438 21 7 21H9M4 20L10.5 13.5",
    )
    val female = listOf("M12 14C15.3137 14 18 11.3137 18 8C18 4.68629 15.3137 2 12 2C8.68629 2 6 4.68629 6 8C6 11.3137 8.68629 14 12 14ZM12 14V22M9 19H15")
    val other = listOf(
        "M19.4995 20V16.5C20.5856 16.5 21.1991 16.5 21.4186 16.0257C21.6381 15.5515 21.3953 14.9028 20.9095 13.6056L19.6676 10.2889C19.2571 9.19253 18.4179 8.5 17.5 8.5C16.5821 8.5 15.7429 9.19253 15.3324 10.2889L14.0905 13.6056C13.6047 14.9028 13.3619 15.5515 13.5814 16.0257C13.8009 16.5 14.4133 16.5 15.4995 16.5V20C15.4995 20.9428 15.4995 21.4142 15.7924 21.7071C16.0853 22 16.5567 22 17.4995 22C18.4423 22 18.9137 22 19.2066 21.7071C19.4995 21.4142 19.4995 20.9428 19.4995 20Z",
        "M8.5 4C8.5 5.10457 7.60457 6 6.5 6C5.39543 6 4.5 5.10457 4.5 4C4.5 2.89543 5.39543 2 6.5 2C7.60457 2 8.5 2.89543 8.5 4Z",
        "M19.5 4C19.5 5.10457 18.6046 6 17.5 6C16.3954 6 15.5 5.10457 15.5 4C15.5 2.89543 16.3954 2 17.5 2C18.6046 2 19.5 2.89543 19.5 4Z",
        "M10.5 12.5C10.5 10.6144 10.5 9.67157 9.91421 9.08579C9.32843 8.5 8.38562 8.5 6.5 8.5C4.61438 8.5 3.67157 8.5 3.08579 9.08579C2.5 9.67157 2.5 10.6144 2.5 12.5V14.5C2.5 15.4428 2.5 15.9142 2.79289 16.2071C3.08579 16.5 3.55719 16.5 4.5 16.5V20C4.5 20.9428 4.5 21.4142 4.79289 21.7071C5.08579 22 5.55719 22 6.5 22C7.44281 22 7.91421 22 8.20711 21.7071C8.5 21.4142 8.5 20.9428 8.5 20V16.5C9.44281 16.5 9.91421 16.5 10.2071 16.2071C10.5 15.9142 10.5 15.4428 10.5 14.5V12.5Z",
    )
    val calendar = listOf(
        "M16 2V6M8 2V6",
        "M13 4H11C7.22876 4 5.34315 4 4.17157 5.17157C3 6.34315 3 8.22876 3 12V14C3 17.7712 3 19.6569 4.17157 20.8284C5.34315 22 7.22876 22 11 22H13C16.7712 22 18.6569 22 19.8284 20.8284C21 19.6569 21 17.7712 21 14V12C21 8.22876 21 6.34315 19.8284 5.17157C18.6569 4 16.7712 4 13 4Z",
        "M3 10H21",
        "M12.1258 14H12.0008M12.1258 18H12.0008M7.625 14H7.5M7.625 18H7.5M16.625 14H16.5",
    )
    val close = listOf("M18 6L6.00081 17.9992M17.9992 18L6 6.00085")
    val tick = listOf("M5 14L8.5 17.5L19 6.5")
    val lock = listOf(
        "M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z",
        "M12 13C13.1046 13 14 12.1046 14 11C14 9.89543 13.1046 9 12 9C10.8954 9 10 9.89543 10 11C10 12.1046 10.8954 13 12 13ZM12 13L12 16",
    )
    val edit = listOf(
        "M14.0737 3.88545C14.8189 3.07808 15.1915 2.6744 15.5874 2.43893C16.5427 1.87076 17.7191 1.85309 18.6904 2.39232C19.0929 2.6158 19.4769 3.00812 20.245 3.79276C21.0131 4.5774 21.3972 4.96972 21.6159 5.38093C22.1438 6.37312 22.1265 7.57479 21.5703 8.5507C21.3398 8.95516 20.9446 9.33578 20.1543 10.097L10.7506 19.1543C9.25288 20.5969 8.504 21.3182 7.56806 21.6837C6.63212 22.0493 5.6032 22.0224 3.54536 21.9686L3.26538 21.9613C2.63891 21.9449 2.32567 21.9367 2.14359 21.73C1.9615 21.5234 1.98636 21.2043 2.03608 20.5662L2.06308 20.2197C2.20301 18.4235 2.27297 17.5255 2.62371 16.7182C2.97444 15.9109 3.57944 15.2555 4.78943 13.9445L14.0737 3.88545Z",
        "M13 4L20 11",
        "M14 22L22 22",
    )
}

// ------------------------------------------------------------------------------------------
// Step
// ------------------------------------------------------------------------------------------

@Composable
internal fun BioStep(state: BioState, nudge: Int) {
    val reduce = rememberReduceMotion()
    val density = LocalDensity.current
    val slide = with(density) { 44.dp.roundToPx() }
    val swipe = with(density) { 60.dp.toPx() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(state.page) {
                // Swipe between pages on empty space; rulers, wheels and buttons consume their own drags first.
                var total = 0f
                detectHorizontalDragGestures(
                    onDragStart = { total = 0f },
                    onDragEnd = {
                        if (total > swipe && state.page == 1) state.page = 0
                        else if (total < -swipe && state.page == 0) state.page = 1
                    },
                    onHorizontalDrag = { _, dx -> total += dx },
                )
            },
    ) {
        AnimatedContent(
            targetState = state.page,
            transitionSpec = {
                val forward = targetState > initialState
                if (reduce) fadeIn(tween(1)) togetherWith fadeOut(tween(1))
                else (fadeIn(tween(400)) + slideInHorizontally(tween(550, easing = RuvoMotion.EaseOut)) { if (forward) slide else -slide }) togetherWith
                    (fadeOut(tween(250)) + slideOutHorizontally(tween(550, easing = RuvoMotion.EaseOut)) { if (forward) -slide else slide })
            },
            label = "bio_page",
        ) { page ->
            if (page == 0) AboutPage(state, reduce) else BodyPage(state, nudge, reduce)
        }
    }
}

@Composable
private fun Titles(title: String, subtitle: String) {
    Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(title, style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary, textAlign = TextAlign.Center)
        Text(subtitle, style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary, textAlign = TextAlign.Center)
    }
}

// ------------------------------------------------------------------------------------------
// Page 1: about you
// ------------------------------------------------------------------------------------------

private val GENDER_OPTIONS = listOf(
    Triple("Male", "Male", BioIcons.male),
    Triple("Female", "Female", BioIcons.female),
    Triple("Other", "Other", BioIcons.other),
    Triple("Undisclosed", "Rather not say", null as List<String>?),
)

@Composable
private fun AboutPage(state: BioState, reduce: Boolean) {
    val haptic = LocalHapticFeedback.current
    var sheetOpen by remember { mutableStateOf(false) }
    val age by animateIntAsState(state.age, tween(if (reduce) 1 else 500), label = "age")

    Column(modifier = Modifier.fillMaxSize()) {
        Titles("Tell us about you", "Helps us tune your training accurately")

        Column(modifier = Modifier.fillMaxWidth().padding(top = 18.dp)) {
            Label("Gender", top = 14.dp)
            GENDER_OPTIONS.chunked(2).forEachIndexed { r, row ->
                if (r > 0) Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    row.forEach { (value, label, icon) ->
                        GenderButton(label, icon, state.gender == value, Modifier.weight(1f)) {
                            state.gender = value
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            state.applyGenderDefaults()
                        }
                    }
                }
            }

            Label("Date of Birth", top = 28.dp)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 64.dp)
                    .clip(RoundedCornerShape(22.dp))
                    .background(Color(0xFF121212))
                    .border(1.5.dp, Color(0xFF2A2A2A), RoundedCornerShape(22.dp))
                    .clickable(onClickLabel = "Change date of birth") { sheetOpen = true }
                    .padding(horizontal = 20.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                StrokeIcon(BioIcons.calendar, 22.dp, Muted, strokeWidth = 1.6f)
                Text(formatDob(state.dob), color = Ink, fontSize = 16.5.sp)
            }
        }

        // Live age readout
        Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            Box(
                Modifier.size(230.dp).drawBehind {
                    drawCircle(Brush.radialGradient(listOf(RuvoColors.lime.copy(alpha = 0.11f), Color.Transparent)), radius = size.width / 2f)
                },
            )
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    "$age", color = RuvoColors.lime, fontSize = 88.sp, fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-3.5).sp, lineHeight = 88.sp,
                    modifier = Modifier.semantics { contentDescription = "$age years old" },
                )
                Text("years old", color = Muted, fontSize = 14.sp)
            }
        }

        Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StrokeIcon(BioIcons.lock, 15.dp, RuvoColors.lime.copy(alpha = 0.85f), modifier = Modifier.padding(top = 1.dp))
            Text("Private to you. Only used to estimate pace and calories.", color = Muted, fontSize = 12.5.sp, lineHeight = 17.5.sp)
        }
    }

    if (sheetOpen) {
        DobSheet(
            initial = state.dob,
            reduce = reduce,
            onApply = { state.dob = it; sheetOpen = false },
            onDismiss = { sheetOpen = false },
        )
    }
}

private fun formatDob(d: LocalDate) =
    "${d.month.getDisplayName(MonthStyle.SHORT, Locale.ENGLISH)} ${d.dayOfMonth}, ${d.year}"

@Composable
private fun Label(text: String, top: Dp) {
    Text(text, color = Muted, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = top, bottom = 12.dp))
}

@Composable
private fun GenderButton(label: String, icon: List<String>?, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val bg by animateColorAsState(if (selected) RuvoColors.lime.copy(alpha = 0.11f) else Color(0xFF0E0E0E), tween(250), label = "genderBg")
    val fg by animateColorAsState(if (selected) RuvoColors.lime else Color.White, tween(250), label = "genderFg")
    Row(
        modifier = modifier
            .heightIn(min = 54.dp)
            .clip(RoundedCornerShape(27.dp))
            .background(bg)
            .border(1.5.dp, if (selected) RuvoColors.lime else Color(0xFF2A2A2A), RoundedCornerShape(27.dp))
            .clickable(onClick = onClick)
            .semantics { role = Role.RadioButton; this.selected = selected }
            .padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (icon != null) {
            StrokeIcon(icon, 17.dp, fg.copy(alpha = if (selected) 1f else 0.75f), strokeWidth = 1.6f)
            Spacer(Modifier.width(8.dp))
        }
        Text(label, color = fg, fontSize = 14.5.sp, fontWeight = FontWeight.Medium, maxLines = 1)
    }
}

// ------------------------------------------------------------------------------------------
// Date of birth: three snapping wheels in a bottom sheet
// ------------------------------------------------------------------------------------------

private val MONTHS = Month.entries.map { it.getDisplayName(MonthStyle.SHORT, Locale.ENGLISH) }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DobSheet(initial: LocalDate, reduce: Boolean, onApply: (LocalDate) -> Unit, onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val thisYear = LocalDate.now().year
    val years = remember { (thisYear - MIN_AGE downTo thisYear - 100).toList() }

    var month by remember { mutableIntStateOf(initial.monthValue - 1) }
    var year by remember { mutableIntStateOf(initial.year.coerceIn(years.last(), years.first())) }
    var day by remember { mutableIntStateOf(initial.dayOfMonth) }
    val daysInMonth = YearMonth.of(year, month + 1).lengthOfMonth()
    if (day > daysInMonth) day = daysInMonth

    fun close(apply: Boolean) {
        scope.launch { sheetState.hide() }.invokeOnCompletion { if (apply) onApply(LocalDate.of(year, month + 1, day)) else onDismiss() }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF141414),
        contentColor = Color.White,
        shape = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp),
    ) {
        Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 30.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text("Date of birth", modifier = Modifier.weight(1f), color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Box(
                    modifier = Modifier.size(34.dp).clip(CircleShape).background(Color(0xFF222222))
                        .clickable(onClickLabel = "Close") { close(false) }
                        .semantics { contentDescription = "Close" },
                    contentAlignment = Alignment.Center,
                ) { StrokeIcon(BioIcons.close, 18.dp, Color.White, strokeWidth = 2f) }
            }
            Spacer(Modifier.height(14.dp))
            Box(modifier = Modifier.fillMaxWidth().height(220.dp)) {
                // Selection band
                Box(
                    Modifier.fillMaxWidth().padding(top = 88.dp).height(44.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(RuvoColors.lime.copy(alpha = 0.07f))
                        .border(1.dp, RuvoColors.lime.copy(alpha = 0.28f), RoundedCornerShape(14.dp)),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Wheel(MONTHS, month, { month = it }, "Month", Modifier.weight(1.25f))
                    Wheel((1..daysInMonth).map { "$it" }, day - 1, { day = it + 1 }, "Day", Modifier.weight(0.8f))
                    Wheel(years.map { "$it" }, years.indexOf(year).coerceAtLeast(0), { year = years[it] }, "Year", Modifier.weight(1f))
                }
            }
            Spacer(Modifier.height(18.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth().height(54.dp)
                    .clip(RoundedCornerShape(40.dp))
                    .background(Brush.horizontalGradient(listOf(RuvoColors.lime, RuvoColors.limeGradientEnd)))
                    .clickable { close(true) },
                contentAlignment = Alignment.Center,
            ) { Text("Done", color = OnLime, fontSize = 17.sp, fontWeight = FontWeight.Bold) }
        }
    }
}

private val WheelItem = 44.dp

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Wheel(items: List<String>, index: Int, onIndex: (Int) -> Unit, description: String, modifier: Modifier) {
    val state = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current
    val onIndexNow by rememberUpdatedState(onIndex)

    // Put the wheel on the current value whenever its item list changes (e.g. fewer days in February).
    LaunchedEffect(items.size) { state.scrollToItem(index.coerceIn(0, items.lastIndex)) }
    LaunchedEffect(state, items.size) {
        var first = true
        snapshotFlow { nearestIndex(state) }.distinctUntilChanged().collect {
            if (!first) haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            first = false
            if (it in items.indices) onIndexNow(it)
        }
    }

    LazyColumn(
        state = state,
        flingBehavior = rememberSnapFlingBehavior(state),
        contentPadding = PaddingValues(vertical = 88.dp),
        modifier = modifier
            .height(220.dp)
            .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
            .drawWithContent {
                drawContent()
                drawRect(
                    Brush.verticalGradient(0f to Color.Transparent, 0.28f to Color.Black, 0.72f to Color.Black, 1f to Color.Transparent),
                    blendMode = BlendMode.DstIn,
                )
            }
            .semantics { contentDescription = description },
    ) {
        itemsIndexed(items) { i, text ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(WheelItem)
                    .graphicsLayer {
                        val d = wheelDistance(state, i)
                        alpha = (1f - d * 0.3f).coerceAtLeast(0.2f)
                        val s = (1f - d * 0.07f).coerceAtLeast(0.78f)
                        scaleX = s; scaleY = s
                    }
                    .clickable(interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }, indication = null) {
                        scope.launch { state.animateScrollToItem(i) }
                    },
                contentAlignment = Alignment.Center,
            ) {
                val near by remember { derivedStateOf { wheelDistance(state, i) < 0.5f } }
                Text(text, color = if (near) Color.White else RuvoColors.textSecondary, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

/** How far (in item heights) the item at [index] is from the centre of the wheel; large when off-screen. */
private fun wheelDistance(state: LazyListState, index: Int): Float {
    val info = state.layoutInfo
    val item = info.visibleItemsInfo.firstOrNull { it.index == index } ?: return 9f
    val centre = (info.viewportStartOffset + info.viewportEndOffset) / 2f
    return abs(item.offset + item.size / 2f - centre) / item.size
}

private fun nearestIndex(state: LazyListState): Int {
    val info = state.layoutInfo
    val centre = (info.viewportStartOffset + info.viewportEndOffset) / 2f
    return info.visibleItemsInfo.minByOrNull { abs(it.offset + it.size / 2f - centre) }?.index ?: 0
}

// ------------------------------------------------------------------------------------------
// Page 2: your body
// ------------------------------------------------------------------------------------------

@Composable
private fun BodyPage(state: BioState, nudge: Int, reduce: Boolean) {
    val haptic = LocalHapticFeedback.current
    Column(modifier = Modifier.fillMaxSize()) {
        Titles("Your body", "Set your weight and height")

        UnitToggle(state.imperial, Modifier.padding(top = 18.dp)) { imperial ->
            state.unit = if (imperial) "imperial" else "metric"
            state.resetKey++
            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        }

        // Like the design's flex:1 panels with a max height: they stack from the top with a 12dp gap.
        Column(modifier = Modifier.weight(1f).fillMaxWidth().padding(top = 14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            MeasureCard(state, Measure.WEIGHT, "Weight", nudge, 900, reduce, Modifier.weight(1f, fill = false))
            MeasureCard(state, Measure.HEIGHT, "Height", nudge, 2600, reduce, Modifier.weight(1f, fill = false))
        }
    }
}

@Composable
private fun UnitToggle(imperial: Boolean, modifier: Modifier, onChange: (Boolean) -> Unit) {
    BoxWithConstraints(
        modifier = modifier
            .fillMaxWidth().height(48.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(Panel)
            .border(1.dp, Color(0xFF1D1D1D), RoundedCornerShape(18.dp))
            .padding(5.dp),
    ) {
        val half = maxWidth / 2
        val thumbX by animateDpAsState(if (imperial) half else 0.dp, spring(dampingRatio = 0.6f, stiffness = 380f), label = "unitThumb")
        Box(
            Modifier.offset(x = thumbX).width(half).fillMaxSize()
                .clip(RoundedCornerShape(14.dp)).background(RuvoColors.lime),
        )
        Row(Modifier.fillMaxSize()) {
            listOf(false to "Metric (kg/cm)", true to "Imperial (lb/in)").forEach { (imp, label) ->
                val on = imp == imperial
                val fg by animateColorAsState(if (on) OnLime else RuvoColors.textSecondary, tween(250), label = "unitFg")
                Box(
                    Modifier.weight(1f).fillMaxSize().clip(RoundedCornerShape(14.dp))
                        .clickable(onClickLabel = label) { if (!on) onChange(imp) }
                        .semantics { role = Role.RadioButton; selected = on },
                    contentAlignment = Alignment.Center,
                ) { Text(label, color = fg, fontSize = 13.5.sp, fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold) }
            }
        }
    }
}

@Composable
private fun MeasureCard(state: BioState, m: Measure, title: String, nudge: Int, hintDelayMs: Long, reduce: Boolean, modifier: Modifier = Modifier) {
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current
    val imperial = state.imperial
    val c = remember(m, imperial) { rulerCfg(m, imperial) }
    val isSet = if (m == Measure.WEIGHT) state.weightSet else state.heightSet
    val isSetNow by rememberUpdatedState(isSet)
    val rv = remember(m, state.unit, state.resetKey) { Animatable(state.display(m).toFloat()) }

    var grabbing by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }
    var interacting by remember { mutableStateOf(false) }
    var warn by remember { mutableStateOf(false) }
    var bigBounds by remember { mutableStateOf(Rect.Zero) }
    val shake = remember { Animatable(0f) }
    val v = rv.value.coerceIn(c.min.toFloat(), c.max.toFloat()).roundToInt()

    fun markSet() {
        if (isSetNow) return
        if (m == Measure.WEIGHT) state.weightSet = true else state.heightSet = true
        state.commit(m, rv.value.roundToInt().coerceIn(c.min, c.max))
    }

    // Keep the canonical value in step with the ruler once the user has set it.
    LaunchedEffect(v, isSet) { if (isSet) state.commit(m, v) }
    var hapticReady by remember { mutableStateOf(false) }
    LaunchedEffect(v) {
        if (hapticReady) haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        hapticReady = true
    }
    LaunchedEffect(isSet) { if (isSet) warn = false }

    // Continue tapped too early: nudge the first ruler that is still unset.
    val nudgeTarget = if (!state.weightSet) Measure.WEIGHT else Measure.HEIGHT
    LaunchedEffect(nudge) {
        if (nudge > 0 && m == nudgeTarget && !isSetNow) {
            warn = true
            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
            if (!reduce) for (t in listOf(-7f, 6f, -4f, 0f)) shake.animateTo(t, tween(80))
        }
    }

    // First-use nudge: the ruler wiggles once (it does not set the value).
    LaunchedEffect(Unit) {
        val hinted = if (m == Measure.WEIGHT) state.weightHinted else state.heightHinted
        if (reduce || hinted || isSetNow) return@LaunchedEffect
        if (m == Measure.WEIGHT) state.weightHinted = true else state.heightHinted = true
        delay(hintDelayMs)
        val base = rv.value.roundToInt()
        for (t in listOf(base + 5, base - 5, base)) {
            if (interacting || isSetNow) break
            rv.animateTo(t.toFloat(), tween(460, easing = RuvoMotion.EaseOut))
            delay(60)
        }
    }

    // ---- typing an exact value ----
    val impH = m == Measure.HEIGHT && imperial
    var t1 by remember { mutableStateOf(TextFieldValue("")) }
    var t2 by remember { mutableStateOf(TextFieldValue("")) }
    var gotFocus by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }

    fun startEdit() {
        if (editing) return
        interacting = true
        scope.launch { rv.stop() }
        val cur = rv.value.roundToInt().coerceIn(c.min, c.max)
        val a = if (impH) "${cur / 12}" else "$cur"
        t1 = TextFieldValue(a, TextRange(0, a.length))
        t2 = TextFieldValue("${cur % 12}")
        gotFocus = false
        editing = true
    }

    fun finish(apply: Boolean) {
        if (!editing) return
        editing = false; gotFocus = false
        focusManager.clearFocus()
        if (!apply) return
        val value = if (impH) t1.text.toIntOrNull()?.let { it * 12 + (t2.text.toIntOrNull() ?: 0) } else t1.text.toIntOrNull()
        if (value != null) {
            val target = value.coerceIn(c.min, c.max)
            markSet()
            scope.launch { rv.animateTo(target.toFloat(), tween(300, easing = RuvoMotion.EaseOut)) }
            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        }
    }
    LaunchedEffect(editing) { if (editing) { delay(40); runCatching { focus.requestFocus() } } }

    val borderColor by animateColorAsState(if (grabbing) RuvoColors.lime.copy(alpha = 0.45f) else Color(0xFF222222), tween(250), label = "cardBorder")

    Column(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(max = 220.dp)
            .offset(x = shake.value.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.verticalGradient(listOf(Color(0xFF151515), Color(0xFF0E0E0E))))
            .border(1.5.dp, borderColor, RoundedCornerShape(24.dp))
            .pointerInput(c) {
                val ppu = c.ppu.dp.toPx()
                val slop = 3.dp.toPx()
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    if (editing) return@awaitEachGesture
                    interacting = true; grabbing = true
                    scope.launch { rv.stop() }
                    val v0 = rv.value
                    val tracker = VelocityTracker()
                    tracker.addPosition(down.uptimeMillis, down.position)
                    var moved = 0f
                    val done = drag(down.id) { ch ->
                        tracker.addPosition(ch.uptimeMillis, ch.position)
                        val dx = ch.position.x - down.position.x
                        moved = max(moved, abs(dx))
                        var p = v0 - dx / ppu
                        if (p < c.min) p = c.min + (p - c.min) * 0.35f            // rubber-band at the ends
                        if (p > c.max) p = c.max + (p - c.max) * 0.35f
                        ch.consume()
                        if (moved > 2.dp.toPx()) markSet()
                        scope.launch { rv.snapTo(p) }
                    }
                    grabbing = false
                    if (!done) return@awaitEachGesture
                    if (moved < slop) {
                        if (bigBounds.contains(down.position)) startEdit()           // a tap on the number opens the keypad
                        return@awaitEachGesture
                    }
                    val vel = tracker.calculateVelocity().x / density                // dp/s
                    val target = (rv.value - vel * 0.26f / c.ppu).roundToInt().coerceIn(c.min, c.max)
                    scope.launch { rv.animateTo(target.toFloat(), tween(420, easing = RuvoMotion.EaseOut)) }
                }
            },
        verticalArrangement = Arrangement.Center,
    ) {
        Spacer(Modifier.height(12.dp))
        // header
        Row(
            modifier = Modifier.fillMaxWidth().height(26.dp).padding(horizontal = 18.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title.uppercase(), color = Muted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp)
                Box(
                    Modifier.padding(start = 2.dp).size(26.dp).clip(CircleShape)
                        .clickable(onClickLabel = "Type your ${title.lowercase()}") { startEdit() }
                        .semantics { contentDescription = "Type your ${title.lowercase()}" },
                    contentAlignment = Alignment.Center,
                ) { StrokeIcon(BioIcons.edit, 15.dp, Muted, strokeWidth = 1.8f) }
            }
            when {
                isSet -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    StrokeIcon(BioIcons.tick, 13.dp, RuvoColors.lime, strokeWidth = 2.6f)
                    Text("Set", color = RuvoColors.lime, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }
                warn -> Text("Set your ${title.lowercase()} to continue", color = RuvoColors.lime, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            }
        }

        // big number (or the inputs while typing)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .onGloballyPositioned { bigBounds = it.boundsInParent() }
                .onFocusChanged { f ->
                    if (editing) { if (f.hasFocus) gotFocus = true else if (gotFocus) finish(true) }
                }
                .alpha(if (isSet || editing) 1f else 0.4f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            if (editing) {
                val style = TextStyle(color = RuvoColors.lime, fontSize = 46.sp, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center)
                val done = KeyboardActions(onDone = { finish(true) })
                if (impH) {
                    EditField(t1, { t1 = it.copy(text = it.text.filter(Char::isDigit).take(1)) }, style, 34.dp, ImeAction.Next, KeyboardActions(onNext = { }), Modifier.focusRequester(focus), "Feet")
                    Text("ft", color = RuvoColors.lime.copy(alpha = 0.8f), fontSize = 20.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 6.dp))
                    EditField(t2, { t2 = it.copy(text = it.text.filter(Char::isDigit).take(2)) }, style, 62.dp, ImeAction.Done, done, Modifier, "Inches")
                    Text("in", color = RuvoColors.lime.copy(alpha = 0.8f), fontSize = 20.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 6.dp))
                } else {
                    EditField(t1, { t1 = it.copy(text = it.text.filter(Char::isDigit).take(3)) }, style, 96.dp, ImeAction.Done, done, Modifier.focusRequester(focus), title)
                    Text(unitLabel(m, imperial), color = RuvoColors.lime.copy(alpha = 0.8f), fontSize = 20.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 6.dp))
                }
            } else {
                BigValue(m, imperial, v)
            }
        }

        // alternative-unit hint
        Text(
            altText(m, imperial, v),
            modifier = Modifier.fillMaxWidth().height(16.dp),
            textAlign = TextAlign.Center, color = Muted, fontSize = 12.sp, lineHeight = 16.sp,
        )

        Ruler(rv, c, m, imperial, title, v) { target ->
            interacting = true; markSet()
            scope.launch { rv.animateTo(target.toFloat(), tween(220, easing = RuvoMotion.EaseOut)) }
        }
        Spacer(Modifier.height(8.dp))
    }
}

private fun unitLabel(m: Measure, imperial: Boolean) = when (m) {
    Measure.WEIGHT -> if (imperial) "lb" else "kg"
    Measure.HEIGHT -> if (imperial) "in" else "cm"
}

private fun spoken(m: Measure, imperial: Boolean, v: Int) =
    if (m == Measure.HEIGHT && imperial) "${v / 12} feet ${v % 12} inches" else "$v ${unitLabel(m, imperial)}"

private fun altText(m: Measure, imperial: Boolean, v: Int): String = when (m) {
    Measure.WEIGHT -> if (!imperial) "≈ ${(v * LB).roundToInt()} lb" else "≈ ${(v / LB).roundToInt()} kg"
    Measure.HEIGHT -> if (!imperial) {
        val t = (v / INCH).roundToInt(); "≈ ${t / 12}′ ${t % 12}″"
    } else "≈ ${(v * INCH).roundToInt()} cm"
}

@Composable
private fun BigValue(m: Measure, imperial: Boolean, v: Int) {
    Row(verticalAlignment = Alignment.Bottom) {
        if (m == Measure.HEIGHT && imperial) {
            BigNumber("${v / 12}"); BigUnit("ft"); BigNumber("${v % 12}"); BigUnit("in")
        } else {
            BigNumber("$v"); BigUnit(unitLabel(m, imperial))
        }
    }
}

@Composable
private fun BigNumber(text: String) =
    Text(text, color = RuvoColors.lime, fontSize = 46.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.9).sp)

@Composable
private fun BigUnit(text: String) =
    Text(text, color = RuvoColors.lime.copy(alpha = 0.8f), fontSize = 20.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 2.dp, end = 6.dp))

@Composable
private fun EditField(
    value: TextFieldValue, onValueChange: (TextFieldValue) -> Unit, style: TextStyle, width: Dp,
    ime: ImeAction, actions: KeyboardActions, modifier: Modifier, description: String,
) {
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        textStyle = style,
        singleLine = true,
        cursorBrush = SolidColor(RuvoColors.lime),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ime),
        keyboardActions = actions,
        modifier = modifier
            .width(width)
            .drawBehind {
                drawLine(RuvoColors.lime, Offset(0f, size.height - 4.dp.toPx()), Offset(size.width, size.height - 4.dp.toPx()), strokeWidth = 2.dp.toPx())
            }
            .semantics { contentDescription = description },
    )
}

/** Ruler in the same style as the step 2 ruler: a needle over a scrolling scale, labels under it. */
@Composable
private fun Ruler(rv: Animatable<Float, *>, c: RulerCfg, m: Measure, imperial: Boolean, title: String, v: Int, onKey: (Int) -> Unit) {
    val measurer = rememberTextMeasurer()
    val pad = 16
    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 2.dp)
            .height(74.dp)
            .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
            .drawWithContent {
                drawContent()
                drawRect(
                    Brush.horizontalGradient(0f to Color.Transparent, 0.09f to Color.Black, 0.91f to Color.Black, 1f to Color.Transparent),
                    blendMode = BlendMode.DstIn,
                )
            }
            .semantics {
                contentDescription = title
                stateDescription = spoken(m, imperial, v)
                progressBarRangeInfo = ProgressBarRangeInfo(v.toFloat(), c.min.toFloat()..c.max.toFloat())
                setProgress { target -> onKey(target.roundToInt().coerceIn(c.min, c.max)); true }
            },
    ) {
        val ppu = c.ppu.dp.toPx()
        val cx = size.width / 2f
        val base = size.height - 34.dp.toPx()
        val cur = rv.value
        val lo = max(c.min - pad, floor(cur - cx / ppu - 2).toInt())
        val hi = kotlin.math.min(c.max + pad, ceil(cur + cx / ppu + 2).toInt())
        val labelStyle = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        for (u in lo..hi) {
            val inR = u in c.min..c.max
            val major = inR && u % c.major == 0
            val mid = inR && !major && u % c.mid == 0
            val h = (if (major) 26.dp else if (mid) 16.dp else 9.dp).toPx()
            val color = when {
                u == v -> RuvoColors.lime
                major -> Color(0xFF5A5A5A)
                mid -> Color(0xFF3B3B3B)
                else -> Color(0xFF333333)
            }
            val x = cx + (u - cur) * ppu
            drawRoundRect(color, Offset(x - 1.dp.toPx(), base - h), Size(2.dp.toPx(), h), CornerRadius(1.dp.toPx()))
            if (inR && u % c.lab == 0) {
                val layout = measurer.measure(rulerLabel(m, imperial, u), labelStyle)
                val on = abs(u - v) < c.lab / 2f
                drawText(layout, color = if (on) Color.White else Muted, topLeft = Offset(x - layout.size.width / 2f, 44.dp.toPx()))
            }
        }
        // Needle with a soft glow
        drawRoundRect(RuvoColors.lime.copy(alpha = 0.25f), Offset(cx - 5.dp.toPx(), -2.dp.toPx()), Size(10.dp.toPx(), 46.dp.toPx()), CornerRadius(5.dp.toPx()))
        drawRoundRect(RuvoColors.lime, Offset(cx - 1.5.dp.toPx(), 0f), Size(3.dp.toPx(), 42.dp.toPx()), CornerRadius(1.5.dp.toPx()))
    }
}
