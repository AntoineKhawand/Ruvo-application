package com.ruvo.app.features.runtracking

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*

private val CONTEXT_TAGS = listOf("Strong 💪", "Tired 😴", "Injured 🩹", "Hilly ⛰️", "Hot ☀️", "Windy 💨", "Rain 🌧️")

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
    onSubmit: (rating: Int, notes: String, tags: List<String>) -> Unit,
    onSkip: () -> Unit,
) {
    var selectedRating by remember { mutableIntStateOf(0) }
    var notes by remember { mutableStateOf("") }
    var selectedTags by remember { mutableStateOf(setOf<String>()) }

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
            TextButton(onClick = onSkip) {
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
                    onSubmit(selectedRating, notes, selectedTags.toList())
                }
            },
            enabled = selectedRating > 0,
        )

        Spacer(modifier = Modifier.height(20.dp))
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
