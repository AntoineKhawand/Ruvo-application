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
            .fill(Color(hex: "#111111"))
            .frame(height: 80)
            .overlay(ProgressView().tint(Color(hex: "#DFFF00")))
    }

    private func weatherCard(_ c: WeatherCondition) -> some View {
        RuvoCard(isHighlighted: c.isGoodForRun) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    HStack(spacing: 8) {
                        Text(c.emoji).font(.title2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(c.condition)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                            Text("\(c.temperature) · \(c.feelsLike)")
                                .font(.caption)
                                .foregroundColor(Color(hex: "#999999"))
                        }
                    }
                    Spacer()
                    badgeView(isGood: c.isGoodForRun)
                }
                Text(c.recommendation)
                    .font(.caption)
                    .foregroundColor(Color(hex: "#AAAAAA"))

                if !c.tipTitle.isEmpty {
                    Divider().background(Color(hex: "#222222"))
                    HStack(alignment: .top, spacing: 6) {
                        Text("💡").font(.caption)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(c.tipTitle)
                                .font(.caption.weight(.semibold))
                                .foregroundColor(Color(hex: "#DFFF00"))
                            Text(c.tip)
                                .font(.caption)
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
            .font(.caption2.weight(.semibold))
            .foregroundColor(isGood ? Color(hex: "#DFFF00") : Color(hex: "#EF4444"))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(
                Capsule().fill(isGood ? Color(hex: "#DFFF00").opacity(0.15) : Color(hex: "#EF4444").opacity(0.15))
            )
    }
}
