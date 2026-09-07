package com.ruvo.app.features.aicoach

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ruvo.app.designsystem.theme.*

@Composable
fun AICoachScreen(
    onUpgrade: () -> Unit = {},
    initialPrompt: String? = null,
    onPromptConsumed: () -> Unit = {},
    viewModel: AICoachViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()

    // RunDetailScreen's "Continue with AI Coach" hand-off (archive §4) — sent
    // once per non-null prompt, then reported back via onPromptConsumed()
    // (RuvoApp.kt clears its pending-prompt state there) so a later visit to
    // this screen with no hand-off pending doesn't resend anything.
    LaunchedEffect(initialPrompt) {
        if (!initialPrompt.isNullOrBlank()) {
            viewModel.send(initialPrompt)
            onPromptConsumed()
        }
    }

    LaunchedEffect(uiState.messages.size) {
        if (uiState.messages.isNotEmpty()) {
            listState.animateScrollToItem(uiState.messages.lastIndex)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
            .navigationBarsPadding()
    ) {
        CoachHeader()

        // Net-new "very special" feature, not an RN port (see
        // DailyBriefing.kt's doc comment) — shown above the chat itself
        // (not gated behind an empty message history, which would only
        // ever show once) so it reads fresh on every visit, the way a
        // coach opens a conversation before you've said anything.
        uiState.dailyBriefing?.let { DailyBriefingCard(it) }

        if (uiState.messages.isEmpty()) {
            Box(modifier = Modifier.weight(1f)) {
                CoachZeroState(isPro = uiState.isPro, onQuickAction = viewModel::send, onUpgrade = onUpgrade)
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(uiState.messages, key = { it.id }) { message ->
                    MessageBubble(message = message)
                }
                if (uiState.isStreaming) {
                    item { StreamingIndicator() }
                }
            }
        }

        MessageInput(
            text = uiState.inputText,
            onTextChange = viewModel::updateInput,
            isLoading = uiState.isStreaming,
            onSend = { viewModel.send(uiState.inputText) }
        )
    }

    if (uiState.showProPrompt) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissProPrompt() },
            title = { Text("Pro Feature", color = RuvoColors.textPrimary) },
            text = { Text("Custom AI Coaching is available for Pro members. Try the Quick Actions for free, or upgrade for unlimited coaching!", color = RuvoColors.textSecondary) },
            confirmButton = {
                TextButton(onClick = { viewModel.dismissProPrompt(); onUpgrade() }) { Text("Upgrade", color = RuvoColors.lime) }
            },
            dismissButton = { TextButton(onClick = { viewModel.dismissProPrompt() }) { Text("Cancel", color = RuvoColors.textSecondary) } },
            containerColor = RuvoColors.surface,
        )
    }
}

@Composable
fun CoachHeader() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(RuvoColors.surface)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(Brush.linearGradient(listOf(Color(0xFF4F46E5), Color(0xFF7C3AED)))),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = Color.White, modifier = Modifier.size(22.dp))
        }
        Column {
            Text("RUVO Intelligence", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(RuvoColors.success))
                Text("Active Analysis", style = MaterialTheme.typography.labelSmall, color = RuvoColors.success)
            }
        }
    }
    Divider(color = RuvoColors.border, thickness = 1.dp)
}

// Net-new "very special" feature, not an RN port — see DailyBriefing.kt's
// doc comment. Deliberately its own quiet card, not a chat bubble: this is
// the coach's own opening read, not a reply to anything the user said.
@Composable
private fun DailyBriefingCard(briefing: DailyBriefing) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = RuvoColors.surfaceElev,
        modifier = Modifier.fillMaxWidth().padding(16.dp, 12.dp, 16.dp, 0.dp),
    ) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(briefing.emoji, style = MaterialTheme.typography.headlineSmall)
            Column {
                Text("Today's read", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                Text(briefing.message, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary)
            }
        }
    }
}

