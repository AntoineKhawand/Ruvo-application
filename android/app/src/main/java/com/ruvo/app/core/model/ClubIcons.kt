package com.ruvo.app.core.model

import androidx.compose.ui.graphics.Color

// Shared with CommunityViewModel.kt's Clubs tab (previously declared private
// to CreateClubScreen.kt) so the club-list card can render the same icon a
// club was actually created with, instead of a hardcoded 🏃 fallback for
// every club. Firestore only ever stores the `id` (e.g. "trophy") on the
// club doc — CLUB_ICONS is the one place id maps to an actual emoji/color,
// same as RunningGoal/FitnessLevel's shared-enum precedent in
// OnboardingOptions.kt.
data class ClubIcon(val id: String, val emoji: String, val color: Color)

val CLUB_ICONS = listOf(
    ClubIcon("run", "🏃", Color(0xFFDFFF00)),
    ClubIcon("fire", "🔥", Color(0xFFFF5722)),
    ClubIcon("mountain", "⛰️", Color(0xFF448AFF)),
    ClubIcon("trophy", "🏆", Color(0xFF7C4DFF)),
    ClubIcon("leaf", "🌿", Color(0xFF00E676)),
    ClubIcon("heart", "❤️", Color(0xFFE040FB)),
)

fun clubEmojiFor(iconId: String?): String = CLUB_ICONS.find { it.id == iconId }?.emoji ?: "🏃"
