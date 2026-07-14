import SwiftUI
import RevenueCat

struct PaywallView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = PaywallViewModel()

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()

            // Background gradient
            RadialGradient(
                colors: [RuvoTheme.Colors.primary.opacity(0.1), .clear],
                center: .top, startRadius: 0, endRadius: 500
            ).ignoresSafeArea()

            ScrollView {
                VStack(spacing: RuvoTheme.Spacing.xl) {
                    // Hero
                    VStack(spacing: RuvoTheme.Spacing.md) {
                        Image(systemName: "crown.fill")
                            .font(.system(size: 52))
                            .foregroundColor(RuvoTheme.Colors.primary)
                            .shadow(color: RuvoTheme.Colors.primary.opacity(0.4), radius: 16)

                        Text("RUVO Pro")
                            .font(RuvoTheme.Typography.displayMedium)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)

                        Text("Unlock the full power of your running")
                            .font(RuvoTheme.Typography.bodyLarge)
                            .foregroundColor(RuvoTheme.Colors.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, RuvoTheme.Spacing.xl)

                    // Feature list
                    VStack(spacing: RuvoTheme.Spacing.sm) {
                        ForEach(PaywallFeature.allFeatures) { feature in
                            ProFeatureRow(feature: feature)
                        }
                    }
                    .padding(.horizontal, RuvoTheme.Spacing.lg)

                    // Packages
                    if !viewModel.packages.isEmpty {
                        VStack(spacing: RuvoTheme.Spacing.sm) {
                            ForEach(viewModel.packages, id: \.identifier) { pkg in
                                PackageCard(
                                    package: pkg,
                                    isSelected: viewModel.selectedPackage?.identifier == pkg.identifier,
                                    onSelect: { viewModel.selectedPackage = pkg }
                                )
                            }
                        }
                        .padding(.horizontal, RuvoTheme.Spacing.lg)
                    }

                    // CTA
                    VStack(spacing: RuvoTheme.Spacing.sm) {
                        RuvoButton(
                            title: viewModel.ctaTitle,
                            style: .primary,
                            isLoading: viewModel.isPurchasing
                        ) {
                            Task { await viewModel.purchase() }
                        }

                        Button("Restore Purchases") {
                            Task { await viewModel.restore() }
                        }
                        .font(RuvoTheme.Typography.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)

                        Text("Cancel anytime. Terms of Service & Privacy Policy apply.")
                            .font(RuvoTheme.Typography.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textTertiary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.horizontal, RuvoTheme.Spacing.lg)
                    .padding(.bottom, RuvoTheme.Spacing.xl)
                }
            }

            // Close button
            VStack {
                HStack {
                    Spacer()
                    RuvoIconButton(icon: "xmark", action: { dismiss() })
                        .padding(.top, 60)
                        .padding(.trailing, 20)
                }
                Spacer()
            }
        }
        .task { await viewModel.loadOfferings() }
    }
}

struct ProFeatureRow: View {
    let feature: PaywallFeature

    var body: some View {
        HStack(spacing: RuvoTheme.Spacing.sm) {
            Image(systemName: feature.icon)
                .font(.system(size: 18))
                .foregroundColor(RuvoTheme.Colors.primary)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(feature.title)
                    .font(RuvoTheme.Typography.labelLarge)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Text(feature.subtitle)
                    .font(RuvoTheme.Typography.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
            }
            Spacer()
        }
    }
}

struct PackageCard: View {
    let package: Package
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            RuvoCard(isHighlighted: isSelected) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(packageTitle)
                            .font(RuvoTheme.Typography.headingSmall)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                        if let savings = savingsLabel {
                            RuvoChip(label: savings, isActive: true)
                        }
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(package.localizedPriceString)
                            .font(RuvoTheme.Typography.headingSmall)
                            .foregroundColor(isSelected ? RuvoTheme.Colors.primary : RuvoTheme.Colors.textPrimary)
                        Text(perPeriodLabel)
                            .font(RuvoTheme.Typography.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textSecondary)
                    }
                }
                .padding(RuvoTheme.Spacing.md)
            }
        }
        .buttonStyle(ScaleButtonStyle())
    }

    private var packageTitle: String {
        switch package.packageType {
        case .annual:  return "Annual"
        case .monthly: return "Monthly"
        case .weekly:  return "Weekly"
        default:       return package.identifier
        }
    }

    private var savingsLabel: String? {
        package.packageType == .annual ? "Save 60%" : nil
    }

    private var perPeriodLabel: String {
        switch package.packageType {
        case .annual:  return "/ year"
        case .monthly: return "/ month"
        case .weekly:  return "/ week"
        default:       return ""
        }
    }
}

struct PaywallFeature: Identifiable {
    let id = UUID()
    var icon: String
    var title: String
    var subtitle: String

    static let allFeatures = [
        PaywallFeature(icon: "brain.head.profile", title: "Unlimited AI Coaching", subtitle: "Personalized training plans & real-time advice"),
        PaywallFeature(icon: "chart.line.uptrend.xyaxis", title: "Advanced Analytics", subtitle: "VO2 Max, training load, and recovery insights"),
        PaywallFeature(icon: "figure.run.circle", title: "Custom Training Plans", subtitle: "Build plans from 5K to ultra marathons"),
        PaywallFeature(icon: "trophy.fill", title: "Exclusive Challenges", subtitle: "Pro-only challenges with bigger rewards"),
        PaywallFeature(icon: "antenna.radiowaves.left.and.right", title: "Live Run Sharing", subtitle: "Share your runs with friends in real-time"),
        PaywallFeature(icon: "tag.fill", title: "More Coin Rewards", subtitle: "2x XP and coins on every run"),
    ]
}

@MainActor
final class PaywallViewModel: ObservableObject {
    @Published var packages: [Package] = []
    @Published var selectedPackage: Package?
    @Published var isPurchasing = false
    @Published var isSubscribed = false

    var ctaTitle: String {
        guard let pkg = selectedPackage else { return "Start Free Trial" }
        return "Start Free Trial · \(pkg.localizedPriceString)"
    }

    func loadOfferings() async {
        do {
            let offerings = try await Purchases.shared.offerings()
            packages = offerings.current?.availablePackages ?? []
            selectedPackage = packages.first(where: { $0.packageType == .annual }) ?? packages.first
        } catch {
            print("[Paywall] Failed to load offerings: \(error)")
        }
    }

    func purchase() async {
        guard let pkg = selectedPackage else { return }
        isPurchasing = true
        do {
            let result = try await Purchases.shared.purchase(package: pkg)
            isSubscribed = !result.customerInfo.entitlements.active.isEmpty
        } catch {
            print("[Paywall] Purchase failed: \(error)")
        }
        isPurchasing = false
    }

    func restore() async {
        do {
            let info = try await Purchases.shared.restorePurchases()
            isSubscribed = !info.entitlements.active.isEmpty
        } catch {
            print("[Paywall] Restore failed: \(error)")
        }
    }
}
