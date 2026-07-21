package com.ruvo.app.features.rewards

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

// Mirrors exactly what the `redeemReward` Cloud Function writes to
// users/{uid}/redemptions (see functions/index.js) — rewardId, title,
// price, timestamp. No code/brand/status/expiresAt exist server-side;
// RN's own MyRedemptionsScreen.js reads those same missing fields and
// always falls back to an "UNKNOWN" status, so we don't fabricate them here.
data class RedemptionItem(
    val id: String,
    val title: String,
    val price: Int,
    val timestampMs: Long,
)

@HiltViewModel
class MyRedemptionsViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _items = MutableStateFlow<List<RedemptionItem>>(emptyList())
    val items: StateFlow<List<RedemptionItem>> = _items.asStateFlow()
    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init { observe() }

    private fun observe() {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            firestore.collection("users").document(uid).collection("redemptions")
                .orderBy("timestamp", Query.Direction.DESCENDING)
                .addSnapshotListener { snap, _ ->
                    _items.value = snap?.documents?.map { doc ->
                        val data = doc.data ?: emptyMap<String, Any>()
                        RedemptionItem(
                            id = doc.id,
                            title = data["title"] as? String ?: "Unknown Reward",
                            price = (data["price"] as? Number)?.toInt() ?: 0,
                            timestampMs = (data["timestamp"] as? com.google.firebase.Timestamp)?.toDate()?.time ?: 0L,
                        )
                    } ?: emptyList()
                    _isLoading.value = false
                }
        }
    }
}

@Composable
fun MyRedemptionsScreen(
    onBack: () -> Unit = {},
    viewModel: MyRedemptionsViewModel = hiltViewModel(),
) {
    val items by viewModel.items.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val dateFormat = remember { SimpleDateFormat("MMM d, yyyy 'at' h:mm a", Locale.getDefault()) }

    Column(modifier = Modifier.fillMaxSize().background(RuvoColors.background)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary) }
            Text("My Redemptions", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
        }

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = RuvoColors.lime) }
        } else if (items.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("🎁", fontSize = 48.sp)
                    Text("No redemptions yet", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textSecondary)
                    Text("Earn coins by running and redeem rewards!", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textTertiary)
                }
            }
        } else {
            LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(items, key = { it.id }) { item ->
                    Surface(shape = RoundedCornerShape(16.dp), color = RuvoColors.surface, border = BorderStroke(1.dp, RuvoColors.border), modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text(item.title, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                                Text("🪙 ${item.price}", style = MaterialTheme.typography.bodySmall, color = RuvoColors.lime, fontWeight = FontWeight.Bold)
                            }
                            if (item.timestampMs > 0) {
                                Text(dateFormat.format(Date(item.timestampMs)), style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                            }
                            Text("Sent to your email — check your inbox for the code.", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                        }
                    }
                }
                item { Spacer(Modifier.height(80.dp)) }
            }
        }
    }
}
