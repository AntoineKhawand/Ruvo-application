import SwiftUI
import FirebaseAuth
import FirebaseFirestore
import FirebaseFunctions

/// Real Settings screen -- ports the core of Android's `SettingsScreen.kt`:
/// the toggles that actually persist to `users/{uid}` (via
/// `SettingsViewModel` below, mirroring Android's `SettingsViewModel.kt`
/// field-for-field), plus real Sign Out / Delete Account actions. Reachable
/// two ways, unchanged from before this pass: pushed as `AppRoute.settings`
/// from `HomeTab` (`MainTabView.swift`), and presented as a sheet from
/// `ProfileView` via `SettingsSheetView` at the bottom of this file.
///
/// Deliberately placeholder or omitted this round (tracked, not silently
/// dropped -- same one-screen-at-a-time approach used for
/// Achievements/Leaderboard/Rewards/Referral):
///  - Help Center: now real (see `HelpCenterView.swift`, ported from
///    Android's `HelpCenterScreen.kt`'s live Firestore FAQ).
///  - Privacy Controls: now real (see `PrivacyControlsView.swift`, ported
///    from Android's `PrivacyControlsScreen.kt`'s real toggles/pickers and
///    blocked/muted user lists).
///  - Recalibrate AI, password change, About dialog, Rate/Share/Privacy
///    Policy/Terms links, Connected Devices, Manage Subscription, Reminder
///    Days & Time editor, biometric lock -- all real Android rows, out of
///    scope for this pass. Biometric in particular has no iOS counterpart
///    yet (no `AppLockViewModel`/`LAContext` gate exists in this codebase),
///    so it isn't a toggle-that's-missing so much as a feature not started.
struct SettingsView: View {
    @EnvironmentObject private var authService: AuthService
    @StateObject private var viewModel = SettingsViewModel()
    @State private var showDeleteConfirmation = false

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: RuvoTheme.Spacing.lg) {
                    SettingsSection(title: "Account") {
                        NavigationLink(destination: PrivacyControlsView()) {
                            SettingsRow(icon: "lock.shield", label: "Privacy Controls", showDivider: false)
                        }
                        .buttonStyle(.plain)
                    }

                    SettingsSection(title: "Preferences") {
                        SettingsToggleRow(
                            icon: "ruler",
                            label: "Metric Units",
                            isOn: Binding(
                                get: { viewModel.unitSystem == "metric" },
                                set: { viewModel.setUnitSystem($0 ? "metric" : "imperial") }
                            ),
                            showDivider: false
                        )
                    }

                    SettingsSection(title: "Notifications") {
                        SettingsToggleRow(
                            icon: "figure.run",
                            label: "Workout Reminders",
                            isOn: Binding(get: { viewModel.workoutReminders }, set: { _ in viewModel.toggle(.workoutReminders) })
                        )
                        SettingsToggleRow(
                            icon: "lightbulb",
                            label: "Tips",
                            isOn: Binding(get: { viewModel.tips }, set: { _ in viewModel.toggle(.tips) }),
                            showDivider: false
                        )
                    }

                    SettingsSection(title: "Community") {
                        SettingsToggleRow(
                            icon: "person.2",
                            label: "New Followers",
                            isOn: Binding(get: { viewModel.newFollowers }, set: { _ in viewModel.toggle(.newFollowers) })
                        )
                        SettingsToggleRow(
                            icon: "bubble.left.and.bubble.right",
                            label: "Community Activity",
                            isOn: Binding(get: { viewModel.communityActivity }, set: { _ in viewModel.toggle(.communityActivity) })
                        )
                        SettingsToggleRow(
                            icon: "person.3",
                            label: "Club Updates",
                            isOn: Binding(get: { viewModel.clubUpdates }, set: { _ in viewModel.toggle(.clubUpdates) }),
                            showDivider: false
                        )
                    }

                    SettingsSection(title: "Support") {
                        NavigationLink(destination: HelpCenterView()) {
                            SettingsRow(icon: "questionmark.circle", label: "Help Center", showDivider: false)
                        }
                        .buttonStyle(.plain)
                    }

                    SettingsSection(title: "Account Actions") {
                        SettingsActionRow(
                            icon: "rectangle.portrait.and.arrow.right",
                            label: "Sign Out",
                            action: { try? authService.signOut() }
                        )
                        SettingsActionRow(
                            icon: "trash",
                            label: "Delete Account",
                            isLoading: viewModel.isDeletingAccount,
                            showDivider: false,
                            action: { showDeleteConfirmation = true }
                        )
                    }

                    Text("Ruvo v1.0.0")
                        .font(RuvoTheme.Typography.caption)
                        .tracking(RuvoTheme.Typography.Tracking.caption)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, RuvoTheme.Spacing.sm)
                }
                .padding(RuvoTheme.Spacing.lg)
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .task { viewModel.loadSettings() }
        // Real confirmation before a destructive, irreversible call --
        // mirrors Android's delete-account AlertDialog copy.
        .alert("Delete Account?", isPresented: $showDeleteConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task {
                    if await viewModel.deleteAccount() {
                        try? authService.signOut()
                    }
                }
            }
        } message: {
            Text("This will permanently delete your RUVO account, all runs, achievements and data. This cannot be undone.")
        }
        .alert("Couldn't Delete Account", isPresented: Binding(
            get: { viewModel.deleteErrorMessage != nil },
            set: { if !$0 { viewModel.deleteErrorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.deleteErrorMessage ?? "")
        }
    }
}

