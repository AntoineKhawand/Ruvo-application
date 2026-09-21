package com.ruvo.app.features.auth

import android.provider.Settings
import android.view.TextureView
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.ruvo.app.core.model.FitnessLevel
import com.ruvo.app.designsystem.theme.RuvoColors
import com.ruvo.app.designsystem.theme.RuvoMotion
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin

// Onboarding step 2: fitness level -- native port of the approved "Ruvo Onboarding:
// Fitness Level" web design.
//
//  * A ruler (drag, tap a label, or use - / +) picks one of four levels. The level
//    drives a 3D anatomical heart: its resting pulse speeds up from calm to racing, its
//    glow, spark halo and accent colour intensify (Beginner green -> Elite red).
//  * "Not sure?" opens a two-question finder that suggests a level; it only moves the
//    ruler, the user still confirms with Continue.
//  * The pulse is animation only. It never claims to measure the user's heart rate.
//  * If the device can't create a GL context the heart falls back to a static icon.

private class LevelStyle(val level: FitnessLevel, val color: Color)

private val LEVELS = listOf(
    LevelStyle(FitnessLevel.BEGINNER, Color(0xFF4ADE80)),
    LevelStyle(FitnessLevel.INTERMEDIATE, Color(0xFFDFFF00)),
    LevelStyle(FitnessLevel.ADVANCED, Color(0xFFFB923C)),
    LevelStyle(FitnessLevel.ELITE, Color(0xFFFB7185)),
)

private const val N = 4
private val Sp = 100.dp                 // distance between levels on the ruler
private const val SUB = 8               // ticks per level
private const val BPM_LOW = 58f
private const val BPM_HIGH = 108f       // animation speed only
private val OnLime = Color(0xFF121212)
private val Muted = Color(0xFF7A7A85)

// Icons: Hugeicons (free set, MIT), 24x24 stroke paths.
private val ICON_PLUS = listOf("M12 4V20M20 12H4")
private val ICON_MINUS = listOf("M20 12L4 12")
private val ICON_HELP = listOf(
    "M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z",
    "M9.5 9.5C9.5 8.11929 10.6193 7 12 7C13.3807 7 14.5 8.11929 14.5 9.5C14.5 10.3569 14.0689 11.1131 13.4117 11.5636C12.7283 12.0319 12 12.6716 12 13.5",
    "M12.125 16.75H12",
)
private val ICON_HEART = listOf(
    "M10.4107 19.9677C7.58942 17.858 2 13.0348 2 8.69444C2 5.82563 4.10526 3.5 7 3.5C8.5 3.5 10 4 12 6C14 4 15.5 3.5 17 3.5C19.8947 3.5 22 5.82563 22 8.69444C22 13.0348 16.4106 17.858 13.5893 19.9677C12.6399 20.6776 11.3601 20.6776 10.4107 19.9677Z",
)

private fun clamp(v: Float, a: Float, b: Float) = min(b, max(a, v))

/** One heartbeat clock shared by the 3D heart and the ripples: eased tempo, soft lub-dub curve, no pops. */
private class PulseClock {
    var beats = 0.0
    var bpm = BPM_LOW
    var b = 0f
    var heat = 0f
    val col = floatArrayOf(0.29f, 0.87f, 0.5f)
    private var lastBeatId = 0L

    private fun bump(ph: Float, s: Float, w: Float): Float {
        val x = (ph - s) / w
        return if (x > 0f && x < 1f) sin(PI.toFloat() * x).pow(2) else 0f
    }

    private fun beatShape(ph: Float) = bump(ph, 0f, 0.26f) + 0.55f * bump(ph, 0.29f, 0.26f)

    /** Returns true on the frame a new beat starts (used to spawn a ripple). */
    fun advance(dt: Float, pos: Float, target: Color, reduce: Boolean): Boolean {
        heat = clamp(pos / (N - 1), 0f, 1f)
        val targetBpm = BPM_LOW + (BPM_HIGH - BPM_LOW) * heat
        bpm += (targetBpm - bpm) * (1f - exp(-dt * 2.2f))
        if (!reduce) beats += dt * bpm / 60.0
        val raw = if (reduce) 0f else beatShape((beats % 1.0).toFloat())
        b += (raw - b) * (1f - exp(-dt * 16f))
        val k = 1f - exp(-dt * 6f)
        col[0] += (target.red - col[0]) * k
        col[1] += (target.green - col[1]) * k
        col[2] += (target.blue - col[2]) * k
        val id = floor(beats - 0.13).toLong()
        return (id != lastBeatId).also { lastBeatId = id }
    }
}

