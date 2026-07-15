package com.ruvo.app.features.search

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

private val FILTERS = listOf("Everyone", "Following", "Followers", "Nearby")

data class SearchUser(
    val uid: String,
    val name: String,
    val totalKm: Double,
    val country: String,
    val isFollowing: Boolean,
    val isFollower: Boolean,
)

@HiltViewModel
class SearchViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _query = MutableStateFlow("")
    private val _filter = MutableStateFlow("Everyone")
    private val _results = MutableStateFlow<List<SearchUser>>(emptyList())
    private val _isSearching = MutableStateFlow(false)
    private var myFollowing = setOf<String>()
    private var myFollowers = setOf<String>()
    private var myCountry = ""
    private var debounceJob: Job? = null

    val query: StateFlow<String> = _query.asStateFlow()
    val filter: StateFlow<String> = _filter.asStateFlow()
    val results: StateFlow<List<SearchUser>> = _results.asStateFlow()
    val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

    init {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            val doc = firestore.collection("users").document(uid).get().await()
            val data = doc.data ?: return@launch
            @Suppress("UNCHECKED_CAST")
            myFollowing = ((data["following"] as? List<String>) ?: emptyList()).toSet()
            @Suppress("UNCHECKED_CAST")
            myFollowers = ((data["followers"] as? List<String>) ?: emptyList()).toSet()
            myCountry = (data["country"] as? String) ?: ""
        }
    }

    fun onQueryChange(q: String) {
        _query.value = q
        debounceJob?.cancel()
        debounceJob = viewModelScope.launch {
            delay(300)
            search()
        }
    }

    fun setFilter(f: String) {
        _filter.value = f
        viewModelScope.launch { search() }
    }

    private suspend fun search() {
        val q = _query.value.trim()
        if (q.isBlank()) { _results.value = emptyList(); return }
        _isSearching.value = true
        try {
            val uid = auth.currentUser?.uid ?: return
            val snap = firestore.collection("users")
                .orderBy("name")
                .startAt(q)
                .endAt(q + "")
                .limit(30)
                .get().await()

            val allResults = snap.documents.filter { it.id != uid }.mapNotNull { doc ->
                val d = doc.data ?: return@mapNotNull null
                SearchUser(
                    uid = doc.id,
                    name = d["name"] as? String ?: d["displayName"] as? String ?: "Runner",
                    totalKm = (d["totalKm"] as? Number)?.toDouble() ?: (d["totalDistanceKm"] as? Number)?.toDouble() ?: 0.0,
                    country = d["country"] as? String ?: "",
                    isFollowing = doc.id in myFollowing,
                    isFollower = doc.id in myFollowers,
                )
            }

            _results.value = when (_filter.value) {
                "Following" -> allResults.filter { it.isFollowing }
                "Followers" -> allResults.filter { it.isFollower }
                "Nearby"    -> allResults.filter { it.country == myCountry && myCountry.isNotBlank() }
                else        -> allResults
            }
        } catch (_: Exception) {
        } finally {
            _isSearching.value = false
        }
    }

    fun toggleFollow(targetUid: String) {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            val isFollowing = targetUid in myFollowing
            val ref = firestore.collection("users").document(uid)
            if (isFollowing) {
                ref.update("following", com.google.firebase.firestore.FieldValue.arrayRemove(targetUid)).await()
                myFollowing = myFollowing - targetUid
            } else {
                ref.update("following", com.google.firebase.firestore.FieldValue.arrayUnion(targetUid)).await()
                myFollowing = myFollowing + targetUid
            }
            _results.update { list ->
                list.map { if (it.uid == targetUid) it.copy(isFollowing = !isFollowing) else it }
            }
        }
    }
}

@Composable
fun SearchScreen(
    onBack: () -> Unit = {},
    onUserProfile: (String) -> Unit = {},
    viewModel: SearchViewModel = hiltViewModel(),
) {
    val query by viewModel.query.collectAsStateWithLifecycle()
    val filter by viewModel.filter.collectAsStateWithLifecycle()
    val results by viewModel.results.collectAsStateWithLifecycle()
    val isSearching by viewModel.isSearching.collectAsStateWithLifecycle()

    Column(modifier = Modifier.fillMaxSize().background(RuvoColors.background)) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary) }
            OutlinedTextField(
                value = query,
                onValueChange = viewModel::onQueryChange,
                modifier = Modifier.weight(1f),
                placeholder = { Text("Search runners…", color = RuvoColors.textTertiary) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = RuvoColors.textTertiary) },
                trailingIcon = {
                    if (query.isNotEmpty()) IconButton(onClick = { viewModel.onQueryChange("") }) { Icon(Icons.Default.Clear, contentDescription = "Clear", tint = RuvoColors.textTertiary) }
                },
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = RuvoColors.surfaceElev,
                    unfocusedContainerColor = RuvoColors.surfaceElev,
                    focusedBorderColor = RuvoColors.lime,
                    unfocusedBorderColor = RuvoColors.border,
                    focusedTextColor = RuvoColors.textPrimary,
                    unfocusedTextColor = RuvoColors.textPrimary,
                ),
            )
        }

        // Filter chips
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FILTERS.forEach { f ->
                val selected = f == filter
                Surface(
                    onClick = { viewModel.setFilter(f) },
                    shape = RoundedCornerShape(20.dp),
                    color = if (selected) RuvoColors.lime else RuvoColors.surface,
                    border = if (selected) null else BorderStroke(1.dp, RuvoColors.border),
                ) {
                    Text(f, modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp), style = MaterialTheme.typography.labelMedium, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal, color = if (selected) Color.Black else RuvoColors.textSecondary)
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        when {
            isSearching -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = RuvoColors.lime) }
            query.isBlank() -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(Icons.Default.Search, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(52.dp))
                    Text("Search for runners", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textSecondary)
                    Text("Find friends, training partners, and rivals", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textTertiary)
                }
            }
            results.isEmpty() -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("🔍", style = MaterialTheme.typography.displaySmall)
                    Text("No runners found for \"$query\"", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
                }
            }
            else -> LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(results, key = { it.uid }) { user ->
                    Surface(
                        shape = RoundedCornerShape(16.dp), color = RuvoColors.surface, border = BorderStroke(1.dp, RuvoColors.border), modifier = Modifier.fillMaxWidth(),
                    ) {
                        Row(modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Box(
                                modifier = Modifier.size(46.dp).clip(CircleShape).background(RuvoColors.surfaceElev).border(1.5.dp, RuvoColors.border, CircleShape).clickable { onUserProfile(user.uid) },
                                contentAlignment = Alignment.Center,
                            ) { Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(22.dp)) }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(user.name, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
                                Text("${String.format("%.0f", user.totalKm)} km${if (user.country.isNotBlank()) " · ${user.country}" else ""}", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                            }
                            if (user.isFollowing) {
                                OutlinedButton(onClick = { viewModel.toggleFollow(user.uid) }, shape = RoundedCornerShape(20.dp), border = BorderStroke(1.dp, RuvoColors.lime), contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)) { Text("Following", style = MaterialTheme.typography.labelSmall, color = RuvoColors.lime) }
                            } else {
                                Button(onClick = { viewModel.toggleFollow(user.uid) }, shape = RoundedCornerShape(20.dp), colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black), contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)) { Text("Follow", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold) }
                            }
                        }
                    }
                }
                item { Spacer(Modifier.height(80.dp)) }
            }
        }
    }
}
