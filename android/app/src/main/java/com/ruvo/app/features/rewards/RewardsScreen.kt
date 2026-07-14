package com.ruvo.app.features.rewards

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
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

// ─── Data ────────────────────────────────────────────────────────────────────

data class Reward(
    val id: String,
    val title: String,
    val brand: String,
    val category: String,
    val price: Int,
    val description: String,
    val terms: String,
    val gradientStart: Color,
    val gradientEnd: Color,
    val emoji: String,
)

data class RewardsUiState(
    val coins: Int = 0,
    val selectedCategory: String = "All",
    val selectedReward: Reward? = null,
    val isRedeeming: Boolean = false,
    val redeemSuccess: String? = null,
    val redeemError: String? = null,
    val isLoading: Boolean = true,
)

private val REWARD_CATALOG = listOf(
    Reward("1", "20% Off Sportswear", "Nike Lebanon", "Gear", 2500, "Get 20% off your total purchase at any Nike branch in Lebanon. Valid on all sportswear.", "Expires in 30 days • One use per customer", Color(0xFF1A1A1A), Color(0xFF111111), "👟"),
    Reward("2", "25% Off Sportswear", "Adidas Lebanon", "Gear", 3000, "Enjoy 25% off sportswear at any Adidas branch in Lebanon. Perfect to gear up for your next run.", "Valid in-store only • Cannot be combined with sales", Color(0xFFF5F5F5), Color(0xFFE8E8E8), "🏃"),
    Reward("3", "15% Off Equipment", "Decathlon Lebanon", "Gear", 1500, "Save 15% on all running equipment at Decathlon.", "Valid on running gear only • One use per account", Color(0xFF003087), Color(0xFF0056B3), "🎽"),
    Reward("4", "Free Recovery Session", "FitRecovery", "Wellness", 2000, "Enjoy a complimentary 45-min recovery session (compression therapy or ice bath).", "Book online • Requires valid RUVO PRO membership", Color(0xFF1A1A2E), Color(0xFF0F3460), "🧊"),
    Reward("5", "10% Off Supplements", "Nutrisport Lebanon", "Nutrition", 1000, "10% off all sports nutrition products including protein, electrolytes, and energy gels.", "Valid online and in-store • Excludes sale items", Color(0xFF0A2A0A), Color(0xFF143314), "💊"),
    Reward("6", "Free Premium Month", "RUVO PRO", "Subscription", 5000, "Unlock one month of RUVO PRO — AI coaching, advanced analytics, and no ads.", "Applied instantly to your account", Color(0xFF050505), Color(0xFF1A1A0A), "⭐"),
    Reward("7", "Coffee Voucher", "Starbucks Lebanon", "Food", 800, "A free grande-size drink at any Starbucks Lebanon — you've earned it!", "Valid 7 days from redemption • Dine-in/Takeaway", Color(0xFF00704A), Color(0xFF004B32), "☕"),
    Reward("8", "15% Off Race Entry", "Beirut Marathon", "Events", 3500, "Save 15% on your next Beirut Marathon or half marathon registration.", "Valid for one registration • Non-transferable", Color(0xFF8B0000), Color(0xFF4A0000), "🏅"),
)

private val CATEGORIES = listOf("All", "Gear", "Wellness", "Nutrition", "Subscription", "Food", "Events")

// ─── ViewModel ───────────────────────────────────────────────────────────────

