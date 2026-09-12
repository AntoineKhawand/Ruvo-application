package com.ruvo.app.features.gear

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import javax.inject.Inject

// --- Models ---
// Mirrors the `gearList` array field stored directly on the users/{uid} document (RN schema) —
// there is no separate "shoes" subcollection.
data class Shoe(
    val id: String = "",
    val name: String = "",
    val limit: Double = 800.0,
    val distance: Double = 0.0,
    val isDefault: Boolean = false,
) {
    val isRetired: Boolean get() = distance >= limit
    val progress: Float get() = if (limit <= 0) 0f else (distance / limit).coerceIn(0.0, 1.0).toFloat()
    val remainingKm: Double get() = (limit - distance).coerceAtLeast(0.0)

    fun toMap(): Map<String, Any> = mapOf(
        "id" to id, "name" to name, "limit" to limit, "distance" to distance, "isDefault" to isDefault,
    )
}

data class ShoePerf(val bestPaceSecPerKm: Int? = null, val runCount: Int = 0, val avgDistanceKm: Double = 0.0)

data class ShoeTrackerUiState(
    val shoes: List<Shoe> = emptyList(),
    val perfByShoe: Map<String, ShoePerf> = emptyMap(),
    val isLoading: Boolean = false,
    val showSheet: Boolean = false,
    val editingShoe: Shoe? = null,
    val newlyRetired: Shoe? = null,
)

// Ported from RN's helpers.js detectShoeDistance — suggests a mileage limit from the model name.
private val SHOE_LIMIT_KEYWORDS: List<Pair<Double, List<String>>> = listOf(
    400.0 to listOf("vaporfly", "alphafly", "adios pro", "metaspeed", "endorphin pro", "rocket", "elite", "takumi", "streak", "carbon", "sc elite", "fuelcell elite", "prime x"),
    550.0 to listOf("kinvara", "mach", "rebel", "hyperion", "magic speed", "rival", "boston", "adíos", "noosa", "floatride energy", "liberate", "deviate"),
    650.0 to listOf("speedgoat", "peregrine", "cascadia", "terrex", "lone peak", "wildhorse", "pegasus trail", "hierro", "catamount", "zinal", "cloudultra", "tecton x", "mafate"),
    750.0 to listOf("invincible", "bondi", "more v", "triumph", "aurora", "glideride", "monster", "cloudmonster", "magnify nitro", "skyward"),
    800.0 to listOf("pegasus", "ghost", "clifton", "nimbus", "cumulus", "glycerin", "adrenaline", "kayano", "guide", "infinity", "novablast", "rider", "vomero", "880", "1080", "ultraboost", "velocity nitro", "cloudsurfer", "cloudrunner", "wave rider"),
    1000.0 to listOf("air force", "stan smith", "superstar", "jordan", "dunk", "air max", "nano", "metcon"),
)

fun detectShoeLimit(name: String): Double? {
    if (name.isBlank()) return null
    val lower = name.lowercase()
    for ((limit, keywords) in SHOE_LIMIT_KEYWORDS) {
        if (keywords.any { lower.contains(it) }) return limit
    }
    return null
}

val POPULAR_SHOES = listOf(
    "Nike Air Zoom Pegasus 40", "Nike Vaporfly 3", "Nike Alphafly 3", "Nike Invincible 3", "Nike Vomero 17",
    "Hoka Clifton 9", "Hoka Bondi 8", "Hoka Speedgoat 5", "Hoka Mach 6",
    "Saucony Endorphin Speed 4", "Saucony Ride 17", "Brooks Ghost 15",
    "Asics Novablast 4", "Asics Gel-Kayano 30", "Adidas Boston 12",
    "New Balance 1080v13", "On Cloudmonster 2", "Reebok Floatride Energy 5",
)

