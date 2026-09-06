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
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*

private val tabs = listOf("Feed", "Clubs", "Challenges", "Leaderboard", "Routes", "Segments")

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
            4 -> RoutesTab(uiState = uiState)
            5 -> com.ruvo.app.features.segments.SegmentsTab()
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
            // Feed = your own runs + people you follow's runs — empty means
            // either no logged runs yet, or nobody you follow has any.
            item { EmptyState(icon = "🏃", message = "No runs yet. Log a run, or follow other runners to see theirs here!") }
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

            if (!item.photoUrl.isNullOrBlank()) {
                coil.compose.AsyncImage(
                    model = item.photoUrl,
                    contentDescription = "${item.userDisplayName}'s run photo",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth().height(200.dp).clip(RoundedCornerShape(12.dp)),
                )
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
        itemsIndexed(uiState.clubs, key = { _, club -> club.id }) { index, club ->
            ClubCard(rank = index + 1, club = club, onClick = { navController.navigate("club_detail/${club.id}") })
        }
        if (uiState.clubs.isEmpty()) {
            item { EmptyState(icon = "👥", message = "No clubs yet — be the first to create one!") }
        }
        item { Spacer(modifier = Modifier.height(80.dp)) }
    }
}

// rank/weeklyKm added for competitor-analysis Tier 2 #7 (club-vs-club) —
// same gold/silver/bronze rank-color pattern LeaderboardRow already uses
// for individual runners, applied to clubs now that they carry a real
// aggregate distance instead of the dead "weeklyKm" stat (see
// CommunityViewModel.loadClubs()'s comment).
@Composable
private fun ClubCard(rank: Int, club: CommunityClub, onClick: () -> Unit = {}) {
    val rankColor = when (rank) {
        1 -> Color(0xFFFFD700)
        2 -> Color(0xFFC0C0C0)
        3 -> Color(0xFFCD7F32)
        else -> RuvoColors.textTertiary
    }
    RuvoCard(modifier = Modifier.clickable { onClick() }) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "$rank",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = rankColor,
                modifier = Modifier.width(24.dp),
            )
            Box(
                modifier = Modifier.size(56.dp).clip(RoundedCornerShape(12.dp)).background(RuvoColors.limeDim),
                contentAlignment = Alignment.Center
            ) {
                Text(club.emoji, style = MaterialTheme.typography.headlineLarge)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(club.name, style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
                // club.city is always "" — club creation never collects a location at
                // all (see CommunityViewModel.loadClubs()'s comment) — so this avoids a
                // dangling "· " separator with nothing after it rather than inventing a
                // city value.
                val subtitle = "${club.membersCount} member${if (club.membersCount == 1) "" else "s"}" +
                    (if (club.city.isNotBlank()) " · ${club.city}" else "")
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(String.format("%.1f km", club.weeklyKm), style = MaterialTheme.typography.titleSmall, color = RuvoColors.lime)
                Text("this week", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
            }
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
    val featured = challenge.xpReward >= 5000
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(RuvoColors.surface)
            .border(1.dp, if (challenge.isJoined) RuvoColors.lime.copy(alpha = 0.4f) else RuvoColors.border, RoundedCornerShape(20.dp)),
    ) {
        // Hero banner
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(96.dp)
                .background(
                    Brush.linearGradient(
                        if (featured) listOf(RuvoColors.lime.copy(alpha = 0.25f), Color(0xFF1A1A0A))
                        else listOf(Color(0xFF1A1A2E), Color(0xFF0F3460))
                    )
                ),
        ) {
            Icon(
                Icons.Default.EmojiEvents,
                contentDescription = null,
                tint = RuvoColors.lime.copy(alpha = 0.3f),
                modifier = Modifier.size(56.dp).align(Alignment.Center),
            )
            if (featured) {
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = RuvoColors.lime,
                    modifier = Modifier.align(Alignment.TopStart).padding(10.dp),
                ) {
                    Text("FEATURED", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = Color.Black, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp), fontSize = 9.sp)
                }
            }
            Surface(
                shape = RoundedCornerShape(6.dp),
                color = Color.Black.copy(alpha = 0.7f),
                modifier = Modifier.align(Alignment.TopEnd).padding(10.dp),
            ) {
                Text("${challenge.daysLeft}d left", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = Color.White, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp), fontSize = 9.sp)
            }
        }

        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(challenge.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = RuvoColors.textPrimary)
                    Text(challenge.description, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                RewardChip(icon = Icons.Default.Bolt, label = "+${challenge.xpReward} XP", color = RuvoColors.lime)
                RewardChip(icon = Icons.Default.MonetizationOn, label = "${challenge.coinReward}", color = Color(0xFFEAB308))
            }

            LinearProgressIndicator(
                progress = { challenge.progressFraction },
                modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                color = RuvoColors.lime,
                trackColor = RuvoColors.border,
            )
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Default.People, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(14.dp))
                    Text("${challenge.participantsCount} joined", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                }
                if (!challenge.isJoined) {
                    RuvoButton(text = "Join", onClick = onJoin, style = RuvoButtonVariant.Primary, fullWidth = false)
                } else {
                    RuvoChip(label = "Joined ✓", isActive = false)
                }
            }
        }
    }
}

