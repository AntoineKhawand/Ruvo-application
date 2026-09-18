import SwiftUI
import Foundation

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

// MARK: – Auth screens: bespoke warm-glow hero treatment
// Ported from a design reference (a dark radial-glow mockup) with its
// original orange recolored to Ruvo's lime, reusing the app's real lime
// tokens (RuvoTheme.Colors.primary/background) for the bright and black
// ends of the gradient so it stays consistent with the rest of the app;
// only the darkest mid-tone (authGlowDark) is new. Bespoke to these two
// screens -- no other screen uses this glass-on-glow look, so these stay
// local rather than becoming design-system tokens.
private let authGlowMid = Color(hex: "#A8CC00")
private let authGlowDark = Color(hex: "#2B3300")
private let authTextPrimary = Color(hex: "#F5EFE9")

private struct AuthRadialBackground: View {
    var body: some View {
        EllipticalGradient(
            gradient: Gradient(stops: [
                .init(color: RuvoTheme.Colors.primary, location: 0),
                .init(color: authGlowMid, location: 0.34),
                .init(color: authGlowDark, location: 0.58),
                .init(color: RuvoTheme.Colors.background, location: 0.80),
                .init(color: RuvoTheme.Colors.background, location: 1.0),
            ]),
            center: .top,
            startRadiusFraction: 0,
            endRadiusFraction: 0.75
        )
        .background(RuvoTheme.Colors.background)
        .ignoresSafeArea()
    }
}

// Square glass badge with the running icon -- the reference's exact shape
// (56pt rounded-16 glass square, not the app's other circular lime badges),
// used only on Sign Up per its source; Sign In drops the icon entirely.
private struct AuthBrandBadge: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16)
                .fill(
                    LinearGradient(
                        colors: [Color.white.opacity(0.14), Color.white.opacity(0.02)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.18), lineWidth: 1)
                )
                .frame(width: 56, height: 56)
            Image(systemName: "figure.run")
                .font(.system(size: 26, weight: .bold))
                .foregroundColor(RuvoTheme.Colors.primary)
        }
    }
}

// Translucent glass pill field matching the reference exactly -- distinct
// from the app-wide RuvoTextField (solid surfaceElevated fill), since these
// two screens sit on the radial glow rather than a flat background.
private struct AuthGlassField: View {
    let placeholder: String
    @Binding var text: String
    var icon: String? = nil
    var isSecure: Bool = false
    var keyboardType: UIKeyboardType = .default
    var autocapitalization: TextInputAutocapitalization = .sentences
    var trailing: AnyView? = nil

    var body: some View {
        HStack(spacing: 12) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundColor(authTextPrimary.opacity(0.6))
            }
            Group {
                if isSecure {
                    SecureField("", text: $text, prompt: Text(placeholder).foregroundColor(authTextPrimary.opacity(0.35)))
                } else {
                    TextField("", text: $text, prompt: Text(placeholder).foregroundColor(authTextPrimary.opacity(0.35)))
                        .keyboardType(keyboardType)
                        .textInputAutocapitalization(autocapitalization)
                }
            }
            .font(.system(size: 14.5))
            .foregroundColor(authTextPrimary)
            if let trailing {
                trailing
            }
        }
        .padding(.horizontal, 16)
        .frame(height: 50)
        .background(Color.white.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.white.opacity(0.14), lineWidth: 1)
        )
    }
}

private func isValidAuthEmail(_ email: String) -> Bool {
    let pattern = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
    return NSPredicate(format: "SELF MATCHES %@", pattern).evaluate(with: email)
}

// One-shot particle burst (matches the reference's 700ms CSS keyframe) that
// plays once when the email field's validity flips from invalid to valid --
// the reference's version is a static always-on demo flourish tied to
// mount, not to real validation; keying it to a real transition is the
// interactive equivalent for an actual input field.
private struct ConfettiPiece: Identifiable {
    let id: Int
    let dx: CGFloat
    let dy: CGFloat
    let rotation: Double
    let color: Color
    let isCircle: Bool
}

