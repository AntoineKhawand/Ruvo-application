package com.ruvo.app.features.settings

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import coil.compose.AsyncImage
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.designsystem.theme.RuvoColors
import com.ruvo.app.designsystem.theme.RuvoRadius
import com.ruvo.app.designsystem.theme.RuvoSpacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class PrivacySettings(
    val profileVisibility: String = "public",
    val showActivityOnFeed: Boolean = true,
    val showLocationOnMap: Boolean = true,
    val showStatsToOthers: Boolean = true,
    val whoCanFollow: String = "everyone",
    val whoCanComment: String = "everyone",
    val whoCanSeeClubs: String = "everyone",
)

data class BlockedUserInfo(val id: String, val name: String, val avatarUrl: String?)

data class PrivacyUiState(
    val settings: PrivacySettings = PrivacySettings(),
    val blockedUsers: List<BlockedUserInfo> = emptyList(),
    val mutedUsers: List<BlockedUserInfo> = emptyList(),
)

@HiltViewModel
class PrivacyViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PrivacyUiState())
    val uiState: StateFlow<PrivacyUiState> = _uiState.asStateFlow()

    init { load() }

    private fun load() {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            try {
                val doc = firestore.collection("users").document(uid).get().await()
                val data = doc.data ?: return@launch
                val p = data["privacySettings"] as? Map<*, *>
                val cur = PrivacySettings()
                _uiState.update {
                    it.copy(
                        settings = cur.copy(
                            profileVisibility = p?.get("profileVisibility") as? String ?: cur.profileVisibility,
                            showActivityOnFeed = p?.get("showActivityOnFeed") as? Boolean ?: cur.showActivityOnFeed,
                            showLocationOnMap = p?.get("showLocationOnMap") as? Boolean ?: cur.showLocationOnMap,
                            showStatsToOthers = p?.get("showStatsToOthers") as? Boolean ?: cur.showStatsToOthers,
                            whoCanFollow = p?.get("whoCanFollow") as? String ?: cur.whoCanFollow,
                            whoCanComment = p?.get("whoCanComment") as? String ?: cur.whoCanComment,
                            whoCanSeeClubs = p?.get("whoCanSeeClubs") as? String ?: cur.whoCanSeeClubs,
                        )
                    )
                }
                @Suppress("UNCHECKED_CAST")
                val blockedIds = (data["blocked"] as? List<String>) ?: emptyList()
                @Suppress("UNCHECKED_CAST")
                val mutedIds = (data["mutedUsers"] as? List<String>) ?: emptyList()
                val blocked = resolveUsers(blockedIds)
                val muted = resolveUsers(mutedIds)
                _uiState.update { it.copy(blockedUsers = blocked, mutedUsers = muted) }
            } catch (_: Exception) {}
        }
    }

    private suspend fun resolveUsers(ids: List<String>): List<BlockedUserInfo> = coroutineScope {
        ids.map { id ->
            async {
                try {
                    val snap = firestore.collection("users").document(id).get().await()
                    val name = snap.getString("name") ?: snap.getString("displayName") ?: "Unknown"
                    val avatarUrl = snap.getString("avatarUrl") ?: snap.getString("avatar")
                    BlockedUserInfo(id, name, avatarUrl)
                } catch (_: Exception) {
                    BlockedUserInfo(id, "Unknown", null)
                }
            }
        }.awaitAll()
    }

    fun update(block: PrivacySettings.() -> PrivacySettings) {
        val updated = _uiState.value.settings.block()
        _uiState.update { it.copy(settings = updated) }
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            try {
                firestore.collection("users").document(uid).update("privacySettings", mapOf(
                    "profileVisibility" to updated.profileVisibility,
                    "showActivityOnFeed" to updated.showActivityOnFeed,
                    "showLocationOnMap" to updated.showLocationOnMap,
                    "showStatsToOthers" to updated.showStatsToOthers,
                    "whoCanFollow" to updated.whoCanFollow,
                    "whoCanComment" to updated.whoCanComment,
                    "whoCanSeeClubs" to updated.whoCanSeeClubs,
                )).await()
            } catch (_: Exception) {}
        }
    }

    fun unblockUser(userId: String) {
        val previous = _uiState.value.blockedUsers
        _uiState.update { it.copy(blockedUsers = it.blockedUsers.filter { u -> u.id != userId }) }
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            try {
                firestore.collection("users").document(uid)
                    .update("blocked", FieldValue.arrayRemove(userId)).await()
            } catch (_: Exception) {
                _uiState.update { it.copy(blockedUsers = previous) }
            }
        }
    }

    fun unmuteUser(userId: String) {
        val previous = _uiState.value.mutedUsers
        _uiState.update { it.copy(mutedUsers = it.mutedUsers.filter { u -> u.id != userId }) }
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            try {
                firestore.collection("users").document(uid)
                    .update("mutedUsers", FieldValue.arrayRemove(userId)).await()
            } catch (_: Exception) {
                _uiState.update { it.copy(mutedUsers = previous) }
            }
        }
    }
}

