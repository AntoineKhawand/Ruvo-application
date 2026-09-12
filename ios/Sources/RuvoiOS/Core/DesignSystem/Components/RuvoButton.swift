import SwiftUI

enum RuvoButtonStyle {
    case primary    // lime fill, black text
    case secondary  // outlined white
    case ghost      // no border, text only
    case destructive
}

struct RuvoButton: View {
    let title: String
    let style: RuvoButtonStyle
    var icon: String? = nil
    var isLoading: Bool = false
    var isFullWidth: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: RuvoTheme.Spacing.sm) {
                if isLoading {
                    ProgressView()
                        .tint(labelColor)
                        .scaleEffect(0.85)
                } else {
                    if let icon {
                        Image(systemName: icon)
                            .font(.system(size: 16, weight: .semibold))
                    }
                    Text(title)
                        .font(RuvoTheme.Typography.labelLarge)
                        .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                }
            }
            .foregroundColor(labelColor)
            .frame(maxWidth: isFullWidth ? .infinity : nil)
            .frame(height: 52)
            .padding(.horizontal, isFullWidth ? 0 : RuvoTheme.Spacing.xl)
            .background(backgroundView)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(borderColor, lineWidth: style == .secondary ? 1 : 0))
        }
        .disabled(isLoading)
        .buttonStyle(ScaleButtonStyle())
    }

    private var labelColor: Color {
        switch style {
        case .primary:     return .black
        case .secondary:   return .white
        case .ghost:       return RuvoTheme.Colors.primary
        case .destructive: return .white
        }
    }

    private var borderColor: Color {
        switch style {
        case .secondary: return Color.white.opacity(0.2)
        default:         return .clear
        }
    }

    @ViewBuilder
    private var backgroundView: some View {
        switch style {
        case .primary:
            LinearGradient(
                colors: [RuvoTheme.Colors.primary, Color(hex: "#A8CC00")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .secondary:
            Color.white.opacity(0.05)
        case .ghost:
            Color.clear
        case .destructive:
            Color(hex: "#EF4444")
        }
    }
}

struct ScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(RuvoTheme.Motion.springBouncy(duration: RuvoTheme.Motion.Duration.standard), value: configuration.isPressed)
    }
}

// MARK: – Icon button for tab bar / toolbar
struct RuvoIconButton: View {
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 20, weight: .semibold))
                .foregroundColor(RuvoTheme.Colors.textPrimary)
                .frame(width: 44, height: 44)
                .background(RuvoTheme.Colors.surface)
                .clipShape(Circle())
        }
        .buttonStyle(ScaleButtonStyle())
    }
}
