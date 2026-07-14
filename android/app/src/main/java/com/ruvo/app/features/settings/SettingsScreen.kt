package com.ruvo.app.features.settings

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.google.firebase.auth.FirebaseAuth
import com.ruvo.app.designsystem.theme.RuvoColors

@Composable
fun SettingsScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    onSignOut: () -> Unit = {},
) {
    val context = LocalContext.current
    var showDeleteDialog by remember { mutableStateOf(false) }
    var unitMetric by remember { mutableStateOf(true) }
    var biometricEnabled by remember { mutableStateOf(false) }
    var notifRuns by remember { mutableStateOf(true) }
    var notifChallenges by remember { mutableStateOf(true) }
    var notifFriends by remember { mutableStateOf(true) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
            .verticalScroll(rememberScrollState()),
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary) }
            Text("Settings", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
        }

        SettingSection("Account") {
            SettingRow(icon = Icons.Default.Person, label = "Edit Profile", onClick = { onNavigate("profile") })
            SettingRow(icon = Icons.Default.Lock, label = "Privacy Controls", onClick = { onNavigate("privacy") })
            SettingRow(icon = Icons.Default.Devices, label = "Connected Devices", onClick = { onNavigate("connected_devices") })
            SettingRow(icon = Icons.Default.Shield, label = "Security", onClick = {})
            SettingRow(icon = Icons.Default.CreditCard, label = "Manage Subscription", onClick = { onNavigate("customer_center") })
        }

        SettingSection("Preferences") {
            SettingSwitchRow(icon = Icons.Default.Straighten, label = "Metric Units", value = unitMetric, onToggle = { unitMetric = it })
            SettingSwitchRow(icon = Icons.Default.Fingerprint, label = "Biometric Lock", value = biometricEnabled, onToggle = { biometricEnabled = it })
        }

        SettingSection("Notifications") {
            SettingSwitchRow(icon = Icons.Default.DirectionsRun, label = "Run Reminders", value = notifRuns, onToggle = { notifRuns = it })
            SettingSwitchRow(icon = Icons.Default.EmojiEvents, label = "Challenges & Badges", value = notifChallenges, onToggle = { notifChallenges = it })
            SettingSwitchRow(icon = Icons.Default.People, label = "Friend Activity", value = notifFriends, onToggle = { notifFriends = it })
        }

        SettingSection("Support") {
            SettingRow(icon = Icons.Default.Help, label = "Help Center", onClick = { onNavigate("help") })
            SettingRow(icon = Icons.Default.Star, label = "Rate RUVO", onClick = {
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.ruvo.app"))
                    context.startActivity(intent)
                } catch (_: Exception) {}
            })
            SettingRow(icon = Icons.Default.Info, label = "About RUVO v1.0.0", onClick = {})
            SettingRow(icon = Icons.Default.Policy, label = "Privacy Policy", onClick = {
                try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://ruvo.app/privacy"))) } catch (_: Exception) {}
            })
            SettingRow(icon = Icons.Default.Article, label = "Terms of Service", onClick = {
                try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://ruvo.app/terms"))) } catch (_: Exception) {}
            })
        }

        SettingSection("Account Actions") {
            SettingRow(icon = Icons.Default.ExitToApp, label = "Sign Out", labelColor = Color(0xFFEF4444), onClick = onSignOut)
            SettingRow(icon = Icons.Default.DeleteForever, label = "Delete Account", labelColor = Color(0xFFEF4444), onClick = { showDeleteDialog = true })
        }

        Spacer(Modifier.height(80.dp))
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            icon = { Text("⚠️", style = MaterialTheme.typography.headlineMedium) },
            title = { Text("Delete Account?", fontWeight = FontWeight.Bold, color = RuvoColors.textPrimary) },
            text = { Text("This will permanently delete your RUVO account, all runs, achievements and data. This cannot be undone.", color = RuvoColors.textSecondary) },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteDialog = false
                        FirebaseAuth.getInstance().currentUser?.delete()
                        onSignOut()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                ) { Text("Delete", color = Color.White, fontWeight = FontWeight.Bold) }
            },
            dismissButton = { TextButton(onClick = { showDeleteDialog = false }) { Text("Cancel", color = RuvoColors.textSecondary) } },
            containerColor = RuvoColors.surface,
        )
    }
}

@Composable
private fun SettingSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(title.uppercase(), style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, modifier = Modifier.padding(start = 4.dp, bottom = 6.dp))
        Surface(shape = RoundedCornerShape(16.dp), color = RuvoColors.surface, border = BorderStroke(1.dp, RuvoColors.border)) {
            Column { content() }
        }
    }
    Spacer(Modifier.height(4.dp))
}

@Composable
private fun SettingRow(icon: ImageVector, label: String, labelColor: Color = RuvoColors.textPrimary, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Icon(icon, contentDescription = null, tint = if (labelColor != RuvoColors.textPrimary) labelColor else RuvoColors.textSecondary, modifier = Modifier.size(20.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium, color = labelColor, modifier = Modifier.weight(1f))
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun SettingSwitchRow(icon: ImageVector, label: String, value: Boolean, onToggle: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Icon(icon, contentDescription = null, tint = RuvoColors.textSecondary, modifier = Modifier.size(20.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary, modifier = Modifier.weight(1f))
        Switch(checked = value, onCheckedChange = onToggle, colors = SwitchDefaults.colors(checkedThumbColor = Color.Black, checkedTrackColor = RuvoColors.lime, uncheckedThumbColor = RuvoColors.textTertiary, uncheckedTrackColor = RuvoColors.surfaceElev))
    }
}