private class Spark(val angle: Float, val r: Float, val y: Float)

/** Yaw/pitch of the heart plus drag inertia; plain fields, read every frame. */
private class RigState {
    var yaw = -0.25f
    var pitch = 0.06f
    var vYaw = 0f
    var dragging = false
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun LevelStep(selectedLevel: FitnessLevel?, onSelect: (FitnessLevel) -> Unit, heart: HeartHolder) {
    val context = LocalContext.current
    val reduce = remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current
    val spPx = with(density) { Sp.toPx() }

    val onSelectNow by rememberUpdatedState(onSelect)
    val start = selectedLevel?.ordinal ?: 0

    // pos: float level position. -1 is the intro (small heart), 0..3 the levels.
    val pos = remember { Animatable(if (reduce) start.toFloat() else -1f) }
    var idx by remember { mutableIntStateOf(start) }
    var busy by remember { mutableStateOf(false) }
    var suggested by remember { mutableStateOf(false) }

    val pulse = remember { PulseClock().also { it.col[0] = LEVELS[start].color.red; it.col[1] = LEVELS[start].color.green; it.col[2] = LEVELS[start].color.blue } }
    val rig = remember { RigState() }
    val ripples = remember { mutableStateListOf<Long>() }
    var frameNanos by remember { mutableLongStateOf(0L) }
    // The heart is loaded by OnboardingScreen during step 1; here we only attach it to a view.
    val renderer = heart.renderer
    val heartFailed = heart.failed
    var attached by remember { mutableStateOf(false) }
    val textureView = remember { TextureView(context) }
    val sparks = remember {
        val rnd = java.util.Random(7)
        List(170) {
            Spark(
                angle = rnd.nextFloat() * 2f * PI.toFloat(),
                r = 2f + rnd.nextFloat().toDouble().pow(1.6).toFloat() * 1f,
                y = (rnd.nextFloat() - 0.5f) * 4.2f,
            )
        }
    }

    val heartAlpha by animateFloatAsState(
        targetValue = if (attached) 1f else 0f,
        animationSpec = tween(if (reduce) 1 else 350, easing = RuvoMotion.EaseOut),
        label = "heartAlpha",
    )
    val lvlColor by animateColorAsState(LEVELS[idx].color, tween(if (reduce) 1 else 600), label = "levelColor")

    fun commit(i: Int) {
        val level = LEVELS[i].level
        onSelectNow(level)
    }

    fun goTo(i: Int, dur: Int = 460) {
        val target = i.coerceIn(0, N - 1)
        commit(target)
        scope.launch {
            if (reduce) pos.snapTo(target.toFloat())
            else pos.animateTo(target.toFloat(), tween(dur, easing = RuvoMotion.EaseOut))
        }
    }

    // Publish the initial level so Continue is enabled straight away, then play the intro.
    LaunchedEffect(Unit) {
        if (selectedLevel == null) commit(0)
        if (!reduce) {
            delay(150)
            pos.animateTo(start.toFloat(), tween(900, easing = RuvoMotion.EaseOut))
        }
    }

    // Track the rounded level for text/colour/haptics.
    LaunchedEffect(Unit) {
        var first = true
        androidx.compose.runtime.snapshotFlow { clamp(pos.value, 0f, (N - 1).toFloat()).roundToInt() }
            .collect {
                if (idx != it) {
                    idx = it
                    if (!first) haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                }
                first = false
            }
    }

    // Normally already loaded; if the user got here first, load it now.
    LaunchedEffect(Unit) { heart.load(context) }
    LaunchedEffect(renderer) {
        renderer?.attach(textureView)
        attached = renderer != null
    }
    DisposableEffect(renderer) {
        onDispose { renderer?.detach() }
    }

    // One frame loop drives the pulse, the ripples and the Filament renderer.
    LaunchedEffect(reduce) {
        var last = 0L
        var t = 0f
        while (true) {
            androidx.compose.runtime.withFrameNanos { now ->
                val dt = if (last == 0L) 0.016f else min(0.05f, (now - last) / 1_000_000_000f)
                last = now
                t += dt
                val beatStart = pulse.advance(dt, pos.value, LEVELS[idx].color, reduce)
                if (beatStart && pos.value >= 0f && !reduce) ripples.add(now)
                ripples.removeAll { (now - it) / 1_000_000f > 1200f }

                if (!rig.dragging) {
                    rig.vYaw *= 0.02f.pow(dt)
                    rig.yaw += rig.vYaw
                    val sway = if (reduce) -0.25f else -0.1f + sin(t * 0.45f) * 0.42f
                    rig.yaw += (sway - rig.yaw) * min(1f, dt * 1.1f)
                    rig.pitch += (0.06f - rig.pitch) * min(1f, dt * 2f)
                }

                heart.renderer?.let { r ->
                    r.yaw = rig.yaw; r.pitch = rig.pitch
                    r.beat = pulse.b; r.heat = pulse.heat
                    r.rigScale = 0.86f + 0.14f * clamp(pos.value + 1f, 0f, 1f)
                    r.accentR = pulse.col[0]; r.accentG = pulse.col[1]; r.accentB = pulse.col[2]
                    r.render(now)
                }
                frameNanos = now
            }
        }
    }

    var helpOpen by remember { mutableStateOf(false) }
    val level = LEVELS[idx]

    Column(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Your fitness level?", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary, textAlign = TextAlign.Center)
            Text("Be honest — we'll calibrate from there", style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary, textAlign = TextAlign.Center)
        }

        // ---- Hero: glow, ripples, platform and the 3D heart ----
        BoxWithConstraints(modifier = Modifier.weight(1f).fillMaxWidth()) {
            val figW = minOf(327.dp, maxWidth)
            val figH = minOf(figW * (300f / 327f), maxHeight - 44.dp).coerceAtLeast(120.dp)
            val figWFit = figH * (327f / 300f)

            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(figWFit, figH)
                    .drawBehind {
                        val t = frameNanos / 1_000_000_000f
                        val heat = pulse.heat
                        // Breathing glow
                        val br = 1f + 0.04f * (sin(t * 2f * PI.toFloat() / 4.6f) + 1f)
                        val gr = 200.dp.toPx() * br * (figH.toPx() / 300.dp.toPx()).coerceAtLeast(0.7f)
                        drawCircle(
                            brush = Brush.radialGradient(
                                colors = listOf(lvlColor.copy(alpha = 0.30f * (0.5f + heat * 0.5f)), Color.Transparent),
                                center = center, radius = gr,
                            ),
                            radius = gr, center = center,
                        )
                        // Ripples on every beat
                        val k = figH.toPx() / 300.dp.toPx()
                        ripples.forEach { start ->
                            val dur = 1100f - 300f * heat
                            val p = ((frameNanos - start) / 1_000_000f / dur).coerceIn(0f, 1f)
                            if (p < 1f) {
                                val scale = if (p < 0.18f) 0.55f + 0.2f * (p / 0.18f)
                                else 0.75f + ((1.15f + 0.3f * heat) - 0.75f) * ((p - 0.18f) / 0.82f)
                                val alpha = if (p < 0.18f) (0.2f + 0.3f * heat) * (p / 0.18f)
                                else (0.2f + 0.3f * heat) * (1f - (p - 0.18f) / 0.82f)
                                drawCircle(lvlColor.copy(alpha = alpha), radius = 105.dp.toPx() * k * scale, center = center, style = Stroke(2.dp.toPx()))
                            }
                        }
                        // Platform
                        val py = size.height * (277f / 300f)
                        drawOval(
                            brush = Brush.radialGradient(listOf(Color.White.copy(alpha = 0.14f), Color.Transparent), center = Offset(center.x, py), radius = 112.dp.toPx() * k),
                            topLeft = Offset(center.x - 112.dp.toPx() * k, py - 16.dp.toPx() * k),
                            size = Size(224.dp.toPx() * k, 32.dp.toPx() * k),
                        )
                        drawOval(
                            color = lvlColor.copy(alpha = 0.45f),
                            topLeft = Offset(center.x - 84.dp.toPx() * k, py - 10.dp.toPx() * k),
                            size = Size(168.dp.toPx() * k, 20.dp.toPx() * k),
                            style = Stroke(1.5.dp.toPx()),
                        )
                        drawSparks(sparks, t, pos.value, lvlColor, k, front = false)
                    }
                    .drawWithContent {
                        drawContent()
                        val k = figH.toPx() / 300.dp.toPx()
                        drawSparks(sparks, frameNanos / 1_000_000_000f, pos.value, lvlColor, k, front = true)
                    }
                    .semantics { contentDescription = "3D heart. Drag to rotate." }
                    .pointerInput(Unit) {
                        awaitEachGesture {
                            val down = awaitFirstDown(requireUnconsumed = false)
                            rig.dragging = true
                            rig.vYaw = 0f
                            var lastX = down.position.x
                            var lastY = down.position.y
                            drag(down.id) { change ->
                                val dx = (change.position.x - lastX) / density.density
                                val dy = (change.position.y - lastY) / density.density
                                lastX = change.position.x; lastY = change.position.y
                                rig.yaw += dx * 0.013f
                                rig.vYaw = dx * 0.013f
                                rig.pitch = clamp(rig.pitch + dy * 0.008f, -0.45f, 0.45f)
                                change.consume()
                            }
                            rig.dragging = false
                        }
                    },
            ) {
                if (heartFailed || renderer == null) {
                    // Loading (soft pulse) or no GL: a calm static heart in the level colour.
                    Box(Modifier.align(Alignment.Center).alpha(if (heartFailed) 1f else 0.25f + 0.35f * pulse.b)) {
                        StrokeIcon(ICON_HEART, 96.dp, lvlColor, strokeWidth = 1.1f)
                    }
                }
                AndroidView(
                    factory = { textureView },
                    modifier = Modifier.fillMaxSize().alpha(heartAlpha),
                )
            }

            // "Not sure?" pill
            Row(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 28.dp)
                    .height(30.dp)
                    .clip(CircleShape)
                    .background(RuvoColors.lime.copy(alpha = 0.08f))
                    .border(1.dp, RuvoColors.lime.copy(alpha = 0.32f), CircleShape)
                    .clickable(onClickLabel = "Find my level") { helpOpen = true }
                    .padding(start = 9.dp, end = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                StrokeIcon(ICON_HELP, 15.dp, RuvoColors.lime, strokeWidth = 1.7f)
                Text("Not sure?", color = RuvoColors.lime, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }

        // ---- Level sheet: -/+ buttons, name and ruler ----
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(28.dp))
                .background(Brush.verticalGradient(listOf(Color(0xFF181818), Color(0xFF101010))))
                .border(1.dp, Color(0xFF262626), RoundedCornerShape(28.dp))
                .padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 10.dp),
        ) {
            Text(
                text = if (suggested) "SUGGESTED" else "FITNESS LEVEL",
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
                color = if (suggested) RuvoColors.lime else Muted,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.1.sp,
            )
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                StepButton(ICON_MINUS, "Lower level", enabled = idx > 0) { goTo(idx - 1) }
                AnimatedContent(
                    targetState = idx,
                    modifier = Modifier.weight(1f),
                    transitionSpec = {
                        if (reduce) fadeIn(tween(1)) togetherWith fadeOut(tween(1))
                        else (fadeIn(tween(240)) + slideInVertically(tween(240)) { it / 3 }) togetherWith fadeOut(tween(120))
                    },
                    label = "levelName",
                ) { i ->
                    Text(
                        LEVELS[i].level.label,
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center,
                        color = Color.White,
                        fontSize = 21.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                    )
                }
                StepButton(ICON_PLUS, "Higher level", enabled = idx < N - 1) { goTo(idx + 1) }
            }
            Ruler(
                pos = pos,
                idx = idx,
                spPx = spPx,
                reduce = reduce,
                busy = busy,
                onGoTo = { goTo(it) },
                onRelease = { target -> goTo(target, 380) },
                description = "${level.level.label}, ${level.level.description}",
            )
        }
    }

    if (helpOpen) {
        LevelFinderSheet(
            reduce = reduce,
            onDismiss = { helpOpen = false },
            onSuggest = { lvl ->
                helpOpen = false
                scope.launch {
                    busy = true
                    delay(if (reduce) 0 else 320)
                    goTo(lvl)
                    suggested = true
                    busy = false
                    delay(2600)
                    suggested = false
                }
            },
        )
    }
}

