//
//  GoalDeck.swift
//
//  Onboarding step 1: a swipeable stack of goal cards -- SwiftUI port of the
//  approved "Ruvo Onboarding: Goal" web design (and of the Android GoalDeck.kt).
//
//  * Swipe the top card left to send it to the back, right to bring the
//    previous one back. Tap it (or flick it up) to choose it; tap again to
//    un-choose. OnboardingView keeps Continue disabled until a goal is chosen.
//  * Each goal has its own accent color that tints the card and the glow
//    behind the deck; the chosen card turns brand lime.
//  * The plan line is deliberately generic: the app has no fixed plan length
//    per goal (the plan generator lets the user pick 4-24 weeks), so the
//    design's sample "8 weeks, 3 runs a week" copy is not shown as fact.
//
//  NOTE: written without a Swift toolchain in the authoring environment --
//  verify it builds and feels right on a Mac/simulator.
//

import SwiftUI
import UIKit

// MARK: - Content

private struct DeckGoal {
    let goal: RunningGoal
    let title: String
    let chip: String
    let note: String
    let accent: Color
    let icon: [String]
}

private let planLine = "Plan built around your week"

private let deckGoals: [DeckGoal] = [
    DeckGoal(goal: .stayHealthy,  title: "Stay Healthy",  chip: "Any pace",    note: "Build a weekly habit",    accent: Color(hex: "#4ADE80"), icon: DeckIcons.healthy),
    DeckGoal(goal: .run5k,        title: "Run 5K",        chip: "5 km",        note: "Your first 5 kilometers", accent: Color(hex: "#38BDF8"), icon: DeckIcons.run5k),
    DeckGoal(goal: .run10k,       title: "Run 10K",       chip: "10 km",       note: "Build speed and stamina", accent: Color(hex: "#FB923C"), icon: DeckIcons.run10k),
    DeckGoal(goal: .halfMarathon, title: "Half Marathon", chip: "21.1 km",     note: "Train step by step",      accent: Color(hex: "#A78BFA"), icon: DeckIcons.half),
    DeckGoal(goal: .marathon,     title: "Full Marathon", chip: "42.2 km",     note: "The big one",             accent: Color(hex: "#FACC15"), icon: DeckIcons.full),
    DeckGoal(goal: .loseWeight,   title: "Lose Weight",   chip: "Weekly runs", note: "Burn more, run by run",   accent: Color(hex: "#FB7185"), icon: DeckIcons.lose),
]

