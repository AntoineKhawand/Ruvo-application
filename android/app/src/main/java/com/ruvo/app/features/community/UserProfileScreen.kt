package com.ruvo.app.features.community

import android.content.Intent
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import kotlin.math.roundToInt

data class UserProfileData(
    val uid: String = "",
    val displayName: String = "",
    val bio: String = "",
    val country: String = "",
    val totalKm: Double = 0.0,
    val totalRuns: Int = 0,
    val followingCount: Int = 0,
    val followersCount: Int = 0,
    val level: Int = 1,
    val currentXP: Int = 0,
    val xpToNext: Int = 1000,
    val weeklyDistanceKm: Double = 0.0,
    val avgPaceSecPerKm: Int = 0,
    val isFollowing: Boolean = false,
    val isBlocked: Boolean = false,
    val isMe: Boolean = false,
)

data class UserRunItem(
    val id: String,
    val distanceKm: Double,
    val durationSeconds: Int,
    val activityType: String,
    val startedAtMillis: Long,
)

private val REPORT_REASONS = listOf(
    "Spam or Advertising" to "spam",
    "Inappropriate Content" to "inappropriate",
    "Harassment or Bullying" to "harassment",
    "Misinformation" to "misinformation",
    "Other" to "other",
)

@HiltViewModel
class UserProfileViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _data = MutableStateFlow(UserProfileData())
    val data: StateFlow<UserProfileData> = _data.asStateFlow()
    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    private val _recentRuns = MutableStateFlow<List<UserRunItem>>(emptyList())
    val recentRuns: StateFlow<List<UserRunItem>> = _recentRuns.asStateFlow()
    private val _reportSubmitted = MutableStateFlow(false)
    val reportSubmitted: StateFlow<Boolean> = _reportSubmitted.asStateFlow()

    fun loadUser(userId: String) {
        viewModelScope.launch {
            val myUid = auth.currentUser?.uid ?: return@launch
            try {
                val meDoc = firestore.collection("users").document(myUid).get().await()
                @Suppress("UNCHECKED_CAST")
                val myFollowing = ((meDoc.data?.get("following") as? List<String>) ?: emptyList()).toSet()
                @Suppress("UNCHECKED_CAST")
                val myBlocked = ((meDoc.data?.get("blocked") as? List<String>) ?: emptyList()).toSet()

                val targetDoc = firestore.collection("users").document(userId).get().await()
                val d = targetDoc.data ?: return@launch

                // The real saveRunActivity Cloud Function (functions/index.js) writes
                // each finished run as one entry in the users/{uid}.runHistory ARRAY
                // field — there is no users/{uid}/runs subcollection (see
                // RN_ANDROID_PORT_MAPPING.md's "Known Data-Layer Bugs" section). This
                // was silently always empty before.
                @Suppress("UNCHECKED_CAST")
                val runHistory = d["runHistory"] as? List<Map<String, Any>> ?: emptyList()
                val runs = runHistory
                    .sortedByDescending { r ->
                        (r["date"] as? String)?.let { runCatching { java.time.Instant.parse(it) }.getOrNull() } ?: java.time.Instant.EPOCH
                    }
                    .take(20)
                    .mapNotNull { r ->
                        val id = r["id"] as? String ?: return@mapNotNull null
                        val dist = (r["distance"] as? Number)?.toDouble() ?: return@mapNotNull null
                        val durParts = (r["duration"] as? String)?.split(":")?.mapNotNull { it.toLongOrNull() }
                        val durSec = when (durParts?.size) {
                            2 -> durParts[0] * 60 + durParts[1]
                            3 -> durParts[0] * 3600 + durParts[1] * 60 + durParts[2]
                            else -> 0L
                        }
                        val startedAtMillis = (r["date"] as? String)
                            ?.let { runCatching { java.time.Instant.parse(it).toEpochMilli() }.getOrNull() } ?: 0L
                        UserRunItem(
                            id = id,
                            distanceKm = dist,
                            durationSeconds = durSec.toInt(),
                            activityType = r["activityType"] as? String ?: "Run",
                            startedAtMillis = startedAtMillis,
                        )
                    }
                _recentRuns.value = runs

                val totalDist = runs.sumOf { it.distanceKm }
                val totalDur = runs.sumOf { it.durationSeconds }
                val avgPace = if (totalDist > 0) (totalDur / totalDist).roundToInt() else 0

                _data.value = UserProfileData(
                    uid = userId,
                    displayName = d["displayName"] as? String ?: d["name"] as? String ?: "Runner",
                    bio = d["bio"] as? String ?: "",
                    country = (d["location"] as? Map<*, *>)?.get("country") as? String ?: "",
                    totalKm = (d["totalKm"] as? Number)?.toDouble() ?: 0.0,
                    totalRuns = (d["totalRuns"] as? Number)?.toInt() ?: 0,
                    followingCount = (d["following"] as? List<*>)?.size ?: 0,
                    followersCount = (d["followers"] as? List<*>)?.size ?: 0,
                    level = (d["level"] as? Number)?.toInt() ?: 1,
                    currentXP = (d["currentXP"] as? Number)?.toInt() ?: 0,
                    xpToNext = (d["xpToNextLevel"] as? Number)?.toInt() ?: 1000,
                    weeklyDistanceKm = (d["weeklyDistance"] as? Number)?.toDouble() ?: 0.0,
                    avgPaceSecPerKm = avgPace,
                    isFollowing = userId in myFollowing,
                    isBlocked = userId in myBlocked,
                    isMe = userId == myUid,
                )
            } catch (_: Exception) {
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun toggleFollow() {
        viewModelScope.launch {
            val myUid = auth.currentUser?.uid ?: return@launch
            val targetUid = _data.value.uid
            val isFollowing = _data.value.isFollowing
            val myRef = firestore.collection("users").document(myUid)
            val targetRef = firestore.collection("users").document(targetUid)
            val batch = firestore.batch()

            if (isFollowing) {
                batch.update(myRef, "following", FieldValue.arrayRemove(targetUid))
                batch.update(targetRef, "followers", FieldValue.arrayRemove(myUid))
            } else {
                batch.update(myRef, "following", FieldValue.arrayUnion(targetUid))
                batch.update(targetRef, "followers", FieldValue.arrayUnion(myUid))
            }
            batch.commit().await()
            _data.update { it.copy(isFollowing = !isFollowing, followersCount = if (isFollowing) it.followersCount - 1 else it.followersCount + 1) }
        }
    }

    fun toggleBlock() {
        val myUid = auth.currentUser?.uid ?: return
        val targetUid = _data.value.uid
        val wasBlocked = _data.value.isBlocked
        _data.update { it.copy(isBlocked = !wasBlocked) }
        viewModelScope.launch {
            try {
                val myRef = firestore.collection("users").document(myUid)
                if (wasBlocked) {
                    myRef.update("blocked", FieldValue.arrayRemove(targetUid)).await()
                } else {
                    myRef.update("blocked", FieldValue.arrayUnion(targetUid)).await()
                }
            } catch (_: Exception) {
                _data.update { it.copy(isBlocked = wasBlocked) }
            }
        }
    }

    fun submitReport(reason: String) {
        viewModelScope.launch {
            val myUid = auth.currentUser?.uid ?: return@launch
            try {
                firestore.collection("reports").add(
                    mapOf(
                        "reporterId" to myUid,
                        "itemId" to _data.value.uid,
                        "itemType" to "user",
                        "reason" to reason,
                        "status" to "pending",
                        "createdAt" to FieldValue.serverTimestamp(),
                    )
                ).await()
                _reportSubmitted.value = true
            } catch (_: Exception) {}
        }
    }

    fun dismissReportConfirmation() {
        _reportSubmitted.value = false
    }
}

private fun levelTitle(level: Int) = when {
    level < 5  -> "Rookie"
    level < 10 -> "Endurance Athlete"
    level < 20 -> "Elite Runner"
    else       -> "Legend"
}

private fun formatPace(secPerKm: Int): String {
    if (secPerKm <= 0) return "0:00"
    return "${secPerKm / 60}:${(secPerKm % 60).toString().padStart(2, '0')}"
}

@Composable
fun UserProfileScreen(
    userId: String,
    onBack: () -> Unit = {},
    onChat: (String) -> Unit = {},
    viewModel: UserProfileViewModel = hiltViewModel(),
) {
    val data by viewModel.data.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val recentRuns by viewModel.recentRuns.collectAsStateWithLifecycle()
    val reportSubmitted by viewModel.reportSubmitted.collectAsStateWithLifecycle()
    val context = LocalContext.current

    var showMenu by remember { mutableStateOf(false) }
    var showReportDialog by remember { mutableStateOf(false) }
    var activityFilter by remember { mutableStateOf("Week") }

    LaunchedEffect(userId) { viewModel.loadUser(userId) }

    if (isLoading) {
        Box(modifier = Modifier.fillMaxSize().background(RuvoColors.background), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = RuvoColors.lime)
        }
        return
    }

    val filteredRuns = remember(recentRuns, activityFilter) {
        if (activityFilter == "Week") {
            val cutoff = System.currentTimeMillis() - 7L * 24 * 60 * 60 * 1000
            recentRuns.filter { it.startedAtMillis >= cutoff }
        } else recentRuns
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().background(RuvoColors.background).verticalScroll(rememberScrollState()),
        ) {
            // Cover
            Box(modifier = Modifier.fillMaxWidth().height(200.dp)) {
                Box(
                    modifier = Modifier.fillMaxWidth().height(140.dp)
                        .background(Brush.linearGradient(listOf(Color(0xFF0A1A00), Color(0xFF1A2F00), RuvoColors.limeDim)))
                )
                Row(
                    modifier = Modifier.align(Alignment.TopStart).fillMaxWidth().padding(8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                    }
                    Box {
                        IconButton(onClick = { showMenu = true }) {
                            Icon(Icons.Default.MoreVert, contentDescription = "More options", tint = Color.White)
                        }
                        DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                            DropdownMenuItem(
                                text = { Text("Share Profile") },
                                leadingIcon = { Icon(Icons.Default.Share, contentDescription = null) },
                                onClick = {
                                    showMenu = false
                                    val sendIntent = Intent(Intent.ACTION_SEND).apply {
                                        type = "text/plain"
                                        putExtra(Intent.EXTRA_TEXT, "Check out ${data.displayName} on RUVO!")
                                    }
                                    context.startActivity(Intent.createChooser(sendIntent, null))
                                },
                            )
                            if (!data.isMe) {
                                DropdownMenuItem(
                                    text = { Text("Report User", color = RuvoColors.warning) },
                                    leadingIcon = { Icon(Icons.Default.Flag, contentDescription = null, tint = RuvoColors.warning) },
                                    onClick = { showMenu = false; showReportDialog = true },
                                )
                                DropdownMenuItem(
                                    text = { Text(if (data.isBlocked) "Unblock User" else "Block User", color = RuvoColors.error) },
                                    leadingIcon = { Icon(Icons.Default.Block, contentDescription = null, tint = RuvoColors.error) },
                                    onClick = { showMenu = false; viewModel.toggleBlock() },
                                )
                            }
                        }
                    }
                }

                // Avatar
                Box(
                    modifier = Modifier.align(Alignment.BottomStart).padding(start = 20.dp)
                        .size(80.dp).clip(CircleShape)
                        .background(RuvoColors.surfaceElev)
                        .border(3.dp, RuvoColors.lime, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(40.dp))
                }

                // Actions
                Row(
                    modifier = Modifier.align(Alignment.BottomEnd).padding(end = 16.dp, bottom = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (!data.isMe) {
                        OutlinedButton(
                            onClick = { onChat(data.uid) },
                            shape = RoundedCornerShape(20.dp),
                            border = BorderStroke(1.dp, RuvoColors.border),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        ) { Text("Message", color = RuvoColors.textPrimary, style = MaterialTheme.typography.labelMedium) }

                        Button(
                            onClick = {
                                if (data.isBlocked) viewModel.toggleBlock() else viewModel.toggleFollow()
                            },
                            shape = RoundedCornerShape(20.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = when {
                                    data.isBlocked -> Color(0xFF1A0000)
                                    data.isFollowing -> RuvoColors.surface
                                    else -> RuvoColors.lime
                                },
                                contentColor = if (data.isFollowing || data.isBlocked) Color.White else Color.Black,
                            ),
                            border = when {
                                data.isBlocked -> BorderStroke(1.dp, RuvoColors.error.copy(alpha = 0.4f))
                                data.isFollowing -> BorderStroke(1.dp, RuvoColors.lime)
                                else -> null
                            },
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        ) {
                            Text(
                                if (data.isBlocked) "Blocked" else if (data.isFollowing) "Following" else "Follow",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
            }

            // Name & bio
            Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(data.displayName, style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
                    if (data.country.isNotBlank()) Text(data.country, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textTertiary)
                }
                if (data.bio.isNotBlank()) Text(data.bio, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)

                // Level badge
                Surface(shape = RoundedCornerShape(20.dp), color = RuvoColors.limeDim) {
                    Row(modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("⚡", fontSize = 12.sp)
                        Text("Lvl ${data.level} · ${levelTitle(data.level)}", style = MaterialTheme.typography.labelMedium, color = RuvoColors.lime, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // XP progress bar
            Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("XP Progress", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                    Text("${data.currentXP} / ${data.xpToNext}", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                }
                Spacer(Modifier.height(4.dp))
                LinearProgressIndicator(
                    progress = { (data.currentXP / data.xpToNext.toFloat()).coerceIn(0f, 1f) },
                    modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                    color = RuvoColors.lime,
                    trackColor = RuvoColors.surfaceElev,
                )
            }

            Spacer(Modifier.height(16.dp))

            // Social row
            Surface(color = RuvoColors.surface, modifier = Modifier.fillMaxWidth()) {
                Row(modifier = Modifier.padding(vertical = 16.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                    StatCell(label = "Followers", value = "${data.followersCount}")
                    VerticalDivider(modifier = Modifier.height(40.dp), color = RuvoColors.border)
                    StatCell(label = "Following", value = "${data.followingCount}")
                    VerticalDivider(modifier = Modifier.height(40.dp), color = RuvoColors.border)
                    StatCell(label = "Runs", value = "${data.totalRuns}")
                }
            }

            Spacer(Modifier.height(16.dp))

            // Stats card row (Distance / Avg Pace / Runs)
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                ProfileStatCard(icon = Icons.Default.DirectionsRun, iconColor = RuvoColors.lime, value = String.format("%.1f", data.totalKm), label = "KM TOTAL", modifier = Modifier.weight(1f))
                ProfileStatCard(icon = Icons.Default.Timer, iconColor = RuvoColors.teal, value = formatPace(data.avgPaceSecPerKm), label = "AVG PACE", modifier = Modifier.weight(1f))
                ProfileStatCard(icon = Icons.Default.DirectionsRun, iconColor = RuvoColors.vo2Orange, value = "${data.totalRuns}", label = "TOTAL RUNS", modifier = Modifier.weight(1f))
            }

            Spacer(Modifier.height(16.dp))

            // Weekly distance card
            Surface(shape = RoundedCornerShape(16.dp), color = RuvoColors.surface, border = BorderStroke(1.dp, RuvoColors.border), modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("🏃", fontSize = 28.sp)
                    Column {
                        Text("This Week", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                        Text(String.format("%.1f km", data.weeklyDistanceKm), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, color = RuvoColors.lime)
                    }
                }
            }

            Spacer(Modifier.height(24.dp))

            // Recent Activity
            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Recent Activity", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("Week", "All").forEach { f ->
                            val active = activityFilter == f
                            Surface(
                                onClick = { activityFilter = f },
                                shape = RoundedCornerShape(16.dp),
                                color = if (active) RuvoColors.surfaceElev else RuvoColors.surface,
                                border = BorderStroke(1.dp, if (active) RuvoColors.lime else RuvoColors.border),
                            ) {
                                Text(
                                    f,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (active) RuvoColors.textPrimary else RuvoColors.textTertiary,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(14.dp))

                if (filteredRuns.isEmpty()) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 30.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Icon(Icons.Default.DirectionsRun, contentDescription = null, tint = RuvoColors.surfaceElev, modifier = Modifier.size(32.dp))
                        Spacer(Modifier.height(8.dp))
                        Text(
                            if (activityFilter == "Week") "No runs this week" else "No runs yet",
                            style = MaterialTheme.typography.bodySmall,
                            color = RuvoColors.textTertiary,
                        )
                        if (activityFilter == "Week") {
                            TextButton(onClick = { activityFilter = "All" }) {
                                Text("View all time →", style = MaterialTheme.typography.labelSmall, color = RuvoColors.lime, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                } else {
                    filteredRuns.forEach { run -> UserRunCard(run) }
                }
            }

            Spacer(Modifier.height(80.dp))
        }

        if (showReportDialog) {
            ReportUserDialog(
                onDismiss = { showReportDialog = false },
                onSelect = { reason -> showReportDialog = false; viewModel.submitReport(reason) },
            )
        }

        if (reportSubmitted) {
            AlertDialog(
                onDismissRequest = { viewModel.dismissReportConfirmation() },
                confirmButton = {
                    TextButton(onClick = { viewModel.dismissReportConfirmation() }) { Text("OK", color = RuvoColors.lime) }
                },
                title = { Text("Report Submitted") },
                text = { Text("Thank you. Our team reviews all reports within 24–48 hours and will take action if community guidelines were violated.") },
                containerColor = RuvoColors.surface,
                titleContentColor = RuvoColors.textPrimary,
                textContentColor = RuvoColors.textSecondary,
            )
        }
    }
}

@Composable
private fun ReportUserDialog(onDismiss: () -> Unit, onSelect: (String) -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = RuvoColors.textTertiary) } },
        title = { Text("Report User") },
        text = {
            Column {
                Text("What's the issue?", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
                Spacer(Modifier.height(12.dp))
                REPORT_REASONS.forEach { (label, value) ->
                    Text(
                        label,
                        style = MaterialTheme.typography.bodyMedium,
                        color = RuvoColors.textPrimary,
                        modifier = Modifier.fillMaxWidth().clickable { onSelect(value) }.padding(vertical = 10.dp),
                    )
                }
            }
        },
        containerColor = RuvoColors.surface,
        titleContentColor = RuvoColors.textPrimary,
    )
}

@Composable
private fun ProfileStatCard(icon: androidx.compose.ui.graphics.vector.ImageVector, iconColor: Color, value: String, label: String, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        color = RuvoColors.surface,
        border = BorderStroke(1.dp, RuvoColors.border),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(18.dp))
            Spacer(Modifier.height(6.dp))
            Text(value, style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
            Text(label, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, letterSpacing = 0.5.sp)
        }
    }
}

@Composable
private fun UserRunCard(run: UserRunItem) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = RuvoColors.surface,
        border = BorderStroke(1.dp, RuvoColors.border),
        modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp),
    ) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(40.dp).clip(CircleShape).background(RuvoColors.surfaceElev).border(1.dp, RuvoColors.border, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    when (run.activityType) {
                        "Walk" -> Icons.Default.DirectionsWalk
                        "Hike" -> Icons.Default.Terrain
                        else -> Icons.Default.DirectionsRun
                    },
                    contentDescription = null,
                    tint = RuvoColors.textTertiary,
                    modifier = Modifier.size(18.dp),
                )
            }
            Spacer(Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text("${run.activityType} Workout", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
                val minutes = run.durationSeconds / 60
                val secs = run.durationSeconds % 60
                Text(
                    "%d:%02d".format(minutes, secs),
                    style = MaterialTheme.typography.labelSmall,
                    color = RuvoColors.textTertiary,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(String.format("%.2f", run.distanceKm), style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.ExtraBold)
                Text("km", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
            }
        }
    }
}

@Composable
private fun StatCell(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleLarge, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
    }
}
