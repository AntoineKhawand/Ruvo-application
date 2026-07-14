package com.ruvo.app.features.paywall

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*

@Composable
fun PaywallScreen(onDismiss: () -> Unit, viewModel: PaywallViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val activity = context as? android.app.Activity

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
            IconButton(onClick = onDismiss, modifier = Modifier.align(Alignment.TopEnd)) {
                Icon(Icons.Default.Close, contentDescription = "Close", tint = RuvoColors.textSecondary)
            }
        }

        Column(
            modifier = Modifier.padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Hero
            Box(
                modifier = Modifier.size(100.dp).clip(CircleShape).background(RuvoColors.limeDim),
                contentAlignment = Alignment.Center
            ) {
                Text("⚡", style = MaterialTheme.typography.displayLarge)
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Ruvo Pro", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)
                Text("Unlock your full running potential", style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary, textAlign = TextAlign.Center)
            }

            // Feature list
            Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                proFeatures.forEach { feature ->
                    PaywallFeatureRow(emoji = feature.first, text = feature.second)
                }
            }

            // Package cards
            if (uiState.packages.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    uiState.packages.forEach { pkg ->
                        PackageCard(
                            pkg = pkg,
                            isSelected = pkg.identifier == uiState.selectedPackageId,
                            onSelect = { viewModel.selectPackage(pkg.identifier) },
                        )
                    }
                }
            } else if (!uiState.isLoading) {
                // Fallback pricing cards when RevenueCat not configured
                Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    FallbackPackageCard(title = "Annual", price = "$59.99/year", badge = "Save 60%", isSelected = uiState.selectedPackageId == "annual", onSelect = { viewModel.selectFallback("annual") })
                    FallbackPackageCard(title = "Monthly", price = "$12.99/month", badge = null, isSelected = uiState.selectedPackageId == "monthly", onSelect = { viewModel.selectFallback("monthly") })
                }
            }

            // CTA
            if (uiState.isLoading) {
                CircularProgressIndicator(color = RuvoColors.lime)
            } else {
                RuvoButton(
                    text = "Continue",
                    onClick = { activity?.let { viewModel.purchase(it) } },
                    style = RuvoButtonVariant.Primary,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Error
            if (uiState.errorMessage != null) {
                Text(uiState.errorMessage!!, style = MaterialTheme.typography.bodySmall, color = Color(0xFFEF4444), textAlign = TextAlign.Center)
            }

            // Restore
            TextButton(onClick = { viewModel.restorePurchases() }) {
                Text("Restore Purchases", color = RuvoColors.textSecondary, style = MaterialTheme.typography.bodySmall)
            }

            // Legal
            Text(
                "Subscriptions auto-renew unless cancelled 24 hours before the renewal date. Manage in Google Play.",
                style = MaterialTheme.typography.labelSmall,
                color = RuvoColors.textTertiary,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(bottom = 24.dp)
            )
        }
    }
}

@Composable
private fun PaywallFeatureRow(emoji: String, text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(emoji, style = MaterialTheme.typography.titleLarge)
        Text(text, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary)
    }
}

@Composable
private fun PackageCard(pkg: PaywallPackage, isSelected: Boolean, onSelect: () -> Unit) {
    Surface(
        onClick = onSelect,
        shape = RoundedCornerShape(16.dp),
        color = if (isSelected) RuvoColors.limeDim else RuvoColors.surface,
        border = BorderStroke(if (isSelected) 2.dp else 1.dp, if (isSelected) RuvoColors.lime else RuvoColors.border),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(modifier = Modifier.padding(16.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text(pkg.title, style = MaterialTheme.typography.titleMedium, color = if (isSelected) RuvoColors.lime else RuvoColors.textPrimary)
                Text(pkg.priceString, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                if (pkg.badge != null) {
                    RuvoChip(label = pkg.badge, isActive = true)
                }
                RadioButton(
                    selected = isSelected,
                    onClick = onSelect,
                    colors = RadioButtonDefaults.colors(selectedColor = RuvoColors.lime, unselectedColor = RuvoColors.border)
                )
            }
        }
    }
}

@Composable
private fun FallbackPackageCard(title: String, price: String, badge: String?, isSelected: Boolean, onSelect: () -> Unit) {
    Surface(
        onClick = onSelect,
        shape = RoundedCornerShape(16.dp),
        color = if (isSelected) RuvoColors.limeDim else RuvoColors.surface,
        border = BorderStroke(if (isSelected) 2.dp else 1.dp, if (isSelected) RuvoColors.lime else RuvoColors.border),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(modifier = Modifier.padding(16.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text(title, style = MaterialTheme.typography.titleMedium, color = if (isSelected) RuvoColors.lime else RuvoColors.textPrimary)
                Text(price, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                if (badge != null) RuvoChip(label = badge, isActive = true)
                RadioButton(selected = isSelected, onClick = onSelect, colors = RadioButtonDefaults.colors(selectedColor = RuvoColors.lime, unselectedColor = RuvoColors.border))
            }
        }
    }
}

private val proFeatures = listOf(
    "🤖" to "AI Coach with unlimited messages",
    "📊" to "Advanced analytics & insights",
    "🏆" to "Exclusive challenges & events",
    "❤️" to "Heart rate zone analysis",
    "👥" to "Create & manage running clubs",
    "🎨" to "Custom route sharing cards",
)
