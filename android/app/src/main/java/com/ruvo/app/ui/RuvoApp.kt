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
import com.google.firebase.functions.FirebaseFunctions
import com.ruvo.app.designsystem.theme.RuvoColors
import com.ruvo.app.features.gamification.GamificationRepository
import kotlinx.coroutines.launch
import com.ruvo.app.features.achievements.AchievementsScreen
import com.ruvo.app.features.aicoach.AICoachScreen
import com.ruvo.app.features.analytics.AnalyticsDashboardScreen
import com.ruvo.app.features.analytics.PersonalRecordsScreen
import com.ruvo.app.features.auth.*
import com.ruvo.app.features.community.*
import com.ruvo.app.features.gamification.GamificationScreen
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
import com.ruvo.app.features.runtracking.IntervalTrainingScreen
import com.ruvo.app.features.runtracking.RateEffortScreen
import com.ruvo.app.features.runtracking.RunDetailScreen
import com.ruvo.app.features.runtracking.RunSummaryScreen
import com.ruvo.app.features.runtracking.RunTrackingScreen
import com.ruvo.app.features.runtracking.SaveActivityScreen
import com.ruvo.app.features.runtracking.WorkoutDetailScreen
import com.ruvo.app.features.gear.ShoeTrackerScreen
import com.ruvo.app.features.training.TrainingPlanScreen
import com.ruvo.app.features.tips.TipDetailScreen

private enum class RunFlow { Idle, Tracking, RateEffort, Summary }

// The single real save point for a completed run — mirrors RN's
// SaveActivityScreen.js::handleSave(), which builds the complete runEntry (including
// rpe/notes/tags) and calls the saveRunActivity Cloud Function exactly once (see
// RN_SOURCE_ARCHIVE.md §9). Returns the server-computed (earnedXp, earnedCoins) so the
// summary screen can show real values instead of a fabricated client-side estimate.
private suspend fun submitRunActivity(run: RunRecord, rating: Int, notes: String, tags: List<String>): Pair<Long, Long> {
    return try {
        val runEntry = mapOf(
            "id" to run.id,
            "date" to java.time.Instant.now().toString(),
            "distance" to run.distanceKm,
            "duration" to formatRunDuration(run.durationSeconds),
            "pace" to formatRunPace(run.averagePaceMinPerKm),
            "calories" to run.calories,
            "heartRate" to 0,
            "routePath" to run.route.map { mapOf("latitude" to it.latitude, "longitude" to it.longitude) },
            "kmSplits" to run.laps.map { lap -> mapOf("lapNumber" to lap.number, "distanceKm" to lap.distanceKm, "durationSeconds" to lap.durationSeconds) },
            "elevationGain" to run.elevationGainM.toInt(),
            "activityType" to "Run",
            "title" to (run.title ?: "Run"),
            "rpe" to rating,
            "notes" to notes,
            "tags" to tags,
        )
        val repo = GamificationRepository(FirebaseFunctions.getInstance())
        val result = repo.saveRunActivity(runEntry)
        result.earnedXp to result.earnedCoins
    } catch (_: Exception) {
        // RN queues offline via savePendingRun/retryPendingRuns on failure — Android
        // doesn't yet have that offline-queue equivalent (a known, documented gap;
        // see RN_SOURCE_ARCHIVE.md §1 "Edge cases"). Fail soft rather than crash.
        0L to 0L
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

@Composable
fun RuvoApp(authViewModel: AuthViewModel = hiltViewModel()) {
    val uiState by authViewModel.uiState.collectAsStateWithLifecycle()

    AnimatedContent(targetState = uiState, label = "root_navigation") { state ->
        when (state) {
            is AuthUiState.Loading       -> SplashScreen()
            is AuthUiState.Unauthenticated, is AuthUiState.Error -> AuthGraph(authViewModel)
            is AuthUiState.Onboarding    -> OnboardingScreen(onComplete = { }, viewModel = authViewModel)
            is AuthUiState.Authenticated -> MainGraph()
        }
    }
}

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
fun MainGraph() {
    val navController = rememberNavController()
    val items = listOf(BottomNavItem.Home, BottomNavItem.Run, BottomNavItem.Community, BottomNavItem.Coach, BottomNavItem.Profile)

    var runFlow by remember { mutableStateOf(RunFlow.Idle) }
    var finishedRun by remember { mutableStateOf<RunRecord?>(null) }
    var showPaywall by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    // RPE → Summary flow after run
    if (runFlow == RunFlow.RateEffort && finishedRun != null) {
        RateEffortScreen(
            onSubmit = { rating, notes, tags ->
                val run = finishedRun
                if (run != null) {
                    coroutineScope.launch {
                        val (earnedXp, earnedCoins) = submitRunActivity(run, rating, notes, tags)
                        finishedRun = run.copy(xpEarned = earnedXp.toInt(), coinsEarned = earnedCoins.toInt())
                    }
                }
                runFlow = RunFlow.Summary
            },
            onSkip = {
                val run = finishedRun
                if (run != null) {
                    coroutineScope.launch {
                        val (earnedXp, earnedCoins) = submitRunActivity(run, rating = 0, notes = "", tags = emptyList())
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
                finishedRun = run
                runFlow = RunFlow.RateEffort
            },
            onDismiss = { runFlow = RunFlow.Idle }
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
            composable("coach")        { AICoachScreen(onUpgrade = { navController.navigate("paywall") }) }
            composable("profile")      { ProfileScreen(navController = navController) }

            composable("analytics")    { AnalyticsDashboardScreen(onRunDetail = { navController.navigate("run_detail/$it") }) }
            composable("gamification") { GamificationScreen() }
            composable("paywall")      { PaywallScreen(onDismiss = { navController.popBackStack() }) }
            composable("customer_center") { com.ruvo.app.features.paywall.CustomerCenterScreen(onDismiss = { navController.popBackStack() }) }
            composable("health")       { HealthIntegrationsScreen() }
            composable("prs")          { PersonalRecordsScreen() }
            composable("training")     { TrainingPlanScreen() }
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
            composable("workout_detail") { WorkoutDetailScreen(onBack = { navController.popBackStack() }, onStartRun = { runFlow = RunFlow.Tracking }) }
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
                RunDetailScreen(runId = backStack.arguments?.getString("runId") ?: "", onBack = { navController.popBackStack() })
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
fun SplashScreen() {
    Box(
        modifier = Modifier.fillMaxSize().background(RuvoColors.background),
        contentAlignment = Alignment.Center
    ) {
        Text("RUVO", style = MaterialTheme.typography.displayLarge, color = RuvoColors.lime)
    }
}
