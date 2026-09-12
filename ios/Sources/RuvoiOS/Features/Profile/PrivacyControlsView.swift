import SwiftUI
import FirebaseAuth
import FirebaseFirestore

/// Real Privacy Controls screen -- ports Android's `PrivacyControlsScreen.kt`
/// (and its embedded `PrivacyViewModel`) field-for-field. Reachable via
/// `SettingsView`'s "Privacy Controls" row (Account section), replacing the
/// `ComingSoonView` placeholder that shipped first.
///
/// Firestore shape (verbatim mirror of Android's read/write -- all on
/// `users/{uid}`):
///  - `privacySettings.{profileVisibility, showActivityOnFeed,
///    showLocationOnMap, showStatsToOthers, whoCanFollow, whoCanComment,
///    whoCanSeeClubs}` -- same 7 keys, same defaults, same string enum
///    values ("public"/"friends"/"private", "everyone"/"friends"/"nobody")
///    Android uses. Written as a full replacement of the `privacySettings`
///    map on every change (matches Android's `PrivacyViewModel.update()`,
///    which always sends the complete map, not a per-key merge).
///  - `blocked: [String]` / `mutedUsers: [String]` -- unblock/unmute both do
///    a plain `FieldValue.arrayRemove(uid)` against the signed-in user's own
///    doc, same as Android's `unblockUser`/`unmuteUser`.
///
/// Checked every one of those fields against `firestore.rules`'s
/// `serverOnlyUserFields()` (`runHistory`, `weeklyDistance`, `currentXP`,
/// `coins`, `totalRuns`) -- unlike the referral-coins bug a teammate fixed
/// elsewhere, NONE of `privacySettings`/`blocked`/`mutedUsers` are on that
/// list. The rules file's own comment on the owner-update rule even names
/// `privacySettings` explicitly as one of the fields that rule is meant to
/// allow. So every write this screen makes is a legitimate, already-allowed
/// self-write under the existing rules -- no Cloud Function gap to flag here.
///
/// Two deliberate, non-field-affecting departures from Android's exact
/// composable shape:
///  - `resolveUsers` below fetches blocked/muted user info sequentially
///    instead of Android's parallel `async`/`awaitAll` -- same result, just
///    simpler Swift concurrency for what's normally a very short list.
///  - The "who can see/follow/comment" selects are rendered as an always-
///    visible `RuvoSelectionChip` row instead of Android's tap-to-expand
///    dropdown -- same options, same values, same labels, just this
///    platform's existing idiom for an exclusive "pick one" control (see
///    `LeaderboardView`'s scope/period chips).
struct PrivacySettings: Equatable {
    var profileVisibility: String = "public"
    var showActivityOnFeed: Bool = true
    var showLocationOnMap: Bool = true
    var showStatsToOthers: Bool = true
    var whoCanFollow: String = "everyone"
    var whoCanComment: String = "everyone"
    var whoCanSeeClubs: String = "everyone"
}

struct PrivacyBlockedUser: Identifiable, Equatable {
    let id: String
    let name: String
    let avatarUrl: String?
}

@MainActor
final class PrivacyControlsViewModel: ObservableObject {
    @Published var settings = PrivacySettings()
    @Published var blockedUsers: [PrivacyBlockedUser] = []
    @Published var mutedUsers: [PrivacyBlockedUser] = []

    private let db = Firestore.firestore()
    private var uid: String? { Auth.auth().currentUser?.uid }

    func load() {
        guard let uid else { return }
        Task {
            do {
                let data = try await db.collection("users").document(uid).getDocument().data()
                let p = data?["privacySettings"] as? [String: Any]
                let cur = PrivacySettings()
                settings = PrivacySettings(
                    profileVisibility: p?["profileVisibility"] as? String ?? cur.profileVisibility,
                    showActivityOnFeed: p?["showActivityOnFeed"] as? Bool ?? cur.showActivityOnFeed,
                    showLocationOnMap: p?["showLocationOnMap"] as? Bool ?? cur.showLocationOnMap,
                    showStatsToOthers: p?["showStatsToOthers"] as? Bool ?? cur.showStatsToOthers,
                    whoCanFollow: p?["whoCanFollow"] as? String ?? cur.whoCanFollow,
                    whoCanComment: p?["whoCanComment"] as? String ?? cur.whoCanComment,
                    whoCanSeeClubs: p?["whoCanSeeClubs"] as? String ?? cur.whoCanSeeClubs
                )
                let blockedIds = data?["blocked"] as? [String] ?? []
                let mutedIds = data?["mutedUsers"] as? [String] ?? []
                blockedUsers = await resolveUsers(blockedIds)
                mutedUsers = await resolveUsers(mutedIds)
            } catch {
                // Silent fallback to defaults -- matches Android's load().
            }
        }
    }

