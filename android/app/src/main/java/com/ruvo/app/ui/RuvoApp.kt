package com.ruvo.app.ui

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.rememberCoroutineScope
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import androidx.navigation.NavType
import androidx.navigation.navArgument
import com.ruvo.app.designsystem.theme.RuvoColors
import com.ruvo.app.features.gamification.GamificationRepository
import com.ruvo.app.features.gamification.RunSaveViewModel
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull
import com.ruvo.app.features.achievements.AchievementsScreen
import com.ruvo.app.features.aicoach.AICoachScreen
import com.ruvo.app.features.analytics.AnalyticsDashboardScreen
import com.ruvo.app.features.auth.*
import com.ruvo.app.features.community.*
import com.ruvo.app.features.healthintegrations.ConnectedDevicesScreen
import com.ruvo.app.features.healthintegrations.HealthIntegrationsScreen
import com.ruvo.app.features.home.HomeScreen
import com.ruvo.app.features.leaderboard.LeaderboardScreen
import com.ruvo.app.features.paywall.PaywallScreen
import com.ruvo.app.features.profile.ProfileScreen
import com.ruvo.app.features.referral.ReferralScreen
import com.ruvo.app.features.rewards.MyRedemptionsScreen
import com.ruvo.app.features.rewards.RewardsScreen
import com.ruvo.app.features.search.SearchScreen
import com.ruvo.app.features.settings.HelpCenterScreen
import com.ruvo.app.features.settings.PrivacyControlsScreen
import com.ruvo.app.features.settings.SettingsScreen
import com.ruvo.app.core.model.RunRecord
import com.ruvo.app.core.persistence.RunCheckpoint
import com.ruvo.app.features.runtracking.IntervalStep
import com.ruvo.app.features.runtracking.IntervalTrainingScreen
import com.ruvo.app.features.runtracking.LiveRunViewerScreen
import com.ruvo.app.features.runtracking.RateEffortScreen
import com.ruvo.app.features.runtracking.RunDetailScreen
import com.ruvo.app.features.runtracking.RunRecoveryViewModel
import com.ruvo.app.features.runtracking.RunSummaryScreen
import com.ruvo.app.features.runtracking.RunTrackingScreen
import com.ruvo.app.features.runtracking.SaveActivityScreen
import com.ruvo.app.features.runtracking.WorkoutDetailScreen
import com.ruvo.app.features.gear.ShoeTrackerScreen
import com.ruvo.app.features.training.TrainingPlanScreen
import com.ruvo.app.features.training.TrainingWorkout
import com.ruvo.app.features.tips.TipDetailScreen

private enum class RunFlow { Idle, Tracking, RateEffort, Summary }

