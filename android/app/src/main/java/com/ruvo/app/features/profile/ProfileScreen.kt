package com.ruvo.app.features.profile

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.ruvo.app.core.model.Tip
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*
import com.ruvo.app.features.achievements.ALL_BADGES
import com.ruvo.app.features.gear.Shoe

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(navController: NavController? = null, viewModel: ProfileViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showEdit by remember { mutableStateOf(false) }
    var showSettings by remember { mutableStateOf(false) }
    val context = LocalContext.current

    // System Photo Picker — no runtime permission needed (unlike
    // ACTION_GET_CONTENT/READ_MEDIA_IMAGES), matching RN's AvatarPickerModal
    // being a simple "pick one image" flow with no gallery browsing UI of its own.
    val avatarPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia(),
    ) { uri -> if (uri != null) viewModel.uploadAvatar(uri) }

    LaunchedEffect(Unit) { viewModel.loadProfile() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
            .verticalScroll(rememberScrollState())
    ) {
        // Cover gradient + avatar
        ProfileHeaderSection(
            uiState = uiState,
            onEdit = { showEdit = true },
            onSettings = { showSettings = true },
            onFollow = { viewModel.toggleFollow() },
            onAvatarClick = {
                avatarPickerLauncher.launch(
                    androidx.activity.result.PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                )
            },
            onShare = {
                // RN shares `https://ruvo.app/u/{username}`; Android has no
                // username system yet (see UserContext.js's `usernames/{name}`
                // reservation doc — not built here), so this uses the uid as a
                // pragmatic stand-in until that lands.
                val uid = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid
                if (uid != null) {
                    val shareIntent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(android.content.Intent.EXTRA_TEXT, "Follow my runs on Ruvo! https://ruvo.app/u/$uid")
                    }
                    context.startActivity(android.content.Intent.createChooser(shareIntent, "Share your profile"))
                }
            },
            onRefresh = { viewModel.loadProfile() },
        )

        // Stats row
        ProfileStatsRow(uiState = uiState)

        Spacer(modifier = Modifier.height(16.dp))

        WeeklyActivityCard(runDates = uiState.runDates)

        uiState.primaryShoe?.let { shoe ->
            Spacer(modifier = Modifier.height(16.dp))
            GearPreviewCard(shoe = shoe, onClick = { navController?.navigate("shoes") })
        }

        Spacer(modifier = Modifier.height(16.dp))

        AchievementsPreviewCard(earnedBadgeIds = uiState.earnedBadgeIds, onClick = { navController?.navigate("achievements") })

        Spacer(modifier = Modifier.height(16.dp))

        // Recent Activity — replaces the old bare distance-only grid with
        // dated/typed run cards + an All/This Week filter (RN's own date-picker
        // modal wasn't ported — a reasonable, honest scope cut for a first pass).
        var activityFilter by remember { mutableStateOf("All") }
        val today = remember { java.time.LocalDate.now() }
        val filteredRuns = remember(uiState.recentRuns, activityFilter, today) {
            if (activityFilter == "This Week") {
                uiState.recentRuns.filter { it.date.isAfter(today.minusDays(7)) }
            } else {
                uiState.recentRuns
            }
        }
        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Recent Activity", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("All", "This Week").forEach { option ->
                        val selected = option == activityFilter
                        Surface(
                            onClick = { activityFilter = option },
                            shape = RoundedCornerShape(999.dp),
                            color = if (selected) RuvoColors.lime else RuvoColors.surfaceElev,
                        ) {
                            Text(
                                option,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                                color = if (selected) Color.Black else RuvoColors.textSecondary,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            )
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            if (filteredRuns.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxWidth().height(80.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(if (activityFilter == "This Week") "No runs this week" else "No runs yet", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textTertiary)
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    filteredRuns.forEach { run -> RunActivityCard(run = run, today = today) }
                }
            }
        }

        // Saved Tips — personal bookmark shelf, so like Edit Profile/avatar
        // upload this only shows on one's own profile (ProfileViewModel only
        // populates uiState.savedTips when isOwnProfile).
        if (uiState.isOwnProfile) {
            Spacer(modifier = Modifier.height(16.dp))
            SavedTipsCard(tips = uiState.savedTips, onTipClick = { tipId -> navController?.navigate("tip_detail/$tipId") })
        }

        Spacer(modifier = Modifier.height(80.dp))
    }

    if (showEdit) {
        EditProfileSheet(
            uiState = uiState,
            onDismiss = { showEdit = false },
            onSave = { name, bio, loc -> viewModel.updateProfile(name, bio, loc); showEdit = false },
        )
    }

    if (showSettings) {
        SettingsSheet(
            onDismiss = { showSettings = false },
            onSignOut = { viewModel.signOut() },
            onNavigate = { route ->
                showSettings = false
                navController?.navigate(route)
            },
        )
    }
}

