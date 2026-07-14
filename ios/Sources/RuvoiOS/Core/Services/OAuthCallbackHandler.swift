import Foundation
import FirebaseAuth
import FirebaseFirestore

enum OAuthCallbackHandler {

    static func handle(url: URL) async {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let code = components.queryItems?.first(where: { $0.name == "code" })?.value,
              let uid = Auth.auth().currentUser?.uid else { return }

        let path = url.path
        if path.hasPrefix("/oura") {
            await exchangeOura(code: code, uid: uid)
        } else if path.hasPrefix("/whoop") {
            await exchangeWhoop(code: code, uid: uid)
        }
    }

    // MARK: Oura token exchange
    private static func exchangeOura(code: String, uid: String) async {
        let clientId  = Bundle.main.object(forInfoDictionaryKey: "OURA_CLIENT_ID")  as? String ?? ""
        let redirect  = "com.ruvo.app://oauth/oura"
        guard let url = URL(string: "https://api.ouraring.com/oauth/token") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = "grant_type=authorization_code&code=\(code)&client_id=\(clientId)&redirect_uri=\(redirect)"
            .data(using: .utf8)

        await saveTokens(from: request, uid: uid, prefix: "oura")
    }

    // MARK: WHOOP token exchange
    private static func exchangeWhoop(code: String, uid: String) async {
        let clientId = Bundle.main.object(forInfoDictionaryKey: "WHOOP_CLIENT_ID") as? String ?? ""
        let redirect = "com.ruvo.app://oauth/whoop"
        guard let url = URL(string: "https://api.prod.whoop.com/oauth/oauth2/token") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = "grant_type=authorization_code&code=\(code)&client_id=\(clientId)&redirect_uri=\(redirect)"
            .data(using: .utf8)

        await saveTokens(from: request, uid: uid, prefix: "whoop")
    }

    private static func saveTokens(from request: URLRequest, uid: String, prefix: String) async {
        guard let (data, _) = try? await URLSession.shared.data(for: request),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }

        var updates: [String: Any] = [:]
        if let access = json["access_token"] as? String, !access.isEmpty {
            updates["\(prefix)_access_token"] = access
        }
        if let refresh = json["refresh_token"] as? String, !refresh.isEmpty {
            updates["\(prefix)_refresh_token"] = refresh
        }
        guard !updates.isEmpty else { return }

        try? await Firestore.firestore()
            .collection("users").document(uid)
            .collection("integrations").document("oauth")
            .setData(updates, merge: true)
    }
}
