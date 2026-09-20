package com.ruvo.app.features.auth

import android.provider.Settings
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.FastOutLinearInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.drag
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.ruvo.app.core.model.RunningGoal
import com.ruvo.app.designsystem.theme.RuvoColors
import com.ruvo.app.designsystem.theme.RuvoMotion
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

// Onboarding step 1: a swipeable stack of goal cards -- native port of the
// approved "Ruvo Onboarding: Goal" web design.
//
//  * Swipe the top card left to send it to the back, right to bring the
//    previous one back. Tap it (or flick it up) to choose it; tap again to
//    un-choose. The surrounding screen's Continue button stays disabled
//    until a goal is chosen.
//  * Each goal has its own accent color that tints the card and the glow
//    behind the deck; the chosen card turns brand lime.
//  * The plan line is deliberately generic: this app has no fixed plan length
//    per goal (the plan generator lets the user pick 4-24 weeks), so the
//    design's sample "8 weeks, 3 runs a week" copy is not shown as fact.

private data class DeckGoal(
    val goal: RunningGoal,
    val chip: String,
    val note: String,
    val accent: Color,
    val icon: List<String>,
)

// Icons: Hugeicons (free set, MIT), 24x24 stroke paths.
private object DeckIcons {
    val healthy = listOf(
        "M10.4107 19.9677C7.58942 17.858 2 13.0348 2 8.69444C2 5.82563 4.10526 3.5 7 3.5C8.5 3.5 10 4 12 6C14 4 15.5 3.5 17 3.5C19.8947 3.5 22 5.82563 22 8.69444C22 13.0348 16.4106 17.858 13.5893 19.9677C12.6399 20.6776 11.3601 20.6776 10.4107 19.9677Z",
        "M20.001 13.0001H16.0288C15.8168 13.0001 15.7107 13.0001 15.619 12.9639C15.5691 12.9442 15.5229 12.9169 15.4821 12.8831C15.4072 12.8209 15.3598 12.7303 15.2649 12.5491C14.9921 12.0278 14.8557 11.7672 14.6597 11.7045C14.5567 11.6716 14.4453 11.6716 14.3422 11.7045C14.1462 11.7672 14.0098 12.0278 13.737 12.5491L13.1172 13.7335C12.6442 14.6372 12.4078 15.089 12.0706 15.0624C11.7335 15.0357 11.578 14.5529 11.267 13.5872L10.8024 12.1447C10.4668 11.1027 10.299 10.5817 9.95039 10.5639C9.60176 10.5462 9.377 11.0472 8.92748 12.0493L8.76073 12.4211C8.63475 12.7019 8.57176 12.8423 8.44652 12.9212C8.32129 13.0001 8.16139 13.0001 7.84158 13.0001H4.00098",
    )
    val run5k = listOf(
        "M12.4059 18.9923C13.4443 19.7399 13.9635 20.1137 14.5623 20.3069C15.1611 20.5 15.8008 20.5 17.0804 20.5H19C20.4142 20.5 21.1213 20.5 21.5607 20.0607C22 19.6213 22 18.9142 22 17.5H16.7902C16.1504 17.5 15.8305 17.5 15.5311 17.4034C15.2318 17.3069 14.9722 17.12 14.453 16.7461L3 8.5L2.30911 9.53634C2.10755 9.83867 2 10.1939 2 10.5572C2 11.1492 2.2847 11.705 2.76507 12.0509L12.4059 18.9923Z",
        "M3 8.5L6 3.5L6.30704 5.34226C6.42827 6.06965 6.89023 6.69511 7.5498 7.0249C8.64393 7.57197 9.97486 7.16899 10.5818 6.10689L11.1396 5.13069C11.3625 4.74069 11.7772 4.5 12.2264 4.5C12.7005 4.5 13.1339 4.76787 13.346 5.19193L17.2764 13.0528C17.4134 13.3269 17.6936 13.5 18 13.5C20.2091 13.5 22 15.2909 22 17.5",
        "M12.5 9.5L14.5 8.5",
        "M14 12L16 11",
        "M6 20.5H18",
        "M2 17.5H5",
    )
    val run10k = listOf(
        "M13.8561 22C26.0783 19 19.2338 7 10.9227 2C9.9453 5.5 8.47838 6.5 5.54497 10C1.66121 14.6339 3.5895 20 8.96719 22C8.1524 21 6.04958 18.9008 7.5 16C8 15 9 14 8.5 12C9.47778 12.5 11.5 13 12 15.5C12.8148 14.5 13.6604 12.4 12.8783 10C19 14.5 16.5 19 13.8561 22Z",
    )
    val half = listOf(
        "M5.22576 11.3294L12.224 2.34651C12.7713 1.64397 13.7972 2.08124 13.7972 3.01707V9.96994C13.7972 10.5305 14.1995 10.985 14.6958 10.985H18.0996C18.8729 10.985 19.2851 12.0149 18.7742 12.6706L11.776 21.6535C11.2287 22.356 10.2028 21.9188 10.2028 20.9829V14.0301C10.2028 13.4695 9.80048 13.015 9.3042 13.015H5.90035C5.12711 13.015 4.71494 11.9851 5.22576 11.3294Z",
    )
    val full = listOf(
        "M12 15V19",
        "M7 5H5.58088C5.03886 5 4.76785 5 4.55944 5.10228C4.36064 5.19984 4.19984 5.36064 4.10228 5.55944C4 5.76785 4 6.03886 4 6.58088C4 7.6579 4 8.19641 4.16249 8.66982C4.31812 9.12325 4.58015 9.53278 4.92663 9.8641C5.28837 10.21 5.77732 10.4357 6.7552 10.887L7 11",
        "M17 5H18.4191C18.9611 5 19.2322 5 19.4406 5.10228C19.6394 5.19984 19.8002 5.36064 19.8977 5.55944C20 5.76785 20 6.03886 20 6.58088C20 7.6579 20 8.19641 19.8375 8.66982C19.6819 9.12325 19.4198 9.53278 19.0734 9.8641C18.7116 10.21 18.2227 10.4357 17.2448 10.887L17 11",
        "M7 4.88889C7 4.06119 7 3.64735 7.12061 3.31596C7.32281 2.76043 7.76043 2.32281 8.31596 2.12061C8.64735 2 9.06119 2 9.88889 2H14.1111C14.9388 2 15.3527 2 15.684 2.12061C16.2396 2.32281 16.6772 2.76043 16.8794 3.31596C17 3.64735 17 4.06119 17 4.88889V10C17 12.7614 14.7614 15 12 15C9.23858 15 7 12.7614 7 10V4.88889Z",
        "M8 22C8 21.0681 8 20.6022 8.15224 20.2346C8.35523 19.7446 8.74458 19.3552 9.23463 19.1522C9.60218 19 10.0681 19 11 19H13C13.9319 19 14.3978 19 14.7654 19.1522C15.2554 19.3552 15.6448 19.7446 15.8478 20.2346C16 20.6022 16 21.0681 16 22H8Z",
    )
    val lose = listOf(
        "M15.1312 2.5C14.1462 2.17555 13.0936 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 10.9548 21.8396 9.94704 21.5422 9",
        "M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7",
        "M19.5 4.5L12 12M19.5 4.5V2M19.5 4.5H22",
    )
    val calendar = listOf(
        "M16 2V6M8 2V6",
        "M13 4H11C7.22876 4 5.34315 4 4.17157 5.17157C3 6.34315 3 8.22876 3 12V14C3 17.7712 3 19.6569 4.17157 20.8284C5.34315 22 7.22876 22 11 22H13C16.7712 22 18.6569 22 19.8284 20.8284C21 19.6569 21 17.7712 21 14V12C21 8.22876 21 6.34315 19.8284 5.17157C18.6569 4 16.7712 4 13 4Z",
        "M3 10H21",
        "M12.1258 14H12.0008M12.1258 18H12.0008M7.625 14H7.5M7.625 18H7.5M16.625 14H16.5",
    )
    val tick = listOf("M5 14L8.5 17.5L19 6.5")
}

