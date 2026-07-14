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

// All badge definitions
private val ALL_BADGES = listOf(
    // Distance Milestones
    Badge("first_5k", "First 5K", "🏅", "Complete your first 5K run", "#DFFF00", "Distance Milestones"),
    Badge("first_10k", "First 10K", "🥈", "Complete your first 10K run", "#DFFF00", "Distance Milestones"),
    Badge("half_marathon", "Half Marathoner", "🥇", "Run a half marathon (21.1 km)", "#FFD700", "Distance Milestones"),
    Badge("marathon", "Marathoner", "🏆", "Complete a full marathon (42.2 km)", "#FF6B35", "Distance Milestones"),
    Badge("100k_total", "Century Runner", "💯", "Log 100 km in total", "#00E5FF", "Distance Milestones"),
    Badge("500k_total", "Elite Runner", "⭐", "Log 500 km in total", "#7C3AED", "Distance Milestones"),

    // Consistency & Streaks
    Badge("streak_3", "3-Day Streak", "🔥", "Run 3 days in a row", "#F97316", "Consistency & Streaks"),
    Badge("streak_7", "Week Warrior", "🔥🔥", "Run every day for a week", "#EF4444", "Consistency & Streaks"),
    Badge("streak_30", "Monthly Legend", "🔥🔥🔥", "30-day running streak", "#DC2626", "Consistency & Streaks"),
    Badge("early_bird", "Early Bird", "🌅", "Complete 5 runs before 7am", "#FCD34D", "Consistency & Streaks"),
    Badge("night_owl", "Night Owl", "🌙", "Complete 5 runs after 9pm", "#6366F1", "Consistency & Streaks"),

    // Speed & Performance
    Badge("sub_6_pace", "Speed Demon", "⚡", "Run a km under 6 minutes pace", "#FACC15", "Speed & Performance"),
    Badge("sub_5_pace", "Sub-5 Pacer", "🚀", "Run a km under 5 minutes pace", "#06B6D4", "Speed & Performance"),
    Badge("negative_split", "Negative Splitter", "📈", "Finish faster than you started", "#10B981", "Speed & Performance"),

    // Elevation Challenges
    Badge("hill_climber", "Hill Climber", "⛰️", "Gain 100m elevation in a run", "#8B5CF6", "Elevation Challenges"),
    Badge("mountain_goat", "Mountain Goat", "🐐", "Gain 500m elevation in a run", "#A78BFA", "Elevation Challenges"),

    // Lifestyle & Habits
    Badge("social_runner", "Social Runner", "👥", "Follow 5 other runners", "#06B6D4", "Lifestyle & Habits"),
    Badge("ai_coach_user", "Coach's Favorite", "🤖", "Ask AI coach 10 questions", "#7C3AED", "Lifestyle & Habits"),
    Badge("gear_tracker", "Gear Fanatic", "👟", "Track 3 pairs of shoes", "#F97316", "Lifestyle & Habits"),
    Badge("review_master", "Reviewer", "⭐", "Rate effort after 10 runs", "#DFFF00", "Lifestyle & Habits"),
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