@Composable
private fun ProfileHeaderSection(
    uiState: ProfileUiState,
    onEdit: () -> Unit,
    onSettings: () -> Unit,
    onFollow: () -> Unit,
    onShare: () -> Unit = {},
    onRefresh: () -> Unit = {},
    onAvatarClick: () -> Unit = {},
) {
    Box(modifier = Modifier.fillMaxWidth().height(200.dp)) {
        // Cover gradient
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(140.dp)
                .background(Brush.linearGradient(listOf(Color(0xFF0A1A00), Color(0xFF1A2F00), RuvoColors.limeDim)))
        )

        // Settings + share + refresh buttons
        Row(modifier = Modifier.align(Alignment.TopEnd).padding(12.dp)) {
            IconButton(onClick = onRefresh, enabled = !uiState.isRefreshing) {
                if (uiState.isRefreshing) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = RuvoColors.textSecondary)
                } else {
                    Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = RuvoColors.textSecondary)
                }
            }
            if (uiState.isOwnProfile) {
                IconButton(onClick = onShare) {
                    Icon(Icons.Default.Share, contentDescription = "Share profile", tint = RuvoColors.textSecondary)
                }
            }
            IconButton(onClick = onSettings) {
                Icon(Icons.Default.Settings, contentDescription = "Settings", tint = RuvoColors.textSecondary)
            }
        }

        // Avatar
        Box(modifier = Modifier.align(Alignment.BottomStart).padding(horizontal = 20.dp)) {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(RuvoColors.surfaceElev)
                    .border(3.dp, RuvoColors.lime, CircleShape)
                    .then(if (uiState.isOwnProfile) Modifier.clickable(onClick = onAvatarClick) else Modifier),
                contentAlignment = Alignment.Center
            ) {
                if (uiState.avatarUrl != null) {
                    coil.compose.AsyncImage(
                        model = uiState.avatarUrl,
                        contentDescription = "Profile photo",
                        contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                        modifier = Modifier.fillMaxSize().clip(CircleShape),
                    )
                } else {
                    Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(40.dp))
                }
                if (uiState.isUploadingAvatar) {
                    Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.5f)), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp, color = RuvoColors.lime)
                    }
                }
            }
            if (uiState.isOwnProfile) {
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(RuvoColors.lime)
                        .border(2.dp, RuvoColors.background, CircleShape)
                        .clickable(onClick = onAvatarClick),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.CameraAlt, contentDescription = "Change photo", tint = Color.Black, modifier = Modifier.size(14.dp))
                }
            }
        }

        // Action buttons
        Row(
            modifier = Modifier.align(Alignment.BottomEnd).padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (uiState.isOwnProfile) {
                RuvoButton(text = "Edit Profile", onClick = onEdit, style = RuvoButtonVariant.Secondary)
            } else {
                RuvoButton(
                    text = if (uiState.isFollowing) "Following" else "Follow",
                    onClick = onFollow,
                    style = if (uiState.isFollowing) RuvoButtonVariant.Secondary else RuvoButtonVariant.Primary
                )
                RuvoButton(text = "Message", onClick = {}, style = RuvoButtonVariant.Secondary)
            }
        }
    }

    // Name & bio
    Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(uiState.displayName, style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
            Surface(shape = RoundedCornerShape(8.dp), color = RuvoColors.lime.copy(alpha = 0.12f)) {
                Text(
                    levelTitle(uiState.level),
                    style = MaterialTheme.typography.labelSmall,
                    color = RuvoColors.lime,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                )
            }
        }
        if (uiState.bio.isNotBlank()) Text(uiState.bio, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
        if (uiState.location.isNotBlank()) {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.LocationOn, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(14.dp))
                Text(uiState.location, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }
        }

        // XP progress bar — same pattern as UserProfileScreen.kt's (other
        // users' profile) already-working bar. Per archive §9: RN's level/
        // currentXP/xpToNextLevel are static defaults that never increment
        // anywhere in the real app — this only displays whatever value is
        // already on the doc, no level-up logic invented.
        Spacer(Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("XP Progress", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
            Text("${uiState.currentXP} / ${uiState.xpToNextLevel}", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
        }
        Spacer(Modifier.height(4.dp))
        LinearProgressIndicator(
            progress = { (uiState.currentXP / uiState.xpToNextLevel.toFloat()).coerceIn(0f, 1f) },
            modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
            color = RuvoColors.lime,
            trackColor = RuvoColors.surfaceElev,
        )
    }
}