// --- ViewModel ---
@HiltViewModel
class ShoeTrackerViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ShoeTrackerUiState())
    val uiState: StateFlow<ShoeTrackerUiState> = _uiState.asStateFlow()

    private val alertedShoeIds = mutableSetOf<String>()

    init {
        loadGear()
        loadRunPerf()
    }

    private fun loadGear() {
        val uid = auth.currentUser?.uid ?: return
        _uiState.value = _uiState.value.copy(isLoading = true)
        firestore.collection("users").document(uid).addSnapshotListener { doc, _ ->
            val rawList = doc?.get("gearList") as? List<*> ?: emptyList<Any>()
            val shoes = rawList.mapNotNull { entry ->
                val map = entry as? Map<*, *> ?: return@mapNotNull null
                Shoe(
                    id = (map["id"] as? String) ?: return@mapNotNull null,
                    name = map["name"] as? String ?: "",
                    limit = (map["limit"] as? Number)?.toDouble() ?: 800.0,
                    distance = (map["distance"] as? Number)?.toDouble() ?: 0.0,
                    isDefault = map["isDefault"] as? Boolean ?: false,
                )
            }
            shoes.filter { it.isRetired }.forEach { shoe ->
                if (alertedShoeIds.add(shoe.id)) {
                    _uiState.value = _uiState.value.copy(newlyRetired = shoe)
                }
            }
            _uiState.value = _uiState.value.copy(shoes = shoes, isLoading = false)
        }
    }

    // The real saveRunActivity Cloud Function (functions/index.js) writes each
    // finished run as one entry in the users/{uid}.runHistory ARRAY field — there
    // is no users/{uid}/runs subcollection (see RN_ANDROID_PORT_MAPPING.md's
    // "Known Data-Layer Bugs" section). Per-shoe stats were silently always
    // empty before, even after the gearList-array fix (commit d39f3d7) made the
    // shoe list itself real. Only SaveActivityScreen's manual "Log Activity"
    // flow writes gearId today — GPS-tracked runs via RuvoApp.kt don't attach
    // gear yet, so distance-limit tracking still only comes from the shoe's own
    // `distance` field, not these per-run stats.
    private fun loadRunPerf() {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            try {
                val data = firestore.collection("users").document(uid).get().await().data
                @Suppress("UNCHECKED_CAST")
                val runHistory = data?.get("runHistory") as? List<Map<String, Any>> ?: emptyList()
                val byGear = mutableMapOf<String, MutableList<Pair<Int?, Double>>>()
                runHistory.forEach { r ->
                    val gearId = r["gearId"] as? String ?: return@forEach
                    val dist = (r["distance"] as? Number)?.toDouble() ?: 0.0
                    val durParts = (r["duration"] as? String)?.split(":")?.mapNotNull { it.toLongOrNull() }
                    val durSec = when (durParts?.size) {
                        2 -> durParts[0] * 60 + durParts[1]
                        3 -> durParts[0] * 3600 + durParts[1] * 60 + durParts[2]
                        else -> null
                    }
                    val paceSecPerKm = if (durSec != null && dist > 0) (durSec / dist).toInt() else null
                    byGear.getOrPut(gearId) { mutableListOf() }.add(paceSecPerKm to dist)
                }
                val perf = byGear.mapValues { (_, runs) ->
                    val best = runs.mapNotNull { it.first }.filter { it > 0 }.minOrNull()
                    val avg = if (runs.isNotEmpty()) runs.sumOf { it.second } / runs.size else 0.0
                    ShoePerf(bestPaceSecPerKm = best, runCount = runs.size, avgDistanceKm = avg)
                }
                _uiState.value = _uiState.value.copy(perfByShoe = perf)
            } catch (_: Exception) { /* performance stats are best-effort */ }
        }
    }

    fun addShoe(name: String, limit: Double) {
        val uid = auth.currentUser?.uid ?: return
        val current = _uiState.value.shoes
        val newShoe = Shoe(id = System.currentTimeMillis().toString(), name = name, limit = limit, distance = 0.0, isDefault = current.isEmpty())
        val newList = current + newShoe
        firestore.collection("users").document(uid).update("gearList", newList.map { it.toMap() })
        _uiState.value = _uiState.value.copy(showSheet = false, editingShoe = null)
    }

    fun updateShoe(id: String, name: String, limit: Double, distance: Double) {
        val uid = auth.currentUser?.uid ?: return
        val newList = _uiState.value.shoes.map { if (it.id == id) it.copy(name = name, limit = limit, distance = distance) else it }
        firestore.collection("users").document(uid).update("gearList", newList.map { it.toMap() })
        _uiState.value = _uiState.value.copy(showSheet = false, editingShoe = null)
    }

    fun deleteShoe(id: String) {
        val uid = auth.currentUser?.uid ?: return
        val newList = _uiState.value.shoes.filter { it.id != id }
        firestore.collection("users").document(uid).update("gearList", newList.map { it.toMap() })
    }

    fun selectDefault(id: String) {
        val uid = auth.currentUser?.uid ?: return
        val newList = _uiState.value.shoes.map { it.copy(isDefault = it.id == id) }
        firestore.collection("users").document(uid).update("gearList", newList.map { it.toMap() })
    }

    fun openAddSheet() { _uiState.value = _uiState.value.copy(showSheet = true, editingShoe = null) }
    fun openEditSheet(shoe: Shoe) { _uiState.value = _uiState.value.copy(showSheet = true, editingShoe = shoe) }
    fun closeSheet() { _uiState.value = _uiState.value.copy(showSheet = false, editingShoe = null) }
    fun dismissRetiredAlert() { _uiState.value = _uiState.value.copy(newlyRetired = null) }
}

