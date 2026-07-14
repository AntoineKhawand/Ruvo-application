import SwiftUI
import FirebaseCore
import FirebaseAppCheck
import FirebaseMessaging
import UserNotifications

@main
struct RuvoApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
    @StateObject private var container = AppContainer()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(container.authService)
                .environmentObject(container.gamificationService)
                .environmentObject(container.navigationRouter)
                .preferredColorScheme(.dark)
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        FirebaseApp.configure()
        configureAppCheck()
        configurePushNotifications(application)
        return true
    }

    // MARK: App Check
    private func configureAppCheck() {
        let providerFactory = AppCheckDebugProviderFactory()
        AppCheck.setAppCheckProviderFactory(providerFactory)
    }

    // MARK: Push Notifications
    private func configurePushNotifications(_ application: UIApplication) {
        UNUserNotificationCenter.current().delegate = self
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { _, _ in }
        application.registerForRemoteNotifications()
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        NotificationTokenService.shared.save(token: token)
    }

    // MARK: Deep link handling (Oura / WHOOP OAuth)
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        if url.scheme == "com.ruvo.app" && url.host == "oauth" {
            Task { await OAuthCallbackHandler.handle(url: url) }
            return true
        }
        return false
    }
}