@Composable
private fun ProfileStatsRow(uiState: ProfileUiState) {
    Surface(
        color = RuvoColors.surface,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            ProfileStat(label = "Runs", value = "${uiState.totalRuns}")
            Divider(modifier = Modifier.width(1.dp).height(40.dp), color = RuvoColors.border)
            ProfileStat(label = "Km", value = String.format("%.0f", uiState.totalDistanceKm))
            Divider(modifier = Modifier.width(1.dp).height(40.dp), color = RuvoColors.border)
            ProfileStat(label = "Following", value = "${uiState.followingCount}")
            Divider(modifier = Modifier.width(1.dp).height(40.dp), color = RuvoColors.border)
            ProfileStat(label = "Followers", value = "${uiState.followersCount}")
        }
    }
}

// RN has no persisted streak counter (RN_SOURCE_ARCHIVE.md §9: "no streak-
// tracking system exists tied to XP/coins" — the only streak-adjacent logic
// is the `b_perfect_week` badge recomputing consecutive-day-run status from
// scratch every render). This follows the same pattern: not read from a
// stored field, walked backward from today over the actual run dates.
private fun computeStreak(runDates: Set<java.time.LocalDate>): Int {
    var day = java.time.LocalDate.now()
    if (day !in runDates) day = day.minusDays(1) // today not run yet doesn't break the streak
    var streak = 0
    while (day in runDates) {
        streak++
        day = day.minusDays(1)
    }
    return streak
}

@Composable
private fun WeeklyActivityCard(runDates: Set<java.time.LocalDate>) {
    val streak = remember(runDates) { computeStreak(runDates) }
    val today = remember { java.time.LocalDate.now() }
    val monday = remember(today) {
        today.with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))
    }
    RuvoCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("🔥", style = MaterialTheme.typography.headlineSmall)
                Spacer(Modifier.width(8.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text("$streak day${if (streak == 1) "" else "s"}", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
                    Text("Current streak", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                }
                if (streak >= 3) {
                    Surface(shape = RoundedCornerShape(8.dp), color = RuvoColors.lime.copy(alpha = 0.15f)) {
                        Text(
                            "ON FIRE",
                            style = MaterialTheme.typography.labelSmall,
                            color = RuvoColors.lime,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        )
                    }
                }
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("M", "T", "W", "T", "F", "S", "S").forEachIndexed { i, label ->
                    val date = monday.plusDays(i.toLong())
                    val hasRun = date in runDates
                    val isToday = date == today
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.weight(1f)) {
                        Text(label, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(if (hasRun) RuvoColors.lime else RuvoColors.surfaceElev)
                                .border(if (isToday) 2.dp else 0.dp, if (isToday) RuvoColors.lime else Color.Transparent, CircleShape),
                        )
                    }
                }
            }
        }
    }
}

