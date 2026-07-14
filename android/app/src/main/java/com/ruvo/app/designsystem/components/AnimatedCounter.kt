package com.ruvo.app.designsystem.components

import androidx.compose.animation.core.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import com.ruvo.app.designsystem.theme.RuvoColors
import kotlin.math.roundToInt

@Composable
fun AnimatedCounter(
    target: Int,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.headlineLarge,
    color: Color = RuvoColors.textPrimary,
    fontWeight: FontWeight = FontWeight.Bold,
    prefix: String = "",
    suffix: String = "",
    durationMs: Int = 800,
) {
    val animatedValue by animateIntAsState(
        targetValue = target,
        animationSpec = tween(durationMillis = durationMs, easing = FastOutSlowInEasing),
        label = "counter",
    )
    Text(
        text = "$prefix$animatedValue$suffix",
        style = style,
        color = color,
        fontWeight = fontWeight,
        modifier = modifier,
    )
}

@Composable
fun AnimatedFloatCounter(
    target: Double,
    decimals: Int = 1,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.headlineLarge,
    color: Color = RuvoColors.textPrimary,
    fontWeight: FontWeight = FontWeight.Bold,
    prefix: String = "",
    suffix: String = "",
    durationMs: Int = 800,
) {
    val factor = Math.pow(10.0, decimals.toDouble()).toInt()
    val animatedValue by animateIntAsState(
        targetValue = (target * factor).roundToInt(),
        animationSpec = tween(durationMillis = durationMs, easing = FastOutSlowInEasing),
        label = "float_counter",
    )
    val display = String.format("%.${decimals}f", animatedValue.toDouble() / factor)
    Text(
        text = "$prefix$display$suffix",
        style = style,
        color = color,
        fontWeight = fontWeight,
        modifier = modifier,
    )
}
