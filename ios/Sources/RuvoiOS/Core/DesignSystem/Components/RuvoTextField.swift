import SwiftUI

struct RuvoTextField: View {
    let placeholder: String
    @Binding var text: String
    var icon: String? = nil
    var isSecure: Bool = false
    var keyboardType: UIKeyboardType = .default
    var autocapitalization: TextInputAutocapitalization = .sentences
    var errorMessage: String? = nil

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: RuvoTheme.Spacing.sm) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 16))
                        .foregroundColor(isFocused ? RuvoTheme.Colors.primary : RuvoTheme.Colors.textTertiary)
                        .frame(width: 20)
                }

                Group {
                    if isSecure {
                        SecureField(placeholder, text: $text)
                    } else {
                        TextField(placeholder, text: $text)
                            .keyboardType(keyboardType)
                            .textInputAutocapitalization(autocapitalization)
                    }
                }
                .font(RuvoTheme.Typography.bodyMedium)
                .foregroundColor(RuvoTheme.Colors.textPrimary)
                .focused($isFocused)
            }
            .padding(.horizontal, RuvoTheme.Spacing.md)
            .frame(height: 52)
            .background(RuvoTheme.Colors.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: RuvoTheme.Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: RuvoTheme.Radius.md)
                    .stroke(borderColor, lineWidth: 1)
            )
            .animation(.easeInOut(duration: 0.2), value: isFocused)

            if let error = errorMessage {
                Text(error)
                    .font(RuvoTheme.Typography.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.error)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: errorMessage)
    }

    private var borderColor: Color {
        if errorMessage != nil { return RuvoTheme.Colors.error.opacity(0.6) }
        return isFocused ? RuvoTheme.Colors.primary.opacity(0.6) : RuvoTheme.Colors.border
    }
}
