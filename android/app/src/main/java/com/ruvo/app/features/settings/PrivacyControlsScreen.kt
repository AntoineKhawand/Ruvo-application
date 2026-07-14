package com.ruvo.app.features.settings

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class PrivacySettings(
    val profileVisibility: String = "public",
    val runVisibility: String = "friends",
    val showDistance: Boolean = true,
    val showLocation: Boolean = false,
    val allowMessages: String = "everyone",
    val showOnLeaderboard: Boolean = true,
    val shareDataWithPartners: Boolean = false,
)

@HiltViewModel
class PrivacyViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _settings = MutableStateFlow(PrivacySettings())
    val settings: StateFlow<PrivacySettings> = _settings.asStateFlow()

    init { load() }

    private fun load() {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            try {
                val doc = firestore.collection("users").document(uid).get().await()
                val p = doc.data?.get("privacySettings") as? Map<*, *> ?: return@launch
                _settings.update { cur ->
                    cur.copy(
                        profileVisibility = p["profileVisibility"] as? String ?: cur.profileVisibility,
                        runVisibility = p["runVisibility"] as? String ?: cur.runVisibility,
                        showDistance = p["showDistance"] as? Boolean ?: cur.showDistance,
                        showLocation = p["showLocation"] as? Boolean ?: cur.showLocation,
                        allowMessages = p["allowMessages"] as? String ?: cur.allowMessages,
                        showOnLeaderboard = p["showOnLeaderboard"] as? Boolean ?: cur.showOnLeaderboard,
                        shareDataWithPartners = p["shareDataWithPartners"] as? Boolean ?: cur.shareDataWithPartners,
                    )
                }
            } catch (_: Exception) {}
        }
    }

    fun update(block: PrivacySettings.() -> PrivacySettings) {
        val updated = _settings.value.block()
        _settings.value = updated
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            try {
                firestore.collection("users").document(uid).update("privacySettings", mapOf(
                    "profileVisibility" to updated.profileVisibility,
                    "runVisibility" to updated.runVisibility,
                    "showDistance" to updated.showDistance,
                    "showLocation" to updated.showLocation,
                    "allowMessages" to updated.allowMessages,
                    "showOnLeaderboard" to updated.showOnLeaderboard,
                    "shareDataWithPartners" to updated.shareDataWithPartners,
                )).await()
            } catch (_: Exception) {}
        }
    }
}

@Composable
fun PrivacyControlsScreen(
    onBack: () -> Unit = {},
    viewModel: PrivacyViewModel = hiltViewModel(),
) {
    val settings by viewModel.settings.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier.fillMaxSize().background(RuvoColors.background).verticalScroll(rememberScrollState()),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary) }
            Text("Privacy Controls", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
        }

        PrivacySection("Profile Visibility") {
            PrivacySelect(
                label = "Who can see my profile",
                desc = "Controls who can view your runs, stats, and achievements",
                options = listOf("public" to "Public", "friends" to "Friends Only", "private" to "Private"),
                value = settings.profileVisibility,
                onSelect = { viewModel.update { copy(profileVisibility = it) } },
            )
        }

        PrivacySection("Run Data") {
            PrivacySelect(
                label = "Who can see my runs",
                desc = "Controls run activity visibility in the community feed",
                options = listOf("everyone" to "Everyone", "friends" to "Friends Only", "nobody" to "Only Me"),
                value = settings.runVisibility,
                onSelect = { viewModel.update { copy(runVisibility = it) } },
            )
            PrivacyToggle(
                label = "Show distance on profile",
                desc = "Display your total km on your public profile",
                value = settings.showDistance,
                onToggle = { viewModel.update { copy(showDistance = it) } },
            )
            PrivacyToggle(
                label = "Show location on runs",
                desc = "Display city/area where runs take place",
                value = settings.showLocation,
                onToggle = { viewModel.update { copy(showLocation = it) } },
            )
        }

        PrivacySection("Social") {
            PrivacySelect(
                label = "Who can message me",
                desc = "Direct message permissions",
                options = listOf("everyone" to "Everyone", "friends" to "Friends Only", "nobody" to "Nobody"),
                value = settings.allowMessages,
                onSelect = { viewModel.update { copy(allowMessages = it) } },
            )
            PrivacyToggle(
                label = "Appear on leaderboards",
                desc = "Show my rank in country and global leaderboards",
                value = settings.showOnLeaderboard,
                onToggle = { viewModel.update { copy(showOnLeaderboard = it) } },
            )
        }

        PrivacySection("Data Sharing") {
            PrivacyToggle(
                label = "Share anonymised data",
                desc = "Help improve RUVO by sharing anonymised run statistics with our research partners",
                value = settings.shareDataWithPartners,
                onToggle = { viewModel.update { copy(shareDataWithPartners = it) } },
            )
        }

        Spacer(Modifier.height(80.dp))
    }
}

@Composable
private fun PrivacySection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(title.uppercase(), style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, modifier = Modifier.padding(start = 4.dp, bottom = 6.dp))
        Surface(shape = RoundedCornerShape(16.dp), color = RuvoColors.surface, border = BorderStroke(1.dp, RuvoColors.border)) {
            Column { content() }
        }
    }
}

@Composable
private fun PrivacyToggle(label: String, desc: String, value: Boolean, onToggle: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
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

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
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
            Spacer(Modifier.height(8.dp))
            options.forEach { (v, l) ->
                Row(
                    modifier = Modifier.fillMaxWidth().clickable { onSelect(v); expanded = false }.padding(vertical = 8.dp, horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(l, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textPrimary, modifier = Modifier.weight(1f))
                    if (v == value) Icon(Icons.Default.Check, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}
