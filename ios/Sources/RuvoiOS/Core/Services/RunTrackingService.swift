import Foundation
import CoreLocation
import FirebaseAuth
import FirebaseFirestore

final class RunTrackingService {
    private let db = Firestore.firestore()

    // MARK: Save run to Firestore and update shoe mileage
    func saveRun(_ run: RunRecord) async throws {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        let docId = run.id ?? UUID().uuidString
        let data: [String: Any] = [
            "id": docId,
            "userId": uid,
            "startedAt": Timestamp(date: run.startedAt),
            "finishedAt": Timestamp(date: run.finishedAt),
            "durationSeconds": run.durationSeconds,
            "distanceKm": run.distanceKm,
            "averagePaceMinPerKm": run.averagePaceMinPerKm,
            "calories": run.calories,
            "route": run.route.map { ["latitude": $0.latitude, "longitude": $0.longitude] },
            "laps": run.laps.map { [
                "number": $0.number,
                "distanceKm": $0.distanceKm,
                "durationSeconds": $0.durationSeconds,
                "paceMinPerKm": $0.paceMinPerKm,
            ] as [String: Any] },
        ]
        try await db.collection("users").document(uid)
            .collection("runs").document(docId).setData(data)

        await updateActiveShoeKm(uid: uid, distanceKm: run.distanceKm)
    }

    // MARK: Live sharing
    func startLiveSharing(runId: String, userId: String) async throws {
        try await db.collection("liveRuns").document(runId).setData([
            "userId": userId,
            "isActive": true,
            "startedAt": Timestamp(date: Date()),
        ])
    }

    func stopLiveSharing(runId: String) async throws {
        try await db.collection("liveRuns").document(runId).updateData(["isActive": false])
    }

    func updateLiveLocation(runId: String, coordinate: CLLocationCoordinate2D, pace: Double, distanceKm: Double) async throws {
        try await db.collection("liveRuns").document(runId).updateData([
            "latitude": coordinate.latitude,
            "longitude": coordinate.longitude,
            "currentPace": pace,
            "distanceKm": distanceKm,
            "updatedAt": Timestamp(date: Date()),
        ])
    }

    // MARK: Auto-update active shoe mileage
    private func updateActiveShoeKm(uid: String, distanceKm: Double) async {
        let snap = try? await db.collection("users").document(uid).collection("shoes")
            .whereField("isRetired", isEqualTo: false)
            .order(by: "addedAt", descending: false)
            .limit(to: 1)
            .getDocuments()
        guard let docId = snap?.documents.first?.documentID else { return }
        try? await db.collection("users").document(uid).collection("shoes").document(docId)
            .updateData(["currentKm": FieldValue.increment(distanceKm)])
    }
}
