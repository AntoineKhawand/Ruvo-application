package com.ruvo.app.features.referral

import android.content.Context
import android.content.Intent
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
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
import com.ruvo.app.designsystem.components.RuvoButton
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class ReferralUiState(
    val referralCode: String = "",
    val coinsEarned: Int = 0,
    val referralCount: Int = 0,
    val redeemCode: String = "",
    val redeemStatus: RedeemStatus = RedeemStatus.Idle,
    val isLoading: Boolean = true,
)

sealed class RedeemStatus {
    object Idle : RedeemStatus()
    object Loading : RedeemStatus()
    data class Success(val coinsAwarded: Int) : RedeemStatus()
    data class Error(val message: String) : RedeemStatus()
}

@HiltViewModel
class ReferralViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ReferralUiState())
    val uiState: StateFlow<ReferralUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            try {
                val ref = firestore.collection("users").document(uid)
                val doc = ref.get().await()
                val data = doc.data ?: return@launch
                var code = data["referralCode"] as? String
                if (code.isNullOrBlank()) {
                    val name = (data["name"] as? String) ?: (data["displayName"] as? String) ?: "RUNNER"
                    code = generateReferralCode(name)
                    ref.update("referralCode", code).await()
                }
                val coins = (data["coins"] as? Number)?.toInt() ?: 0
                val count = (data["referralCount"] as? Number)?.toInt() ?: 0
                _uiState.update { it.copy(referralCode = code, coinsEarned = coins, referralCount = count, isLoading = false) }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }

    private fun generateReferralCode(name: String): String {
        val firstName = name.split(" ").first().uppercase().filter { it in 'A'..'Z' }.take(4).ifEmpty { "RUNR" }
        val suffix = (1000..9999).random()
        return "$firstName$suffix"
    }

    fun onRedeemCodeChange(code: String) {
        _uiState.update { it.copy(redeemCode = code, redeemStatus = RedeemStatus.Idle) }
    }

    fun redeemCode() {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            val code = _uiState.value.redeemCode.trim().uppercase()
            if (code.isBlank()) {
                _uiState.update { it.copy(redeemStatus = RedeemStatus.Error("Enter a referral code")) }
                return@launch
            }
            _uiState.update { it.copy(redeemStatus = RedeemStatus.Loading) }
            try {
                // Look up the referrer
                val snap = firestore.collection("users")
                    .whereEqualTo("referralCode", code)
                    .limit(1)
                    .get()
                    .await()

                if (snap.isEmpty) {
                    _uiState.update { it.copy(redeemStatus = RedeemStatus.Error("Code not found")) }
                    return@launch
                }

                val referrerDoc = snap.documents.first()
                if (referrerDoc.id == uid) {
                    _uiState.update { it.copy(redeemStatus = RedeemStatus.Error("You can't use your own code")) }
                    return@launch
                }

                val meDoc = firestore.collection("users").document(uid).get().await()
                if (meDoc.data?.get("usedReferral") == true) {
                    _uiState.update { it.copy(redeemStatus = RedeemStatus.Error("You've already used a referral code")) }
                    return@launch
                }

                // Award coins to both
                val coinsPerReferral = 100
                firestore.runBatch { batch ->
                    batch.update(referrerDoc.reference, mapOf(
                        "coins" to com.google.firebase.firestore.FieldValue.increment(coinsPerReferral.toLong()),
                        "referralCount" to com.google.firebase.firestore.FieldValue.increment(1L),
                    ))
                    batch.update(firestore.collection("users").document(uid), mapOf(
                        "coins" to com.google.firebase.firestore.FieldValue.increment(coinsPerReferral.toLong()),
                        "usedReferral" to true,
                    ))
                }.await()

                _uiState.update { it.copy(redeemStatus = RedeemStatus.Success(coinsPerReferral), redeemCode = "") }
                load()
            } catch (e: Exception) {
                _uiState.update { it.copy(redeemStatus = RedeemStatus.Error(e.message ?: "Error")) }
            }
        }
    }

    fun dismissRedeemStatus() {
        _uiState.update { it.copy(redeemStatus = RedeemStatus.Idle) }
    }
}