@Composable
fun PrivacyControlsScreen(
    onBack: () -> Unit = {},
    viewModel: PrivacyViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val settings = uiState.settings

    Column(
        modifier = Modifier.fillMaxSize().background(RuvoColors.background).verticalScroll(rememberScrollState()),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = RuvoSpacing.md, vertical = RuvoSpacing.cardGap),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary) }
            Text("Privacy Controls", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
        }

        PrivacySection("Profile Visibility") {
            PrivacySelect(
                label = "Who can see my profile",
                desc = "Control who can view your profile and achievements",
                options = listOf("public" to "Public", "friends" to "Friends Only", "private" to "Private"),
                value = settings.profileVisibility,
                onSelect = { viewModel.update { copy(profileVisibility = it) } },
            )
        }

        PrivacySection("Activity Settings") {
            PrivacyToggle(
                label = "Show Activity on Feed",
                desc = "Allow your runs to appear on the community feed",
                value = settings.showActivityOnFeed,
                onToggle = { viewModel.update { copy(showActivityOnFeed = it) } },
            )
            PrivacyToggle(
                label = "Show Location on Map",
                desc = "Display your GPS route on public feeds",
                value = settings.showLocationOnMap,
                onToggle = { viewModel.update { copy(showLocationOnMap = it) } },
            )
            PrivacyToggle(
                label = "Show Stats to Others",
                desc = "Allow others to see your detailed statistics",
                value = settings.showStatsToOthers,
                onToggle = { viewModel.update { copy(showStatsToOthers = it) } },
            )
        }

        PrivacySection("Social Permissions") {
            PrivacySelect(
                label = "Who can follow me",
                desc = "Control who can follow your profile",
                options = listOf("everyone" to "Everyone", "friends" to "Friends Only", "nobody" to "Nobody"),
                value = settings.whoCanFollow,
                onSelect = { viewModel.update { copy(whoCanFollow = it) } },
            )
            PrivacySelect(
                label = "Who can comment",
                desc = "Control who can comment on your runs",
                options = listOf("everyone" to "Everyone", "friends" to "Friends Only", "nobody" to "Nobody"),
                value = settings.whoCanComment,
                onSelect = { viewModel.update { copy(whoCanComment = it) } },
            )
            PrivacySelect(
                label = "Who can see my clubs",
                desc = "Control who can see which clubs you've joined",
                options = listOf("everyone" to "Everyone", "friends" to "Friends Only"),
                value = settings.whoCanSeeClubs,
                onSelect = { viewModel.update { copy(whoCanSeeClubs = it) } },
            )
        }

        PrivacySection("Blocked Users") {
            if (uiState.blockedUsers.isEmpty()) {
                PrivacyEmptyState(icon = Icons.Default.Shield, text = "No blocked users")
            } else {
                uiState.blockedUsers.forEach { user ->
                    BlockedUserRow(
                        user = user,
                        actionLabel = "Unblock",
                        actionColor = RuvoColors.error,
                        actionTextColor = Color.White,
                        onAction = { viewModel.unblockUser(user.id) },
                    )
                }
            }
        }
        Text(
            "Blocked users cannot see your profile, follow you, or interact with your content.",
            style = MaterialTheme.typography.bodySmall,
            color = RuvoColors.textTertiary,
            modifier = Modifier.padding(start = RuvoSpacing.md, end = RuvoSpacing.md, bottom = RuvoSpacing.sm),
        )

        PrivacySection("Muted Users") {
            if (uiState.mutedUsers.isEmpty()) {
                PrivacyEmptyState(icon = Icons.Default.VolumeOff, text = "No muted users")
            } else {
                uiState.mutedUsers.forEach { user ->
                    BlockedUserRow(
                        user = user,
                        actionLabel = "Unmute",
                        actionColor = RuvoColors.surfaceElev,
                        actionTextColor = RuvoColors.textPrimary,
                        onAction = { viewModel.unmuteUser(user.id) },
                    )
                }
            }
        }
        Text(
            "Muted users will not appear on your feed, but they can still see your profile and interact with you.",
            style = MaterialTheme.typography.bodySmall,
            color = RuvoColors.textTertiary,
            modifier = Modifier.padding(horizontal = RuvoSpacing.md),
        )

        Spacer(Modifier.height(80.dp))
    }
}

