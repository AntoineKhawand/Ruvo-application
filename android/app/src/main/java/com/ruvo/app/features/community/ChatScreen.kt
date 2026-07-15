package com.ruvo.app.features.community

import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

data class ChatMessage(
    val id: String,
    val text: String,
    val senderId: String,
    val timestampMs: Long,
    val isMe: Boolean,
)

data class ChatUiState(
    val messages: List<ChatMessage> = emptyList(),
    val partnerName: String = "",
    val isSending: Boolean = false,
    val isLoading: Boolean = true,
)

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()
    private var chatId: String = ""

    fun init(partnerId: String) {
        val myUid = auth.currentUser?.uid ?: return
        chatId = listOf(myUid, partnerId).sorted().joinToString("_")

        viewModelScope.launch {
            // Load partner info
            try {
                val doc = firestore.collection("users").document(partnerId).get().await()
                val name = doc.getString("displayName") ?: doc.getString("name") ?: "Runner"
                _uiState.update { it.copy(partnerName = name) }
            } catch (_: Exception) {}

            // Listen to messages
            firestore.collection("chats").document(chatId).collection("messages")
                .orderBy("timestamp", Query.Direction.ASCENDING)
                .limit(100)
                .addSnapshotListener { snap, _ ->
                    val msgs = snap?.documents?.map { doc ->
                        val data = doc.data ?: emptyMap<String, Any>()
                        val ts = (data["timestamp"] as? com.google.firebase.Timestamp)?.toDate()?.time ?: 0L
                        ChatMessage(
                            id = doc.id,
                            text = data["text"] as? String ?: "",
                            senderId = data["senderId"] as? String ?: "",
                            timestampMs = ts,
                            isMe = (data["senderId"] as? String) == myUid,
                        )
                    } ?: emptyList()
                    _uiState.update { it.copy(messages = msgs, isLoading = false) }
                }
        }
    }

    fun sendMessage(text: String) {
        val myUid = auth.currentUser?.uid ?: return
        if (text.isBlank() || chatId.isBlank()) return
        viewModelScope.launch {
            _uiState.update { it.copy(isSending = true) }
            try {
                firestore.collection("chats").document(chatId).collection("messages").add(
                    mapOf(
                        "text" to text.trim(),
                        "senderId" to myUid,
                        "timestamp" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                    )
                ).await()
            } catch (_: Exception) {
            } finally {
                _uiState.update { it.copy(isSending = false) }
            }
        }
    }

    fun clearChat() {
        if (chatId.isBlank()) return
        viewModelScope.launch {
            try {
                val snap = firestore.collection("chats").document(chatId).collection("messages").get().await()
                val batch = firestore.batch()
                snap.documents.forEach { batch.delete(it.reference) }
                batch.commit().await()
            } catch (_: Exception) {}
        }
    }

    fun blockPartner(partnerId: String) {
        val myUid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            try {
                firestore.collection("users").document(myUid)
                    .update("blocked", com.google.firebase.firestore.FieldValue.arrayUnion(partnerId)).await()
            } catch (_: Exception) {}
        }
    }
}

private val timeFormat = SimpleDateFormat("h:mm a", Locale.getDefault())

