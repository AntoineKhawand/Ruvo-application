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
val TextTertiary = Color(0xFF7A7A85) // ~4.8:1 on Background -- WCAG AA for small text
val HeartRed     = Color(0xFFEF4444)
val Vo2Orange    = Color(0xFFEA580C)
val Teal         = Color(0xFF2DD4BF)
val Purple       = Color(0xFFA855F7)
val Success      = Color(0xFF22C55E)
val Warning      = Color(0xFFF59E0B)
val ErrorColor   = Color(0xFFEF4444)

// Concept tokens consolidating hex literals that were independently re-invented per-screen.
/** "Calorie/energy" orange used for calorie stats, flame icons, and warm-up accents.
 *  Canonical value chosen from #F97316 vs #FF6D40 -- F97316 appeared at ~7 call sites
 *  vs ~2 for FF6D40 across the affected screens, so it wins as the majority value. */
val CalorieOrange = Color(0xFFF97316)
/** "Coin / XP" gold used for coin balances, coin rewards, and coin-earned copy. */
val CoinGold      = Color(0xFFEAB308)
/** End-stop of the lime brand gradient (start-stop is `Lime`). */
val LimeGradientEnd = Color(0xFFA8CC00)

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
    val calorieOrange = CalorieOrange
    val coinGold      = CoinGold
    val limeGradientEnd = LimeGradientEnd

    /**
     * Approximated "glass" surface for elevated/floating chrome (cards, bottom nav).
     * Compose has no built-in backdrop blur at this app's minSdk (26) -- real-time
     * blur-of-content-behind needs a RenderEffect capture pipeline (API 31+) that's
     * out of scope here -- so this is a semi-transparent surface tint instead of a
     * true Gaussian blur. iOS gets the real thing via `.ultraThinMaterial`.
     */
    val glassSurface = SurfaceElev.copy(alpha = 0.72f)
}
