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
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.designsystem.components.RuvoButton
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

@HiltViewModel
class SaveActivityViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    fun saveActivity(
        distanceKm: Double,
        hours: Int,
        minutes: Int,
        seconds: Int,
        calories: Int,
        activityType: String,
        notes: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
    ) {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: run { onError("Not signed in"); return@launch }
            if (distanceKm <= 0) { onError("Distance must be greater than 0"); return@launch }

            val durationSec = (hours * 3600 + minutes * 60 + seconds).toLong()
            if (durationSec <= 0) { onError("Duration must be greater than 0"); return@launch }

            try {
                val runRef = firestore.collection("users").document(uid).collection("runs").document()
                val avgPace = if (distanceKm > 0) (durationSec / distanceKm).toInt() else 0
                val coinsEarned = (distanceKm * 10).toInt()

                runRef.set(mapOf(
                    "id" to runRef.id,
                    "distanceKm" to distanceKm,
                    "durationSeconds" to durationSec,
                    "avgPaceSecondsPerKm" to avgPace,
                    "calories" to calories,
                    "activityType" to activityType,
                    "notes" to notes,
                    "isManual" to true,
                    "startedAt" to FieldValue.serverTimestamp(),
                    "coinsEarned" to coinsEarned,
                )).await()

                firestore.collection("users").document(uid).update(
                    "totalKm", FieldValue.increment(distanceKm),
                    "totalRuns", FieldValue.increment(1),
                    "totalCalories", FieldValue.increment(calories.toLong()),
                    "coins", FieldValue.increment(coinsEarned.toLong()),
                ).await()

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
                    val dist = distanceText.toDoubleOrNull() ?: 0.0
                    val cal = caloriesText.toIntOrNull() ?: 0
                    viewModel.saveActivity(
                        distanceKm = dist, hours = hours, minutes = minutes, seconds = seconds,
                        calories = cal, activityType = activityType, notes = notes,
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
