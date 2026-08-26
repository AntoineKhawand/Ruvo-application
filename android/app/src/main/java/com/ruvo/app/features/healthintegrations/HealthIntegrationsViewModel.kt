package com.ruvo.app.features.healthintegrations

import android.content.Context
import androidx.lifecycle.ViewModel
import com.ruvo.app.BuildConfig
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class HealthIntegrationsUiState(
    // Health Connect
    val isHealthConnectAvailable: Boolean = false,
    // True only once the user has actually granted the read permissions —
    // distinct from isHealthConnectAvailable (which just means the Health
    // Connect app/SDK is installed on the device). Previously the "Connected"
    // chip and the whole metrics section were driven by isHealthConnectAvailable
    // alone, so they showed as "Connected" with real-looking (all-zero) cards
    // for a user who had never granted anything, and the "Connect" button never
    // actually launched the OS permission dialog — see HealthConnectManager.kt.
    val isHealthConnectConnected: Boolean = false,
    val todaySteps: Int = 0,
    val weeklySteps: Int = 0,
    val weeklyActiveDays: Int = 0,
    val currentHeartRate: Int = 0,
    val restingHeartRate: Int = 0,
    val maxHeartRate: Int = 0,
    val todayCalories: Int = 0,
    val lastNightSleepHours: Double = 0.0,
    val vo2max: Double = 0.0,
    // Oura
    val isOuraConnected: Boolean = false,
    val ouraReadiness: Int = 0,
    val ouraSleepScore: Int = 0,
    val ouraActivity: Int = 0,
    val ouraHrv: Int = 0,
    // WHOOP
    val isWhoopConnected: Boolean = false,
    val whoopRecovery: Int = 0,
    val whoopStrain: Double = 0.0,
    val whoopSleepScore: Int = 0,
)

@HiltViewModel
class HealthIntegrationsViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val healthConnectManager: HealthConnectManager,
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HealthIntegrationsUiState())
    val uiState: StateFlow<HealthIntegrationsUiState> = _uiState.asStateFlow()

    // Exposed so the Screen's rememberLauncherForActivityResult(
    // PermissionController.createRequestPermissionResultContract()) knows what
    // to request — same pattern RunTrackingScreen.kt already uses for the other
    // HealthConnectManager. Only the Activity-scoped launcher can actually show
    // the OS permission dialog; the ViewModel/Manager cannot do this itself.
    val requiredPermissions: Set<String> get() = healthConnectManager.requiredPermissions

    fun refresh() {
        viewModelScope.launch {
            val isAvailable = healthConnectManager.isAvailable()
            val isConnected = isAvailable && healthConnectManager.hasAllPermissions()
            _uiState.value = _uiState.value.copy(
                isHealthConnectAvailable = isAvailable,
                isHealthConnectConnected = isConnected,
            )
            if (isConnected) {
                loadHealthConnectData()
            }
            loadOauthStatus()
        }
    }

    private suspend fun loadHealthConnectData() {
        try {
            val steps = healthConnectManager.fetchSteps()
            val hr = healthConnectManager.fetchLatestHeartRate()
            val sleep = healthConnectManager.fetchSleepHours()
            val calories = healthConnectManager.fetchTodayCalories()
            val restingHr = healthConnectManager.fetchRestingHeartRate()
            val maxRunHr = healthConnectManager.fetchMaxRunHeartRate()
            val weekly = healthConnectManager.fetchWeeklyStepsSummary()
            _uiState.value = _uiState.value.copy(
                todaySteps = steps.toInt(),
                currentHeartRate = hr.toInt(),
                lastNightSleepHours = sleep,
                todayCalories = calories,
                restingHeartRate = restingHr,
                maxHeartRate = maxRunHr,
                weeklySteps = weekly.totalSteps,
                weeklyActiveDays = weekly.activeDays,
            )
        } catch (_: Exception) {}
    }

    private suspend fun loadOauthStatus() {
        val uid = auth.currentUser?.uid ?: return
        try {
            val doc = firestore.collection("users").document(uid)
                .collection("integrations").document("oauth").get().await()
            val data = doc.data ?: return
            _uiState.value = _uiState.value.copy(
                isOuraConnected = data.containsKey("oura_access_token") && (data["oura_access_token"] as? String)?.isNotEmpty() == true,
                isWhoopConnected = data.containsKey("whoop_access_token") && (data["whoop_access_token"] as? String)?.isNotEmpty() == true,
                ouraReadiness = (data["oura_readiness"] as? Long ?: 0L).toInt(),
                ouraSleepScore = (data["oura_sleep_score"] as? Long ?: 0L).toInt(),
                ouraActivity = (data["oura_activity_score"] as? Long ?: 0L).toInt(),
                ouraHrv = (data["oura_hrv"] as? Long ?: 0L).toInt(),
                whoopRecovery = (data["whoop_recovery"] as? Long ?: 0L).toInt(),
                whoopStrain = data["whoop_strain"] as? Double ?: 0.0,
                whoopSleepScore = (data["whoop_sleep_score"] as? Long ?: 0L).toInt(),
            )
        } catch (_: Exception) {}
    }

    fun connectOura() {
        // Launches the Oura OAuth flow via custom tab / deep link
        // The OAuthCallbackActivity handles the callback and stores tokens in Firestore
        val authUrl = OuraOAuthHelper.buildAuthUrl()
        val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(authUrl))
        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun connectWhoop() {
        val authUrl = WhoopOAuthHelper.buildAuthUrl()
        val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(authUrl))
        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }
}

// OAuth URL builders — real client IDs go in local.properties / BuildConfig
object OuraOAuthHelper {
    private const val CLIENT_ID = BuildConfig.OURA_CLIENT_ID
    private const val REDIRECT_URI = "com.ruvo.app://oauth/oura"
    private const val SCOPES = "daily heartrate workout personal session"

    fun buildAuthUrl(): String =
        "https://cloud.ouraring.com/oauth/authorize" +
        "?response_type=code" +
        "&client_id=$CLIENT_ID" +
        "&redirect_uri=${android.net.Uri.encode(REDIRECT_URI)}" +
        "&scope=${android.net.Uri.encode(SCOPES)}"
}

object WhoopOAuthHelper {
    private const val CLIENT_ID = BuildConfig.WHOOP_CLIENT_ID
    private const val REDIRECT_URI = "com.ruvo.app://oauth/whoop"
    private const val SCOPES = "read:recovery read:cycles read:sleep read:workout read:body_measurement offline"

    fun buildAuthUrl(): String =
        "https://api.prod.whoop.com/oauth/oauth2/auth" +
        "?response_type=code" +
        "&client_id=$CLIENT_ID" +
        "&redirect_uri=${android.net.Uri.encode(REDIRECT_URI)}" +
        "&scope=${android.net.Uri.encode(SCOPES)}"
}
