package com.ruvo.app.features.healthintegrations

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

private data class DeviceInfo(
    val id: String,
    val name: String,
    val brand: String,
    val description: String,
    val emoji: String,
    val accentColor: Color,
)

private val DEVICES = listOf(
    DeviceInfo("whoop", "WHOOP 4.0", "WHOOP", "Continuous HRV, recovery, and strain tracking", "💪", Color(0xFF00E0C7)),
    DeviceInfo("oura", "Oura Ring Gen 3", "Oura", "Sleep, readiness, and activity from your ring", "💍", Color(0xFF9C8EFF)),
    DeviceInfo("garmin", "Garmin Connect", "Garmin", "Sync runs and workouts from any Garmin device", "⌚", Color(0xFF00B4D8)),
    DeviceInfo("polar", "Polar Flow", "Polar", "HR zones, training load, and recovery from Polar watches", "❤️", Color(0xFFE53E3E)),
    DeviceInfo("apple_health", "Apple Health", "Apple", "Steps, heart rate, and workouts from your iPhone", "🍎", Color(0xFFFF5F6D)),
    DeviceInfo("google_fit", "Google Fit", "Google", "Activity, heart rate, and health data from Android", "🏃", Color(0xFF4CAF50)),
)

data class ConnectedDevicesUiState(
    val connectedIds: Set<String> = emptySet(),
    val isLoading: Boolean = true,
)

@HiltViewModel
class ConnectedDevicesViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ConnectedDevicesUiState())
    val uiState: StateFlow<ConnectedDevicesUiState> = _uiState.asStateFlow()

    init { load() }

    private fun load() {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            try {
                val doc = firestore.collection("users").document(uid).get().await()
                @Suppress("UNCHECKED_CAST")
                val connected = ((doc.data?.get("connectedDevices") as? List<String>) ?: emptyList()).toSet()
                _uiState.value = ConnectedDevicesUiState(connectedIds = connected, isLoading = false)
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }

    fun toggleDevice(deviceId: String) {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: return@launch
            val isConnected = deviceId in _uiState.value.connectedIds
            val op = if (isConnected)
                com.google.firebase.firestore.FieldValue.arrayRemove(deviceId)
            else
                com.google.firebase.firestore.FieldValue.arrayUnion(deviceId)
            try {
                firestore.collection("users").document(uid).update("connectedDevices", op).await()
                _uiState.update { cur ->
                    val updated = if (isConnected) cur.connectedIds - deviceId else cur.connectedIds + deviceId
                    cur.copy(connectedIds = updated)
                }
            } catch (_: Exception) {}
        }
    }
}

@Composable
fun ConnectedDevicesScreen(
    onBack: () -> Unit = {},
    viewModel: ConnectedDevicesViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier.fillMaxSize().background(RuvoColors.background).verticalScroll(rememberScrollState()),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary) }
            Text("Connected Devices", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
        }

        Text(
            "Connect your wearables and health apps to enrich your RUVO experience with real-time health data.",
            style = MaterialTheme.typography.bodyMedium,
            color = RuvoColors.textSecondary,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
        )

        Spacer(Modifier.height(12.dp))

        if (uiState.isLoading) {
            Box(modifier = Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = RuvoColors.lime) }
        } else {
            Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                DEVICES.forEach { device ->
                    val isConnected = device.id in uiState.connectedIds
                    DeviceCard(device = device, isConnected = isConnected, onToggle = { viewModel.toggleDevice(device.id) })
                }
            }
        }

        Spacer(Modifier.height(40.dp))

        // Data note
        Surface(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            shape = RoundedCornerShape(14.dp),
            color = RuvoColors.surfaceElev,
        ) {
            Row(modifier = Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
                Icon(Icons.Default.Info, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(18.dp))
                Text(
                    "RUVO only reads health data — we never write back to your devices. All data is encrypted and stored securely.",
                    style = MaterialTheme.typography.bodySmall,
                    color = RuvoColors.textTertiary,
                )
            }
        }

        Spacer(Modifier.height(80.dp))
    }
}

@Composable
private fun DeviceCard(device: DeviceInfo, isConnected: Boolean, onToggle: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = RuvoColors.surface,
        border = BorderStroke(if (isConnected) 1.5.dp else 1.dp, if (isConnected) device.accentColor.copy(alpha = 0.5f) else RuvoColors.border),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Icon
            Box(
                modifier = Modifier.size(50.dp).background(device.accentColor.copy(alpha = 0.15f), RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) { Text(device.emoji, fontSize = 24.sp) }

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(device.name, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.SemiBold)
                    if (isConnected) {
                        Surface(shape = RoundedCornerShape(6.dp), color = device.accentColor.copy(alpha = 0.15f)) {
                            Text("Connected", style = MaterialTheme.typography.labelSmall, color = device.accentColor, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                        }
                    }
                }
                Text(device.description, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
            }

            if (isConnected) {
                OutlinedButton(
                    onClick = onToggle,
                    shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.dp, RuvoColors.border),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                ) {
                    Text("Disconnect", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textSecondary)
                }
            } else {
                Button(
                    onClick = onToggle,
                    shape = RoundedCornerShape(20.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                ) {
                    Text("Connect", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
