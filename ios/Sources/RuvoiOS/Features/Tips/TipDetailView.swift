import SwiftUI
import FirebaseAuth
import FirebaseFirestore

/// Mirrors Android's `TipDetailViewModel` (`TipDetailScreen.kt`): the tip
/// itself always comes from the static `TipsLibrary` catalog (never
/// Firestore), while save state is read from -- and bookmark toggles are
/// written to -- this signed-in user's own `users/{uid}.savedTips` array,
/// the same field Android's `ContentRepository.toggleBookmark` touches.
/// View-count increments are a fire-and-forget write to `content/{tipId}`
/// (`ContentRepository.incrementTipView`); Android swallows any failure
/// there since it's purely cosmetic, so this does too.
@MainActor
final class TipDetailViewModel: ObservableObject {
    @Published private(set) var tip: Tip?
    @Published private(set) var isSaved = false
    let views: Int

    private let db: Firestore
    private let auth: Auth

    init(tipId: String, db: Firestore = Firestore.firestore(), auth: Auth = Auth.auth()) {
        self.db = db
        self.auth = auth
        let tip = TipsLibrary.all.first { $0.id == tipId }
        self.tip = tip
        self.views = tip?.viewCount ?? 0
    }

    func load() {
        guard let tip else { return }

        Task { [db] in
            try? await db.collection("content").document(tip.id)
                .setData(["viewCount": FieldValue.increment(Int64(1))], merge: true)
        }

        guard let uid = auth.currentUser?.uid else { return }
        Task { [db, weak self] in
            guard let doc = try? await db.collection("users").document(uid).getDocument() else { return }
            let saved = doc.data()?["savedTips"] as? [String] ?? []
            self?.isSaved = saved.contains(tip.id)
        }
    }

    func toggleBookmark() {
        guard let tip, let uid = auth.currentUser?.uid else { return }
        let wasSaved = isSaved
        isSaved = !wasSaved
        Task { [db] in
            try? await db.collection("users").document(uid).updateData([
                "savedTips": wasSaved ? FieldValue.arrayRemove([tip.id]) : FieldValue.arrayUnion([tip.id])
            ])
        }
    }
}

/// Standalone tip detail -- mirrors Android's `TipDetailScreen.kt`: a
/// full-bleed hero image with category/read-time/view-count pills, a "Key
/// Takeaway" highlight card, a "The Breakdown" explainer card, a numbered
/// "Drill Sequence" timeline, and a "Mark as Helpful" toggle (local-only on
/// Android too -- no ViewModel write backs it there either). Reachable from
/// Home's "Tips for Today" preview and from the full `TipsView` library via
/// `AppRoute.tipDetail`.
struct TipDetailView: View {
    @StateObject private var viewModel: TipDetailViewModel
    @State private var isHelpful = false
    @Environment(\.dismiss) private var dismiss

    init(tipId: String) {
        _viewModel = StateObject(wrappedValue: TipDetailViewModel(tipId: tipId))
    }

