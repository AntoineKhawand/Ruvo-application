import SwiftUI
import FirebaseAuth
import FirebaseFirestore

// MARK: – Redeem status

/// Mirrors Android's `RedeemStatus` sealed class (`ReferralScreen.kt`) 1:1.
enum ReferralRedeemStatus: Equatable {
    case idle
    case loading
    case success(coinsAwarded: Int)
    case error(String)
}

// MARK: – ViewModel

/// Faithful port of Android's `ReferralViewModel` -- which lives inline in
/// `ReferralScreen.kt`, not its own file, alongside the composable it backs.
/// Same Firestore shape, same two flows:
///
/// 1. **Own code display** (`load()`): reads `users/{uid}`. If
///    `referralCode` is blank, generates one client-side
///    (`firstName.uppercased().filter(A-Z).take(4)` + a random 4-digit
///    suffix, "RUNR" fallback) and writes it back -- exactly Android's
///    `generateReferralCode`. Progress shown is `referralStats.totalInvites`
///    / `referralStats.coinsEarned`, both denormalized ints on the same doc.
///
/// 2. **Redeeming a friend's code** (`redeemCode()`): looks up
///    `users` where `referralCode == code`, then runs a **client-side
///    `WriteBatch`** that directly increments `coins` on BOTH the
///    referrer's doc and the redeeming user's own doc, and sets
///    `usedReferral = true` on the redeemer. There is no Cloud Function
///    anywhere in this flow -- Android's real implementation trusts the
///    redeeming client completely to report "yes, I have a valid code and
///    haven't redeemed before."
///
/// **Cross-platform gap, now fixed server-side but NOT yet wired into
/// either client (deliberately, per the backend follow-up that added
/// this note):** this repo's `firestore.rules` (see its
/// `serverOnlyUserFields()`, which lists `"coins"` explicitly, and the
/// `/users/{uid}` `allow update` rule, which rejects any self-update
/// touching those fields and has no cross-user update rule covering a
/// referrer's doc at all beyond `followers` toggles) is written
/// specifically to block exactly this kind of direct client write to
/// `coins`. That hardening (see this repo's "SECURITY: saveRunActivity
/// had zero server-side plausibility checks" pass) was never reconciled
/// with `ReferralScreen.kt`'s own redeem flow -- so on both platforms
/// today this batch write fails with a Firestore PERMISSION_DENIED the
/// moment a real signed-in user tries it (surfaced inline via
/// `redeemStatus = .error(...)`, not a crash).
///
/// TODO(follow-up, platform eng — NOT wired yet, do not assume this
/// works live): `functions/index.js` now exports `redeemReferralCode`, a
/// callable Cloud Function that does this exact lookup + `usedReferral`
/// check + coin credit atomically via an Admin-SDK Firestore transaction
/// (see that function for the full validation: rejects an unknown code,
/// your own code, and a caller who already has `usedReferral == true`).
/// To wire this up, replace the body of `redeemCode()` below with:
/// ```swift
/// let callable = Functions.functions().httpsCallable("redeemReferralCode")
/// let result = try await callable.call(["code": code])
/// // result.data as? [String: Any]:
/// //   "success" == true, "coinsAwarded" == Int (e.g. 100)
/// // Errors surface as NSError with an FunctionsErrorCode via
/// // `error.code`, matching HttpsError codes: invalidArgument (blank/own
/// // code), notFound (code not found / user doc missing),
/// // failedPrecondition (usedReferral already true), unauthenticated,
/// // internal.
/// ```
/// No more direct Firestore reads/writes are needed client-side for the
/// redeem path once this is wired -- delete the `WriteBatch` and the two
/// `getDocument()` lookups in `redeemCode()` entirely. This port keeps
/// the same batch shape, same trust model, same failure mode as Android
/// deliberately -- rewiring both clients to the new function is real
/// live-testable work for whoever owns the Android/iOS referral surfaces
/// next, not something to do blind in this pass.
@MainActor
final class ReferralViewModel: ObservableObject {
    @Published private(set) var referralCode: String = ""
    @Published private(set) var coinsEarned: Int = 0
    @Published private(set) var referralCount: Int = 0
    @Published private(set) var redeemStatus: ReferralRedeemStatus = .idle
    @Published private(set) var isLoading = true
    @Published var redeemCodeInput: String = ""