// The single real save point for a completed run — mirrors RN's
// SaveActivityScreen.js::handleSave(), which builds the complete runEntry (including
// rpe/notes/tags) and calls the saveRunActivity Cloud Function exactly once (see
// RN_SOURCE_ARCHIVE.md §9). Returns the server-computed (earnedXp, earnedCoins) so the
// summary screen can show real values instead of a fabricated client-side estimate.
private suspend fun submitRunActivity(
    runSaveViewModel: RunSaveViewModel,
    run: RunRecord,
    rating: Int,
    notes: String,
    tags: List<String>,
    gearId: String?,
): Pair<Long, Long> {
    return try {
        val runEntry = mapOf(
            "id" to run.id,
            "date" to java.time.Instant.now().toString(),
            "distance" to run.distanceKm,
            "duration" to formatRunDuration(run.durationSeconds),
            "pace" to formatRunPace(run.averagePaceMinPerKm),
            "calories" to run.calories,
            "heartRate" to run.averageHeartRate,
            "routePath" to run.route.map { mapOf("latitude" to it.latitude, "longitude" to it.longitude) },
            "kmSplits" to run.laps.map { lap -> mapOf("lapNumber" to lap.number, "distanceKm" to lap.distanceKm, "durationSeconds" to lap.durationSeconds) },
            "elevationGain" to run.elevationGainM.toInt(),
            "activityType" to "Run",
            "title" to (run.title ?: "Run"),
            "rpe" to rating,
            "notes" to notes,
            "tags" to tags,
            // gearId itself isn't a field SaveActivityViewModel's runEntry lacks
            // either — kept for parity with that screen's manual-log shape, even
            // though the actual mileage bookkeeping happens via calculatedUpdates
            // below (same split as SaveActivityViewModel: gearId on the entry,
            // gearList only in calculatedUpdates).
            "gearId" to gearId,
        )
        // GPS-tracked runs never attached gear at all before this (see
        // RN_ANDROID_PORT_MAPPING.md's "Known Data-Layer Bugs" — only
        // SaveActivityScreen's manual "Log Activity" flow could). Same one-shot
        // read-modify-write SaveActivityViewModel already does for that flow,
        // just inlined here since this function has no live gearList of its own
        // to reuse — a fresh read is correct for a save that only happens once.
        // Now always reads the user doc (not just when gearId != null) since
        // badge evaluation below also needs the pre-save runHistory/badges —
        // one read serves both, same as SaveActivityViewModel's equivalent path.
        // Timeout-guarded (real bug found 2026-08-30 live-testing this exact
        // read): a wedged Firestore connection doesn't throw, it just hangs
        // .get().await() forever — a plain try/catch never fires, leaving the
        // whole save permanently stuck. Same guard SaveActivityViewModel uses.
        val uid = runSaveViewModel.auth.currentUser?.uid
        val userDoc = uid?.let {
            try {
                withTimeoutOrNull(5_000L) {
                    runSaveViewModel.firestore.collection("users").document(it).get().await()
                }
            } catch (_: Exception) { null }
        }
        val calculatedUpdates = if (gearId != null) {
            try {
                @Suppress("UNCHECKED_CAST")
                val rawGear = userDoc?.get("gearList") as? List<Map<String, Any>> ?: emptyList()
                val updatedGear = rawGear.map { g ->
                    if (g["id"] as? String == gearId) {
                        val currentDist = (g["distance"] as? Number)?.toDouble() ?: 0.0
                        g + mapOf("distance" to currentDist + run.distanceKm)
                    } else g
                }
                if (updatedGear.isNotEmpty()) mapOf("gearList" to updatedGear) else emptyMap()
            } catch (_: Exception) {
                emptyMap() // gear mileage update is best-effort; never block the real save on it
            }
        } else emptyMap()
        val result = runSaveViewModel.repository.saveRunActivity(runEntry, calculatedUpdates)
        awardNewBadges(runSaveViewModel, uid, userDoc, runEntry)
        result.earnedXp to result.earnedCoins
    } catch (_: Exception) {
        // RN queues offline via savePendingRun/retryPendingRuns on failure — Android
        // doesn't yet have that offline-queue equivalent (a known, documented gap;
        // see RN_SOURCE_ARCHIVE.md §1 "Edge cases"). Fail soft rather than crash.
        0L to 0L
    }
}

// Real port of RN's checkNewBadges() call inside UserContext.addRunToHistory
// (RN_SOURCE_ARCHIVE.md §3) — runs after every real run save, client-side,
// same as RN (badges aren't server-validated there either; see archive's
// "Firestore" note). Never existed before this: every account showed all
// 12 badges permanently locked regardless of actual run history.
private suspend fun awardNewBadges(
    runSaveViewModel: RunSaveViewModel,
    uid: String?,
    userDoc: com.google.firebase.firestore.DocumentSnapshot?,
    runEntry: Map<String, Any?>,
) {
    if (uid == null) return
    try {
        @Suppress("UNCHECKED_CAST")
        val priorHistory = userDoc?.get("runHistory") as? List<Map<String, Any?>> ?: emptyList()
        @Suppress("UNCHECKED_CAST")
        val earnedIds = ((userDoc?.get("badges") as? List<*>)
            ?.filterIsInstance<Map<String, Any>>()
            ?.mapNotNull { it["id"] as? String } ?: emptyList()).toSet()
        val newBadges = com.ruvo.app.core.model.checkNewBadges(runEntry, priorHistory, earnedIds)
        if (newBadges.isNotEmpty()) {
            runSaveViewModel.firestore.collection("users").document(uid)
                .update("badges", com.google.firebase.firestore.FieldValue.arrayUnion(*newBadges.toTypedArray()))
                .await()
        }
    } catch (_: Exception) {
        // Badge awarding is best-effort; never block the real save on it.
    }
}

private fun formatRunDuration(totalSeconds: Int): String {
    val h = totalSeconds / 3600; val m = (totalSeconds % 3600) / 60; val s = totalSeconds % 60
    return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%d:%02d", m, s)
}

private fun formatRunPace(paceMinPerKm: Double): String {
    if (paceMinPerKm <= 0 || paceMinPerKm > 30) return "--:--"
    val min = paceMinPerKm.toInt(); val sec = ((paceMinPerKm - min) * 60).toInt()
    return String.format("%d:%02d", min, sec)
}

