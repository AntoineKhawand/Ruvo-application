import SwiftUI

struct AuthRootView: View {
    private enum Destination: Equatable { case welcome, login, signUp }
    @State private var destination: Destination = .welcome

    var body: some View {
        ZStack {
            switch destination {
            case .welcome:
                WelcomeScreen(
                    onStartJourney: { destination = .signUp },
                    onLogIn: { destination = .login }
                )
                .transition(.push(from: .leading))
            case .login:
                LoginView(
                    onBack: { destination = .welcome },
                    onSignUp: { destination = .signUp }
                )
                .transition(.push(from: .trailing))
            case .signUp:
                SignUpView(
                    onBack: { destination = .welcome },
                    onSignIn: { destination = .login }
                )
                .transition(.push(from: .trailing))
            }
        }
        .animation(RuvoTheme.Motion.easeInOut(RuvoTheme.Motion.Duration.entrance), value: destination)
    }
}

// MARK: – Shared brand mark
// The same lime-gradient glowing badge as the Run tab's center button
// (RuvoTabBar.swift) enlarged for a screen-level header -- reusing an
// already-established motif instead of introducing a new logo asset.
struct AuthBrandMark: View {
    var size: CGFloat = 88

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [RuvoTheme.Colors.primary, Color(hex: "#A8CC00")],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size, height: size)
                .shadow(color: RuvoTheme.Colors.primary.opacity(0.5), radius: 24, y: 8)

            Image(systemName: "figure.run")
                .font(.system(size: size * 0.42, weight: .bold))
                .foregroundColor(.black)
        }
    }
}

// MARK: – Shared "prompt + action" footer link (Sign In <-> Sign Up)
struct AuthFooterLink: View {
    let prompt: String
    let action: String
    let onTap: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            Text(prompt)
                .font(RuvoTheme.Typography.bodyMedium)
                .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                .foregroundColor(RuvoTheme.Colors.textSecondary)
            Button(action: onTap) {
                Text(action)
                    .font(RuvoTheme.Typography.labelLarge)
                    .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                    .foregroundColor(RuvoTheme.Colors.primary)
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: – Terms & Conditions checkbox (Sign Up only)
private struct TermsCheckbox: View {
    @Binding var isChecked: Bool

    var body: some View {
        Button(action: { isChecked.toggle() }) {
            HStack(alignment: .top, spacing: RuvoTheme.Spacing.sm) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(isChecked ? RuvoTheme.Colors.primary : Color.clear)
                    .frame(width: 22, height: 22)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(isChecked ? Color.clear : RuvoTheme.Colors.border, lineWidth: 1.5)
                    )
                    .overlay(
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.black)
                            .opacity(isChecked ? 1 : 0)
                    )

                (
                    Text("By tapping here you agree to our ")
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                    + Text("Terms and Conditions")
                        .foregroundColor(RuvoTheme.Colors.primary)
                    + Text(" & ")
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                    + Text("Privacy Policy")
                        .foregroundColor(RuvoTheme.Colors.primary)
                )
                .font(RuvoTheme.Typography.bodySmall)
                .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
        .animation(RuvoTheme.Motion.easeOut(RuvoTheme.Motion.Duration.quick), value: isChecked)
    }
}

// MARK: – Login View
struct LoginView: View {
    let onBack: () -> Void
    var onSignUp: () -> Void = {}
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
                    VStack(spacing: RuvoTheme.Spacing.md) {
                        AuthBrandMark()
                        VStack(spacing: RuvoTheme.Spacing.xs) {
                            Text("Welcome Back")
                                .font(RuvoTheme.Typography.headingLarge)
                                .tracking(RuvoTheme.Typography.Tracking.headingLarge)
                                .foregroundColor(RuvoTheme.Colors.textPrimary)
                            Text("Sign in to continue your streak")
                                .font(RuvoTheme.Typography.bodyMedium)
                                .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                                .foregroundColor(RuvoTheme.Colors.textSecondary)
                        }
                        .multilineTextAlignment(.center)
                    }
                    .padding(.top, RuvoTheme.Spacing.md)

