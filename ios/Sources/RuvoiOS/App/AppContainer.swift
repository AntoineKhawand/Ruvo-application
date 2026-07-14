import Foundation
import FirebaseAuth
import FirebaseFirestore
import FirebaseFunctions

/// Single source of all service singletons; injected via @EnvironmentObject.
@MainActor
final class AppContainer: ObservableObject {
    // MARK: – Core
    let keychainService = KeychainService()
    let securityManager = SecurityManager()

    // MARK: – Feature services used across the app
    lazy var authService: AuthService = AuthService(keychain: keychainService)
    lazy var runTrackingService: RunTrackingService = RunTrackingService()
    lazy var gamificationService: GamificationService = GamificationService(
        db: Firestore.firestore(),
        functions: Functions.functions(region: "us-central1")
    )
    lazy var navigationRouter: NavigationRouter = NavigationRouter()

    init() {
        securityManager.runChecks()
    }
}