@Composable
private fun PrivacySection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier = Modifier.padding(horizontal = RuvoSpacing.md, vertical = RuvoSpacing.sm)) {
        Text(title.uppercase(), style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, modifier = Modifier.padding(start = RuvoSpacing.xs, bottom = RuvoSpacing.xs))
        Surface(shape = RoundedCornerShape(RuvoRadius.md), color = RuvoColors.surface, border = BorderStroke(1.dp, RuvoColors.border)) {
            Column { content() }
        }
    }
}

@Composable
private fun PrivacyEmptyState(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = RuvoSpacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(36.dp))
        Spacer(Modifier.height(RuvoSpacing.sm))
        Text(text, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
    }
}

@Composable
private fun BlockedUserRow(
    user: BlockedUserInfo,
    actionLabel: String,
    actionColor: Color,
    actionTextColor: Color,
    onAction: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = RuvoSpacing.md, vertical = RuvoSpacing.cardGap),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.cardGap)) {
            if (user.avatarUrl != null) {
                AsyncImage(
                    model = user.avatarUrl,
                    contentDescription = user.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(40.dp).clip(CircleShape).background(RuvoColors.surfaceElev),
                )
            } else {
                Box(
                    modifier = Modifier.size(40.dp).clip(CircleShape).background(RuvoColors.surfaceElev),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        user.name.take(1).uppercase(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = RuvoColors.textSecondary,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            Text(user.name, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
        }
        Surface(
            onClick = onAction,
            shape = RoundedCornerShape(RuvoRadius.sm),
            color = actionColor,
        ) {
            Text(
                actionLabel,
                style = MaterialTheme.typography.labelMedium,
                color = actionTextColor,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(horizontal = RuvoSpacing.md, vertical = RuvoSpacing.xs),
            )
        }
    }
}

@Composable
private fun PrivacyToggle(label: String, desc: String, value: Boolean, onToggle: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = RuvoSpacing.md, vertical = RuvoSpacing.cardGap),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.cardGap),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(label, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.Medium)
            Text(desc, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
        }
        Switch(
            checked = value,
            onCheckedChange = onToggle,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.Black,
                checkedTrackColor = RuvoColors.lime,
                uncheckedThumbColor = RuvoColors.textTertiary,
                uncheckedTrackColor = RuvoColors.surfaceElev,
            ),
        )
    }
}

@Composable
private fun PrivacySelect(
    label: String,
    desc: String,
    options: List<Pair<String, String>>,
    value: String,
    onSelect: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val displayLabel = options.find { it.first == value }?.second ?: value

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = RuvoSpacing.md, vertical = RuvoSpacing.cardGap)) {
        Row(
            modifier = Modifier.fillMaxWidth().clickable { expanded = !expanded },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(label, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.Medium)
                Text(desc, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(displayLabel, style = MaterialTheme.typography.labelMedium, color = RuvoColors.lime, fontWeight = FontWeight.SemiBold)
                Icon(if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore, contentDescription = null, tint = RuvoColors.textTertiary)
            }
        }

        if (expanded) {
            Spacer(Modifier.height(RuvoSpacing.sm))
            options.forEach { (v, l) ->
                Row(
                    modifier = Modifier.fillMaxWidth().clickable { onSelect(v); expanded = false }.padding(vertical = RuvoSpacing.sm, horizontal = RuvoSpacing.xs),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.sm),
                ) {
                    Text(l, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textPrimary, modifier = Modifier.weight(1f))
                    if (v == value) Icon(Icons.Default.Check, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}