    /// Sequential lookups (see file doc comment) -- mirrors Android's field
    /// reads (`name`/`displayName`, `avatarUrl`/`avatar`) exactly, one
    /// `users/{id}` doc per blocked/muted id.
    private func resolveUsers(_ ids: [String]) async -> [PrivacyBlockedUser] {
        var results: [PrivacyBlockedUser] = []
        for id in ids {
            do {
                let snap = try await db.collection("users").document(id).getDocument()
                let name = (snap.get("name") as? String) ?? (snap.get("displayName") as? String) ?? "Unknown"
                let avatarUrl = (snap.get("avatarUrl") as? String) ?? (snap.get("avatar") as? String)
                results.append(PrivacyBlockedUser(id: id, name: name, avatarUrl: avatarUrl))
            } catch {
                results.append(PrivacyBlockedUser(id: id, name: "Unknown", avatarUrl: nil))
            }
        }
        return results
    }

    /// Optimistic update + full-map write + rollback-on-failure -- same
    /// pattern `SettingsViewModel` uses for `unitSystem`/notification
    /// toggles, applied here to whichever field of `settings` just changed.
    /// Sends the complete `privacySettings` map every time, matching
    /// Android's `update()` (which always re-sends all 7 keys, not just the
    /// one that changed).
    private func persist(previous: PrivacySettings) {
        guard let uid else { return }
        let updated = settings
        Task {
            do {
                try await db.collection("users").document(uid).updateData([
                    "privacySettings": [
                        "profileVisibility": updated.profileVisibility,
                        "showActivityOnFeed": updated.showActivityOnFeed,
                        "showLocationOnMap": updated.showLocationOnMap,
                        "showStatsToOthers": updated.showStatsToOthers,
                        "whoCanFollow": updated.whoCanFollow,
                        "whoCanComment": updated.whoCanComment,
                        "whoCanSeeClubs": updated.whoCanSeeClubs,
                    ],
                ])
            } catch {
                settings = previous
            }
        }
    }

    func setProfileVisibility(_ value: String) {
        guard settings.profileVisibility != value else { return }
        let previous = settings
        settings.profileVisibility = value
        persist(previous: previous)
    }

    func toggleShowActivityOnFeed() {
        let previous = settings
        settings.showActivityOnFeed.toggle()
        persist(previous: previous)
    }

    func toggleShowLocationOnMap() {
        let previous = settings
        settings.showLocationOnMap.toggle()
        persist(previous: previous)
    }

    func toggleShowStatsToOthers() {
        let previous = settings
        settings.showStatsToOthers.toggle()
        persist(previous: previous)
    }

    func setWhoCanFollow(_ value: String) {
        guard settings.whoCanFollow != value else { return }
        let previous = settings
        settings.whoCanFollow = value
        persist(previous: previous)
    }

    func setWhoCanComment(_ value: String) {
        guard settings.whoCanComment != value else { return }
        let previous = settings
        settings.whoCanComment = value
        persist(previous: previous)
    }

    func setWhoCanSeeClubs(_ value: String) {
        guard settings.whoCanSeeClubs != value else { return }
        let previous = settings
        settings.whoCanSeeClubs = value
        persist(previous: previous)
    }

    func unblockUser(_ userId: String) {
        guard let uid else { return }
        let previous = blockedUsers
        blockedUsers.removeAll { $0.id == userId }
        Task {
            do {
                try await db.collection("users").document(uid)
                    .updateData(["blocked": FieldValue.arrayRemove([userId])])
            } catch {
                blockedUsers = previous
            }
        }
    }

    func unmuteUser(_ userId: String) {
        guard let uid else { return }
        let previous = mutedUsers
        mutedUsers.removeAll { $0.id == userId }
        Task {
            do {
                try await db.collection("users").document(uid)
                    .updateData(["mutedUsers": FieldValue.arrayRemove([userId])])
            } catch {
                mutedUsers = previous
            }
        }
    }
}