    /// Verbatim port of Android's inline `rank` thresholds in `ReferralScreen`.
    var rank: String {
        switch referralCount {
        case 5...:  return "Gold"
        case 2...4: return "Silver"
        default:    return "New"
        }
    }

    private let db: Firestore
    private var didStart = false

    init(db: Firestore = Firestore.firestore()) {
        self.db = db
    }

    func start() {
        guard !didStart else { return }
        didStart = true
        Task { await load() }
    }

    private func load() async {
        guard let uid = Auth.auth().currentUser?.uid else {
            isLoading = false
            return
        }
        do {
            let ref = db.collection("users").document(uid)
            let doc = try await ref.getDocument()
            guard let data = doc.data() else {
                isLoading = false
                return
            }

            var code = data["referralCode"] as? String
            if code?.isEmpty != false {
                let name = (data["name"] as? String) ?? (data["displayName"] as? String) ?? "RUNNER"
                let generated = Self.generateReferralCode(name: name)
                try await ref.updateData(["referralCode": generated])
                code = generated
            }

            let stats = data["referralStats"] as? [String: Any]
            referralCode = code ?? ""
            coinsEarned = Self.intValue(stats?["coinsEarned"])
            referralCount = Self.intValue(stats?["totalInvites"])
            isLoading = false
        } catch {
            isLoading = false
        }
    }

    /// Verbatim port of Android's `onRedeemCodeChange` -- typing clears
    /// whatever error/success banner is showing, same as `ReferralScreen`.
    func onRedeemCodeChange(_ text: String) {
        redeemCodeInput = text
        if redeemStatus != .idle {
            redeemStatus = .idle
        }
    }

    // TODO(follow-up): this still does the unsafe client-side WriteBatch
    // described in the type doc comment above -- blocked server-side by
    // firestore.rules's serverOnlyUserFields() ("coins") for every real
    // user. Replace with a call to the `redeemReferralCode` callable
    // Cloud Function (functions/index.js) instead of fixing/expanding
    // this batch.
    func redeemCode() {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        let code = redeemCodeInput.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard !code.isEmpty else {
            redeemStatus = .error("Enter a referral code")
            return
        }
        redeemStatus = .loading

        Task {
            do {
                let snapshot = try await db.collection("users")
                    .whereField("referralCode", isEqualTo: code)
                    .limit(to: 1)
                    .getDocuments()

                guard let referrerDoc = snapshot.documents.first else {
                    redeemStatus = .error("Code not found")
                    return
                }
                guard referrerDoc.documentID != uid else {
                    redeemStatus = .error("You can't use your own code")
                    return
                }

                let meRef = db.collection("users").document(uid)
                let meDoc = try await meRef.getDocument()
                if meDoc.data()?["usedReferral"] as? Bool == true {
                    redeemStatus = .error("You've already used a referral code")
                    return
                }

                let coinsPerReferral = 100
                let batch = db.batch()
                batch.updateData([
                    "coins": FieldValue.increment(Int64(coinsPerReferral)),
                    "referralStats.totalInvites": FieldValue.increment(Int64(1)),
                    "referralStats.coinsEarned": FieldValue.increment(Int64(coinsPerReferral)),
                ], forDocument: referrerDoc.reference)
                batch.updateData([
                    "coins": FieldValue.increment(Int64(coinsPerReferral)),
                    "usedReferral": true,
                ], forDocument: meRef)
                try await batch.commit()

                redeemStatus = .success(coinsAwarded: coinsPerReferral)
                redeemCodeInput = ""
                await load()
            } catch {
                redeemStatus = .error(error.localizedDescription)
            }
        }
    }

    /// Verbatim port of Android's `generateReferralCode(name)`.
    static func generateReferralCode(name: String) -> String {
        let firstName = name.split(separator: " ").first.map(String.init) ?? name
        let letters = firstName.uppercased().filter { $0 >= "A" && $0 <= "Z" }
        let prefix = letters.isEmpty ? "RUNR" : String(letters.prefix(4))
        let suffix = Int.random(in: 1000...9999)
        return "\(prefix)\(suffix)"
    }

    private static func intValue(_ raw: Any?) -> Int {
        if let i = raw as? Int { return i }
        if let n = raw as? NSNumber { return n.intValue }
        return 0
    }
}

// MARK: – Share text

