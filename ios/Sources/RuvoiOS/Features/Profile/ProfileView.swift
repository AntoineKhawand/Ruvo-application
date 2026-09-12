import SwiftUI

struct ProfileView: View {
    let userId: String
    @StateObject private var viewModel: ProfileViewModel
    @EnvironmentObject private var authService: AuthService
    @EnvironmentObject private var router: NavigationRouter

    init(userId: String) {
        self.userId = userId
        _viewModel = StateObject(wrappedValue: ProfileViewModel(userId: userId))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Hero header
                ProfileHeaderView(user: viewModel.user, isOwnProfile: viewModel.isOwnProfile)

                // Stats row
                if let user = viewModel.user {
                    ProfileStatsRow(user: user)
                        .padding(.horizontal, RuvoTheme.Spacing.lg)
                        .padding(.top, RuvoTheme.Spacing.md)
                }

                // Action buttons
                ProfileActionButtons(
                    isOwnProfile: viewModel.isOwnProfile,
                    isFollowing: viewModel.isFollowing,
                    onFollow: viewModel.toggleFollow,
                    onEdit: { viewModel.showEditProfile = true },
                    onSettings: { viewModel.showSettings = true }
                )
                .padding(.horizontal, RuvoTheme.Spacing.lg)
                .padding(.top, RuvoTheme.Spacing.md)

                // Achievements entry point -- own profile only, since the
                // Trophy Room always reads the signed-in user's own unlock
                // state (mirrors Android's AchievementsViewModel, which reads
                // `auth.currentUser`, not whichever profile is being viewed).
                if viewModel.isOwnProfile {
                    AchievementsEntryRow(onTap: { router.navigate(to: .achievements) })
                        .padding(.horizontal, RuvoTheme.Spacing.lg)
                        .padding(.top, RuvoTheme.Spacing.md)

                    LeaderboardEntryRow(onTap: { router.navigate(to: .leaderboard) })
                        .padding(.horizontal, RuvoTheme.Spacing.lg)
                        .padding(.top, RuvoTheme.Spacing.md)
                }

                Divider().background(RuvoTheme.Colors.border).padding(.top, RuvoTheme.Spacing.lg)

                // Recent runs grid
                RecentRunsGrid(runs: viewModel.recentRuns)
                    .padding(.top, RuvoTheme.Spacing.md)
            }
        }
        .background(RuvoTheme.Colors.background.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if viewModel.isOwnProfile {
                ToolbarItem(placement: .topBarTrailing) {
                    RuvoIconButton(icon: "gearshape.fill", action: { viewModel.showSettings = true })
                }
            }
        }
        .sheet(isPresented: $viewModel.showEditProfile) { EditProfileView(viewModel: viewModel) }
        .sheet(isPresented: $viewModel.showSettings) { SettingsView() }
        .task { await viewModel.loadProfile() }
    }
}

struct ProfileHeaderView: View {
    let user: RuvoUser?
    let isOwnProfile: Bool

