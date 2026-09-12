import SwiftUI
import FirebaseFirestore

/// Real Help Center screen -- ports Android's `HelpCenterScreen.kt` (and its
/// embedded `HelpCenterViewModel`): live Firestore-backed FAQ content with a
/// silent-fallback-on-error local catalogue, expand/collapse category and
/// question rows, and a "Still need help?" contact card with two distinct
/// mailto actions. Reachable via `SettingsView`'s "Help Center" row (Support
/// section), replacing the `ComingSoonView` placeholder that shipped first.
///
/// Firestore shape (verbatim mirror of Android's read -- `help_categories`
/// collection, ordered by `order`): each document is
/// `{ title: String, icon: String, order: Number, faqs: [{ q: String, a: String }] }`.
/// Same as Android's own comment notes: nothing in this repo's Cloud
/// Functions seeds this collection (grep-confirmed), so it's a real,
/// externally-managed config surface that has apparently never been
/// populated -- in practice this screen always renders the local fallback
/// today. That fallback is ported verbatim from Android's
/// `FALLBACK_FAQ_DATA` (itself sourced from RN's `helpData.js`) so both
/// platforms show identical copy either way.
struct FaqItem: Identifiable {
    let question: String
    let answer: String
    var id: String { question }
}

struct FaqCategory: Identifiable {
    let title: String
    let icon: String
    let items: [FaqItem]
    var id: String { title }
}

/// Same 4 categories/copy as Android's `FALLBACK_FAQ_DATA` -- `icon` is a
/// semantic key resolved by `faqCategoryIcon(_:)` below, not a raw glyph,
/// matching the shape Android expects a `help_categories` doc's `icon` field
/// to send too.
enum FaqCatalog {
    static let fallback: [FaqCategory] = [
        FaqCategory(title: "Account & Profile", icon: "account", items: [
            FaqItem(question: "How do I change my profile picture?", answer: "Go to Settings > Edit Profile, then tap the camera icon on your avatar to upload a new photo."),
            FaqItem(question: "Can I change my username?", answer: "Yes, you can update your display name in the Edit Profile screen. Your unique Runner ID cannot be changed."),
            FaqItem(question: "How do I delete my account?", answer: "Please contact support@ruvo.app with your account email to request permanent deletion."),
        ]),
        FaqCategory(title: "Tracking & GPS", icon: "location", items: [
            FaqItem(question: "Why is my GPS inaccurate?", answer: "Ensure you have clear sky view. High buildings or dense trees can interfere. Also check that 'Precise Location' is enabled in your phone settings."),
            FaqItem(question: "Does Ruvo work on a treadmill?", answer: "Currently, Ruvo uses GPS for tracking, so indoor treadmill runs may not record distance accurately unless you manually edit the activity later."),
            FaqItem(question: "How is calories burned calculated?", answer: "We use your weight, distance, and pace to estimate calorie burn. Ensure your weight is updated in your profile for better accuracy."),
        ]),
        FaqCategory(title: "Community & Clubs", icon: "community", items: [
            FaqItem(question: "How do I create a club?", answer: "Go to the Community tab, tap 'Clubs', then the '+' icon. You can set a name, description, and cover image."),
            FaqItem(question: "Can I make my club private?", answer: "Yes, when creating a club, toggle 'Private Club'. Only users you approve can see posts and join."),
            FaqItem(question: "How do referrals work?", answer: "Share your code from Settings > Invite Friends. When a friend signs up with your code, you both earn rewards!"),
        ]),
        FaqCategory(title: "Privacy & Safety", icon: "privacy", items: [
            FaqItem(question: "Who can see my runs?", answer: "You can control this in Settings > Privacy Controls. Options are Public, Followers Only, or Private."),
            FaqItem(question: "How do I block a user?", answer: "Go to their profile, tap the three dots menu, and select 'Block'. They won't be able to see you or comment on your posts."),
        ]),
    ]
}

/// Resolves a category's semantic `icon` key to an SF Symbol -- mirrors
/// Android's `faqCategoryIcon()` exactly (account/location/community/privacy,
/// else falling back to a help glyph for anything unrecognized, including a
/// legacy emoji value a still-unseeded `help_categories` doc might one day
/// send).
func faqCategoryIcon(_ key: String) -> String {
    switch key {
    case "account": return "person.fill"
    case "location": return "location.fill"
    case "community": return "person.3.fill"
    case "privacy": return "shield.fill"
    default: return "questionmark.circle"
    }
}

@MainActor
final class HelpCenterViewModel: ObservableObject {
    @Published var categories: [FaqCategory] = FaqCatalog.fallback

    private let db = Firestore.firestore()

