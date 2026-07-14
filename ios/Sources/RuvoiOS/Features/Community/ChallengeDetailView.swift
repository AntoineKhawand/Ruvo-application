import SwiftUI
import FirebaseFirestore
import FirebaseAuth

struct ChallengeDetailView: View {
    let challenge: Challenge
    @StateObject private var vm: ChallengeDetailViewModel
    @Environment(\.dismiss) private var dismiss

    init(challenge: Challenge) {
        self.challenge = challenge
        _vm = StateObject(wrappedValue: ChallengeDetailViewModel(challenge: challenge))
    }

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 20) {
                    heroSection
                    progressSection
                    rewardSection
                    participantsSection
                }
                .padding()
            }
        }
        .navigationTitle(challenge.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if !vm.isJoined {
                    Button("Join") { vm.joinChallenge() }
                        .foregroundColor(RuvoTheme.Colors.primary)
                        .font(RuvoTheme.Typography.labelLarge)
                } else {
                    Label("Joined", systemImage: "checkmark.circle.fill")
                        .foregroundColor(RuvoTheme.Colors.primary)
                        .font(RuvoTheme.Typography.labelLarge)
                }
            }
        }
        .task { await vm.load() }
    }

    // MARK: Hero
    private var heroSection: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(RuvoTheme.Colors.primary.opacity(0.15))
                    .frame(width: 80, height: 80)
                Image(systemName: challengeIcon)
                    .font(.system(size: 40))
                    .foregroundColor(RuvoTheme.Colors.primary)
            }
            Text(challenge.title)
                .font(RuvoTheme.Typography.displayMedium)
                .foregroundColor(.white)
            Text(challenge.description)
                .font(RuvoTheme.Typography.bodyMedium)
                .foregroundColor(RuvoTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
            // Time remaining
            HStack(spacing: 8) {
                Image(systemName: "clock")
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
                Text(vm.timeRemainingLabel)
                    .font(RuvoTheme.Typography.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
            }
        }
    }

    private var challengeIcon: String {
        switch challenge.type {
        case .distance: return "figure.run"
        case .streak: return "flame.fill"
        case .elevation: return "mountain.2.fill"
        case .speed: return "bolt.fill"
        case .social: return "person.2.fill"
        }
    }

    // MARK: Progress
    private var progressSection: some View {
        RuvoCard {
            VStack(spacing: 16) {
                HStack {
                    Text("Your Progress")
                        .font(RuvoTheme.Typography.headingMedium)
                        .foregroundColor(.white)
                    Spacer()
                    Text(String(format: "%.0f%%", vm.progressFraction * 100))
                        .font(RuvoTheme.Typography.labelLarge)
                        .foregroundColor(RuvoTheme.Colors.primary)
                }
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(RuvoTheme.Colors.border)
                            .frame(height: 8)
                        RoundedRectangle(cornerRadius: 4)
                            .fill(RuvoTheme.Colors.primary)
                            .frame(width: geo.size.width * CGFloat(vm.progressFraction), height: 8)
                    }
                }
                .frame(height: 8)
                HStack {
                    Text(String(format: "%.1f %@ of %.1f %@", vm.currentValue, challenge.unit, challenge.targetValue, challenge.unit))
                        .font(RuvoTheme.Typography.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                    Spacer()
                    Text("Target")
                        .font(RuvoTheme.Typography.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                }
            }
            .padding(20)
        }
    }

    // MARK: Rewards
    private var rewardSection: some View {
        RuvoCard {
            HStack(spacing: 20) {
                VStack(spacing: 4) {
                    Text("⚡")
                        .font(.system(size: 28))
                    Text("+\(challenge.rewardXP) XP")
                        .font(RuvoTheme.Typography.labelLarge)
                        .foregroundColor(RuvoTheme.Colors.primary)
                    Text("On Completion")
                        .font(RuvoTheme.Typography.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                }
                .frame(maxWidth: .infinity)
                Divider().frame(height: 60).background(RuvoTheme.Colors.border)
                VStack(spacing: 4) {
                    Text("🪙")
                        .font(.system(size: 28))
                    Text("+\(challenge.rewardCoins) Coins")
                        .font(RuvoTheme.Typography.labelLarge)
                        .foregroundColor(Color(hex: "#EAB308"))
                    Text("On Completion")
                        .font(RuvoTheme.Typography.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                }
                .frame(maxWidth: .infinity)
            }
            .padding(20)
        }
    }

    // MARK: Participants
    private var participantsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Participants")
                    .font(RuvoTheme.Typography.headingMedium)
                    .foregroundColor(.white)
                Spacer()
                Text("\(challenge.participantCount)")
                    .font(RuvoTheme.Typography.labelLarge)
                    .foregroundColor(RuvoTheme.Colors.primary)
            }
            ForEach(vm.topParticipants.prefix(5)) { p in
                HStack(spacing: 12) {
                    Text("#\(p.rank)")
                        .font(RuvoTheme.Typography.labelLarge)
                        .foregroundColor(p.rank <= 3 ? RuvoTheme.Colors.primary : RuvoTheme.Colors.textTertiary)
                        .frame(width: 28)
                    Circle()
                        .fill(RuvoTheme.Colors.surfaceElevated)
                        .frame(width: 32, height: 32)
                        .overlay(Circle().stroke(RuvoTheme.Colors.border, lineWidth: 1))
                    Text(p.displayName)
                        .font(RuvoTheme.Typography.labelLarge)
                        .foregroundColor(.white)
                    Spacer()
                    Text(String(format: "%.1f %@", p.value, challenge.unit))
                        .font(RuvoTheme.Typography.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                }
            }
        }
    }
}

