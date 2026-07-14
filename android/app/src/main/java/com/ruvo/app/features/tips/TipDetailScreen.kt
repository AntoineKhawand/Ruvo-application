package com.ruvo.app.features.tips

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import coil.compose.AsyncImage
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.core.content.ContentRepository
import com.ruvo.app.core.content.TipsLibrary
import com.ruvo.app.core.model.Tip
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

private data class CategoryMeta(val color: Color, val icon: androidx.compose.ui.graphics.vector.ImageVector)

private val CATEGORY_META = mapOf(
    "Technique" to CategoryMeta(RuvoColors.lime, Icons.Default.Speed),
    "Nutrition" to CategoryMeta(Color(0xFFFF9500), Icons.Default.Restaurant),
    "Recovery" to CategoryMeta(Color(0xFF5AC8FA), Icons.Default.BatteryChargingFull),
    "Mental" to CategoryMeta(Color(0xFFBF5AF2), Icons.Default.Psychology),
    "Strength" to CategoryMeta(Color(0xFFFF2D55), Icons.Default.FitnessCenter),
    "Gear" to CategoryMeta(Color(0xFFFFD700), Icons.Default.Checkroom),
    "Race Prep" to CategoryMeta(Color(0xFFFF6B6B), Icons.Default.Flag),
    "Injury Prev" to CategoryMeta(Color(0xFF34C759), Icons.Default.HealthAndSafety),
)

private fun categoryMeta(category: String) = CATEGORY_META[category] ?: CategoryMeta(RuvoColors.lime, Icons.Default.MenuBook)

data class TipDetailUiState(
    val tip: Tip? = null,
    val isSaved: Boolean = false,
    val views: Long = 0,
)

@HiltViewModel
class TipDetailViewModel @Inject constructor(
    private val contentRepository: ContentRepository,
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _uiState = MutableStateFlow(TipDetailUiState())
    val uiState: StateFlow<TipDetailUiState> = _uiState.asStateFlow()

    fun load(tipId: String) {
        val tip = TipsLibrary.ALL.firstOrNull { it.id == tipId } ?: return
        _uiState.value = TipDetailUiState(tip = tip, views = tip.viewCount)

        viewModelScope.launch {
            contentRepository.incrementTipView(tipId)

            val uid = auth.currentUser?.uid
            if (uid != null) {
                try {
                    val doc = firestore.collection("users").document(uid).get().await()
                    @Suppress("UNCHECKED_CAST")
                    val saved = (doc.get("savedTips") as? List<String>) ?: emptyList()
                    _uiState.update { it.copy(isSaved = saved.contains(tipId)) }
                } catch (_: Exception) { }
            }
        }
    }

    fun toggleBookmark() {
        val tip = _uiState.value.tip ?: return
        val wasSaved = _uiState.value.isSaved
        _uiState.update { it.copy(isSaved = !wasSaved) }
        viewModelScope.launch { contentRepository.toggleBookmark(tip.id, wasSaved) }
    }
}

