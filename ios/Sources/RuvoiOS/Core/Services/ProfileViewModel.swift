import Foundation
import FirebaseFirestore
import FirebaseAuth

@MainActor
final class ProfileViewModel: ObservableObject {
    @Published var user: RuvoUser?
    @Published var recentRuns: [RunRecord] = []
    @Published var isFollowing = false
    @Published var showEditProfile = false
    @Published var showSettings = false

    let userId: String
    var isOwnProfile: Bool { userId == Auth.auth().currentUser?.uid }

    private let db = Firestore.firestore()

    init(userId: String) {
        self.userId = userId
    }

    func loadProfile() async {
        do {
            let doc = try await db.collection("users").document(userId).getDocument()
            user = try doc.data(as: RuvoUser.self)
            await loadRecentRuns()
            if !isOwnProfile { await checkFollowStatus() }
        } catch {
            print("[Profile] Load error: \(error)")
        }
    }

    private func loadRecentRuns() async {
        do {
            let snapshot = try await db.collection("users").document(userId).collection("runs")
                .order(by: "startedAt", descending: true)
                .limit(to: 9)
                .getDocuments()
            recentRuns = snapshot.documents.compactMap { try? $0.data(as: RunRecord.self) }
        } catch {}
    }

    // Real schema is a `following`/`followers` ARRAY field directly on each
    // `users/{uid}` doc, mutated via arrayUnion/arrayRemove (Android's real
    // implementation -- ProfileViewModel.kt/FindFriendsViewModel.kt -- and
    // what firestore.rules' cross-user `followers` rule actually requires).
    // This used to read a `users/{uid}/following/{targetId}` SUBCOLLECTION
    // doc that nothing ever wrote and firestore.rules has no rule for at
    // all, so isFollowing always showed false. See toggleFollow below.
    private func checkFollowStatus() async {
        guard let myUid = Auth.auth().currentUser?.uid else { return }
        do {
            let myDoc = try await db.collection("users").document(myUid).getDocument()
            let myFollowing = myDoc.data()?["following"] as? [String] ?? []
            isFollowing = myFollowing.contains(userId)
        } catch {}
    }

    /// Follows/unfollows via `FollowService`, the single shared batched,
    /// two-sided write every real follow flow in this app uses (my doc's
    /// "following" arrayUnion/Remove + their doc's "followers"
    /// arrayUnion/Remove in one batch) -- see FollowService.swift's doc
    /// comment for why this used to be a broken, dead-end subcollection
    /// write here, and why the write itself now lives in one place shared
    /// with SearchView.swift's SearchViewModel.toggleFollow.
    func toggleFollow() {
        guard let myUid = Auth.auth().currentUser?.uid else { return }
        let wasFollowing = isFollowing
        isFollowing = !wasFollowing
        user?.followersCount = max(0, (user?.followersCount ?? 0) + (wasFollowing ? -1 : 1))

        Task {
            do {
                try await FollowService.setFollowing(!wasFollowing, myUid: myUid, targetUid: userId, db: db)
            } catch {
                print("[Profile] toggleFollow error: \(error)")
                // Revert optimistic update on failure, same as Android's
                // ProfileViewModel.kt toggleFollow.
                isFollowing = wasFollowing
                user?.followersCount = max(0, (user?.followersCount ?? 0) + (wasFollowing ? 1 : -1))
            }
        }
    }

    func updateProfile(displayName: String, bio: String, location: String) async {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        do {
            try await db.collection("users").document(uid).updateData([
                "displayName": displayName,
                "bio": bio,
                "location": location
            ])
            user?.displayName = displayName
            user?.bio = bio
            user?.location = location
        } catch {
            print("[Profile] Update error: \(error)")
        }
    }
}
