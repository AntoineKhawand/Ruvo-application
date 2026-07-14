package com.ruvo.app.features.community

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class Club(
    val id: String,
    val name: String,
    val description: String,
    val type: String,
    val icon: String,
    val color: Color,
    val memberCount: Int,
    val weeklyKm: Double,
    val isJoined: Boolean,
    val role: String,
)

data class ClubPost(
    val id: String,
    val authorName: String,
    val content: String,
    val timestampMs: Long,
    val likesCount: Int,
    val isLiked: Boolean,
)

data class ClubMember(
    val uid: String,
    val name: String,
    val weeklyKm: Double,
    val role: String,
)

data class ClubDetailUiState(
    val club: Club? = null,
    val posts: List<ClubPost> = emptyList(),
    val members: List<ClubMember> = emptyList(),
    val isLoading: Boolean = true,
    val activeTab: Int = 0,
)

@HiltViewModel
class ClubDetailViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ClubDetailUiState())
    val uiState: StateFlow<ClubDetailUiState> = _uiState.asStateFlow()

    fun load(clubId: String) {
        viewModelScope.launch {
            val myUid = auth.currentUser?.uid ?: return@launch
            try {
                val clubDoc = firestore.collection("clubs").document(clubId).get().await()
                val d = clubDoc.data ?: return@launch

                val isJoined = (d["members"] as? List<*>)?.contains(myUid) == true
                val club = Club(
                    id = clubId,
                    name = d["name"] as? String ?: "Club",
                    description = d["description"] as? String ?: "",
                    type = d["type"] as? String ?: "public",
                    icon = d["icon"] as? String ?: "run",
                    color = Color(0xFFDFFF00),
                    memberCount = (d["memberCount"] as? Number)?.toInt() ?: 0,
                    weeklyKm = (d["weeklyKm"] as? Number)?.toDouble() ?: 0.0,
                    isJoined = isJoined,
                    role = if (d["createdBy"] == myUid) "admin" else "member",
                )
                _uiState.update { it.copy(club = club, isLoading = false) }

                // Load posts
                val postsSnap = firestore.collection("clubs").document(clubId).collection("posts")
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .limit(20).get().await()
                val posts = postsSnap.documents.mapNotNull { doc ->
                    val pd = doc.data ?: return@mapNotNull null
                    val likes = (pd["likes"] as? List<*>) ?: emptyList<Any>()
                    ClubPost(
                        id = doc.id,
                        authorName = pd["authorName"] as? String ?: "Runner",
                        content = pd["content"] as? String ?: "",
                        timestampMs = (pd["timestamp"] as? com.google.firebase.Timestamp)?.toDate()?.time ?: 0L,
                        likesCount = likes.size,
                        isLiked = likes.contains(myUid),
                    )
                }
                _uiState.update { it.copy(posts = posts) }

            } catch (_: Exception) {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }

    fun setTab(tab: Int) = _uiState.update { it.copy(activeTab = tab) }

    fun toggleJoin(clubId: String) {
        viewModelScope.launch {
            val myUid = auth.currentUser?.uid ?: return@launch
            val club = _uiState.value.club ?: return@launch
            val clubRef = firestore.collection("clubs").document(clubId)
            val myRef = firestore.collection("users").document(myUid)

            if (club.isJoined) {
                clubRef.update("members", com.google.firebase.firestore.FieldValue.arrayRemove(myUid)).await()
                myRef.update("clubs", com.google.firebase.firestore.FieldValue.arrayRemove(clubId)).await()
            } else {
                clubRef.update("members", com.google.firebase.firestore.FieldValue.arrayUnion(myUid)).await()
                myRef.update("clubs", com.google.firebase.firestore.FieldValue.arrayUnion(clubId)).await()
            }
            _uiState.update { it.copy(club = club.copy(isJoined = !club.isJoined, memberCount = if (club.isJoined) club.memberCount - 1 else club.memberCount + 1)) }
        }
    }
}

private val TABS = listOf("Feed", "Members", "Leaderboard")

@Composable
fun ClubDetailScreen(
    clubId: String,
    onBack: () -> Unit = {},
    onUserProfile: (String) -> Unit = {},
    viewModel: ClubDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(clubId) { viewModel.load(clubId) }

    if (uiState.isLoading) {
        Box(modifier = Modifier.fillMaxSize().background(RuvoColors.background), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = RuvoColors.lime) }
        return
    }

    val club = uiState.club ?: return

    Column(modifier = Modifier.fillMaxSize().background(RuvoColors.background)) {
        // Cover
        Box(modifier = Modifier.fillMaxWidth().height(160.dp)) {
            Box(modifier = Modifier.fillMaxSize().background(Brush.linearGradient(listOf(club.color.copy(alpha = 0.3f), Color(0xFF050505)))))
            IconButton(onClick = onBack, modifier = Modifier.align(Alignment.TopStart).padding(8.dp)) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
            }
            Column(modifier = Modifier.align(Alignment.BottomStart).padding(horizontal = 16.dp, vertical = 12.dp)) {
                Text(club.name, style = MaterialTheme.typography.headlineMedium, color = Color.White, fontWeight = FontWeight.ExtraBold)
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("${club.memberCount} members", style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.7f))
                    Text("${String.format("%.0f", club.weeklyKm)} km this week", style = MaterialTheme.typography.bodySmall, color = RuvoColors.lime)
                }
            }
            Button(
                onClick = { viewModel.toggleJoin(clubId) },
                modifier = Modifier.align(Alignment.BottomEnd).padding(12.dp),
                shape = RoundedCornerShape(20.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (club.isJoined) RuvoColors.surface else RuvoColors.lime,
                    contentColor = if (club.isJoined) RuvoColors.textPrimary else Color.Black,
                ),
            ) {
                Text(if (club.isJoined) "Leave" else "Join", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
            }
        }

        if (club.description.isNotBlank()) {
            Text(club.description, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
        }

        // Tabs
        TabRow(selectedTabIndex = uiState.activeTab, containerColor = RuvoColors.background, contentColor = RuvoColors.lime, divider = { HorizontalDivider(color = RuvoColors.border) }) {
            TABS.forEachIndexed { i, label ->
                Tab(selected = uiState.activeTab == i, onClick = { viewModel.setTab(i) }, text = { Text(label, color = if (uiState.activeTab == i) RuvoColors.lime else RuvoColors.textSecondary, style = MaterialTheme.typography.labelLarge) })
            }
        }

        LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            when (uiState.activeTab) {
                0 -> {
                    if (uiState.posts.isEmpty()) {
                        item {
                            Box(modifier = Modifier.fillParentMaxSize(), contentAlignment = Alignment.Center) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text("📝", fontSize = 40.sp)
                                    Text("No posts yet", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
                                }
                            }
                        }
                    } else {
                        items(uiState.posts, key = { it.id }) { post ->
                            ClubPostCard(post = post)
                        }
                    }
                }
                1 -> {
                    if (uiState.members.isEmpty()) {
                        item { Text("Members loading…", color = RuvoColors.textTertiary, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center) }
                    } else {
                        items(uiState.members, key = { it.uid }) { member ->
                            Row(
                                modifier = Modifier.fillMaxWidth().clickable { onUserProfile(member.uid) }.padding(4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                Box(modifier = Modifier.size(40.dp).clip(CircleShape).background(RuvoColors.surfaceElev), contentAlignment = Alignment.Center) { Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary) }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(member.name, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
                                    Text(member.role.replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.bodySmall, color = if (member.role == "admin") RuvoColors.lime else RuvoColors.textTertiary)
                                }
                                Text("${String.format("%.1f", member.weeklyKm)} km", style = MaterialTheme.typography.labelMedium, color = RuvoColors.lime)
                            }
                        }
                    }
                }
                2 -> {
                    item { Text("Club leaderboard coming soon", color = RuvoColors.textTertiary, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center) }
                }
            }
            item { Spacer(Modifier.height(80.dp)) }
        }
    }
}

@Composable
private fun ClubPostCard(post: ClubPost) {
    Surface(shape = RoundedCornerShape(16.dp), color = RuvoColors.surface, border = BorderStroke(1.dp, RuvoColors.border), modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(RuvoColors.surfaceElev), contentAlignment = Alignment.Center) { Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(18.dp)) }
                Column {
                    Text(post.authorName, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
                    val minAgo = ((System.currentTimeMillis() - post.timestampMs) / 60000).toInt()
                    Text(if (minAgo < 60) "${minAgo}m ago" else "${minAgo / 60}h ago", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                }
            }
            Text(post.content, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary)
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(if (post.isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder, contentDescription = "Like", tint = if (post.isLiked) Color(0xFFE53E3E) else RuvoColors.textTertiary, modifier = Modifier.size(18.dp))
                Text("${post.likesCount}", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }
        }
    }
}
