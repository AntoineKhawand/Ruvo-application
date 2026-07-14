import SwiftUI
import AuthenticationServices
import GoogleSignIn

// MARK: – Apple Sign-In
struct AppleSignInButton: View {
    @EnvironmentObject private var authService: AuthService
    @State private var errorMessage: String?

    var body: some View {
        SignInWithAppleButton(.signIn) { request in
            request.requestedScopes = [.fullName, .email]
            request.nonce = AppleSignInHelper.generateNonce()
        } onCompletion: { result in
            Task {
                switch result {
                case .success(let auth):
                    guard let credential = auth.credential as? ASAuthorizationAppleIDCredential else { return }
                    try? await authService.signInWithApple(credential: credential)
                case .failure(let error):
                    errorMessage = error.localizedDescription
                }
            }
        }
        .signInWithAppleButtonStyle(.white)
        .frame(height: 52)
        .clipShape(Capsule())
    }
}

// MARK: – Google Sign-In
struct GoogleSignInButton: View {
    @EnvironmentObject private var authService: AuthService
    @State private var isLoading = false

    var body: some View {
        Button {
            signInWithGoogle()
        } label: {
            HStack(spacing: 10) {
                Image("google-logo") // add to Assets
                    .resizable()
                    .scaledToFit()
                    .frame(width: 20, height: 20)
                Text("Continue with Google")
                    .font(RuvoTheme.Typography.labelLarge)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(RuvoTheme.Colors.surfaceElevated)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(RuvoTheme.Colors.border, lineWidth: 1))
        }
        .buttonStyle(ScaleButtonStyle())
    }

    private func signInWithGoogle() {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootVC = windowScene.windows.first?.rootViewController else { return }
        isLoading = true
        Task {
            try? await authService.signInWithGoogle(presenting: rootVC)
            isLoading = false
        }
    }
}
