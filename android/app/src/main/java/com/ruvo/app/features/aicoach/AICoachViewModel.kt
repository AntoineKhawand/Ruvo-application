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
import com.ruvo.app.features.training.TrainingWorkout
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.UUID
import javax.inject.Inject
import kotlin.math.roundToInt

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

// Competitor-analysis Tier 1 #3 (Runna's "Not Feeling 100%"): the coach and
// the plan were two finished features that had never been introduced to each
// other. askGemini (functions/index.js) just tunnels `requestBody` straight
// to Gemini's generateContent REST endpoint, so real Gemini function-calling
// — not a keyword-matching hack — is achievable purely client-side: no
// Cloud Functions redeploy needed, since the proxy already forwards whatever
// shape of request body this sends. Scoped to two safe, reversible actions
// rather than a free-form plan rewrite the model could get wrong.
private val ADJUST_PLAN_TOOLS = listOf(
    mapOf(
        "functionDeclarations" to listOf(
            mapOf(
                "name" to "adjust_training_plan",
                "description" to "Adjusts the user's current week of their Ruvo training plan. Call this ONLY when the user clearly asks for an actual change to their schedule (soreness, fatigue, injury risk, no time, etc.) — not for general advice questions.",
                "parameters" to mapOf(
                    "type" to "OBJECT",
                    "properties" to mapOf(
                        "action" to mapOf(
                            "type" to "STRING",
                            "enum" to listOf("rest_today", "ease_this_week"),
                            "description" to "rest_today: mark only today's already-scheduled session as a rest day. ease_this_week: reduce the distance of every remaining non-rest session this week by about 30%.",
                        ),
                        "note" to mapOf(
                            "type" to "STRING",
                            "description" to "A short reason (under 12 words) to show the user why the plan changed.",
                        ),
                    ),
                    "required" to listOf("action"),
                ),
            )
        )
    )
)

data class AICoachUiState(
    val messages: List<ChatMessage> = emptyList(),
    val inputText: String = "",
    val isStreaming: Boolean = false,
    val isPro: Boolean = false,
    val showProPrompt: Boolean = false,
    val error: String? = null,
    // Net-new "very special" feature, not an RN port — see
    // DailyBriefing.kt's doc comment. Null until enough signals exist to
    // say anything (mirrors TrainingLoadStatus's own "not enough history"
    // null case).
    val dailyBriefing: DailyBriefing? = null,
)