// Icons: Hugeicons (free set, MIT), 24x24 stroke paths.
private enum DeckIcons {
    static let healthy = [
        "M10.4107 19.9677C7.58942 17.858 2 13.0348 2 8.69444C2 5.82563 4.10526 3.5 7 3.5C8.5 3.5 10 4 12 6C14 4 15.5 3.5 17 3.5C19.8947 3.5 22 5.82563 22 8.69444C22 13.0348 16.4106 17.858 13.5893 19.9677C12.6399 20.6776 11.3601 20.6776 10.4107 19.9677Z",
        "M20.001 13.0001H16.0288C15.8168 13.0001 15.7107 13.0001 15.619 12.9639C15.5691 12.9442 15.5229 12.9169 15.4821 12.8831C15.4072 12.8209 15.3598 12.7303 15.2649 12.5491C14.9921 12.0278 14.8557 11.7672 14.6597 11.7045C14.5567 11.6716 14.4453 11.6716 14.3422 11.7045C14.1462 11.7672 14.0098 12.0278 13.737 12.5491L13.1172 13.7335C12.6442 14.6372 12.4078 15.089 12.0706 15.0624C11.7335 15.0357 11.578 14.5529 11.267 13.5872L10.8024 12.1447C10.4668 11.1027 10.299 10.5817 9.95039 10.5639C9.60176 10.5462 9.377 11.0472 8.92748 12.0493L8.76073 12.4211C8.63475 12.7019 8.57176 12.8423 8.44652 12.9212C8.32129 13.0001 8.16139 13.0001 7.84158 13.0001H4.00098",
    ]
    static let run5k = [
        "M12.4059 18.9923C13.4443 19.7399 13.9635 20.1137 14.5623 20.3069C15.1611 20.5 15.8008 20.5 17.0804 20.5H19C20.4142 20.5 21.1213 20.5 21.5607 20.0607C22 19.6213 22 18.9142 22 17.5H16.7902C16.1504 17.5 15.8305 17.5 15.5311 17.4034C15.2318 17.3069 14.9722 17.12 14.453 16.7461L3 8.5L2.30911 9.53634C2.10755 9.83867 2 10.1939 2 10.5572C2 11.1492 2.2847 11.705 2.76507 12.0509L12.4059 18.9923Z",
        "M3 8.5L6 3.5L6.30704 5.34226C6.42827 6.06965 6.89023 6.69511 7.5498 7.0249C8.64393 7.57197 9.97486 7.16899 10.5818 6.10689L11.1396 5.13069C11.3625 4.74069 11.7772 4.5 12.2264 4.5C12.7005 4.5 13.1339 4.76787 13.346 5.19193L17.2764 13.0528C17.4134 13.3269 17.6936 13.5 18 13.5C20.2091 13.5 22 15.2909 22 17.5",
        "M12.5 9.5L14.5 8.5",
        "M14 12L16 11",
        "M6 20.5H18",
        "M2 17.5H5",
    ]
    static let run10k = [
        "M13.8561 22C26.0783 19 19.2338 7 10.9227 2C9.9453 5.5 8.47838 6.5 5.54497 10C1.66121 14.6339 3.5895 20 8.96719 22C8.1524 21 6.04958 18.9008 7.5 16C8 15 9 14 8.5 12C9.47778 12.5 11.5 13 12 15.5C12.8148 14.5 13.6604 12.4 12.8783 10C19 14.5 16.5 19 13.8561 22Z",
    ]
    static let half = [
        "M5.22576 11.3294L12.224 2.34651C12.7713 1.64397 13.7972 2.08124 13.7972 3.01707V9.96994C13.7972 10.5305 14.1995 10.985 14.6958 10.985H18.0996C18.8729 10.985 19.2851 12.0149 18.7742 12.6706L11.776 21.6535C11.2287 22.356 10.2028 21.9188 10.2028 20.9829V14.0301C10.2028 13.4695 9.80048 13.015 9.3042 13.015H5.90035C5.12711 13.015 4.71494 11.9851 5.22576 11.3294Z",
    ]
    static let full = [
        "M12 15V19",
        "M7 5H5.58088C5.03886 5 4.76785 5 4.55944 5.10228C4.36064 5.19984 4.19984 5.36064 4.10228 5.55944C4 5.76785 4 6.03886 4 6.58088C4 7.6579 4 8.19641 4.16249 8.66982C4.31812 9.12325 4.58015 9.53278 4.92663 9.8641C5.28837 10.21 5.77732 10.4357 6.7552 10.887L7 11",
        "M17 5H18.4191C18.9611 5 19.2322 5 19.4406 5.10228C19.6394 5.19984 19.8002 5.36064 19.8977 5.55944C20 5.76785 20 6.03886 20 6.58088C20 7.6579 20 8.19641 19.8375 8.66982C19.6819 9.12325 19.4198 9.53278 19.0734 9.8641C18.7116 10.21 18.2227 10.4357 17.2448 10.887L17 11",
        "M7 4.88889C7 4.06119 7 3.64735 7.12061 3.31596C7.32281 2.76043 7.76043 2.32281 8.31596 2.12061C8.64735 2 9.06119 2 9.88889 2H14.1111C14.9388 2 15.3527 2 15.684 2.12061C16.2396 2.32281 16.6772 2.76043 16.8794 3.31596C17 3.64735 17 4.06119 17 4.88889V10C17 12.7614 14.7614 15 12 15C9.23858 15 7 12.7614 7 10V4.88889Z",
        "M8 22C8 21.0681 8 20.6022 8.15224 20.2346C8.35523 19.7446 8.74458 19.3552 9.23463 19.1522C9.60218 19 10.0681 19 11 19H13C13.9319 19 14.3978 19 14.7654 19.1522C15.2554 19.3552 15.6448 19.7446 15.8478 20.2346C16 20.6022 16 21.0681 16 22H8Z",
    ]
    static let lose = [
        "M15.1312 2.5C14.1462 2.17555 13.0936 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 10.9548 21.8396 9.94704 21.5422 9",
        "M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7",
        "M19.5 4.5L12 12M19.5 4.5V2M19.5 4.5H22",
    ]
    static let calendar = [
        "M16 2V6M8 2V6",
        "M13 4H11C7.22876 4 5.34315 4 4.17157 5.17157C3 6.34315 3 8.22876 3 12V14C3 17.7712 3 19.6569 4.17157 20.8284C5.34315 22 7.22876 22 11 22H13C16.7712 22 18.6569 22 19.8284 20.8284C21 19.6569 21 17.7712 21 14V12C21 8.22876 21 6.34315 19.8284 5.17157C18.6569 4 16.7712 4 13 4Z",
        "M3 10H21",
        "M12.1258 14H12.0008M12.1258 18H12.0008M7.625 14H7.5M7.625 18H7.5M16.625 14H16.5",
    ]
    static let tick = ["M5 14L8.5 17.5L19 6.5"]
}