@Composable
fun ReferralScreen(
    onBack: () -> Unit = {},
    viewModel: ReferralViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    var codeCopied by remember { mutableStateOf(false) }

    LaunchedEffect(codeCopied) {
        if (codeCopied) {
            kotlinx.coroutines.delay(2000)
            codeCopied = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
            .verticalScroll(rememberScrollState()),
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary)
            }
            Text(
                "Refer & Earn",
                style = MaterialTheme.typography.headlineSmall,
                color = RuvoColors.textPrimary,
                fontWeight = FontWeight.Bold,
            )
        }

        // Hero card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .clip(RoundedCornerShape(24.dp))
                .background(RuvoColors.surface)
                .border(1.dp, RuvoColors.lime.copy(alpha = 0.3f), RoundedCornerShape(24.dp))
                .padding(28.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("🏆", fontSize = 52.sp)
                Text(
                    "Invite Runners,\nEarn 100 Coins",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.ExtraBold,
                    color = RuvoColors.textPrimary,
                    textAlign = TextAlign.Center,
                )
                Text(
                    "Share your code. Each friend who joins earns both of you 100 coins.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = RuvoColors.textSecondary,
                    textAlign = TextAlign.Center,
                )
            }
        }

        Spacer(Modifier.height(20.dp))

        // Stats row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatCard(
                label = "Friends Invited",
                value = "${uiState.referralCount}",
                icon = "👥",
                modifier = Modifier.weight(1f),
            )
            StatCard(
                label = "Coins Earned",
                value = "${uiState.coinsEarned}",
                icon = "🪙",
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(Modifier.height(24.dp))

        // Your code
        Column(modifier = Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Your Referral Code", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textSecondary)

            Surface(
                shape = RoundedCornerShape(16.dp),
                color = RuvoColors.surfaceElev,
                border = BorderStroke(2.dp, RuvoColors.lime),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        uiState.referralCode.ifEmpty { "Loading…" },
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.ExtraBold,
                        color = RuvoColors.lime,
                        letterSpacing = 4.sp,
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(
                        onClick = {
                            clipboard.setText(AnnotatedString(uiState.referralCode))
                            codeCopied = true
                        }
                    ) {
                        Icon(
                            if (codeCopied) Icons.Default.Check else Icons.Default.ContentCopy,
                            contentDescription = "Copy code",
                            tint = if (codeCopied) RuvoColors.lime else RuvoColors.textTertiary,
                        )
                    }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(
                    onClick = { shareReferralCode(context, uiState.referralCode) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, RuvoColors.border),
                ) {
                    Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Share", color = RuvoColors.textPrimary)
                }
                Button(
                    onClick = { shareReferralCode(context, uiState.referralCode) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black),
                ) {
                    Icon(Icons.Default.IosShare, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Invite", fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(Modifier.height(28.dp))

        HorizontalDivider(modifier = Modifier.padding(horizontal = 20.dp), color = RuvoColors.border)

        Spacer(Modifier.height(24.dp))

        // Redeem a code
        Column(modifier = Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Have a Friend's Code?", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textSecondary)

            OutlinedTextField(
                value = uiState.redeemCode,
                onValueChange = viewModel::onRedeemCodeChange,
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Enter code…", color = RuvoColors.textTertiary) },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = RuvoColors.lime,
                    unfocusedBorderColor = RuvoColors.border,
                    focusedContainerColor = RuvoColors.surfaceElev,
                    unfocusedContainerColor = RuvoColors.surfaceElev,
                    focusedTextColor = RuvoColors.textPrimary,
                    unfocusedTextColor = RuvoColors.textPrimary,
                ),
            )

            AnimatedVisibility(visible = uiState.redeemStatus is RedeemStatus.Error) {
                Text(
                    (uiState.redeemStatus as? RedeemStatus.Error)?.message ?: "",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }

            AnimatedVisibility(visible = uiState.redeemStatus is RedeemStatus.Success) {
                val coins = (uiState.redeemStatus as? RedeemStatus.Success)?.coinsAwarded ?: 0
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = RuvoColors.lime.copy(alpha = 0.12f),
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text("🪙", fontSize = 20.sp)
                        Text("+$coins coins added to your account!", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.lime, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            RuvoButton(
                text = if (uiState.redeemStatus is RedeemStatus.Loading) "Redeeming…" else "Redeem Code",
                onClick = viewModel::redeemCode,
                enabled = uiState.redeemStatus !is RedeemStatus.Loading,
            )
        }

        Spacer(Modifier.height(40.dp))
    }
}

@Composable
private fun StatCard(label: String, value: String, icon: String, modifier: Modifier = Modifier) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = RuvoColors.surface,
        border = BorderStroke(1.dp, RuvoColors.border),
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(icon, fontSize = 24.sp)
            Text(value, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, color = RuvoColors.lime)
            Text(label, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary, textAlign = TextAlign.Center)
        }
    }
}

private fun shareReferralCode(context: Context, code: String) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, "Join me on RUVO — the premium running app! Use my code $code to get 100 bonus coins. Download: https://ruvoapp.com")
    }
    context.startActivity(Intent.createChooser(intent, "Share with runners"))
}
