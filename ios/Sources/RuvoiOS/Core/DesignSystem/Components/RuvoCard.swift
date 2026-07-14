import SwiftUI

struct RuvoCard<Content: View>: View {
    var isHighlighted: Bool = false
    var glowColor: Color = RuvoTheme.Colors.primary
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .background(
                RoundedRectangle(cornerRadius: RuvoTheme.Radius.lg)
                    .fill(RuvoTheme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: RuvoTheme.Radius.lg)
                            .stroke(
                                isHighlighted ? glowColor.opacity(0.4) : RuvoTheme.Colors.border,
                                lineWidth: 1
                            )
                    )
                    .shadow(
                        color: isHighlighted ? glowColor.opacity(0.15) : .clear,
                        radius: 20, x: 0, y: 8
                    )
            )
    }
}

struct RuvoStatCard: View {
    let label: String
    let value: String
    let unit: String
    var accentColor: Color = RuvoTheme.Colors.primary

    var body: some View {
        RuvoCard {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.xs) {
                Text(label.uppercased())
                    .font(RuvoTheme.Typography.caption)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
                    .tracking(2)
                HStack(alignment: .lastTextBaseline, spacing: 4) {
                    Text(value)
                        .font(RuvoTheme.Typography.statNumber)
                        .foregroundColor(accentColor)
                    Text(unit)
                        .font(RuvoTheme.Typography.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                }
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}

struct RuvoChip: View {
    let label: String
    var isActive: Bool = false
    var color: Color = RuvoTheme.Colors.primary

    var body: some View {
        Text(label)
            .font(RuvoTheme.Typography.labelSmall)
            .foregroundColor(isActive ? .black : color)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(isActive ? color : color.opacity(0.1))
                    .overlay(Capsule().stroke(color.opacity(0.3), lineWidth: 1))
            )
    }
}
