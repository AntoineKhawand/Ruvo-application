import Foundation
import FirebaseAuth
import FirebaseFirestore

final class NotificationTokenService {
    static let shared = NotificationTokenService()
    private let db = Firestore.firestore()

    func save(token: String) {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        db.collection("users").document(uid).updateData([
            "fcmTokens": FieldValue.arrayUnion([token])
        ])
    }
}
