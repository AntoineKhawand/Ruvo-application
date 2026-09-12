package com.ruvo.app.features.rewards

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import com.google.firebase.functions.FirebaseFunctions
import com.ruvo.app.SecurityManager
import com.ruvo.app.designsystem.theme.RuvoColors
import com.ruvo.app.designsystem.theme.RuvoRadius
import com.ruvo.app.designsystem.theme.RuvoSpacing
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
    val logoTint: Color,
    val emoji: String,
)

data class RewardsUiState(
    val coins: Int = 0,
    val selectedCategory: String = "All",
    val selectedReward: Reward? = null,
    val isRedeeming: Boolean = false,
    val redeemSuccessTitle: String? = null,
    val redeemError: String? = null,
    val isLoading: Boolean = true,
)

private val REWARD_CATALOG = listOf(
    Reward("1", "20% Off Sportswear", "Nike Lebanon", "Gear", 2500, "Get 20% off your total purchase at any Nike branch in Lebanon. Valid on all sportswear.", "Expires in 30 days • One use per customer", Color(0xFF1A1A1A), Color(0xFF111111), Color.White, "NIKE"),
    Reward("2", "25% Off Sportswear", "Adidas Lebanon", "Gear", 3000, "Enjoy 25% off sportswear at any Adidas branch in Lebanon. Perfect to gear up for your next run.", "Valid in-store only • Cannot be combined with sales", Color(0xFFF5F5F5), Color(0xFFE8E8E8), Color.Black, "ADI"),
    Reward("3", "15% Off Equipment", "Decathlon Lebanon", "Gear", 1500, "Save 15% on all running equipment at Decathlon.", "Valid on running gear only • One use per account", Color(0xFF003087), Color(0xFF0056B3), Color.White, "DEC"),
    Reward("4", "Free Recovery Session", "FitRecovery", "Wellness", 2000, "Enjoy a complimentary 45-min recovery session (compression therapy or ice bath).", "Book online • Requires valid RUVO PRO membership", Color(0xFF1A1A2E), Color(0xFF0F3460), Color.White, "FIT"),
    Reward("5", "10% Off Supplements", "Nutrisport Lebanon", "Nutrition", 1000, "10% off all sports nutrition products including protein, electrolytes, and energy gels.", "Valid online and in-store • Excludes sale items", Color(0xFF0A2A0A), Color(0xFF143314), Color.White, "NUT"),
    Reward("6", "Free Premium Month", "RUVO PRO", "Subscription", 5000, "Unlock one month of RUVO PRO — AI coaching, advanced analytics, and no ads.", "Applied instantly to your account", Color(0xFF050505), Color(0xFF1A1A0A), RuvoColors.lime, "PRO"),
    Reward("7", "Coffee Voucher", "Starbucks Lebanon", "Food", 800, "A free grande-size drink at any Starbucks Lebanon — you've earned it!", "Valid 7 days from redemption • Dine-in/Takeaway", Color(0xFF00704A), Color(0xFF004B32), Color.White, "SBX"),
    Reward("8", "15% Off Race Entry", "Beirut Marathon", "Events", 3500, "Save 15% on your next Beirut Marathon or half marathon registration.", "Valid for one registration • Non-transferable", Color(0xFF8B0000), Color(0xFF4A0000), Color.White, "BMA"),
)

private val CATEGORIES = listOf("All", "Gear", "Wellness", "Nutrition", "Subscription", "Food", "Events")

// ─── ViewModel ───────────────────────────────────────────────────────────────

