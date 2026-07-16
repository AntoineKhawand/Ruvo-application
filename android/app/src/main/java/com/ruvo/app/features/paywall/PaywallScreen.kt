package com.ruvo.app.features.paywall

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*

private data class PaywallFeature(
    val emoji: String,
    val title: String,
    val desc: String,
    val accentColor: Color,
)

private val PAYWALL_FEATURES = listOf(
    PaywallFeature("💬", "AI Coach", "Personalised training & adaptive plans", Color(0xFF5AC8FA)),
    PaywallFeature("🪙", "2× Coins", "Double coins on every run you log", Color(0xFFCCFF00)),
    PaywallFeature("📊", "Advanced Analytics", "VO2 Max, Race Predictor & PRs", Color(0xFFBF5AF2)),
    PaywallFeature("⌚", "Wearables", "Whoop, Oura Ring & Health sync", Color(0xFF30D158)),
)

@Composable
fun PaywallScreen(onDismiss: () -> Unit, viewModel: PaywallViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val activity = context as? android.app.Activity
    val uriHandler = LocalUriHandler.current

    LaunchedEffect(Unit) { viewModel.loadOfferings() }
    LaunchedEffect(uiState.isPurchased) { if (uiState.isPurchased) onDismiss() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
            .verticalScroll(rememberScrollState())
    ) {
        // Close button
        Box(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            IconButton(
                onClick = onDismiss,
                modifier = Modifier.align(Alignment.TopEnd).size(36.dp).clip(CircleShape)
                    .background(RuvoColors.surfaceElev).border(1.dp, RuvoColors.border, CircleShape),
            ) {
                Icon(Icons.Default.Close, contentDescription = "Close", tint = RuvoColors.textPrimary, modifier = Modifier.size(20.dp))
            }
        }

        Column(
            modifier = Modifier.padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Hero
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Surface(shape = RoundedCornerShape(20.dp), color = RuvoColors.lime) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                    ) {
                        Text("👑", style = MaterialTheme.typography.labelMedium)
                        Text("RUVO PRO", style = MaterialTheme.typography.labelMedium, color = Color.Black)
                    }
                }
                Text(
                    "Unlock Your\nFull Potential",
                    style = MaterialTheme.typography.displayMedium,
                    color = RuvoColors.textPrimary,
                    textAlign = TextAlign.Center,
                    lineHeight = MaterialTheme.typography.displayMedium.fontSize.times(1.15f),
                )
                Text(
                    "The complete runner's toolkit — all in one place",
                    style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary, textAlign = TextAlign.Center,
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Default.People, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(14.dp))
                    Text("Joined by 12,400+ Pro runners", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                }
            }

            // Locked feature grid
            Column(verticalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.fillMaxWidth()) {
                Text("WHAT YOU'RE MISSING", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    PAYWALL_FEATURES.chunked(2).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            row.forEach { feature ->
                                LockedFeatureCard(feature = feature, modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }

            // Unlock divider
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Box(Modifier.weight(1f).height(1.dp).background(RuvoColors.border))
                Surface(shape = RoundedCornerShape(20.dp), color = RuvoColors.limeDim, modifier = Modifier.padding(horizontal = 10.dp)) {
                    Row(modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        Icon(Icons.Default.LockOpen, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(13.dp))
                        Text("Unlock everything below", style = MaterialTheme.typography.labelSmall, color = RuvoColors.lime)
                    }
                }
                Box(Modifier.weight(1f).height(1.dp).background(RuvoColors.border))
            }

            // Package cards
            if (uiState.isLoading) {
                CircularProgressIndicator(color = RuvoColors.lime)
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.fillMaxWidth()) {
                    uiState.annualPkg?.let { annual ->
                        AnnualPackageCard(
                            pkg = annual,
                            isSelected = uiState.selectedPackageId == annual.identifier,
                            savingsPercent = uiState.savingsPercent ?: 33,
                            monthlyPkg = uiState.monthlyPkg,
                            onSelect = { viewModel.selectPackage(annual.identifier) },
                        )
                    }
                    uiState.monthlyPkg?.let { monthly ->
                        MonthlyPackageCard(
                            pkg = monthly,
                            isSelected = uiState.selectedPackageId == monthly.identifier,
                            onSelect = { viewModel.selectPackage(monthly.identifier) },
                        )
                    }
                }
            }

            // Mock offerings notice
            if (uiState.isMockOfferings) {
                Surface(shape = RoundedCornerShape(12.dp), color = RuvoColors.warning.copy(alpha = 0.08f), border = BorderStroke(1.dp, RuvoColors.warning.copy(alpha = 0.25f)), modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.Build, contentDescription = null, tint = RuvoColors.warning, modifier = Modifier.size(16.dp))
                        Text("Demo prices — products not yet published in Play Store", style = MaterialTheme.typography.bodySmall, color = RuvoColors.warning)
                    }
                }
            }

            // CTA
            RuvoButton(
                text = "Unlock Ruvo Pro",
                icon = null,
                onClick = { activity?.let { viewModel.purchase(it) } },
                style = RuvoButtonVariant.Primary,
                isLoading = uiState.isLoading,
                modifier = Modifier.fillMaxWidth()
            )

            // Error
            if (uiState.errorMessage != null) {
                Text(uiState.errorMessage!!, style = MaterialTheme.typography.bodySmall, color = RuvoColors.error, textAlign = TextAlign.Center)
            }

            // Trust row
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                listOf("No commitment", "Cancel anytime", "Secure payment").forEach { label ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = RuvoColors.lime, modifier = Modifier.size(13.dp))
                        Text(label, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                    }
                }
            }

            // Legal
            Text(
                "Subscription auto-renews. Manage or cancel in device Settings at any time.",
                style = MaterialTheme.typography.labelSmall,
                color = RuvoColors.textTertiary,
                textAlign = TextAlign.Center,
            )

            // Footer links
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 24.dp)) {
                Text("Restore Purchase", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary, modifier = Modifier.clickable { viewModel.restorePurchases() })
                Text("·", color = RuvoColors.textTertiary)
                Text("Terms", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary, modifier = Modifier.clickable { uriHandler.openUri("https://ruvo.run/terms") })
                Text("·", color = RuvoColors.textTertiary)
                Text("Privacy", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary, modifier = Modifier.clickable { uriHandler.openUri("https://ruvo.run/privacy") })
            }
        }
    }
}