@Composable
private fun RewardChip(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, color: Color) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = color.copy(alpha = 0.12f),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(13.dp))
            Text(label, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = color)
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
    val rankColor = when {
        rank == 1 -> Color(0xFFFFD700)
        rank == 2 -> Color(0xFFC0C0C0)
        rank == 3 -> Color(0xFFCD7F32)
        isCurrentUser -> RuvoColors.lime
        else -> RuvoColors.textTertiary
    }
    Surface(
        color = if (isCurrentUser) RuvoColors.limeDim else RuvoColors.surface,
        shape = RoundedCornerShape(12.dp),
        border = if (isCurrentUser) BorderStroke(1.dp, RuvoColors.lime.copy(alpha = 0.4f)) else null,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "$rank",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = rankColor,
                modifier = Modifier.width(28.dp),
            )
            Box(modifier = Modifier.size(42.dp).clip(CircleShape).background(RuvoColors.surfaceElev).border(1.dp, RuvoColors.border, CircleShape), contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(20.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(entry.displayName, style = MaterialTheme.typography.titleSmall, color = if (isCurrentUser) RuvoColors.lime else RuvoColors.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Default.BarChart, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(11.dp))
                    Text("${String.format("%.1f", entry.totalDistanceKm)} km", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                }
            }
            if (rank <= 3) {
                Icon(
                    if (rank == 1) Icons.Default.EmojiEvents else Icons.Default.MilitaryTech,
                    contentDescription = null,
                    tint = rankColor,
                    modifier = Modifier.size(20.dp),
                )
            } else {
                Column(horizontalAlignment = Alignment.End) {
                    Text("${entry.xp} XP", style = MaterialTheme.typography.labelSmall, color = RuvoColors.lime, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// Route Discovery (competitor-analysis Tier 2 #8) — "popular routes among
// people you follow," grouped from routeCoordinates every GPS-tracked run
// already stores. See CommunityViewModel.loadRoutes()/clusterRoutesByStartPoint
// for why this is Following+self scoped rather than a true global search.
@Composable
private fun RoutesTab(uiState: CommunityUiState) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(uiState.routes, key = { it.clusterId }) { route -> RouteCard(route) }
        if (uiState.routes.isEmpty()) {
            item { EmptyState(icon = "🗺️", message = "No routes yet. Once you or people you follow log a GPS run, it shows up here.") }
        }
        item { Spacer(modifier = Modifier.height(80.dp)) }
    }
}

@Composable
private fun RouteCard(route: PopularRoute) {
    RuvoCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            RouteSketch(points = route.previewPoints, modifier = Modifier.fillMaxWidth().height(110.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    String.format("%.1f km", route.approxDistanceKm),
                    style = MaterialTheme.typography.titleMedium,
                    color = RuvoColors.textPrimary,
                )
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = RuvoColors.limeDim,
                ) {
                    Text(
                        if (route.runCount == 1) "1 run" else "${route.runCount} runs",
                        style = MaterialTheme.typography.labelSmall,
                        color = RuvoColors.lime,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                    )
                }
            }
            Text(
                "Run by " + route.runnerNames.take(3).joinToString(", ") +
                    if (route.runnerNames.size > 3) " +${route.runnerNames.size - 3} more" else "",
                style = MaterialTheme.typography.bodySmall,
                color = RuvoColors.textSecondary,
            )
        }
    }
}

// Deliberately a lightweight Canvas sketch, not a real GoogleMap+Polyline
// instance per card (RunDetailScreen.kt's RunRouteMap pattern) — a
// scrollable list of many real map instances would mean many live tile
// fetches at once just to show a preview shape; this needs no network at
// all. Points are normalized to fit the box preserving aspect ratio (scaled
// by whichever axis spans further), so a route isn't stretched into a
// different shape than it actually is.
@Composable
private fun RouteSketch(points: List<Pair<Double, Double>>, modifier: Modifier = Modifier) {
    Box(modifier = modifier.clip(RoundedCornerShape(12.dp)).background(RuvoColors.surfaceElev)) {
        if (points.size < 2) return@Box
        val lats = points.map { it.first }
        val lngs = points.map { it.second }
        val latSpan = (lats.max() - lats.min()).coerceAtLeast(0.00001)
        val lngSpan = (lngs.max() - lngs.min()).coerceAtLeast(0.00001)
        val minLat = lats.min(); val minLng = lngs.min()
        Canvas(modifier = Modifier.fillMaxSize().padding(14.dp)) {
            val span = maxOf(latSpan, lngSpan)
            val offsetX = (span - lngSpan) / 2.0
            val offsetY = (span - latSpan) / 2.0
            val path = Path()
            points.forEachIndexed { i, (lat, lng) ->
                // Screen y grows downward; latitude grows northward, so flip it.
                val nx = ((lng - minLng + offsetX) / span).toFloat() * size.width
                val ny = (1f - ((lat - minLat + offsetY) / span).toFloat()) * size.height
                if (i == 0) path.moveTo(nx, ny) else path.lineTo(nx, ny)
            }
            drawPath(path, color = RuvoColors.lime, style = Stroke(width = 5f))
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
