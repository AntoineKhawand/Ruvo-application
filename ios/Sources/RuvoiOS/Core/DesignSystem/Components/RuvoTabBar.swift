import SwiftUI

struct RuvoTabBar: View {
    @Binding var selected: TabItem
    let onRunTap: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            ForEach(TabItem.allCases, id: \.self) { tab in
                if tab == .run {
                    RunButton(action: onRunTap)
                } else {
                    TabBarItem(tab: tab, isSelected: selected == tab) {
                        withAnimation(RuvoTheme.Motion.springBouncy()) {
                            selected = tab
                        }
                    }
                }
            }
        }
        .padding(.horizontal, RuvoTheme.Spacing.md)
        .padding(.bottom, 8)
        .padding(.top, 12)
        .background(
            RuvoTheme.Colors.glassSurface
                .overlay(RuvoTheme.Colors.surface.opacity(0.6))
                .overlay(
                    Rectangle()
                        .frame(height: 1)
                        .foregroundColor(RuvoTheme.Colors.border),
                    alignment: .top
                )
        )
    }
}

private struct TabBarItem: View {
    let tab: TabItem
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: tab.icon)
                    .font(.system(size: 20, weight: isSelected ? .bold : .regular))
                    .foregroundColor(isSelected ? RuvoTheme.Colors.primary : RuvoTheme.Colors.textTertiary)
                    .scaleEffect(isSelected ? 1.1 : 1)
                Text(tab.label)
                    .font(RuvoTheme.Typography.caption)
                    .tracking(RuvoTheme.Typography.Tracking.caption)
                    .foregroundColor(isSelected ? RuvoTheme.Colors.primary : RuvoTheme.Colors.textTertiary)
            }
            .frame(maxWidth: .infinity)
        }
        .animation(RuvoTheme.Motion.springBouncy(), value: isSelected)
    }
}

private struct RunButton: View {
    let action: () -> Void
    @State private var isPressed = false

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [RuvoTheme.Colors.primary, Color(hex: "#A8CC00")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 56, height: 56)
                    .shadow(color: RuvoTheme.Colors.primary.opacity(0.4), radius: 12, y: 4)

                Image(systemName: "figure.run")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(.black)
            }
            .frame(maxWidth: .infinity)
            .offset(y: -16)
        }
        .buttonStyle(ScaleButtonStyle())
    }
}