// --- Screen ---
@Composable
fun ShoeTrackerScreen(onBack: () -> Unit = {}, viewModel: ShoeTrackerViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var deleteTarget by remember { mutableStateOf<Shoe?>(null) }

    val sortedShoes = remember(uiState.shoes) { uiState.shoes.sortedBy { if (it.isRetired) 1 else 0 } }
    val totalKm = uiState.shoes.sumOf { it.distance }
    val activeName = uiState.shoes.find { it.isDefault }?.name?.split(" ")?.lastOrNull() ?: "—"
    val retiredCount = uiState.shoes.count { it.isRetired }

    Box(modifier = Modifier.fillMaxSize().background(RuvoColors.background)) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary) }
                Text("Gear Tracker", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary, modifier = Modifier.weight(1f))
                IconButton(onClick = { viewModel.openAddSheet() }) {
                    Icon(Icons.Default.Add, contentDescription = "Add shoe", tint = RuvoColors.lime)
                }
            }

            if (uiState.isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = RuvoColors.lime)
                }
            } else if (uiState.shoes.isEmpty()) {
                EmptyShoeState(onAdd = { viewModel.openAddSheet() })
            } else {
                // Hero summary strip
                RuvoCard(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                        HeroStat(value = uiState.shoes.size.toString(), label = "Shoes", modifier = Modifier.weight(1f))
                        VerticalDivider()
                        HeroStat(value = String.format("%.0f", totalKm), label = "Total km", modifier = Modifier.weight(1f))
                        VerticalDivider()
                        HeroStat(value = activeName, label = "Active shoe", color = RuvoColors.lime, modifier = Modifier.weight(1f))
                        if (retiredCount > 0) {
                            VerticalDivider()
                            HeroStat(value = retiredCount.toString(), label = "Retired", color = RuvoColors.error, modifier = Modifier.weight(1f))
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))

                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    items(sortedShoes, key = { it.id }) { shoe ->
                        ShoeCard(
                            shoe = shoe,
                            perf = uiState.perfByShoe[shoe.id],
                            onSetActive = { viewModel.selectDefault(shoe.id) },
                            onEdit = { viewModel.openEditSheet(shoe) },
                            onDelete = { deleteTarget = shoe },
                        )
                    }
                    item { Spacer(Modifier.height(80.dp)) }
                }
            }
        }

        if (uiState.showSheet) {
            ShoeEditSheet(
                editing = uiState.editingShoe,
                onDismiss = { viewModel.closeSheet() },
                onSave = { name, limit, distance ->
                    val editing = uiState.editingShoe
                    if (editing != null) viewModel.updateShoe(editing.id, name, limit, distance)
                    else viewModel.addShoe(name, limit)
                },
            )
        }

        deleteTarget?.let { shoe ->
            AlertDialog(
                onDismissRequest = { deleteTarget = null },
                title = { Text("Delete Shoe", color = RuvoColors.textPrimary) },
                text = { Text("Remove \"${shoe.name}\" from your gear tracker?", color = RuvoColors.textSecondary) },
                confirmButton = {
                    TextButton(onClick = { viewModel.deleteShoe(shoe.id); deleteTarget = null }) {
                        Text("Delete", color = RuvoColors.error)
                    }
                },
                dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Cancel", color = RuvoColors.textSecondary) } },
                containerColor = RuvoColors.glassSurface,
            )
        }

        uiState.newlyRetired?.let { shoe ->
            AlertDialog(
                onDismissRequest = { viewModel.dismissRetiredAlert() },
                title = { Text("Equipment Warning", color = RuvoColors.textPrimary) },
                text = { Text("Your ${shoe.name} has reached its mileage limit (${shoe.limit.toInt()}km). Consider retiring them.", color = RuvoColors.textSecondary) },
                confirmButton = {
                    TextButton(onClick = { viewModel.dismissRetiredAlert() }) { Text("I Understand", color = RuvoColors.error) }
                },
                containerColor = RuvoColors.glassSurface,
            )
        }
    }
}

