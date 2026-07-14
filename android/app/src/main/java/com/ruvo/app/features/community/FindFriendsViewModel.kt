package com.ruvo.app.features.community

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class FindFriendsUser(
    val uid: String,
    val displayName: String,
    val totalKm: Double,
    val isFollowing: Boolean,
)

data class FindFriendsUiState(
    val query: String = "",
    val suggestions: List<FindFriendsUser> = emptyList(),
    val searchResults: List<FindFriendsUser> = emptyList(),
    val isLoading: Boolean = false,
)

@HiltViewModel
class FindFriendsViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _uiState = MutableStateFlow(FindFriendsUiState(isLoading = true))
    val uiState: StateFlow<FindFriendsUiState> = _uiState.asStateFlow()

    private var myFollowing = setOf<String>()

    init {
        loadSuggestions()
    }

    private fun loadSuggestions() {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            try {
                val meDoc = firestore.collection("users").document(uid).get().await()
                @Suppress("UNCHECKED_CAST")
                myFollowing = ((meDoc.data?.get("following") as? List<String>) ?: emptyList()).toSet()

                val snap = firestore.collection("users")
                    .orderBy("joinedAt", Query.Direction.DESCENDING)
                    .limit(20)
                    .get()
                    .await()

                val suggestions = snap.documents
                    .filter { it.id != uid && it.id !in myFollowing }
                    .mapNotNull { doc ->
                        val d = doc.data ?: return@mapNotNull null
                        FindFriendsUser(
                            uid = doc.id,
                            displayName = d["name"] as? String ?: "Runner",
                            totalKm = (d["totalKm"] as? Number)?.toDouble() ?: 0.0,
                            isFollowing = doc.id in myFollowing,
                        )
                    }

                _uiState.update { it.copy(suggestions = suggestions, isLoading = false) }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }

    fun search(query: String) {
        _uiState.update { it.copy(query = query) }
        if (query.isBlank()) return

        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            try {
                val snap = firestore.collection("users")
                    .orderBy("name")
                    .startAt(query)
                    .endAt(query + "")
                    .limit(20)
                    .get()
                    .await()

                val results = snap.documents
                    .filter { it.id != uid }
                    .mapNotNull { doc ->
                        val d = doc.data ?: return@mapNotNull null
                        FindFriendsUser(
                            uid = doc.id,
                            displayName = d["name"] as? String ?: "Runner",
                            totalKm = (d["totalKm"] as? Number)?.toDouble() ?: 0.0,
                            isFollowing = doc.id in myFollowing,
                        )
                    }

                _uiState.update { it.copy(searchResults = results) }
            } catch (_: Exception) { }
        }
    }

    fun toggleFollow(targetUid: String) {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            val isFollowing = targetUid in myFollowing
            val myRef = firestore.collection("users").document(uid)

            if (isFollowing) {
                myRef.update("following", com.google.firebase.firestore.FieldValue.arrayRemove(targetUid)).await()
                myFollowing = myFollowing - targetUid
            } else {
                myRef.update("following", com.google.firebase.firestore.FieldValue.arrayUnion(targetUid)).await()
                myFollowing = myFollowing + targetUid
            }

            // Refresh both lists
            _uiState.update { state ->
                state.copy(
                    suggestions = state.suggestions.map {
                        if (it.uid == targetUid) it.copy(isFollowing = !isFollowing) else it
                    },
                    searchResults = state.searchResults.map {
                        if (it.uid == targetUid) it.copy(isFollowing = !isFollowing) else it
                    }
                )
            }
        }
    }
}