@Composable
private fun CoachZeroState(isPro: Boolean, onQuickAction: (String) -> Unit, onUpgrade: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(12.dp))
        Box(
            modifier = Modifier
                .size(76.dp)
                .clip(CircleShape)
                .background(Brush.linearGradient(listOf(Color(0xFF4F46E5), Color(0xFF7C3AED)))),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = Color.White, modifier = Modifier.size(34.dp))
        }
        Spacer(Modifier.height(20.dp))
        Text("Hello, Runner!", style = MaterialTheme.typography.headlineLarge, color = RuvoColors.textPrimary)
        Text(
            "I'm your personal AI coach — trained on your stats, runs, and goals.",
            style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp, start = 12.dp, end = 12.dp),
        )
        Spacer(Modifier.height(28.dp))

        Text("QUICK ACTIONS", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary, modifier = Modifier.align(Alignment.Start).padding(bottom = 12.dp))

        val actionColors = listOf(Color(0xFF4ADE80), Color(0xFF60A5FA), Color(0xFFF87171), Color(0xFFFBBF24))
        val actionIcons = listOf(Icons.Default.BarChart, Icons.Default.CalendarToday, Icons.Default.HealthAndSafety, Icons.Default.Restaurant)
        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            QUICK_ACTIONS.chunked(2).forEachIndexed { rowIndex, row ->
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    row.forEachIndexed { colIndex, (title, prompt) ->
                        val idx = rowIndex * 2 + colIndex
                        QuickActionCard(
                            title = title,
                            icon = actionIcons[idx % actionIcons.size],
                            color = actionColors[idx % actionColors.size],
                            modifier = Modifier.weight(1f),
                            onClick = { onQuickAction(prompt) },
                        )
                    }
                }
            }
        }

        if (!isPro) {
            Spacer(Modifier.height(20.dp))
            Surface(
                onClick = onUpgrade,
                shape = RoundedCornerShape(18.dp),
                color = Color(0xFF0D1A00),
                border = BorderStroke(1.dp, RuvoColors.lime.copy(alpha = 0.3f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(modifier = Modifier.size(40.dp).clip(CircleShape).background(RuvoColors.lime), contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.Bolt, contentDescription = null, tint = Color.Black, modifier = Modifier.size(18.dp))
                        }
                        Column {
                            Text("Unlock Full Coaching", style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary)
                            Text("Send unlimited custom messages", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                        }
                    }
                    Icon(Icons.Default.ChevronRight, contentDescription = null, tint = RuvoColors.lime)
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun QuickActionCard(title: String, icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        color = RuvoColors.surface,
        border = BorderStroke(1.dp, RuvoColors.border),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Box(
                modifier = Modifier.size(44.dp).clip(CircleShape).background(color.copy(alpha = 0.15f))
                    .border(1.dp, color.copy(alpha = 0.3f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.height(10.dp))
            Text(title, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary)
        }
    }
}

@Composable
fun MessageBubble(message: ChatMessage) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (message.role == MessageRole.User) Arrangement.End else Arrangement.Start,
        verticalAlignment = Alignment.Bottom
    ) {
        if (message.role == MessageRole.Assistant) {
            CoachAvatarSmall()
            Spacer(modifier = Modifier.width(8.dp))
        }
        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(
                    RoundedCornerShape(
                        topStart = 16.dp, topEnd = 16.dp,
                        bottomEnd = if (message.role == MessageRole.User) 4.dp else 16.dp,
                        bottomStart = if (message.role == MessageRole.Assistant) 4.dp else 16.dp,
                    )
                )
                .background(
                    if (message.role == MessageRole.User) RuvoColors.lime
                    else RuvoColors.surfaceElev
                )
                .border(
                    1.dp,
                    if (message.role == MessageRole.Assistant) RuvoColors.border else Color.Transparent,
                    RoundedCornerShape(16.dp)
                )
                .padding(horizontal = 14.dp, vertical = 10.dp)
        ) {
            if (message.role == MessageRole.Assistant) {
                MarkdownText(message.content)
            } else {
                Text(
                    text = message.content,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.Black,
                )
            }
        }
        if (message.role == MessageRole.User) {
            Spacer(modifier = Modifier.width(8.dp))
        }
    }
}

