import FirebaseFirestore

/// Single source of truth for the actual Firestore write behind every
/// follow/unfollow in this app: a batched, two-sided arrayUnion/arrayRemove
/// on the "following" (mine) and "followers" (theirs) array fields on
/// `users/{uid}` -- exactly what `firestore.rules`' cross-user `followers`
/// rule requires (a signed-in user may only add/remove their own uid
/// to/from someone else's "followers" array), and the same shape Android's
/// real implementation uses (ProfileViewModel.kt/FindFriendsViewModel.kt).
///
/// Extracted after `ProfileViewModel.toggleFollow` was found still writing
/// to a dead `users/{uid}/following/{targetId}` SUBCOLLECTION doc --
/// firestore.rules has no rule for that path at all, so every follow from
/// a profile screen silently failed -- while `SearchViewModel.toggleFollow`
/// (SearchView.swift) already had this exact write correct. Callers keep
/// their own optimistic-UI bookkeeping (a single `isFollowing` Bool + a
/// displayed follower count on Profile vs. a `Set` used across a whole
/// results list on Search) since those shapes genuinely differ -- only the
/// write itself, the part that must exactly match firestore.rules, lives
/// here so it can't drift or get re-duplicated a third time.
enum FollowService {
    static func setFollowing(
        _ follow: Bool,
        myUid: String,
        targetUid: String,
        db: Firestore = Firestore.firestore()
    ) async throws {
        let myRef = db.collection("users").document(myUid)
        let targetRef = db.collection("users").document(targetUid)
        let batch = db.batch()
        if follow {
            batch.updateData(["following": FieldValue.arrayUnion([targetUid])], forDocument: myRef)
            batch.updateData(["followers": FieldValue.arrayUnion([myUid])], forDocument: targetRef)
        } else {
            batch.updateData(["following": FieldValue.arrayRemove([targetUid])], forDocument: myRef)
            batch.updateData(["followers": FieldValue.arrayRemove([myUid])], forDocument: targetRef)
        }
        try await batch.commit()
    }
}