@HiltViewModel
class AICoachViewModel @Inject constructor(
    private val functions: FirebaseFunctions,
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
    private val weatherService: com.ruvo.app.features.weather.WeatherService,
) : ViewModel() {

    private val _uiState = MutableStateFlow(AICoachUiState())
    val uiState: StateFlow<AICoachUiState> = _uiState.asStateFlow()

    private var systemContext: String = "You are Ruvo Coach, an elite personalized running coach inside the Ruvo app."

    init {
        loadHistory()
        loadProStatus()
        loadUserContext()
        loadDailyBriefing()
    }

    // Gathers the same categories of data AnalyticsViewModel/TrainingPlanViewModel
    // each already gather independently (this app has no shared repository
    // layer — every screen reads what it needs directly, same pattern
    // throughout), just enough of it here to compose one prioritized daily
    // read. Recovery Score (needs Health Connect) and segment PRs (a second
    // Firestore query) are deliberately left out of this first version —
    // see DailyBriefing.kt's doc comment.
    private fun loadDailyBriefing() {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            try {
                val doc = firestore.collection("users").document(uid).get().await()
                @Suppress("UNCHECKED_CAST")
                val runHistory = doc.data?.get("runHistory") as? List<Map<String, Any>> ?: emptyList()
                val runDates = runHistory.mapNotNull { r ->
                    (r["date"] as? String)?.let {
                        runCatching { java.time.Instant.parse(it).atZone(java.time.ZoneId.systemDefault()).toLocalDate() }.getOrNull()
                    }
                }
                val runsWithDistance = runHistory.mapNotNull { r ->
                    val date = (r["date"] as? String)?.let {
                        runCatching { java.time.Instant.parse(it).atZone(java.time.ZoneId.systemDefault()).toLocalDate() }.getOrNull()
                    } ?: return@mapNotNull null
                    val dist = (r["distance"] as? Number)?.toDouble() ?: return@mapNotNull null
                    date to dist
                }
                val trainingLoad = com.ruvo.app.features.analytics.computeTrainingLoad(runsWithDistance)

                @Suppress("UNCHECKED_CAST")
                val planMap = doc.get("trainingPlan") as? Map<String, Any>
                val missedSessions = if (planMap?.get("status") == "Active") {
                    @Suppress("UNCHECKED_CAST")
                    val weeksData = planMap["weeks"] as? List<Map<String, Any>>
                    @Suppress("UNCHECKED_CAST")
                    val week0Workouts = (weeksData?.firstOrNull()?.get("workouts") as? List<Map<String, Any>>)?.map { it.toTrainingWorkout() } ?: emptyList()
                    val weekMonday = java.time.LocalDate.now().with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))
                    com.ruvo.app.features.training.computeMissedWorkoutDays(week0Workouts, todayDayAbbrevForPlan(), weekMonday, runDates.toSet()).size
                } else 0

                val streakDays = computeStreakForBriefing(runDates.toSet())
                val weatherAdvice = weatherService.fetchCurrentWeather()?.let { weatherService.buildAdvice(it) }

                val briefing = composeDailyBriefing(trainingLoad, missedSessions, streakDays, weatherAdvice)
                _uiState.value = _uiState.value.copy(dailyBriefing = briefing)
            } catch (_: Exception) { /* briefing is a nice-to-have, never block the rest of the coach screen on it */ }
        }
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
                val userTurn = mapOf("role" to "user", "parts" to listOf(mapOf("text" to "$systemContext\n\nUser: $trimmed")))
                val requestBody = mapOf("contents" to listOf(userTurn), "tools" to ADJUST_PLAN_TOOLS)
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
                @Suppress("UNCHECKED_CAST")
                val functionCall = parts?.firstOrNull()?.get("functionCall") as? Map<String, Any>

                val reply = if (functionCall != null) {
                    // Model wants to change the plan — apply it for real, then
                    // send Gemini the function's result so the reply it speaks
                    // back to the user actually reflects what happened, rather
                    // than confidently narrating a change it never made.
                    @Suppress("UNCHECKED_CAST")
                    val args = functionCall["args"] as? Map<String, Any> ?: emptyMap()
                    val action = args["action"] as? String ?: ""
                    val note = args["note"] as? String ?: ""
                    val functionName = functionCall["name"] as? String ?: "adjust_training_plan"
                    val outcome = applyPlanAdjustment(uid, action, note)

                    val followUpBody = mapOf(
                        "contents" to listOf(
                            userTurn,
                            mapOf("role" to "model", "parts" to listOf(mapOf("functionCall" to functionCall))),
                            mapOf(
                                "role" to "function",
                                "parts" to listOf(mapOf("functionResponse" to mapOf("name" to functionName, "response" to mapOf("result" to outcome)))),
                            ),
                        ),
                        "tools" to ADJUST_PLAN_TOOLS,
                    )
                    try {
                        val followUpResult = functions.getHttpsCallable("askGemini")
                            .call(mapOf("requestBody" to followUpBody, "userMessage" to trimmed))
                            .await()
                        @Suppress("UNCHECKED_CAST")
                        val followUpData = followUpResult.data as? Map<String, Any>
                        @Suppress("UNCHECKED_CAST")
                        val followUpCandidates = followUpData?.get("candidates") as? List<Map<String, Any>>
                        @Suppress("UNCHECKED_CAST")
                        val followUpContent = followUpCandidates?.firstOrNull()?.get("content") as? Map<String, Any>
                        @Suppress("UNCHECKED_CAST")
                        val followUpParts = followUpContent?.get("parts") as? List<Map<String, Any>>
                        followUpParts?.firstOrNull()?.get("text") as? String ?: outcome
                    } catch (_: Exception) {
                        outcome // the plan change already applied; a failed narration call shouldn't hide that
                    }
                } else {
                    parts?.firstOrNull()?.get("text") as? String ?: "I'm not sure what to say."
                }

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

    // Mirrors TrainingPlanViewModel's own read/mutate/write shape exactly —
    // same trainingPlan map field, same weeks[]/workouts[] structure, and the
    // same one-shot "read then replace the whole trainingPlan field" write —
    // so TrainingPlanScreen's live snapshot listener there picks this up with
    // no changes on that end at all.
    private suspend fun applyPlanAdjustment(uid: String, action: String, note: String): String {
        return try {
            val doc = firestore.collection("users").document(uid).get().await()
            @Suppress("UNCHECKED_CAST")
            val planMap = doc.get("trainingPlan") as? Map<String, Any>
                ?: return "You don't have an active training plan yet, so there's nothing to adjust."
            @Suppress("UNCHECKED_CAST")
            val weeksData = planMap["weeks"] as? List<Map<String, Any>>
            if (weeksData.isNullOrEmpty()) return "You don't have an active training plan yet, so there's nothing to adjust."

            @Suppress("UNCHECKED_CAST")
            val week0Workouts = (weeksData[0]["workouts"] as? List<Map<String, Any>>)?.map { it.toTrainingWorkout() } ?: emptyList()

            val (updatedWorkouts, outcome) = when (action) {
                "rest_today" -> restTodayInWorkouts(week0Workouts, todayDayAbbrevForPlan(), note)
                "ease_this_week" -> easeWorkouts(week0Workouts, note)
                else -> return "I'm not able to make that kind of change yet."
            }

            val updatedWeek0 = weeksData[0] + mapOf("workouts" to updatedWorkouts.map { it.toFirestoreMap() })
            val updatedPlanMap = planMap + mapOf("weeks" to (listOf(updatedWeek0) + weeksData.drop(1)))
            firestore.collection("users").document(uid).update("trainingPlan", updatedPlanMap).await()
            outcome
        } catch (_: Exception) {
            "I couldn't update your plan just now — please try again in a moment."
        }
    }
}