/** Minimal markdown renderer: bold (**text**), #/##/### headers, and "- "/"1. " list items. */
@Composable
private fun MarkdownText(content: String) {
    Column {
        content.split("\n").forEach { rawLine ->
            val line = rawLine.trim()
            when {
                line.isEmpty() -> Spacer(Modifier.height(6.dp))
                line.startsWith("### ") -> Text(inlineBold(line.removePrefix("### ")), style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary)
                line.startsWith("## ") -> Text(inlineBold(line.removePrefix("## ")), style = MaterialTheme.typography.titleMedium, color = RuvoColors.lime)
                line.startsWith("# ") -> Text(inlineBold(line.removePrefix("# ")), style = MaterialTheme.typography.titleLarge, color = RuvoColors.lime)
                line.startsWith("- ") || line.startsWith("• ") -> Row {
                    Text("•  ", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.lime)
                    Text(inlineBold(line.drop(2)), style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary)
                }
                Regex("^\\d+\\.\\s").containsMatchIn(line) -> {
                    val match = Regex("^(\\d+\\.)\\s").find(line)!!
                    Row {
                        Text(match.groupValues[1] + " ", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.lime)
                        Text(inlineBold(line.substring(match.range.last + 1)), style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary)
                    }
                }
                else -> Text(inlineBold(line), style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary)
            }
        }
    }
}

private fun inlineBold(text: String) = buildAnnotatedString {
    var remaining = text
    val boldRegex = Regex("\\*\\*(.+?)\\*\\*")
    while (remaining.isNotEmpty()) {
        val match = boldRegex.find(remaining)
        if (match == null) {
            append(remaining)
            break
        }
        append(remaining.substring(0, match.range.first))
        withStyle(SpanStyle(fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)) {
            append(match.groupValues[1])
        }
        remaining = remaining.substring(match.range.last + 1)
    }
}

@Composable
fun CoachAvatarSmall() {
    Box(
        modifier = Modifier
            .size(28.dp)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(Color(0xFF4F46E5), Color(0xFF7C3AED)))),
        contentAlignment = Alignment.Center
    ) {
        Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
    }
}

@Composable
fun StreamingIndicator() {
    var phase by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) {
        while (true) {
            kotlinx.coroutines.delay(400)
            phase = (phase + 1) % 3
        }
    }
    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        CoachAvatarSmall()
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(16.dp))
                .background(RuvoColors.surfaceElev)
                .padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            repeat(3) { i ->
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF7C3AED))
                        .scale(if (phase == i) 1.3f else 1f)
                )
            }
        }
    }
}

@Composable
fun MessageInput(
    text: String,
    onTextChange: (String) -> Unit,
    isLoading: Boolean,
    onSend: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(RuvoColors.surface)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        OutlinedTextField(
            value = text,
            onValueChange = onTextChange,
            modifier = Modifier.weight(1f),
            placeholder = { Text("Ask your AI coach...", color = RuvoColors.textTertiary) },
            maxLines = 5,
            shape = RoundedCornerShape(20.dp),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = RuvoColors.surfaceElev,
                unfocusedContainerColor = RuvoColors.surfaceElev,
                focusedBorderColor = RuvoColors.lime,
                unfocusedBorderColor = RuvoColors.border,
                focusedTextColor = RuvoColors.textPrimary,
                unfocusedTextColor = RuvoColors.textPrimary,
            )
        )
        val canSend = text.isNotBlank() && !isLoading
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(if (canSend) RuvoColors.lime else RuvoColors.border)
                .clickable(enabled = canSend) { onSend() },
            contentAlignment = Alignment.Center
        ) {
            Icon(
                if (isLoading) Icons.Default.Stop else Icons.Default.ArrowUpward,
                contentDescription = "Send",
                tint = if (canSend) Color.Black else RuvoColors.textTertiary,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}
