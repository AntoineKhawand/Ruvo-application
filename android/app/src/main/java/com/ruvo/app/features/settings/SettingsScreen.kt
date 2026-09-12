package com.ruvo.app.features.settings

import android.content.Intent
import android.net.Uri
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthRecentLoginRequiredException
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.designsystem.theme.RuvoColors
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

@Composable
fun SettingsScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    onSignOut: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel(),
    appLockViewModel: com.ruvo.app.features.auth.AppLockViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val uiState by viewModel.uiState.collectAsState()
    LaunchedEffect(Unit) { viewModel.loadSettings(); viewModel.loadAppConfig() }
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showAboutDialog by remember { mutableStateOf(false) }
    var showPasswordDialog by remember { mutableStateOf(false) }
    var showRegenerateDialog by remember { mutableStateOf(false) }
    var showReminderScheduleDialog by remember { mutableStateOf(false) }
    val biometricEnabled by appLockViewModel.biometricLockEnabled.collectAsState()
    // RN_SOURCE_ARCHIVE.md §6a/§7: the "Face ID/Touch ID" row only appears
    // when the hardware actually supports it. Android equivalent check —
    // same BIOMETRIC_STRONG|DEVICE_CREDENTIAL set LockScreen.kt itself
    // authenticates against, so the toggle never promises a gate the device
    // can't actually enforce.
    val biometricManager = remember { androidx.biometric.BiometricManager.from(context) }
    val canUseBiometrics = remember {
        biometricManager.canAuthenticate(
            androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG or
            androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
        ) == androidx.biometric.BiometricManager.BIOMETRIC_SUCCESS
    }

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
            SettingSwitchRow(
                icon = Icons.Default.Straighten,
                label = "Metric Units",
                value = uiState.unitSystem == "metric",
                onToggle = { viewModel.setUnitSystem(if (it) "metric" else "imperial") },
            )
            if (canUseBiometrics) {
                SettingSwitchRow(
                    icon = Icons.Default.Fingerprint,
                    label = "Biometric Lock",
                    value = biometricEnabled,
                    onToggle = { appLockViewModel.setBiometricLockEnabled(it) },
                )
            }
        }

        // RN_SOURCE_ARCHIVE.md §6b "regenerate" variant — confirm alert +
        // updateUserProfile({goal:'5k', savedGoal:null, isTransitionWeek:false}).
        SettingSection("Training") {
            SettingRow(icon = Icons.Default.AutoAwesome, label = "Recalibrate AI", onClick = { showRegenerateDialog = true })
        }

        // RN's `notifications` SettingsDetail variant (RN_SOURCE_ARCHIVE.md
        // §6b) splits these across a PREFERENCES section (workoutReminders,
        // tips) and a COMMUNITY section (newFollowers, communityActivity,
        // clubUpdates) — kept as two sections here to match.
        SettingSection("Notifications") {
            SettingSwitchRow(icon = Icons.Default.DirectionsRun, label = "Workout Reminders", value = uiState.workoutReminders, onToggle = { viewModel.toggleNotification("workoutReminders", uiState.workoutReminders) })
            // Real gap found 2026-09-04: the toggle above is the only place
            // reminders were ever mentioned post-onboarding — there was no way
            // to see or change which days/time they fire on short of
            // reinstalling. This row surfaces the real schedule (read back by
            // SettingsViewModel.loadSettings()) and opens an editor for it.
            SettingRow(
                icon = Icons.Default.Schedule,
                label = "Reminder Days & Time",
                subtitle = reminderScheduleSummary(uiState.reminderDays, uiState.reminderHour, uiState.reminderMinute),
                onClick = { showReminderScheduleDialog = true },
            )
            SettingSwitchRow(icon = Icons.Default.Lightbulb, label = "Tips", value = uiState.tips, onToggle = { viewModel.toggleNotification("tips", uiState.tips) })
        }

        SettingSection("Community") {
            SettingSwitchRow(icon = Icons.Default.People, label = "New Followers", value = uiState.newFollowers, onToggle = { viewModel.toggleNotification("newFollowers", uiState.newFollowers) })
            SettingSwitchRow(icon = Icons.Default.Forum, label = "Community Activity", value = uiState.communityActivity, onToggle = { viewModel.toggleNotification("communityActivity", uiState.communityActivity) })
            SettingSwitchRow(icon = Icons.Default.Groups, label = "Club Updates", value = uiState.clubUpdates, onToggle = { viewModel.toggleNotification("clubUpdates", uiState.clubUpdates) })
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
                        putExtra(Intent.EXTRA_TEXT, "Check out Ruvo, the AI running coach that adapts to you! Download: ${uiState.appConfig.playStoreUrl}")
                    }
                    context.startActivity(Intent.createChooser(sendIntent, "Share Ruvo"))
                } catch (_: Exception) {}
            })
            SettingRow(icon = Icons.Default.Info, label = "About RUVO ${uiState.appConfig.activeVersion}", onClick = { showAboutDialog = true })
            SettingRow(icon = Icons.Default.Policy, label = "Privacy Policy", onClick = {
                try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uiState.appConfig.privacyUrl))) } catch (_: Exception) {}
            })
            SettingRow(icon = Icons.Default.Article, label = "Terms of Service", onClick = {
                try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uiState.appConfig.termsUrl))) } catch (_: Exception) {}
            })
        }

        SettingSection("Account Actions") {
            SettingRow(icon = Icons.Default.ExitToApp, label = "Sign Out", labelColor = RuvoColors.error, onClick = onSignOut)
            SettingRow(icon = Icons.Default.DeleteForever, label = "Delete Account", labelColor = RuvoColors.error, onClick = { showDeleteDialog = true })
        }

        Spacer(Modifier.height(80.dp))
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { if (!uiState.isDeletingAccount) showDeleteDialog = false },
            icon = { Icon(Icons.Default.Warning, contentDescription = null, tint = RuvoColors.error) },
            title = { Text("Delete Account?", fontWeight = FontWeight.Bold, color = RuvoColors.textPrimary) },
            text = { Text("This will permanently delete your RUVO account, all runs, achievements and data. This cannot be undone.", color = RuvoColors.textSecondary) },
            confirmButton = {
                Button(
                    enabled = !uiState.isDeletingAccount,
                    onClick = {
                        // Calls the real deleteAccountData Cloud Function (functions/index.js)
                        // instead of just FirebaseAuth's client-side currentUser?.delete() --
                        // that only removed the Auth identity and left the Firestore
                        // users/{uid} doc + avatar Storage files orphaned. Only sign out
                        // locally once the server-side deletion actually succeeded.
                        coroutineScope.launch {
                            if (viewModel.deleteAccount()) {
                                showDeleteDialog = false
                                onSignOut()
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.error),
                ) {
                    if (uiState.isDeletingAccount) CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                    else Text("Delete", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(enabled = !uiState.isDeletingAccount, onClick = { showDeleteDialog = false }) {
                    Text("Cancel", color = RuvoColors.textSecondary)
                }
            },
            containerColor = RuvoColors.surface,
        )
    }

    uiState.deleteAccountError?.let { message ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissDeleteAccountError() },
            title = { Text("Couldn't Delete Account", fontWeight = FontWeight.Bold, color = RuvoColors.textPrimary) },
            text = { Text(message, color = RuvoColors.textSecondary) },
            confirmButton = {
                TextButton(onClick = { viewModel.dismissDeleteAccountError() }) { Text("OK", color = RuvoColors.lime) }
            },
            containerColor = RuvoColors.surface,
        )
    }

    if (showAboutDialog) {
        val config = uiState.appConfig
        AlertDialog(
            onDismissRequest = { showAboutDialog = false },
            icon = { Icon(Icons.Default.DirectionsRun, contentDescription = null, tint = RuvoColors.lime) },
            title = { Text("RUVO ${config.activeVersion}", fontWeight = FontWeight.Bold, color = RuvoColors.textPrimary) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(config.aboutDescription, color = RuvoColors.textSecondary)
                    Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                        IconButton(onClick = {
                            try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(config.instagramUrl))) } catch (_: Exception) {}
                        }) { Icon(Icons.Default.CameraAlt, contentDescription = "Instagram", tint = RuvoColors.textSecondary) }
                        // RN's About variant has 4 social icons (instagram/facebook/
                        // website/email); facebookUrl only shows once system/app_config
                        // actually provides one — no invented placeholder URL.
                        config.facebookUrl?.let { url ->
                            IconButton(onClick = {
                                try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: Exception) {}
                            }) { Icon(Icons.Default.Facebook, contentDescription = "Facebook", tint = RuvoColors.textSecondary) }
                        }
                        IconButton(onClick = {
                            try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(config.websiteUrl))) } catch (_: Exception) {}
                        }) { Icon(Icons.Default.Language, contentDescription = "Website", tint = RuvoColors.textSecondary) }
                        IconButton(onClick = {
                            try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("mailto:${config.email}"))) } catch (_: Exception) {}
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

    // RN_SOURCE_ARCHIVE.md §6b "regenerate" — exact confirm-alert copy.
    if (showRegenerateDialog) {
        AlertDialog(
            onDismissRequest = { if (!uiState.isRegeneratingPlan) showRegenerateDialog = false },
            icon = { Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = RuvoColors.lime) },
            title = { Text("Recalibrate AI?", fontWeight = FontWeight.Bold, color = RuvoColors.textPrimary) },
            text = {
                Text(
                    "Are you sure you want to recalculate your training plan? This will change your upcoming schedule based on recent performance.",
                    color = RuvoColors.textSecondary,
                )
            },
            confirmButton = {
                Button(
                    enabled = !uiState.isRegeneratingPlan,
                    onClick = { viewModel.regenerateTrainingPlan() },
                    colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime),
                ) {
                    if (uiState.isRegeneratingPlan) CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.Black, strokeWidth = 2.dp)
                    else Text("Yes, Regenerate", color = Color.Black, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(enabled = !uiState.isRegeneratingPlan, onClick = { showRegenerateDialog = false }) {
                    Text("Cancel", color = RuvoColors.textSecondary)
                }
            },
            containerColor = RuvoColors.surface,
        )
    }

    uiState.regenerateResultMessage?.let { message ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissRegenerateResult(); showRegenerateDialog = false },
            title = { Text(if (message.startsWith("Your run plan")) "Done" else "Couldn't Recalibrate", fontWeight = FontWeight.Bold, color = RuvoColors.textPrimary) },
            text = { Text(message, color = RuvoColors.textSecondary) },
            confirmButton = {
                TextButton(onClick = { viewModel.dismissRegenerateResult(); showRegenerateDialog = false }) {
                    Text("OK", color = RuvoColors.lime)
                }
            },
            containerColor = RuvoColors.surface,
        )
    }

    if (showReminderScheduleDialog) {
        ReminderScheduleDialog(
            initialDays = uiState.reminderDays,
            initialHour = uiState.reminderHour,
            initialMinute = uiState.reminderMinute,
            onDismiss = { showReminderScheduleDialog = false },
            onSave = { days, hour, minute ->
                viewModel.updateReminderSchedule(days, hour, minute)
                showReminderScheduleDialog = false
            },
        )
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
                errorMessage?.let { Text(it, color = RuvoColors.error, style = MaterialTheme.typography.bodySmall) }
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
                            val user = FirebaseAuth.getInstance().currentUser
                            user?.updatePassword(newPassword)?.await()
                            // RN's Password SettingsDetail variant also calls
                            // logSensitiveAction("PASSWORD_CHANGE") after a
                            // successful change (RN_SOURCE_ARCHIVE.md §6b) —
                            // writes an auditLog doc, previously missing here.
                            // updatePassword() fires FirebaseAuth's sign-out
                            // listener immediately (confirmed live: "Notifying
                            // auth state listeners about a sign-out event"
                            // logs the instant the call succeeds), which tears
                            // down this composable and cancels coroutineScope
                            // before a normal suspend call here would run —
                            // NonCancellable keeps this write alive through that.
                            withContext(NonCancellable) {
                                try {
                                    user?.uid?.let { uid ->
                                        FirebaseFirestore.getInstance()
                                            .collection("users").document(uid)
                                            .collection("auditLog").add(
                                                mapOf(
                                                    "action" to "PASSWORD_CHANGE",
                                                    "timestamp" to FieldValue.serverTimestamp(),
                                                    "device" to "android",
                                                    "details" to emptyMap<String, Any>(),
                                                )
                                            ).await()
                                    }
                                } catch (_: Exception) {
                                    // Best-effort audit log — the password change itself already succeeded.
                                }
                            }
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
private fun SettingRow(icon: ImageVector, label: String, labelColor: Color = RuvoColors.textPrimary, subtitle: String? = null, onClick: () -> Unit) {
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
        Column(modifier = Modifier.weight(1f)) {
            Text(label, style = MaterialTheme.typography.bodyMedium, color = labelColor)
            subtitle?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary) }
        }
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