/** Orbiting spark halo, projected with the same camera as the 3D scene. Half behind the heart, half in front. */
private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawSparks(
    sparks: List<Spark>, t: Float, pos: Float, color: Color, k: Float, front: Boolean,
) {
    val count = floor(clamp(pos, 0f, (N - 1).toFloat()) * 57f).toInt().coerceAtMost(sparks.size)
    if (count <= 0) return
    val heat = clamp(pos / (N - 1), 0f, 1f)
    val pxPerUnit = 150.dp.toPx() * k / 2.816f
    val rot = t * 0.22f
    val cr = cos(rot); val sr = sin(rot)
    for (i in 0 until count) {
        val s = sparks[i]
        val x0 = cos(s.angle) * s.r * 1.05f
        val z0 = sin(s.angle) * s.r * 0.75f
        val x = x0 * cr + z0 * sr
        val z = -x0 * sr + z0 * cr
        if ((z > 0f) != front) continue
        val f = 12.2f / (12.2f - z)
        drawCircle(
            color.copy(alpha = (0.35f + 0.4f * heat) * 0.7f),
            radius = 1.9.dp.toPx() * k * f,
            center = Offset(center.x + x * f * pxPerUnit, center.y - s.y * f * pxPerUnit),
        )
    }
}

@Composable
private fun StepButton(icon: List<String>, label: String, enabled: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(44.dp)
            .alpha(if (enabled) 1f else 0.28f)
            .clip(CircleShape)
            .background(RuvoColors.lime)
            .clickable(enabled = enabled, onClickLabel = label, onClick = onClick)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        StrokeIcon(icon, 22.dp, OnLime, strokeWidth = 2.2f)
    }
}

