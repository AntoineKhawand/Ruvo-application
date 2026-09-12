package com.ruvo.app.features.referral

import android.content.Context
import android.content.Intent
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
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
import com.ruvo.app.designsystem.theme.RuvoRadius
import com.ruvo.app.designsystem.theme.RuvoSpacing
import dagger.hilt.android.lifecycle.HiltViewModel
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

private data class ReferralStep(val icon: androidx.compose.ui.graphics.vector.ImageVector, val title: String, val desc: String)

private val REFERRAL_STEPS = listOf(
    ReferralStep(Icons.Default.Share, "Share your code", "Send your unique code to friends via any app"),
    ReferralStep(Icons.Default.PersonAdd, "Friend joins RUVO", "They sign up and enter your referral code"),
    ReferralStep(Icons.Default.Bolt, "Both earn 100 coins", "Reward lands instantly in both accounts"),
)

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
                @Suppress("UNCHECKED_CAST")
                val referralStats = data["referralStats"] as? Map<String, Any>
                val coinsEarned = (referralStats?.get("coinsEarned") as? Number)?.toInt() ?: 0
                val totalInvites = (referralStats?.get("totalInvites") as? Number)?.toInt() ?: 0
                _uiState.update { it.copy(referralCode = code, coinsEarned = coinsEarned, referralCount = totalInvites, isLoading = false) }
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

    // TODO(follow-up, platform eng — NOT wired yet, do not assume this works
    // live): this whole function still does a client-side WriteBatch that
    // directly increments `coins` on both the referrer's and this user's
    // `users/{uid}` docs. `firestore.rules`'s `serverOnlyUserFields()`
    // explicitly blocks client writes to `coins` on `/users/{uid}` update
    // (and there is no rule granting a non-owner write to `coins` on
    // someone else's doc at all), so this batch fails with
    // PERMISSION_DENIED for every real user today.
    //
    // The fix lives server-side now: `functions/index.js` exports a new
    // callable, `redeemReferralCode`, that does this same lookup +
    // usedReferral check + coin credit atomically via an Admin-SDK
    // Firestore transaction (see that function for the exact validation:
    // it rejects an unknown code, your own code, and a caller who already
    // has `usedReferral == true`).
    //
    // To wire this up, replace the body below with a single call:
    //   val callable = Firebase.functions.getHttpsCallable("redeemReferralCode")
    //   val response = callable.call(mapOf("code" to code)).await()
    //   val data = response.data as Map<*, *>
    //   // data["success"] == true, data["coinsAwarded"] == Int (e.g. 100)
    //   // Errors surface as FirebaseFunctionsException with codes:
    //   //   invalid-argument  — blank/own code
    //   //   not-found         — code not found / user doc missing
    //   //   failed-precondition — usedReferral already true
    //   //   unauthenticated / internal — as usual
    // No more direct Firestore reads/writes are needed client-side for the
    // redeem path once this is wired — delete the WriteBatch and the two
    // .get() lookups below entirely.
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
                // TODO(follow-up): this batch write is blocked server-side by
                // firestore.rules's serverOnlyUserFields() ("coins") the moment
                // a real signed-in user hits it — see the redeemCode() doc
                // comment above. Replace with a call to the new
                // `redeemReferralCode` callable Cloud Function instead of
                // fixing/expanding this batch.
                val coinsPerReferral = 100
                firestore.runBatch { batch ->
                    batch.update(referrerDoc.reference, mapOf(
                        "coins" to com.google.firebase.firestore.FieldValue.increment(coinsPerReferral.toLong()),
                        "referralStats.totalInvites" to com.google.firebase.firestore.FieldValue.increment(1L),
                        "referralStats.coinsEarned" to com.google.firebase.firestore.FieldValue.increment(coinsPerReferral.toLong()),
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

    val infiniteTransition = rememberInfiniteTransition(label = "glow")
    val glowAlpha by infiniteTransition.animateFloat(
        initialValue = 0.12f,
        targetValue = 0.30f,
        animationSpec = infiniteRepeatable(
            animation = tween(1800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "glowAlpha",
    )

    val rank = when {
        uiState.referralCount >= 5 -> "Gold"
        uiState.referralCount >= 2 -> "Silver"
        else -> "New"
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
                .padding(horizontal = RuvoSpacing.md, vertical = RuvoSpacing.cardGap),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary)
            }
            Text(
                "Refer & Earn",
                style = MaterialTheme.typography.headlineSmall,
                color = RuvoColors.textPrimary,
                fontWeight = FontWeight.Bold,
            )
        }

        // ── Hero ──
        Column(
            modifier = Modifier.fillMaxWidth().padding(top = RuvoSpacing.sm, bottom = RuvoSpacing.lg),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(modifier = Modifier.size(100.dp), contentAlignment = Alignment.Center) {
                Box(
                    modifier = Modifier
                        .size(100.dp)
                        .clip(CircleShape)
                        .background(RuvoColors.lime.copy(alpha = glowAlpha)),
                )
                Box(
                    modifier = Modifier
                        .size(76.dp)
                        .clip(CircleShape)
                        .background(RuvoColors.lime),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.CardGiftcard, contentDescription = null, tint = Color.Black, modifier = Modifier.size(36.dp))
                }
            }
            Spacer(Modifier.height(RuvoSpacing.md))
            Text(
                "Invite Friends,\nEarn Together",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.ExtraBold,
                color = RuvoColors.textPrimary,
                textAlign = TextAlign.Center,
                lineHeight = 34.sp,
            )
            Spacer(Modifier.height(RuvoSpacing.cardGap))
            Text(
                buildAnnotatedString {
                    append("Share your code — when a friend joins RUVO,\n")
                    withStyle(androidx.compose.ui.text.SpanStyle(color = RuvoColors.lime, fontWeight = FontWeight.SemiBold)) {
                        append("both of you earn 100 coins")
                    }
                    append(" instantly.")
                },
                style = MaterialTheme.typography.bodyMedium,
                color = RuvoColors.textSecondary,
                textAlign = TextAlign.Center,
                lineHeight = 22.sp,
                modifier = Modifier.padding(horizontal = RuvoSpacing.md),
            )
        }

        // Stats row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = RuvoSpacing.md),
            horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.sm),
        ) {
            StatCard(label = "Friends Invited", value = "${uiState.referralCount}", icon = Icons.Default.People, modifier = Modifier.weight(1f))
            StatCard(label = "Coins Earned", value = "${uiState.coinsEarned}", icon = Icons.Default.Bolt, accentValue = true, modifier = Modifier.weight(1f))
            StatCard(label = "Rank", value = rank, icon = Icons.Default.EmojiEvents, modifier = Modifier.weight(1f))
        }

        Spacer(Modifier.height(RuvoSpacing.md))

        // ── Code card ──
        Column(
            modifier = Modifier
                .padding(horizontal = RuvoSpacing.md)
                .fillMaxWidth()
                .clip(RoundedCornerShape(RuvoRadius.md))
                .background(RuvoColors.surfaceElev)
                .border(1.dp, RuvoColors.border, RoundedCornerShape(RuvoRadius.md))
                .padding(RuvoSpacing.lg),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "YOUR REFERRAL CODE",
                style = MaterialTheme.typography.labelSmall,
                color = RuvoColors.textTertiary,
                letterSpacing = 1.8.sp,
            )
            Spacer(Modifier.height(RuvoSpacing.md))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(RuvoRadius.card))
                    .background(RuvoColors.lime.copy(alpha = 0.05f))
                    .border(1.5.dp, RuvoColors.lime.copy(alpha = 0.35f), RoundedCornerShape(RuvoRadius.card))
                    .padding(horizontal = RuvoSpacing.xl, vertical = RuvoSpacing.cardGap),
            ) {
                Text(
                    uiState.referralCode.ifEmpty { "Loading…" },
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.ExtraBold,
                    color = RuvoColors.lime,
                    letterSpacing = 4.sp,
                )
            }
            Spacer(Modifier.height(RuvoSpacing.md))
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = {
                    clipboard.setText(AnnotatedString(uiState.referralCode))
                    codeCopied = true
                }) {
                    Icon(
                        if (codeCopied) Icons.Default.CheckCircle else Icons.Default.ContentCopy,
                        contentDescription = "Copy code",
                        tint = if (codeCopied) RuvoColors.lime else RuvoColors.textTertiary,
                        modifier = Modifier.size(17.dp),
                    )
                    Spacer(Modifier.width(RuvoSpacing.xs))
                    Text(
                        if (codeCopied) "Copied!" else "Copy",
                        color = if (codeCopied) RuvoColors.lime else RuvoColors.textTertiary,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Box(modifier = Modifier.width(1.dp).height(18.dp).background(RuvoColors.border))
                TextButton(onClick = { shareReferralCode(context, uiState.referralCode) }) {
                    Icon(Icons.Default.Share, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(RuvoSpacing.xs))
                    Text("Share", color = RuvoColors.textTertiary, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        Spacer(Modifier.height(RuvoSpacing.cardGap))

        // ── Invite button ──
        Button(
            onClick = { shareReferralCode(context, uiState.referralCode) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = RuvoSpacing.md).height(54.dp),
            shape = RoundedCornerShape(RuvoRadius.card),
            colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black),
        ) {
            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(19.dp))
            Spacer(Modifier.width(RuvoSpacing.sm))
            Text("Invite Friends Now", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }

        Spacer(Modifier.height(RuvoSpacing.lg))

        // ── How it works ──
        Column(
            modifier = Modifier
                .padding(horizontal = RuvoSpacing.md)
                .fillMaxWidth()
                .clip(RoundedCornerShape(RuvoRadius.md))
                .background(RuvoColors.surface)
                .border(1.dp, RuvoColors.border, RoundedCornerShape(RuvoRadius.md))
                .padding(RuvoSpacing.md),
        ) {
            Text("How it works", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = RuvoColors.textPrimary)
            Spacer(Modifier.height(RuvoSpacing.md))
            REFERRAL_STEPS.forEachIndexed { i, step ->
                Row(verticalAlignment = Alignment.Top) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(28.dp)) {
                        Box(
                            modifier = Modifier
                                .size(22.dp)
                                .clip(CircleShape)
                                .background(RuvoColors.lime.copy(alpha = 0.15f))
                                .border(1.dp, RuvoColors.lime.copy(alpha = 0.4f), CircleShape),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("${i + 1}", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = RuvoColors.lime)
                        }
                        if (i < REFERRAL_STEPS.size - 1) {
                            Box(modifier = Modifier.width(1.dp).weight(1f).background(RuvoColors.border))
                        }
                    }
                    Spacer(Modifier.width(RuvoSpacing.xs))
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(RuvoRadius.sm))
                            .background(RuvoColors.lime.copy(alpha = 0.1f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(step.icon, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(20.dp))
                    }
                    Spacer(Modifier.width(RuvoSpacing.cardGap))
                    Column(modifier = Modifier.padding(bottom = RuvoSpacing.md)) {
                        Text(step.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = RuvoColors.textPrimary)
                        Spacer(Modifier.height(2.dp))
                        Text(step.desc, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary, lineHeight = 18.sp)
                    }
                }
            }
        }

        Spacer(Modifier.height(RuvoSpacing.md))

        // ── Redeem ──
        Column(
            modifier = Modifier
                .padding(horizontal = RuvoSpacing.md)
                .fillMaxWidth()
                .clip(RoundedCornerShape(RuvoRadius.md))
                .background(RuvoColors.surface)
                .border(1.dp, RuvoColors.border, RoundedCornerShape(RuvoRadius.md))
                .padding(RuvoSpacing.md),
        ) {
            Row(verticalAlignment = Alignment.Top) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(RuvoRadius.sm))
                        .background(RuvoColors.lime.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.ConfirmationNumber, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(18.dp))
                }
                Spacer(Modifier.width(RuvoSpacing.cardGap))
                Column {
                    Text("Have a friend's code?", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = RuvoColors.textPrimary)
                    Spacer(Modifier.height(2.dp))
                    Text("Enter it to claim your 100 coins welcome bonus.", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary, lineHeight = 18.sp)
                }
            }
            Spacer(Modifier.height(RuvoSpacing.md))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(RuvoRadius.card))
                    .background(RuvoColors.background)
                    .border(1.dp, RuvoColors.border, RoundedCornerShape(RuvoRadius.card)),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = uiState.redeemCode,
                    onValueChange = viewModel::onRedeemCodeChange,
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("e.g. RUVO1234", color = RuvoColors.textTertiary) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color.Transparent,
                        unfocusedBorderColor = Color.Transparent,
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent,
                        focusedTextColor = RuvoColors.textPrimary,
                        unfocusedTextColor = RuvoColors.textPrimary,
                    ),
                )
                Button(
                    onClick = viewModel::redeemCode,
                    enabled = uiState.redeemStatus !is RedeemStatus.Loading && uiState.redeemCode.isNotBlank(),
                    shape = RoundedCornerShape(0.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black, disabledContainerColor = RuvoColors.lime.copy(alpha = 0.4f)),
                    modifier = Modifier.fillMaxHeight().widthIn(min = 80.dp),
                ) {
                    if (uiState.redeemStatus is RedeemStatus.Loading) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.Black, strokeWidth = 2.dp)
                    } else {
                        Text("Apply", fontWeight = FontWeight.Bold)
                    }
                }
            }

            AnimatedVisibility(visible = uiState.redeemStatus is RedeemStatus.Error) {
                Text(
                    (uiState.redeemStatus as? RedeemStatus.Error)?.message ?: "",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(top = RuvoSpacing.sm),
                )
            }

            AnimatedVisibility(visible = uiState.redeemStatus is RedeemStatus.Success) {
                val coins = (uiState.redeemStatus as? RedeemStatus.Success)?.coinsAwarded ?: 0
                Surface(
                    shape = RoundedCornerShape(RuvoRadius.card),
                    color = RuvoColors.lime.copy(alpha = 0.12f),
                    modifier = Modifier.padding(top = RuvoSpacing.sm),
                ) {
                    Row(
                        modifier = Modifier.padding(RuvoSpacing.cardGap),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(RuvoSpacing.sm),
                    ) {
                        Icon(Icons.Default.Bolt, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(20.dp))
                        Text("+$coins coins added to your account!", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.lime, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }

        Spacer(Modifier.height(RuvoSpacing.md))

        // ── Disclaimer ──
        Text(
            "Coins are credited once your friend completes signup. One bonus per account. Terms apply.",
            style = MaterialTheme.typography.bodySmall,
            color = RuvoColors.textTertiary.copy(alpha = 0.6f),
            textAlign = TextAlign.Center,
            lineHeight = 17.sp,
            modifier = Modifier.fillMaxWidth().padding(horizontal = RuvoSpacing.xl),
        )

        Spacer(Modifier.height(40.dp))
    }
}

@Composable
private fun StatCard(
    label: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier,
    accentValue: Boolean = false,
) {
    Surface(
        shape = RoundedCornerShape(RuvoRadius.card),
        color = RuvoColors.surface,
        border = BorderStroke(1.dp, RuvoColors.border),
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier.padding(vertical = RuvoSpacing.cardGap, horizontal = RuvoSpacing.sm),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(RuvoSpacing.xs),
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(RuvoColors.lime.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(16.dp))
            }
            Text(
                value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.ExtraBold,
                color = if (accentValue) RuvoColors.lime else RuvoColors.textPrimary,
            )
            Text(label, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, textAlign = TextAlign.Center)
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