// "Not set" surfaces the real, previously-invisible state where onboarding's
// Continue-requires->=1-day rule was somehow never satisfied (or a user
// cleared every day here) — RunReminderScheduler treats that as "one daily
// reminder", but this makes it visible rather than silent.
private fun reminderScheduleSummary(days: Set<java.time.DayOfWeek>, hour: Int, minute: Int): String {
    val time = java.time.LocalTime.of(hour, minute).format(java.time.format.DateTimeFormatter.ofPattern("h:mm a"))
    if (days.isEmpty()) return "Daily at $time"
    val dayLabels = days.sortedBy { it.value }.joinToString(", ") { it.getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.US) }
    return "$dayLabels at $time"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReminderScheduleDialog(
    initialDays: Set<java.time.DayOfWeek>,
    initialHour: Int,
    initialMinute: Int,
    onDismiss: () -> Unit,
    onSave: (Set<java.time.DayOfWeek>, Int, Int) -> Unit,
) {
    var days by remember { mutableStateOf(initialDays) }
    var hour by remember { mutableIntStateOf(initialHour) }
    var minute by remember { mutableIntStateOf(initialMinute) }
    var showTimePicker by remember { mutableStateOf(false) }
    val timeLabel = remember(hour, minute) {
        java.time.LocalTime.of(hour, minute).format(java.time.format.DateTimeFormatter.ofPattern("h:mm a"))
    }
    val dayChips = remember {
        listOf(
            java.time.DayOfWeek.MONDAY to "M", java.time.DayOfWeek.TUESDAY to "T", java.time.DayOfWeek.WEDNESDAY to "W",
            java.time.DayOfWeek.THURSDAY to "T", java.time.DayOfWeek.FRIDAY to "F", java.time.DayOfWeek.SATURDAY to "S",
            java.time.DayOfWeek.SUNDAY to "S",
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.Schedule, contentDescription = null, tint = RuvoColors.lime) },
        title = { Text("Reminder Days & Time", fontWeight = FontWeight.Bold, color = RuvoColors.textPrimary) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(
                    "Leave every day off for one daily reminder instead of specific days.",
                    style = MaterialTheme.typography.bodySmall,
                    color = RuvoColors.textSecondary,
                )
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    dayChips.forEach { (day, label) ->
                        val isSelected = day in days
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .aspectRatio(1f)
                                .clip(CircleShape)
                                .background(if (isSelected) RuvoColors.lime else RuvoColors.surfaceElev)
                                .border(1.dp, if (isSelected) RuvoColors.lime else RuvoColors.border, CircleShape)
                                .clickable { days = if (isSelected) days - day else days + day },
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(label, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, color = if (isSelected) Color.Black else RuvoColors.textSecondary)
                        }
                    }
                }
                Surface(
                    onClick = { showTimePicker = true },
                    shape = RoundedCornerShape(14.dp),
                    color = RuvoColors.surfaceElev,
                    border = BorderStroke(1.dp, RuvoColors.border),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(modifier = Modifier.padding(14.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Schedule, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(timeLabel, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary)
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = { onSave(days, hour, minute) }, colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime)) {
                Text("Save", color = Color.Black, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = RuvoColors.textSecondary) } },
        containerColor = RuvoColors.surface,
    )

    if (showTimePicker) {
        val pickerState = rememberTimePickerState(initialHour = hour, initialMinute = minute, is24Hour = false)
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            confirmButton = {
                TextButton(onClick = { hour = pickerState.hour; minute = pickerState.minute; showTimePicker = false }) {
                    Text("OK", color = RuvoColors.lime)
                }
            },
            dismissButton = { TextButton(onClick = { showTimePicker = false }) { Text("Cancel", color = RuvoColors.textSecondary) } },
            containerColor = RuvoColors.surface,
            text = { TimePicker(state = pickerState) },
        )
    }
}