                    VStack(spacing: RuvoTheme.Spacing.md) {
                        RuvoTextField(placeholder: "Email", text: $email, icon: "envelope", keyboardType: .emailAddress, autocapitalization: .never)
                        RuvoTextField(placeholder: "Password", text: $password, icon: "lock", isSecure: true)
                    }

                    if let error = errorMessage {
                        Text(error)
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.error)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button("Forgot Password?") { showForgotPassword = true }
                        .font(RuvoTheme.Typography.labelLarge)
                        .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                        .foregroundColor(RuvoTheme.Colors.primary)
                        .frame(maxWidth: .infinity, alignment: .trailing)

                    VStack(spacing: RuvoTheme.Spacing.lg) {
                        RuvoButton(title: "Sign In", style: .primary, isLoading: isLoading) {
                            signIn()
                        }
                        .shadow(color: RuvoTheme.Shadow.primaryGlow, radius: 20, y: 8)

                        SocialSignInDivider()
                        SocialSignInButtons()
                    }

                    AuthFooterLink(prompt: "Don't have an account?", action: "Sign Up", onTap: onSignUp)
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
    var onBack: () -> Void = {}
    var onSignIn: () -> Void = {}
    @EnvironmentObject private var authService: AuthService
    @State private var displayName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var agreedToTerms = false
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: RuvoTheme.Spacing.lg) {
                    VStack(spacing: RuvoTheme.Spacing.md) {
                        AuthBrandMark()
                        VStack(spacing: RuvoTheme.Spacing.xs) {
                            Text("Sign Up")
                                .font(RuvoTheme.Typography.headingLarge)
                                .tracking(RuvoTheme.Typography.Tracking.headingLarge)
                                .foregroundColor(RuvoTheme.Colors.textPrimary)
                            Text("Let's create your account")
                                .font(RuvoTheme.Typography.bodyMedium)
                                .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                                .foregroundColor(RuvoTheme.Colors.textSecondary)
                        }
                        .multilineTextAlignment(.center)
                    }
                    .padding(.top, RuvoTheme.Spacing.md)

                    VStack(spacing: RuvoTheme.Spacing.md) {
                        RuvoTextField(placeholder: "Full Name", text: $displayName, icon: "person")
                        RuvoTextField(placeholder: "Email", text: $email, icon: "envelope", keyboardType: .emailAddress, autocapitalization: .never)
                        RuvoTextField(placeholder: "Password", text: $password, icon: "lock", isSecure: true, errorMessage: passwordError)
                        RuvoTextField(placeholder: "Confirm Password", text: $confirmPassword, icon: "lock.shield", isSecure: true)
                    }

                    if let error = errorMessage {
                        Text(error).font(RuvoTheme.Typography.bodySmall).tracking(RuvoTheme.Typography.Tracking.bodySmall).foregroundColor(RuvoTheme.Colors.error)
                    }

                    TermsCheckbox(isChecked: $agreedToTerms)

                    VStack(spacing: RuvoTheme.Spacing.lg) {
                        RuvoButton(title: "Sign Up", style: .primary, isLoading: isLoading) { signUp() }
                            .disabled(!canSubmit)
                            .shadow(color: agreedToTerms ? RuvoTheme.Shadow.primaryGlow : .clear, radius: 20, y: 8)

                        SocialSignInDivider()
                        SocialSignInButtons()
                    }

                    AuthFooterLink(prompt: "Already have an account?", action: "Sign In", onTap: onSignIn)
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
    }

    private var passwordError: String? {
        guard !password.isEmpty else { return nil }
        if password.count < 8 { return "Minimum 8 characters" }
        if !confirmPassword.isEmpty && password != confirmPassword { return "Passwords don't match" }
        return nil
    }

    private var canSubmit: Bool {
        !displayName.isEmpty && !email.isEmpty && !password.isEmpty
            && password == confirmPassword && agreedToTerms
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
        guard agreedToTerms else {
            errorMessage = "Please agree to the Terms and Conditions to continue."
            return
        }
        isLoading = true
        errorMessage = nil
        Task {
            do {
                try await authService.signUp(email: email, password: password, displayName: displayName)
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
            Text("or").font(RuvoTheme.Typography.bodySmall).tracking(RuvoTheme.Typography.Tracking.bodySmall).foregroundColor(RuvoTheme.Colors.textTertiary)
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