// MARK: - SVG path -> SwiftUI Path (M L H V C Z, absolute -- all the icons above use)

private enum SVGPathParser {
    static func parse(_ d: String) -> Path {
        var path = Path()
        let chars = Array(d)
        let n = chars.count
        var i = 0
        var cmd: Character = "M"
        var cur = CGPoint.zero
        var start = CGPoint.zero

        func skipSeparators() {
            while i < n, chars[i] == " " || chars[i] == "," || chars[i] == "\n" || chars[i] == "\t" { i += 1 }
        }
        func number() -> CGFloat? {
            skipSeparators()
            guard i < n else { return nil }
            var s = ""
            if chars[i] == "-" || chars[i] == "+" { s.append(chars[i]); i += 1 }
            var seenDot = false
            while i < n {
                let c = chars[i]
                if c.isASCII, c.isNumber {
                    s.append(c); i += 1
                } else if c == ".", !seenDot {
                    seenDot = true; s.append(c); i += 1
                } else {
                    break
                }
            }
            guard let v = Double(s) else { return nil }
            return CGFloat(v)
        }

        while true {
            skipSeparators()
            guard i < n else { break }
            if chars[i].isLetter { cmd = chars[i]; i += 1 }
            switch cmd {
            case "M":
                guard let x = number(), let y = number() else { return path }
                cur = CGPoint(x: x, y: y); start = cur
                path.move(to: cur)
                cmd = "L"                       // extra pairs after M are implicit lineto
            case "L":
                guard let x = number(), let y = number() else { return path }
                cur = CGPoint(x: x, y: y)
                path.addLine(to: cur)
            case "H":
                guard let x = number() else { return path }
                cur = CGPoint(x: x, y: cur.y)
                path.addLine(to: cur)
            case "V":
                guard let y = number() else { return path }
                cur = CGPoint(x: cur.x, y: y)
                path.addLine(to: cur)
            case "C":
                guard let x1 = number(), let y1 = number(),
                      let x2 = number(), let y2 = number(),
                      let x = number(), let y = number() else { return path }
                cur = CGPoint(x: x, y: y)
                path.addCurve(to: cur, control1: CGPoint(x: x1, y: y1), control2: CGPoint(x: x2, y: y2))
            case "Z", "z":
                path.closeSubpath()
                cur = start
                cmd = "M"                       // a number after Z would be a new subpath
            default:
                return path                     // unsupported command: draw what we have
            }
        }
        return path
    }
}

private struct SVGShape: Shape {
    let d: String
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 24
        return SVGPathParser.parse(d)
            .applying(CGAffineTransform(scaleX: s, y: s))
            .offsetBy(dx: rect.minX, dy: rect.minY)
    }
}