    /// Mirrors Android's `init` fetch verbatim: tries `help_categories`
    /// ordered by `order`, silently keeps the local fallback already in
    /// `categories` on error, on an empty collection, or if every fetched
    /// document turns out to have no usable `faqs`.
    func loadCategories() async {
        do {
            let snap = try await db.collection("help_categories").order(by: "order").getDocuments()
            if snap.documents.isEmpty { return }
            let fetched: [FaqCategory] = snap.documents.compactMap { doc in
                let data = doc.data()
                guard let title = data["title"] as? String else { return nil }
                let rawFaqs = data["faqs"] as? [[String: Any]] ?? []
                let faqs: [FaqItem] = rawFaqs.compactMap { f in
                    guard let q = f["q"] as? String, let a = f["a"] as? String else { return nil }
                    return FaqItem(question: q, answer: a)
                }
                guard !faqs.isEmpty else { return nil }
                let icon = data["icon"] as? String ?? "general"
                return FaqCategory(title: title, icon: icon, items: faqs)
            }
            if !fetched.isEmpty { categories = fetched }
        } catch {
            // Keep the local fallback already in `categories` -- same
            // silent-fallback pattern as Android and as this screen's own
            // SettingsViewModel-style Firestore reads elsewhere in the app.
        }
    }
}

struct HelpCenterView: View {
    @StateObject private var viewModel = HelpCenterViewModel()
    @State private var expandedCategories: Set<String> = []
    @State private var expandedItems: Set<String> = []

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
                    contactCard
                    ForEach(viewModel.categories) { category in
                        categorySection(category)
                    }
                }
                .padding(RuvoTheme.Spacing.md)
                .padding(.bottom, RuvoTheme.Spacing.xxl)
            }
        }
        .navigationTitle("Help Center")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.loadCategories() }
    }

    // MARK: – Contact card

    /// Two distinct mailto actions, both to the real `support@ruvo.app` --
    /// mirrors Android's contact card exactly, subject lines included (this
    /// screen previously had no counterpart at all, so there's no wrong
    /// domain to fix here the way Android's had, but the destination and
    /// copy are kept identical to Android's corrected version on principle).
    private var contactCard: some View {
        RuvoCard {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
                HStack(spacing: RuvoTheme.Spacing.sm) {
                    Image(systemName: "envelope.fill")
                        .font(.system(size: 22))
                        .foregroundColor(RuvoTheme.Colors.primary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Still need help?")
                            .font(RuvoTheme.Typography.labelLarge)
                            .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                        Text("support@ruvo.app")
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textTertiary)
                    }
                    Spacer()
                }
                HStack(spacing: RuvoTheme.Spacing.md) {
                    Button("Contact Support") { openMail(subject: "Ruvo Support Request") }
                        .font(RuvoTheme.Typography.labelMedium)
                        .foregroundColor(RuvoTheme.Colors.primary)
                    Button("Report a Bug") { openMail(subject: "Bug Report") }
                        .font(RuvoTheme.Typography.labelMedium)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                }
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }

    private func openMail(subject: String) {
        let encodedSubject = subject.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? subject
        guard let url = URL(string: "mailto:support@ruvo.app?subject=\(encodedSubject)") else { return }
        UIApplication.shared.open(url)
    }

    // MARK: – Category / question rows

    private func categorySection(_ category: FaqCategory) -> some View {
        let isExpanded = expandedCategories.contains(category.id)
        return VStack(spacing: RuvoTheme.Spacing.xs) {
            RuvoCard(isHighlighted: isExpanded) {
                Button {
                    withAnimation(RuvoTheme.Motion.easeInOut(RuvoTheme.Motion.Duration.quick)) {
                        if isExpanded { expandedCategories.remove(category.id) } else { expandedCategories.insert(category.id) }
                    }
                } label: {
                    HStack(spacing: RuvoTheme.Spacing.sm) {
                        Image(systemName: faqCategoryIcon(category.icon))
                            .foregroundColor(RuvoTheme.Colors.textSecondary)
                        Text(category.title)
                            .font(RuvoTheme.Typography.bodyLarge)
                            .tracking(RuvoTheme.Typography.Tracking.bodyLarge)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                        Spacer()
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 12))
                            .foregroundColor(RuvoTheme.Colors.textTertiary)
                    }
                    .padding(RuvoTheme.Spacing.md)
                }
                .buttonStyle(.plain)
            }

            if isExpanded {
                ForEach(category.items) { faq in
                    questionRow(category: category, faq: faq)
                }
            }
        }
    }

    private func questionRow(category: FaqCategory, faq: FaqItem) -> some View {
        let key = "\(category.id)_\(faq.id)"
        let isExpanded = expandedItems.contains(key)
        return RuvoCard {
            Button {
                withAnimation(RuvoTheme.Motion.easeInOut(RuvoTheme.Motion.Duration.quick)) {
                    if isExpanded { expandedItems.remove(key) } else { expandedItems.insert(key) }
                }
            } label: {
                VStack(alignment: .leading, spacing: RuvoTheme.Spacing.xs) {
                    HStack(alignment: .top, spacing: RuvoTheme.Spacing.sm) {
                        Text(faq.question)
                            .font(RuvoTheme.Typography.bodyMedium)
                            .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                            .multilineTextAlignment(.leading)
                        Spacer()
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 12))
                            .foregroundColor(RuvoTheme.Colors.primary)
                    }
                    if isExpanded {
                        Text(faq.answer)
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textSecondary)
                            .multilineTextAlignment(.leading)
                    }
                }
                .padding(RuvoTheme.Spacing.md)
            }
            .buttonStyle(.plain)
        }
        .padding(.leading, RuvoTheme.Spacing.md)
    }
}
