package com.ruvo.app.features.achievements

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class Badge(
    val id: String,
    val name: String,
    val emoji: String,
    val description: String,
    val colorHex: String,
    val category: String,
    val unlocked: Boolean = false,
)

data class BadgeCategory(
    val name: String,
    val badges: List<Badge>,
) {
    val unlockedCount get() = badges.count { it.unlocked }
}

data class AchievementsUiState(
    val categories: List<BadgeCategory> = emptyList(),
    val isLoading: Boolean = false,
) {
    val badges get() = categories.flatMap { it.badges }
    val unlockedCount get() = badges.count { it.unlocked }
    val totalCount get() = badges.size
    val progressPercent get() = if (totalCount == 0) 0f else (unlockedCount / totalCount.toFloat()) * 100f
}

// All badge definitions — verbatim from RN's src/constants/badges.js (the
// authoritative BADGES array, copied raw to docs/rn-reference/badges.js).
// This previously invented its own catalogue (different ids, extra badges
// like "streak_30"/"gear_tracker" that don't exist in RN, and missing real
// RN ones like b_perfect_week/b_weekend_warrior/b_hill_hunter/b_sub4_specialist)
// — a real divergence, not a stylistic choice, since `hasBadge()` matches by
// id and any persisted `badges` entries use RN's real ids. Category strings
// are the exact display names archive §3 documents (milestone→"Distance
// Milestones" etc.) since buildCategories() groups by this field directly.
val ALL_BADGES = listOf(
    // --- Distance Milestones ---
    Badge("b_first_run", "First Steps", "👣", "Completed your first run!", "#CCFF00", "Distance Milestones"),
    Badge("b_5k", "High Five", "🖐️", "Ran 5km in a single session.", "#CCFF00", "Distance Milestones"),
    Badge("b_10k", "10K Finisher", "🎗️", "Ran 10km in a single session.", "#FF4500", "Distance Milestones"),
    Badge("b_half", "Half Marathon", "🏅", "Ran 21.1km in a single session.", "#FFD700", "Distance Milestones"),
    Badge("b_century_club", "Century Club", "🏆", "Ran 100km total distance.", "#9C27B0", "Distance Milestones"),

    // --- Lifestyle & Habits ---
    Badge("b_early_bird", "Early Bird", "☀️", "Finished a run before 7 AM.", "#FDD835", "Lifestyle & Habits"),
    Badge("b_night_owl", "Night Owl", "🌙", "Finished a run after 8 PM.", "#536DFE", "Lifestyle & Habits"),
    Badge("b_weekend_warrior", "Weekend Warrior", "🍺", "Ran on both Saturday and Sunday.", "#FF9800", "Lifestyle & Habits"),

    // --- Consistency & Streaks ---
    Badge("b_10_runs", "Dedicated", "🔥", "Completed 10 total runs.", "#FF5722", "Consistency & Streaks"),
    Badge("b_perfect_week", "Perfect Week", "📅", "Ran 7 days in a row.", "#00E676", "Consistency & Streaks"),

    // --- Elevation Challenges ---
    Badge("b_hill_hunter", "Hill Hunter", "📈", "Completed 10 runs with 100m+ elevation.", "#795548", "Elevation Challenges"),

    // --- Speed & Performance ---
    Badge("b_sub4_specialist", "Sub-4 Specialist", "⚡", "Completed 5 runs under 4:00/km pace.", "#00BCD4", "Speed & Performance"),
)

@HiltViewModel
class AchievementsViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _uiState = MutableStateFlow(AchievementsUiState(isLoading = true))
    val uiState: StateFlow<AchievementsUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: run {
                _uiState.update { it.copy(isLoading = false, categories = buildCategories(emptySet())) }
                return@launch
            }

            try {
                val doc = firestore.collection("users").document(uid).get().await()
                @Suppress("UNCHECKED_CAST")
                val earnedIds = ((doc.data?.get("badges") as? List<*>)
                    ?.filterIsInstance<Map<String, Any>>()
                    ?.mapNotNull { it["id"] as? String }
                    ?: emptyList()).toSet()

                _uiState.update {
                    it.copy(isLoading = false, categories = buildCategories(earnedIds))
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoading = false, categories = buildCategories(emptySet())) }
            }
        }
    }

    private fun buildCategories(earnedIds: Set<String>): List<BadgeCategory> {
        val withUnlocked = ALL_BADGES.map { it.copy(unlocked = it.id in earnedIds) }
        return withUnlocked
            .groupBy { it.category }
            .map { (cat, badges) -> BadgeCategory(name = cat, badges = badges) }
    }
}
