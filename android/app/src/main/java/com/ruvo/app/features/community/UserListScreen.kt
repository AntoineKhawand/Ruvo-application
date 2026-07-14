package com.ruvo.app.features.community

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
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

data class UserListEntry(
    val uid: String,
    val name: String,
    val totalKm: Double,
    val isFollowing: Boolean,
)

@HiltViewModel
class UserListViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _users = MutableStateFlow<List<UserListEntry>>(emptyList())
    val users: StateFlow<List<UserListEntry>> = _users.asStateFlow()
    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    private var myFollowing = setOf<String>()

    fun load(userIds: List<String>) {
        if (userIds.isEmpty()) { _isLoading.value = false; return }
        viewModelScope.launch {
            val myUid = auth.currentUser?.uid ?: return@launch
            try {
                val meDoc = firestore.collection("users").document(myUid).get().await()
                @Suppress("UNCHECKED_CAST")
                myFollowing = ((meDoc.data?.get("following") as? List<String>) ?: emptyList()).toSet()

                val chunks = userIds.chunked(10)
                val results = chunks.flatMap { chunk ->
                    val snap = firestore.collection("users")
                        .whereIn(com.google.firebase.firestore.FieldPath.documentId(), chunk)
                        .get().await()
                    snap.documents.mapNotNull { doc ->
                        val d = doc.data ?: return@mapNotNull null
                        UserListEntry(
                            uid = doc.id,
                            name = d["displayName"] as? String ?: d["name"] as? String ?: "Runner",
                            totalKm = (d["totalKm"] as? Number)?.toDouble() ?: 0.0,
                            isFollowing = doc.id in myFollowing,
                        )
                    }
                }
                _users.value = results
            } catch (_: Exception) {
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun toggleFollow(targetUid: String) {
        viewModelScope.launch {
            val myUid = auth.currentUser?.uid ?: return@launch
            val isFollowing = targetUid in myFollowing
            val ref = firestore.collection("users").document(myUid)
            if (isFollowing) {
                ref.update("following", com.google.firebase.firestore.FieldValue.arrayRemove(targetUid)).await()
                myFollowing = myFollowing - targetUid
            } else {
                ref.update("following", com.google.firebase.firestore.FieldValue.arrayUnion(targetUid)).await()
                myFollowing = myFollowing + targetUid
            }
            _users.update { list -> list.map { if (it.uid == targetUid) it.copy(isFollowing = !isFollowing) else it } }
        }
    }
}

@Composable
fun UserListScreen(
    title: String,
    userIds: List<String>,
    onBack: () -> Unit = {},
    onUserProfile: (String) -> Unit = {},
    viewModel: UserListViewModel = hiltViewModel(),
) {
    val users by viewModel.users.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()

    LaunchedEffect(userIds) { viewModel.load(userIds) }

    Column(modifier = Modifier.fillMaxSize().background(RuvoColors.background)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary) }
            Text(title, style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            Text("${userIds.size}", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textTertiary)
        }

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = RuvoColors.lime) }
        } else if (users.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(Icons.Default.People, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(52.dp))
                    Text("No users yet", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(users, key = { it.uid }) { user ->
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = RuvoColors.surface,
                        border = BorderStroke(1.dp, RuvoColors.border),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Box(
                                modifier = Modifier.size(46.dp).clip(CircleShape).background(RuvoColors.surfaceElev).border(1.5.dp, RuvoColors.border, CircleShape).clickable { onUserProfile(user.uid) },
                                contentAlignment = Alignment.Center,
                            ) { Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(22.dp)) }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(user.name, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
                                Text("${String.format("%.0f", user.totalKm)} km", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                            }
                            val myUid = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid
                            if (user.uid != myUid) {
                                if (user.isFollowing) {
                                    OutlinedButton(onClick = { viewModel.toggleFollow(user.uid) }, shape = RoundedCornerShape(20.dp), border = BorderStroke(1.dp, RuvoColors.lime), contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)) { Text("Following", style = MaterialTheme.typography.labelSmall, color = RuvoColors.lime) }
                                } else {
                                    Button(onClick = { viewModel.toggleFollow(user.uid) }, shape = RoundedCornerShape(20.dp), colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black), contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)) { Text("Follow", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold) }
                                }
                            }
                        }
                    }
                }
                item { Spacer(Modifier.height(80.dp)) }
            }
        }
    }
}
