package com.ruvo.app.features.achievements

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.core.model.ALL_BADGES
import com.ruvo.app.core.model.Badge
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

// Badge/ALL_BADGES moved to core/model/Badges.kt 2026-08-30 so the new
// checkNewBadges() evaluator (wired into both real save paths) can share
// the exact same catalogue this screen displays, instead of two
// independently-maintained copies drifting apart.

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
