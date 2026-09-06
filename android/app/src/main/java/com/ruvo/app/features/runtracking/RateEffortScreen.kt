package com.ruvo.app.features.runtracking

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.*
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*
import com.ruvo.app.features.gear.Shoe
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

private val CONTEXT_TAGS = listOf("Strong 💪", "Tired 😴", "Injured 🩹", "Hilly ⛰️", "Hot ☀️", "Windy 💨", "Rain 🌧️")

// GPS-tracked runs never attached gear at all — only SaveActivityScreen's manual
// "Log Activity" flow could (see RN_ANDROID_PORT_MAPPING.md's "Known Data-Layer
// Bugs": "GPS-tracked runs via RuvoApp.kt::submitRunActivity don't attach gear
// yet"). This screen is the natural hand-off point (same place RPE/notes/tags
// are already collected before the real save), so the gear picker lives here
// rather than adding a whole new screen. Same gearList fetch pattern as
// SaveActivityViewModel — kept as a separate small ViewModel rather than reusing
// that one, since this screen has no other relationship to SaveActivityScreen.
@HiltViewModel
class RateEffortViewModel @Inject constructor(
    firestore: FirebaseFirestore,
    auth: FirebaseAuth,
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
}

private fun rpeColor(rating: Int): Color = when {
    rating <= 3 -> Color(0xFFB2FF59)
    rating <= 6 -> Color(0xFFFFEE58)
    rating <= 8 -> Color(0xFFFFA726)
    else        -> Color(0xFFFF5252)
}

private fun rpeLabel(rating: Int): String = when {
    rating == 0  -> "Select intensity"
    rating <= 2  -> "Very Easy"
    rating <= 4  -> "Easy / Moderate"
    rating <= 6  -> "Somewhat Hard"
    rating <= 8  -> "Hard Effort"
    rating == 9  -> "Very Hard"
    else         -> "Maximum Effort"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RateEffortScreen(
    onSubmit: (rating: Int, notes: String, tags: List<String>, gearId: String?, photoUri: android.net.Uri?) -> Unit,
    onSkip: (gearId: String?, photoUri: android.net.Uri?) -> Unit,
    viewModel: RateEffortViewModel = hiltViewModel(),
) {
    var selectedRating by remember { mutableIntStateOf(0) }
    var notes by remember { mutableStateOf("") }
    var selectedTags by remember { mutableStateOf(setOf<String>()) }
    val gearList by viewModel.gearList.collectAsStateWithLifecycle()
    val availableGear = remember(gearList) { gearList.filter { !it.isRetired } }
    var selectedGearId by remember { mutableStateOf<String?>(null) }
    // Competitor-analysis Tier 1 #5: Strava's biggest organic-growth driver is
    // a photo attached to the finished run — reuses the exact same system
    // Photo Picker pattern as ProfileScreen's avatar upload, just captured
    // here (alongside RPE/notes/tags/gear) rather than a separate screen.
    var photoUri by remember { mutableStateOf<android.net.Uri?>(null) }
    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia(),
    ) { uri -> if (uri != null) photoUri = uri }
    // Same "pre-select the default shoe, but only until the user picks one
    // themselves" pattern as SaveActivityScreen's own gear picker.
    LaunchedEffect(gearList) {
        if (selectedGearId == null) selectedGearId = gearList.find { it.isDefault }?.id
    }

    val accentColor by animateColorAsState(
        targetValue = if (selectedRating > 0) rpeColor(selectedRating) else RuvoColors.textTertiary,
        animationSpec = tween(300),
        label = "accent"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("How did it feel?", style = MaterialTheme.typography.headlineLarge, color = RuvoColors.textPrimary, fontWeight = FontWeight.ExtraBold)
            TextButton(onClick = { onSkip(selectedGearId, photoUri) }) {
                Text("Skip", color = RuvoColors.textTertiary)
            }
        }

        // Label
        Text(
            rpeLabel(selectedRating),
            style = MaterialTheme.typography.bodyLarge,
            color = accentColor,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )

        // RPE Grid 1-10
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                (1..5).forEach { value ->
                    RpeButton(
                        value = value,
                        isSelected = selectedRating == value,
                        color = rpeColor(value),
                        onClick = { selectedRating = value },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                (6..10).forEach { value ->
                    RpeButton(
                        value = value,
                        isSelected = selectedRating == value,
                        color = rpeColor(value),
                        onClick = { selectedRating = value },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }

        // Context tags
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("How were conditions?", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textSecondary)
            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CONTEXT_TAGS.forEach { tag ->
                    val isSelected = tag in selectedTags
                    Surface(
                        onClick = {
                            selectedTags = if (isSelected) selectedTags - tag else selectedTags + tag
                        },
                        shape = RoundedCornerShape(20.dp),
                        color = if (isSelected) RuvoColors.lime.copy(alpha = 0.15f) else RuvoColors.surface,
                        border = BorderStroke(1.dp, if (isSelected) RuvoColors.lime else RuvoColors.border),
                    ) {
                        Text(
                            tag,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                            style = MaterialTheme.typography.bodySmall,
                            color = if (isSelected) RuvoColors.lime else RuvoColors.textSecondary,
                        )
                    }
                }
            }
        }

        // Gear — mirrors SaveActivityScreen's picker exactly (same Shoe model,
        // same default-shoe preselection), just for the GPS-tracked path instead
        // of the manual one.
        if (availableGear.isNotEmpty()) {
            GearPicker(
                availableGear = availableGear,
                selectedGearId = selectedGearId,
                onSelect = { selectedGearId = it },
            )
        }

        // Photo
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Add a photo (optional)", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textSecondary)
            Surface(
                onClick = { photoPickerLauncher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                shape = RoundedCornerShape(14.dp),
                color = RuvoColors.surfaceElev,
                border = BorderStroke(1.dp, RuvoColors.border),
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (photoUri != null) {
                    Box {
                        coil.compose.AsyncImage(
                            model = photoUri,
                            contentDescription = "Selected run photo",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxWidth().height(160.dp).clip(RoundedCornerShape(14.dp)),
                        )
                        IconButton(
                            onClick = { photoUri = null },
                            modifier = Modifier.align(Alignment.TopEnd).padding(6.dp)
                                .background(Color.Black.copy(alpha = 0.5f), CircleShape),
                        ) {
                            Icon(Icons.Default.Close, contentDescription = "Remove photo", tint = Color.White)
                        }
                    }
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Default.AddAPhoto, contentDescription = null, tint = RuvoColors.lime)
                        Text("Attach a photo from your run", style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary, modifier = Modifier.padding(start = 12.dp))
                    }
                }
            }
        }

        // Notes
        OutlinedTextField(
            value = notes,
            onValueChange = { notes = it },
            label = { Text("Add notes (optional)") },
            modifier = Modifier.fillMaxWidth(),
            maxLines = 4,
            shape = RoundedCornerShape(16.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = RuvoColors.lime,
                unfocusedBorderColor = RuvoColors.border,
                focusedLabelColor = RuvoColors.lime,
                focusedContainerColor = RuvoColors.surfaceElev,
                unfocusedContainerColor = RuvoColors.surfaceElev,
                focusedTextColor = RuvoColors.textPrimary,
                unfocusedTextColor = RuvoColors.textPrimary,
            )
        )

        // Submit
        RuvoButton(
            text = if (selectedRating > 0) "Save & Continue" else "Select intensity first",
            onClick = {
                if (selectedRating > 0) {
                    onSubmit(selectedRating, notes, selectedTags.toList(), selectedGearId, photoUri)
                }
            },
            enabled = selectedRating > 0,
        )

        Spacer(modifier = Modifier.height(20.dp))
    }
}