struct PrivacyControlsView: View {
    @StateObject private var viewModel = PrivacyControlsViewModel()

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: RuvoTheme.Spacing.lg) {
                    PrivacySection(title: "Profile Visibility") {
                        PrivacyPickerRow(
                            label: "Who can see my profile",
                            desc: "Control who can view your profile and achievements",
                            options: [("public", "Public"), ("friends", "Friends Only"), ("private", "Private")],
                            selected: viewModel.settings.profileVisibility,
                            onSelect: { viewModel.setProfileVisibility($0) },
                            showDivider: false
                        )
                    }

                    PrivacySection(title: "Activity Settings") {
                        PrivacyToggleRow(
                            label: "Show Activity on Feed",
                            desc: "Allow your runs to appear on the community feed",
                            isOn: Binding(
                                get: { viewModel.settings.showActivityOnFeed },
                                set: { _ in viewModel.toggleShowActivityOnFeed() }
                            )
                        )
                        PrivacyToggleRow(
                            label: "Show Location on Map",
                            desc: "Display your GPS route on public feeds",
                            isOn: Binding(
                                get: { viewModel.settings.showLocationOnMap },
                                set: { _ in viewModel.toggleShowLocationOnMap() }
                            )
                        )
                        PrivacyToggleRow(
                            label: "Show Stats to Others",
                            desc: "Allow others to see your detailed statistics",
                            isOn: Binding(
                                get: { viewModel.settings.showStatsToOthers },
                                set: { _ in viewModel.toggleShowStatsToOthers() }
                            ),
                            showDivider: false
                        )
                    }

                    PrivacySection(title: "Social Permissions") {
                        PrivacyPickerRow(
                            label: "Who can follow me",
                            desc: "Control who can follow your profile",
                            options: [("everyone", "Everyone"), ("friends", "Friends Only"), ("nobody", "Nobody")],
                            selected: viewModel.settings.whoCanFollow,
                            onSelect: { viewModel.setWhoCanFollow($0) }
                        )
                        PrivacyPickerRow(
                            label: "Who can comment",
                            desc: "Control who can comment on your runs",
                            options: [("everyone", "Everyone"), ("friends", "Friends Only"), ("nobody", "Nobody")],
                            selected: viewModel.settings.whoCanComment,
                            onSelect: { viewModel.setWhoCanComment($0) }
                        )
                        PrivacyPickerRow(
                            label: "Who can see my clubs",
                            desc: "Control who can see which clubs you've joined",
                            options: [("everyone", "Everyone"), ("friends", "Friends Only")],
                            selected: viewModel.settings.whoCanSeeClubs,
                            onSelect: { viewModel.setWhoCanSeeClubs($0) },
                            showDivider: false
                        )
                    }

                    VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
                        Text("Blocked Users".uppercased())
                            .font(RuvoTheme.Typography.labelSmall)
                            .tracking(RuvoTheme.Typography.Tracking.labelSmall)
                            .foregroundColor(RuvoTheme.Colors.textTertiary)
                            .padding(.horizontal, RuvoTheme.Spacing.xs)
                        RuvoCard {
                            VStack(spacing: 0) {
                                if viewModel.blockedUsers.isEmpty {
                                    PrivacyEmptyState(icon: "checkmark.shield", text: "No blocked users")
                                } else {
                                    ForEach(Array(viewModel.blockedUsers.enumerated()), id: \.element.id) { index, user in
                                        PrivacyUserRow(
                                            user: user,
                                            actionLabel: "Unblock",
                                            isDestructiveAction: true,
                                            onAction: { viewModel.unblockUser(user.id) },
                                            showDivider: index < viewModel.blockedUsers.count - 1
                                        )
                                    }
                                }
                            }
                        }
                        Text("Blocked users cannot see your profile, follow you, or interact with your content.")
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textTertiary)
                            .padding(.horizontal, RuvoTheme.Spacing.xs)
                    }

                    VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
                        Text("Muted Users".uppercased())
                            .font(RuvoTheme.Typography.labelSmall)
                            .tracking(RuvoTheme.Typography.Tracking.labelSmall)
                            .foregroundColor(RuvoTheme.Colors.textTertiary)
                            .padding(.horizontal, RuvoTheme.Spacing.xs)
                        RuvoCard {
                            VStack(spacing: 0) {
                                if viewModel.mutedUsers.isEmpty {
                                    PrivacyEmptyState(icon: "speaker.slash", text: "No muted users")
                                } else {
                                    ForEach(Array(viewModel.mutedUsers.enumerated()), id: \.element.id) { index, user in
                                        PrivacyUserRow(
                                            user: user,
                                            actionLabel: "Unmute",
                                            isDestructiveAction: false,
                                            onAction: { viewModel.unmuteUser(user.id) },
                                            showDivider: index < viewModel.mutedUsers.count - 1
                                        )
                                    }
                                }
                            }
                        }
                        Text("Muted users will not appear on your feed, but they can still see your profile and interact with you.")
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textTertiary)
                            .padding(.horizontal, RuvoTheme.Spacing.xs)
                    }
                }
                .padding(RuvoTheme.Spacing.lg)
                .padding(.bottom, RuvoTheme.Spacing.xxl)
            }
        }
        .navigationTitle("Privacy Controls")
        .navigationBarTitleDisplayMode(.inline)
        .task { viewModel.load() }
    }
}