@HiltViewModel
class RewardsViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions,
    private val securityManager: SecurityManager,
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
    fun dismissResult() = _uiState.update { it.copy(redeemSuccessTitle = null, redeemError = null) }

    fun redeem(reward: Reward) {
        viewModelScope.launch {
            if (securityManager.isRooted) {
                _uiState.update { it.copy(redeemError = "The rewards wallet is disabled on jailbroken or rooted devices to protect the integrity of the rewards system.") }
                return@launch
            }
            if (_uiState.value.coins < reward.price) {
                _uiState.update { it.copy(redeemError = "Not enough coins. Need ${reward.price - it.coins} more.") }
                return@launch
            }
            _uiState.update { it.copy(isRedeeming = true) }
            try {
                // Redemption is performed server-side (coin deduction + redemption
                // record) in a Firestore transaction — the client never writes
                // coins/redemptions directly, so it can't manipulate its own balance.
                val result = functions.getHttpsCallable("redeemReward").call(
                    mapOf("rewardId" to reward.id, "price" to reward.price, "title" to reward.title)
                ).await()
                @Suppress("UNCHECKED_CAST")
                val data = result.data as? Map<String, Any>
                if (data?.get("success") == true) {
                    val newBalance = (data["newCoinBalance"] as? Number)?.toInt()
                    _uiState.update {
                        it.copy(
                            coins = newBalance ?: it.coins,
                            redeemSuccessTitle = reward.title,
                            selectedReward = null,
                        )
                    }
                } else {
                    _uiState.update { it.copy(redeemError = "An error occurred while processing your reward.") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(redeemError = e.message ?: "Redemption failed") }
            } finally {
                _uiState.update { it.copy(isRedeeming = false) }
            }
        }
    }
}

// ─── Screen ──────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
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
            modifier = Modifier.fillMaxWidth().padding(horizontal = RuvoSpacing.md, vertical = RuvoSpacing.cardGap),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary)
            }
            Text("Rewards", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Surface(
                onClick = onMyRedemptions,
                shape = RoundedCornerShape(RuvoRadius.pill),
                color = RuvoColors.lime.copy(alpha = 0.1f),
                border = BorderStroke(1.dp, RuvoColors.lime.copy(alpha = 0.25f)),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = RuvoSpacing.cardGap, vertical = RuvoSpacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.xs),
                ) {
                    Icon(Icons.Default.Receipt, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(15.dp))
                    Text("My Rewards", style = MaterialTheme.typography.labelSmall, color = RuvoColors.lime, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        // ── Wallet card (lime gradient) ──
        Column(
            modifier = Modifier
                .padding(horizontal = RuvoSpacing.md)
                .fillMaxWidth()
                .clip(RoundedCornerShape(RuvoRadius.md))
                .background(Brush.linearGradient(listOf(RuvoColors.lime, Color(0xFFAACC00))))
                .padding(RuvoSpacing.md),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("AVAILABLE BALANCE", style = MaterialTheme.typography.labelSmall, color = Color.Black.copy(alpha = 0.6f), letterSpacing = 1.sp, fontWeight = FontWeight.Bold)
                    Text("${uiState.coins}", style = MaterialTheme.typography.displaySmall, color = Color.Black, fontWeight = FontWeight.ExtraBold)
                }
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.3f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.AccountBalanceWallet, contentDescription = null, tint = Color.Black, modifier = Modifier.size(24.dp))
                }
            }
            Spacer(Modifier.height(RuvoSpacing.cardGap))
            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color.Black.copy(alpha = 0.1f)))
            Spacer(Modifier.height(RuvoSpacing.sm))
            Text("Keep running to earn more.", style = MaterialTheme.typography.bodySmall, color = Color.Black, fontWeight = FontWeight.Medium)
        }

        Spacer(Modifier.height(RuvoSpacing.md))

        // Category chips
        LazyRow(
            contentPadding = PaddingValues(horizontal = RuvoSpacing.md),
            horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.sm),
        ) {
            items(CATEGORIES) { cat ->
                val selected = cat == uiState.selectedCategory
                Surface(
                    onClick = { viewModel.selectCategory(cat) },
                    shape = RoundedCornerShape(RuvoRadius.pill),
                    color = if (selected) RuvoColors.lime else RuvoColors.surface,
                    border = if (selected) null else BorderStroke(1.dp, RuvoColors.border),
                ) {
                    Text(
                        cat,
                        modifier = Modifier.padding(horizontal = RuvoSpacing.cardGap, vertical = RuvoSpacing.sm),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                        color = if (selected) Color.Black else RuvoColors.textSecondary,
                    )
                }
            }
        }

        Spacer(Modifier.height(RuvoSpacing.md))

        // Rewards grid — 2 columns, gradient brand cards
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            contentPadding = PaddingValues(horizontal = RuvoSpacing.md, vertical = RuvoSpacing.xs),
            horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.cardGap),
            verticalArrangement = Arrangement.spacedBy(RuvoSpacing.cardGap),
            modifier = Modifier.weight(1f),
        ) {
            items(filtered, key = { it.id }) { reward ->
                RewardGridCard(reward = reward, userCoins = uiState.coins, onClick = { viewModel.selectReward(reward) })
            }
            item(span = { GridItemSpan(2) }) { Spacer(Modifier.height(80.dp)) }
        }
    }

    // Reward detail bottom sheet
    uiState.selectedReward?.let { reward ->
        RewardDetailSheet(
            reward = reward,
            userCoins = uiState.coins,
            isRedeeming = uiState.isRedeeming,
            onDismiss = { viewModel.selectReward(null) },
            onRedeem = { viewModel.redeem(reward) },
        )
    }

    // Success dialog
    uiState.redeemSuccessTitle?.let { title ->
        AlertDialog(
            onDismissRequest = viewModel::dismissResult,
            icon = { Text("🎉", fontSize = 36.sp) },
            title = { Text("Reward Redeemed!", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Your code for $title has been sent to your email. Open it to find your QR code and instructions.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = RuvoColors.textSecondary,
                    textAlign = TextAlign.Center,
                )
            },
            confirmButton = { Button(onClick = { viewModel.dismissResult(); onMyRedemptions() }, colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black)) { Text("View Redemptions", fontWeight = FontWeight.Bold) } },
            dismissButton = { TextButton(onClick = viewModel::dismissResult) { Text("Done", color = RuvoColors.textSecondary) } },
            containerColor = RuvoColors.glassSurface,
        )
    }

    // Error dialog
    uiState.redeemError?.let { err ->
        AlertDialog(
            onDismissRequest = viewModel::dismissResult,
            title = { Text("Oops", fontWeight = FontWeight.Bold) },
            text = { Text(err, color = RuvoColors.textSecondary) },
            confirmButton = { TextButton(onClick = viewModel::dismissResult) { Text("OK", color = RuvoColors.lime) } },
            containerColor = RuvoColors.glassSurface,
        )
    }
}

