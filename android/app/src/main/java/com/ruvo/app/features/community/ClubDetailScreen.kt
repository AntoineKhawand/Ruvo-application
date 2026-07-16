package com.ruvo.app.features.community

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
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
    val myName: String = "Runner",
    val isPosting: Boolean = false,
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
                val meDoc = firestore.collection("users").document(myUid).get().await()
                val myName = meDoc.getString("name") ?: meDoc.getString("displayName") ?: "Runner"
                _uiState.update { it.copy(myName = myName) }

                val clubDoc = firestore.collection("clubs").document(clubId).get().await()
                val d = clubDoc.data ?: return@launch

                @Suppress("UNCHECKED_CAST")
                val memberIds = (d["members"] as? List<String>) ?: emptyList()
                val isJoined = memberIds.contains(myUid)
                val createdBy = d["createdBy"] as? String
                val club = Club(
                    id = clubId,
                    name = d["name"] as? String ?: "Club",
                    description = d["description"] as? String ?: "",
                    type = d["type"] as? String ?: "public",
                    icon = d["icon"] as? String ?: "run",
                    color = Color(0xFFDFFF00),
                    memberCount = memberIds.size,
                    weeklyKm = (d["weeklyKm"] as? Number)?.toDouble() ?: 0.0,
                    isJoined = isJoined,
                    role = if (createdBy == myUid) "admin" else "member",
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

                // Load members (chunked whereIn, Firestore caps at 10 per query)
                if (memberIds.isNotEmpty()) {
                    val members = memberIds.chunked(10).flatMap { chunk ->
                        val snap = firestore.collection("users")
                            .whereIn(com.google.firebase.firestore.FieldPath.documentId(), chunk)
                            .get().await()
                        snap.documents.map { doc ->
                            ClubMember(
                                uid = doc.id,
                                name = doc.getString("name") ?: doc.getString("displayName") ?: "Runner",
                                weeklyKm = doc.getDouble("weeklyDistance") ?: 0.0,
                                role = if (doc.id == createdBy) "admin" else "member",
                            )
                        }
                    }.sortedByDescending { it.weeklyKm }
                    _uiState.update { it.copy(members = members) }
                }

            } catch (_: Exception) {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }

    fun toggleLike(clubId: String, postId: String) {
        val myUid = auth.currentUser?.uid ?: return
        val current = _uiState.value.posts.find { it.id == postId } ?: return
        val wasLiked = current.isLiked
        _uiState.update { state ->
            state.copy(posts = state.posts.map { p ->
                if (p.id == postId) p.copy(isLiked = !wasLiked, likesCount = if (wasLiked) p.likesCount - 1 else p.likesCount + 1) else p
            })
        }
        viewModelScope.launch {
            try {
                val postRef = firestore.collection("clubs").document(clubId).collection("posts").document(postId)
                if (wasLiked) postRef.update("likes", com.google.firebase.firestore.FieldValue.arrayRemove(myUid)).await()
                else postRef.update("likes", com.google.firebase.firestore.FieldValue.arrayUnion(myUid)).await()
            } catch (_: Exception) {
                _uiState.update { state ->
                    state.copy(posts = state.posts.map { p ->
                        if (p.id == postId) p.copy(isLiked = wasLiked, likesCount = current.likesCount) else p
                    })
                }
            }
        }
    }

    fun addPost(clubId: String, text: String) {
        if (text.isBlank()) return
        viewModelScope.launch {
            _uiState.update { it.copy(isPosting = true) }
            try {
                val myName = _uiState.value.myName
                val doc = firestore.collection("clubs").document(clubId).collection("posts").add(
                    mapOf(
                        "authorName" to myName,
                        "content" to text.trim(),
                        "timestamp" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                        "likes" to emptyList<String>(),
                    )
                ).await()
                val newPost = ClubPost(id = doc.id, authorName = myName, content = text.trim(), timestampMs = System.currentTimeMillis(), likesCount = 0, isLiked = false)
                _uiState.update { it.copy(posts = listOf(newPost) + it.posts) }
            } catch (_: Exception) {
            } finally {
                _uiState.update { it.copy(isPosting = false) }
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
    var postText by remember { mutableStateOf("") }
    var showLeaveConfirm by remember { mutableStateOf(false) }

    LaunchedEffect(clubId) { viewModel.load(clubId) }

    if (uiState.isLoading) {
        Box(modifier = Modifier.fillMaxSize().background(RuvoColors.background), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = RuvoColors.lime) }
        return
    }

    val club = uiState.club ?: return

    if (showLeaveConfirm) {
        AlertDialog(
            onDismissRequest = { showLeaveConfirm = false },
            title = { Text("Leave Club?") },
            text = { Text("Are you sure?") },
            confirmButton = {
                TextButton(onClick = { showLeaveConfirm = false; viewModel.toggleJoin(clubId) }) { Text("Leave", color = RuvoColors.error) }
            },
            dismissButton = { TextButton(onClick = { showLeaveConfirm = false }) { Text("Cancel", color = RuvoColors.textTertiary) } },
            containerColor = RuvoColors.surface,
            titleContentColor = RuvoColors.textPrimary,
            textContentColor = RuvoColors.textSecondary,
        )
    }

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
                onClick = { if (club.isJoined) showLeaveConfirm = true else viewModel.toggleJoin(clubId) },
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
                    if (club.isJoined) {
                        item {
                            Surface(shape = RoundedCornerShape(16.dp), color = RuvoColors.surface, border = BorderStroke(1.dp, RuvoColors.border), modifier = Modifier.fillMaxWidth()) {
                                Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedTextField(
                                        value = postText,
                                        onValueChange = { postText = it },
                                        modifier = Modifier.weight(1f),
                                        placeholder = { Text("Share with your club…", color = RuvoColors.textTertiary) },
                                        maxLines = 4,
                                        shape = RoundedCornerShape(20.dp),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = RuvoColors.lime,
                                            unfocusedBorderColor = RuvoColors.border,
                                            focusedContainerColor = RuvoColors.surfaceElev,
                                            unfocusedContainerColor = RuvoColors.surfaceElev,
                                            focusedTextColor = RuvoColors.textPrimary,
                                            unfocusedTextColor = RuvoColors.textPrimary,
                                        ),
                                    )
                                    IconButton(
                                        onClick = { if (postText.isNotBlank()) { viewModel.addPost(clubId, postText); postText = "" } },
                                        enabled = postText.isNotBlank() && !uiState.isPosting,
                                    ) {
                                        if (uiState.isPosting) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = RuvoColors.lime, strokeWidth = 2.dp)
                                        else Icon(Icons.Default.Send, contentDescription = "Post", tint = if (postText.isNotBlank()) RuvoColors.lime else RuvoColors.textTertiary)
                                    }
                                }
                            }
                        }
                    }
                    if (uiState.posts.isEmpty()) {
                        item {
                            Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text("📝", fontSize = 40.sp)
                                    Text("No posts yet", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
                                }
                            }
                        }
                    } else {
                        items(uiState.posts, key = { it.id }) { post ->
                            ClubPostCard(post = post, onLike = { viewModel.toggleLike(clubId, post.id) })
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
                    if (uiState.members.isEmpty()) {
                        item { Text("Leaderboard loading…", color = RuvoColors.textTertiary, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center) }
                    } else {
                        itemsIndexed(uiState.members, key = { _, m -> m.uid }) { index, member ->
                            val rank = index + 1
                            val rankColor = when (rank) {
                                1 -> Color(0xFFFFD700)
                                2 -> Color(0xFFC0C0C0)
                                3 -> Color(0xFFCD7F32)
                                else -> RuvoColors.textTertiary
                            }
                            Surface(
                                onClick = { onUserProfile(member.uid) },
                                shape = RoundedCornerShape(14.dp),
                                color = RuvoColors.surface,
                                border = BorderStroke(1.dp, RuvoColors.border),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Text("$rank", style = MaterialTheme.typography.titleMedium, color = rankColor, fontWeight = FontWeight.Bold, modifier = Modifier.width(28.dp))
                                    Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(RuvoColors.surfaceElev), contentAlignment = Alignment.Center) { Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(18.dp)) }
                                    Text(member.name, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                                    Text("${String.format("%.1f", member.weeklyKm)} km", style = MaterialTheme.typography.labelMedium, color = RuvoColors.lime)
                                }
                            }
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(80.dp)) }
        }
    }
}

@Composable
private fun ClubPostCard(post: ClubPost, onLike: () -> Unit) {
    Surface(shape = RoundedCornerShape(16.dp), color = RuvoColors.surface, border = BorderStroke(1.dp, RuvoColors.border), modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(RuvoColors.surfaceElev), contentAlignment = Alignment.Center) { Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(18.dp)) }
                Column {
                    Text(post.authorName, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
                    val minAgo = ((System.currentTimeMillis() - post.timestampMs) / 60000).toInt().coerceAtLeast(0)
                    Text(if (minAgo < 60) "${minAgo}m ago" else "${minAgo / 60}h ago", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                }
            }
            Text(post.content, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary)
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable(onClick = onLike),
            ) {
                Icon(if (post.isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder, contentDescription = "Like", tint = if (post.isLiked) Color(0xFFE53E3E) else RuvoColors.textTertiary, modifier = Modifier.size(18.dp))
                Text("${post.likesCount}", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }
        }
    }
}
