//
//  WelcomeScreen.swift
//  Ruvo
//
//  Premium onboarding / welcome screen — SwiftUI port of WelcomeScreen.jsx.
//
//  Motion follows Emil Kowalski's animation guidelines
//  (github.com/emilkowalski/skills): ease-out entrances, transform/opacity
//  only, 60-140ms stagger between elements. On iOS the closest native
//  equivalent to the recommended `{ type: "spring", duration: 0.5, bounce: 0.2 }`
//  is SwiftUI's `.spring(duration:bounce:)` (iOS 17+), used below.
//

import SwiftUI

// MARK: - Design tokens

private enum Ruvo {
    static let lime = Color(red: 0.843, green: 1.0, blue: 0.231)       // #D7FF3B
    static let limeDim = Color(red: 0.722, green: 0.871, blue: 0.180)  // #B8DE2E
    static let bg = Color(red: 0.027, green: 0.035, blue: 0.039)       // #07090A
    static let ink = Color(red: 0.957, green: 0.965, blue: 0.937)      // #F4F6EF
    static let muted = Color(red: 0.612, green: 0.651, blue: 0.604)    // #9CA69A

    /// Poppins Black — the app's real display face (bundled + registered via
    /// PoppinsFontLoader), not the web mockup's Titillium Web.
    static func headlineFont(_ size: CGFloat) -> Font {
        Font.custom("Poppins-Black", size: size)
    }
}

// MARK: - Welcome screen

struct WelcomeScreen: View {
    var backgroundVideoName: String = "bg_welcome"
    var headlineLines: [String] = ["Take Control of", "Your Running Journey"]
    var accentWord: String = "Running"
    var subcopy: String = "Track your progress, set new challenges, and conquer your goals with ease."
    var ctaLabel: String = "Start Journey"
    var footerText: String = "Already have an account?"
    var loginLabel: String = "Log In"
    var onStartJourney: () -> Void = {}
    var onLogIn: () -> Void = {}

    @State private var appear = false

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                background(in: geo)

                VStack(alignment: .leading, spacing: 0) {
                    Spacer(minLength: 0)
                    content
                }
                .padding(.horizontal, 26)
                .padding(.top, 26)
                .padding(.bottom, 30)
            }
        }
        .background(Ruvo.bg)
        .ignoresSafeArea()
        .onAppear {
            // Two-tick delay mirrors the web version's double-rAF: guarantees
            // the initial (hidden) state has actually painted once before
            // animating in, so the transition always plays.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.02) {
                appear = true
            }
        }
    }

    // MARK: Background video + scrim

    private func background(in geo: GeometryProxy) -> some View {
        ZStack {
            LoopingVideoBackground(resourceName: backgroundVideoName, fileExtension: "mp4")
                .frame(width: geo.size.width, height: geo.size.height)
                .clipped()
                .scaleEffect(appear ? 1.0 : 1.08)
                .opacity(appear ? 1 : 0)
                .animation(RuvoTheme.Motion.easeInOut(1.4), value: appear)

            LinearGradient(
                stops: [
                    .init(color: Ruvo.bg.opacity(0.55), location: 0.00),
                    .init(color: Ruvo.bg.opacity(0.05), location: 0.22),
                    .init(color: Ruvo.bg.opacity(0.10), location: 0.42),
                    .init(color: Ruvo.bg.opacity(0.88), location: 0.66),
                    .init(color: Ruvo.bg,                location: 0.84),
                ],
                startPoint: .top, endPoint: .bottom
            )
        }
    }

    // MARK: Headline + subcopy + CTA + footer

    private var content: some View {
        VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 2) {
                headline
                Text(subcopy)
                    .font(.custom("Poppins-Regular", size: 15.5))
                    .foregroundStyle(Ruvo.muted)
                    .lineSpacing(4)
                    .frame(maxWidth: 320, alignment: .leading)
                    .opacity(appear ? 1 : 0)
                    .offset(y: appear ? 0 : 10)
                    .animation(RuvoTheme.Motion.easeOut(0.5).delay(0.26), value: appear)
            }

            CTAButton(label: ctaLabel, appear: appear, action: onStartJourney)

            HStack(spacing: 4) {
                Text(footerText)
                    .font(.custom("Poppins-Regular", size: 14))
                    .foregroundStyle(Ruvo.muted)
                Button(action: onLogIn) {
                    Text(loginLabel)
                        .font(.custom("Poppins-Bold", size: 14))
                        .foregroundStyle(Ruvo.lime)
                }
                .buttonStyle(.plain)
            }
            .frame(maxWidth: .infinity)
            .opacity(appear ? 1 : 0)
            .animation(RuvoTheme.Motion.easeOut(0.48).delay(0.42), value: appear)
        }
    }

    /// Renders two fixed lines, with `accentWord` colored lime — matches the
    /// web component's headline behaviour (always exactly 2 lines).
    private var headline: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(headlineLines.enumerated()), id: \.offset) { index, line in
                headlineLine(line, delay: 0.12 + Double(index) * 0.06)
            }
        }
    }

    private func headlineLine(_ line: String, delay: Double) -> some View {
        let text: Text
        if let range = line.range(of: accentWord) {
            let before = String(line[line.startIndex..<range.lowerBound])
            let after = String(line[range.upperBound...])
            text = Text(before)
                + Text(accentWord).foregroundColor(Ruvo.lime)
                + Text(after)
        } else {
            text = Text(line)
        }

        return text
            .font(Ruvo.headlineFont(28))
            .tracking(RuvoTheme.Typography.Tracking.headingLarge)
            .foregroundStyle(Ruvo.ink)
            .lineLimit(1)
            .minimumScaleFactor(0.7) // shrinks to fit rather than wrapping
            .fixedSize(horizontal: false, vertical: true)
            .opacity(appear ? 1 : 0)
            .offset(y: appear ? 0 : 14)
            .animation(RuvoTheme.Motion.easeOut(0.64).delay(delay), value: appear)
    }
}

// MARK: - CTA button with its own press state

private struct CTAButton: View {
    let label: String
    let appear: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.custom("Poppins-Bold", size: 16))
                .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                .foregroundStyle(Color(red: 0.043, green: 0.078, blue: 0))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 17)
        }
        .background(
            LinearGradient(
                colors: [Color(red: 0.894, green: 1, blue: 0.388), Ruvo.lime, Ruvo.limeDim],
                startPoint: .top, endPoint: .bottom
            )
        )
        .clipShape(Capsule())
        .shadow(color: Ruvo.lime.opacity(0.45), radius: 20, x: 0, y: 14)
        .buttonStyle(PressableStyle())
        .opacity(appear ? 1 : 0)
        .offset(y: appear ? 0 : 10)
        .animation(RuvoTheme.Motion.easeOut(0.52).delay(0.34), value: appear)
    }
}

/// Scale-down-on-press feedback — mirrors the web version's
/// `scale(0.97)` / 160ms ease-out button press rule.
private struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(RuvoTheme.Motion.easeOut(RuvoTheme.Motion.Duration.quick), value: configuration.isPressed)
    }
}

// MARK: - Preview

#Preview {
    // The preview canvas never runs AppDelegate, so the bundled Poppins
    // files wouldn't otherwise be registered here.
    PoppinsFontLoader.registerIfNeeded()
    return WelcomeScreen(
        onStartJourney: { print("Start Journey tapped") },
        onLogIn: { print("Log In tapped") }
    )
}
