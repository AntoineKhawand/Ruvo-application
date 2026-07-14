package com.ruvo.app.features.gear

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.*
import javax.inject.Inject

// --- Models ---
data class Shoe(
    val id: String = UUID.randomUUID().toString(),
    val name: String = "",
    val brand: String = "",
    val maxKm: Double = 700.0,
    val currentKm: Double = 0.0,
    val isRetired: Boolean = false,
    val emoji: String = "👟",
    val addedAt: Long = System.currentTimeMillis(),
) {
    val wearPercent: Float get() = (currentKm / maxKm).coerceIn(0.0, 1.0).toFloat()
    val remainingKm: Double get() = (maxKm - currentKm).coerceAtLeast(0.0)
    val status: ShoeStatus get() = when {
        isRetired                 -> ShoeStatus.Retired
        wearPercent >= 0.9        -> ShoeStatus.Replace
        wearPercent >= 0.75       -> ShoeStatus.Warning
        else                      -> ShoeStatus.Good
    }
}

enum class ShoeStatus { Good, Warning, Replace, Retired }

data class ShoeTrackerUiState(
    val shoes: List<Shoe> = emptyList(),
    val isLoading: Boolean = false,
    val showAddSheet: Boolean = false,
)

// --- ViewModel ---
@HiltViewModel
class ShoeTrackerViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ShoeTrackerUiState())
    val uiState: StateFlow<ShoeTrackerUiState> = _uiState.asStateFlow()

    init { loadShoes() }

    private fun loadShoes() {
        val uid = auth.currentUser?.uid ?: return
        _uiState.value = _uiState.value.copy(isLoading = true)
        firestore.collection("users").document(uid).collection("shoes")
            .orderBy("addedAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
            .addSnapshotListener { snap, _ ->
                val shoes = snap?.documents?.mapNotNull { doc ->
                    Shoe(
                        id = doc.id,
                        name = doc.getString("name") ?: "",
                        brand = doc.getString("brand") ?: "",
                        maxKm = doc.getDouble("maxKm") ?: 700.0,
                        currentKm = doc.getDouble("currentKm") ?: 0.0,
                        isRetired = doc.getBoolean("isRetired") ?: false,
                        emoji = doc.getString("emoji") ?: "👟",
                        addedAt = doc.getLong("addedAt") ?: 0L,
                    )
                } ?: emptyList()
                _uiState.value = _uiState.value.copy(shoes = shoes, isLoading = false)
            }
    }

    fun addShoe(name: String, brand: String, maxKm: Double, emoji: String) {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            val shoe = mapOf(
                "name" to name,
                "brand" to brand,
                "maxKm" to maxKm,
                "currentKm" to 0.0,
                "isRetired" to false,
                "emoji" to emoji,
                "addedAt" to System.currentTimeMillis(),
            )
            firestore.collection("users").document(uid).collection("shoes").add(shoe).await()
            _uiState.value = _uiState.value.copy(showAddSheet = false)
        }
    }

    fun retireShoe(shoeId: String) {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            firestore.collection("users").document(uid).collection("shoes")
                .document(shoeId).update("isRetired", true).await()
        }
    }

    fun showAddSheet() { _uiState.value = _uiState.value.copy(showAddSheet = true) }
    fun hideAddSheet() { _uiState.value = _uiState.value.copy(showAddSheet = false) }
}