@Composable
fun TipDetailScreen(
    tipId: String,
    onBack: () -> Unit = {},
    viewModel: TipDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var isHelpful by remember { mutableStateOf(false) }

    LaunchedEffect(tipId) { viewModel.load(tipId) }

    val tip = uiState.tip ?: run {
        Box(Modifier.fillMaxSize().background(RuvoColors.background))
        return
    }
    val meta = categoryMeta(tip.category)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
            .verticalScroll(rememberScrollState()),
    ) {
        // ── HERO ──
        Box(modifier = Modifier.fillMaxWidth().height(420.dp)) {
            AsyncImage(
                model = tip.img,
                contentDescription = tip.title,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
            Box(
                modifier = Modifier.fillMaxSize().background(
                    Brush.verticalGradient(
                        0f to Color.Black.copy(alpha = 0.55f),
                        0.45f to Color.Transparent,
                        1f to Color.Black.copy(alpha = 0.85f),
                    )
                )
            )

            Row(
                modifier = Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 20.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                HeroNavButton(icon = Icons.Default.ArrowBack, onClick = onBack)
                HeroNavButton(
                    icon = if (uiState.isSaved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                    tint = if (uiState.isSaved) RuvoColors.lime else Color.White,
                    highlighted = uiState.isSaved,
                    onClick = { viewModel.toggleBookmark() },
                )
            }

            Column(modifier = Modifier.align(Alignment.BottomStart).padding(horizontal = 20.dp, vertical = 24.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.clip(RoundedCornerShape(20.dp)).background(meta.color).padding(horizontal = 10.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(meta.icon, contentDescription = null, tint = Color.Black, modifier = Modifier.size(12.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(tip.tag, style = MaterialTheme.typography.labelSmall, color = Color.Black)
                    }
                    PillLabel(icon = Icons.Default.Timer, text = "${tip.readTime} min read")
                    if (uiState.views > 0) PillLabel(icon = Icons.Default.Visibility, text = formatViews(uiState.views))
                }
                Spacer(Modifier.height(12.dp))
                Text(tip.title, style = MaterialTheme.typography.displaySmall, color = Color.White)
                Spacer(Modifier.height(6.dp))
                Text(tip.desc, style = MaterialTheme.typography.bodyLarge, color = Color.White.copy(alpha = 0.75f))
            }
        }

        // ── BODY ──
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            // Key takeaway
            if (tip.keyTakeaway.isNotBlank()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(RuvoColors.surface)
                        .border(1.dp, RuvoColors.border, RoundedCornerShape(16.dp))
                        .padding(18.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Box(
                            modifier = Modifier.size(30.dp).clip(CircleShape).background(meta.color.copy(alpha = 0.13f)),
                            contentAlignment = Alignment.Center,
                        ) { Icon(Icons.Default.Lightbulb, contentDescription = null, tint = meta.color, modifier = Modifier.size(16.dp)) }
                        Text("KEY TAKEAWAY", style = MaterialTheme.typography.labelMedium, color = meta.color, letterSpacing = 1.sp)
                    }
                    Spacer(Modifier.height(10.dp))
                    Text(tip.keyTakeaway, style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textPrimary)
                }
            }

            // Breakdown
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(RuvoColors.surface)
                    .border(1.dp, RuvoColors.border, RoundedCornerShape(18.dp))
                    .padding(20.dp),
            ) {
                SectionHeader(icon = Icons.Default.Psychology, tint = meta.color, title = "THE BREAKDOWN")
                Spacer(Modifier.height(14.dp))
                Text(tip.why, style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary, lineHeight = 24.sp)
            }

            // Drill sequence
            Column {
                SectionHeader(icon = Icons.Default.Bolt, tint = RuvoColors.lime, title = "DRILL SEQUENCE")
                Spacer(Modifier.height(14.dp))
                tip.steps.forEachIndexed { i, step ->
                    val isLast = i == tip.steps.lastIndex
                    Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(42.dp).fillMaxHeight()) {
                            Box(
                                modifier = Modifier
                                    .size(34.dp)
                                    .clip(CircleShape)
                                    .background(if (isLast) meta.color.copy(alpha = 0.15f) else RuvoColors.background)
                                    .border(2.dp, if (isLast) meta.color else RuvoColors.border, CircleShape),
                                contentAlignment = Alignment.Center,
                            ) { Text("${i + 1}", style = MaterialTheme.typography.labelLarge, color = if (isLast) meta.color else RuvoColors.textSecondary) }
                            if (!isLast) {
                                Box(modifier = Modifier.width(2.dp).weight(1f).padding(vertical = 4.dp).background(meta.color.copy(alpha = 0.2f)))
                            }
                        }
                        Spacer(Modifier.width(14.dp))
                        Column(modifier = Modifier.padding(bottom = 28.dp)) {
                            Text(step.title, style = MaterialTheme.typography.titleMedium, color = if (isLast) meta.color else RuvoColors.textPrimary)
                            Spacer(Modifier.height(4.dp))
                            Text(step.desc, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textTertiary)
                        }
                    }
                }
            }

            // Mark as helpful
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (isHelpful) meta.color else RuvoColors.surface)
                    .border(1.5.dp, if (isHelpful) meta.color else RuvoColors.border, RoundedCornerShape(14.dp))
                    .clickable(onClick = { isHelpful = !isHelpful })
                    .padding(vertical = 16.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    if (isHelpful) Icons.Default.CheckCircle else Icons.Default.ThumbUp,
                    contentDescription = null,
                    tint = if (isHelpful) Color.Black else RuvoColors.textTertiary,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    if (isHelpful) "Marked as Helpful" else "Mark as Helpful",
                    style = MaterialTheme.typography.titleSmall,
                    color = if (isHelpful) Color.Black else RuvoColors.textTertiary,
                )
            }

            Spacer(Modifier.height(60.dp))
        }
    }
}

@Composable
private fun HeroNavButton(icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit, tint: Color = Color.White, highlighted: Boolean = false) {
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(if (highlighted) RuvoColors.lime.copy(alpha = 0.2f) else Color.Black.copy(alpha = 0.45f))
            .border(1.dp, if (highlighted) RuvoColors.lime.copy(alpha = 0.4f) else Color.White.copy(alpha = 0.15f), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun PillLabel(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String) {
    Row(
        modifier = Modifier.clip(RoundedCornerShape(20.dp)).background(Color.White.copy(alpha = 0.1f)).padding(horizontal = 9.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = Color(0xFFAAAAAA), modifier = Modifier.size(11.dp))
        Spacer(Modifier.width(4.dp))
        Text(text, style = MaterialTheme.typography.labelSmall, color = Color(0xFFAAAAAA))
    }
}

@Composable
private fun SectionHeader(icon: androidx.compose.ui.graphics.vector.ImageVector, tint: Color, title: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(
            modifier = Modifier.size(34.dp).clip(CircleShape).background(tint.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center,
        ) { Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(18.dp)) }
        Text(title, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary, letterSpacing = 1.5.sp)
    }
}

private fun formatViews(views: Long): String = when {
    views >= 1_000_000 -> "%.1fM".format(views / 1_000_000.0)
    views >= 1_000 -> "%.1fK".format(views / 1_000.0)
    else -> views.toString()
}