/// Verbatim port of Android's `shareReferralCode()` `Intent.EXTRA_TEXT` --
/// same copy, same URL. Android hands this to `Intent.createChooser`; here
/// it's handed to `ShareLink`, which presents the native `UIActivityViewController`
/// share sheet directly (this codebase's deployment target is iOS 17 --
/// see `Package.swift`'s `.iOS(.v17)` -- so `ShareLink` is available with no
/// need for a `UIViewControllerRepresentable` fallback).
private func referralShareMessage(code: String) -> String {
    "Join me on RUVO — the premium running app! Use my code \(code) to get 100 bonus coins. Download: https://ruvoapp.com"
}

// MARK: – View

/// Standalone Refer & Earn screen -- mirrors Android's `ReferralScreen.kt`.
/// Reachable from the Profile tab via `AppRoute.referral`, pushed from
/// `ReferralEntryRow` on `ProfileView` (Android's own entry point is a
/// `ListItem` in `ProfileScreen.kt`'s account menu: "Refer & Earn" /
/// `Icons.Default.CardGiftcard` / `onNavigate("referral")`).
struct ReferralView: View {
    @StateObject private var viewModel = ReferralViewModel()
    @State private var codeCopied = false

    private var redeemBinding: Binding<String> {
        Binding(get: { viewModel.redeemCodeInput }, set: viewModel.onRedeemCodeChange)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: RuvoTheme.Spacing.lg) {
                hero

                statsRow
                    .padding(.horizontal, RuvoTheme.Spacing.lg)

                codeCard
                    .padding(.horizontal, RuvoTheme.Spacing.lg)

                inviteButton
                    .padding(.horizontal, RuvoTheme.Spacing.lg)

                howItWorksCard
                    .padding(.horizontal, RuvoTheme.Spacing.lg)

                redeemCard
                    .padding(.horizontal, RuvoTheme.Spacing.lg)

                Text("Coins are credited once your friend completes signup. One bonus per account. Terms apply.")
                    .font(RuvoTheme.Typography.bodySmall)
                    .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textTertiary.opacity(0.6))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, RuvoTheme.Spacing.xl)
            }
            .padding(.vertical, RuvoTheme.Spacing.lg)
        }
        .background(RuvoTheme.Colors.background.ignoresSafeArea())
        .navigationTitle("Refer & Earn")
        .navigationBarTitleDisplayMode(.large)
        .onAppear { viewModel.start() }
        .task(id: codeCopied) {
            guard codeCopied else { return }
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            codeCopied = false
        }
    }

    // MARK: Hero

    private var hero: some View {
        VStack(spacing: RuvoTheme.Spacing.md) {
            ZStack {
                Circle()
                    .fill(RuvoTheme.Colors.primary.opacity(0.18))
                    .frame(width: 100, height: 100)
                Circle()
                    .fill(RuvoTheme.Colors.primary)
                    .frame(width: 76, height: 76)
                Image(systemName: "gift.fill")
                    .font(.system(size: 32))
                    .foregroundColor(.black)
            }

            Text("Invite Friends,\nEarn Together")
                .font(RuvoTheme.Typography.headingMedium)
                .tracking(RuvoTheme.Typography.Tracking.headingMedium)
                .foregroundColor(RuvoTheme.Colors.textPrimary)
                .multilineTextAlignment(.center)

            (
                Text("Share your code — when a friend joins RUVO,\n")
                + Text("both of you earn 100 coins").foregroundColor(RuvoTheme.Colors.primary).fontWeight(.semibold)
                + Text(" instantly.")
            )
            .font(RuvoTheme.Typography.bodyMedium)
            .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
            .foregroundColor(RuvoTheme.Colors.textSecondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, RuvoTheme.Spacing.md)
        }
    }

    // MARK: Stats

    private var statsRow: some View {
        HStack(spacing: RuvoTheme.Spacing.sm) {
            ReferralStatTile(icon: "person.2.fill", label: "Friends Invited", value: "\(viewModel.referralCount)")
            ReferralStatTile(icon: "bolt.fill", label: "Coins Earned", value: "\(viewModel.coinsEarned)", isAccent: true)
            ReferralStatTile(icon: "rosette", label: "Rank", value: viewModel.rank)
        }
    }

    // MARK: Code card

    private var codeCard: some View {
        RuvoCard {
            VStack(spacing: RuvoTheme.Spacing.md) {
                Text("YOUR REFERRAL CODE")
                    .font(RuvoTheme.Typography.caption)
                    .tracking(RuvoTheme.Typography.Tracking.caption)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)

                Text(viewModel.referralCode.isEmpty ? "Loading…" : viewModel.referralCode)
                    .font(RuvoTheme.Typography.headingMedium)
                    .tracking(4)
                    .foregroundColor(RuvoTheme.Colors.primary)
                    .padding(.horizontal, RuvoTheme.Spacing.xl)
                    .padding(.vertical, RuvoTheme.Spacing.sm)
                    .background(
                        RoundedRectangle(cornerRadius: RuvoTheme.Radius.md)
                            .fill(RuvoTheme.Colors.primary.opacity(0.05))
                            .overlay(
                                RoundedRectangle(cornerRadius: RuvoTheme.Radius.md)
                                    .stroke(RuvoTheme.Colors.primary.opacity(0.35), lineWidth: 1.5)
                            )
                    )

                HStack(spacing: RuvoTheme.Spacing.md) {
                    Button {
                        UIPasteboard.general.string = viewModel.referralCode
                        codeCopied = true
                    } label: {
                        Label(codeCopied ? "Copied!" : "Copy", systemImage: codeCopied ? "checkmark.circle.fill" : "doc.on.doc")
                    }
                    .font(RuvoTheme.Typography.labelLarge)
                    .foregroundColor(codeCopied ? RuvoTheme.Colors.primary : RuvoTheme.Colors.textTertiary)
                    .disabled(viewModel.referralCode.isEmpty)

                    Rectangle()
                        .fill(RuvoTheme.Colors.border)
                        .frame(width: 1, height: 18)

                    ShareLink(item: referralShareMessage(code: viewModel.referralCode)) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                    .font(RuvoTheme.Typography.labelLarge)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
                    .disabled(viewModel.referralCode.isEmpty)
                }
            }
            .padding(RuvoTheme.Spacing.lg)
        }
    }

    // MARK: Invite button

    private var inviteButton: some View {
        ShareLink(item: referralShareMessage(code: viewModel.referralCode)) {
            HStack(spacing: RuvoTheme.Spacing.sm) {
                Image(systemName: "paperplane.fill")
                Text("Invite Friends Now")
                    .font(RuvoTheme.Typography.labelLarge)
                    .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                    .fontWeight(.bold)
            }
            .foregroundColor(.black)
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .background(
                LinearGradient(
                    colors: [RuvoTheme.Colors.primary, Color(hex: "#A8CC00")],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: RuvoTheme.Radius.md))
        }
        .disabled(viewModel.referralCode.isEmpty)
        .buttonStyle(ScaleButtonStyle())
    }

    // MARK: How it works

    private var howItWorksCard: some View {
        RuvoCard {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.md) {
                Text("How it works")
                    .font(RuvoTheme.Typography.headingSmall)
                    .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)

                ForEach(Array(ReferralStep.steps.enumerated()), id: \.offset) { index, step in
                    ReferralStepRow(index: index + 1, step: step)
                }
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }

    // MARK: Redeem

    private var redeemCard: some View {
        RuvoCard {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.md) {
                HStack(alignment: .top, spacing: RuvoTheme.Spacing.md) {
                    ZStack {
                        RoundedRectangle(cornerRadius: RuvoTheme.Radius.sm)
                            .fill(RuvoTheme.Colors.primary.opacity(0.1))
                            .frame(width: 36, height: 36)
                        Image(systemName: "ticket.fill")
                            .foregroundColor(RuvoTheme.Colors.primary)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Have a friend's code?")
                            .font(RuvoTheme.Typography.headingSmall)
                            .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                        Text("Enter it to claim your 100 coins welcome bonus.")
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textTertiary)
                    }
                }

                HStack(spacing: RuvoTheme.Spacing.sm) {
                    RuvoTextField(placeholder: "e.g. RUVO1234", text: redeemBinding, autocapitalization: .characters)

                    RuvoButton(
                        title: "Apply",
                        style: .primary,
                        isLoading: viewModel.redeemStatus == .loading,
                        isFullWidth: false,
                        action: viewModel.redeemCode
                    )
                    .disabled(viewModel.redeemStatus == .loading || viewModel.redeemCodeInput.isEmpty)
                }

                if case .error(let message) = viewModel.redeemStatus {
                    Text(message)
                        .font(RuvoTheme.Typography.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.error)
                }

                if case .success(let coins) = viewModel.redeemStatus {
                    HStack(spacing: RuvoTheme.Spacing.sm) {
                        Image(systemName: "bolt.fill")
                            .foregroundColor(RuvoTheme.Colors.primary)
                        Text("+\(coins) coins added to your account!")
                            .font(RuvoTheme.Typography.bodyMedium)
                            .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                            .foregroundColor(RuvoTheme.Colors.primary)
                            .fontWeight(.semibold)
                    }
                    .padding(RuvoTheme.Spacing.sm)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: RuvoTheme.Radius.md)
                            .fill(RuvoTheme.Colors.primary.opacity(0.12))
                    )
                }
            }
            .padding(RuvoTheme.Spacing.md)
        }
        .animation(RuvoTheme.Motion.easeInOut(RuvoTheme.Motion.Duration.quick), value: viewModel.redeemStatus)
    }
}

