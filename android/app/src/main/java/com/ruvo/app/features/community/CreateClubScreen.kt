package com.ruvo.app.features.community

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
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.designsystem.components.RuvoButton
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

private data class ClubIcon(val id: String, val emoji: String, val color: Color)
private val CLUB_ICONS = listOf(
    ClubIcon("run", "🏃", Color(0xFFDFFF00)),
    ClubIcon("fire", "🔥", Color(0xFFFF5722)),
    ClubIcon("mountain", "⛰️", Color(0xFF448AFF)),
    ClubIcon("trophy", "🏆", Color(0xFF7C4DFF)),
    ClubIcon("leaf", "🌿", Color(0xFF00E676)),
    ClubIcon("heart", "❤️", Color(0xFFE040FB)),
)

@HiltViewModel
class CreateClubViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) : ViewModel() {

    fun createClub(name: String, description: String, type: String, iconId: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            val uid = auth.currentUser?.uid ?: run { onError("Not signed in"); return@launch }
            if (name.isBlank()) { onError("Club name is required"); return@launch }
            try {
                val ref = firestore.collection("clubs").document()
                ref.set(mapOf(
                    "id" to ref.id,
                    "name" to name.trim(),
                    "description" to description.trim(),
                    "type" to type,
                    "icon" to iconId,
                    "createdBy" to uid,
                    "members" to listOf(uid),
                    "memberCount" to 1,
                    "weeklyKm" to 0.0,
                    "createdAt" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                )).await()
                firestore.collection("users").document(uid)
                    .update("clubs", com.google.firebase.firestore.FieldValue.arrayUnion(ref.id)).await()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Failed to create club")
            }
        }
    }
}

@Composable
fun CreateClubScreen(
    onBack: () -> Unit = {},
    onCreated: () -> Unit = {},
    viewModel: CreateClubViewModel = hiltViewModel(),
) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var privacy by remember { mutableStateOf("public") }
    var selectedIcon by remember { mutableStateOf(CLUB_ICONS[0]) }
    var isCreating by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxSize().background(RuvoColors.background).verticalScroll(rememberScrollState()),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary) }
            Text("Create Club", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, fontWeight = FontWeight.Bold)
        }

        // Icon picker
        Text("Choose an Icon", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textSecondary, modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp))
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            CLUB_ICONS.forEach { icon ->
                val isSelected = icon.id == selectedIcon.id
                Surface(
                    onClick = { selectedIcon = icon },
                    shape = RoundedCornerShape(16.dp),
                    color = if (isSelected) icon.color.copy(alpha = 0.2f) else RuvoColors.surface,
                    border = BorderStroke(if (isSelected) 2.dp else 1.dp, if (isSelected) icon.color else RuvoColors.border),
                    modifier = Modifier.size(56.dp),
                ) {
                    Box(contentAlignment = Alignment.Center) { Text(icon.emoji, fontSize = 26.sp) }
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        // Fields
        Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it; errorMsg = "" },
                label = { Text("Club Name *") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = RuvoColors.lime, unfocusedBorderColor = RuvoColors.border,
                    focusedLabelColor = RuvoColors.lime, focusedContainerColor = RuvoColors.surfaceElev,
                    unfocusedContainerColor = RuvoColors.surfaceElev, focusedTextColor = RuvoColors.textPrimary, unfocusedTextColor = RuvoColors.textPrimary,
                ),
            )

            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("Description") },
                modifier = Modifier.fillMaxWidth(),
                maxLines = 3,
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = RuvoColors.lime, unfocusedBorderColor = RuvoColors.border,
                    focusedLabelColor = RuvoColors.lime, focusedContainerColor = RuvoColors.surfaceElev,
                    unfocusedContainerColor = RuvoColors.surfaceElev, focusedTextColor = RuvoColors.textPrimary, unfocusedTextColor = RuvoColors.textPrimary,
                ),
            )

            // Privacy selector
            Text("Privacy", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textSecondary)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                listOf("public" to "Public 🌐", "private" to "Private 🔒").forEach { (v, l) ->
                    val isSelected = v == privacy
                    Surface(
                        onClick = { privacy = v },
                        shape = RoundedCornerShape(12.dp),
                        color = if (isSelected) RuvoColors.lime.copy(alpha = 0.15f) else RuvoColors.surface,
                        border = BorderStroke(if (isSelected) 2.dp else 1.dp, if (isSelected) RuvoColors.lime else RuvoColors.border),
                        modifier = Modifier.weight(1f),
                    ) {
                        Text(l, modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp), style = MaterialTheme.typography.labelMedium, color = if (isSelected) RuvoColors.lime else RuvoColors.textSecondary, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal)
                    }
                }
            }

            if (errorMsg.isNotBlank()) {
                Text(errorMsg, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            }

            RuvoButton(
                text = if (isCreating) "Creating…" else "Create Club",
                onClick = {
                    isCreating = true
                    viewModel.createClub(
                        name = name, description = description, type = privacy, iconId = selectedIcon.id,
                        onSuccess = { isCreating = false; onCreated() },
                        onError = { isCreating = false; errorMsg = it },
                    )
                },
                enabled = !isCreating,
            )
        }

        Spacer(Modifier.height(40.dp))
    }
}
