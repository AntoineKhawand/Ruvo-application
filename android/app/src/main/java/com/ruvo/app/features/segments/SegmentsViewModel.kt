package com.ruvo.app.features.segments

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class SegmentListItem(
    val segment: RuvoSegment,
    val topEfforts: List<SegmentEffort>,
)

data class SegmentsUiState(
    val segments: List<SegmentListItem> = emptyList(),
    val isLoading: Boolean = false,
)

@HiltViewModel
class SegmentsViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SegmentsUiState())
    val uiState: StateFlow<SegmentsUiState> = _uiState.asStateFlow()

    // Same Following+self bounded scope as CommunityViewModel's loadFeed()/
    // loadRoutes() — segments live in a top-level "segments" collection
    // (not per-user), so this is a real Firestore query (whereIn), not a
    // client-side fan-out read like those two, but the audience it shows is
    // deliberately the same for the same reason: no server-side geo-index
    // exists to support a true "segments near me, anyone" search yet.
    fun loadSegments() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val myUid = auth.currentUser?.uid ?: return@launch
                val meDoc = firestore.collection("users").document(myUid).get().await()
                @Suppress("UNCHECKED_CAST")
                val following = (meDoc.data?.get("following") as? List<String>) ?: emptyList()
                // whereIn caps at 30 values — same practical scale limit
                // Following-bounded fan-outs elsewhere in this app accept.
                val creatorUids = (following + myUid).distinct().take(30)
                if (creatorUids.isEmpty()) {
                    _uiState.value = _uiState.value.copy(segments = emptyList(), isLoading = false)
                    return@launch
                }

                val segmentDocs = firestore.collection("segments")
                    .whereIn("creatorUid", creatorUids)
                    .get().await()

                val items = coroutineScope {
                    segmentDocs.documents.map { doc ->
                        async {
                            val data = doc.data ?: return@async null
                            val segment = data.toSegment(doc.id) ?: return@async null
                            val effortDocs = try {
                                firestore.collection("segments").document(doc.id)
                                    .collection("efforts")
                                    .orderBy("bestSeconds")
                                    .limit(3)
                                    .get().await()
                            } catch (_: Exception) { null }
                            val efforts = effortDocs?.documents?.mapNotNull { it.data?.toEffort() } ?: emptyList()
                            SegmentListItem(segment, efforts)
                        }
                    }.awaitAll().filterNotNull()
                }
                _uiState.value = _uiState.value.copy(
                    segments = items.sortedByDescending { it.topEfforts.size },
                    isLoading = false,
                )
            } catch (_: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }
}

private fun Map<String, Any>.toSegment(id: String): RuvoSegment? {
    val name = this["name"] as? String ?: return null
    @Suppress("UNCHECKED_CAST")
    val polylineRaw = this["polyline"] as? List<Map<String, Any>> ?: emptyList()
    val polyline = polylineRaw.mapNotNull { p ->
        val lat = (p["lat"] as? Number)?.toDouble() ?: return@mapNotNull null
        val lng = (p["lng"] as? Number)?.toDouble() ?: return@mapNotNull null
        lat to lng
    }
    return RuvoSegment(
        id = id,
        name = name,
        creatorUid = this["creatorUid"] as? String ?: "",
        creatorName = this["creatorName"] as? String ?: "Runner",
        distanceKm = (this["distanceKm"] as? Number)?.toDouble() ?: 0.0,
        startLat = (this["startLat"] as? Number)?.toDouble() ?: 0.0,
        startLng = (this["startLng"] as? Number)?.toDouble() ?: 0.0,
        endLat = (this["endLat"] as? Number)?.toDouble() ?: 0.0,
        endLng = (this["endLng"] as? Number)?.toDouble() ?: 0.0,
        polyline = polyline,
        sourceRunId = this["sourceRunId"] as? String ?: "",
    )
}

private fun Map<String, Any>.toEffort(): SegmentEffort? {
    val uid = this["uid"] as? String ?: return null
    return SegmentEffort(
        uid = uid,
        userName = this["userName"] as? String ?: "Runner",
        bestSeconds = (this["bestSeconds"] as? Number)?.toInt() ?: 0,
        runId = this["runId"] as? String ?: "",
    )
}