private struct AuthConfettiBurst: View {
    @State private var progress: CGFloat = 0
    private let pieces: [ConfettiPiece] = {
        let colors: [Color] = [Color(hex: "#F97316"), RuvoTheme.Colors.primary, Color(hex: "#34C759"), Color(hex: "#FFE066"), Color(hex: "#FF6B81")]
        return (0..<14).map { i in
            let angle = Double.random(in: 0...(2 * .pi))
            let distance = CGFloat.random(in: 14...30)
            return ConfettiPiece(
                id: i,
                dx: cos(angle) * distance,
                dy: sin(angle) * distance,
                rotation: Double.random(in: -180...180),
                color: colors[i % colors.count],
                isCircle: Bool.random()
            )
        }
    }()

    var body: some View {
        ZStack {
            ForEach(pieces) { piece in
                Group {
                    if piece.isCircle {
                        Circle().fill(piece.color)
                    } else {
                        RoundedRectangle(cornerRadius: 1).fill(piece.color)
                    }
                }
                .frame(width: 5, height: 5)
                .opacity(1 - progress)
                .scaleEffect(1 - 0.6 * progress)
                .rotationEffect(.degrees(piece.rotation * progress))
                .offset(x: piece.dx * progress, y: piece.dy * progress)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.7)) {
                progress = 1
            }
        }
    }
}

private struct AuthEmailValidBadge: View {
    let email: String
    @State private var burstID = 0

    private var isValid: Bool { isValidAuthEmail(email) }

    var body: some View {
        Group {
            if isValid {
                ZStack {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundColor(Color(hex: "#34C759"))
                    AuthConfettiBurst()
                        .id(burstID)
                }
            }
        }
        .onChange(of: isValid) { oldValue, newValue in
            if newValue && !oldValue { burstID += 1 }
        }
    }
}

// Segmented strength bar + label + live checklist, styled to match the
// reference exactly, but driven by the app's REAL 6-rule password policy
// (PasswordStrength.swift, ported from Android's, already used to gate
// signup) rather than the reference's simpler 5-rule display-only version --
// matching its look without quietly weakening what the button requires.
private struct AuthPasswordStrengthMeter: View {
    let rules: PasswordRules

    // Every one of the 6 real rules still gates the Sign Up button
    // (isPasswordValid) -- this only shortens the DISPLAY to 4 lines instead
    // of 6 (paired rules collapse into one row each) so the checklist
    // doesn't push the rest of the form below the fold on shorter screens.
    private var items: [(String, Bool)] {
        [
            ("At least 8 characters", rules.minLength),
            ("Upper & lowercase letters", rules.hasUpper && rules.hasLower),
            ("A number & special character", rules.hasNumber && rules.hasSymbol),
            ("Not a common password", rules.notCommon),
        ]
    }

    private var score: Int { items.filter { $0.1 }.count }
    private var total: Int { items.count }

    private var barColor: Color {
        switch score {
        case 0: return authTextPrimary.opacity(0.14)
        case 1: return RuvoTheme.Colors.error
        case total: return RuvoTheme.Colors.success
        default: return RuvoTheme.Colors.warning
        }
    }