    var body: some View {
        ZStack(alignment: .bottom) {
            // Cover gradient
            LinearGradient(
                colors: [RuvoTheme.Colors.primaryDim, RuvoTheme.Colors.background],
                startPoint: .top, endPoint: .bottom
            )
            .frame(height: 160)

            VStack(spacing: RuvoTheme.Spacing.sm) {
                // Avatar
                AsyncImage(url: URL(string: user?.avatarUrl ?? "")) { img in
                    img.resizable().scaledToFill()
                } placeholder: {
                    Circle()
                        .fill(RuvoTheme.Colors.surfaceElevated)
                        .overlay(
                            Image(systemName: "person.fill")
                                .font(.system(size: 36))
                                .foregroundColor(RuvoTheme.Colors.textTertiary)
                        )
                }
                .frame(width: 88, height: 88)
                .clipShape(Circle())
                .overlay(Circle().stroke(RuvoTheme.Colors.primary, lineWidth: 3))
                .shadow(color: RuvoTheme.Colors.primary.opacity(0.3), radius: 12)
                .offset(y: 44)
            }
        }
        .padding(.bottom, 44)

        VStack(spacing: 4) {
            HStack(spacing: 6) {
                Text(user?.displayName ?? "")
                    .font(RuvoTheme.Typography.headingLarge)
                    .tracking(RuvoTheme.Typography.Tracking.headingLarge)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                if user?.isVerified == true {
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundColor(RuvoTheme.Colors.primary)
                }
            }

            if let bio = user?.bio {
                Text(bio)
                    .font(RuvoTheme.Typography.bodySmall)
                    .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, RuvoTheme.Spacing.xl)
            }

            if let location = user?.location {
                HStack(spacing: 4) {
                    Image(systemName: "mappin").font(.caption)
                    Text(location).font(RuvoTheme.Typography.bodySmall)
                    .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                }
                .foregroundColor(RuvoTheme.Colors.textTertiary)
            }
        }
        .padding(.top, 12)
    }
}

struct ProfileStatsRow: View {
    let user: RuvoUser

    var body: some View {
        HStack(spacing: 0) {
            ProfileStat(value: "\(user.totalRuns)", label: "Runs")
            Divider().frame(height: 30).background(RuvoTheme.Colors.border)
            ProfileStat(value: String(format: "%.0f", user.totalDistanceKm), label: "km")
            Divider().frame(height: 30).background(RuvoTheme.Colors.border)
            ProfileStat(value: "\(user.followersCount)", label: "Followers")
            Divider().frame(height: 30).background(RuvoTheme.Colors.border)
            ProfileStat(value: "\(user.followingCount)", label: "Following")
        }
        .padding(RuvoTheme.Spacing.md)
        .background(RuvoTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: RuvoTheme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: RuvoTheme.Radius.lg).stroke(RuvoTheme.Colors.border, lineWidth: 1))
    }
}

struct ProfileStat: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(RuvoTheme.Typography.headingMedium)
                .tracking(RuvoTheme.Typography.Tracking.headingMedium)
                .foregroundColor(RuvoTheme.Colors.textPrimary)
            Text(label)
                .font(RuvoTheme.Typography.caption)
                .foregroundColor(RuvoTheme.Colors.textSecondary)
                .tracking(RuvoTheme.Typography.Tracking.caption)
        }
        .frame(maxWidth: .infinity)
    }
}

struct ProfileActionButtons: View {
    let isOwnProfile: Bool
    let isFollowing: Bool
    let onFollow: () -> Void
    let onEdit: () -> Void
    let onSettings: () -> Void

    var body: some View {
        if isOwnProfile {
            HStack(spacing: RuvoTheme.Spacing.sm) {
                RuvoButton(title: "Edit Profile", style: .secondary, action: onEdit)
                RuvoIconButton(icon: "gearshape.fill", action: onSettings)
            }
        } else {
            HStack(spacing: RuvoTheme.Spacing.sm) {
                RuvoButton(
                    title: isFollowing ? "Following" : "Follow",
                    style: isFollowing ? .secondary : .primary,
                    action: onFollow
                )
                RuvoButton(title: "Message", style: .secondary, action: {})
            }
        }
    }
}

/// Tappable teaser card that pushes `AchievementsView` (`AppRoute.achievements`)
/// onto the Profile tab's stack -- the actual data (real catalogue, real
/// unlock state) lives in that screen, not here. Mirrors Android's
/// `AchievementsPreviewCard` (`ProfileScreen.kt`) as a nav entry point, not a
/// duplicate of its content.
struct AchievementsEntryRow: View {
    let onTap: () -> Void