/// Presentation wrapper for the sheet entry point (`ProfileView`'s
/// `.sheet(isPresented: $viewModel.showSettings)`) -- `SettingsView` itself
/// stays stack-agnostic (no `NavigationStack` of its own) so it also works
/// pushed directly into `HomeTab`'s existing stack via `AppRoute.settings`.
/// Mirrors `GamificationView.swift`'s `RewardsShopView` wrapper around
/// `RewardsView` -- same NavigationStack + close-button pattern.
struct SettingsSheetView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            SettingsView()
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        RuvoIconButton(icon: "xmark", action: { dismiss() })
                    }
                }
        }
    }
}

/// Firestore fields this screen actually reads/writes -- verbatim mirror of
/// Android's `SettingsViewModel.kt` shape (`unitSystem`,
/// `notificationSettings.{workoutReminders,tips,newFollowers,
/// communityActivity,clubUpdates}` on `users/{uid}`), not a fresh parallel
/// shape. Same optimistic-update-then-rollback-on-failure pattern Android
/// uses in `toggleNotification`/`setUnitSystem`.
@MainActor
final class SettingsViewModel: ObservableObject {
    @Published var unitSystem: String = "metric"
    @Published var workoutReminders = true
    @Published var tips = true
    @Published var newFollowers = true
    @Published var communityActivity = true
    @Published var clubUpdates = false

    @Published var isDeletingAccount = false
    @Published var deleteErrorMessage: String?

    enum NotificationKey: String {
        case workoutReminders, tips, newFollowers, communityActivity, clubUpdates
    }

    private let db = Firestore.firestore()
    private let functions = Functions.functions()
    private var uid: String? { Auth.auth().currentUser?.uid }

    func loadSettings() {
        guard let uid else { return }
        Task {
            do {
                let data = try await db.collection("users").document(uid).getDocument().data()
                let notif = data?["notificationSettings"] as? [String: Any]
                unitSystem = data?["unitSystem"] as? String ?? "metric"
                workoutReminders = notif?["workoutReminders"] as? Bool ?? true
                tips = notif?["tips"] as? Bool ?? true
                newFollowers = notif?["newFollowers"] as? Bool ?? true
                communityActivity = notif?["communityActivity"] as? Bool ?? true
                clubUpdates = notif?["clubUpdates"] as? Bool ?? false
            } catch {
                // Silent fallback to defaults -- matches Android's loadSettings().
            }
        }
    }

    func setUnitSystem(_ system: String) {
        guard let uid else { return }
        let previous = unitSystem
        unitSystem = system
        Task {
            do {
                try await db.collection("users").document(uid).updateData(["unitSystem": system])
            } catch {
                unitSystem = previous
            }
        }
    }

    func toggle(_ key: NotificationKey) {
        guard let uid else { return }
        let previous = value(for: key)
        let newValue = !previous
        setValue(newValue, for: key)
        Task {
            do {
                try await db.collection("users").document(uid)
                    .updateData(["notificationSettings.\(key.rawValue)": newValue])
            } catch {
                setValue(previous, for: key)
            }
        }
    }

    private func value(for key: NotificationKey) -> Bool {
        switch key {
        case .workoutReminders: return workoutReminders
        case .tips: return tips
        case .newFollowers: return newFollowers
        case .communityActivity: return communityActivity
        case .clubUpdates: return clubUpdates
        }
    }

