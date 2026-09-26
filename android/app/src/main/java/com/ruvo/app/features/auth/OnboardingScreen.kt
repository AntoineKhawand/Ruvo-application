package com.ruvo.app.features.auth

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.filled.Watch
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.ruvo.app.core.model.FitnessLevel
import com.ruvo.app.core.model.RunningGoal
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*
import kotlinx.coroutines.delay

// RN_SOURCE_ARCHIVE.md §7's OnboardingScreen is TOTAL_STEPS = 6: Goal, Fitness
// level, Bio+Units, Frequency, Training days+time, Permissions+account. All
// six are now real: Bio/Frequency collect fields that otherwise had no path
// to ever be set anywhere in the app (e.g. AnalyticsViewModel's VO2/HR-zone
// math had always fallen back to age 30 specifically because dob was never
// collected); the Training days+time step collects real specific days + a
// reminder time instead of a bare day count; and step 6's real Location/
// Notifications permission requests actually schedule those real reminders
// (RunReminderScheduler.kt) the moment notification permission is granted.
private const val TOTAL_STEPS = 6

@Composable
fun OnboardingScreen(onComplete: () -> Unit, viewModel: AuthViewModel = hiltViewModel()) {
    var step by remember { mutableIntStateOf(0) }
    var selectedGoal by remember { mutableStateOf<RunningGoal?>(null) }
    var selectedLevel by remember { mutableStateOf<FitnessLevel?>(null) }
    // Step 3 ("About you", two pages): gender, date of birth, unit system, weight and height.
    // Weight/height are kept in kg/cm whatever unit the user is shown.
    val bio = remember { BioState(defaultBioUnit()) }
    var bioNudge by remember { mutableIntStateOf(0) }
    val ctaPulse = remember { androidx.compose.animation.core.Animatable(1f) }
    LaunchedEffect(bio.valid) {                      // small "you're ready" pulse when both rulers are set
        if (bio.valid) {
            ctaPulse.animateTo(1.045f, androidx.compose.animation.core.tween(200))
            ctaPulse.animateTo(1f, androidx.compose.animation.core.tween(450))
        }
    }
    var runFrequency by remember { mutableIntStateOf(3) }
    // Archive §7 step 5: "7-day chip selector (M-S), preferred run time
    // picker (default now+2min)". The old step only ever collected a day
    // *count* via a 1-7 slider, so there were never specific days/a time to
    // schedule a real reminder against — this is the actual real spec.
    var selectedScheduleDays by remember { mutableStateOf(setOf<java.time.DayOfWeek>()) }
    val defaultReminderTime = remember { java.time.LocalTime.now().plusMinutes(2) }
    var reminderHour by remember { mutableIntStateOf(defaultReminderTime.hour) }
    var reminderMinute by remember { mutableIntStateOf(defaultReminderTime.minute) }

    // Load the 3D heart for step 2 while the user is still on step 1, so it is there the
    // moment step 2 opens. Waits a beat so it never competes with the first screen's entrance.
    val heartHolder = remember { HeartHolder() }
    val heartContext = androidx.compose.ui.platform.LocalContext.current
    LaunchedEffect(Unit) {
        delay(700)
        heartHolder.load(heartContext)
    }
    DisposableEffect(Unit) { onDispose { heartHolder.destroy() } }

    Box(modifier = Modifier.fillMaxSize().background(RuvoColors.background)) {
        Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
            // Progress dots
            RuvoProgressSteps(
                totalSteps = TOTAL_STEPS,
                currentStep = step,
                modifier = Modifier.fillMaxWidth(),
                partialActive = step == 2 && bio.page == 0,
            )
            Spacer(modifier = Modifier.height(32.dp))

            AnimatedContent(
                targetState = step,
                modifier = Modifier.weight(1f),
                transitionSpec = { RuvoMotion.stepTransition<Int>(forward = targetState >= initialState)() },
                label = "onboarding_step"
            ) { currentStep ->
                when (currentStep) {
                    0 -> GoalStep(selectedGoal = selectedGoal, onSelect = { selectedGoal = it })
                    1 -> LevelStep(selectedLevel = selectedLevel, onSelect = { selectedLevel = it }, heart = heartHolder)
                    2 -> BioStep(state = bio, nudge = bioNudge)
                    3 -> FrequencyStep(frequency = runFrequency, onSelect = { runFrequency = it })
                    4 -> ScheduleStep(
                        selectedDays = selectedScheduleDays,
                        onDaysChange = { selectedScheduleDays = it },
                        reminderHour = reminderHour,
                        reminderMinute = reminderMinute,
                        onTimeChange = { h, m -> reminderHour = h; reminderMinute = m },
                    )
                    5 -> ReadyStep(
                        selectedDays = selectedScheduleDays,
                        reminderHour = reminderHour,
                        reminderMinute = reminderMinute,
                        goalLabel = selectedGoal?.label ?: RunningGoal.STAY_HEALTHY.label,
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Navigation buttons
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (step > 0) {
                    RuvoButton(
                        text = "Back",
                        onClick = { if (step == 2 && bio.page == 1) bio.page = 0 else step-- },
                        style = RuvoButtonVariant.Secondary,
                        modifier = Modifier.weight(1f)
                    )
                }
                val canProceed = when (step) {
                    0 -> selectedGoal != null
                    1 -> selectedLevel != null
                    // Archive §7 step 5: "Continue requires >=1 day selected."
                    4 -> selectedScheduleDays.isNotEmpty()
                    else -> true
                }
                RuvoButton(
                    text = if (step == TOTAL_STEPS - 1) "Let's Go!" else "Continue",
                    onClick = {
                        if (step == 2 && bio.page == 0) bio.page = 1
                        else if (step == 2 && !bio.valid) bioNudge++     // page 2 needs both rulers set
                        else if (step < TOTAL_STEPS - 1) step++
                        else {
                            viewModel.completeOnboarding(
                                goal = selectedGoal?.name ?: RunningGoal.STAY_HEALTHY.name,
                                level = selectedLevel?.name ?: FitnessLevel.BEGINNER.name,
                                // weeklyRunDays now derives from the actual selected days
                                // (Schedule step) rather than a separate count the user
                                // never explicitly set for this field.
                                weeklyDays = selectedScheduleDays.size,
                                gender = bio.gender,
                                dob = bio.dob.toString(),
                                // Always kg and cm, whatever unit the user was shown.
                                weight = if (bio.weightSet) bio.kg else null,
                                height = if (bio.heightSet) bio.cm else null,
                                unitSystem = bio.unit,
                                runFrequency = runFrequency,
                                selectedDays = selectedScheduleDays
                                    .sortedBy { it.value }
                                    .map { it.getDisplayName(java.time.format.TextStyle.FULL, java.util.Locale.US) },
                                notificationTime = String.format("%02d:%02d", reminderHour, reminderMinute),
                            )
                            onComplete()
                        }
                    },
                    style = RuvoButtonVariant.Primary,
                    modifier = Modifier
                        .weight(1f)
                        .graphicsLayer { scaleX = ctaPulse.value; scaleY = ctaPulse.value }
                        // Page 2 stays dimmed until both are set; it is still tappable so it can nudge.
                        .alpha(if (step == 2 && bio.page == 1 && !bio.valid) 0.45f else 1f),
                    enabled = canProceed,
                )
            }
        }
    }
}

// Archive §7 step 4 quotes only the two endpoints of RN's real 8-entry
// array — "(0→'Perfect! We'll start from the beginning.' … 7→'Elite level!
// You're unstoppable.')" — the middle six were elided with "…" and RN's
// source is gone, so there's no way to recover their exact original text.
// Ported the two known-real endpoints verbatim; the middle six are
// original Android copy in the same voice, not a guess passed off as RN's
// actual wording.
private val FREQUENCY_ENCOURAGEMENT = listOf(
    "Perfect! We'll start from the beginning.",
    "Great start! Building the habit is what matters most.",
    "Nice and steady — consistency beats intensity.",
    "Solid rhythm! You're building real endurance.",
    "Impressive dedication — you're ahead of most runners.",
    "That's serious commitment to your training.",
    "Whoa, you're practically a pro already!",
    "Elite level! You're unstoppable.",
)

@Composable
private fun FrequencyStep(frequency: Int, onSelect: (Int) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Column {
            Text("Current frequency", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)
            Text("How many times a week do you currently run?", style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            (0..7).forEach { n ->
                RuvoSelectionChip(
                    label = "$n",
                    selected = n == frequency,
                    onClick = { onSelect(n) },
                    modifier = Modifier.weight(1f).aspectRatio(1f),
                    shape = RoundedCornerShape(12.dp),
                )
            }
        }
        Surface(shape = RoundedCornerShape(14.dp), color = RuvoColors.surface, modifier = Modifier.fillMaxWidth()) {
            Text(
                FREQUENCY_ENCOURAGEMENT[frequency],
                modifier = Modifier.padding(16.dp),
                style = MaterialTheme.typography.bodyMedium,
                color = RuvoColors.textSecondary,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScheduleStep(
    selectedDays: Set<java.time.DayOfWeek>,
    onDaysChange: (Set<java.time.DayOfWeek>) -> Unit,
    reminderHour: Int,
    reminderMinute: Int,
    onTimeChange: (Int, Int) -> Unit,
) {
    var showTimePicker by remember { mutableStateOf(false) }
    val timeLabel = remember(reminderHour, reminderMinute) {
        java.time.LocalTime.of(reminderHour, reminderMinute)
            .format(java.time.format.DateTimeFormatter.ofPattern("h:mm a"))
    }

    Column(modifier = Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("How often\ncan you run?", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)
            Text("Choose the days that fit your week. You can change them later.", style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary)
        }

        WeekCard(selectedDays = selectedDays, onDaysChange = onDaysChange)

        Surface(
            onClick = { showTimePicker = true },
            shape = RoundedCornerShape(18.dp),
            color = RuvoColors.surface,
            border = BorderStroke(1.dp, RuvoColors.border),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Schedule, contentDescription = null, tint = RuvoColors.lime)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("Preferred run time", style = MaterialTheme.typography.labelMedium, color = RuvoColors.textTertiary)
                    Text(timeLabel, style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
                }
                Text("Change", style = MaterialTheme.typography.labelLarge, color = RuvoColors.lime)
            }
        }
    }

    if (showTimePicker) {
        TimeWheelSheet(
            hour24 = reminderHour,
            minute = reminderMinute,
            onConfirm = { h, m -> onTimeChange(h, m); showTimePicker = false },
            onDismiss = { showTimePicker = false },
        )
    }
}


@Composable
private fun ReadyStep(
    selectedDays: Set<java.time.DayOfWeek>,
    reminderHour: Int,
    reminderMinute: Int,
    goalLabel: String,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        ReadyMark()
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("You're all set!", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary, textAlign = TextAlign.Center)
            Text(
                "Your personalized plan is ready. Let's start crushing those goals — one run at a time.",
                style = MaterialTheme.typography.bodyLarge,
                color = RuvoColors.textSecondary,
                textAlign = TextAlign.Center,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ReadyBadge("🔥", "Streak\nTracking", index = 0)
            ReadyBadge("🤖", "AI\nCoach", index = 1)
            ReadyBadge("🏆", "Challenges", index = 2)
        }
        // Archive §7 step 6: "Permissions + account creation — required toggles
        // Location... and Notifications...". Android's account-first flow means
        // these can't literally gate account creation the way RN's guest-first
        // flow does (the account already exists by the time onboarding runs) —
        // requested here as real system prompts instead, same two permissions,
        // not gating "Let's Go!" since there's no equivalent "essentialGranted"
        // concept once the account already exists. Real notification
        // *scheduling* (RN's per-day weekly reminders) is now built — see
        // RunReminderScheduler.kt — and fires the moment the permission is
        // granted here, using the days/time collected on the Schedule step.
        PermissionsSection(selectedDays = selectedDays, reminderHour = reminderHour, reminderMinute = reminderMinute, goalLabel = goalLabel)
    }
}

// The one deliberately celebratory beat in the flow: scale-in from 0.7->1 +
// fade via RuvoMotion.springBouncy() on entry, glass-treated per iOS's
// equivalent WelcomeScreen/checkmark.seal.fill mark for this exact spot.
@Composable
private fun ReadyMark() {
    var animate by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { animate = true }
    val scale by animateFloatAsState(
        targetValue = if (animate) 1f else 0.7f,
        animationSpec = RuvoMotion.springBouncy(),
        label = "ready_mark_scale",
    )
    val alpha by animateFloatAsState(
        targetValue = if (animate) 1f else 0f,
        animationSpec = RuvoMotion.springBouncy(),
        label = "ready_mark_alpha",
    )
    Box(
        modifier = Modifier
            .size(120.dp)
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
                this.alpha = alpha
            }
            .shadow(
                elevation = RuvoShadow.cardElevation,
                shape = CircleShape,
                ambientColor = RuvoShadow.primaryGlow,
                spotColor = RuvoShadow.primaryGlow,
            )
            .clip(CircleShape)
            .background(RuvoColors.glassSurface),
        contentAlignment = Alignment.Center,
    ) {
        Icon(Icons.Filled.Verified, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(56.dp))
    }
}