    var body: some View {
        RuvoSelectableCard(isSelected: false, action: onTap) {
            HStack(spacing: RuvoTheme.Spacing.sm) {
                Image(systemName: "trophy.fill")
                    .foregroundColor(RuvoTheme.Colors.primary)
                Text("Achievements")
                    .font(RuvoTheme.Typography.labelLarge)
                    .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}

/// Tappable teaser card that pushes `LeaderboardView` (`AppRoute.leaderboard`)
/// onto the Profile tab's stack -- sibling to `AchievementsEntryRow` above.
/// Android's own equivalent is a `ListItem` in `ProfileScreen.kt`'s account
/// menu (`Icon(Icons.Default.Leaderboard) { onNavigate("leaderboard") }`),
/// not a preview card, but this follows the card-row convention this file
/// already established for Achievements rather than introducing a second,
/// menu-list-style entry-point pattern for a single row.
struct LeaderboardEntryRow: View {
    let onTap: () -> Void

    var body: some View {
        RuvoSelectableCard(isSelected: false, action: onTap) {
            HStack(spacing: RuvoTheme.Spacing.sm) {
                Image(systemName: "list.number")
                    .foregroundColor(RuvoTheme.Colors.primary)
                Text("Leaderboard")
                    .font(RuvoTheme.Typography.labelLarge)
                    .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}

struct RecentRunsGrid: View {
    let runs: [RunRecord]

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: RuvoTheme.Spacing.sm) {
            ForEach(runs) { run in
                RunMiniCard(run: run)
            }
        }
        .padding(.horizontal, RuvoTheme.Spacing.lg)
    }
}

struct RunMiniCard: View {
    let run: RunRecord

    var body: some View {
        RuvoCard {
            VStack(alignment: .leading, spacing: 8) {
                Text(run.startedAt, style: .date)
                    .font(RuvoTheme.Typography.caption)
                    .tracking(RuvoTheme.Typography.Tracking.caption)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
                Text(String(format: "%.2f km", run.distanceKm))
                    .font(RuvoTheme.Typography.headingMedium)
                    .tracking(RuvoTheme.Typography.Tracking.headingMedium)
                    .foregroundColor(RuvoTheme.Colors.primary)
                Text(run.averagePaceMinPerKm.formattedPace + "/km")
                    .font(RuvoTheme.Typography.bodySmall)
                    .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
            }
            .padding(RuvoTheme.Spacing.sm)
        }
    }
}

struct EditProfileView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: ProfileViewModel
    @State private var displayName = ""
    @State private var bio = ""
    @State private var location = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Profile") {
                    RuvoTextField(placeholder: "Display Name", text: $displayName, icon: "person")
                    RuvoTextField(placeholder: "Bio", text: $bio, icon: "text.quote")
                    RuvoTextField(placeholder: "Location", text: $location, icon: "mappin")
                }
            }
            .scrollContentBackground(.hidden)
            .background(RuvoTheme.Colors.background)
            .navigationTitle("Edit Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        Task {
                            await viewModel.updateProfile(displayName: displayName, bio: bio, location: location)
                            dismiss()
                        }
                    }
                    .fontWeight(.bold)
                    .tint(RuvoTheme.Colors.primary)
                }
            }
        }
        .onAppear {
            displayName = viewModel.user?.displayName ?? ""
            bio = viewModel.user?.bio ?? ""
            location = viewModel.user?.location ?? ""
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject private var authService: AuthService
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Account") {
                    Label("Privacy Settings", systemImage: "lock.shield")
                    Label("Notifications", systemImage: "bell")
                    Label("Connected Devices", systemImage: "applewatch")
                    Label("Subscription", systemImage: "crown")
                }
                Section("General") {
                    Label("Units (km/mi)", systemImage: "ruler")
                    Label("Data Export", systemImage: "square.and.arrow.up")
                    Label("About RUVO", systemImage: "info.circle")
                }
                Section {
                    Button("Sign Out", role: .destructive) {
                        try? authService.signOut()
                        dismiss()
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(RuvoTheme.Colors.background)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
        }
    }
}
