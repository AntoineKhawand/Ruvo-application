import SwiftUI

struct AuthRootView: View {
    @State private var showLogin = false

    var body: some View {
        if showLogin {
            LoginView(onBack: { showLogin = false })
                .transition(.push(from: .trailing))
        } else {
            LandingView(onLogin: { showLogin = true })
                .transition(.push(from: .leading))
        }
    }
}

// MARK: – Landing / Welcome screen
struct LandingView: View {
    let onLogin: () -> Void
    @State private var showSignUp = false

    var body: some View {
        WelcomeScreen(
            onStartJourney: { showSignUp = true },
            onLogIn: onLogin
        )
        .sheet(isPresented: $showSignUp) {
            SignUpView()
        }
    }
}

// MARK: – Login View
struct LoginView: View {
    let onBack: () -> Void
    @EnvironmentObject private var authService: AuthService
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showForgotPassword = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: RuvoTheme.Spacing.xl) {
                    VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
                        Text("Welcome Back")
                            .font(RuvoTheme.Typography.headingLarge)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                        Text("Sign in to continue your streak")
                            .font(RuvoTheme.Typography.bodyMedium)
                            .foregroundColor(RuvoTheme.Colors.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(spacing: RuvoTheme.Spacing.md) {
                        RuvoTextField(placeholder: "Email", text: $email, icon: "envelope", keyboardType: .emailAddress, autocapitalization: .never)
                        RuvoTextField(placeholder: "Password", text: $password, icon: "lock", isSecure: true)
                    }

                    if let error = errorMessage {
                        Text(error)
                            .font(RuvoTheme.Typography.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.error)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button("Forgot Password?") { showForgotPassword = true }
                        .font(RuvoTheme.Typography.labelLarge)
                        .foregroundColor(RuvoTheme.Colors.primary)
                        .frame(maxWidth: .infinity, alignment: .trailing)

                    RuvoButton(title: "Sign In", style: .primary, isLoading: isLoading) {
                        signIn()
                    }

                    SocialSignInDivider()

                    SocialSignInButtons()
                }
                .padding(RuvoTheme.Spacing.lg)
            }
            .background(RuvoTheme.Colors.background.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    RuvoIconButton(icon: "chevron.left", action: onBack)
                }
            }
        }
        .alert("Reset Password", isPresented: $showForgotPassword) {
            TextField("Email", text: $email)
            Button("Send Reset Link") {
                Task {
                    try? await authService.resetPassword(email: email)
                }
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    private func signIn() {
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "Please fill in all fields."
            return
        }
        isLoading = true
        errorMessage = nil
        Task {
            do {
                try await authService.signIn(email: email, password: password)
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }
}

// MARK: – Sign Up View
struct SignUpView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var authService: AuthService
    @State private var displayName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: RuvoTheme.Spacing.lg) {
                    VStack(alignment: .leading, spacing: RuvoTheme.Spacing.xs) {
                        Text("Create Account")
                            .font(RuvoTheme.Typography.headingLarge)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                        Text("Join millions of runners worldwide")
                            .font(RuvoTheme.Typography.bodyMedium)
                            .foregroundColor(RuvoTheme.Colors.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(spacing: RuvoTheme.Spacing.md) {
                        RuvoTextField(placeholder: "Full Name", text: $displayName, icon: "person")
                        RuvoTextField(placeholder: "Email", text: $email, icon: "envelope", keyboardType: .emailAddress, autocapitalization: .never)
                        RuvoTextField(placeholder: "Password", text: $password, icon: "lock", isSecure: true, errorMessage: passwordError)
                        RuvoTextField(placeholder: "Confirm Password", text: $confirmPassword, icon: "lock.shield", isSecure: true)
                    }

                    if let error = errorMessage {
                        Text(error).font(RuvoTheme.Typography.bodySmall).foregroundColor(RuvoTheme.Colors.error)
                    }

                    RuvoButton(title: "Create Account", style: .primary, isLoading: isLoading) { signUp() }

                    SocialSignInDivider()
                    SocialSignInButtons()

                    Text("By continuing, you agree to our Terms of Service and Privacy Policy.")
                        .font(RuvoTheme.Typography.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                        .multilineTextAlignment(.center)
                }
                .padding(RuvoTheme.Spacing.lg)
            }
            .background(RuvoTheme.Colors.background.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    RuvoIconButton(icon: "xmark", action: { dismiss() })
                }
            }
        }
    }

    private var passwordError: String? {
        guard !password.isEmpty else { return nil }
        if password.count < 8 { return "Minimum 8 characters" }
        if !confirmPassword.isEmpty && password != confirmPassword { return "Passwords don't match" }
        return nil
    }

    private func signUp() {
        guard !displayName.isEmpty, !email.isEmpty, !password.isEmpty else {
            errorMessage = "Please fill in all fields."
            return
        }
        guard password == confirmPassword else {
            errorMessage = "Passwords do not match."
            return
        }
        isLoading = true
        errorMessage = nil
        Task {
            do {
                try await authService.signUp(email: email, password: password, displayName: displayName)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }
}

// MARK: – Shared social sign-in components
struct SocialSignInDivider: View {
    var body: some View {
        HStack(spacing: RuvoTheme.Spacing.md) {
            Rectangle().frame(height: 1).foregroundColor(RuvoTheme.Colors.border)
            Text("or").font(RuvoTheme.Typography.bodySmall).foregroundColor(RuvoTheme.Colors.textTertiary)
            Rectangle().frame(height: 1).foregroundColor(RuvoTheme.Colors.border)
        }
    }
}

struct SocialSignInButtons: View {
    @EnvironmentObject private var authService: AuthService

    var body: some View {
        VStack(spacing: RuvoTheme.Spacing.sm) {
            AppleSignInButton()
            GoogleSignInButton()
        }
    }
}
