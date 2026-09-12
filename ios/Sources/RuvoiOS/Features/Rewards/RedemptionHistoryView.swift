import SwiftUI
import FirebaseAuth
import FirebaseFirestore

/// iOS counterpart to Android's `MyRedemptionsScreen.kt` -- the "known gap"
/// flagged in `RewardsView.swift`'s header comment. Reads the exact same
/// real Firestore shape Android's `MyRedemptionsViewModel` reads: the
/// `redeemReward` Cloud Function (`functions/index.js`) writes one document
/// per successful redemption to `users/{uid}/redemptions` inside its
/// transaction --
///
///     transaction.set(redemptionRef, {
///         rewardId,
///         title: title || "Unknown Reward",
///         price,
///         timestamp: FieldValue.serverTimestamp(),
///     })
///
/// -- so `rewardId`, `title`, `price`, `timestamp` are the only fields that
/// really exist server-side. No `code`/`brand`/`status`/`expiresAt` field is
/// ever written (Android's own comment on `RedemptionItem` confirms this and
/// notes RN's screen falls back to an "UNKNOWN" status for the same missing
/// fields), so this view doesn't fabricate any of those either -- it shows
/// the same static "sent to your email" line Android shows instead of a
/// per-item status/code.
struct RedemptionRecord: Identifiable {
    let id: String
    let title: String
    let price: Int
    let timestamp: Date?
}

@MainActor
final class RedemptionHistoryViewModel: ObservableObject {
    @Published private(set) var redemptions: [RedemptionRecord] = []
    @Published private(set) var isLoading = true

    private let db: Firestore
    private var listener: ListenerRegistration?

    init(db: Firestore = Firestore.firestore()) {
        self.db = db
        listen()
    }

    private func listen() {
        guard let uid = Auth.auth().currentUser?.uid else {
            isLoading = false
            return
        }
        listener = db.collection("users").document(uid).collection("redemptions")
            .order(by: "timestamp", descending: true)
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let self else { return }
                self.redemptions = snapshot?.documents.map { doc in
                    let data = doc.data()
                    return RedemptionRecord(
                        id: doc.documentID,
                        title: data["title"] as? String ?? "Unknown Reward",
                        price: (data["price"] as? NSNumber)?.intValue ?? 0,
                        timestamp: (data["timestamp"] as? Timestamp)?.dateValue()
                    )
                } ?? []
                self.isLoading = false
            }
    }

    deinit { listener?.remove() }
}

/// Pushed from `RewardsView` via `AppRoute.redemptionHistory`, matching how
/// Android's `RewardsScreen` pushes `MyRedemptionsScreen` from its "My
/// Rewards" pill button in the header (always visible, not conditional on
/// redemptions existing).
struct RedemptionHistoryView: View {
    @StateObject private var viewModel = RedemptionHistoryViewModel()

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, yyyy 'at' h:mm a"
        return formatter
    }()

    var body: some View {
        Group {
            if viewModel.isLoading {
                ProgressView()
                    .tint(RuvoTheme.Colors.primary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.redemptions.isEmpty {
                emptyState
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: RuvoTheme.Spacing.sm) {
                        ForEach(viewModel.redemptions) { redemption in
                            RedemptionRow(redemption: redemption, dateFormatter: Self.dateFormatter)
                        }
                    }
                    .padding(RuvoTheme.Spacing.md)
                    .padding(.bottom, RuvoTheme.Spacing.xxl)
                }
            }
        }
        .background(RuvoTheme.Colors.background.ignoresSafeArea())
        .navigationTitle("My Redemptions")
        .navigationBarTitleDisplayMode(.large)
    }

    private var emptyState: some View {
        VStack(spacing: RuvoTheme.Spacing.sm) {
            Image(systemName: "gift")
                .font(.system(size: 40))
                .foregroundColor(RuvoTheme.Colors.textTertiary)
            Text("No redemptions yet")
                .font(RuvoTheme.Typography.bodyMedium)
                .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                .foregroundColor(RuvoTheme.Colors.textSecondary)
            Text("Earn coins by running and redeem rewards!")
                .font(RuvoTheme.Typography.bodySmall)
                .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                .foregroundColor(RuvoTheme.Colors.textTertiary)
                .multilineTextAlignment(.center)
        }
        .padding(RuvoTheme.Spacing.xl)
    }
}

private struct RedemptionRow: View {
    let redemption: RedemptionRecord
    let dateFormatter: DateFormatter

    var body: some View {
        RuvoCard {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
                HStack {
                    Text(redemption.title)
                        .font(RuvoTheme.Typography.labelLarge)
                        .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                        .foregroundColor(RuvoTheme.Colors.textPrimary)
                    Spacer()
                    HStack(spacing: 4) {
                        Image(systemName: "dollarsign.circle.fill")
                            .foregroundColor(RuvoTheme.Colors.coinGold)
                        Text("\(redemption.price)")
                            .font(RuvoTheme.Typography.labelLarge)
                            .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                            .foregroundColor(RuvoTheme.Colors.coinGold)
                    }
                }
                if let timestamp = redemption.timestamp {
                    Text(dateFormatter.string(from: timestamp))
                        .font(RuvoTheme.Typography.bodySmall)
                        .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                }
                Text("Sent to your email — check your inbox for the code.")
                    .font(RuvoTheme.Typography.bodySmall)
                    .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}
