import SwiftUI

struct WeatherWidget: View {
    @StateObject private var service = WeatherService()

    var body: some View {
        Group {
            if service.isLoading {
                loadingView
            } else if let c = service.condition {
                weatherCard(c)
            }
        }
        .task { await service.fetchIfNeeded() }
    }

    private var loadingView: some View {
        RoundedRectangle(cornerRadius: 20)
            .fill(RuvoTheme.Colors.surface)
            .frame(height: 80)
            .overlay(ProgressView().tint(RuvoTheme.Colors.primary))
    }

    private func weatherCard(_ c: WeatherCondition) -> some View {
        RuvoCard(isHighlighted: c.isGoodForRun) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    HStack(spacing: 8) {
                        Text(c.emoji)
                            .font(RuvoTheme.Typography.headingMedium)
                            .tracking(RuvoTheme.Typography.Tracking.headingMedium)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(c.condition)
                                .font(RuvoTheme.Typography.labelLarge)
                                .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                                .foregroundColor(.white)
                            Text("\(c.temperature) · \(c.feelsLike)")
                                .font(RuvoTheme.Typography.bodySmall)
                                .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                                .foregroundColor(Color(hex: "#999999"))
                        }
                    }
                    Spacer()
                    badgeView(isGood: c.isGoodForRun)
                }
                Text(c.recommendation)
                    .font(RuvoTheme.Typography.bodySmall)
                    .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                    .foregroundColor(Color(hex: "#AAAAAA"))

                if !c.tipTitle.isEmpty {
                    Divider().background(RuvoTheme.Colors.border)
                    HStack(alignment: .top, spacing: 6) {
                        Text("💡")
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(c.tipTitle)
                                .font(RuvoTheme.Typography.labelMedium)
                                .tracking(RuvoTheme.Typography.Tracking.labelMedium)
                                .foregroundColor(RuvoTheme.Colors.primary)
                            Text(c.tip)
                                .font(RuvoTheme.Typography.bodySmall)
                                .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                                .foregroundColor(Color(hex: "#888888"))
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    private func badgeView(isGood: Bool) -> some View {
        Text(isGood ? "Great for running" : "Caution")
            .font(RuvoTheme.Typography.labelSmall)
            .tracking(RuvoTheme.Typography.Tracking.labelSmall)
            .foregroundColor(isGood ? RuvoTheme.Colors.primary : RuvoTheme.Colors.error)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(
                Capsule().fill(isGood ? RuvoTheme.Colors.primaryDim : RuvoTheme.Colors.error.opacity(0.15))
            )
    }
}
