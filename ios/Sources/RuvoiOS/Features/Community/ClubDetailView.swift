import SwiftUI
import FirebaseFirestore
import FirebaseAuth

struct ClubDetailView: View {
    let club: Club
    @StateObject private var vm: ClubDetailViewModel
    @Environment(\.dismiss) private var dismiss

    init(club: Club) {
        self.club = club
        _vm = StateObject(wrappedValue: ClubDetailViewModel(clubId: club.id))
    }

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 20) {
                    clubHeader
                    statsRow
                    if !vm.recentRuns.isEmpty {
                        recentActivitySection
                    }
                    membersSection
                }
                .padding()
            }
        }
        .navigationTitle(club.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(vm.isMember ? "Leave" : "Join") {
                    vm.toggleMembership()
                }
                .foregroundColor(vm.isMember ? RuvoTheme.Colors.textSecondary : RuvoTheme.Colors.primary)
                .font(RuvoTheme.Typography.labelLarge)
            }
        }
        .task { await vm.load() }
    }

    // MARK: Header
    private var clubHeader: some View {
        VStack(spacing: 12) {
            // Club emoji / avatar
            ZStack {
                Circle()
                    .fill(RuvoTheme.Colors.primary.opacity(0.15))
                    .frame(width: 80, height: 80)
                Text(club.emoji ?? "🏃")
                    .font(.system(size: 40))
            }
            Text(club.name)
                .font(RuvoTheme.Typography.displayMedium)
                .foregroundColor(.white)
            if let city = club.city {
                Label(city, systemImage: "location.fill")
                    .font(RuvoTheme.Typography.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
            }
            Text(club.description)
                .font(RuvoTheme.Typography.bodyMedium)
                .foregroundColor(RuvoTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: Stats
    private var statsRow: some View {
        HStack(spacing: 0) {
            ClubStat(label: "Members", value: "\(club.memberCount)")
            Divider().frame(height: 40).background(RuvoTheme.Colors.border)
            ClubStat(label: "Km/Week", value: String(format: "%.0f", club.weeklyDistanceKm))
            Divider().frame(height: 40).background(RuvoTheme.Colors.border)
            ClubStat(label: "Runs/Week", value: "\(vm.weeklyRuns)")
        }
        .padding(.vertical, 16)
        .background(RuvoTheme.Colors.surface)
        .cornerRadius(RuvoTheme.Radius.lg)
    }

    // MARK: Recent runs
    private var recentActivitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Activity")
                .font(RuvoTheme.Typography.headingMedium)
                .foregroundColor(.white)
            ForEach(vm.recentRuns.prefix(5)) { run in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(run.userDisplayName)
                            .font(RuvoTheme.Typography.labelLarge)
                            .foregroundColor(.white)
                        Text(String(format: "%.2f km · %@/km", run.distanceKm ?? 0, run.paceFormatted ?? "--:--"))
                            .font(RuvoTheme.Typography.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textSecondary)
                    }
                    Spacer()
                    Text(run.timeAgo)
                        .font(RuvoTheme.Typography.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                }
                .padding(14)
                .background(RuvoTheme.Colors.surfaceElevated)
                .cornerRadius(12)
            }
        }
    }

    // MARK: Members
    private var membersSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Members")
                .font(RuvoTheme.Typography.headingMedium)
                .foregroundColor(.white)
            if vm.members.isEmpty {
                Text("No members yet")
                    .font(RuvoTheme.Typography.bodyMedium)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
            } else {
                ForEach(vm.members.prefix(10)) { member in
                    HStack(spacing: 12) {
                        Circle()
                            .fill(RuvoTheme.Colors.surfaceElevated)
                            .frame(width: 36, height: 36)
                            .overlay(Circle().stroke(RuvoTheme.Colors.primary, lineWidth: 1))
                        Text(member.displayName)
                            .font(RuvoTheme.Typography.labelLarge)
                            .foregroundColor(.white)
                        Spacer()
                        Text("Lv.\(member.level)")
                            .font(RuvoTheme.Typography.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.primary)
                    }
                }
            }
        }
    }
}

private struct ClubStat: View {
    let label: String
    let value: String
    var body: some View {
        VStack(spacing: 4) {
            Text(value).font(RuvoTheme.Typography.displaySmall).foregroundColor(.white)
            Text(label).font(RuvoTheme.Typography.labelSmall).foregroundColor(RuvoTheme.Colors.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: – ViewModel

struct ClubMemberItem: Identifiable {
    let id: String
    let displayName: String
    let level: Int
}

struct ClubRunItem: Identifiable {
    let id: String
    let userDisplayName: String
    let distanceKm: Double?
    let paceFormatted: String?
    let timeAgo: String
}

@MainActor
final class ClubDetailViewModel: ObservableObject {
    @Published var members: [ClubMemberItem] = []
    @Published var recentRuns: [ClubRunItem] = []
    @Published var isMember = false
    @Published var weeklyRuns = 0

    private let clubId: String
    private let db = Firestore.firestore()

    init(clubId: String) {
        self.clubId = clubId
    }

    func load() async {
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadMembers() }
            group.addTask { await self.checkMembership() }
        }
    }

    private func loadMembers() async {
        do {
            let snap = try await db.collection("clubs").document(clubId).collection("members").limit(to: 20).getDocuments()
            members = snap.documents.compactMap { doc in
                let data = doc.data()
                return ClubMemberItem(
                    id: doc.documentID,
                    displayName: data["displayName"] as? String ?? "Runner",
                    level: data["level"] as? Int ?? 1
                )
            }
        } catch {}
    }

    private func checkMembership() async {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        do {
            let doc = try await db.collection("clubs").document(clubId).collection("members").document(uid).getDocument()
            isMember = doc.exists
        } catch {}
    }

    func toggleMembership() {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        let ref = db.collection("clubs").document(clubId).collection("members").document(uid)
        if isMember {
            isMember = false
            Task { try? await ref.delete() }
        } else {
            isMember = true
            Task { try? await ref.setData(["joinedAt": Timestamp(date: Date())]) }
        }
    }
}