@HiltViewModel
class RewardsViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _uiState = MutableStateFlow(RewardsUiState())
    val uiState: StateFlow<RewardsUiState> = _uiState.asStateFlow()

    init { loadCoins() }

    private fun loadCoins() {
        val uid = auth.currentUser?.uid ?: return
        firestore.collection("users").document(uid).addSnapshotListener { snap, _ ->
            val coins = (snap?.getLong("coins") ?: 0L).toInt()
            _uiState.update { it.copy(coins = coins, isLoading = false) }
        }
    }

    fun selectCategory(cat: String) = _uiState.update { it.copy(selectedCategory = cat) }
    fun selectReward(r: Reward?) = _uiState.update { it.copy(selectedReward = r) }
    fun dismissResult() = _uiState.update { it.copy(redeemSuccess = null, redeemError = null) }

    fun redeem(reward: Reward) {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            if (_uiState.value.coins < reward.price) {
                _uiState.update { it.copy(redeemError = "Not enough coins. Need ${reward.price - it.coins} more.") }
                return@launch
            }
            _uiState.update { it.copy(isRedeeming = true) }
            try {
                val code = "RUVO-${System.currentTimeMillis().toString(36).uppercase()}"
                val expiry = System.currentTimeMillis() + 30L * 24 * 60 * 60 * 1000

                firestore.runBatch { batch ->
                    val userRef = firestore.collection("users").document(uid)
                    batch.update(userRef, "coins", com.google.firebase.firestore.FieldValue.increment(-reward.price.toLong()))
                    val redemptionRef = userRef.collection("redemptions").document()
                    batch.set(redemptionRef, mapOf(
                        "rewardId" to reward.id,
                        "title" to reward.title,
                        "brand" to reward.brand,
                        "code" to code,
                        "coinsSpent" to reward.price,
                        "status" to "active",
                        "timestamp" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                        "expiresAt" to java.util.Date(expiry),
                    ))
                }.await()
                _uiState.update { it.copy(redeemSuccess = code, selectedReward = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(redeemError = e.message ?: "Redemption failed") }
            } finally {
                _uiState.update { it.copy(isRedeeming = false) }
            }
        }
    }
}

// ─── Screen ──────────────────────────────────────────────────────────────────

@Composable
fun RewardsScreen(
    onBack: () -> Unit = {},
    onMyRedemptions: () -> Unit = {},
    viewModel: RewardsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    val filtered = REWARD_CATALOG.filter { r ->
        uiState.selectedCategory == "All" || r.category == uiState.selectedCategory
    }

    Column(modifier = Modifier.fillMaxSize().background(RuvoColors.background)) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary)
            }
            Text("Rewards", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            IconButton(onClick = onMyRedemptions) {
                Icon(Icons.Default.Receipt, contentDescription = "My Redemptions", tint = RuvoColors.lime)
            }
        }

        // Coin balance
        Surface(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            shape = RoundedCornerShape(20.dp),
            color = RuvoColors.surface,
            border = BorderStroke(1.dp, RuvoColors.lime.copy(alpha = 0.3f)),
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("🪙", fontSize = 32.sp)
                Column(modifier = Modifier.weight(1f)) {
                    Text("Your Balance", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                    Text("${uiState.coins} coins", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, color = RuvoColors.lime)
                }
                Text("Earn more by running!", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary, textAlign = TextAlign.End, modifier = Modifier.width(80.dp))
            }
        }

        Spacer(Modifier.height(16.dp))

        // Category chips
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(CATEGORIES) { cat ->
                val selected = cat == uiState.selectedCategory
                Surface(
                    onClick = { viewModel.selectCategory(cat) },
                    shape = RoundedCornerShape(20.dp),
                    color = if (selected) RuvoColors.lime else RuvoColors.surface,
                    border = if (selected) null else BorderStroke(1.dp, RuvoColors.border),
                ) {
                    Text(
                        cat,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                        color = if (selected) Color.Black else RuvoColors.textSecondary,
                    )
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // Rewards grid
        LazyColumn(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(filtered, key = { it.id }) { reward ->
                RewardCard(reward = reward, userCoins = uiState.coins, onClick = { viewModel.selectReward(reward) })
            }
            item { Spacer(Modifier.height(80.dp)) }
        }
    }

    // Reward detail dialog
    uiState.selectedReward?.let { reward ->
        RewardDialog(
            reward = reward,
            userCoins = uiState.coins,
            isRedeeming = uiState.isRedeeming,
            onDismiss = { viewModel.selectReward(null) },
            onRedeem = { viewModel.redeem(reward) },
        )
    }

    // Success dialog
    uiState.redeemSuccess?.let { code ->
        AlertDialog(
            onDismissRequest = viewModel::dismissResult,
            icon = { Text("🎉", fontSize = 36.sp) },
            title = { Text("Reward Redeemed!", fontWeight = FontWeight.Bold) },
            text = {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Your discount code:", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
                    Surface(shape = RoundedCornerShape(12.dp), color = RuvoColors.surfaceElev) {
                        Text(code, modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, color = RuvoColors.lime, letterSpacing = 2.sp)
                    }
                    Text("Check My Redemptions to view it anytime.", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary, textAlign = TextAlign.Center)
                }
            },
            confirmButton = { Button(onClick = { viewModel.dismissResult(); onMyRedemptions() }, colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black)) { Text("View Redemptions", fontWeight = FontWeight.Bold) } },
            dismissButton = { TextButton(onClick = viewModel::dismissResult) { Text("Done", color = RuvoColors.textSecondary) } },
            containerColor = RuvoColors.surface,
        )
    }

    // Error snackbar
    uiState.redeemError?.let { err ->
        AlertDialog(
            onDismissRequest = viewModel::dismissResult,
            title = { Text("Oops", fontWeight = FontWeight.Bold) },
            text = { Text(err, color = RuvoColors.textSecondary) },
            confirmButton = { TextButton(onClick = viewModel::dismissResult) { Text("OK", color = RuvoColors.lime) } },
            containerColor = RuvoColors.surface,
        )
    }
}