// MARK: – Stat tile

/// Sibling to `LeaderboardView.swift`'s private `RankedRunnerRow` and
/// `RewardsView.swift`'s `RewardCard` -- a small file-local card built on
/// the shared `RuvoCard` shell rather than reusing `RuvoStatCard`
/// (`RuvoCard.swift`), whose label/value/unit shape doesn't carry an icon.
/// Mirrors Android's private `StatCard` composable in `ReferralScreen.kt`.
private struct ReferralStatTile: View {
    let icon: String
    let label: String
    let value: String
    var isAccent: Bool = false

    var body: some View {
        RuvoCard {
            VStack(spacing: RuvoTheme.Spacing.xs) {
                ZStack {
                    Circle()
                        .fill(RuvoTheme.Colors.primary.opacity(0.12))
                        .frame(width: 32, height: 32)
                    Image(systemName: icon)
                        .font(.system(size: 14))
                        .foregroundColor(RuvoTheme.Colors.primary)
                }
                Text(value)
                    .font(RuvoTheme.Typography.headingSmall)
                    .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                    .foregroundColor(isAccent ? RuvoTheme.Colors.primary : RuvoTheme.Colors.textPrimary)
                Text(label)
                    .font(RuvoTheme.Typography.labelSmall)
                    .tracking(RuvoTheme.Typography.Tracking.labelSmall)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, RuvoTheme.Spacing.sm)
            .padding(.horizontal, RuvoTheme.Spacing.xs)
        }
    }
}

