package com.ruvo.app.features.community

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*

private val tabs = listOf("Feed", "Clubs", "Challenges", "Leaderboard")

@Composable
fun CommunityScreen(
    navController: NavController,
    viewModel: CommunityViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var selectedTab by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) { viewModel.loadAll() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Community", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)
            IconButton(onClick = { navController.navigate("find_friends") }) {
                Icon(Icons.Default.PersonAdd, contentDescription = "Find Runners", tint = RuvoColors.lime)
            }
        }

        // Tab row
        ScrollableTabRow(
            selectedTabIndex = selectedTab,
            containerColor = RuvoColors.background,
            contentColor = RuvoColors.lime,
            edgePadding = 16.dp,
            divider = { Divider(color = RuvoColors.border) }
        ) {
            tabs.forEachIndexed { i, label ->
                Tab(
                    selected = selectedTab == i,
                    onClick = { selectedTab = i },
                    text = {
                        Text(
                            label,
                            color = if (selectedTab == i) RuvoColors.lime else RuvoColors.textSecondary,
                            style = MaterialTheme.typography.labelLarge
                        )
                    }
                )
            }
        }

        when (selectedTab) {
            0 -> FeedTab(uiState = uiState, onToggleLike = { viewModel.toggleLike(it) }, onOpenComments = { userId, itemId -> viewModel.openComments(userId, itemId) })
            1 -> ClubsTab(uiState = uiState, navController = navController)
            2 -> ChallengesTab(uiState = uiState, onJoin = { viewModel.joinChallenge(it) })
            3 -> LeaderboardTab(uiState = uiState)
        }
    }

    if (uiState.commentsPostId != null) {
        CommentsSheet(
            uiState = uiState,
            onDismiss = { viewModel.closeComments() },
            onTextChange = { viewModel.updateCommentText(it) },
            onSend = { viewModel.sendComment() },
            onReplyTo = { viewModel.setReplyTo(it) },
            onClearReply = { viewModel.setReplyTo(null) },
        )
    }
}

@Composable
private fun FeedTab(uiState: CommunityUiState, onToggleLike: (String) -> Unit, onOpenComments: (String, String) -> Unit) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(uiState.feedItems, key = { it.id }) { item ->
            FeedCard(item = item, onToggleLike = { onToggleLike(item.id) }, onOpenComments = { onOpenComments(item.userId, item.id) })
        }
        if (uiState.feedItems.isEmpty()) {
            item { EmptyState(icon = "🏃", message = "No runs in the feed yet. Start running!") }
        }
        item { Spacer(modifier = Modifier.height(80.dp)) }
    }
}

@Composable
private fun FeedCard(item: CommunityFeedItem, onToggleLike: () -> Unit, onOpenComments: () -> Unit) {
    RuvoCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            // User header
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    modifier = Modifier.size(40.dp).clip(CircleShape).background(RuvoColors.surfaceElev).border(1.5.dp, RuvoColors.lime, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(20.dp))
                }
                Column {
                    Text(item.userDisplayName, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary)
                    Text(item.timeAgo, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                }
            }

            // Run stats inline
            if (item.distanceKm != null) {
                Surface(
                    color = RuvoColors.surfaceElev,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        InlineStat("Distance", String.format("%.2f km", item.distanceKm))
                        InlineStat("Pace", item.paceFormatted ?: "--:--")
                        InlineStat("Time", item.durationFormatted ?: "--")
                    }
                }
            }

            // Actions
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                TextButton(onClick = onToggleLike) {
                    Icon(
                        if (item.isLikedByMe) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                        contentDescription = null,
                        tint = if (item.isLikedByMe) Color(0xFFE53E3E) else RuvoColors.textTertiary,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.width(4.dp))
                    Text("${item.likesCount}", color = RuvoColors.textSecondary, style = MaterialTheme.typography.bodySmall)
                }
                TextButton(onClick = onOpenComments) {
                    Icon(Icons.Outlined.ChatBubbleOutline, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("${item.commentsCount}", color = RuvoColors.textSecondary, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun InlineStat(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
        Text(label, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
    }
}

@Composable
private fun ClubsTab(uiState: CommunityUiState, navController: NavController) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            RuvoButton(text = "＋ Create Club", onClick = { navController.navigate("create_club") })
        }
        items(uiState.clubs, key = { it.id }) { club ->
            ClubCard(club = club, onClick = { navController.navigate("club_detail/${club.id}") })
        }
        if (uiState.clubs.isEmpty()) {
            item { EmptyState(icon = "👥", message = "No clubs yet — be the first to create one!") }
        }
        item { Spacer(modifier = Modifier.height(80.dp)) }
    }
}

@Composable
private fun ClubCard(club: CommunityClub, onClick: () -> Unit = {}) {
    RuvoCard(modifier = Modifier.clickable { onClick() }) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(56.dp).clip(RoundedCornerShape(12.dp)).background(RuvoColors.limeDim),
                contentAlignment = Alignment.Center
            ) {
                Text(club.emoji, style = MaterialTheme.typography.headlineLarge)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(club.name, style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
                Text("${club.membersCount} members · ${club.city}", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            }
            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = RuvoColors.textTertiary)
        }
    }
}

@Composable
private fun ChallengesTab(uiState: CommunityUiState, onJoin: (String) -> Unit) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(uiState.challenges, key = { it.id }) { challenge ->
            ChallengeCard(challenge = challenge, onJoin = { onJoin(challenge.id) })
        }
        if (uiState.challenges.isEmpty()) {
            item { EmptyState(icon = "🏆", message = "No active challenges right now.") }
        }
        item { Spacer(modifier = Modifier.height(80.dp)) }
    }
}

