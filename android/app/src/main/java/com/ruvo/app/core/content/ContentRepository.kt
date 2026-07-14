package com.ruvo.app.core.content

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.core.model.Tip
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

private const val CONTENT_COLLECTION = "content"

// Bump when tip content changes so seedTipsToFirestore() re-syncs automatically.
private const val TIPS_VERSION = 2

@Singleton
class ContentRepository @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) {
    // TipsLibrary.ALL is always the source of truth for tip content — Firestore
    // only tracks live view counts, so new tips shipped in code show up for
    // everyone without a manual Firestore migration.
    suspend fun fetchTips(): List<Tip> {
        return try {
            val snap = firestore.collection(CONTENT_COLLECTION).get().await()
            val storedCounts = snap.documents.associate { it.id to (it.getLong("viewCount") ?: 0L) }

            val isStale = snap.size() < TipsLibrary.ALL.size ||
                snap.documents.any { it.id != "_meta" && it.getString("category") == null }
            if (isStale) seedTipsToFirestore()

            TipsLibrary.ALL.map { tip ->
                storedCounts[tip.id]?.let { tip.copy(viewCount = it) } ?: tip
            }
        } catch (_: Exception) {
            TipsLibrary.ALL
        }
    }

    suspend fun incrementTipView(tipId: String) {
        try {
            firestore.collection(CONTENT_COLLECTION).document(tipId)
                .set(mapOf("viewCount" to FieldValue.increment(1)), com.google.firebase.firestore.SetOptions.merge())
                .await()
        } catch (_: Exception) { /* view counts are cosmetic */ }

        val uid = auth.currentUser?.uid ?: return
        try {
            firestore.collection("users").document(uid)
                .set(mapOf("tipViews" to mapOf(tipId to FieldValue.increment(1))), com.google.firebase.firestore.SetOptions.merge())
                .await()
        } catch (_: Exception) { }
    }

    suspend fun toggleBookmark(tipId: String, isCurrentlySaved: Boolean) {
        val uid = auth.currentUser?.uid ?: return
        try {
            firestore.collection("users").document(uid).update(
                "savedTips",
                if (isCurrentlySaved) FieldValue.arrayRemove(tipId) else FieldValue.arrayUnion(tipId)
            ).await()
        } catch (_: Exception) { }
    }

    suspend fun seedTipsToFirestore(): Boolean {
        return try {
            val batch = firestore.batch()
            TipsLibrary.ALL.forEach { tip ->
                val ref = firestore.collection(CONTENT_COLLECTION).document(tip.id)
                batch.set(
                    ref,
                    mapOf(
                        "category" to tip.category,
                        "title" to tip.title,
                        "type" to "tip",
                        "version" to TIPS_VERSION,
                        "updatedAt" to com.google.firebase.Timestamp.now(),
                    ),
                    com.google.firebase.firestore.SetOptions.merge()
                )
            }
            batch.set(
                firestore.collection(CONTENT_COLLECTION).document("_meta"),
                mapOf("tipsVersion" to TIPS_VERSION, "totalTips" to TipsLibrary.ALL.size),
                com.google.firebase.firestore.SetOptions.merge()
            )
            batch.commit().await()
            true
        } catch (_: Exception) {
            false
        }
    }
}
