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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthRecentLoginRequiredException
import com.ruvo.app.designsystem.theme.RuvoColors
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@Composable
fun SettingsScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    onSignOut: () -> Unit = {},
) {
    val context = LocalContext.current
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showAboutDialog by remember { mutableStateOf(false) }
    var showPasswordDialog by remember { mutableStateOf(false) }
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
            SettingRow(icon = Icons.Default.Shield, label = "Security", onClick = { showPasswordDialog = true })
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
            SettingRow(icon = Icons.Default.Share, label = "Share App", onClick = {
                try {
                    val sendIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, "Check out Ruvo, the AI running coach that adapts to you! Download: https://play.google.com/store/apps/details?id=com.ruvo.app")
                    }
                    context.startActivity(Intent.createChooser(sendIntent, "Share Ruvo"))
                } catch (_: Exception) {}
            })
            SettingRow(icon = Icons.Default.Info, label = "About RUVO v1.0.0", onClick = { showAboutDialog = true })
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

    if (showAboutDialog) {
        AlertDialog(
            onDismissRequest = { showAboutDialog = false },
            icon = { Text("🏃", style = MaterialTheme.typography.headlineMedium) },
            title = { Text("RUVO v1.0.0", fontWeight = FontWeight.Bold, color = RuvoColors.textPrimary) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "The AI running coach that adapts to you — training plans, live tracking, and a community of runners in your pocket.",
                        color = RuvoColors.textSecondary,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                        IconButton(onClick = {
                            try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://instagram.com/ruvo.app"))) } catch (_: Exception) {}
                        }) { Icon(Icons.Default.CameraAlt, contentDescription = "Instagram", tint = RuvoColors.textSecondary) }
                        IconButton(onClick = {
                            try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://ruvo.app"))) } catch (_: Exception) {}
                        }) { Icon(Icons.Default.Language, contentDescription = "Website", tint = RuvoColors.textSecondary) }
                        IconButton(onClick = {
                            try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("mailto:admin@ruvo.run"))) } catch (_: Exception) {}
                        }) { Icon(Icons.Default.Email, contentDescription = "Email", tint = RuvoColors.textSecondary) }
                    }
                    Text(
                        "© ${java.time.Year.now().value} Ruvo Inc. All rights reserved.",
                        style = MaterialTheme.typography.bodySmall,
                        color = RuvoColors.textTertiary,
                    )
                }
            },
            confirmButton = { TextButton(onClick = { showAboutDialog = false }) { Text("Close", color = RuvoColors.lime) } },
            containerColor = RuvoColors.surface,
        )
    }

    if (showPasswordDialog) {
        PasswordDialog(onDismiss = { showPasswordDialog = false })
    }
}

@Composable
private fun PasswordDialog(onDismiss: () -> Unit) {
    val coroutineScope = rememberCoroutineScope()
    var newPassword by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var successMessage by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.Shield, contentDescription = null, tint = RuvoColors.lime) },
        title = { Text("Change Password", fontWeight = FontWeight.Bold, color = RuvoColors.textPrimary) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = newPassword,
                    onValueChange = { newPassword = it; errorMessage = null },
                    label = { Text("New Password") },
                    singleLine = true,
                    visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = RuvoColors.textPrimary, unfocusedTextColor = RuvoColors.textPrimary,
                        focusedBorderColor = RuvoColors.lime, unfocusedBorderColor = RuvoColors.border,
                        focusedLabelColor = RuvoColors.lime, unfocusedLabelColor = RuvoColors.textTertiary,
                    ),
                )
                errorMessage?.let { Text(it, color = Color(0xFFEF4444), style = MaterialTheme.typography.bodySmall) }
                successMessage?.let { Text(it, color = RuvoColors.lime, style = MaterialTheme.typography.bodySmall) }
            }
        },
        confirmButton = {
            Button(
                enabled = !isLoading,
                onClick = {
                    if (newPassword.length < 6) {
                        errorMessage = "Password must be at least 6 characters long."
                        return@Button
                    }
                    isLoading = true
                    errorMessage = null
                    coroutineScope.launch {
                        try {
                            FirebaseAuth.getInstance().currentUser?.updatePassword(newPassword)?.await()
                            successMessage = "Password updated successfully"
                            newPassword = ""
                        } catch (e: FirebaseAuthRecentLoginRequiredException) {
                            errorMessage = "For your security, please sign out and back in before changing your password."
                        } catch (e: Exception) {
                            errorMessage = e.message ?: "Could not update password."
                        } finally {
                            isLoading = false
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime),
            ) {
                if (isLoading) CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.Black, strokeWidth = 2.dp)
                else Text("Update", color = Color.Black, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = RuvoColors.textSecondary) } },
        containerColor = RuvoColors.surface,
    )
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
    val isAccent = labelColor != RuvoColors.textPrimary
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(9.dp))
                .background(if (isAccent) labelColor.copy(alpha = 0.1f) else RuvoColors.surfaceElev),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = if (isAccent) labelColor else RuvoColors.textSecondary, modifier = Modifier.size(18.dp))
        }
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