    var body: some View {
        Group {
            if let tip = viewModel.tip {
                content(for: tip)
            } else {
                RuvoTheme.Colors.background.ignoresSafeArea()
            }
        }
        .onAppear { viewModel.load() }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .navigationBar)
    }

    @ViewBuilder
    private func content(for tip: Tip) -> some View {
        let meta = TipCategoryStyle.meta(for: tip.category)

        ScrollView {
            VStack(spacing: 0) {
                hero(tip: tip, meta: meta)
                detailBody(tip: tip, meta: meta)
            }
        }
        .background(RuvoTheme.Colors.background.ignoresSafeArea())
        .ignoresSafeArea(edges: .top)
    }

    private func hero(tip: Tip, meta: TipCategoryMeta) -> some View {
        ZStack(alignment: .bottom) {
            AsyncImage(url: URL(string: tip.img)) { img in
                img.resizable().scaledToFill()
            } placeholder: {
                RuvoTheme.Colors.surfaceElevated
            }
            .frame(height: 420)
            .frame(maxWidth: .infinity)
            .clipped()

            LinearGradient(
                stops: [
                    .init(color: .black.opacity(0.55), location: 0),
                    .init(color: .clear, location: 0.45),
                    .init(color: .black.opacity(0.85), location: 1),
                ],
                startPoint: .top, endPoint: .bottom
            )
            .frame(height: 420)

            VStack {
                HStack {
                    heroNavButton(icon: "chevron.left", action: { dismiss() })
                    Spacer()
                    heroNavButton(
                        icon: viewModel.isSaved ? "bookmark.fill" : "bookmark",
                        tint: viewModel.isSaved ? RuvoTheme.Colors.primary : .white,
                        highlighted: viewModel.isSaved,
                        action: { viewModel.toggleBookmark() }
                    )
                }
                .padding(.horizontal, RuvoTheme.Spacing.md)
                .padding(.top, RuvoTheme.Spacing.xxl)

                Spacer()

                VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
                    HStack(spacing: RuvoTheme.Spacing.xs) {
                        HStack(spacing: 4) {
                            Image(systemName: meta.icon).font(.system(size: 11)).foregroundColor(.black)
                            Text(tip.tag)
                                .font(RuvoTheme.Typography.labelSmall)
                                .foregroundColor(.black)
                        }
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(Capsule().fill(meta.color))

                        pillLabel(icon: "timer", text: "\(tip.readTime) min read")
                        if viewModel.views > 0 {
                            pillLabel(icon: "eye.fill", text: formatViews(viewModel.views))
                        }
                    }
                    Text(tip.title)
                        .font(RuvoTheme.Typography.displayMedium)
                        .tracking(RuvoTheme.Typography.Tracking.displayMedium)
                        .foregroundColor(.white)
                    Text(tip.desc)
                        .font(RuvoTheme.Typography.bodyLarge)
                        .tracking(RuvoTheme.Typography.Tracking.bodyLarge)
                        .foregroundColor(.white.opacity(0.75))
                }
                .padding(.horizontal, RuvoTheme.Spacing.md)
                .padding(.bottom, RuvoTheme.Spacing.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(height: 420)
    }

    private func detailBody(tip: Tip, meta: TipCategoryMeta) -> some View {
        VStack(alignment: .leading, spacing: RuvoTheme.Spacing.lg) {
            if !tip.keyTakeaway.isEmpty {
                RuvoCard {
                    VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
                        HStack(spacing: RuvoTheme.Spacing.sm) {
                            ZStack {
                                Circle().fill(meta.color.opacity(0.13)).frame(width: 30, height: 30)
                                Image(systemName: "lightbulb.fill").font(.system(size: 14)).foregroundColor(meta.color)
                            }
                            Text("KEY TAKEAWAY")
                                .font(RuvoTheme.Typography.labelMedium)
                                .tracking(1.0)
                                .foregroundColor(meta.color)
                        }
                        Text(tip.keyTakeaway)
                            .font(RuvoTheme.Typography.bodyLarge)
                            .tracking(RuvoTheme.Typography.Tracking.bodyLarge)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                    }
                    .padding(RuvoTheme.Spacing.md)
                }
            }

            RuvoCard {
                VStack(alignment: .leading, spacing: RuvoTheme.Spacing.md) {
                    sectionHeader(icon: "brain.head.profile", tint: meta.color, title: "THE BREAKDOWN")
                    Text(tip.why)
                        .font(RuvoTheme.Typography.bodyLarge)
                        .tracking(RuvoTheme.Typography.Tracking.bodyLarge)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                        .lineSpacing(6)
                }
                .padding(RuvoTheme.Spacing.lg)
            }

            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.md) {
                sectionHeader(icon: "bolt.fill", tint: RuvoTheme.Colors.primary, title: "DRILL SEQUENCE")
                VStack(spacing: 0) {
                    ForEach(Array(tip.steps.enumerated()), id: \.offset) { index, step in
                        drillRow(index: index, step: step, isLast: index == tip.steps.count - 1, meta: meta)
                    }
                }
            }

            Button {
                isHelpful.toggle()
            } label: {
                HStack(spacing: RuvoTheme.Spacing.sm) {
                    Image(systemName: isHelpful ? "checkmark.circle.fill" : "hand.thumbsup.fill")
                    Text(isHelpful ? "Marked as Helpful" : "Mark as Helpful")
                        .font(RuvoTheme.Typography.labelLarge)
                        .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                }
                .foregroundColor(isHelpful ? .black : RuvoTheme.Colors.textTertiary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, RuvoTheme.Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: RuvoTheme.Radius.md)
                        .fill(isHelpful ? meta.color : RuvoTheme.Colors.surface)
                        .overlay(
                            RoundedRectangle(cornerRadius: RuvoTheme.Radius.md)
                                .stroke(isHelpful ? meta.color : RuvoTheme.Colors.border, lineWidth: 1.5)
                        )
                )
            }
            .buttonStyle(ScaleButtonStyle())

            Spacer(minLength: RuvoTheme.Spacing.xxl)
        }
        .padding(RuvoTheme.Spacing.lg)
    }

    private func drillRow(index: Int, step: TipStep, isLast: Bool, meta: TipCategoryMeta) -> some View {
        HStack(alignment: .top, spacing: RuvoTheme.Spacing.md) {
            VStack(spacing: 0) {
                ZStack {
                    Circle()
                        .fill(isLast ? meta.color.opacity(0.15) : RuvoTheme.Colors.background)
                        .overlay(Circle().stroke(isLast ? meta.color : RuvoTheme.Colors.border, lineWidth: 2))
                        .frame(width: 34, height: 34)
                    Text("\(index + 1)")
                        .font(RuvoTheme.Typography.labelLarge)
                        .foregroundColor(isLast ? meta.color : RuvoTheme.Colors.textSecondary)
                }
                if !isLast {
                    Rectangle().fill(meta.color.opacity(0.2)).frame(width: 2).frame(maxHeight: .infinity)
                }
            }
            .frame(width: 34)

            VStack(alignment: .leading, spacing: 4) {
                Text(step.title)
                    .font(RuvoTheme.Typography.headingSmall)
                    .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                    .foregroundColor(isLast ? meta.color : RuvoTheme.Colors.textPrimary)
                Text(step.desc)
                    .font(RuvoTheme.Typography.bodyMedium)
                    .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
            }
            .padding(.bottom, RuvoTheme.Spacing.lg)
        }
    }

    private func sectionHeader(icon: String, tint: Color, title: String) -> some View {
        HStack(spacing: RuvoTheme.Spacing.sm) {
            ZStack {
                Circle().fill(tint.opacity(0.1)).frame(width: 34, height: 34)
                Image(systemName: icon).font(.system(size: 15)).foregroundColor(tint)
            }
            Text(title)
                .font(RuvoTheme.Typography.headingSmall)
                .tracking(1.5)
                .foregroundColor(RuvoTheme.Colors.textPrimary)
        }
    }

    private func heroNavButton(icon: String, tint: Color = .white, highlighted: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(tint)
                .frame(width: 40, height: 40)
                .background(
                    Circle()
                        .fill(highlighted ? RuvoTheme.Colors.primary.opacity(0.2) : Color.black.opacity(0.45))
                        .overlay(Circle().stroke(highlighted ? RuvoTheme.Colors.primary.opacity(0.4) : Color.white.opacity(0.15), lineWidth: 1))
                )
        }
        .buttonStyle(ScaleButtonStyle())
    }

    private func pillLabel(icon: String, text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.system(size: 10)).foregroundColor(Color(hex: "#AAAAAA"))
            Text(text)
                .font(RuvoTheme.Typography.labelSmall)
                .foregroundColor(Color(hex: "#AAAAAA"))
        }
        .padding(.horizontal, 9).padding(.vertical, 4)
        .background(Capsule().fill(Color.white.opacity(0.1)))
    }

    private func formatViews(_ views: Int) -> String {
        switch views {
        case 1_000_000...:
            return String(format: "%.1fM", Double(views) / 1_000_000)
        case 1_000...:
            return String(format: "%.1fK", Double(views) / 1_000)
        default:
            return "\(views)"
        }
    }
}
