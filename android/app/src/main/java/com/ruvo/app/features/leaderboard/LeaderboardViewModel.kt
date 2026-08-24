package com.ruvo.app.features.leaderboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

enum class LeaderboardScopeTab(val label: String) {
    Friends("Friends"), Country("Country"), Global("Global")
}

enum class LeaderboardTimePeriod(val label: String) {
    Weekly("Weekly"), AllTime("All-Time")
}

data class LeaderboardEntry(
    val uid: String,
    val displayName: String,
    val distanceKm: Double,
    val countryFlag: String,
    val isCurrentUser: Boolean,
    val rank: Int = 0,
)

data class LeaderboardUiState(
    val entries: List<LeaderboardEntry> = emptyList(),
    val scope: LeaderboardScopeTab = LeaderboardScopeTab.Friends,
    val period: LeaderboardTimePeriod = LeaderboardTimePeriod.Weekly,
    val isLoading: Boolean = false,
    val dateRangeLabel: String = "",
)

@HiltViewModel
class LeaderboardViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LeaderboardUiState())
    val uiState: StateFlow<LeaderboardUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun setScope(scope: LeaderboardScopeTab) {
        _uiState.update { it.copy(scope = scope) }
        load()
    }

    fun setPeriod(period: LeaderboardTimePeriod) {
        _uiState.update { it.copy(period = period) }
        load()
    }

    private fun load() {
        viewModelScope.launch {
            val currentUid = auth.currentUser?.uid ?: return@launch
            _uiState.update { it.copy(isLoading = true) }

            try {
                val sortField = if (_uiState.value.period == LeaderboardTimePeriod.Weekly) "weeklyDistance" else "totalKm"
                val usersRef = firestore.collection("users")

                val snapshot = usersRef
                    .orderBy(sortField, Query.Direction.DESCENDING)
                    .limit(100)
                    .get()
                    .await()

                var entries = snapshot.documents.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    @Suppress("UNCHECKED_CAST")
                    val location = data["location"] as? Map<String, Any>
                    LeaderboardEntry(
                        uid = doc.id,
                        displayName = data["name"] as? String ?: data["displayName"] as? String ?: "Runner",
                        distanceKm = (data[sortField] as? Number)?.toDouble() ?: 0.0,
                        // Real field is nested location.country (ProfileViewModel/
                        // EditProfileSheet's own field) — this used to read a
                        // top-level "country" that's never written, so every
                        // entry silently fell back to the generic 🏃 flag.
                        countryFlag = countryFlag(location?.get("country") as? String ?: ""),
                        isCurrentUser = doc.id == currentUid,
                    )
                }

                // Filter for Friends scope
                if (_uiState.value.scope == LeaderboardScopeTab.Friends) {
                    val meDoc = firestore.collection("users").document(currentUid).get().await()
                    @Suppress("UNCHECKED_CAST")
                    val following = (meDoc.data?.get("following") as? List<String>) ?: emptyList()
                    entries = entries.filter { it.uid == currentUid || it.uid in following }
                }

                // Rank
                val sorted = entries.sortedByDescending { it.distanceKm }
                val ranked = sorted.mapIndexed { i, e -> e.copy(rank = i + 1) }

                _uiState.update {
                    it.copy(
                        entries = ranked,
                        isLoading = false,
                        dateRangeLabel = if (_uiState.value.period == LeaderboardTimePeriod.Weekly) weekRange() else "All Time",
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }

    private fun weekRange(): String {
        val cal = Calendar.getInstance()
        cal.firstDayOfWeek = Calendar.MONDAY
        cal.set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
        val sdf = SimpleDateFormat("d MMM", Locale.getDefault())
        val start = sdf.format(cal.time)
        cal.add(Calendar.DAY_OF_MONTH, 6)
        val end = sdf.format(cal.time)
        return "$start - $end"
    }

    private fun countryFlag(country: String): String = when (country.lowercase()) {
        "lebanon"        -> "🇱🇧"
        "usa", "united states" -> "🇺🇸"
        "france"         -> "🇫🇷"
        "germany"        -> "🇩🇪"
        "uk", "united kingdom" -> "🇬🇧"
        "canada"         -> "🇨🇦"
        "australia"      -> "🇦🇺"
        "japan"          -> "🇯🇵"
        "brazil"         -> "🇧🇷"
        "kenya"          -> "🇰🇪"
        "ethiopia"       -> "🇪🇹"
        "saudi arabia"   -> "🇸🇦"
        "uae"            -> "🇦🇪"
        "egypt"          -> "🇪🇬"
        "morocco"        -> "🇲🇦"
        else             -> "🏃"
    }
}