// MARK: – Section / row building blocks

private struct PrivacySection<Content: View>: View {
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

private struct PrivacyToggleRow: View {
    let label: String
    let desc: String
    @Binding var isOn: Bool
    var showDivider: Bool = true

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: RuvoTheme.Spacing.md) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(RuvoTheme.Typography.bodyMedium)
                        .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                        .foregroundColor(RuvoTheme.Colors.textPrimary)
                    Text(desc)
                        .font(RuvoTheme.Typography.bodySmall)
                        .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                }
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

private struct PrivacyPickerRow: View {
    let label: String
    let desc: String
    let options: [(value: String, label: String)]
    let selected: String
    let onSelect: (String) -> Void
    var showDivider: Bool = true

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(RuvoTheme.Typography.bodyMedium)
                        .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                        .foregroundColor(RuvoTheme.Colors.textPrimary)
                    Text(desc)
                        .font(RuvoTheme.Typography.bodySmall)
                        .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: RuvoTheme.Spacing.sm) {
                        ForEach(options, id: \.value) { option in
                            RuvoSelectionChip(
                                label: option.label,
                                isSelected: option.value == selected,
                                shape: AnyShape(Capsule()),
                                action: { onSelect(option.value) }
                            )
                            .frame(height: 36)
                            .fixedSize(horizontal: true, vertical: false)
                        }
                    }
                }
            }
            .padding(RuvoTheme.Spacing.md)
            if showDivider {
                Divider().background(RuvoTheme.Colors.border)
            }
        }
    }
}

private struct PrivacyEmptyState: View {
    let icon: String
    let text: String

    var body: some View {
        VStack(spacing: RuvoTheme.Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 28))
                .foregroundColor(RuvoTheme.Colors.textTertiary)
            Text(text)
                .font(RuvoTheme.Typography.bodySmall)
                .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                .foregroundColor(RuvoTheme.Colors.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, RuvoTheme.Spacing.xl)
    }
}

private struct PrivacyUserAvatar: View {
    let name: String
    let avatarUrl: String?

    var body: some View {
        Group {
            if let avatarUrl, let url = URL(string: avatarUrl) {
                AsyncImage(url: url) { img in
                    img.resizable().scaledToFill()
                } placeholder: {
                    initialsView
                }
            } else {
                initialsView
            }
        }
        .frame(width: 40, height: 40)
        .clipShape(Circle())
    }

    private var initialsView: some View {
        Circle()
            .fill(RuvoTheme.Colors.surfaceElevated)
            .overlay(
                Text(name.prefix(1).uppercased())
                    .font(RuvoTheme.Typography.bodyMedium)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
            )
    }
}

private struct PrivacyActionPill: View {
    let label: String
    var isDestructive: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(RuvoTheme.Typography.labelMedium)
                .tracking(RuvoTheme.Typography.Tracking.labelMedium)
                .fontWeight(.semibold)
                .foregroundColor(isDestructive ? .white : RuvoTheme.Colors.textPrimary)
                .padding(.horizontal, RuvoTheme.Spacing.md)
                .padding(.vertical, RuvoTheme.Spacing.xs)
                .background(
                    Capsule().fill(isDestructive ? RuvoTheme.Colors.error : RuvoTheme.Colors.surfaceElevated)
                )
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

private struct PrivacyUserRow: View {
    let user: PrivacyBlockedUser
    let actionLabel: String
    let isDestructiveAction: Bool
    let onAction: () -> Void
    var showDivider: Bool = true

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: RuvoTheme.Spacing.md) {
                PrivacyUserAvatar(name: user.name, avatarUrl: user.avatarUrl)
                Text(user.name)
                    .font(RuvoTheme.Typography.bodyMedium)
                    .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                    .fontWeight(.semibold)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Spacer()
                PrivacyActionPill(label: actionLabel, isDestructive: isDestructiveAction, action: onAction)
            }
            .padding(RuvoTheme.Spacing.md)
            if showDivider {
                Divider().background(RuvoTheme.Colors.border)
            }
        }
    }
}