private val DECK_GOALS = listOf(
    DeckGoal(RunningGoal.STAY_HEALTHY, "Any pace", "Build a weekly habit", Color(0xFF4ADE80), DeckIcons.healthy),
    DeckGoal(RunningGoal.RUN_5K, "5 km", "Your first 5 kilometers", Color(0xFF38BDF8), DeckIcons.run5k),
    DeckGoal(RunningGoal.RUN_10K, "10 km", "Build speed and stamina", Color(0xFFFB923C), DeckIcons.run10k),
    DeckGoal(RunningGoal.HALF_MARATHON, "21.1 km", "Train step by step", Color(0xFFA78BFA), DeckIcons.half),
    DeckGoal(RunningGoal.MARATHON, "42.2 km", "The big one", Color(0xFFFACC15), DeckIcons.full),
    DeckGoal(RunningGoal.LOSE_WEIGHT, "Weekly runs", "Burn more, run by run", Color(0xFFFB7185), DeckIcons.lose),
)

private const val PLAN_LINE = "Plan built around your week"
private val Ink = Color(0xFFF5EFE9)
private val CardDark = Color(0xFF0E0E0E)
private val OnLime = Color(0xFF121212)
private val OnLimeMuted = Color(0xFF33400A)
private val StackOffset = 9.dp
private val SwipeDistance = 50.dp
private val LiftDistance = 64.dp
private const val SwipeVelocityDpPerSec = 500f

