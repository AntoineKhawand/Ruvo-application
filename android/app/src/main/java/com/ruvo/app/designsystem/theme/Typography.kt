package com.ruvo.app.designsystem.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Poppins font files go in res/font/ — using SansSerif as fallback until fonts are added
val PoppinsFamily: FontFamily = FontFamily.SansSerif

val RuvoTypography = Typography(
    displayLarge  = TextStyle(fontFamily = PoppinsFamily, fontWeight = FontWeight.Black,    fontSize = 48.sp, lineHeight = 52.sp, letterSpacing = (-1).sp),
    displayMedium = TextStyle(fontFamily = PoppinsFamily, fontWeight = FontWeight.Black,    fontSize = 36.sp, lineHeight = 40.sp, letterSpacing = (-0.5).sp),
    headlineLarge = TextStyle(fontFamily = PoppinsFamily, fontWeight = FontWeight.Bold,     fontSize = 28.sp, lineHeight = 34.sp),
    headlineMedium = TextStyle(fontFamily = PoppinsFamily, fontWeight = FontWeight.Bold,    fontSize = 22.sp, lineHeight = 28.sp),
    headlineSmall = TextStyle(fontFamily = PoppinsFamily, fontWeight = FontWeight.Bold,     fontSize = 18.sp, lineHeight = 24.sp),
    titleLarge    = TextStyle(fontFamily = PoppinsFamily, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, lineHeight = 28.sp),
    titleMedium   = TextStyle(fontFamily = PoppinsFamily, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 24.sp),
    titleSmall    = TextStyle(fontFamily = PoppinsFamily, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
    bodyLarge     = TextStyle(fontFamily = PoppinsFamily, fontWeight = FontWeight.Normal,   fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium    = TextStyle(fontFamily = PoppinsFamily, fontWeight = FontWeight.Normal,   fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall     = TextStyle(fontFamily = PoppinsFamily, fontWeight = FontWeight.Normal,   fontSize = 12.sp, lineHeight = 16.sp),
    labelLarge    = TextStyle(fontFamily = PoppinsFamily, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, letterSpacing = 0.1.sp),
    labelMedium   = TextStyle(fontFamily = PoppinsFamily, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, letterSpacing = 0.5.sp),
    labelSmall    = TextStyle(fontFamily = PoppinsFamily, fontWeight = FontWeight.Bold,     fontSize = 10.sp, letterSpacing = 1.5.sp),
)