// MARK: – ViewModel

struct ChallengeParticipant: Identifiable {
    let id: String
    let rank: Int
    let displayName: String
    let value: Double
}

@MainActor
final class ChallengeDetailViewModel: ObservableObject {
    @Published var isJoined = false
    @Published var progressFraction: Float = 0
    @Published var currentValue: Double = 0
    @Published var timeRemainingLabel = ""
    @Published var topParticipants: [ChallengeParticipant] = []

    private let challenge: Challenge
    private let db = Firestore.firestore()

    init(challenge: Challenge) {
        self.challenge = challenge
        updateTimeLabel()
    }

    func load() async {
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.checkJoinStatus() }
            group.addTask { await self.loadParticipants() }
        }
    }

    private func checkJoinStatus() async {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        do {
            let doc = try await db.collection("challenges").document(challenge.id)
                .collection("participants").document(uid).getDocument()
            isJoined = doc.exists
            if let data = doc.data() {
                currentValue = data["currentValue"] as? Double ?? 0
                progressFraction = Float(currentValue / challenge.targetValue)
            }
        } catch {}
    }

    private func loadParticipants() async {
        do {
            let snap = try await db.collection("challenges").document(challenge.id)
                .collection("participants")
                .order(by: "currentValue", descending: true)
                .limit(to: 10)
                .getDocuments()
            topParticipants = snap.documents.enumerated().compactMap { idx, doc in
                let data = doc.data()
                return ChallengeParticipant(
                    id: doc.documentID,
                    rank: idx + 1,
                    displayName: data["displayName"] as? String ?? "Runner",
                    value: data["currentValue"] as? Double ?? 0
                )
            }
        } catch {}
    }

    func joinChallenge() {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        isJoined = true
        Task {
            try? await db.collection("challenges").document(challenge.id)
                .collection("participants").document(uid)
                .setData(["userId": uid, "joinedAt": Timestamp(date: Date()), "currentValue": 0.0])
        }
    }

    private func updateTimeLabel() {
        let remaining = challenge.endsAt.timeIntervalSinceNow
        if remaining <= 0 { timeRemainingLabel = "Ended"; return }
        let days = Int(remaining / 86400)
        let hours = Int((remaining.truncatingRemainder(dividingBy: 86400)) / 3600)
        if days > 0 {
            timeRemainingLabel = "\(days)d \(hours)h remaining"
        } else {
            timeRemainingLabel = "\(hours)h remaining"
        }
    }
}