@Composable
private fun GearPicker(availableGear: List<Shoe>, selectedGearId: String?, onSelect: (String?) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    val selectedName = availableGear.find { it.id == selectedGearId }?.name ?: "None"
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Gear", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textSecondary)
        Box {
            Surface(
                onClick = { expanded = true },
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
                    Text(selectedName, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary, modifier = Modifier.weight(1f).padding(start = 12.dp))
                    Icon(Icons.Default.ExpandMore, contentDescription = null, tint = RuvoColors.textTertiary)
                }
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                DropdownMenuItem(text = { Text("None") }, onClick = { onSelect(null); expanded = false })
                availableGear.forEach { shoe ->
                    DropdownMenuItem(text = { Text(shoe.name) }, onClick = { onSelect(shoe.id); expanded = false })
                }
            }
        }
    }
}

@Composable
private fun RpeButton(
    value: Int,
    isSelected: Boolean,
    color: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scale by animateFloatAsState(
        targetValue = if (isSelected) 1.12f else 1f,
        animationSpec = spring(dampingRatio = 0.5f),
        label = "scale_$value"
    )

    Box(
        modifier = modifier
            .aspectRatio(1f)
            .scale(scale)
            .clip(RoundedCornerShape(12.dp))
            .background(if (isSelected) color.copy(alpha = 0.2f) else RuvoColors.surfaceElev)
            .border(2.dp, if (isSelected) color else RuvoColors.border, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "$value",
            fontSize = 18.sp,
            fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.SemiBold,
            color = if (isSelected) color else RuvoColors.textSecondary,
        )
    }
}
