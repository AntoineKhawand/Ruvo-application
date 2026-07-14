package com.ruvo.app.features.community

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
    val isFollowing: Boolean = false,
    val isMe: Boolean = false,
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

    fun loadUser(userId: String) {
        viewModelScope.launch {
            val myUid = auth.currentUser?.uid ?: return@launch
            try {
                val meDoc = firestore.collection("users").document(myUid).get().await()
                @Suppress("UNCHECKED_CAST")
                val myFollowing = ((meDoc.data?.get("following") as? List<String>) ?: emptyList()).toSet()

                val targetDoc = firestore.collection("users").document(userId).get().await()
                val d = targetDoc.data ?: return@launch

                _data.value = UserProfileData(
                    uid = userId,
                    displayName = d["displayName"] as? String ?: d["name"] as? String ?: "Runner",
                    bio = d["bio"] as? String ?: "",
                    country = d["country"] as? String ?: "",
                    totalKm = (d["totalKm"] as? Number)?.toDouble() ?: 0.0,
                    totalRuns = (d["totalRuns"] as? Number)?.toInt() ?: 0,
                    followingCount = (d["followingCount"] as? Number)?.toInt() ?: 0,
                    followersCount = (d["followersCount"] as? Number)?.toInt() ?: 0,
                    level = (d["level"] as? Number)?.toInt() ?: 1,
                    currentXP = (d["currentXP"] as? Number)?.toInt() ?: 0,
                    xpToNext = (d["xpToNextLevel"] as? Number)?.toInt() ?: 1000,
                    weeklyDistanceKm = (d["weeklyDistance"] as? Number)?.toDouble() ?: 0.0,
                    isFollowing = userId in myFollowing,
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

            if (isFollowing) {
                myRef.update("following", com.google.firebase.firestore.FieldValue.arrayRemove(targetUid)).await()
            } else {
                myRef.update("following", com.google.firebase.firestore.FieldValue.arrayUnion(targetUid)).await()
            }
            _data.update { it.copy(isFollowing = !isFollowing, followersCount = if (isFollowing) it.followersCount - 1 else it.followersCount + 1) }
        }
    }
}

private fun levelTitle(level: Int) = when {
    level < 5  -> "Rookie"
    level < 10 -> "Endurance Athlete"
    level < 20 -> "Elite Runner"
    else       -> "Legend"
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

    LaunchedEffect(userId) { viewModel.loadUser(userId) }

    if (isLoading) {
        Box(modifier = Modifier.fillMaxSize().background(RuvoColors.background), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = RuvoColors.lime)
        }
        return
    }

    Column(
        modifier = Modifier.fillMaxSize().background(RuvoColors.background).verticalScroll(rememberScrollState()),
    ) {
        // Cover
        Box(modifier = Modifier.fillMaxWidth().height(200.dp)) {
            Box(
                modifier = Modifier.fillMaxWidth().height(140.dp)
                    .background(Brush.linearGradient(listOf(Color(0xFF0A1A00), Color(0xFF1A2F00), RuvoColors.limeDim)))
            )
            IconButton(onClick = onBack, modifier = Modifier.align(Alignment.TopStart).padding(8.dp)) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
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
                        onClick = { viewModel.toggleFollow() },
                        shape = RoundedCornerShape(20.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (data.isFollowing) RuvoColors.surface else RuvoColors.lime,
                            contentColor = if (data.isFollowing) RuvoColors.textPrimary else Color.Black,
                        ),
                        border = if (data.isFollowing) BorderStroke(1.dp, RuvoColors.lime) else null,
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    ) {
                        Text(if (data.isFollowing) "Following" else "Follow", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
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

        // Stats row
        Surface(color = RuvoColors.surface, modifier = Modifier.fillMaxWidth()) {
            Row(modifier = Modifier.padding(vertical = 16.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                StatCell(label = "Runs", value = "${data.totalRuns}")
                VerticalDivider(modifier = Modifier.height(40.dp), color = RuvoColors.border)
                StatCell(label = "Total km", value = String.format("%.0f", data.totalKm))
                VerticalDivider(modifier = Modifier.height(40.dp), color = RuvoColors.border)
                StatCell(label = "Following", value = "${data.followingCount}")
                VerticalDivider(modifier = Modifier.height(40.dp), color = RuvoColors.border)
                StatCell(label = "Followers", value = "${data.followersCount}")
            }
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

        Spacer(Modifier.height(80.dp))
    }
}

@Composable
private fun StatCell(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleLarge, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
    }
}
