package com.ruvo.app.features.aicoach

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.functions.FirebaseFunctions
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.getCustomerInfoWith
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

val QUICK_ACTIONS = listOf(
    "Analyze Last Run" to "📊 Analyze my last run and give me 3 tips.",
    "Generate Plan" to "📅 Create a training plan for next week.",
    "Recovery Check" to "🩹 My legs are sore. What should I do?",
    "Fueling Tips" to "🍎 What should I eat before my 10k?",
)

data class AICoachUiState(
    val messages: List<ChatMessage> = emptyList(),
    val inputText: String = "",
    val isStreaming: Boolean = false,
    val isPro: Boolean = false,
    val showProPrompt: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class AICoachViewModel @Inject constructor(
    private val functions: FirebaseFunctions,
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(AICoachUiState())
    val uiState: StateFlow<AICoachUiState> = _uiState.asStateFlow()

    private var systemContext: String = "You are Ruvo Coach, an elite personalized running coach inside the Ruvo app."

    init {
        loadHistory()
        loadProStatus()
        loadUserContext()
    }

    private fun loadHistory() {
        val uid = auth.currentUser?.uid ?: return
        firestore.collection("users").document(uid).collection("coach_messages")
            .orderBy("timestamp", Query.Direction.ASCENDING)
            .limit(50)
            .addSnapshotListener { snap, _ ->
                val msgs = snap?.documents?.mapNotNull { doc ->
                    val roleStr = doc.getString("sender") ?: return@mapNotNull null
                    ChatMessage(
                        id = doc.id,
                        role = if (roleStr == "user") MessageRole.User else MessageRole.Assistant,
                        content = doc.getString("text") ?: "",
                    )
                } ?: emptyList()
                _uiState.value = _uiState.value.copy(messages = msgs)
            }
    }

    private fun loadProStatus() {
        Purchases.sharedInstance.getCustomerInfoWith(
            onError = {},
            onSuccess = { customerInfo ->
                val isPro = customerInfo.entitlements["pro"]?.isActive == true
                _uiState.value = _uiState.value.copy(isPro = isPro)
            }
        )
    }

    private fun loadUserContext() {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            try {
                val userDoc = firestore.collection("users").document(uid).get().await()
                val name = userDoc.getString("name") ?: userDoc.getString("displayName") ?: "Runner"
                val goal = userDoc.getString("goal") ?: "General fitness"
                val weeklyGoal = userDoc.getDouble("weeklyGoal") ?: 0.0
                val weeklyDistance = userDoc.getDouble("weeklyDistance") ?: 0.0
                val activeGoal = userDoc.get("trainingPlan.activeGoal") as? String ?: goal

                // The real saveRunActivity Cloud Function (functions/index.js) writes
                // each finished run as one entry in the users/{uid}.runHistory ARRAY
                // field — there is no users/{uid}/runs subcollection (see
                // RN_ANDROID_PORT_MAPPING.md's "Known Data-Layer Bugs" section). The
                // coach's "last 5 runs" context was silently always empty before.
                @Suppress("UNCHECKED_CAST")
                val runHistory = userDoc.data?.get("runHistory") as? List<Map<String, Any>> ?: emptyList()
                val recentRuns = runHistory
                    .sortedByDescending { r ->
                        (r["date"] as? String)?.let { runCatching { java.time.Instant.parse(it) }.getOrNull() } ?: java.time.Instant.EPOCH
                    }
                    .take(5)
                val recentSummary = if (recentRuns.isEmpty()) "No recent runs" else recentRuns.joinToString("; ") { r ->
                    val dist = (r["distance"] as? Number)?.toDouble() ?: 0.0
                    val durParts = (r["duration"] as? String)?.split(":")?.mapNotNull { it.toLongOrNull() }
                    val durSec = when (durParts?.size) {
                        2 -> durParts[0] * 60 + durParts[1]
                        3 -> durParts[0] * 3600 + durParts[1] * 60 + durParts[2]
                        else -> 0L
                    }
                    val paceSec = if (dist > 0) (durSec / dist).toLong() else 0L
                    val mins = durSec / 60
                    val secs = durSec % 60
                    val paceMin = paceSec / 60
                    val paceRem = paceSec % 60
                    String.format("%.1fkm in %d:%02d (pace: %d:%02d)", dist, mins, secs, paceMin, paceRem)
                }

                systemContext = """
                    You are **Ruvo Coach**, an elite personalized running coach inside the Ruvo app.

                    ## User Profile
                    - Name: $name
                    - Goal: $goal
                    - Active Goal: $activeGoal
                    - Weekly Distance: ${String.format("%.1f", weeklyDistance)}km / ${weeklyGoal}km goal

                    ## Recent Runs
                    $recentSummary

                    ## Response Rules
                    1. Format ALL responses in markdown — use bold, bullet lists, numbered lists, and headers.
                    2. Be encouraging, data-driven, and concise. Keep responses under 200 words.
                    3. Use emojis sparingly for warmth.
                """.trimIndent()
            } catch (_: Exception) { /* fall back to the generic system context */ }
        }
    }

    fun updateInput(text: String) {
        _uiState.value = _uiState.value.copy(inputText = text)
    }

    fun dismissProPrompt() {
        _uiState.value = _uiState.value.copy(showProPrompt = false)
    }

    fun send(text: String = _uiState.value.inputText) {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || _uiState.value.isStreaming) return

        val isQuickAction = QUICK_ACTIONS.any { it.second == trimmed }
        if (!_uiState.value.isPro && !isQuickAction) {
            _uiState.value = _uiState.value.copy(showProPrompt = true)
            return
        }

        val uid = auth.currentUser?.uid ?: return
        _uiState.value = _uiState.value.copy(inputText = "", isStreaming = true, error = null)
        val messagesRef = firestore.collection("users").document(uid).collection("coach_messages")
        messagesRef.add(mapOf("text" to trimmed, "sender" to "user", "timestamp" to FieldValue.serverTimestamp()))

        viewModelScope.launch {
            try {
                val requestBody = mapOf(
                    "contents" to listOf(
                        mapOf("parts" to listOf(mapOf("text" to "$systemContext\n\nUser: $trimmed")))
                    )
                )
                val result = functions.getHttpsCallable("askGemini")
                    .call(mapOf("requestBody" to requestBody, "userMessage" to trimmed))
                    .await()

                @Suppress("UNCHECKED_CAST")
                val data = result.data as? Map<String, Any>
                @Suppress("UNCHECKED_CAST")
                val candidates = data?.get("candidates") as? List<Map<String, Any>>
                @Suppress("UNCHECKED_CAST")
                val content = candidates?.firstOrNull()?.get("content") as? Map<String, Any>
                @Suppress("UNCHECKED_CAST")
                val parts = content?.get("parts") as? List<Map<String, Any>>
                val reply = parts?.firstOrNull()?.get("text") as? String ?: "I'm not sure what to say."

                messagesRef.add(mapOf("text" to reply, "sender" to "ai", "timestamp" to FieldValue.serverTimestamp()))
            } catch (e: Exception) {
                messagesRef.add(mapOf(
                    "text" to "I'm having trouble connecting right now. Try again later.",
                    "sender" to "ai",
                    "timestamp" to FieldValue.serverTimestamp(),
                ))
            } finally {
                _uiState.value = _uiState.value.copy(isStreaming = false)
            }
        }
    }
}