@Composable
private fun HeroStat(value: String, label: String, modifier: Modifier = Modifier, color: Color = RuvoColors.textPrimary) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleLarge, color = color, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(label.uppercase(), style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
    }
}

@Composable
private fun VerticalDivider() {
    Box(Modifier.width(1.dp).height(32.dp).background(RuvoColors.border))
}

@Composable
private fun ShoeCard(shoe: Shoe, perf: ShoePerf?, onSetActive: () -> Unit, onEdit: () -> Unit, onDelete: () -> Unit) {
    val statusColor = if (shoe.isRetired) RuvoColors.error else if (shoe.progress > 0.8f) RuvoColors.warning else RuvoColors.lime
    val statusLabel = if (shoe.isRetired) "LIMIT REACHED" else "${(shoe.progress * 100).toInt()}% used"

    RuvoCard(modifier = Modifier.fillMaxWidth(), isHighlighted = shoe.isDefault) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                ShoeRing(progress = shoe.progress, isDefault = shoe.isDefault, isRetired = shoe.isRetired)
                Column(modifier = Modifier.weight(1f).padding(start = 14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        Text(
                            shoe.name, style = MaterialTheme.typography.titleMedium,
                            color = if (shoe.isRetired) RuvoColors.textTertiary else RuvoColors.textPrimary,
                            maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false),
                        )
                        if (shoe.isRetired) {
                            RuvoChip(label = "RETIRED", color = RuvoColors.error)
                        } else if (shoe.isDefault) {
                            RuvoChip(label = "ACTIVE", isActive = true, color = RuvoColors.lime)
                        }
                    }
                    Row {
                        Text(String.format("%.1f", shoe.distance), style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                        Text(" / ${shoe.limit.toInt()} km", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (!shoe.isDefault && !shoe.isRetired) {
                        IconButton(onClick = onSetActive, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Default.RadioButtonUnchecked, contentDescription = "Set active", tint = RuvoColors.textTertiary, modifier = Modifier.size(18.dp))
                        }
                    }
                    IconButton(onClick = onEdit, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Edit, contentDescription = "Edit", tint = RuvoColors.textTertiary, modifier = Modifier.size(16.dp))
                    }
                    IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = RuvoColors.textTertiary, modifier = Modifier.size(16.dp))
                    }
                }
            }

            if (perf != null && perf.runCount > 0) {
                Surface(color = RuvoColors.surfaceElev, shape = RoundedCornerShape(12.dp)) {
                    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 11.dp, horizontal = 14.dp)) {
                        PerfItem(icon = Icons.Default.Bolt, label = "BEST PACE", value = formatPace(perf.bestPaceSecPerKm), modifier = Modifier.weight(1f), highlight = shoe.isDefault)
                        Box(Modifier.width(1.dp).height(28.dp).background(RuvoColors.border))
                        PerfItem(icon = Icons.Default.BarChart, label = "RUNS", value = perf.runCount.toString(), modifier = Modifier.weight(1f))
                        Box(Modifier.width(1.dp).height(28.dp).background(RuvoColors.border))
                        PerfItem(icon = Icons.Default.DirectionsRun, label = "AVG DIST", value = String.format("%.1f km", perf.avgDistanceKm), modifier = Modifier.weight(1f))
                    }
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text(statusLabel, style = MaterialTheme.typography.labelMedium, color = statusColor)
                    if (!shoe.isRetired) {
                        RuvoChip(label = "${shoe.remainingKm.toInt()} km left", color = statusColor)
                    }
                }
                LinearProgressIndicator(
                    progress = { shoe.progress },
                    modifier = Modifier.fillMaxWidth().height(7.dp).clip(RoundedCornerShape(4.dp)),
                    color = statusColor,
                    trackColor = RuvoColors.border,
                )
            }
        }
    }
}