// MARK: – How-it-works step

/// Verbatim port of Android's private `ReferralStep` data class + the
/// `REFERRAL_STEPS` constant in `ReferralScreen.kt` -- same three steps,
/// same copy, same order.
private struct ReferralStep {
    let icon: String
    let title: String
    let description: String

    static let steps: [ReferralStep] = [
        ReferralStep(icon: "square.and.arrow.up", title: "Share your code", description: "Send your unique code to friends via any app"),
        ReferralStep(icon: "person.badge.plus", title: "Friend joins RUVO", description: "They sign up and enter your referral code"),
        ReferralStep(icon: "bolt.fill", title: "Both earn 100 coins", description: "Reward lands instantly in both accounts"),
    ]
}

private struct ReferralStepRow: View {
    let index: Int
    let step: ReferralStep

    var body: some View {
        HStack(alignment: .top, spacing: RuvoTheme.Spacing.sm) {
            ZStack {
                Circle()
                    .fill(RuvoTheme.Colors.primary.opacity(0.15))
                    .overlay(Circle().stroke(RuvoTheme.Colors.primary.opacity(0.4), lineWidth: 1))
                    .frame(width: 22, height: 22)
                Text("\(index)")
                    .font(RuvoTheme.Typography.labelSmall)
                    .foregroundColor(RuvoTheme.Colors.primary)
            }
            .frame(width: 28)

            ZStack {
                RoundedRectangle(cornerRadius: RuvoTheme.Radius.sm)
                    .fill(RuvoTheme.Colors.primary.opacity(0.1))
                    .frame(width: 36, height: 36)
                Image(systemName: step.icon)
                    .foregroundColor(RuvoTheme.Colors.primary)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(step.title)
                    .font(RuvoTheme.Typography.labelLarge)
                    .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Text(step.description)
                    .font(RuvoTheme.Typography.bodySmall)
                    .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
            }
            .padding(.bottom, RuvoTheme.Spacing.md)

            Spacer(minLength: 0)
        }
    }
}