// Reads the same `gearList` array ShoeTrackerScreen.kt already owns (no
// separate fetch) — the "primary" shoe is whichever entry has isDefault=true,
// same concept that screen uses, falling back to the first entry. Warning
// threshold (progress > 0.8) matches ShoeTrackerScreen's own status color cutoff.
@Composable
private fun GearPreviewCard(shoe: Shoe, onClick: () -> Unit) {
    val nearLimit = !shoe.isRetired && shoe.progress > 0.8f
    val barColor = when {
        shoe.isRetired -> RuvoColors.error
        nearLimit -> RuvoColors.warning
        else -> RuvoColors.lime
    }
    RuvoCard(modifier = Modifier.clickable(onClick = onClick)) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("👟", style = MaterialTheme.typography.titleMedium)
                    Text(shoe.name.ifBlank { "My Shoe" }, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
                }
                Icon(Icons.Default.ChevronRight, contentDescription = "View Gear", tint = RuvoColors.textTertiary)
            }
            LinearProgressIndicator(
                progress = { shoe.progress },
                modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                color = barColor,
                trackColor = RuvoColors.surfaceElev,
            )
            Text(
                text = if (shoe.isRetired) "Limit reached — time to retire these" else if (nearLimit) "${shoe.remainingKm.toInt()} km left — near its limit" else "${shoe.remainingKm.toInt()} km remaining",
                style = MaterialTheme.typography.bodySmall,
                color = if (nearLimit || shoe.isRetired) barColor else RuvoColors.textSecondary,
            )
        }
    }
}

// Reuses the same ALL_BADGES catalogue AchievementsScreen.kt's full "Trophy
// Room" grid uses (see that file's fix note: this used to be a fabricated
// catalogue, now the real 12 badges from RN's badges.js) — this is a
// horizontal preview, not a re-implementation. `earnedBadgeIds` is always
// empty in practice today since no client-side badge-award check
// (RN's checkNewBadges/badgeService.js) exists on Android yet; that's a
// separate, larger gap, not something to fake here.
@Composable
private fun AchievementsPreviewCard(earnedBadgeIds: Set<String>, onClick: () -> Unit) {
    val unlockedCount = ALL_BADGES.count { it.id in earnedBadgeIds }
    RuvoCard(modifier = Modifier.clickable(onClick = onClick)) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("🏆 Achievements", style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("$unlockedCount/${ALL_BADGES.size}", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                    Icon(Icons.Default.ChevronRight, contentDescription = "View Achievements", tint = RuvoColors.textTertiary)
                }
            }
            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ALL_BADGES.forEach { badge ->
                    val unlocked = badge.id in earnedBadgeIds
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(if (unlocked) Color(android.graphics.Color.parseColor(badge.colorHex)).copy(alpha = 0.2f) else RuvoColors.surfaceElev),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(badge.emoji, style = MaterialTheme.typography.titleMedium, modifier = Modifier.alpha(if (unlocked) 1f else 0.35f))
                    }
                }
            }
        }
    }
}

// Mirrors TipDetailScreen.kt's CATEGORY_META colors (that map is private to
// that file, and this only needs the color, not the full icon set — not
// worth hoisting a shared table for one field).
private fun tipCategoryColor(category: String): Color = when (category) {
    "Technique" -> RuvoColors.lime
    "Nutrition" -> Color(0xFFFF9500)
    "Recovery" -> Color(0xFF5AC8FA)
    "Mental" -> Color(0xFFBF5AF2)
    "Strength" -> Color(0xFFFF2D55)
    "Gear" -> Color(0xFFFFD700)
    "Race Prep" -> Color(0xFFFF6B6B)
    "Injury Prev" -> Color(0xFF34C759)
    else -> RuvoColors.lime
}