private fun Map<String, Any>.toTrainingWorkout() = TrainingWorkout(
    day = this["day"] as? String ?: "",
    title = this["title"] as? String ?: "",
    detail = this["detail"] as? String ?: "",
    icon = this["icon"] as? String ?: "",
    isRest = this["isRest"] as? Boolean ?: false,
)

private fun TrainingWorkout.toFirestoreMap() = mapOf(
    "day" to day, "title" to title, "detail" to detail, "icon" to icon, "isRest" to isRest,
)

// Same 3-letter day abbreviation TrainingPlanScreen's own todayDayAbbrev()
// computes, duplicated locally rather than made cross-package-public purely
// for this one call — small enough that a shared util wasn't worth the extra
// indirection (same tradeoff already made for duration-string parsing
// elsewhere in this app).
internal fun todayDayAbbrevForPlan(): String {
    val name = java.time.LocalDate.now().dayOfWeek.name
    return name.substring(0, 1) + name.substring(1, 3).lowercase()
}

// Pure so the "which workout (if any) gets touched, and what does the coach
// say about it" branching is unit testable without a live Firestore doc —
// same reasoning as decidePaceAlert/nextGuidedRunLine elsewhere in this app.
internal fun restTodayInWorkouts(workouts: List<TrainingWorkout>, today: String, note: String): Pair<List<TrainingWorkout>, String> {
    var applied = false
    val updated = workouts.map { workout ->
        if (!applied && workout.day == today && !workout.isRest) {
            applied = true
            workout.copy(
                title = "Rest Day",
                detail = note.ifBlank { "Adjusted by your AI Coach." },
                isRest = true,
            )
        } else workout
    }
    val outcome = if (applied) {
        "Done — I've marked today's session as a rest day. Get some real rest and pick the plan back up tomorrow."
    } else {
        "You don't have a scheduled session today, so there's nothing to rest from."
    }
    return updated to outcome
}

private val EASE_DISTANCE_REGEX = Regex("""(\d+(?:\.\d+)?)\s*km""")
private const val EASE_MULTIPLIER = 0.7

internal fun easeWorkouts(workouts: List<TrainingWorkout>, note: String): Pair<List<TrainingWorkout>, String> {
    var count = 0
    val updated = workouts.map { workout ->
        if (workout.isRest || workout.title.startsWith("Eased: ")) return@map workout
        val match = EASE_DISTANCE_REGEX.find(workout.detail) ?: return@map workout
        val easedKm = (match.groupValues[1].toDouble() * EASE_MULTIPLIER * 10).roundToInt() / 10.0
        val easedLabel = if (easedKm == easedKm.roundToInt().toDouble()) "${easedKm.roundToInt()}km" else "${easedKm}km"
        count++
        workout.copy(
            title = "Eased: ${workout.title}",
            detail = workout.detail.replaceRange(match.range, easedLabel),
        )
    }
    val outcome = if (count > 0) {
        "Done — I've eased the rest of this week's sessions by about 30%${if (note.isNotBlank()) " ($note)" else ""}. Listen to your body and push the pace back up once you're feeling normal."
    } else {
        "This week's plan is already rest days or too light to ease further."
    }
    return updated to outcome
}
