package com.ruvo.app.designsystem.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Lime         = Color(0xFFDFFF00)
val LimeDim      = Color(0x26DFFF00)
val Background   = Color(0xFF050505)
val Surface      = Color(0xFF111111)
val SurfaceElev  = Color(0xFF1A1A1A)
val Border       = Color(0xFF222222)
val TextPrimary  = Color(0xFFFFFFFF)
val TextSecondary = Color(0xFFA1A1AA)
val TextTertiary = Color(0xFF52525B)
val HeartRed     = Color(0xFFEF4444)
val Vo2Orange    = Color(0xFFEA580C)
val Teal         = Color(0xFF2DD4BF)
val Purple       = Color(0xFFA855F7)
val Success      = Color(0xFF22C55E)
val Warning      = Color(0xFFF59E0B)
val ErrorColor   = Color(0xFFEF4444)

private val RuvoDarkColorScheme = darkColorScheme(
    primary           = Lime,
    onPrimary         = Color.Black,
    primaryContainer  = LimeDim,
    background        = Background,
    surface           = Surface,
    surfaceVariant    = SurfaceElev,
    onBackground      = TextPrimary,
    onSurface         = TextPrimary,
    onSurfaceVariant  = TextSecondary,
    outline           = Border,
    error             = ErrorColor,
    secondary         = Teal,
    tertiary          = Purple,
)

@Composable
fun RuvoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = RuvoDarkColorScheme,
        typography  = RuvoTypography,
        content     = content
    )
}

object RuvoColors {
    val lime         = Lime
    val limeDim      = LimeDim
    val background   = Background
    val surface      = Surface
    val surfaceElev  = SurfaceElev
    val border       = Border
    val textPrimary  = TextPrimary
    val textSecondary = TextSecondary
    val textTertiary = TextTertiary
    val heartRed     = HeartRed
    val vo2Orange    = Vo2Orange
    val teal         = Teal
    val purple       = Purple
    val success      = Success
    val warning      = Warning
    val error        = ErrorColor
}