@Composable
private fun StrokeIcon(paths: List<String>, size: Dp, color: Color, strokeWidth: Float = 1.5f, modifier: Modifier = Modifier) {
    val parsed = remember(paths) { paths.map { PathParser().parsePathString(it).toPath() } }
    Canvas(modifier.size(size)) {
        val s = this.size.width / 24f
        scale(scaleX = s, scaleY = s, pivot = Offset.Zero) {
            parsed.forEach { drawPath(it, color, style = Stroke(width = strokeWidth, cap = StrokeCap.Round, join = StrokeJoin.Round)) }
        }
    }
}

@Stable
private class DeckState(
    val count: Int,
    private val scope: CoroutineScope,
    private val distPx: Float,
    private val settle: AnimationSpec<Float>,
    private val buzz: () -> Unit,
) {
    var active by mutableIntStateOf(0)
        private set
    var busy by mutableStateOf(false)
        private set

    val dragX = Animatable(0f)
    val lift = Animatable(0f)
    val slot = List(count) { Animatable(it.toFloat()) }
    val enterX = List(count) { Animatable(0f) }
    val fade = List(count) { Animatable(1f) }

    fun slotOf(i: Int, activeIdx: Int = active): Int = ((i - activeIdx) % count + count) % count

    fun settleBack() {
        scope.launch { dragX.animateTo(0f, settle) }
        scope.launch { lift.animateTo(0f, settle) }
    }

    /** Top card is thrown off to the left, then the stack moves up. */
    fun next() {
        if (busy) return
        busy = true; buzz()
        scope.launch {
            val top = active
            val newActive = (active + 1) % count
            coroutineScope {
                launch { dragX.animateTo(-distPx, tween(260, easing = FastOutLinearInEasing)) }
                launch { fade[top].animateTo(0f, tween(260)) }
            }
            dragX.snapTo(0f); lift.snapTo(0f)
            slot[top].snapTo(slotOf(top, newActive).toFloat())   // sends it to the back, still invisible
            active = newActive
            fade[top].snapTo(1f)
            for (k in 0 until count) if (k != top) launch { slot[k].animateTo(slotOf(k).toFloat(), settle) }
            busy = false
        }
    }

    /** The previous card slides back in from the left over the stack. */
    fun prev() {
        if (busy) return
        busy = true; buzz()
        scope.launch {
            val incoming = (active - 1 + count) % count
            enterX[incoming].snapTo(-distPx)
            fade[incoming].snapTo(0f)
            slot[incoming].snapTo(0f)
            dragX.snapTo(0f); lift.snapTo(0f)
            active = incoming
            launch { enterX[incoming].animateTo(0f, settle) }
            launch { fade[incoming].animateTo(1f, tween(200)) }
            for (k in 0 until count) if (k != incoming) launch { slot[k].animateTo(slotOf(k).toFloat(), settle) }
            delay(300)
            busy = false
        }
    }

    fun goTo(i: Int) {
        if (i == active || busy) return
        buzz()
        active = i
        scope.launch {
            dragX.snapTo(0f); lift.snapTo(0f)
            coroutineScope {
                for (k in 0 until count) launch { slot[k].animateTo(slotOf(k).toFloat(), settle) }
            }
        }
    }
}