@Composable
fun ChatScreen(
    partnerId: String,
    onBack: () -> Unit = {},
    onBlocked: () -> Unit = onBack,
    viewModel: ChatViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var inputText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    var showMenu by remember { mutableStateOf(false) }
    var showClearConfirm by remember { mutableStateOf(false) }
    var showBlockConfirm by remember { mutableStateOf(false) }

    LaunchedEffect(partnerId) { viewModel.init(partnerId) }

    LaunchedEffect(uiState.messages.size) {
        if (uiState.messages.isNotEmpty()) {
            listState.animateScrollToItem(uiState.messages.size - 1)
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
    Column(modifier = Modifier.fillMaxSize().background(RuvoColors.background)) {
        // Header
        Surface(color = RuvoColors.surface, shadowElevation = 2.dp) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary) }
                Box(
                    modifier = Modifier.size(38.dp).clip(CircleShape).background(RuvoColors.surfaceElev),
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Default.Person, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(20.dp)) }
                Column(modifier = Modifier.weight(1f)) {
                    Text(uiState.partnerName.ifBlank { "Chat" }, style = MaterialTheme.typography.titleMedium, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
                    Text("Online", style = MaterialTheme.typography.labelSmall, color = RuvoColors.lime)
                }
                Box {
                    IconButton(onClick = { showMenu = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "More options", tint = RuvoColors.textPrimary)
                    }
                    DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                        DropdownMenuItem(
                            text = { Text("Clear Chat") },
                            leadingIcon = { Icon(Icons.Default.Delete, contentDescription = null) },
                            onClick = { showMenu = false; showClearConfirm = true },
                        )
                        DropdownMenuItem(
                            text = { Text("Block User", color = RuvoColors.error) },
                            leadingIcon = { Icon(Icons.Default.Block, contentDescription = null, tint = RuvoColors.error) },
                            onClick = { showMenu = false; showBlockConfirm = true },
                        )
                    }
                }
            }
        }

        if (uiState.isLoading) {
            Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = RuvoColors.lime) }
        } else if (uiState.messages.isEmpty()) {
            Column(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Icon(Icons.Default.Chat, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(50.dp))
                Spacer(Modifier.height(10.dp))
                Text("No messages yet.", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textTertiary)
                Text("Say hello to start the conversation!", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f).padding(horizontal = 12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
                contentPadding = PaddingValues(vertical = 12.dp),
            ) {
                items(uiState.messages, key = { it.id }) { msg ->
                    MessageBubble(msg = msg)
                }
            }
        }

        // Input bar
        Surface(color = RuvoColors.surface, shadowElevation = 4.dp) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Message…", color = RuvoColors.textTertiary) },
                    maxLines = 4,
                    shape = RoundedCornerShape(24.dp),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = RuvoColors.lime,
                        unfocusedBorderColor = RuvoColors.border,
                        focusedContainerColor = RuvoColors.surfaceElev,
                        unfocusedContainerColor = RuvoColors.surfaceElev,
                        focusedTextColor = RuvoColors.textPrimary,
                        unfocusedTextColor = RuvoColors.textPrimary,
                    ),
                )
                IconButton(
                    onClick = { if (inputText.isNotBlank()) { viewModel.sendMessage(inputText); inputText = "" } },
                    enabled = inputText.isNotBlank() && !uiState.isSending,
                    modifier = Modifier.size(48.dp).clip(CircleShape).background(if (inputText.isNotBlank()) RuvoColors.lime else RuvoColors.surfaceElev),
                ) {
                    if (uiState.isSending) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.Black, strokeWidth = 2.dp)
                    else Icon(Icons.Default.Send, contentDescription = "Send", tint = if (inputText.isNotBlank()) Color.Black else RuvoColors.textTertiary)
                }
            }
        }
    }

        if (showClearConfirm) {
            AlertDialog(
                onDismissRequest = { showClearConfirm = false },
                title = { Text("Clear Chat?") },
                text = { Text("This removes your messages. Continue?") },
                confirmButton = {
                    TextButton(onClick = { showClearConfirm = false; viewModel.clearChat() }) {
                        Text("Clear", color = RuvoColors.error)
                    }
                },
                dismissButton = { TextButton(onClick = { showClearConfirm = false }) { Text("Cancel", color = RuvoColors.textTertiary) } },
                containerColor = RuvoColors.surface,
                titleContentColor = RuvoColors.textPrimary,
                textContentColor = RuvoColors.textSecondary,
            )
        }

        if (showBlockConfirm) {
            AlertDialog(
                onDismissRequest = { showBlockConfirm = false },
                title = { Text("Block User?") },
                text = { Text("You won't receive messages from them.") },
                confirmButton = {
                    TextButton(onClick = { showBlockConfirm = false; viewModel.blockPartner(partnerId); onBlocked() }) {
                        Text("Block", color = RuvoColors.error)
                    }
                },
                dismissButton = { TextButton(onClick = { showBlockConfirm = false }) { Text("Cancel", color = RuvoColors.textTertiary) } },
                containerColor = RuvoColors.surface,
                titleContentColor = RuvoColors.textPrimary,
                textContentColor = RuvoColors.textSecondary,
            )
        }
    }
}

@Composable
private fun MessageBubble(msg: ChatMessage) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (msg.isMe) Arrangement.End else Arrangement.Start,
    ) {
        Column(
            horizontalAlignment = if (msg.isMe) Alignment.End else Alignment.Start,
            modifier = Modifier.widthIn(max = 280.dp),
        ) {
            Surface(
                shape = RoundedCornerShape(
                    topStart = 18.dp, topEnd = 18.dp,
                    bottomStart = if (msg.isMe) 18.dp else 4.dp,
                    bottomEnd = if (msg.isMe) 4.dp else 18.dp,
                ),
                color = if (msg.isMe) RuvoColors.lime else RuvoColors.surface,
            ) {
                Text(
                    msg.text,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (msg.isMe) Color.Black else RuvoColors.textPrimary,
                )
            }
            Text(
                timeFormat.format(Date(msg.timestampMs)),
                style = MaterialTheme.typography.bodySmall,
                color = RuvoColors.textTertiary,
                fontSize = 10.sp,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
            )
        }
    }
}