@Composable
private fun RewardCard(reward: Reward, userCoins: Int, onClick: () -> Unit) {
    val canAfford = userCoins >= reward.price
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(20.dp),
        color = RuvoColors.surface,
        border = BorderStroke(1.dp, if (canAfford) RuvoColors.border else RuvoColors.border.copy(alpha = 0.4f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Box(
                modifier = Modifier.size(56.dp).clip(RoundedCornerShape(14.dp)).background(RuvoColors.surfaceElev),
                contentAlignment = Alignment.Center,
            ) {
                Text(reward.emoji, fontSize = 26.sp)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(reward.title, style = MaterialTheme.typography.titleSmall, color = if (canAfford) RuvoColors.textPrimary else RuvoColors.textTertiary, fontWeight = FontWeight.SemiBold)
                Text(reward.brand, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("🪙", fontSize = 12.sp)
                    Text("${reward.price} coins", style = MaterialTheme.typography.labelMedium, color = if (canAfford) RuvoColors.lime else RuvoColors.textTertiary, fontWeight = FontWeight.Bold)
                }
            }
            if (!canAfford) {
                Text("${reward.price - userCoins}\nmore", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, textAlign = TextAlign.Center, lineHeight = 14.sp)
            } else {
                Icon(Icons.Default.ChevronRight, contentDescription = null, tint = RuvoColors.textTertiary)
            }
        }
    }
}

@Composable
private fun RewardDialog(reward: Reward, userCoins: Int, isRedeeming: Boolean, onDismiss: () -> Unit, onRedeem: () -> Unit) {
    val canAfford = userCoins >= reward.price
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = RuvoColors.surface,
        title = {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Text(reward.emoji, fontSize = 40.sp)
                Spacer(Modifier.height(8.dp))
                Text(reward.title, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center, color = RuvoColors.textPrimary)
                Text(reward.brand, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(reward.description, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary)
                Text(reward.terms, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                HorizontalDivider(color = RuvoColors.border)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("🪙", fontSize = 16.sp)
                        Text("${reward.price} coins", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = if (canAfford) RuvoColors.lime else MaterialTheme.colorScheme.error)
                    }
                    Text("Balance: ${userCoins}", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                }
                if (!canAfford) {
                    Text("You need ${reward.price - userCoins} more coins.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onRedeem,
                enabled = canAfford && !isRedeeming,
                colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black),
            ) {
                if (isRedeeming) CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.Black, strokeWidth = 2.dp)
                else Text("Redeem", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = RuvoColors.textSecondary) } },
    )
}
