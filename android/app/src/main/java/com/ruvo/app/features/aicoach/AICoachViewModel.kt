package com.ruvo.app.features.aicoach

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.functions.FirebaseFunctions
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.UUID
import javax.inject.Inject

enum class MessageRole { User, Assistant }

data class ChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val role: MessageRole,
    val content: String,
)

data class AICoachUiState(
    val messages: List<ChatMessage> = listOf(
        ChatMessage(
            role = MessageRole.Assistant,
            content = "Hi! I'm your RUVO AI Coach, powered by Gemini 2.5 Flash. I've analyzed your recent training data. Ask me anything — pace improvements, training plans, recovery advice, or race strategy."
        )
    ),
    val inputText: String = "",
    val isStreaming: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class AICoachViewModel @Inject constructor(
    private val functions: FirebaseFunctions,
) : ViewModel() {

    private val _uiState = MutableStateFlow(AICoachUiState())
    val uiState: StateFlow<AICoachUiState> = _uiState.asStateFlow()

    fun updateInput(text: String) {
        _uiState.value = _uiState.value.copy(inputText = text)
    }

    fun send(text: String = _uiState.value.inputText) {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || _uiState.value.isStreaming) return

        val userMsg = ChatMessage(role = MessageRole.User, content = trimmed)
        _uiState.value = _uiState.value.copy(
            messages = _uiState.value.messages + userMsg,
            inputText = "",
            isStreaming = true,
            error = null,
        )

        viewModelScope.launch {
            try {
                val history = _uiState.value.messages.dropLast(1).map {
                    mapOf("role" to if (it.role == MessageRole.User) "user" else "model", "content" to it.content)
                }
                val result = functions.getHttpsCallable("aiCoach")
                    .call(mapOf("message" to trimmed, "history" to history))
                    .await()

                @Suppress("UNCHECKED_CAST")
                val data = result.data as? Map<String, Any>
                val reply = data?.get("reply") as? String ?: "Sorry, I couldn't understand that."

                val assistantMsg = ChatMessage(role = MessageRole.Assistant, content = reply)
                _uiState.value = _uiState.value.copy(
                    messages = _uiState.value.messages + assistantMsg,
                    isStreaming = false,
                )
            } catch (e: Exception) {
                val errorMsg = ChatMessage(
                    role = MessageRole.Assistant,
                    content = "Sorry, I couldn't connect right now. Please try again."
                )
                _uiState.value = _uiState.value.copy(
                    messages = _uiState.value.messages + errorMsg,
                    isStreaming = false,
                )
            }
        }
    }
}
