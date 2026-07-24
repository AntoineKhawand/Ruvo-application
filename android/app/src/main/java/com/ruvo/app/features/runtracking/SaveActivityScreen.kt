package com.ruvo.app.features.runtracking

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.designsystem.components.RuvoButton
import com.ruvo.app.designsystem.theme.RuvoColors
import com.ruvo.app.features.gamification.GamificationRepository
import com.ruvo.app.features.gear.Shoe
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

@HiltViewModel
class SaveActivityViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val gamificationRepo: GamificationRepository,
) : ViewModel() {

    private val _gearList = MutableStateFlow<List<Shoe>>(emptyList())
    val gearList: StateFlow<List<Shoe>> = _gearList.asStateFlow()

    init {
        auth.currentUser?.uid?.let { uid ->
            firestore.collection("users").document(uid).addSnapshotListener { doc, _ ->
                val rawList = doc?.get("gearList") as? List<*> ?: emptyList<Any>()
                _gearList.value = rawList.mapNotNull { entry ->
                    val map = entry as? Map<*, *> ?: return@mapNotNull null
                    Shoe(
                        id = (map["id"] as? String) ?: return@mapNotNull null,
                        name = map["name"] as? String ?: "",
                        limit = (map["limit"] as? Number)?.toDouble() ?: 800.0,
                        distance = (map["distance"] as? Number)?.toDouble() ?: 0.0,
                        isDefault = map["isDefault"] as? Boolean ?: false,
                    )
                }
            }
        }
    }

    fun saveActivity(
        distanceKm: Double,
        hours: Int,
        minutes: Int,
        seconds: Int,
        calories: Int,
        activityType: String,
        notes: String,
        gearId: String?,
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
    ) {
        viewModelScope.launch {
            auth.currentUser?.uid ?: run { onError("Not signed in"); return@launch }
            if (distanceKm <= 0) { onError("Distance must be greater than 0"); return@launch }

            val durationSec = hours * 3600 + minutes * 60 + seconds
            if (durationSec <= 0) { onError("Duration must be greater than 0"); return@launch }

            try {
                // Real save path: the saveRunActivity Cloud Function (server computes
                // XP/coins and atomically applies runHistory/totalRuns/weeklyDistance —
                // see RN_SOURCE_ARCHIVE.md §9). A prior version of this screen wrote
                // directly to a `users/{uid}/runs` subcollection that doesn't exist in
                // the real schema, and computed/wrote its own coins client-side.
                val durationStr = if (hours > 0) String.format("%d:%02d:%02d", hours, minutes, seconds) else String.format("%d:%02d", minutes, seconds)
                val updatedGear = if (gearId != null) {
                    _gearList.value.map { if (it.id == gearId) it.copy(distance = it.distance + distanceKm) else it }
                } else emptyList()

                val runEntry = mapOf(
                    "date" to java.time.Instant.now().toString(),
                    "distance" to distanceKm,
                    "duration" to durationStr,
                    "calories" to calories,
                    "activityType" to activityType,
                    "notes" to notes,
                    "isManual" to true,
                    "gearId" to gearId,
                )
                val calculatedUpdates = if (updatedGear.isNotEmpty()) {
                    mapOf("gearList" to updatedGear.map { it.toMap() })
                } else emptyMap()

                gamificationRepo.saveRunActivity(runEntry, calculatedUpdates)
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Failed to save activity")
            }
        }
    }
}