// RN's LockScreen trigger (RN_SOURCE_ARCHIVE.md §7, in UserContext.js, not
// LockScreen.js itself): an AppState listener records a background
// timestamp; on returning to the foreground, if more than 30 minutes
// elapsed, isLocked flips true and LockScreen overlays the whole app. Kept
// in-memory only (backgroundedAtMillis), same as RN's own in-memory
// AppState-timer — only the on/off *preference* is persisted, via
// AppLockStore/AppLockViewModel.
private val APP_LOCK_THRESHOLD_MS = 30 * 60 * 1000L

@Composable
fun RuvoApp(
    authViewModel: AuthViewModel = hiltViewModel(),
    appLockViewModel: AppLockViewModel = hiltViewModel(),
    deepLinkLiveRunId: String? = null,
) {
    val uiState by authViewModel.uiState.collectAsStateWithLifecycle()
    val biometricLockEnabled by appLockViewModel.biometricLockEnabled.collectAsStateWithLifecycle()

    var isLocked by remember { mutableStateOf(false) }
    var backgroundedAtMillis by remember { mutableStateOf<Long?>(null) }

    val lifecycleOwner = androidx.compose.ui.platform.LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, biometricLockEnabled, uiState) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            when (event) {
                androidx.lifecycle.Lifecycle.Event.ON_STOP -> {
                    backgroundedAtMillis = System.currentTimeMillis()
                }
                androidx.lifecycle.Lifecycle.Event.ON_START -> {
                    val bgAt = backgroundedAtMillis
                    backgroundedAtMillis = null
                    if (bgAt != null && biometricLockEnabled && uiState is AuthUiState.Authenticated) {
                        if (System.currentTimeMillis() - bgAt > APP_LOCK_THRESHOLD_MS) {
                            isLocked = true
                        }
                    }
                }
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // Real bug found 2026-08-27: AnimatedContent(targetState = uiState) re-runs
    // its content lambda fresh for every *distinct value* of uiState — not just
    // when the destination screen actually changes. Unauthenticated and every
    // distinct Error(message) are different values, so AnimatedContent treated
    // each one as a brand-new target state and recomposed AuthGraph(authViewModel)
    // from scratch each time, which recreated its rememberNavController() and
    // reset the back stack to "landing" — silently bouncing the user back to
    // the Welcome screen (losing whatever they'd typed) on *every* failed
    // sign-in/sign-up attempt, instead of showing the error on Login/SignUp
    // where they were. Keying on this coarser RootScreen category instead
    // means AuthGraph stays mounted (and keeps its own nav position) across
    // Unauthenticated <-> Error transitions; LoginScreen/SignUpScreen still
    // read the live error message reactively straight from authViewModel.
    val rootScreen = when (uiState) {
        is AuthUiState.Loading -> RootScreen.Loading
        is AuthUiState.Unauthenticated, is AuthUiState.Error -> RootScreen.AuthFlow
        is AuthUiState.Onboarding -> RootScreen.Onboarding
        is AuthUiState.Authenticated -> RootScreen.Authenticated
    }

    AnimatedContent(targetState = rootScreen, label = "root_navigation") { screen ->
        when (screen) {
            RootScreen.Loading       -> SplashScreen()
            RootScreen.AuthFlow      -> AuthGraph(authViewModel)
            RootScreen.Onboarding    -> OnboardingScreen(onComplete = { }, viewModel = authViewModel)
            RootScreen.Authenticated -> {
                if (isLocked) {
                    LockScreen(onUnlocked = { isLocked = false })
                } else {
                    MainGraph(deepLinkLiveRunId = deepLinkLiveRunId)
                }
            }
        }
    }
}

private enum class RootScreen { Loading, AuthFlow, Onboarding, Authenticated }

@Composable
fun AuthGraph(authViewModel: AuthViewModel) {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "landing") {
        composable("landing") {
            LandingScreen(
                onGetStarted = { navController.navigate("signup") },
                onSignIn = { navController.navigate("login") }
            )
        }
        composable("login") {
            LoginScreen(viewModel = authViewModel, onBack = { navController.popBackStack() })
        }
        composable("signup") {
            SignUpScreen(viewModel = authViewModel, onBack = { navController.popBackStack() })
        }
    }
}