@Composable
private fun RewardGridCard(reward: Reward, userCoins: Int, onClick: () -> Unit) {
    val canAfford = userCoins >= reward.price
    val progress = if (userCoins > 0) (userCoins.toFloat() / reward.price.toFloat()).coerceIn(0f, 1f) else 0f

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(RuvoRadius.md))
            .background(RuvoColors.surface)
            .border(1.dp, RuvoColors.border, RoundedCornerShape(RuvoRadius.md))
            .clickable(onClick = onClick),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(90.dp)
                .background(Brush.linearGradient(listOf(reward.gradientStart, reward.gradientEnd))),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                reward.emoji,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.ExtraBold,
                color = reward.logoTint.copy(alpha = 0.22f),
                letterSpacing = 2.sp,
            )
            Surface(
                // Deliberately tighter than the shared radius scale: at this badge's
                // ~14dp height, sm(8dp) would clip to a full pill instead of the
                // subtly-rounded rect this is meant to be, so it's left un-tokenized.
                shape = RoundedCornerShape(4.dp),
                color = Color.Black.copy(alpha = 0.7f),
                modifier = Modifier.align(Alignment.TopEnd).padding(RuvoSpacing.sm),
            ) {
                Text(
                    reward.category.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    // Same reasoning as the shape above -- kept as this badge's own
                    // tight, deliberately-compact padding rather than the shared scale.
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                )
            }
        }
        Column(modifier = Modifier.padding(RuvoSpacing.cardGap)) {
            Text(reward.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = RuvoColors.textPrimary, maxLines = 1)
            Spacer(Modifier.height(2.dp))
            Text(reward.brand, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary, maxLines = 1)
            Spacer(Modifier.height(RuvoSpacing.sm))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.xs)) {
                    Icon(Icons.Default.MonetizationOn, contentDescription = null, tint = if (canAfford) RuvoColors.lime else RuvoColors.textTertiary, modifier = Modifier.size(14.dp))
                    Text("${reward.price}", style = MaterialTheme.typography.labelMedium, color = if (canAfford) RuvoColors.lime else RuvoColors.textTertiary, fontWeight = FontWeight.Bold)
                }
                if (!canAfford) {
                    Text("${(progress * 100).toInt()}%", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                }
            }
            if (!canAfford) {
                Spacer(Modifier.height(RuvoSpacing.sm))
                Box(modifier = Modifier.fillMaxWidth().height(3.dp).clip(RoundedCornerShape(RuvoRadius.pill)).background(RuvoColors.border)) {
                    Box(modifier = Modifier.fillMaxWidth(progress).fillMaxHeight().clip(RoundedCornerShape(RuvoRadius.pill)).background(RuvoColors.lime))
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RewardDetailSheet(reward: Reward, userCoins: Int, isRedeeming: Boolean, onDismiss: () -> Unit, onRedeem: () -> Unit) {
    val canAfford = userCoins >= reward.price
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = RuvoColors.background) {
        Column(modifier = Modifier.fillMaxWidth().padding(bottom = RuvoSpacing.lg)) {
            Box(
                modifier = Modifier
                    .padding(horizontal = RuvoSpacing.md)
                    .fillMaxWidth()
                    .height(180.dp)
                    .clip(RoundedCornerShape(RuvoRadius.md))
                    .background(Brush.linearGradient(listOf(reward.gradientStart, reward.gradientEnd))),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    reward.emoji,
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.ExtraBold,
                    color = reward.logoTint.copy(alpha = 0.22f),
                    letterSpacing = 3.sp,
                )
            }

            Column(modifier = Modifier.padding(horizontal = RuvoSpacing.lg).padding(top = RuvoSpacing.md)) {
                Text(reward.category.uppercase(), style = MaterialTheme.typography.labelMedium, color = RuvoColors.lime, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                Spacer(Modifier.height(RuvoSpacing.xs))
                Text(reward.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = RuvoColors.textPrimary)
                Spacer(Modifier.height(RuvoSpacing.md))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.xs)) {
                        Icon(Icons.Default.MonetizationOn, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(18.dp))
                        Text("${reward.price} coins", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
                    }
                    Text("Balance: $userCoins", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                }

                Spacer(Modifier.height(RuvoSpacing.md))
                HorizontalDivider(color = RuvoColors.border)
                Spacer(Modifier.height(RuvoSpacing.md))

                Text("Description", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = RuvoColors.textPrimary)
                Spacer(Modifier.height(RuvoSpacing.xs))
                Text(reward.description, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary, lineHeight = 21.sp)

                Spacer(Modifier.height(RuvoSpacing.md))
                Text("Terms & Conditions", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = RuvoColors.textPrimary)
                Spacer(Modifier.height(RuvoSpacing.xs))
                Text(reward.terms, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary, lineHeight = 21.sp)

                if (!canAfford) {
                    Spacer(Modifier.height(RuvoSpacing.cardGap))
                    Text("You need ${reward.price - userCoins} more coins.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                }

                Spacer(Modifier.height(RuvoSpacing.lg))
                Button(
                    onClick = onRedeem,
                    enabled = canAfford && !isRedeeming,
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(RuvoRadius.pill),
                    colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black, disabledContainerColor = RuvoColors.surfaceElev, disabledContentColor = RuvoColors.textTertiary),
                ) {
                    if (isRedeeming) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.Black, strokeWidth = 2.dp)
                    } else {
                        Text(if (canAfford) "Confirm Redemption" else "Insufficient Coins", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                }
            }
        }
    }
}
