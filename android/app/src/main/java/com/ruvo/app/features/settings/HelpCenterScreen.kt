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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class FaqItem(val question: String, val answer: String)
data class FaqCategory(val title: String, val icon: String, val items: List<FaqItem>)

// Verbatim from RN's src/constants/helpData.js (docs/rn-reference/helpData.js) —
// this screen previously shipped 5 entirely invented categories with
// different copy (and a wrong support-email domain, ruvoapp.com instead of
// the real ruvo.app used throughout this exact file's own FAQ answer text).
// These 4 are the real RN content, ionicon names swapped for emoji only
// because that's this screen's existing icon convention — not itself
// recovered RN text.
private val FALLBACK_FAQ_DATA = listOf(
    FaqCategory("Account & Profile", "👤", listOf(
        FaqItem("How do I change my profile picture?", "Go to Settings > Edit Profile, then tap the camera icon on your avatar to upload a new photo."),
        FaqItem("Can I change my username?", "Yes, you can update your display name in the Edit Profile screen. Your unique Runner ID cannot be changed."),
        FaqItem("How do I delete my account?", "Please contact support@ruvo.app with your account email to request permanent deletion."),
    )),
    FaqCategory("Tracking & GPS", "📍", listOf(
        FaqItem("Why is my GPS inaccurate?", "Ensure you have clear sky view. High buildings or dense trees can interfere. Also check that 'Precise Location' is enabled in your phone settings."),
        FaqItem("Does Ruvo work on a treadmill?", "Currently, Ruvo uses GPS for tracking, so indoor treadmill runs may not record distance accurately unless you manually edit the activity later."),
        FaqItem("How is calories burned calculated?", "We use your weight, distance, and pace to estimate calorie burn. Ensure your weight is updated in your profile for better accuracy."),
    )),
    FaqCategory("Community & Clubs", "👥", listOf(
        FaqItem("How do I create a club?", "Go to the Community tab, tap 'Clubs', then the '+' icon. You can set a name, description, and cover image."),
        FaqItem("Can I make my club private?", "Yes, when creating a club, toggle 'Private Club'. Only users you approve can see posts and join."),
        FaqItem("How do referrals work?", "Share your code from Settings > Invite Friends. When a friend signs up with your code, you both earn rewards!"),
    )),
    FaqCategory("Privacy & Safety", "🛡️", listOf(
        FaqItem("Who can see my runs?", "You can control this in Settings > Privacy Controls. Options are Public, Followers Only, or Private."),
        FaqItem("How do I block a user?", "Go to their profile, tap the three dots menu, and select 'Block'. They won't be able to see you or comment on your posts."),
    )),
)

@HiltViewModel
class HelpCenterViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
) : ViewModel() {
    private val _categories = MutableStateFlow(FALLBACK_FAQ_DATA)
    val categories: StateFlow<List<FaqCategory>> = _categories.asStateFlow()

    // RN_SOURCE_ARCHIVE.md §6c: tries Firestore `help_categories` (sorted by
    // `order`), falls back silently to the local constants on error or if
    // the collection is empty — same pattern as SettingsViewModel's
    // `system/app_config` fetch for the About dialog. Nothing in this repo's
    // Cloud Functions seeds this collection (grep-confirmed), same as
    // app_config, so this is a real, externally-managed config surface, not
    // dead code.
    init {
        viewModelScope.launch {
            try {
                val snap = firestore.collection("help_categories").orderBy("order").get().await()
                if (snap.isEmpty) return@launch
                val fetched = snap.documents.mapNotNull { doc ->
                    val title = doc.getString("title") ?: return@mapNotNull null
                    @Suppress("UNCHECKED_CAST")
                    val faqs = (doc.get("faqs") as? List<Map<String, Any>>)?.mapNotNull { f ->
                        val q = f["q"] as? String ?: return@mapNotNull null
                        val a = f["a"] as? String ?: return@mapNotNull null
                        FaqItem(q, a)
                    } ?: emptyList()
                    if (faqs.isEmpty()) return@mapNotNull null
                    FaqCategory(title, doc.getString("icon") ?: "❓", faqs)
                }
                if (fetched.isNotEmpty()) _categories.value = fetched
            } catch (_: Exception) {
                // Keep the local fallback already in _categories.
            }
        }
    }
}

@Composable
fun HelpCenterScreen(onBack: () -> Unit = {}, viewModel: HelpCenterViewModel = hiltViewModel()) {
    val context = LocalContext.current
    val faqData by viewModel.categories.collectAsStateWithLifecycle()
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

            // Contact card — RN_SOURCE_ARCHIVE.md §6c: two distinct mailto
            // actions with different subject lines, both to the real
            // support@ruvo.app (this screen previously used a single merged
            // "Contact" button pointed at the wrong domain, ruvoapp.com).
            Surface(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                shape = RoundedCornerShape(16.dp),
                color = RuvoColors.surface,
                border = BorderStroke(1.dp, RuvoColors.lime.copy(alpha = 0.3f)),
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("📧", style = MaterialTheme.typography.headlineMedium)
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Still need help?", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = RuvoColors.textPrimary)
                            Text("support@ruvo.app", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        TextButton(onClick = {
                            val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:support@ruvo.app?subject=Ruvo Support Request"))
                            try { context.startActivity(intent) } catch (_: Exception) {}
                        }) { Text("Contact Support", color = RuvoColors.lime, fontWeight = FontWeight.Bold) }
                        TextButton(onClick = {
                            val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:support@ruvo.app?subject=Bug Report"))
                            try { context.startActivity(intent) } catch (_: Exception) {}
                        }) { Text("Report a Bug", color = RuvoColors.textSecondary, fontWeight = FontWeight.Bold) }
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
        }

        faqData.forEach { category ->
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