// RN's Saved Tips library tab — a personal bookmark shelf backed by
// ContentRepository.fetchTips() filtered against the `savedTips` array field
// (same one TipDetailScreen.kt's bookmark toggle writes to). Shown even when
// empty (an empty state, not hidden entirely) since it's a distinct nav
// surface, same convention as the Recent Activity section above.
@Composable
private fun SavedTipsCard(tips: List<Tip>, onTipClick: (String) -> Unit) {
    RuvoCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("📚 Saved Tips", style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
                if (tips.isNotEmpty()) {
                    Text("${tips.size}", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                }
            }
            if (tips.isEmpty()) {
                Text(
                    "No saved tips yet — bookmark tips you like from a tip's detail page.",
                    style = MaterialTheme.typography.bodySmall,
                    color = RuvoColors.textTertiary,
                )
            } else {
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    tips.forEach { tip -> SavedTipChip(tip = tip, onClick = { onTipClick(tip.id) }) }
                }
            }
        }
    }
}

@Composable
private fun SavedTipChip(tip: Tip, onClick: () -> Unit) {
    val color = tipCategoryColor(tip.category)
    Column(
        modifier = Modifier
            .width(140.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(RuvoColors.surfaceElev)
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Surface(shape = RoundedCornerShape(6.dp), color = color.copy(alpha = 0.15f)) {
            Text(
                tip.category.ifBlank { "Tip" },
                style = MaterialTheme.typography.labelSmall,
                color = color,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            )
        }
        Text(
            tip.title,
            style = MaterialTheme.typography.bodySmall,
            color = RuvoColors.textPrimary,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
        )
        Text("${tip.readTime} min read", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
    }
}

private fun levelTitle(level: Int): String = when {
    level < 5 -> "Rookie"
    level < 10 -> "Endurance Athlete"
    else -> "Elite Runner"
}

@Composable
private fun ProfileStat(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleLarge, color = RuvoColors.textPrimary)
        Text(label, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
    }
}

@Composable
private fun RunActivityCard(run: ProfileRunItem, today: java.time.LocalDate) {
    val typeColor = when (run.activityType.lowercase()) {
        "intervals", "speed work" -> Color(0xFFFF453A)
        "long run" -> Color(0xFFFF9F0A)
        else -> Color(0xFF30D158)
    }
    val daysAgo = java.time.temporal.ChronoUnit.DAYS.between(run.date, today)
    val dateLabel = when (daysAgo) {
        0L -> "Today"
        1L -> "Yesterday"
        in 2..6 -> "$daysAgo days ago"
        else -> run.date.format(java.time.format.DateTimeFormatter.ofPattern("MMM d"))
    }
    RuvoCard {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier.size(40.dp).clip(CircleShape).background(typeColor.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.AutoMirrored.Filled.DirectionsRun, contentDescription = null, tint = typeColor, modifier = Modifier.size(20.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(run.title, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
                Text(dateLabel, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(String.format("%.2f km", run.distanceKm), style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
                Text("${run.paceMinPerKm.toFormattedPaceForProfile()}/km", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            }
        }
    }
}

private fun Double.toFormattedPaceForProfile(): String {
    if (this <= 0 || this > 30) return "--:--"
    val min = this.toInt(); val sec = ((this - min) * 60).toInt()
    return String.format("%d:%02d", min, sec)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditProfileSheet(uiState: ProfileUiState, onDismiss: () -> Unit, onSave: (String, String, String) -> Unit) {
    var name by remember { mutableStateOf(uiState.displayName) }
    var bio by remember { mutableStateOf(uiState.bio) }
    var location by remember { mutableStateOf(uiState.location) }
    var showCountryPicker by remember { mutableStateOf(false) }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = RuvoColors.surface) {
        Column(
            modifier = Modifier.padding(16.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("Edit Profile", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Display Name") },
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = RuvoColors.lime,
                    focusedLabelColor = RuvoColors.lime,
                    unfocusedTextColor = RuvoColors.textPrimary,
                )
            )
            OutlinedTextField(
                value = bio,
                onValueChange = { bio = it },
                label = { Text("Bio") },
                modifier = Modifier.fillMaxWidth(),
                maxLines = 3,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = RuvoColors.lime,
                    focusedLabelColor = RuvoColors.lime,
                    unfocusedTextColor = RuvoColors.textPrimary,
                )
            )
            // RN's country picker (docs/rn-reference/countries.js) — was a
            // plain free-text field, letting "usa"/"United States"/"🇺🇸" etc.
            // all land in the same field with no canonical value.
            Surface(
                onClick = { showCountryPicker = true },
                shape = RoundedCornerShape(14.dp),
                color = RuvoColors.surfaceElev,
                border = BorderStroke(1.dp, RuvoColors.border),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    modifier = Modifier.padding(16.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text("Location", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                        Text(
                            location.ifBlank { "Select country" },
                            style = MaterialTheme.typography.bodyLarge,
                            color = if (location.isBlank()) RuvoColors.textTertiary else RuvoColors.textPrimary,
                        )
                    }
                    Icon(Icons.Default.ArrowDropDown, contentDescription = null, tint = RuvoColors.textSecondary)
                }
            }
            RuvoButton(text = "Save Changes", onClick = { onSave(name, bio, location) }, style = RuvoButtonVariant.Primary, modifier = Modifier.fillMaxWidth())
            Spacer(modifier = Modifier.height(8.dp))
        }
    }

    if (showCountryPicker) {
        CountryPickerSheet(
            onDismiss = { showCountryPicker = false },
            onSelect = { location = it.name; showCountryPicker = false },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CountryPickerSheet(onDismiss: () -> Unit, onSelect: (Country) -> Unit) {
    var query by remember { mutableStateOf("") }
    val filtered = remember(query) { COUNTRIES.filter { it.name.contains(query, ignoreCase = true) } }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = RuvoColors.surface) {
        Column(modifier = Modifier.padding(16.dp).navigationBarsPadding().heightIn(max = 480.dp)) {
            Text("Select Country", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("Search") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = RuvoColors.lime,
                    focusedLabelColor = RuvoColors.lime,
                    unfocusedTextColor = RuvoColors.textPrimary,
                )
            )
            Spacer(Modifier.height(8.dp))
            LazyColumn {
                items(filtered, key = { it.code }) { country ->
                    ListItem(
                        headlineContent = { Text(country.name, color = RuvoColors.textPrimary) },
                        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
                        modifier = Modifier.clickable { onSelect(country) },
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsSheet(onDismiss: () -> Unit, onSignOut: () -> Unit, onNavigate: (String) -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = RuvoColors.surface) {
        val transparentColors = ListItemDefaults.colors(containerColor = Color.Transparent)
        Column(modifier = Modifier.navigationBarsPadding()) {
            ListItem(
                headlineContent = { Text("My Shoes", color = RuvoColors.textPrimary) },
                leadingContent = { Text("👟", style = MaterialTheme.typography.titleMedium) },
                colors = transparentColors,
                modifier = Modifier.clickable { onNavigate("shoes") }
            )
            Divider(color = RuvoColors.border)
            ListItem(
                headlineContent = { Text("Achievements", color = RuvoColors.textPrimary) },
                leadingContent = { Text("🏅", style = MaterialTheme.typography.titleMedium) },
                colors = transparentColors,
                modifier = Modifier.clickable { onNavigate("achievements") }
            )
            Divider(color = RuvoColors.border)
            ListItem(
                headlineContent = { Text("Leaderboard", color = RuvoColors.textPrimary) },
                leadingContent = { Text("📊", style = MaterialTheme.typography.titleMedium) },
                colors = transparentColors,
                modifier = Modifier.clickable { onNavigate("leaderboard") }
            )
            Divider(color = RuvoColors.border)
            ListItem(
                headlineContent = { Text("Find Runners", color = RuvoColors.textPrimary) },
                leadingContent = { Text("🔍", style = MaterialTheme.typography.titleMedium) },
                colors = transparentColors,
                modifier = Modifier.clickable { onNavigate("find_friends") }
            )
            Divider(color = RuvoColors.border)
            ListItem(
                headlineContent = { Text("Refer & Earn", color = RuvoColors.textPrimary) },
                leadingContent = { Text("🎁", style = MaterialTheme.typography.titleMedium) },
                colors = transparentColors,
                modifier = Modifier.clickable { onNavigate("referral") }
            )
            Divider(color = RuvoColors.border)
            ListItem(
                // Personal Records is an embedded card inside AnalyticsScreen,
                // not its own screen (RN_SOURCE_ARCHIVE.md §2 — matches RN's
                // actual layout; the standalone "prs" route was merged in
                // 2026-08-17). Routes here instead of RN's own admittedly
                // inconsistent behavior of sending this menu item to the
                // Achievements/badge gallery (archive §6a note) — that's a
                // flagged RN quirk, not a deliberate design worth replicating.
                headlineContent = { Text("Personal Records", color = RuvoColors.textPrimary) },
                leadingContent = { Text("🏆", style = MaterialTheme.typography.titleMedium) },
                colors = transparentColors,
                modifier = Modifier.clickable { onNavigate("analytics") }
            )
            Divider(color = RuvoColors.border)
            ListItem(
                headlineContent = { Text("Training Plan", color = RuvoColors.textPrimary) },
                leadingContent = { Text("📅", style = MaterialTheme.typography.titleMedium) },
                colors = transparentColors,
                modifier = Modifier.clickable { onNavigate("training") }
            )
            Divider(color = RuvoColors.border)
            ListItem(
                headlineContent = { Text("Health Integrations", color = RuvoColors.textPrimary) },
                leadingContent = { Text("❤️", style = MaterialTheme.typography.titleMedium) },
                colors = transparentColors,
                modifier = Modifier.clickable { onNavigate("health") }
            )
            Divider(color = RuvoColors.border)
            ListItem(
                headlineContent = { Text("Rewards", color = RuvoColors.textPrimary) },
                leadingContent = { Text("🪙", style = MaterialTheme.typography.titleMedium) },
                colors = transparentColors,
                modifier = Modifier.clickable { onNavigate("rewards") }
            )
            Divider(color = RuvoColors.border)
            ListItem(
                headlineContent = { Text("Search Runners", color = RuvoColors.textPrimary) },
                leadingContent = { Icon(Icons.Default.Search, contentDescription = null, tint = RuvoColors.textSecondary) },
                colors = transparentColors,
                modifier = Modifier.clickable { onNavigate("search") }
            )
            Divider(color = RuvoColors.border)
            ListItem(
                headlineContent = { Text("Log Activity", color = RuvoColors.textPrimary) },
                leadingContent = { Text("✏️", style = MaterialTheme.typography.titleMedium) },
                colors = transparentColors,
                modifier = Modifier.clickable { onNavigate("save_activity") }
            )
            Divider(color = RuvoColors.border)
            ListItem(
                headlineContent = { Text("Settings", color = RuvoColors.textPrimary) },
                leadingContent = { Icon(Icons.Default.Settings, contentDescription = null, tint = RuvoColors.textSecondary) },
                colors = transparentColors,
                modifier = Modifier.clickable { onNavigate("settings") }
            )
            Divider(color = RuvoColors.border)
            ListItem(
                headlineContent = { Text("Privacy", color = RuvoColors.textPrimary) },
                leadingContent = { Icon(Icons.Default.Lock, contentDescription = null, tint = RuvoColors.textSecondary) },
                colors = transparentColors,
                modifier = Modifier.clickable { onNavigate("privacy") }
            )
            Divider(color = RuvoColors.border)
            ListItem(
                headlineContent = { Text("Sign Out", color = Color(0xFFEF4444)) },
                leadingContent = { Icon(Icons.Default.ExitToApp, contentDescription = null, tint = Color(0xFFEF4444)) },
                colors = transparentColors,
                modifier = Modifier.clickable { onSignOut(); onDismiss() }
            )
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
