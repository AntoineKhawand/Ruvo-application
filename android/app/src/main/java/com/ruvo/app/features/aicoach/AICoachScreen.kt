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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ruvo.app.designsystem.theme.*

@Composable
fun AICoachScreen(viewModel: AICoachViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()

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
        // Header
        CoachHeader()

        // Messages
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

        // Suggested prompts when empty
        if (uiState.messages.size <= 1) {
            SuggestedPrompts(onSelect = viewModel::send)
        }

        // Input bar
        MessageInput(
            text = uiState.inputText,
            onTextChange = viewModel::updateInput,
            isLoading = uiState.isStreaming,
            onSend = { viewModel.send(uiState.inputText) }
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
        Text(
            text = message.content,
            style = MaterialTheme.typography.bodyMedium,
            color = if (message.role == MessageRole.User) Color.Black else RuvoColors.textPrimary,
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
        )
        if (message.role == MessageRole.User) {
            Spacer(modifier = Modifier.width(8.dp))
        }
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
fun SuggestedPrompts(onSelect: (String) -> Unit) {
    val prompts = listOf(
        "Analyze my recent training",
        "Create a 10K training plan",
        "Why is my pace slower this week?",
        "Optimal heart rate zones for fat burning"
    )
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Suggested", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(prompts) { prompt ->
                Surface(
                    modifier = Modifier.clickable { onSelect(prompt) },
                    shape = CircleShape,
                    color = RuvoColors.surface,
                    border = BorderStroke(1.dp, RuvoColors.border)
                ) {
                    Text(
                        text = prompt,
                        style = MaterialTheme.typography.bodySmall,
                        color = RuvoColors.textPrimary,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
                    )
                }
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