@Composable
private fun PermissionsSection(
    selectedDays: Set<java.time.DayOfWeek>,
    reminderHour: Int,
    reminderMinute: Int,
    goalLabel: String,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val viewModel: AuthViewModel = hiltViewModel()
    var locationGranted by remember {
        mutableStateOf(
            androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_FINE_LOCATION) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
        )
    }
    var notificationsGranted by remember {
        mutableStateOf(
            android.os.Build.VERSION.SDK_INT < 33 ||
                androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) ==
                    android.content.pm.PackageManager.PERMISSION_GRANTED
        )
    }
    var showSettingsRedirect by remember { mutableStateOf(false) }

    // Schedules the moment notification permission is (or already was)
    // granted — covers both "just granted via the launcher below" and
    // "already granted before this screen mounted" in one place, rather
    // than duplicating the scheduling call at both call sites.
    LaunchedEffect(notificationsGranted) {
        if (notificationsGranted) {
            viewModel.scheduleRunReminders(selectedDays, reminderHour, reminderMinute, goalLabel)
        }
    }

    val locationLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        locationGranted = results.values.any { it }
        if (!locationGranted) showSettingsRedirect = true
    }
    val notificationsLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission()
    ) { granted ->
        notificationsGranted = granted
        if (!granted) showSettingsRedirect = true
    }

    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        PermissionRow(
            icon = Icons.Filled.LocationOn, title = "Location", subtitle = "Track your runs with GPS",
            granted = locationGranted,
            onRequest = { locationLauncher.launch(arrayOf(android.Manifest.permission.ACCESS_FINE_LOCATION, android.Manifest.permission.ACCESS_COARSE_LOCATION)) },
        )
        PermissionRow(
            icon = Icons.Filled.Notifications, title = "Notifications", subtitle = "Get reminders to run",
            granted = notificationsGranted,
            onRequest = {
                if (android.os.Build.VERSION.SDK_INT >= 33) {
                    notificationsLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                } else {
                    notificationsGranted = true
                }
            },
        )
        // Archive: "Optional disabled row: 'Wearables & Health — Connect later
        // in Settings → Devices.'" — matches Android's own real
        // ConnectedDevicesScreen, already reachable from Settings.
        Surface(shape = RoundedCornerShape(14.dp), color = RuvoColors.surface.copy(alpha = 0.5f), modifier = Modifier.fillMaxWidth()) {
            Row(modifier = Modifier.padding(14.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Icon(Icons.Filled.Watch, contentDescription = null, tint = RuvoColors.textTertiary)
                Text("Wearables & Health — connect later in Settings → Devices", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }
        }
    }

    if (showSettingsRedirect) {
        AlertDialog(
            onDismissRequest = { showSettingsRedirect = false },
            title = { Text("Permission needed", color = RuvoColors.textPrimary) },
            text = { Text("You can grant this later in your device Settings if you change your mind.", color = RuvoColors.textSecondary) },
            confirmButton = {
                TextButton(onClick = {
                    showSettingsRedirect = false
                    context.startActivity(
                        android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                            .setData(android.net.Uri.fromParts("package", context.packageName, null))
                    )
                }) { Text("Open Settings", color = RuvoColors.lime) }
            },
            dismissButton = { TextButton(onClick = { showSettingsRedirect = false }) { Text("Not now", color = RuvoColors.textSecondary) } },
        )
    }
}

