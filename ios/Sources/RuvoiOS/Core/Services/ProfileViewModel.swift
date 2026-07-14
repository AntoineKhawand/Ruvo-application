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

    private func checkFollowStatus() async {
        guard let myUid = Auth.auth().currentUser?.uid else { return }
        do {
            let doc = try await db.collection("users").document(myUid)
                .collection("following").document(userId).getDocument()
            isFollowing = doc.exists
        } catch {}
    }

    func toggleFollow() {
        guard let myUid = Auth.auth().currentUser?.uid else { return }
        let ref = db.collection("users").document(myUid).collection("following").document(userId)
        if isFollowing {
            isFollowing = false
            Task { try? await ref.delete() }
        } else {
            isFollowing = true
            Task { try? await ref.setData(["followedAt": Timestamp(date: Date())]) }
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