@Composable
internal fun GoalStep(selectedGoal: RunningGoal?, onSelect: (RunningGoal?) -> Unit) {
    val context = LocalContext.current
    val reduce = remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
    val dens = LocalDensity.current
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()

    val settle = remember(reduce) {
        if (reduce) snap<Float>() else spring<Float>(dampingRatio = 0.75f, stiffness = 260f)
    }
    val distPx = with(dens) { 420.dp.toPx() }
    val state = remember {
        DeckState(DECK_GOALS.size, scope, distPx, settle) { haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove) }
    }
    val intro = remember { List(DECK_GOALS.size) { Animatable(if (reduce) 1f else 0f) } }
    LaunchedEffect(Unit) {
        if (!reduce) DECK_GOALS.indices.forEach { i -> launch { delay(i * 70L); intro[i].animateTo(1f, RuvoMotion.easeOut(600)) } }
    }

    val selectedNow by rememberUpdatedState(selectedGoal)
    val onSelectNow by rememberUpdatedState(onSelect)
    var burstKey by remember { mutableIntStateOf(0) }

    fun choose(i: Int) {
        val g = DECK_GOALS[i].goal
        val newSel = if (selectedNow == g) null else g
        onSelectNow(newSel)
        if (newSel != null) burstKey++
        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
    }

    val activeGoal = DECK_GOALS[state.active]
    val topChosen = selectedGoal == activeGoal.goal
    val glowColor by animateColorAsState(
        if (topChosen) RuvoColors.lime else activeGoal.accent,
        animationSpec = RuvoMotion.easeOut(700),
        label = "deckGlow",
    )
    val glowStrength by animateFloatAsState(if (selectedGoal != null) 1.1f else 1f, RuvoMotion.easeOut(500), label = "deckGlowScale")

    Column(modifier = Modifier.fillMaxSize()) {
        Column {
            Text("What's your goal?", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)
            Text("We'll personalize your training plan", style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary)
        }

        BoxWithConstraints(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .drawBehind {
                    val r = 280.dp.toPx() * glowStrength
                    drawCircle(
                        brush = Brush.radialGradient(
                            colors = listOf(glowColor.copy(alpha = 0.17f), Color.Transparent),
                            center = Offset(size.width / 2f, size.height * 0.52f),
                            radius = r,
                        ),
                        radius = r,
                        center = Offset(size.width / 2f, size.height * 0.52f),
                    )
                }
                .semantics {
                    contentDescription = "Goal ${activeGoal.goal.label}, ${DECK_GOALS.indexOf(activeGoal) + 1} of ${DECK_GOALS.size}"
                    role = Role.RadioButton
                    selected = topChosen
                    onClick(label = if (topChosen) "Unselect goal" else "Choose goal") { choose(state.active); true }
                    customActions = listOf(
                        CustomAccessibilityAction("Next goal") { state.next(); true },
                        CustomAccessibilityAction("Previous goal") { state.prev(); true },
                    )
                }
                .pointerInput(Unit) {
                    val slop = 7.dp.toPx()
                    val swipe = SwipeDistance.toPx()
                    val liftMin = LiftDistance.toPx()
                    val velMin = SwipeVelocityDpPerSec * density
                    awaitEachGesture {
                        val down = awaitFirstDown(requireUnconsumed = false)
                        if (state.busy) {
                            drag(down.id) { }
                            return@awaitEachGesture
                        }
                        val tracker = VelocityTracker()
                        tracker.addPosition(down.uptimeMillis, down.position)
                        var axis = 0            // 0 undecided, 1 horizontal, 2 vertical
                        var mx = 0f
                        var my = 0f
                        var moved = 0f
                        val completed = drag(down.id) { change ->
                            tracker.addPosition(change.uptimeMillis, change.position)
                            mx = change.position.x - down.position.x
                            my = change.position.y - down.position.y
                            moved = max(moved, hypot(mx, my))
                            if (axis == 0 && moved > slop) axis = if (abs(mx) >= abs(my)) 1 else 2
                            if (axis == 1) {
                                change.consume()
                                scope.launch { state.dragX.snapTo(mx) }
                            } else if (axis == 2) {
                                change.consume()
                                scope.launch { state.lift.snapTo(if (my < 0) my * 0.9f else my * 0.15f) }
                            }
                        }
                        if (!completed) {
                            state.settleBack()
                            return@awaitEachGesture
                        }
                        val vx = tracker.calculateVelocity().x
                        when (axis) {
                            1 -> when {
                                mx < -swipe || vx < -velMin -> state.next()
                                mx > swipe || vx > velMin -> state.prev()
                                else -> state.settleBack()
                            }
                            2 -> {
                                val wasLift = state.lift.value
                                state.settleBack()
                                if (wasLift < -liftMin) choose(state.active)
                            }
                            else -> {
                                // A tap: on the top card it chooses, on the peeking cards behind it moves on.
                                val cx = size.width / 2f - 13.dp.toPx()
                                val cy = size.height / 2f - 13.dp.toPx()
                                val halfH = min(330.dp.toPx(), size.height - 24.dp.toPx()) / 2f
                                val halfW = halfH * (252f / 330f)
                                val onTop = abs(down.position.x - cx) <= halfW && abs(down.position.y - cy) <= halfH
                                if (onTop) choose(state.active) else state.goTo((state.active + 1) % state.count)
                            }
                        }
                    }
                },
        ) {
            val cardH = minOf(330.dp, maxHeight - 24.dp)
            val cardW = cardH * (252f / 330f)

            DECK_GOALS.forEachIndexed { i, dg ->
                GoalCard(
                    goal = dg,
                    state = state,
                    index = i,
                    cardW = cardW,
                    cardH = cardH,
                    chosen = selectedGoal == dg.goal,
                    introProgress = intro[i].value,
                    burstKey = if (selectedGoal == dg.goal) burstKey else 0,
                    modifier = Modifier.align(Alignment.Center),
                )
            }
        }

        Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.height(24.dp)) {
                DECK_GOALS.forEachIndexed { i, dg ->
                    val on = i == state.active
                    val w by animateFloatAsState(if (on) 22f else 6f, RuvoMotion.easeOut(350), label = "dotWidth")
                    Box(
                        modifier = Modifier
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null,
                                onClickLabel = "Go to ${dg.goal.label}",
                            ) { state.goTo(i) }
                            .padding(horizontal = 4.dp, vertical = 9.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .width(w.dp)
                                .height(6.dp)
                                .background(if (on) RuvoColors.lime else Color(0xFF333333), CircleShape),
                        )
                    }
                }
            }
            Spacer(Modifier.height(6.dp))
            Text(
                text = selectedGoal?.let { "Chosen: ${it.label}" } ?: "Swipe to browse, tap to choose",
                color = RuvoColors.textTertiary,
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun GoalCard(
    goal: DeckGoal,
    state: DeckState,
    index: Int,
    cardW: Dp,
    cardH: Dp,
    chosen: Boolean,
    introProgress: Float,
    burstKey: Int,
    modifier: Modifier = Modifier,
) {
    val d = LocalDensity.current.density
    val p = state.slot[index].value
    val isTop = state.active == index
    val t by animateFloatAsState(if (chosen) 1f else 0f, RuvoMotion.easeOut(400), label = "cardChosen")
    val accent = goal.accent
    val shape = RoundedCornerShape(32.dp)

    val tintStart = lerp(Color(0xFF1B1B1B), accent, 0.17f)
    val bgStart = lerp(tintStart, RuvoColors.lime, t)
    val bgEnd = lerp(CardDark, RuvoColors.limeGradientEnd, t)
    val baseBorder = if (isTop) accent else lerp(Color(0xFF2A2A2A), accent, 0.26f)
    val border = lerp(baseBorder, RuvoColors.lime, t)
    val titleColor = lerp(Ink, OnLime, t)
    val noteColor = lerp(RuvoColors.textSecondary, OnLimeMuted, t)
    val accentOnCard = lerp(accent, OnLime, t)

    val visibility = if (p <= 3f) 1f else (1f - (p - 3f) * 2f).coerceIn(0f, 1f)
    val alpha = (state.fade[index].value * visibility * introProgress).coerceIn(0f, 1f)
    val dark = min(p, 3f) * 0.16f

    Box(
        modifier = modifier
            .zIndex(100f - p)
            .size(cardW, cardH)
            .graphicsLayer {
                val stack = p * StackOffset.toPx() - 13.dp.toPx()
                val dragX = if (isTop) state.dragX.value else 0f
                val lift = if (isTop) state.lift.value else 0f
                translationX = stack + dragX + state.enterX[index].value
                translationY = stack + lift + (1f - introProgress) * 70.dp.toPx()
                rotationZ = (p - 1f) * 1.3f + dragX / d / 18f
                var sc = 1f - p * 0.045f
                if (isTop) {
                    sc += 0.04f * t
                    if (dragX != 0f || lift != 0f) sc = max(sc, 1.02f)
                }
                val intro = 0.82f + 0.18f * introProgress
                scaleX = sc * intro
                scaleY = sc * intro
                this.alpha = alpha
                transformOrigin = TransformOrigin(0.5f, 0.6f)
            }
            .then(
                if (isTop && alpha > 0.5f) {
                    Modifier.shadow(
                        elevation = 18.dp, shape = shape, clip = false,
                        ambientColor = lerp(accent, RuvoColors.lime, t), spotColor = lerp(accent, RuvoColors.lime, t),
                    )
                } else Modifier
            )
            .background(
                Brush.linearGradient(
                    colorStops = arrayOf(0f to bgStart, 0.74f to bgEnd, 1f to bgEnd),
                    start = Offset(cardW.value * d * 0.35f, 0f),
                    end = Offset(cardW.value * d * 0.65f, cardH.value * d),
                ),
                shape,
            )
            .border(1.5.dp, border, shape),
    ) {
        Column(modifier = Modifier.fillMaxSize().padding(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 18.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth().height(30.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    goal.chip,
                    color = lerp(accent, Color(0xFF26300A), t),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .background(lerp(accent.copy(alpha = 0.16f), Color.Black.copy(alpha = 0.12f), t), CircleShape)
                        .padding(horizontal = 12.dp, vertical = 5.dp),
                )
                CheckBadge(chosen = chosen, burstKey = burstKey)
            }

            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                val iconBg = lerp(accent.copy(alpha = 0.24f), Color.White.copy(alpha = 0.38f), t)
                Box(
                    modifier = Modifier
                        .size(108.dp)
                        .background(Brush.radialGradient(listOf(iconBg, iconBg.copy(alpha = 0f))), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    StrokeIcon(
                        goal.icon, 58.dp, accentOnCard, strokeWidth = 1.4f,
                        modifier = Modifier.graphicsLayer {
                            translationX = if (isTop) -state.dragX.value * 0.12f else 0f
                            translationY = if (isTop) -state.lift.value * 0.12f else 0f
                        },
                    )
                }
            }

            Text(goal.goal.label, color = titleColor, fontSize = 24.sp, lineHeight = 30.sp, fontWeight = FontWeight.Bold, maxLines = 1)
            Text(goal.note, color = noteColor, fontSize = 13.sp, lineHeight = 19.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)

            Spacer(Modifier.height(10.dp))
            Box(Modifier.fillMaxWidth().height(1.dp).background(lerp(Color.White.copy(alpha = 0.09f), Color.Black.copy(alpha = 0.16f), t)))
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                StrokeIcon(DeckIcons.calendar, 14.dp, accentOnCard, strokeWidth = 1.8f)
                Text(PLAN_LINE, color = titleColor, fontSize = 12.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }

            Spacer(Modifier.height(12.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(34.dp)
                    .graphicsLayer { this.alpha = if (isTop) 1f else 0f }
                    .background(lerp(accent.copy(alpha = 0.12f), Color.Black.copy(alpha = 0.14f), t), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    if (chosen) "Chosen" else "Tap to choose",
                    color = accentOnCard, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                )
            }
        }
        if (dark > 0f) Box(Modifier.matchParentSize().background(Color.Black.copy(alpha = dark), shape))
    }
}

@Composable
private fun CheckBadge(chosen: Boolean, burstKey: Int) {
    val scaleIn by animateFloatAsState(
        if (chosen) 1f else 0.4f,
        spring(dampingRatio = 0.5f, stiffness = 500f),
        label = "checkScale",
    )
    val alphaIn by animateFloatAsState(if (chosen) 1f else 0f, tween(200), label = "checkAlpha")
    val burst = remember { Animatable(1f) }
    LaunchedEffect(burstKey) {
        if (burstKey > 0) {
            burst.snapTo(0f)
            burst.animateTo(1f, RuvoMotion.easeOut(650))
        }
    }
    Box(modifier = Modifier.size(26.dp), contentAlignment = Alignment.Center) {
        Box(
            modifier = Modifier
                .size(26.dp)
                .graphicsLayer { scaleX = scaleIn; scaleY = scaleIn; alpha = alphaIn }
                .background(OnLime, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            StrokeIcon(DeckIcons.tick, 14.dp, RuvoColors.lime, strokeWidth = 2.6f)
        }
        Canvas(Modifier.size(26.dp)) {
            val prog = burst.value
            if (prog < 1f) {
                val c = Offset(size.width / 2f, size.height / 2f)
                for (k in 0 until 12) {
                    val a = k / 12f * 2f * PI.toFloat() + (k % 3) * 0.13f
                    val r = (34 + (k * 7) % 26).dp.toPx() * prog
                    drawCircle(
                        color = (if (k % 2 == 1) Color.White else RuvoColors.lime).copy(alpha = 1f - prog),
                        radius = 2.5.dp.toPx() * (1f - prog),
                        center = c + Offset(cos(a) * r, sin(a) * r),
                    )
                }
            }
        }
    }
}