private struct StrokeIcon: View {
    let paths: [String]
    let size: CGFloat
    let color: Color
    var lineWidth: CGFloat = 1.5

    var body: some View {
        ZStack {
            ForEach(paths.indices, id: \.self) { idx in
                SVGShape(d: paths[idx])
                    .stroke(color, style: StrokeStyle(lineWidth: lineWidth * size / 24, lineCap: .round, lineJoin: .round))
            }
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Step

private enum DeckAxis { case horizontal, vertical }

struct GoalStep: View {
    @Binding var selected: RunningGoal?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var active = 0
    @State private var dragX: CGFloat = 0
    @State private var lift: CGFloat = 0
    @State private var axis: DeckAxis?
    @State private var busy = false
    @State private var exitCard: Int?
    @State private var exitX: CGFloat = 0
    @State private var exitFade: CGFloat = 1
    @State private var enterCard: Int?
    @State private var enterX: CGFloat = 0
    @State private var enterFade: CGFloat = 1
    @State private var burstKey = 0
    @State private var introDone = false

    private let count = deckGoals.count
    private let stackOffset: CGFloat = 9
    private let flyDistance: CGFloat = 420
    private let swipe: CGFloat = 50
    private let liftMin: CGFloat = 64

    private var settle: Animation {
        reduceMotion ? .linear(duration: 0.01) : .spring(response: 0.6, dampingFraction: 0.75)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.xs) {
                Text("What's your goal?")
                    .font(RuvoTheme.Typography.displayMedium)
                    .tracking(RuvoTheme.Typography.Tracking.displayMedium)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                Text("We'll personalize your training plan")
                    .font(RuvoTheme.Typography.bodyLarge)
                    .tracking(RuvoTheme.Typography.Tracking.bodyLarge)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
            }

            GeometryReader { geo in
                deck(in: geo.size)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            footer
        }
        .padding(.horizontal, RuvoTheme.Spacing.lg)
        .padding(.top, RuvoTheme.Spacing.xl)
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.02) { introDone = true }
        }
    }

    // MARK: Deck

    private func slot(_ i: Int) -> Int { ((i - active) % count + count) % count }

    private func deck(in size: CGSize) -> some View {
        let cardH = min(330, size.height - 24)
        let cardW = cardH * 252 / 330
        let topGoal = deckGoals[active]
        let topChosen = selected == topGoal.goal
        let glow = topChosen ? RuvoTheme.Colors.primary : topGoal.accent

        return ZStack {
            Circle()
                .fill(RadialGradient(colors: [glow.opacity(0.17), .clear], center: .center, startRadius: 0, endRadius: 280))
                .frame(width: 560, height: 560)
                .scaleEffect(selected != nil ? 1.1 : 1)
                .offset(y: size.height * 0.02)
                .animation(reduceMotion ? nil : .easeOut(duration: 0.7), value: active)
                .allowsHitTesting(false)

            ForEach(deckGoals.indices, id: \.self) { i in
                card(i, width: cardW, height: cardH)
            }
        }
        .frame(width: size.width, height: size.height)
        .contentShape(Rectangle())
        .gesture(dragGesture)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Goal \(topGoal.title), \(active + 1) of \(count)")
        .accessibilityValue(topChosen ? "Chosen" : "Not chosen")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { choose(active) }
        .accessibilityAction(named: "Next goal") { next() }
        .accessibilityAction(named: "Previous goal") { prev() }
    }

