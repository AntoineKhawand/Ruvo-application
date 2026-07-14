import Foundation
import FirebaseAuth
import GoogleSignIn
import AuthenticationServices
import Combine

enum AuthState: Equatable {
    case loading
    case unauthenticated
    case onboarding       // first sign-in, no profile yet
    case authenticated
}

@MainActor
final class AuthService: ObservableObject {
    @Published private(set) var state: AuthState = .loading
    @Published private(set) var currentUser: RuvoUser?

    private let keychain: KeychainService
    private var authStateHandle: AuthStateDidChangeListenerHandle?
    private var cancellables = Set<AnyCancellable>()

    var currentUserId: String? { Auth.auth().currentUser?.uid }

    init(keychain: KeychainService) {
        self.keychain = keychain
        listenToAuthState()
    }

    deinit {
        if let handle = authStateHandle {
            Auth.auth().removeStateDidChangeListener(handle)
        }
    }

    // MARK: – Auth state listener
    private func listenToAuthState() {
        authStateHandle = Auth.auth().addStateDidChangeListener { [weak self] _, firebaseUser in
            guard let self else { return }
            Task {
                if let firebaseUser {
                    await self.loadUser(uid: firebaseUser.uid)
                } else {
                    self.currentUser = nil
                    self.state = .unauthenticated
                }
            }
        }
    }

    private func loadUser(uid: String) async {
        do {
            let doc = try await Firestore.firestore().collection("users").document(uid).getDocument()
            if doc.exists {
                self.currentUser = try doc.data(as: RuvoUser.self)
                self.state = .authenticated
            } else {
                self.state = .onboarding
            }
        } catch {
            self.state = .unauthenticated
        }
    }

    // MARK: – Email / Password
    func signIn(email: String, password: String) async throws {
        _ = try await Auth.auth().signIn(withEmail: email, password: password)
    }

    func signUp(email: String, password: String, displayName: String) async throws {
        let result = try await Auth.auth().createUser(withEmail: email, password: password)
        try await result.user.sendEmailVerification()
        try await createUserProfile(uid: result.user.uid, email: email, displayName: displayName)
        state = .onboarding
    }

    func resetPassword(email: String) async throws {
        try await Auth.auth().sendPasswordReset(withEmail: email)
    }

    // MARK: – Sign in with Apple
    func signInWithApple(credential: ASAuthorizationAppleIDCredential) async throws {
        guard let tokenData = credential.identityToken,
              let tokenString = String(data: tokenData, encoding: .utf8) else {
            throw AuthError.invalidCredential
        }
        let firebaseCredential = OAuthProvider.credential(
            withProviderID: "apple.com",
            idToken: tokenString,
            rawNonce: AppleSignInHelper.currentNonce
        )
        let result = try await Auth.auth().signIn(with: firebaseCredential)
        let isNewUser = result.additionalUserInfo?.isNewUser ?? false
        if isNewUser {
            let name = [credential.fullName?.givenName, credential.fullName?.familyName]
                .compactMap { $0 }.joined(separator: " ")
            try await createUserProfile(uid: result.user.uid, email: credential.email ?? "", displayName: name)
            state = .onboarding
        }
    }

    // MARK: – Google Sign-In
    func signInWithGoogle(presenting viewController: UIViewController) async throws {
        guard let clientID = FirebaseApp.app()?.options.clientID else { throw AuthError.configurationError }
        let config = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.configuration = config

        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: viewController)
        let user = result.user
        guard let idToken = user.idToken?.tokenString else { throw AuthError.invalidCredential }

        let credential = GoogleAuthProvider.credential(withIDToken: idToken, accessToken: user.accessToken.tokenString)
        let authResult = try await Auth.auth().signIn(with: credential)
        let isNewUser = authResult.additionalUserInfo?.isNewUser ?? false
        if isNewUser {
            try await createUserProfile(
                uid: authResult.user.uid,
                email: user.profile?.email ?? "",
                displayName: user.profile?.name ?? ""
            )
            state = .onboarding
        }
    }

    // MARK: – Sign Out
    func signOut() throws {
        try Auth.auth().signOut()
        currentUser = nil
        state = .unauthenticated
    }

    // MARK: – Profile creation
    private func createUserProfile(uid: String, email: String, displayName: String) async throws {
        let user = RuvoUser(
            id: uid,
            email: email,
            displayName: displayName,
            createdAt: Date(),
            xp: 0,
            coins: 0,
            level: 1,
            streakDays: 0,
            totalDistanceKm: 0,
            totalRuns: 0
        )
        try Firestore.firestore()
            .collection("users")
            .document(uid)
            .setData(from: user)
    }

    enum AuthError: LocalizedError {
        case invalidCredential
        case configurationError

        var errorDescription: String? {
            switch self {
            case .invalidCredential:  return "Invalid credentials. Please try again."
            case .configurationError: return "App configuration error. Please reinstall."
            }
        }
    }
}

// MARK: – Apple Sign-In nonce helper
import CryptoKit

enum AppleSignInHelper {
    static var currentNonce: String = ""

    static func generateNonce() -> String {
        let nonce = randomNonceString()
        currentNonce = nonce
        return sha256(nonce)
    }

    private static func randomNonceString(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remainingLength = length
        while remainingLength > 0 {
            let randoms: [UInt8] = (0 ..< 16).map { _ in
                var random: UInt8 = 0
                _ = SecRandomCopyBytes(kSecRandomDefault, 1, &random)
                return random
            }
            randoms.forEach { random in
                if remainingLength == 0 { return }
                if random < charset.count {
                    result.append(charset[Int(random)])
                    remainingLength -= 1
                }
            }
        }
        return result
    }

    private static func sha256(_ input: String) -> String {
        let inputData = Data(input.utf8)
        let hashed = SHA256.hash(data: inputData)
        return hashed.compactMap { String(format: "%02x", $0) }.joined()
    }
}
