package com.ruvo.app.features.settings

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.*
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ruvo.app.designsystem.theme.RuvoColors

private data class FaqItem(val question: String, val answer: String)
private data class FaqCategory(val title: String, val icon: String, val items: List<FaqItem>)

private val FAQ_DATA = listOf(
    FaqCategory("Getting Started", "🚀", listOf(
        FaqItem("How do I start tracking a run?", "Tap the Run button (bottom center of the home screen), allow location permission when prompted, then tap the Start button when you're ready to run."),
        FaqItem("Does RUVO work without internet?", "GPS tracking and basic run recording work offline. Your run syncs to your profile automatically when you reconnect."),
        FaqItem("How accurate is GPS tracking?", "RUVO uses high-accuracy GPS combined with your phone's sensors. Accuracy depends on environment — open areas give the best results."),
    )),
    FaqCategory("Coins & Rewards", "🪙", listOf(
        FaqItem("How do I earn coins?", "Earn coins by completing runs (distance-based), maintaining streaks, earning achievements, and referring friends. Premium subscribers earn 2× coins."),
        FaqItem("How do I redeem rewards?", "Go to Profile → Rewards. Browse the catalog, tap any reward and hit Redeem if you have enough coins. Your code appears instantly."),
        FaqItem("Do coins expire?", "Coins never expire. Redeemed reward codes typically expire in 30 days — check each reward's terms for details."),
    )),
    FaqCategory("RUVO PRO", "⭐", listOf(
        FaqItem("What's included in RUVO PRO?", "Unlimited AI coach questions, advanced analytics, custom training plans, 2× coin earning, offline maps, and no ads."),
        FaqItem("How do I cancel my subscription?", "Go to your device's Play Store (Android) → Subscriptions → RUVO. Cancellations take effect at the end of the billing period."),
    )),
    FaqCategory("Technical Issues", "🔧", listOf(
        FaqItem("The app isn't tracking my location.", "Make sure location permission is set to 'Allow all the time' for RUVO in your device Settings → Apps → RUVO → Permissions."),
        FaqItem("My run didn't save.", "If a run didn't save, check your internet connection and try manually syncing from Profile → Settings. Runs are cached locally for up to 7 days."),
        FaqItem("How do I connect WHOOP or Oura?", "Go to Profile → Settings → Connected Devices. Tap Connect next to WHOOP or Oura and follow the OAuth login flow."),
    )),
    FaqCategory("Community & Privacy", "👥", listOf(
        FaqItem("How do I make my profile private?", "Go to Settings → Privacy Controls and set Profile Visibility to 'Friends Only' or 'Private'."),
        FaqItem("Can I block another user?", "Yes. Visit their profile, tap the ⋮ menu, and select Block. They won't be able to see your profile or send messages."),
        FaqItem("How do I report inappropriate content?", "Tap the ⋮ or flag icon next to any post or profile. We review all reports within 24 hours."),
    )),
)

@Composable
fun HelpCenterScreen(onBack: () -> Unit = {}) {
    val context = LocalContext.current
    val expandedCategories = remember { mutableStateMapOf<String, Boolean>() }
    val expandedItems = remember { mutableStateMapOf<String, Boolean>() }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(RuvoColors.background),
        contentPadding = PaddingValues(bottom = 80.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary) }
                Text("Help Center", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
            }

            // Contact support card
            Surface(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                shape = RoundedCornerShape(16.dp),
                color = RuvoColors.surface,
                border = BorderStroke(1.dp, RuvoColors.lime.copy(alpha = 0.3f)),
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text("📧", style = MaterialTheme.typography.headlineMedium)
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Still need help?", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = RuvoColors.textPrimary)
                        Text("support@ruvoapp.com", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                    }
                    TextButton(
                        onClick = {
                            val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:support@ruvoapp.com?subject=RUVO Support"))
                            try { context.startActivity(intent) } catch (_: Exception) {}
                        }
                    ) { Text("Contact", color = RuvoColors.lime, fontWeight = FontWeight.Bold) }
                }
            }

            Spacer(Modifier.height(8.dp))
        }

        FAQ_DATA.forEach { category ->
            val isCatExpanded = expandedCategories[category.title] ?: false

            item(key = category.title) {
                Surface(
                    onClick = { expandedCategories[category.title] = !isCatExpanded },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                    shape = RoundedCornerShape(16.dp),
                    color = RuvoColors.surface,
                    border = BorderStroke(1.dp, if (isCatExpanded) RuvoColors.lime.copy(alpha = 0.4f) else RuvoColors.border),
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(category.icon, style = MaterialTheme.typography.titleMedium)
                        Text(category.title, style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        Icon(
                            if (isCatExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                            contentDescription = null,
                            tint = RuvoColors.textTertiary,
                        )
                    }
                }
            }

            if (isCatExpanded) {
                items(category.items, key = { "${category.title}_${it.question}" }) { faq ->
                    val isExpanded = expandedItems["${category.title}_${faq.question}"] ?: false
                    Column(
                        modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 4.dp)
                    ) {
                        Surface(
                            onClick = { expandedItems["${category.title}_${faq.question}"] = !isExpanded },
                            shape = RoundedCornerShape(12.dp),
                            color = RuvoColors.surfaceElev,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(faq.question, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                                    Icon(
                                        if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                        contentDescription = null,
                                        tint = RuvoColors.lime,
                                        modifier = Modifier.size(20.dp),
                                    )
                                }
                                AnimatedVisibility(visible = isExpanded) {
                                    Text(faq.answer, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary, modifier = Modifier.padding(top = 8.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