sealed class BottomNavItem(val route: String, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    object Home      : BottomNavItem("home",      "Home",      Icons.Default.Home)
    object Run       : BottomNavItem("run",       "Run",       Icons.Default.DirectionsRun)
    object Community : BottomNavItem("community", "Community", Icons.Default.People)
    object Coach     : BottomNavItem("coach",     "Coach",     Icons.Default.AutoAwesome)
    object Profile   : BottomNavItem("profile",   "Profile",   Icons.Default.Person)
}

@Composable
fun MainGraph(deepLinkLiveRunId: String? = null) {
    val navController = rememberNavController()
    val items = listOf(BottomNavItem.Home, BottomNavItem.Run, BottomNavItem.Community, BottomNavItem.Coach, BottomNavItem.Profile)

    var runFlow by remember { mutableStateOf(RunFlow.Idle) }
    var finishedRun by remember { mutableStateOf<RunRecord?>(null) }
    var showPaywall by remember { mutableStateOf(false) }
    var resumeCheckpoint by remember { mutableStateOf<RunCheckpoint?>(null) }
    var pendingWorkoutSteps by remember { mutableStateOf<List<IntervalStep>?>(null) }
    var pendingTrainingWorkout by remember { mutableStateOf<TrainingWorkout?>(null) }
    // RunDetailScreen's "Continue with AI Coach" hand-off (RN_SOURCE_ARCHIVE.md
    // §4) — same pending-state-then-navigate pattern as pendingTrainingWorkout.
    var pendingCoachPrompt by remember { mutableStateOf<String?>(null) }
    val coroutineScope = rememberCoroutineScope()
    val runSaveViewModel: RunSaveViewModel = hiltViewModel()

    // Live-share deep link (com.ruvo.app://live/{runId}) — navigates every time a
    // new link is opened, including while MainGraph is already on screen. Also
    // drops any full-screen overlay (own active run, paywall, RateEffort/Summary)
    // since those are early-returns above the NavHost below and would otherwise
    // hide the destination this just pushed onto navController's back stack.
    LaunchedEffect(deepLinkLiveRunId) {
        if (deepLinkLiveRunId != null) {
            runFlow = RunFlow.Idle
            showPaywall = false
            navController.navigate("live_run/$deepLinkLiveRunId")
        }
    }

    // Net-new: offer to resume a run whose process died mid-track instead of
    // silently losing it. See RunCheckpoint's doc comment.
    val recoveryViewModel: RunRecoveryViewModel = hiltViewModel()
    val pendingCheckpoint by recoveryViewModel.pendingCheckpoint.collectAsStateWithLifecycle()
    if (pendingCheckpoint != null && runFlow == RunFlow.Idle) {
        RunRecoveryDialog(
            checkpoint = pendingCheckpoint!!,
            onResume = {
                resumeCheckpoint = recoveryViewModel.consume()
                runFlow = RunFlow.Tracking
            },
            onDiscard = { recoveryViewModel.discard() },
        )
    }

    // RPE → Summary flow after run
    if (runFlow == RunFlow.RateEffort && finishedRun != null) {
        RateEffortScreen(
            onSubmit = { rating, notes, tags, gearId ->
                val run = finishedRun
                if (run != null) {
                    coroutineScope.launch {
                        val (earnedXp, earnedCoins) = submitRunActivity(runSaveViewModel, run, rating, notes, tags, gearId)
                        finishedRun = run.copy(xpEarned = earnedXp.toInt(), coinsEarned = earnedCoins.toInt())
                    }
                }
                runFlow = RunFlow.Summary
            },
            onSkip = { gearId ->
                val run = finishedRun
                if (run != null) {
                    coroutineScope.launch {
                        val (earnedXp, earnedCoins) = submitRunActivity(runSaveViewModel, run, rating = 0, notes = "", tags = emptyList(), gearId = gearId)
                        finishedRun = run.copy(xpEarned = earnedXp.toInt(), coinsEarned = earnedCoins.toInt())
                    }
                }
                runFlow = RunFlow.Summary
            },
        )
        return
    }

    if (runFlow == RunFlow.Summary && finishedRun != null) {
        RunSummaryScreen(run = finishedRun!!, onDone = {
            finishedRun = null
            runFlow = RunFlow.Idle
        })
        return
    }

    if (runFlow == RunFlow.Tracking) {
        RunTrackingScreen(
            onFinished = { run ->
                resumeCheckpoint = null
                pendingWorkoutSteps = null
                finishedRun = run
                runFlow = RunFlow.RateEffort
            },
            onDismiss = { resumeCheckpoint = null; pendingWorkoutSteps = null; runFlow = RunFlow.Idle },
            resumeCheckpoint = resumeCheckpoint,
            workoutSteps = pendingWorkoutSteps,
        )
        return
    }

    if (showPaywall) {
        PaywallScreen(onDismiss = { showPaywall = false })
        return
    }

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = RuvoColors.surface, tonalElevation = 0.dp) {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination
                items.forEach { item ->
                    NavigationBarItem(
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = { Text(item.label, style = MaterialTheme.typography.labelSmall) },
                        selected = currentDestination?.hierarchy?.any { it.route == item.route } == true,
                        onClick = {
                            when (item) {
                                BottomNavItem.Run -> runFlow = RunFlow.Tracking
                                else -> navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = RuvoColors.lime,
                            selectedTextColor = RuvoColors.lime,
                            unselectedIconColor = RuvoColors.textTertiary,
                            unselectedTextColor = RuvoColors.textTertiary,
                            indicatorColor = RuvoColors.limeDim,
                        )
                    )
                }
            }
        }
    ) { padding ->
        NavHost(navController = navController, startDestination = "home", modifier = Modifier.padding(padding)) {
            composable("home")         { HomeScreen(navController = navController, onStartRun = { runFlow = RunFlow.Tracking }) }
            composable("community")    { CommunityScreen(navController = navController) }
            composable("coach") {
                AICoachScreen(
                    onUpgrade = { navController.navigate("paywall") },
                    initialPrompt = pendingCoachPrompt,
                    // Cleared from a LaunchedEffect inside AICoachScreen (after
                    // send()), not directly here in the composition body —
                    // state writes belong in an effect, not composition itself.
                    onPromptConsumed = { pendingCoachPrompt = null },
                )
            }
            composable("profile")      { ProfileScreen(navController = navController) }

            composable("analytics")    { AnalyticsDashboardScreen(onRunDetail = { navController.navigate("run_detail/$it") }, onUpgrade = { navController.navigate("paywall") }) }
            composable("paywall")      { PaywallScreen(onDismiss = { navController.popBackStack() }) }
            composable("customer_center") { com.ruvo.app.features.paywall.CustomerCenterScreen(onDismiss = { navController.popBackStack() }) }
            composable("health")       { HealthIntegrationsScreen() }
            // "prs" removed 2026-08-17 — Personal Records is now an embedded
            // card inside AnalyticsScreen ("analytics" route above), matching
            // RN's real layout, not its own screen. See ProfileScreen.kt's
            // menu-item comment and PersonalRecordsScreen.kt.
            composable("training") {
                TrainingPlanScreen(onStartWorkout = { workout ->
                    pendingTrainingWorkout = workout
                    navController.navigate("workout_detail")
                })
            }
            composable("shoes")        { ShoeTrackerScreen(onBack = { navController.popBackStack() }) }
            composable("intervals")    { IntervalTrainingScreen() }

            // Social & discovery
            composable("leaderboard")  { LeaderboardScreen(onBack = { navController.popBackStack() }) }
            composable("achievements") { AchievementsScreen(onBack = { navController.popBackStack() }) }
            composable("find_friends") { FindFriendsScreen(onBack = { navController.popBackStack() }, onUserProfile = { navController.navigate("user_profile/$it") }) }
            composable("referral")     { ReferralScreen(onBack = { navController.popBackStack() }) }
            composable("search")       { SearchScreen(onBack = { navController.popBackStack() }, onUserProfile = { navController.navigate("user_profile/$it") }) }

            // Rewards
            composable("rewards")         { RewardsScreen(onBack = { navController.popBackStack() }, onMyRedemptions = { navController.navigate("my_redemptions") }) }
            composable("my_redemptions")  { MyRedemptionsScreen(onBack = { navController.popBackStack() }) }

            // Settings
            composable("settings") {
                val settingsAuthViewModel: AuthViewModel = hiltViewModel()
                SettingsScreen(
                    onBack = { navController.popBackStack() },
                    onNavigate = { navController.navigate(it) },
                    onSignOut = { settingsAuthViewModel.signOut() },
                )
            }
            composable("help")     { HelpCenterScreen(onBack = { navController.popBackStack() }) }
            composable("privacy")  { PrivacyControlsScreen(onBack = { navController.popBackStack() }) }
            composable("connected_devices") { ConnectedDevicesScreen(onBack = { navController.popBackStack() }) }

            // Run tracking extras
            composable("workout_detail") {
                WorkoutDetailScreen(
                    presetWorkout = pendingTrainingWorkout,
                    onBack = { pendingTrainingWorkout = null; navController.popBackStack() },
                    onStartRun = { steps ->
                        pendingTrainingWorkout = null
                        pendingWorkoutSteps = steps
                        runFlow = RunFlow.Tracking
                    },
                )
            }
            composable("save_activity")  { SaveActivityScreen(onBack = { navController.popBackStack() }, onSaved = { navController.popBackStack() }) }
            composable(
                route = "tip_detail/{tipId}",
                arguments = listOf(navArgument("tipId") { type = NavType.StringType }),
            ) { backStack ->
                TipDetailScreen(tipId = backStack.arguments?.getString("tipId") ?: "", onBack = { navController.popBackStack() })
            }
            composable(
                route = "run_detail/{runId}",
                arguments = listOf(navArgument("runId") { type = NavType.StringType }),
            ) { backStack ->
                RunDetailScreen(
                    runId = backStack.arguments?.getString("runId") ?: "",
                    onBack = { navController.popBackStack() },
                    onCoachHandoff = { prompt ->
                        pendingCoachPrompt = prompt
                        navController.navigate("coach")
                    },
                )
            }

            composable(
                route = "live_run/{runId}",
                arguments = listOf(navArgument("runId") { type = NavType.StringType }),
            ) { backStack ->
                LiveRunViewerScreen(runId = backStack.arguments?.getString("runId") ?: "", onBack = { navController.popBackStack() })
            }

            // User profile & chat
            composable(
                route = "user_profile/{userId}",
                arguments = listOf(navArgument("userId") { type = NavType.StringType }),
            ) { backStack ->
                UserProfileScreen(
                    userId = backStack.arguments?.getString("userId") ?: "",
                    onBack = { navController.popBackStack() },
                    onChat = { navController.navigate("chat/$it") },
                )
            }
            composable(
                route = "chat/{partnerId}",
                arguments = listOf(navArgument("partnerId") { type = NavType.StringType }),
            ) { backStack ->
                ChatScreen(partnerId = backStack.arguments?.getString("partnerId") ?: "", onBack = { navController.popBackStack() }, onBlocked = { navController.popBackStack() })
            }
            composable(
                route = "user_list/{title}/{ids}",
                arguments = listOf(
                    navArgument("title") { type = NavType.StringType },
                    navArgument("ids") { type = NavType.StringType; defaultValue = "" },
                ),
            ) { backStack ->
                val title = backStack.arguments?.getString("title") ?: "Users"
                val ids = backStack.arguments?.getString("ids")?.split(",")?.filter { it.isNotBlank() } ?: emptyList()
                UserListScreen(title = title, userIds = ids, onBack = { navController.popBackStack() }, onUserProfile = { navController.navigate("user_profile/$it") })
            }

            // Clubs
            composable("create_club") { CreateClubScreen(onBack = { navController.popBackStack() }, onCreated = { navController.popBackStack() }) }
            composable(
                route = "club_detail/{clubId}",
                arguments = listOf(navArgument("clubId") { type = NavType.StringType }),
            ) { backStack ->
                ClubDetailScreen(
                    clubId = backStack.arguments?.getString("clubId") ?: "",
                    onBack = { navController.popBackStack() },
                    onUserProfile = { navController.navigate("user_profile/$it") },
                )
            }
        }
    }
}

@Composable
private fun RunRecoveryDialog(
    checkpoint: RunCheckpoint,
    onResume: () -> Unit,
    onDiscard: () -> Unit,
) {
    val distanceKm = checkpoint.distanceMeters / 1000.0
    AlertDialog(
        onDismissRequest = { /* force a choice — no accidental dismiss */ },
        title = { Text("Resume your run?") },
        text = {
            Text(
                "It looks like Ruvo closed unexpectedly during a run. " +
                    "You'd tracked ${String.format("%.2f", distanceKm)} km over ${formatRunDuration(checkpoint.elapsedSeconds)}. " +
                    "Resume it or start fresh?"
            )
        },
        confirmButton = { TextButton(onClick = onResume) { Text("Resume") } },
        dismissButton = { TextButton(onClick = onDiscard) { Text("Discard") } },
    )
}

@Composable
fun SplashScreen() {
    Box(
        modifier = Modifier.fillMaxSize().background(RuvoColors.background),
        contentAlignment = Alignment.Center
    ) {
        Text("RUVO", style = MaterialTheme.typography.displayLarge, color = RuvoColors.lime)
    }
}