    private func card(_ i: Int, width: CGFloat, height: CGFloat) -> some View {
        let p = slot(i)
        let isTop = p == 0
        let visible = p <= 3
        let chosen = selected == deckGoals[i].goal

        let stack = CGFloat(p) * stackOffset - 13
        let x = stack + (isTop ? dragX : 0) + (exitCard == i ? exitX : 0) + (enterCard == i ? enterX : 0)
        let introShift: CGFloat = introDone ? 0 : 70
        let y = stack + (isTop ? lift : 0) + introShift
        let rot = Double(p - 1) * 1.3 + Double(isTop ? dragX / 18 : 0)
        var sc = 1 - CGFloat(p) * 0.045
        if isTop {
            if chosen { sc += 0.04 }
            if dragX != 0 || lift != 0 { sc = max(sc, 1.02) }
        }
        if !introDone { sc *= 0.82 }
        let anchor = UnitPoint(x: 0.5, y: 0.6)
        var opacity: Double = visible ? 1 : 0
        if !introDone { opacity = 0 }
        if exitCard == i { opacity *= Double(exitFade) }
        if enterCard == i { opacity *= Double(enterFade) }

        return GoalCardView(
            goal: deckGoals[i],
            isTop: isTop,
            chosen: chosen,
            dragX: isTop ? dragX : 0,
            lift: isTop ? lift : 0,
            burstKey: chosen ? burstKey : 0
        )
        .frame(width: width, height: height)
        .brightness(-Double(min(p, 3)) * 0.16)
        .scaleEffect(sc, anchor: anchor)
        .rotationEffect(.degrees(rot), anchor: anchor)
        .offset(x: x, y: y)
        .opacity(opacity)
        .zIndex(Double(100 - p))
        .allowsHitTesting(visible)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.6).delay(introDone ? 0 : Double(p) * 0.07), value: introDone)
        .onTapGesture {
            if isTop { choose(i) } else { goTo(i) }
        }
    }

    // MARK: Gestures

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { v in
                if busy { return }
                if axis == nil {
                    axis = abs(v.translation.width) >= abs(v.translation.height) ? .horizontal : .vertical
                }
                if axis == .horizontal {
                    dragX = v.translation.width
                } else {
                    let dy = v.translation.height
                    lift = dy < 0 ? dy * 0.9 : dy * 0.15
                }
            }
            .onEnded { v in
                let ax = axis
                axis = nil
                if busy { return }
                let w = v.translation.width
                let flick = v.predictedEndTranslation.width - w      // extra distance the flick would carry
                if ax == .horizontal {
                    if w < -swipe || (w < -8 && flick < -160) {
                        next()
                    } else if w > swipe || (w > 8 && flick > 160) {
                        prev()
                    } else {
                        settleBack()
                    }
                } else if ax == .vertical {
                    let was = lift
                    settleBack()
                    if was < -liftMin { choose(active) }
                } else {
                    settleBack()
                }
            }
    }

    private func settleBack() {
        withAnimation(settle) {
            dragX = 0
            lift = 0
        }
    }

    // MARK: Moving through the stack

    /// Top card is thrown off to the left, then the stack moves up.
    private func next() {
        guard !busy else { return }
        busy = true
        buzz()
        let top = active
        exitCard = top
        exitFade = 1
        exitX = 0
        withAnimation(reduceMotion ? nil : .easeIn(duration: 0.26)) {
            exitX = -flyDistance
            exitFade = 0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + (reduceMotion ? 0 : 0.26)) {
            var t = Transaction()
            t.disablesAnimations = true
            withTransaction(t) {
                dragX = 0
                lift = 0
            }
            withAnimation(settle) { active = (top + 1) % count }
            busy = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
                var t2 = Transaction()
                t2.disablesAnimations = true
                withTransaction(t2) {
                    exitCard = nil
                    exitX = 0
                    exitFade = 1
                }
            }
        }
    }

    /// The previous card slides back in from the left over the stack.
    private func prev() {
        guard !busy else { return }
        busy = true
        buzz()
        let incoming = (active - 1 + count) % count
        var t = Transaction()
        t.disablesAnimations = true
        withTransaction(t) {
            dragX = 0
            lift = 0
            enterCard = incoming
            enterX = -flyDistance
            enterFade = 0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.02) {
            withAnimation(settle) {
                active = incoming
                enterX = 0
                enterFade = 1
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
                var t2 = Transaction()
                t2.disablesAnimations = true
                withTransaction(t2) { enterCard = nil }
                busy = false
            }
        }
    }

    private func goTo(_ i: Int) {
        guard i != active, !busy else { return }
        buzz()
        withAnimation(settle) {
            active = i
            dragX = 0
            lift = 0
        }
    }

    private func choose(_ i: Int) {
        let g = deckGoals[i].goal
        let new: RunningGoal? = (selected == g) ? nil : g
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.4)) { selected = new }
        if new != nil { burstKey += 1 }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    private func buzz() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    // MARK: Footer (page dots + hint)

    private var hint: String {
        if let s = selected, let g = deckGoals.first(where: { $0.goal == s }) {
            return "Chosen: \(g.title)"
        }
        return "Swipe to browse, tap to choose"
    }

    private var footer: some View {
        VStack(spacing: 6) {
            HStack(spacing: 0) {
                ForEach(deckGoals.indices, id: \.self) { i in
                    let on = i == active
                    Button {
                        goTo(i)
                    } label: {
                        Capsule()
                            .fill(on ? RuvoTheme.Colors.primary : Color(hex: "#333333"))
                            .frame(width: on ? 22 : 6, height: 6)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 9)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Go to \(deckGoals[i].title)")
                }
            }
            .frame(height: 24)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.35), value: active)

            Text(hint)
                .font(.custom("Poppins-Regular", size: 13))
                .foregroundColor(RuvoTheme.Colors.textTertiary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, 8)
    }
}