@Composable
private fun PermissionRow(icon: ImageVector, title: String, subtitle: String, granted: Boolean, onRequest: () -> Unit) {
    RuvoSelectableCard(
        selected = granted,
        onClick = { if (!granted) onRequest() },
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(modifier = Modifier.padding(14.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(icon, contentDescription = null, tint = if (granted) RuvoColors.lime else RuvoColors.textSecondary)
            Column(modifier = Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }
            // Granted <-> Allow swap animates via the same standard-tier
            // crossfade RuvoCard uses for its own selection border, instead of
            // an instant swap between the badge and the button.
            Crossfade(targetState = granted, animationSpec = RuvoMotion.easeInOut(RuvoMotion.Duration.standard), label = "permission_status") { isGranted ->
                if (isGranted) {
                    Surface(shape = RoundedCornerShape(20.dp), color = RuvoColors.lime.copy(alpha = 0.15f)) {
                        Text("Granted", modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp), style = MaterialTheme.typography.labelSmall, color = RuvoColors.lime, fontWeight = FontWeight.Bold)
                    }
                } else {
                    TextButton(onClick = onRequest) { Text("Allow", color = RuvoColors.lime, fontWeight = FontWeight.Bold) }
                }
            }
        }
    }
}

// Reskinned from a flat Surface into a RuvoCard mini-card, staggered in via
// RuvoMotion.staggerStepMillis per index on RuvoMotion.easeOut (not bouncy —
// the hero bounce belongs to ReadyMark above, these should not compete with it).
@Composable
private fun ReadyBadge(emoji: String, label: String, index: Int) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(index * RuvoMotion.staggerStepMillis.toLong())
        visible = true
    }
    val alpha by animateFloatAsState(
        targetValue = if (visible) 1f else 0f,
        animationSpec = RuvoMotion.easeOut(RuvoMotion.Duration.entrance),
        label = "ready_badge_alpha",
    )
    val offsetY by animateFloatAsState(
        targetValue = if (visible) 0f else 12f,
        animationSpec = RuvoMotion.easeOut(RuvoMotion.Duration.entrance),
        label = "ready_badge_offset",
    )
    RuvoCard(
        isHighlighted = true,
        glowColor = RuvoColors.lime,
        modifier = Modifier.graphicsLayer {
            this.alpha = alpha
            translationY = offsetY.dp.toPx()
        },
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.padding(12.dp),
        ) {
            Text(emoji, style = MaterialTheme.typography.headlineMedium)
            Text(label, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary, textAlign = TextAlign.Center)
        }
    }
}