@Composable
fun SaveActivityScreen(
    onBack: () -> Unit = {},
    onSaved: () -> Unit = {},
    viewModel: SaveActivityViewModel = hiltViewModel(),
) {
    var distanceText by remember { mutableStateOf("") }
    var hours by remember { mutableStateOf(0) }
    var minutes by remember { mutableStateOf(0) }
    var seconds by remember { mutableStateOf(0) }
    var caloriesText by remember { mutableStateOf("") }
    var activityType by remember { mutableStateOf("Run") }
    var notes by remember { mutableStateOf("") }
    var isSaving by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf("") }
    var showGearMenu by remember { mutableStateOf(false) }
    var selectedGearId by remember { mutableStateOf<String?>(null) }

    val gearList by viewModel.gearList.collectAsStateWithLifecycle()
    val availableGear = gearList.filter { !it.isRetired }
    LaunchedEffect(gearList) {
        if (selectedGearId == null) selectedGearId = gearList.find { it.isDefault }?.id
    }
    val selectedGearName = availableGear.find { it.id == selectedGearId }?.name ?: "None"

    val activityTypes = listOf("Run", "Walk", "Hike", "Trail Run", "Treadmill")

    Column(
        modifier = Modifier.fillMaxSize().background(RuvoColors.background).verticalScroll(rememberScrollState()),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary) }
            Text("Log Activity", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
        }

        Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {

            // Activity type selector
            Text("Activity Type", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textSecondary)
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                activityTypes.forEach { type ->
                    val isSelected = type == activityType
                    FilterChip(
                        selected = isSelected,
                        onClick = { activityType = type },
                        label = { Text(type, style = MaterialTheme.typography.labelMedium) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = RuvoColors.lime,
                            selectedLabelColor = androidx.compose.ui.graphics.Color.Black,
                            containerColor = RuvoColors.surfaceElev,
                            labelColor = RuvoColors.textSecondary,
                        ),
                        border = FilterChipDefaults.filterChipBorder(
                            enabled = true,
                            selected = isSelected,
                            selectedBorderColor = RuvoColors.lime,
                            borderColor = RuvoColors.border,
                        ),
                    )
                }
            }

            // Distance
            OutlinedTextField(
                value = distanceText,
                onValueChange = { distanceText = it; errorMsg = "" },
                label = { Text("Distance (km)") },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal),
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                colors = fieldColors(),
                leadingIcon = { Icon(Icons.Default.Straighten, contentDescription = null, tint = RuvoColors.lime) },
            )

            // Duration
            Text("Duration", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textSecondary)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DurationField("HH", hours, 0..23) { hours = it }
                DurationField("MM", minutes, 0..59) { minutes = it }
                DurationField("SS", seconds, 0..59) { seconds = it }
            }

            // Gear
            if (gearList.isNotEmpty()) {
                Text("Gear", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textSecondary)
                Box {
                    Surface(
                        onClick = { showGearMenu = true },
                        shape = RoundedCornerShape(14.dp),
                        color = RuvoColors.surfaceElev,
                        border = BorderStroke(1.dp, RuvoColors.border),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Default.Checkroom, contentDescription = null, tint = RuvoColors.lime)
                            Text(selectedGearName, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary, modifier = Modifier.weight(1f).padding(start = 12.dp))
                            Icon(Icons.Default.ExpandMore, contentDescription = null, tint = RuvoColors.textTertiary)
                        }
                    }
                    DropdownMenu(expanded = showGearMenu, onDismissRequest = { showGearMenu = false }) {
                        availableGear.forEach { shoe ->
                            DropdownMenuItem(text = { Text(shoe.name) }, onClick = { selectedGearId = shoe.id; showGearMenu = false })
                        }
                    }
                }
            }

            // Calories
            OutlinedTextField(
                value = caloriesText,
                onValueChange = { caloriesText = it },
                label = { Text("Calories (optional)") },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number),
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                colors = fieldColors(),
                leadingIcon = { Icon(Icons.Default.LocalFireDepartment, contentDescription = null, tint = androidx.compose.ui.graphics.Color(0xFFFF6D40)) },
            )

            // Notes
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Notes (optional)") },
                modifier = Modifier.fillMaxWidth(),
                maxLines = 3,
                shape = RoundedCornerShape(14.dp),
                colors = fieldColors(),
            )

            if (errorMsg.isNotBlank()) {
                Text(errorMsg, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            }

            RuvoButton(
                text = if (isSaving) "Saving…" else "Save Activity",
                onClick = {
                    isSaving = true
                    errorMsg = ""
                    val dist = distanceText.toDoubleOrNull() ?: 0.0
                    val cal = caloriesText.toIntOrNull() ?: 0
                    viewModel.saveActivity(
                        distanceKm = dist, hours = hours, minutes = minutes, seconds = seconds,
                        calories = cal, activityType = activityType, notes = notes, gearId = selectedGearId,
                        onSuccess = { isSaving = false; onSaved() },
                        onError = { isSaving = false; errorMsg = it },
                    )
                },
                enabled = !isSaving,
            )
        }

        Spacer(Modifier.height(80.dp))
    }
}

@Composable
private fun RowScope.DurationField(label: String, value: Int, range: IntRange, onValueChange: (Int) -> Unit) {
    OutlinedTextField(
        value = if (value == 0) "" else value.toString(),
        onValueChange = { onValueChange(it.toIntOrNull()?.coerceIn(range) ?: 0) },
        label = { Text(label) },
        modifier = Modifier.weight(1f),
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number),
        singleLine = true,
        shape = RoundedCornerShape(14.dp),
        colors = fieldColors(),
    )
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = RuvoColors.lime,
    unfocusedBorderColor = RuvoColors.border,
    focusedLabelColor = RuvoColors.lime,
    focusedContainerColor = RuvoColors.surfaceElev,
    unfocusedContainerColor = RuvoColors.surfaceElev,
    focusedTextColor = RuvoColors.textPrimary,
    unfocusedTextColor = RuvoColors.textPrimary,
)
