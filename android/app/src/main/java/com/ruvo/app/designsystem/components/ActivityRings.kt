package com.ruvo.app.designsystem.components

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke

data class ActivityRing(
    val progress: Float,   // 0f..1f
    val color: Color,
    val strokeWidthDp: Float = 11f,
)

/**
 * Apple Watch-style concentric activity rings drawn with Compose Canvas.
 * Outermost ring = rings[0], innermost = rings.last().
 */
@Composable
fun ActivityRings(
    rings: List<ActivityRing>,
    modifier: Modifier = Modifier,
    gapDp: Float = 5f,
) {
    Canvas(modifier = modifier) {
        val gapPx = gapDp * density
        rings.forEachIndexed { i, ring ->
            val strokePx = ring.strokeWidthDp * density
            val radiusOffset = i * (strokePx + gapPx)
            val radius = (size.minDimension / 2f) - (strokePx / 2f) - radiusOffset
            if (radius <= 0f) return@forEachIndexed

            // Track (background arc)
            drawArc(
                color = ring.color.copy(alpha = 0.18f),
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                style = Stroke(width = strokePx, cap = StrokeCap.Round),
                size = androidx.compose.ui.geometry.Size(radius * 2, radius * 2),
                topLeft = androidx.compose.ui.geometry.Offset(
                    x = center.x - radius,
                    y = center.y - radius,
                ),
            )

            // Filled arc
            val sweep = (ring.progress.coerceIn(0f, 1f)) * 360f
            if (sweep > 0f) {
                drawArc(
                    color = ring.color,
                    startAngle = -90f,
                    sweepAngle = sweep,
                    useCenter = false,
                    style = Stroke(width = strokePx, cap = StrokeCap.Round),
                    size = androidx.compose.ui.geometry.Size(radius * 2, radius * 2),
                    topLeft = androidx.compose.ui.geometry.Offset(
                        x = center.x - radius,
                        y = center.y - radius,
                    ),
                )
            }
        }
    }
}