@Composable
private fun Ruler(
    pos: Animatable<Float, *>,
    idx: Int,
    spPx: Float,
    reduce: Boolean,
    busy: Boolean,
    onGoTo: (Int) -> Unit,
    onRelease: (Int) -> Unit,
    description: String,
) {
    val scope = rememberCoroutineScope()
    val busyNow by rememberUpdatedState(busy)
    val tickStep = spPx / SUB
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
            .height(62.dp)
            .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
            .drawWithContent {
                drawContent()
                // Fade the ruler edges
                drawRect(
                    brush = Brush.horizontalGradient(0f to Color.Transparent, 0.09f to Color.Black, 0.91f to Color.Black, 1f to Color.Transparent),
                    blendMode = BlendMode.DstIn,
                )
            }
            .semantics {
                contentDescription = "Fitness level"
                stateDescription = description
                progressBarRangeInfo = ProgressBarRangeInfo(idx.toFloat(), 0f..(N - 1).toFloat(), N - 2)
                setProgress { v -> onGoTo(v.roundToInt()); true }
            }
            .pointerInput(Unit) {
                val slop = 6.dp.toPx()
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    if (busyNow) { drag(down.id) { }; return@awaitEachGesture }
                    scope.launch { pos.stop() }
                    val pos0 = pos.value
                    val tracker = VelocityTracker()
                    tracker.addPosition(down.uptimeMillis, down.position)
                    var moved = 0f
                    var cur = pos0
                    val done = drag(down.id) { change ->
                        tracker.addPosition(change.uptimeMillis, change.position)
                        val dx = change.position.x - down.position.x
                        moved = max(moved, abs(dx))
                        var p = pos0 - dx / spPx
                        if (p < 0f) p *= 0.35f                                   // rubber-band at the ends
                        if (p > N - 1) p = N - 1 + (p - (N - 1)) * 0.35f
                        cur = p
                        change.consume()
                        scope.launch { pos.snapTo(p) }
                    }
                    if (!done) { onRelease(cur.roundToInt().coerceIn(0, N - 1)); return@awaitEachGesture }
                    if (moved < slop) {
                        // Tap on a label
                        if (down.position.y > 30.dp.toPx()) {
                            val cx = size.width / 2f
                            for (i in 0 until N) {
                                val lx = cx + (i - pos.value) * spPx
                                if (abs(down.position.x - lx) < 46.dp.toPx()) { onGoTo(i); break }
                            }
                        }
                        return@awaitEachGesture
                    }
                    val v = tracker.calculateVelocity().x   // px/s
                    val target = ((cur - v * 0.24f / spPx).roundToInt()).coerceIn(0, N - 1)
                    onRelease(target)
                }
            },
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val cx = size.width / 2f
            val base = size.height - 30.dp.toPx()
            for (t in -14..((N - 1) * SUB + 14)) {
                val major = t % SUB == 0 && t >= 0 && t <= (N - 1) * SUB
                val h = if (major) 26.dp else if (t % 4 == 0) 16.dp else 9.dp
                val on = major && t / SUB == idx
                val c = when {
                    on -> RuvoColors.lime
                    major -> Color(0xFF5A5A5A)
                    t % 4 == 0 -> Color(0xFF3B3B3B)
                    else -> Color(0xFF333333)
                }
                val x = cx + t * tickStep - pos.value * spPx
                drawRoundRect(c, Offset(x - 1.dp.toPx(), base - h.toPx()), Size(2.dp.toPx(), h.toPx()), CornerRadius(1.dp.toPx()))
            }
            // Needle with a soft glow
            drawRoundRect(RuvoColors.lime.copy(alpha = 0.25f), Offset(cx - 5.dp.toPx(), -2.dp.toPx()), Size(10.dp.toPx(), 40.dp.toPx()), CornerRadius(5.dp.toPx()))
            drawRoundRect(RuvoColors.lime, Offset(cx - 1.5.dp.toPx(), 0f), Size(3.dp.toPx(), 36.dp.toPx()), CornerRadius(1.5.dp.toPx()))
        }
        LEVELS.forEachIndexed { i, s ->
            Text(
                text = s.level.label,
                color = if (i == idx) Color.White else Muted,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                softWrap = false,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .offset { IntOffset(((i - pos.value) * spPx).roundToInt(), 38.dp.roundToPx()) },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LevelFinderSheet(reduce: Boolean, onDismiss: () -> Unit, onSuggest: (Int) -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current
    var freq by remember { mutableIntStateOf(-1) }
    var five by remember { mutableIntStateOf(-1) }      // 0 not yet, 1 with effort, 2 easily

    fun close(then: (() -> Unit)? = null) {
        scope.launch { sheetState.hide() }.invokeOnCompletion { onDismiss(); then?.invoke() }
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
                Text("Let's find your level", modifier = Modifier.weight(1f), color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Box(
                    modifier = Modifier.size(34.dp).clip(CircleShape).background(Color(0xFF222222))
                        .clickable(onClickLabel = "Close") { close() }
                        .semantics { contentDescription = "Close" },
                    contentAlignment = Alignment.Center,
                ) { StrokeIcon(listOf("M18 6L6.00081 17.9992M17.9992 18L6 6.00085"), 18.dp, Color.White, strokeWidth = 2f) }
            }
            Question("How often do you run right now?")
            OptionGrid(
                labels = listOf("Rarely or never", "1-3 times a week", "4+ times a week", "I follow a race plan"),
                columns = 2, selected = freq,
            ) { freq = it; haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove) }
            Question("Can you run 5 km without stopping?")
            OptionGrid(labels = listOf("Not yet", "With effort", "Easily"), columns = 3, selected = five) {
                five = it; haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            }
            Spacer(Modifier.height(20.dp))
            val ready = freq >= 0 && five >= 0
            Box(
                modifier = Modifier
                    .fillMaxWidth().height(54.dp)
                    .alpha(if (ready) 1f else 0.4f)
                    .clip(RoundedCornerShape(40.dp))
                    .background(Brush.horizontalGradient(listOf(RuvoColors.lime, RuvoColors.limeGradientEnd)))
                    .clickable(enabled = ready) { close { onSuggest(suggestLevel(freq, five)) } },
                contentAlignment = Alignment.Center,
            ) { Text("Suggest my level", color = OnLime, fontSize = 17.sp, fontWeight = FontWeight.Bold) }
        }
    }
}

/** Rule of thumb from the design; tune with the coaching team. */
private fun suggestLevel(freq: Int, five: Int): Int {
    var lvl = freq
    if (five == 0) lvl = max(0, lvl - 1)
    else if (five == 2 && lvl <= 1) lvl = min(N - 1, lvl + 1)
    return lvl
}

@Composable
private fun Question(text: String) {
    Text(text, modifier = Modifier.padding(top = 16.dp, bottom = 8.dp), color = RuvoColors.textSecondary, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
}

@Composable
private fun OptionGrid(labels: List<String>, columns: Int, selected: Int, onPick: (Int) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        labels.withIndex().chunked(columns).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { (i, label) ->
                    val on = i == selected
                    Box(
                        modifier = Modifier
                            .weight(1f).heightIn(min = 46.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(if (on) RuvoColors.lime else Color(0xFF141414))
                            .border(1.5.dp, if (on) RuvoColors.lime else Color(0xFF2A2A2A), RoundedCornerShape(16.dp))
                            .clickable { onPick(i) }
                            .semantics { role = Role.RadioButton; this.selected = on }
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        contentAlignment = Alignment.Center,
                    ) { Text(label, color = if (on) OnLime else Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, lineHeight = 16.sp) }
                }
            }
        }
    }
}