// MARK: - One card

private struct GoalCardView: View {
    let goal: DeckGoal
    let isTop: Bool
    let chosen: Bool
    let dragX: CGFloat
    let lift: CGFloat
    let burstKey: Int

    private let lime = Color(hex: "#DFFF00")
    private let limeEnd = Color(hex: "#A8CC00")
    private let onLime = Color(hex: "#121212")
    private let ink = Color(hex: "#F5EFE9")

    private var accentOnCard: Color { chosen ? onLime : goal.accent }
    private var titleColor: Color { chosen ? onLime : ink }
    private var bgStart: Color { chosen ? lime : mix(Color(hex: "#1B1B1B"), goal.accent, 0.17) }
    private var bgEnd: Color { chosen ? limeEnd : Color(hex: "#0E0E0E") }
    private var borderColor: Color {
        if chosen { return lime }
        return isTop ? goal.accent : mix(Color(hex: "#2A2A2A"), goal.accent, 0.26)
    }
    private var glowColor: Color {
        let base: Color = chosen ? lime : goal.accent
        return isTop ? base.opacity(0.26) : Color.clear
    }

    var body: some View {
        let shape = RoundedCornerShape(radius: 32)
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(goal.chip)
                    .font(.custom("Poppins-SemiBold", size: 12))
                    .foregroundColor(chosen ? Color(hex: "#26300A") : goal.accent)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 5)
                    .background(Capsule().fill(chosen ? Color.black.opacity(0.12) : goal.accent.opacity(0.16)))
                Spacer()
                CheckBadge(chosen: chosen, burstKey: burstKey)
            }
            .frame(height: 30)

            ZStack {
                Circle()
                    .fill(RadialGradient(
                        colors: [chosen ? Color.white.opacity(0.38) : goal.accent.opacity(0.24), .clear],
                        center: .center, startRadius: 0, endRadius: 54))
                    .frame(width: 108, height: 108)
                StrokeIcon(paths: goal.icon, size: 58, color: accentOnCard, lineWidth: 1.4)
                    .offset(x: -dragX * 0.12, y: -lift * 0.12)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            Text(goal.title)
                .font(.custom("Poppins-Bold", size: 24))
                .foregroundColor(titleColor)
                .lineLimit(1)
            Text(goal.note)
                .font(.custom("Poppins-Regular", size: 13))
                .foregroundColor(chosen ? Color(hex: "#33400A") : RuvoTheme.Colors.textSecondary)
                .lineLimit(1)
                .padding(.top, 2)

            Rectangle()
                .fill(chosen ? Color.black.opacity(0.16) : Color.white.opacity(0.09))
                .frame(height: 1)
                .padding(.top, 10)
            HStack(spacing: 7) {
                StrokeIcon(paths: DeckIcons.calendar, size: 14, color: accentOnCard, lineWidth: 1.8)
                Text(planLine)
                    .font(.custom("Poppins-Medium", size: 12))
                    .foregroundColor(titleColor)
                    .lineLimit(1)
            }
            .padding(.top, 10)

            Text(chosen ? "Chosen" : "Tap to choose")
                .font(.custom("Poppins-SemiBold", size: 13))
                .foregroundColor(accentOnCard)
                .frame(maxWidth: .infinity)
                .frame(height: 34)
                .background(Capsule().fill(chosen ? Color.black.opacity(0.14) : goal.accent.opacity(0.12)))
                .opacity(isTop ? 1 : 0)
                .padding(.top, 12)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 18)
        .background(
            shape.fill(
                LinearGradient(
                    stops: [
                        Gradient.Stop(color: bgStart, location: 0),
                        Gradient.Stop(color: bgEnd, location: 0.74),
                        Gradient.Stop(color: bgEnd, location: 1),
                    ],
                    startPoint: UnitPoint(x: 0.35, y: 0),
                    endPoint: UnitPoint(x: 0.65, y: 1)
                )
            )
        )
        .overlay(shape.strokeBorder(borderColor, lineWidth: 1.5))
        .shadow(color: glowColor, radius: 24, y: 8)
        .animation(.easeOut(duration: 0.4), value: chosen)
        .accessibilityHidden(true)
    }

    private func mix(_ a: Color, _ b: Color, _ t: Double) -> Color {
        let ua = UIColor(a), ub = UIColor(b)
        var ar: CGFloat = 0, ag: CGFloat = 0, ab: CGFloat = 0, aa: CGFloat = 0
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        ua.getRed(&ar, green: &ag, blue: &ab, alpha: &aa)
        ub.getRed(&br, green: &bg, blue: &bb, alpha: &ba)
        return Color(red: Double(ar + (br - ar) * CGFloat(t)),
                     green: Double(ag + (bg - ag) * CGFloat(t)),
                     blue: Double(ab + (bb - ab) * CGFloat(t)))
    }
}