@Composable
private fun PerfItem(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, value: String, modifier: Modifier = Modifier, highlight: Boolean = false) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = if (highlight) RuvoColors.lime else RuvoColors.textTertiary, modifier = Modifier.size(13.dp))
        Column(modifier = Modifier.padding(start = 6.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
            Text(value, style = MaterialTheme.typography.bodySmall, color = if (highlight) RuvoColors.lime else RuvoColors.textPrimary)
        }
    }
}

private fun formatPace(secPerKm: Int?): String {
    if (secPerKm == null || secPerKm <= 0) return "--:--"
    val m = secPerKm / 60
    val s = secPerKm % 60
    return String.format("%d:%02d", m, s)
}

@Composable
private fun ShoeRing(progress: Float, isDefault: Boolean, isRetired: Boolean, size: androidx.compose.ui.unit.Dp = 52.dp) {
    val ringColor = if (isRetired) RuvoColors.error else if (progress > 0.8f) RuvoColors.warning else RuvoColors.lime
    Box(modifier = Modifier.size(size), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(
            progress = { progress },
            modifier = Modifier.fillMaxSize(),
            color = ringColor,
            trackColor = RuvoColors.border,
            strokeWidth = 3.dp,
        )
        Box(
            modifier = Modifier
                .size(size - 12.dp)
                .clip(CircleShape)
                .background(if (isDefault) RuvoColors.lime else if (isRetired) RuvoColors.surfaceElev else RuvoColors.surfaceElev),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                if (isRetired) Icons.Default.Warning else Icons.Default.Checkroom,
                contentDescription = null,
                tint = if (isDefault) Color.Black else if (isRetired) RuvoColors.error else RuvoColors.textPrimary,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShoeEditSheet(editing: Shoe?, onDismiss: () -> Unit, onSave: (name: String, limit: Double, distance: Double) -> Unit) {
    val isEditing = editing != null
    var name by remember { mutableStateOf(editing?.name ?: "") }
    var limitText by remember { mutableStateOf((editing?.limit?.toInt() ?: 800).toString()) }
    var distanceText by remember { mutableStateOf(String.format("%.2f", editing?.distance ?: 0.0)) }
    var autoDetected by remember { mutableStateOf(false) }
    var showDropdown by remember { mutableStateOf(false) }

    val filteredShoes = remember(name, isEditing) {
        if (!isEditing && name.isNotEmpty()) POPULAR_SHOES.filter { it.lowercase().contains(name.lowercase()) } else POPULAR_SHOES
    }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = RuvoColors.glassSurface, tonalElevation = 0.dp) {
        Column(modifier = Modifier.padding(20.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(if (isEditing) "Edit Shoe" else "Add New Shoe", style = MaterialTheme.typography.headlineSmall, color = RuvoColors.textPrimary)

            Text("SHOE MODEL", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
            Box {
                Column {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { t ->
                            name = t
                            if (!isEditing) {
                                showDropdown = true
                                val detected = detectShoeLimit(t)
                                if (detected != null) { limitText = detected.toInt().toString(); autoDetected = true } else autoDetected = false
                            }
                        },
                        placeholder = { Text("Search model…", color = RuvoColors.textTertiary) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        trailingIcon = if (!isEditing) {
                            {
                                IconButton(onClick = { showDropdown = !showDropdown }) {
                                    Icon(if (showDropdown) Icons.Default.ExpandLess else Icons.Default.Search, contentDescription = null, tint = RuvoColors.lime)
                                }
                            }
                        } else null,
                        colors = ruvoTextFieldColors(),
                    )
                    if (showDropdown && !isEditing) {
                        Surface(color = RuvoColors.surfaceElev, shape = RoundedCornerShape(14.dp), modifier = Modifier.padding(top = 4.dp)) {
                            LazyColumn(modifier = Modifier.heightIn(max = 160.dp)) {
                                items(filteredShoes) { s ->
                                    Text(
                                        s, style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textPrimary,
                                        modifier = Modifier.fillMaxWidth()
                                            .clickable { name = s; showDropdown = false; val detected = detectShoeLimit(s); if (detected != null) { limitText = detected.toInt().toString(); autoDetected = true } }
                                            .padding(vertical = 13.dp, horizontal = 16.dp),
                                    )
                                }
                            }
                        }
                    }
                }
            }

            if (isEditing) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("CURRENT DISTANCE (KM)", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                    OutlinedTextField(
                        value = distanceText, onValueChange = { distanceText = it },
                        modifier = Modifier.fillMaxWidth(), singleLine = true,
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal),
                        colors = ruvoTextFieldColors(),
                    )
                    Text("Update manually if you missed logging a run.", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("MAX DISTANCE LIMIT (KM)", style = MaterialTheme.typography.labelSmall, color = RuvoColors.textTertiary)
                OutlinedTextField(
                    value = limitText, onValueChange = { limitText = it; autoDetected = false },
                    modifier = Modifier.fillMaxWidth(), singleLine = true,
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number),
                    trailingIcon = if (autoDetected) { { RuvoChip(label = "AI SET", isActive = true, color = RuvoColors.lime) } } else null,
                    colors = ruvoTextFieldColors(),
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 8.dp)) {
                OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f).height(52.dp), shape = RoundedCornerShape(999.dp)) {
                    Text("Cancel", color = RuvoColors.textSecondary)
                }
                Button(
                    onClick = { onSave(name.trim(), limitText.toDoubleOrNull() ?: 800.0, distanceText.toDoubleOrNull() ?: 0.0) },
                    enabled = name.isNotBlank(),
                    modifier = Modifier.weight(1f).height(52.dp),
                    shape = RoundedCornerShape(999.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black),
                ) { Text(if (isEditing) "Save Changes" else "Add Shoe") }
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun EmptyShoeState(onAdd: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(Icons.Default.Checkroom, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(48.dp))
        Spacer(Modifier.height(16.dp))
        Text("No shoes added yet", style = MaterialTheme.typography.titleLarge, color = RuvoColors.textPrimary)
        Text(
            "Track mileage on each pair to know when to replace them.",
            style = MaterialTheme.typography.bodyMedium, color = RuvoColors.textSecondary,
            modifier = Modifier.padding(top = 8.dp),
        )
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = onAdd,
            modifier = Modifier.height(52.dp),
            shape = RoundedCornerShape(999.dp),
            colors = ButtonDefaults.buttonColors(containerColor = RuvoColors.lime, contentColor = Color.Black),
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