    private var strengthLabel: String {
        switch score {
        case 0: return "Enter a password"
        case 1: return "Weak security"
        case total: return "Strong security"
        default: return "Medium security"
        }
    }

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 4) {
                ForEach(0..<total, id: \.self) { i in
                    RoundedRectangle(cornerRadius: 50)
                        .fill(i < score ? barColor : authTextPrimary.opacity(0.14))
                        .frame(height: 4)
                }
            }
            HStack {
                Text(strengthLabel)
                    .font(RuvoTheme.Typography.labelMedium)
                    .fontWeight(.semibold)
                    .foregroundColor(authTextPrimary)
                Spacer()
                Text("\(score)/\(total) requirements met")
                    .font(RuvoTheme.Typography.labelSmall)
                    .foregroundColor(authTextPrimary.opacity(0.45))
            }
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(spacing: 7) {
                        Image(systemName: item.1 ? "checkmark" : "xmark")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(item.1 ? RuvoTheme.Colors.success : authTextPrimary.opacity(0.4))
                        Text(item.0)
                            .font(RuvoTheme.Typography.bodySmall)
                            .foregroundColor(item.1 ? Color(hex: "#34D399") : authTextPrimary.opacity(0.45))
                    }
                }
            }
        }
    }
}

// MARK: – Shared "prompt + action" footer link (Sign In <-> Sign Up)
private struct AuthFooterLink: View {
    let prompt: String
    let action: String
    let onTap: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            Text(prompt)
                .font(RuvoTheme.Typography.bodyMedium)
                .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                .foregroundColor(authTextPrimary.opacity(0.6))
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

// Terms & Conditions checkbox (Sign Up only). Shows a plain outline when
// unchecked and a filled lime swatch + checkmark when checked -- verified
// live (on the Android build of this exact design) that dimming a
// permanently-filled swatch via opacity, as the reference does, reads as
// ambiguously "still checked" rather than clearly off for a control gating
// form submission, so this uses two distinct visual states instead.
// Also defaults to unchecked rather than the reference's pre-ticked
// default: a pre-checked consent box is a real dark pattern (and unlawful
// under GDPR-style consent rules), not just a style choice.
private struct TermsCheckbox: View {
    @Binding var isChecked: Bool

