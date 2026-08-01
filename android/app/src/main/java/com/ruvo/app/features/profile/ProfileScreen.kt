package com.ruvo.app.features.profile

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(navController: NavController? = null, viewModel: ProfileViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showEdit by remember { mutableStateOf(false) }
    var showSettings by remember { mutableStateOf(false) }
    val context = LocalContext.current

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

        Spacer(modifier = Modifier.height(16.dp))

        // Recent runs grid
        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
            Text("Recent Runs", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
            Spacer(modifier = Modifier.height(12.dp))
            if (uiState.recentRuns.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxWidth().height(120.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No runs yet", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textTertiary)
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.height(((uiState.recentRuns.size / 3 + 1) * 100).dp.coerceAtMost(320.dp)),
                    userScrollEnabled = false,
                ) {
                    items(uiState.recentRuns, key = { it.id }) { run ->
                        RunMiniCard(distanceKm = run.distanceKm)
                    }
                }
            }
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
        Column(
            modifier = Modifier.align(Alignment.BottomStart).padding(horizontal = 20.dp),
            horizontalAlignment = Alignment.Start
        ) {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(RuvoColors.surfaceElev)
                    .border(3.dp, RuvoColors.lime, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(40.dp))
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
private fun RunMiniCard(distanceKm: Double) {
    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(8.dp))
            .background(RuvoColors.surfaceElev)
            .border(1.dp, RuvoColors.border, RoundedCornerShape(8.dp)),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(String.format("%.1f", distanceKm), style = MaterialTheme.typography.titleSmall, color = RuvoColors.lime)
            Text("km", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
        }
    }
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
                headlineContent = { Text("Personal Records", color = RuvoColors.textPrimary) },
                leadingContent = { Text("🏆", style = MaterialTheme.typography.titleMedium) },
                colors = transparentColors,
                modifier = Modifier.clickable { onNavigate("prs") }
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