private struct RoundedCornerShape: InsettableShape {
    var radius: CGFloat
    var inset: CGFloat = 0
    func path(in rect: CGRect) -> Path {
        RoundedRectangle(cornerRadius: radius, style: .continuous).path(in: rect.insetBy(dx: inset, dy: inset))
    }
    func inset(by amount: CGFloat) -> RoundedCornerShape {
        var s = self
        s.inset += amount
        return s
    }
}

// MARK: - Check badge with a one-shot spark burst

private struct CheckBadge: View {
    let chosen: Bool
    let burstKey: Int

    @State private var progress: CGFloat = 1

    var body: some View {
        ZStack {
            Circle()
                .fill(Color(hex: "#121212"))
                .frame(width: 26, height: 26)
                .overlay(StrokeIcon(paths: DeckIcons.tick, size: 14, color: Color(hex: "#DFFF00"), lineWidth: 2.6))
                .scaleEffect(chosen ? 1 : 0.4)
                .opacity(chosen ? 1 : 0)
                .animation(.spring(response: 0.35, dampingFraction: 0.5), value: chosen)

            ForEach(0..<12, id: \.self) { k in
                let a = Double(k) / 12 * 2 * Double.pi + Double(k % 3) * 0.13
                let r = CGFloat(34 + (k * 7) % 26)
                Circle()
                    .fill(k % 2 == 1 ? Color.white : Color(hex: "#DFFF00"))
                    .frame(width: 5 * (1 - progress), height: 5 * (1 - progress))
                    .offset(x: CGFloat(cos(a)) * r * progress, y: CGFloat(sin(a)) * r * progress)
                    .opacity(Double(1 - progress))
            }
        }
        .frame(width: 26, height: 26)
        .onChange(of: burstKey) { _, new in
            guard new > 0 else { return }
            progress = 0
            DispatchQueue.main.async {
                withAnimation(.easeOut(duration: 0.65)) { progress = 1 }
            }
        }
    }
}