    var body: some View {
        Button(action: { isChecked.toggle() }) {
            HStack(alignment: .top, spacing: 10) {
                Group {
                    if isChecked {
                        RoundedRectangle(cornerRadius: 5)
                            .fill(LinearGradient(colors: [RuvoTheme.Colors.primary, Color(hex: "#A8CC00")], startPoint: .topLeading, endPoint: .bottomTrailing))
                            .overlay(
                                Image(systemName: "checkmark")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.black)
                            )
                    } else {
                        RoundedRectangle(cornerRadius: 5)
                            .stroke(authTextPrimary.opacity(0.35), lineWidth: 1.5)
                    }
                }
                .frame(width: 18, height: 18)
                .padding(.top, 2)

                (
                    Text("By tapping here you agree to our ")
                        .foregroundColor(authTextPrimary.opacity(0.65))
                    + Text("Terms and Conditions")
                        .foregroundColor(RuvoTheme.Colors.primary)
                    + Text(" & ")
                        .foregroundColor(authTextPrimary.opacity(0.65))
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
    @State private var passwordVisible = false

    var body: some View {
        NavigationStack {
            ZStack {
                AuthRadialBackground()
                ScrollView {
                    VStack(spacing: RuvoTheme.Spacing.xl) {
                        // No brand badge here -- Sign In drops the icon per
                        // design direction, unlike Sign Up which keeps it.
                        VStack(spacing: RuvoTheme.Spacing.xs) {
                            Text("Welcome Back")
                                .font(RuvoTheme.Typography.headingLarge)
                                .tracking(RuvoTheme.Typography.Tracking.headingLarge)
                                .foregroundColor(authTextPrimary)
                            Text("Log in to continue your streak")
                                .font(RuvoTheme.Typography.bodyMedium)
                                .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                                .foregroundColor(authTextPrimary.opacity(0.55))
                        }
                        .multilineTextAlignment(.center)
                        .padding(.top, RuvoTheme.Spacing.md)

                        VStack(spacing: RuvoTheme.Spacing.md) {
                            AuthGlassField(placeholder: "Email", text: $email, icon: "envelope", keyboardType: .emailAddress, autocapitalization: .never)
                            AuthGlassField(
                                placeholder: "Password",
                                text: $password,
                                icon: "lock",
                                isSecure: !passwordVisible,
                                trailing: AnyView(
                                    Button(action: { passwordVisible.toggle() }) {
                                        Image(systemName: passwordVisible ? "eye.slash" : "eye")
                                            .font(.system(size: 16))
                                            .foregroundColor(authTextPrimary.opacity(0.55))
                                    }
                                )
                            )
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
                            RuvoButton(title: "Log In", style: .primary, isLoading: isLoading) {
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
            }
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
    @State private var passwordVisible = false
    @State private var agreedToTerms = false
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                AuthRadialBackground()
                ScrollView {
                    VStack(spacing: RuvoTheme.Spacing.lg) {
                        VStack(spacing: RuvoTheme.Spacing.md) {
                            AuthBrandBadge()
                            VStack(spacing: RuvoTheme.Spacing.xs) {
                                Text("Sign Up")
                                    .font(RuvoTheme.Typography.headingLarge)
                                    .tracking(RuvoTheme.Typography.Tracking.headingLarge)
                                    .foregroundColor(authTextPrimary)
                                Text("Let's create your account")
                                    .font(RuvoTheme.Typography.bodyMedium)
                                    .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                                    .foregroundColor(authTextPrimary.opacity(0.55))
                            }
                            .multilineTextAlignment(.center)
                        }
                        .padding(.top, RuvoTheme.Spacing.md)

                        VStack(spacing: RuvoTheme.Spacing.md) {
                            AuthGlassField(placeholder: "Full Name", text: $displayName, icon: "person")
                            AuthGlassField(
                                placeholder: "Email",
                                text: $email,
                                icon: "envelope",
                                keyboardType: .emailAddress,
                                autocapitalization: .never,
                                trailing: AnyView(AuthEmailValidBadge(email: email))
                            )
                        }

                        VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
                            Text("Secure Password")
                                .font(RuvoTheme.Typography.labelMedium)
                                .fontWeight(.semibold)
                                .foregroundColor(authTextPrimary)
                            AuthGlassField(
                                placeholder: "Create a strong password",
                                text: $password,
                                isSecure: !passwordVisible,
                                trailing: AnyView(
                                    Button(action: { passwordVisible.toggle() }) {
                                        Image(systemName: passwordVisible ? "eye.slash" : "eye")
                                            .font(.system(size: 16))
                                            .foregroundColor(authTextPrimary.opacity(0.55))
                                    }
                                )
                            )
                            // Shown once typing starts, matching the live-checklist
                            // behavior this app already used before the restyle.
                            if !password.isEmpty {
                                AuthPasswordStrengthMeter(rules: checkPasswordRules(password))
                            }
                        }

                        if let error = errorMessage {
                            Text(error)
                                .font(RuvoTheme.Typography.bodySmall)
                                .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                                .foregroundColor(RuvoTheme.Colors.error)
                        }

                        TermsCheckbox(isChecked: $agreedToTerms)

                        VStack(spacing: RuvoTheme.Spacing.lg) {
                            RuvoButton(title: "Sign Up", style: .primary, isLoading: isLoading) { signUp() }
                                .disabled(!canSubmit)
                                .shadow(color: agreedToTerms ? RuvoTheme.Shadow.primaryGlow : .clear, radius: 20, y: 8)

                            SocialSignInDivider()
                            SocialSignInButtons()
                        }

                        AuthFooterLink(prompt: "Already have an account?", action: "Log In", onTap: onSignIn)
                    }
                    .padding(RuvoTheme.Spacing.lg)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    RuvoIconButton(icon: "chevron.left", action: onBack)
                }
            }
        }
    }

    private var canSubmit: Bool {
        !displayName.isEmpty && !email.isEmpty && isPasswordValid(password) && agreedToTerms
    }

    private func signUp() {
        guard !displayName.isEmpty, !email.isEmpty, !password.isEmpty else {
            errorMessage = "Please fill in all fields."
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