@Composable
private fun LockedFeatureCard(feature: PaywallFeature, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier.height(150.dp),
        shape = RoundedCornerShape(18.dp),
        color = RuvoColors.surface,
        border = BorderStroke(1.dp, RuvoColors.border),
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Text(feature.emoji, style = MaterialTheme.typography.headlineLarge, modifier = Modifier.align(Alignment.TopStart).padding(16.dp).alpha(0.45f))
            Box(
                modifier = Modifier.align(Alignment.TopEnd).padding(12.dp).size(26.dp).clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.12f)).border(1.dp, Color.White.copy(alpha = 0.15f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Default.Lock, contentDescription = null, tint = Color.White, modifier = Modifier.size(12.dp))
            }
            Column(modifier = Modifier.align(Alignment.BottomStart).padding(16.dp)) {
                Text(feature.title, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary)
                Text(feature.desc, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary, maxLines = 2)
            }
        }
    }
}

@Composable
private fun AnnualPackageCard(pkg: PaywallPackage, isSelected: Boolean, savingsPercent: Int, monthlyPkg: PaywallPackage?, onSelect: () -> Unit) {
    Box {
        Surface(
            onClick = onSelect,
            shape = RoundedCornerShape(18.dp),
            color = if (isSelected) RuvoColors.limeDim else RuvoColors.surface,
            border = BorderStroke(if (isSelected) 2.dp else 1.dp, RuvoColors.lime),
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        ) {
            Column(modifier = Modifier.padding(top = 16.dp, bottom = 16.dp, start = 18.dp, end = 18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("Annual Plan", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
                        Text("Just $${String.format("%.2f", pkg.priceAmount / 12)}/month", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(pkg.priceString, style = MaterialTheme.typography.titleLarge, color = RuvoColors.lime)
                        Text("/year", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                        if (monthlyPkg != null) {
                            Text(
                                "$${String.format("%.2f", monthlyPkg.priceAmount * 12)}",
                                style = MaterialTheme.typography.bodySmall.copy(textDecoration = androidx.compose.ui.text.style.TextDecoration.LineThrough),
                                color = RuvoColors.textTertiary,
                            )
                        }
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    RadioButton(selected = isSelected, onClick = onSelect, colors = RadioButtonDefaults.colors(selectedColor = RuvoColors.lime, unselectedColor = RuvoColors.border))
                    Text("Selected plan", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                }
            }
        }
        Surface(shape = RoundedCornerShape(20.dp), color = RuvoColors.lime, modifier = Modifier.align(Alignment.TopCenter)) {
            Text(
                "BEST VALUE · SAVE $savingsPercent%",
                style = MaterialTheme.typography.labelSmall,
                color = Color.Black,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 5.dp),
            )
        }
    }
}

@Composable
private fun MonthlyPackageCard(pkg: PaywallPackage, isSelected: Boolean, onSelect: () -> Unit) {
    Surface(
        onClick = onSelect,
        shape = RoundedCornerShape(18.dp),
        color = if (isSelected) RuvoColors.surfaceElev else RuvoColors.surface,
        border = BorderStroke(if (isSelected) 1.5.dp else 1.dp, if (isSelected) Color.White else RuvoColors.border),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("Monthly Plan", style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary)
                    Text("Cancel anytime", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(pkg.priceString, style = MaterialTheme.typography.titleLarge, color = RuvoColors.textPrimary)
                    Text("/month", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                RadioButton(selected = isSelected, onClick = onSelect, colors = RadioButtonDefaults.colors(selectedColor = RuvoColors.lime, unselectedColor = RuvoColors.border))
                Text(if (isSelected) "Selected plan" else "Switch to monthly", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }
        }
    }
}
