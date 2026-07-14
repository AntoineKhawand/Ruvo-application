import SwiftUI
import FirebaseAuth

struct SettingsView: View {
    @EnvironmentObject private var authService: AuthService
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 1) {
                    settingsRow(icon: "bell", label: "Notifications")
                    settingsRow(icon: "lock.shield", label: "Privacy")
                    settingsRow(icon: "headphones", label: "Voice Coach")
                    settingsRow(icon: "map", label: "Map Style")
                    settingsRow(icon: "questionmark.circle", label: "Help & Support")
                    settingsRow(icon: "star", label: "Rate Ruvo")

                    Divider().background(RuvoTheme.Colors.border).padding(.vertical, 16)

                    Button {
                        try? Auth.auth().signOut()
                    } label: {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                                .foregroundColor(.red)
                            Text("Sign Out")
                                .foregroundColor(.red)
                                .font(RuvoTheme.Typography.bodyMedium)
                            Spacer()
                        }
                        .padding(20)
                        .background(RuvoTheme.Colors.surface)
                    }

                    Text("Ruvo v1.0.0")
                        .font(RuvoTheme.Typography.caption)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                        .padding(.top, 24)
                }
                .padding(.top, 8)
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func settingsRow(icon: String, label: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .frame(width: 22, height: 22)
                .foregroundColor(RuvoTheme.Colors.textSecondary)
            Text(label)
                .font(RuvoTheme.Typography.bodyMedium)
                .foregroundColor(RuvoTheme.Colors.textPrimary)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 12))
                .foregroundColor(RuvoTheme.Colors.textTertiary)
        }
        .padding(20)
        .background(RuvoTheme.Colors.surface)
        .overlay(
            Rectangle()
                .fill(RuvoTheme.Colors.border)
                .frame(height: 1),
            alignment: .bottom
        )
    }
}