    private func setValue(_ value: Bool, for key: NotificationKey) {
        switch key {
        case .workoutReminders: workoutReminders = value
        case .tips: tips = value
        case .newFollowers: newFollowers = value
        case .communityActivity: communityActivity = value
        case .clubUpdates: clubUpdates = value
        }
    }

    /// Calls the real `deleteAccountData` Cloud Function (`functions/index.js`)
    /// -- deletes the Firestore user doc, avatar storage files under
    /// `avatars/{uid}`, and the Firebase Auth identity, all server-side.
    ///
    /// Note: Android's own delete-account dialog (`SettingsScreen.kt`) does
    /// NOT call this function -- it only runs client-side
    /// `FirebaseAuth.getInstance().currentUser?.delete()`, which removes the
    /// auth identity but leaves the Firestore user doc, run history, and
    /// avatar storage files orphaned. That looks like a real gap on Android's
    /// side rather than a deliberate choice worth mirroring, since
    /// `deleteAccountData` exists specifically to do this properly. This
    /// wires the correct, complete call instead of reproducing that gap.
    func deleteAccount() async -> Bool {
        isDeletingAccount = true
        deleteErrorMessage = nil
        defer { isDeletingAccount = false }
        do {
            _ = try await functions.httpsCallable("deleteAccountData").call()
            return true
        } catch {
            deleteErrorMessage = (error as NSError).localizedDescription
            return false
        }
    }
}

// MARK: – Section / row building blocks

private struct SettingsSection<Content: View>: View {
    let title: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
            Text(title.uppercased())
                .font(RuvoTheme.Typography.labelSmall)
                .tracking(RuvoTheme.Typography.Tracking.labelSmall)
                .foregroundColor(RuvoTheme.Colors.textTertiary)
                .padding(.horizontal, RuvoTheme.Spacing.xs)
            RuvoCard {
                VStack(spacing: 0) { content() }
            }
        }
    }
}

private struct SettingsRow: View {
    let icon: String
    let label: String
    var showDivider: Bool = true

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: RuvoTheme.Spacing.sm) {
                Image(systemName: icon)
                    .frame(width: 22)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
                Text(label)
                    .font(RuvoTheme.Typography.bodyMedium)
                    .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
            }
            .padding(RuvoTheme.Spacing.md)
            if showDivider {
                Divider().background(RuvoTheme.Colors.border)
            }
        }
    }
}

private struct SettingsToggleRow: View {
    let icon: String
    let label: String
    @Binding var isOn: Bool
    var showDivider: Bool = true

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: RuvoTheme.Spacing.sm) {
                Image(systemName: icon)
                    .frame(width: 22)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
                Text(label)
                    .font(RuvoTheme.Typography.bodyMedium)
                    .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Spacer()
                Toggle("", isOn: $isOn.animation(RuvoTheme.Motion.easeInOut(RuvoTheme.Motion.Duration.quick)))
                    .labelsHidden()
                    .tint(RuvoTheme.Colors.primary)
            }
            .padding(RuvoTheme.Spacing.md)
            if showDivider {
                Divider().background(RuvoTheme.Colors.border)
            }
        }
    }
}

private struct SettingsActionRow: View {
    let icon: String
    let label: String
    var isLoading: Bool = false
    var showDivider: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 0) {
                HStack(spacing: RuvoTheme.Spacing.sm) {
                    Image(systemName: icon)
                        .frame(width: 22)
                        .foregroundColor(RuvoTheme.Colors.error)
                    Text(label)
                        .font(RuvoTheme.Typography.bodyMedium)
                        .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                        .foregroundColor(RuvoTheme.Colors.error)
                    Spacer()
                    if isLoading {
                        ProgressView().tint(RuvoTheme.Colors.error)
                    }
                }
                .padding(RuvoTheme.Spacing.md)
                if showDivider {
                    Divider().background(RuvoTheme.Colors.border)
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }
}

/// Honest "not built yet" destination for Settings rows whose real screen is
/// separate follow-up work (Help Center, Privacy Controls) -- a real,
/// themed intermediate step up from the old stub's silent dead tap, not a
/// stand-in for actually building those screens.
struct ComingSoonView: View {
    let title: String
    let icon: String

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()
            VStack(spacing: RuvoTheme.Spacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 40))
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
                Text(title)
                    .font(RuvoTheme.Typography.headingSmall)
                    .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Text("This is coming in a future update.")
                    .font(RuvoTheme.Typography.bodyMedium)
                    .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, RuvoTheme.Spacing.xl)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}
