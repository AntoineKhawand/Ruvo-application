package com.ruvo.app.features.profile

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
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
        )

        // Stats row
        ProfileStatsRow(uiState = uiState)

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
) {
    Box(modifier = Modifier.fillMaxWidth().height(200.dp)) {
        // Cover gradient
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(140.dp)
                .background(Brush.linearGradient(listOf(Color(0xFF0A1A00), Color(0xFF1A2F00), RuvoColors.limeDim)))
        )

        // Settings button
        IconButton(
            onClick = onSettings,
            modifier = Modifier.align(Alignment.TopEnd).padding(12.dp)
        ) {
            Icon(Icons.Default.Settings, contentDescription = "Settings", tint = RuvoColors.textSecondary)
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
        Text(uiState.displayName, style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
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
            OutlinedTextField(
                value = location,
                onValueChange = { location = it },
                label = { Text("Location") },
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = RuvoColors.lime,
                    focusedLabelColor = RuvoColors.lime,
                    unfocusedTextColor = RuvoColors.textPrimary,
                )
            )
            RuvoButton(text = "Save Changes", onClick = { onSave(name, bio, location) }, style = RuvoButtonVariant.Primary, modifier = Modifier.fillMaxWidth())
            Spacer(modifier = Modifier.height(8.dp))
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