@Composable
private fun ChallengeCard(challenge: CommunityChallengeItem, onJoin: () -> Unit) {
    RuvoCard(isHighlighted = challenge.isJoined) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(challenge.title, style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
                    Text(challenge.description, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                Column(horizontalAlignment = Alignment.End) {
                    RuvoChip(label = "+${challenge.xpReward} XP", isActive = true)
                    Spacer(Modifier.height(4.dp))
                    Text("🪙 ${challenge.coinReward}", style = MaterialTheme.typography.labelSmall, color = Color(0xFFEAB308))
                }
            }
            LinearProgressIndicator(
                progress = { challenge.progressFraction },
                modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                color = RuvoColors.lime,
                trackColor = RuvoColors.border,
            )
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("${challenge.participantsCount} runners joined · ${challenge.daysLeft}d left",
                    style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                if (!challenge.isJoined) {
                    RuvoButton(text = "Join", onClick = onJoin, style = RuvoButtonVariant.Primary)
                } else {
                    RuvoChip(label = "Joined ✓", isActive = false)
                }
            }
        }
    }
}

@Composable
private fun LeaderboardTab(uiState: CommunityUiState) {
    val currentUid = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        itemsIndexed(uiState.leaderboard, key = { _, entry -> entry.userId }) { idx, entry ->
            LeaderboardRow(rank = idx + 1, entry = entry, isCurrentUser = entry.userId == currentUid)
        }
        if (uiState.leaderboard.isEmpty()) {
            item { EmptyState(icon = "📊", message = "Leaderboard loads after your first run.") }
        }
        item { Spacer(modifier = Modifier.height(80.dp)) }
    }
}

@Composable
private fun LeaderboardRow(rank: Int, entry: LeaderboardEntry, isCurrentUser: Boolean) {
    val rankEmoji = when (rank) { 1 -> "🥇"; 2 -> "🥈"; 3 -> "🥉"; else -> "#$rank" }
    Surface(
        color = if (isCurrentUser) RuvoColors.limeDim else RuvoColors.surface,
        shape = RoundedCornerShape(12.dp),
        border = if (isCurrentUser) BorderStroke(1.dp, RuvoColors.lime) else null,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(rankEmoji, style = MaterialTheme.typography.titleLarge, modifier = Modifier.width(36.dp))
            Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(RuvoColors.surfaceElev).border(1.dp, RuvoColors.border, CircleShape), contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(18.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(entry.displayName, style = MaterialTheme.typography.titleSmall, color = if (isCurrentUser) RuvoColors.lime else RuvoColors.textPrimary)
                Text("Level ${entry.level}", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text("${String.format("%.1f", entry.totalDistanceKm)} km", style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary)
                Text("${entry.xp} XP", style = MaterialTheme.typography.bodySmall, color = RuvoColors.lime)
            }
        }
    }
}

@Composable
private fun EmptyState(icon: String, message: String) {
    Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(icon, style = MaterialTheme.typography.displayLarge)
            Text(message, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CommentsSheet(
    uiState: CommunityUiState,
    onDismiss: () -> Unit,
    onTextChange: (String) -> Unit,
    onSend: () -> Unit,
    onReplyTo: (String) -> Unit,
    onClearReply: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = RuvoColors.surface) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                "Comments",
                style = MaterialTheme.typography.headlineSmall,
                color = RuvoColors.textPrimary,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
            )
            HorizontalDivider(color = RuvoColors.border)

            if (uiState.comments.isEmpty()) {
                Column(
                    modifier = Modifier.fillMaxWidth().height(220.dp).padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Icon(Icons.Outlined.ChatBubbleOutline, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(32.dp))
                    Spacer(Modifier.height(8.dp))
                    Text("No comments yet. Be the first!", color = RuvoColors.textTertiary, style = MaterialTheme.typography.bodyMedium)
                }
            } else {
                LazyColumn(modifier = Modifier.heightIn(max = 340.dp), contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    items(uiState.comments, key = { it.id }) { comment ->
                        Row(
                            modifier = Modifier.fillMaxWidth().clickable { onReplyTo(comment.userName) },
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Box(
                                modifier = Modifier.size(32.dp).clip(CircleShape).background(RuvoColors.surfaceElev),
                                contentAlignment = Alignment.Center,
                            ) { Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(16.dp)) }
                            Column(modifier = Modifier.weight(1f)) {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text(comment.userName, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary)
                                    Text(comment.timeAgo, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                                }
                                Text(comment.text, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
                            }
                        }
                    }
                }
            }

            uiState.replyTo?.let { replyingTo ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Replying to ", color = RuvoColors.textTertiary, style = MaterialTheme.typography.bodySmall)
                    Text(replyingTo, color = RuvoColors.lime, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
                    IconButton(onClick = onClearReply) { Icon(Icons.Default.Close, contentDescription = "Cancel reply", tint = RuvoColors.textTertiary, modifier = Modifier.size(16.dp)) }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedTextField(
                    value = uiState.commentText,
                    onValueChange = onTextChange,
                    placeholder = { Text("Add a comment…", color = RuvoColors.textTertiary) },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = RuvoColors.textPrimary, unfocusedTextColor = RuvoColors.textPrimary,
                        focusedBorderColor = RuvoColors.lime, unfocusedBorderColor = RuvoColors.border,
                    ),
                )
                IconButton(
                    onClick = onSend,
                    enabled = uiState.commentText.isNotBlank(),
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(if (uiState.commentText.isNotBlank()) RuvoColors.lime else RuvoColors.surfaceElev),
                ) { Icon(Icons.Default.Send, contentDescription = "Send", tint = if (uiState.commentText.isNotBlank()) Color.Black else RuvoColors.textTertiary) }
            }
        }
    }
}