// --- Screen ---
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShoeTrackerScreen(viewModel: ShoeTrackerViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var nameInput by remember { mutableStateOf("") }
    var brandInput by remember { mutableStateOf("") }
    var maxKmInput by remember { mutableStateOf("700") }
    var emojiInput by remember { mutableStateOf("👟") }

    Box(modifier = Modifier.fillMaxSize().background(RuvoColors.background)) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("My Shoes", style = MaterialTheme.typography.displayMedium, color = RuvoColors.textPrimary)
                IconButton(onClick = { viewModel.showAddSheet() }) {
                    Icon(Icons.Default.Add, contentDescription = "Add shoe", tint = RuvoColors.lime)
                }
            }

            if (uiState.isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = RuvoColors.lime)
                }
            } else if (uiState.shoes.isEmpty()) {
                EmptyShoeState(onAdd = { viewModel.showAddSheet() })
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(uiState.shoes.filter { !it.isRetired }) { shoe ->
                        ShoeCard(shoe = shoe, onRetire = { viewModel.retireShoe(shoe.id) })
                    }
                    val retired = uiState.shoes.filter { it.isRetired }
                    if (retired.isNotEmpty()) {
                        item {
                            Text("Retired", style = MaterialTheme.typography.titleMedium,
                                color = RuvoColors.textSecondary, modifier = Modifier.padding(vertical = 8.dp))
                        }
                        items(retired) { shoe ->
                            ShoeCard(shoe = shoe, onRetire = null, isRetired = true)
                        }
                    }
                    item { Spacer(Modifier.height(80.dp)) }
                }
            }
        }

        if (uiState.showAddSheet) {
            ModalBottomSheet(
                onDismissRequest = { viewModel.hideAddSheet() },
                containerColor = RuvoColors.surface,
                tonalElevation = 0.dp,
            ) {
                Column(
                    modifier = Modifier.padding(20.dp).fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text("Add Shoe", style = MaterialTheme.typography.headlineMedium, color = RuvoColors.textPrimary)

                    // Emoji picker
                    val emojis = listOf("👟", "🏃", "⚡", "🔥", "💨", "🌿", "🎯")
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        emojis.forEach { e ->
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(CircleShape)
                                    .background(if (emojiInput == e) RuvoColors.limeDim else RuvoColors.surfaceElev)
                                    .clickable { emojiInput = e },
                                contentAlignment = Alignment.Center
                            ) { Text(e, style = MaterialTheme.typography.titleLarge) }
                        }
                    }

                    OutlinedTextField(
                        value = nameInput, onValueChange = { nameInput = it },
                        label = { Text("Shoe name") }, modifier = Modifier.fillMaxWidth(),
                        colors = ruvoTextFieldColors(),
                    )
                    OutlinedTextField(
                        value = brandInput, onValueChange = { brandInput = it },
                        label = { Text("Brand (Nike, Adidas…)") }, modifier = Modifier.fillMaxWidth(),
                        colors = ruvoTextFieldColors(),
                    )
                    OutlinedTextField(
                        value = maxKmInput, onValueChange = { maxKmInput = it },
                        label = { Text("Max km (recommended lifespan)") }, modifier = Modifier.fillMaxWidth(),
                        colors = ruvoTextFieldColors(),
                    )
                    Button(
                        onClick = {
                            viewModel.addShoe(
                                name = nameInput, brand = brandInput,
                                maxKm = maxKmInput.toDoubleOrNull() ?: 700.0, emoji = emojiInput
                            )
                            nameInput = ""; brandInput = ""; maxKmInput = "700"; emojiInput = "👟"
                        },
                        enabled = nameInput.isNotBlank(),
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape = RoundedCornerShape(999.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black),
                    ) { Text("Add Shoe", style = MaterialTheme.typography.titleSmall) }
                    Spacer(Modifier.height(16.dp))
                }
            }
        }
    }
}

@Composable
private fun ShoeCard(shoe: Shoe, onRetire: (() -> Unit)?, isRetired: Boolean = false) {
    val statusColor = when (shoe.status) {
        ShoeStatus.Good    -> Color(0xFF4ADE80)
        ShoeStatus.Warning -> Color(0xFFF97316)
        ShoeStatus.Replace -> Color(0xFFEF4444)
        ShoeStatus.Retired -> RuvoColors.textTertiary
    }
    val statusLabel = when (shoe.status) {
        ShoeStatus.Good    -> "Good"
        ShoeStatus.Warning -> "Getting worn"
        ShoeStatus.Replace -> "Replace soon"
        ShoeStatus.Retired -> "Retired"
    }

    RuvoCard(modifier = Modifier.fillMaxWidth(), isHighlighted = shoe.status == ShoeStatus.Replace) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(shoe.emoji, style = MaterialTheme.typography.headlineLarge)
                Column(modifier = Modifier.weight(1f)) {
                    Text(shoe.name, style = MaterialTheme.typography.titleMedium,
                        color = RuvoColors.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(shoe.brand, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(statusLabel, style = MaterialTheme.typography.labelSmall, color = statusColor)
                    Text(String.format("%.0f km left", shoe.remainingKm),
                        style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                }
            }

            // Wear progress bar
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                    Text(String.format("%.0f km", shoe.currentKm), style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                    Text(String.format("%.0f km max", shoe.maxKm), style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                }
                LinearProgressIndicator(
                    progress = { shoe.wearPercent },
                    modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                    color = statusColor,
                    trackColor = RuvoColors.border,
                )
            }

            if (!isRetired && onRetire != null) {
                TextButton(onClick = onRetire) {
                    Text("Retire", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                }
            }
        }
    }
}

@Composable
private fun EmptyShoeState(onAdd: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("👟", style = MaterialTheme.typography.displayLarge)
        Spacer(Modifier.height(16.dp))
        Text("No shoes added yet", style = MaterialTheme.typography.titleLarge, color = RuvoColors.textPrimary)
        Text("Track mileage on each pair to know when to replace them.",
            style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary,
            modifier = Modifier.padding(top = 8.dp))
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = onAdd,
            modifier = Modifier.height(52.dp),
            shape = RoundedCornerShape(999.dp),
            colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black)
        ) { Text("Add First Shoe") }
    }
}

@Composable
private fun ruvoTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = RuvoColors.lime,
    unfocusedBorderColor = RuvoColors.border,
    cursorColor = RuvoColors.lime,
    focusedTextColor = RuvoColors.textPrimary,
    unfocusedTextColor = RuvoColors.textPrimary,
    focusedLabelColor = RuvoColors.lime,
    unfocusedLabelColor = RuvoColors.textSecondary,
    focusedContainerColor = RuvoColors.surfaceElev,
    unfocusedContainerColor = RuvoColors.surfaceElev,
)
