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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
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

data class RedemptionItem(
    val id: String,
    val title: String,
    val brand: String,
    val code: String?,
    val coinsSpent: Int,
    val status: String,
    val timestampMs: Long,
    val expiresAtMs: Long?,
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
                            title = data["title"] as? String ?: "",
                            brand = data["brand"] as? String ?: "",
                            code = data["code"] as? String,
                            coinsSpent = (data["coinsSpent"] as? Number)?.toInt() ?: 0,
                            status = data["status"] as? String ?: "active",
                            timestampMs = (data["timestamp"] as? com.google.firebase.Timestamp)?.toDate()?.time ?: 0L,
                            expiresAtMs = (data["expiresAt"] as? com.google.firebase.Timestamp)?.toDate()?.time,
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
    val clipboard = LocalClipboardManager.current
    var copiedId by remember { mutableStateOf<String?>(null) }

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
                    val statusColor = when (item.status) {
                        "active" -> RuvoColors.lime
                        "used" -> Color(0xFF22C55E)
                        "expired" -> Color(0xFFEF4444)
                        else -> RuvoColors.textTertiary
                    }
                    Surface(shape = RoundedCornerShape(16.dp), color = RuvoColors.surface, border = BorderStroke(1.dp, RuvoColors.border), modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Column {
                                    Text(item.title, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
                                    Text(item.brand, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                                }
                                Surface(shape = RoundedCornerShape(8.dp), color = statusColor.copy(alpha = 0.15f)) {
                                    Text(item.status.replaceFirstChar { it.uppercase() }, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp), style = MaterialTheme.typography.labelSmall, color = statusColor, fontWeight = FontWeight.Bold)
                                }
                            }

                            item.code?.let { code ->
                                Surface(shape = RoundedCornerShape(10.dp), color = RuvoColors.surfaceElev, modifier = Modifier.fillMaxWidth()) {
                                    Row(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Text(code, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = RuvoColors.lime, letterSpacing = 2.sp, modifier = Modifier.weight(1f))
                                        IconButton(onClick = {
                                            clipboard.setText(AnnotatedString(code))
                                            copiedId = item.id
                                        }) {
                                            Icon(
                                                if (copiedId == item.id) Icons.Default.Check else Icons.Default.ContentCopy,
                                                contentDescription = "Copy",
                                                tint = if (copiedId == item.id) RuvoColors.lime else RuvoColors.textTertiary,
                                            )
                                        }
                                    }
                                }
                            }

                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("🪙 ${item.coinsSpent} coins", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                                item.expiresAtMs?.let { exp ->
                                    val daysLeft = ((exp - System.currentTimeMillis()) / 86400000).toInt()
                                    Text(
                                        if (daysLeft > 0) "Expires in $daysLeft days" else "Expired",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = if (daysLeft in 1..5) Color(0xFFF97316) else RuvoColors.textTertiary,
                                    )
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
