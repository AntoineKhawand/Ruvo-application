//
//  BioStep.swift
//
//  Onboarding step 3: "About you" -- SwiftUI port of the approved "Ruvo Onboarding: About You
//  (2 pages)" design (and of Android's BioStep.kt). One step, two pages:
//    page 1  gender, date of birth (wheel sheet) and a live age readout
//    page 2  metric/imperial toggle and two rulers (weight, height); drag a ruler, or tap its
//            number / the pencil to type an exact value
//  OnboardingView's Back/Continue move between the pages: Back on page 2 returns to page 1, and
//  Continue on page 2 stays dimmed until both measurements are set (tapping it early nudges the
//  missing ruler). Swiping sideways on empty space also changes page.
//
//  Weight and height are kept canonically in kg and cm and converted for display, so switching
//  units never changes what is saved. The ruler start positions are typical values per gender,
//  shown until the user moves the ruler; nothing is saved from them until the user does.
//
//  NOTE: written without a Swift toolchain in the authoring environment -- verify it builds and
//  feels right on a Mac/simulator.
//

import SwiftUI
import UIKit

// MARK: - State

enum BioMeasure { case weight, height }

struct BioDate: Equatable {
    var y: Int, m: Int, d: Int          // m is 1...12

    var iso: String { String(format: "%04d-%02d-%02d", y, m, d) }
    var label: String { "\(Self.months[m - 1]) \(d), \(y)" }
    static let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    static func daysIn(y: Int, m: Int) -> Int {
        let cal = Calendar(identifier: .gregorian)
        let date = cal.date(from: DateComponents(year: y, month: m, day: 1)) ?? Date()
        return cal.range(of: .day, in: .month, for: date)?.count ?? 30
    }

    var age: Int {
        let cal = Calendar(identifier: .gregorian)
        let birth = cal.date(from: DateComponents(year: y, month: m, day: d)) ?? Date()
        return cal.dateComponents([.year], from: birth, to: Date()).year ?? 0
    }
}

private let lbPerKg = 2.20462
private let cmPerInch = 2.54
private let minAge = 13
private let typical: [String: (kg: Double, cm: Double)] = [
    "Male": (75, 176), "Female": (62, 163), "Other": (68, 170), "Undisclosed": (68, 170),
]

final class BioState: ObservableObject {
    @Published var page = 0
    @Published var gender = "Male"
    @Published var dob = BioDate(y: 2000, m: 1, d: 1)
    @Published var unit: String                     // "metric" | "imperial"
    @Published var kg = 75.0
    @Published var cm = 176.0
    @Published var weightSet = false
    @Published var heightSet = false
    @Published var resetKey = 0
    var weightHinted = false
    var heightHinted = false

    init() {
        // US, Liberia and Myanmar use imperial units; everyone else metric.
        let region = Locale.current.region?.identifier ?? ""
        unit = ["US", "LR", "MM"].contains(region) ? "imperial" : "metric"
    }

    var imperial: Bool { unit == "imperial" }
    var valid: Bool { weightSet && heightSet }

    func display(_ m: BioMeasure) -> Int {
        switch m {
        case .weight: return Int((imperial ? kg * lbPerKg : kg).rounded())
        case .height: return Int((imperial ? cm / cmPerInch : cm).rounded())
        }
    }

    func commit(_ m: BioMeasure, _ v: Int) {
        switch m {
        case .weight: kg = imperial ? Double(v) / lbPerKg : Double(v)
        case .height: cm = imperial ? Double(v) * cmPerInch : Double(v)
        }
    }

    /// Start unset rulers near a typical value for the chosen gender.
    func applyGenderDefaults() {
        let d = typical[gender] ?? typical["Other"]!
        if !weightSet { kg = d.kg }
        if !heightSet { cm = d.cm }
        resetKey += 1
    }
}

// MARK: - Icons (Hugeicons, free set, MIT; 24x24 stroke paths)

private enum BioIcons {
    static let male = [
        "M21 9C21 12.3137 18.3137 15 15 15C11.6863 15 9 12.3137 9 9C9 5.68629 11.6863 3 15 3C18.3137 3 21 5.68629 21 9Z",
        "M3 15V17C3 18.8856 3 19.8284 3.58579 20.4142C4.17157 21 5.11438 21 7 21H9M4 20L10.5 13.5",
    ]
    static let female = ["M12 14C15.3137 14 18 11.3137 18 8C18 4.68629 15.3137 2 12 2C8.68629 2 6 4.68629 6 8C6 11.3137 8.68629 14 12 14ZM12 14V22M9 19H15"]
    static let other = [
        "M19.4995 20V16.5C20.5856 16.5 21.1991 16.5 21.4186 16.0257C21.6381 15.5515 21.3953 14.9028 20.9095 13.6056L19.6676 10.2889C19.2571 9.19253 18.4179 8.5 17.5 8.5C16.5821 8.5 15.7429 9.19253 15.3324 10.2889L14.0905 13.6056C13.6047 14.9028 13.3619 15.5515 13.5814 16.0257C13.8009 16.5 14.4133 16.5 15.4995 16.5V20C15.4995 20.9428 15.4995 21.4142 15.7924 21.7071C16.0853 22 16.5567 22 17.4995 22C18.4423 22 18.9137 22 19.2066 21.7071C19.4995 21.4142 19.4995 20.9428 19.4995 20Z",
        "M8.5 4C8.5 5.10457 7.60457 6 6.5 6C5.39543 6 4.5 5.10457 4.5 4C4.5 2.89543 5.39543 2 6.5 2C7.60457 2 8.5 2.89543 8.5 4Z",
        "M19.5 4C19.5 5.10457 18.6046 6 17.5 6C16.3954 6 15.5 5.10457 15.5 4C15.5 2.89543 16.3954 2 17.5 2C18.6046 2 19.5 2.89543 19.5 4Z",
        "M10.5 12.5C10.5 10.6144 10.5 9.67157 9.91421 9.08579C9.32843 8.5 8.38562 8.5 6.5 8.5C4.61438 8.5 3.67157 8.5 3.08579 9.08579C2.5 9.67157 2.5 10.6144 2.5 12.5V14.5C2.5 15.4428 2.5 15.9142 2.79289 16.2071C3.08579 16.5 3.55719 16.5 4.5 16.5V20C4.5 20.9428 4.5 21.4142 4.79289 21.7071C5.08579 22 5.55719 22 6.5 22C7.44281 22 7.91421 22 8.20711 21.7071C8.5 21.4142 8.5 20.9428 8.5 20V16.5C9.44281 16.5 9.91421 16.5 10.2071 16.2071C10.5 15.9142 10.5 15.4428 10.5 14.5V12.5Z",
    ]
    static let calendar = [
        "M16 2V6M8 2V6",
        "M13 4H11C7.22876 4 5.34315 4 4.17157 5.17157C3 6.34315 3 8.22876 3 12V14C3 17.7712 3 19.6569 4.17157 20.8284C5.34315 22 7.22876 22 11 22H13C16.7712 22 18.6569 22 19.8284 20.8284C21 19.6569 21 17.7712 21 14V12C21 8.22876 21 6.34315 19.8284 5.17157C18.6569 4 16.7712 4 13 4Z",
        "M3 10H21",
        "M12.1258 14H12.0008M12.1258 18H12.0008M7.625 14H7.5M7.625 18H7.5M16.625 14H16.5",
    ]
    static let close = ["M18 6L6.00081 17.9992M17.9992 18L6 6.00085"]
    static let tick = ["M5 14L8.5 17.5L19 6.5"]
    static let lock = [
        "M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z",
        "M12 13C13.1046 13 14 12.1046 14 11C14 9.89543 13.1046 9 12 9C10.8954 9 10 9.89543 10 11C10 12.1046 10.8954 13 12 13ZM12 13L12 16",
    ]
    static let edit = [
        "M14.0737 3.88545C14.8189 3.07808 15.1915 2.6744 15.5874 2.43893C16.5427 1.87076 17.7191 1.85309 18.6904 2.39232C19.0929 2.6158 19.4769 3.00812 20.245 3.79276C21.0131 4.5774 21.3972 4.96972 21.6159 5.38093C22.1438 6.37312 22.1265 7.57479 21.5703 8.5507C21.3398 8.95516 20.9446 9.33578 20.1543 10.097L10.7506 19.1543C9.25288 20.5969 8.504 21.3182 7.56806 21.6837C6.63212 22.0493 5.6032 22.0224 3.54536 21.9686L3.26538 21.9613C2.63891 21.9449 2.32567 21.9367 2.14359 21.73C1.9615 21.5234 1.98636 21.2043 2.03608 20.5662L2.06308 20.2197C2.20301 18.4235 2.27297 17.5255 2.62371 16.7182C2.97444 15.9109 3.57944 15.2555 4.78943 13.9445L14.0737 3.88545Z",
        "M13 4L20 11",
        "M14 22L22 22",
    ]
}

private let muted = Color(hex: "#7A7A85")
private let onLime = Color(hex: "#121212")

// MARK: - Step

struct BioStep: View {
    @ObservedObject var state: BioState
    let nudge: Int

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            if state.page == 0 {
                AboutPage(state: state)
                    .transition(reduceMotion ? .opacity : .asymmetric(
                        insertion: .opacity.combined(with: .offset(x: -44)),
                        removal: .opacity.combined(with: .offset(x: -44))))
            } else {
                BodyPage(state: state, nudge: nudge)
                    .transition(reduceMotion ? .opacity : .asymmetric(
                        insertion: .opacity.combined(with: .offset(x: 44)),
                        removal: .opacity.combined(with: .offset(x: 44))))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
        // Swipe between pages on empty space; rulers, wheels and buttons handle their own drags first.
        .gesture(
            DragGesture(minimumDistance: 30).onEnded { v in
                let dx = v.translation.width, dy = v.translation.height
                guard abs(dx) > 60, abs(dx) > abs(dy) * 1.6 else { return }
                withAnimation(reduceMotion ? nil : .timingCurve(0.32, 0.72, 0, 1, duration: 0.55)) {
                    if dx > 0 && state.page == 1 { state.page = 0 }
                    else if dx < 0 && state.page == 0 { state.page = 1 }
                }
            }
        )
        .animation(reduceMotion ? nil : .timingCurve(0.32, 0.72, 0, 1, duration: 0.55), value: state.page)
        .padding(.horizontal, RuvoTheme.Spacing.lg)
        .padding(.top, RuvoTheme.Spacing.md)
    }
}

private struct StepTitles: View {
    let title: String
    let subtitle: String
    var body: some View {
        VStack(spacing: RuvoTheme.Spacing.xs) {
            Text(title)
                .font(RuvoTheme.Typography.displayMedium)
                .tracking(RuvoTheme.Typography.Tracking.displayMedium)
                .foregroundColor(RuvoTheme.Colors.textPrimary)
                .lineLimit(1).minimumScaleFactor(0.8)
            Text(subtitle)
                .font(RuvoTheme.Typography.bodyLarge)
                .tracking(RuvoTheme.Typography.Tracking.bodyLarge)
                .foregroundColor(RuvoTheme.Colors.textSecondary)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Page 1: about you

private struct AboutPage: View {
    @ObservedObject var state: BioState
    @State private var sheetOpen = false

    private let options: [(value: String, label: String, icon: [String]?)] = [
        ("Male", "Male", BioIcons.male), ("Female", "Female", BioIcons.female),
        ("Other", "Other", BioIcons.other), ("Undisclosed", "Rather not say", nil),
    ]

    var body: some View {
        VStack(spacing: 0) {
            StepTitles(title: "Tell us about you", subtitle: "Helps us tune your training accurately")

            VStack(alignment: .leading, spacing: 0) {
                label("Gender", top: 14)
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                    ForEach(options, id: \.value) { o in
                        genderButton(o.value, o.label, o.icon)
                    }
                }

                label("Date of Birth", top: 28)
                Button { sheetOpen = true } label: {
                    HStack(spacing: 12) {
                        StrokeIcon(paths: BioIcons.calendar, size: 22, color: muted, lineWidth: 1.6)
                        Text(state.dob.label)
                            .font(.custom("Poppins-Regular", size: 16.5))
                            .foregroundColor(.white)
                        Spacer()
                    }
                    .padding(.horizontal, 20)
                    .frame(maxWidth: .infinity, minHeight: 64)
                    .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Color(hex: "#121212")))
                    .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(Color(hex: "#2A2A2A"), lineWidth: 1.5))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Date of birth, \(state.dob.label). Change")
            }
            .padding(.top, 18)

            // Live age readout
            ZStack {
                Circle()
                    .fill(RadialGradient(colors: [RuvoTheme.Colors.primary.opacity(0.11), .clear], center: .center, startRadius: 0, endRadius: 115))
                    .frame(width: 230, height: 230)
                VStack(spacing: 6) {
                    Text("\(state.dob.age)")
                        .font(.custom("Poppins-ExtraBold", size: 88))
                        .tracking(-3.5)
                        .foregroundColor(RuvoTheme.Colors.primary)
                        .contentTransition(.numericText())
                        .animation(.easeOut(duration: 0.5), value: state.dob.age)
                    Text("years old").font(.custom("Poppins-Regular", size: 14)).foregroundColor(muted)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(state.dob.age) years old")
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            HStack(alignment: .top, spacing: 8) {
                StrokeIcon(paths: BioIcons.lock, size: 15, color: RuvoTheme.Colors.primary.opacity(0.85))
                    .padding(.top, 1)
                Text("Private to you. Only used to estimate pace and calories.")
                    .font(.custom("Poppins-Regular", size: 12.5))
                    .foregroundColor(muted)
                Spacer(minLength: 0)
            }
            .padding(.top, 8)
        }
        .sheet(isPresented: $sheetOpen) {
            DobSheet(initial: state.dob) { state.dob = $0 }
                .presentationDetents([.height(450)])
                .presentationDragIndicator(.visible)
                .presentationBackground(Color(hex: "#141414"))
                .presentationCornerRadius(32)
        }
    }

    private func label(_ text: String, top: CGFloat) -> some View {
        Text(text)
            .font(.custom("Poppins-SemiBold", size: 13.5))
            .foregroundColor(muted)
            .padding(.top, top).padding(.bottom, 12)
    }

    private func genderButton(_ value: String, _ title: String, _ icon: [String]?) -> some View {
        let on = state.gender == value
        return Button {
            state.gender = value
            UISelectionFeedbackGenerator().selectionChanged()
            state.applyGenderDefaults()
        } label: {
            HStack(spacing: 8) {
                if let icon = icon {
                    StrokeIcon(paths: icon, size: 17, color: (on ? RuvoTheme.Colors.primary : Color.white).opacity(on ? 1 : 0.75), lineWidth: 1.6)
                }
                Text(title)
                    .font(.custom("Poppins-Medium", size: 14.5))
                    .foregroundColor(on ? RuvoTheme.Colors.primary : .white)
                    .lineLimit(1)
            }
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(Capsule().fill(on ? RuvoTheme.Colors.primary.opacity(0.11) : Color(hex: "#0E0E0E")))
            .overlay(Capsule().stroke(on ? RuvoTheme.Colors.primary : Color(hex: "#2A2A2A"), lineWidth: 1.5))
            .animation(.easeOut(duration: 0.25), value: on)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? [.isSelected] : [])
    }
}

// MARK: - Date of birth sheet (three wheels)

private struct DobSheet: View {
    let onApply: (BioDate) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var month: Int
    @State private var day: Int
    @State private var year: Int
    private let years: [Int]

    init(initial: BioDate, onApply: @escaping (BioDate) -> Void) {
        self.onApply = onApply
        let thisYear = Calendar(identifier: .gregorian).component(.year, from: Date())
        years = Array((thisYear - 100)...(thisYear - minAge)).reversed()
        _month = State(initialValue: initial.m)
        _day = State(initialValue: initial.d)
        _year = State(initialValue: min(max(initial.y, thisYear - 100), thisYear - minAge))
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Date of birth").font(.custom("Poppins-Bold", size: 20)).foregroundColor(.white)
                Spacer()
                Button { dismiss() } label: {
                    StrokeIcon(paths: BioIcons.close, size: 18, color: .white, lineWidth: 2)
                        .frame(width: 34, height: 34)
                        .background(Circle().fill(Color(hex: "#222222")))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
            }
            .padding(.top, 24)

            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(RuvoTheme.Colors.primary.opacity(0.07))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(RuvoTheme.Colors.primary.opacity(0.28), lineWidth: 1))
                    .frame(height: 44)
                    .allowsHitTesting(false)
                HStack(spacing: 6) {
                    wheel(selection: $month, values: Array(1...12), text: { BioDate.months[$0 - 1] }, label: "Month")
                        .frame(maxWidth: .infinity).layoutPriority(1.25)
                    wheel(selection: $day, values: Array(1...BioDate.daysIn(y: year, m: month)), text: { "\($0)" }, label: "Day")
                        .frame(maxWidth: .infinity).layoutPriority(0.8)
                    wheel(selection: $year, values: years, text: { "\($0)" }, label: "Year")
                        .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 220)
            .padding(.top, 14)
            .onChange(of: month) { _ in clampDay() }
            .onChange(of: year) { _ in clampDay() }

            Button {
                onApply(BioDate(y: year, m: month, d: day))
                dismiss()
            } label: {
                Text("Done").font(.custom("Poppins-Bold", size: 17)).foregroundColor(onLime)
                    .frame(maxWidth: .infinity).frame(height: 54)
                    .background(Capsule().fill(LinearGradient(colors: [RuvoTheme.Colors.primary, Color(hex: "#A8CC00")], startPoint: .leading, endPoint: .trailing)))
            }
            .buttonStyle(.plain)
            .padding(.top, 18)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 30)
    }

    private func clampDay() { day = min(day, BioDate.daysIn(y: year, m: month)) }

    private func wheel(selection: Binding<Int>, values: [Int], text: @escaping (Int) -> String, label: String) -> some View {
        Picker(label, selection: selection) {
            ForEach(values, id: \.self) { v in
                Text(text(v)).font(.custom("Poppins-SemiBold", size: 20)).foregroundColor(.white).tag(v)
            }
        }
        .pickerStyle(.wheel)
        .labelsHidden()
        .frame(height: 220)
        .clipped()
        .accessibilityLabel(label)
    }
}

// MARK: - Page 2: your body

private struct BodyPage: View {
    @ObservedObject var state: BioState
    let nudge: Int

    var body: some View {
        VStack(spacing: 0) {
            StepTitles(title: "Your body", subtitle: "Set your weight and height")
            UnitToggle(imperial: state.imperial) { imperial in
                state.unit = imperial ? "imperial" : "metric"
                state.resetKey += 1
                UISelectionFeedbackGenerator().selectionChanged()
            }
            .padding(.top, 18)

            // Like the design's flex:1 panels with a max height: they stack from the top with a 12pt gap.
            VStack(spacing: 12) {
                MeasureCard(state: state, m: .weight, title: "Weight", nudge: nudge, hintDelay: 0.9)
                MeasureCard(state: state, m: .height, title: "Height", nudge: nudge, hintDelay: 2.6)
                Spacer(minLength: 0)
            }
            .padding(.top, 14)
        }
    }
}

private struct UnitToggle: View {
    let imperial: Bool
    let onChange: (Bool) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            let half = (geo.size.width - 10) / 2
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 14, style: .continuous).fill(RuvoTheme.Colors.primary)
                    .frame(width: half, height: geo.size.height - 10)
                    .shadow(color: RuvoTheme.Colors.primary.opacity(0.35), radius: 8, y: 4)
                    .offset(x: 5 + (imperial ? half : 0))
                    .animation(reduceMotion ? nil : .spring(response: 0.42, dampingFraction: 0.6), value: imperial)
                HStack(spacing: 0) {
                    ForEach([false, true], id: \.self) { imp in
                        Button { if imp != imperial { onChange(imp) } } label: {
                            Text(imp ? "Imperial (lb/in)" : "Metric (kg/cm)")
                                .font(.custom(imp == imperial ? "Poppins-Bold" : "Poppins-SemiBold", size: 13.5))
                                .foregroundColor(imp == imperial ? onLime : RuvoTheme.Colors.textSecondary)
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(imp == imperial ? [.isSelected] : [])
                    }
                }
                .padding(.horizontal, 5)
            }
        }
        .frame(height: 48)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color(hex: "#111111")))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Color(hex: "#1D1D1D"), lineWidth: 1))
    }
}

// MARK: - Ruler card

private struct RulerCfg {
    let min: Int, max: Int
    let ppu: CGFloat
    let major: Int, mid: Int, lab: Int
}

private func rulerCfg(_ m: BioMeasure, imperial: Bool) -> RulerCfg {
    switch m {
    case .weight: return imperial ? RulerCfg(min: 66, max: 440, ppu: 10, major: 10, mid: 5, lab: 10) : RulerCfg(min: 30, max: 200, ppu: 12, major: 10, mid: 5, lab: 5)
    case .height: return imperial ? RulerCfg(min: 48, max: 90, ppu: 14, major: 12, mid: 6, lab: 6) : RulerCfg(min: 120, max: 230, ppu: 12, major: 10, mid: 5, lab: 5)
    }
}

private func unitLabel(_ m: BioMeasure, _ imperial: Bool) -> String {
    switch m {
    case .weight: return imperial ? "lb" : "kg"
    case .height: return imperial ? "in" : "cm"
    }
}

private func spokenValue(_ m: BioMeasure, _ imperial: Bool, _ v: Int) -> String {
    m == .height && imperial ? "\(v / 12) feet \(v % 12) inches" : "\(v) \(unitLabel(m, imperial))"
}

private func altText(_ m: BioMeasure, _ imperial: Bool, _ v: Int) -> String {
    switch m {
    case .weight: return imperial ? "≈ \(Int((Double(v) / lbPerKg).rounded())) kg" : "≈ \(Int((Double(v) * lbPerKg).rounded())) lb"
    case .height:
        if imperial { return "≈ \(Int((Double(v) * cmPerInch).rounded())) cm" }
        let t = Int((Double(v) / cmPerInch).rounded())
        return "≈ \(t / 12)′ \(t % 12)″"
    }
}

/// One ruler's position and tween. Advanced once per display frame from a TimelineView.
private final class RulerModel {
    var rv: CGFloat = 0
    var interacting = false
    var dragging = false
    var dragV0: CGFloat = 0
    var dragMoved: CGFloat = 0
    var lastV = Int.min
    private var tween: (from: CGFloat, to: CGFloat, t0: TimeInterval, dur: TimeInterval)?
    private let selection = UISelectionFeedbackGenerator()

    func reset(to v: Int) { tween = nil; rv = CGFloat(v); lastV = Int.min }
    func tweenTo(_ target: CGFloat, dur: TimeInterval = 0.42, reduce: Bool) {
        if reduce || rv == target { tween = nil; rv = target; return }
        tween = (rv, target, CACurrentMediaTime(), dur)
    }
    func cancelTween() { tween = nil }

    /// Returns the rounded, clamped value; buzzes when it changes.
    func advance(now: TimeInterval, cfg: RulerCfg) -> Int {
        if let tw = tween {
            let k = min(max((now - tw.t0) / tw.dur, 0), 1)
            rv = tw.from + (tw.to - tw.from) * CGFloat(1 - pow(1 - k, 4))
            if k >= 1 { tween = nil }
        }
        let v = Int(min(max(rv, CGFloat(cfg.min)), CGFloat(cfg.max)).rounded())
        if v != lastV {
            if lastV != Int.min { selection.selectionChanged() }
            lastV = v
        }
        return v
    }
}

private struct MeasureCard: View {
    @ObservedObject var state: BioState
    let m: BioMeasure
    let title: String
    let nudge: Int
    let hintDelay: Double

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var ruler = RulerModel()
    @State private var editing = false
    @State private var warn = false
    @State private var shakeX: CGFloat = 0
    @State private var grabbing = false
    @State private var t1 = ""
    @State private var t2 = ""
    @FocusState private var focus: Field?
    private enum Field { case a, b }

    private var isSet: Bool { m == .weight ? state.weightSet : state.heightSet }
    private var cfg: RulerCfg { rulerCfg(m, imperial: state.imperial) }
    private var impH: Bool { m == .height && state.imperial }

    var body: some View {
        TimelineView(.animation) { _ in
            let v = ruler.advance(now: CACurrentMediaTime(), cfg: cfg)
            card(v)
        }
        .onAppear {
            ruler.reset(to: state.display(m))
            scheduleHint()
        }
        .onChange(of: state.resetKey) { _ in ruler.reset(to: state.display(m)) }
        .onChange(of: isSet) { set in if set { warn = false } }
        .onChange(of: nudge) { _ in nudgeIfNeeded() }
        .onChange(of: focus) { f in if f == nil && editing { finishEdit(apply: true) } }
    }

    private func card(_ v: Int) -> some View {
        VStack(spacing: 0) {
            // header
            HStack {
                HStack(spacing: 4) {
                    Text(title.uppercased())
                        .font(.custom("Poppins-SemiBold", size: 11)).tracking(1)
                        .foregroundColor(muted)
                    Button { startEdit(v) } label: {
                        StrokeIcon(paths: BioIcons.edit, size: 15, color: muted, lineWidth: 1.8)
                            .frame(width: 26, height: 26)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Type your \(title.lowercased())")
                }
                Spacer()
                if isSet {
                    HStack(spacing: 4) {
                        StrokeIcon(paths: BioIcons.tick, size: 13, color: RuvoTheme.Colors.primary, lineWidth: 2.6)
                        Text("Set").font(.custom("Poppins-Medium", size: 12)).foregroundColor(RuvoTheme.Colors.primary)
                    }
                } else if warn {
                    Text("Set your \(title.lowercased()) to continue")
                        .font(.custom("Poppins-Medium", size: 12)).foregroundColor(RuvoTheme.Colors.primary)
                }
            }
            .frame(height: 26)
            .padding(.horizontal, 18)
            .padding(.top, 12)

            // big number (or the inputs while typing)
            Group {
                if editing { editFields } else { bigValue(v) }
            }
            .frame(height: 54)
            .opacity(isSet || editing ? 1 : 0.4)
            .contentShape(Rectangle())
            .onTapGesture { if !editing { startEdit(v) } }

            Text(altText(m, state.imperial, v))
                .font(.custom("Poppins-Regular", size: 12)).foregroundColor(muted)
                .frame(height: 16)
                .accessibilityHidden(true)

            rulerView(v)
                .padding(.top, 2)
            Spacer().frame(height: 8)
        }
        .frame(maxWidth: .infinity)
        .frame(maxHeight: 220)
        .background(RoundedRectangle(cornerRadius: 24, style: .continuous)
            .fill(LinearGradient(colors: [Color(hex: "#151515"), Color(hex: "#0E0E0E")], startPoint: .top, endPoint: .bottom)))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous)
            .stroke(grabbing ? RuvoTheme.Colors.primary.opacity(0.45) : Color(hex: "#222222"), lineWidth: 1.5))
        .offset(x: shakeX)
        .simultaneousGesture(dragGesture)
    }

    // MARK: pieces

    private func bigValue(_ v: Int) -> some View {
        let lime = RuvoTheme.Colors.primary
        return HStack(alignment: .lastTextBaseline, spacing: 2) {
            if impH {
                big("\(v / 12)"); unit("ft"); big("\(v % 12)"); unit("in")
            } else {
                big("\(v)"); unit(unitLabel(m, state.imperial))
            }
        }
        .foregroundColor(lime)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title), \(spokenValue(m, state.imperial, v))")
    }
    private func big(_ s: String) -> some View {
        Text(s).font(.custom("Poppins-ExtraBold", size: 46)).tracking(-0.9).monospacedDigit()
    }
    private func unit(_ s: String) -> some View {
        Text(s).font(.custom("Poppins-SemiBold", size: 20)).opacity(0.8).padding(.trailing, 4)
    }

    private var editFields: some View {
        HStack(spacing: 6) {
            if impH {
                field($t1, width: 34, max: 1, id: .a, label: "Feet")
                unit("ft")
                field($t2, width: 62, max: 2, id: .b, label: "Inches")
                unit("in")
            } else {
                field($t1, width: 96, max: 3, id: .a, label: title)
                unit(unitLabel(m, state.imperial))
            }
        }
        .foregroundColor(RuvoTheme.Colors.primary)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focus = nil }
            }
        }
    }

    private func field(_ text: Binding<String>, width: CGFloat, max: Int, id: Field, label: String) -> some View {
        TextField("", text: text)
            .keyboardType(.numberPad)
            .multilineTextAlignment(.center)
            .font(.custom("Poppins-ExtraBold", size: 46))
            .foregroundColor(RuvoTheme.Colors.primary)
            .tint(RuvoTheme.Colors.primary)
            .frame(width: width)
            .overlay(alignment: .bottom) { Rectangle().fill(RuvoTheme.Colors.primary).frame(height: 2) }
            .focused($focus, equals: id)
            .onChange(of: text.wrappedValue) { new in
                let digits = String(new.filter(\.isNumber).prefix(max))
                if digits != new { text.wrappedValue = digits }
            }
            .accessibilityLabel(label)
    }

    private func rulerView(_ v: Int) -> some View {
        let c = cfg
        let imperial = state.imperial
        let rv = ruler.rv
        return GeometryReader { geo in
            let cx = geo.size.width / 2
            ZStack(alignment: .topLeading) {
                Canvas { ctx, size in
                    let base = size.height - 34
                    let pad = 16
                    let lo = Swift.max(c.min - pad, Int(floor(rv - cx / c.ppu - 2)))
                    let hi = Swift.min(c.max + pad, Int(ceil(rv + cx / c.ppu + 2)))
                    guard lo <= hi else { return }
                    for u in lo...hi {
                        let inR = u >= c.min && u <= c.max
                        let major = inR && u % c.major == 0
                        let mid = inR && !major && u % c.mid == 0
                        let h: CGFloat = major ? 26 : (mid ? 16 : 9)
                        let color: Color = u == v ? RuvoTheme.Colors.primary
                            : major ? Color(hex: "#5A5A5A") : (mid ? Color(hex: "#3B3B3B") : Color(hex: "#333333"))
                        let x = cx + (CGFloat(u) - rv) * c.ppu
                        ctx.fill(Path(roundedRect: CGRect(x: x - 1, y: base - h, width: 2, height: h), cornerRadius: 1), with: .color(color))
                        if inR && u % c.lab == 0 {
                            let on = abs(u - v) * 2 < c.lab
                            let t = Text(rulerLabel(u, imperial)).font(.custom("Poppins-SemiBold", size: 11))
                                .foregroundColor(on ? .white : muted)
                            ctx.draw(t, at: CGPoint(x: x, y: 52), anchor: .center)
                        }
                    }
                    // Needle with a soft glow
                    ctx.fill(Path(roundedRect: CGRect(x: cx - 5, y: -2, width: 10, height: 46), cornerRadius: 5), with: .color(RuvoTheme.Colors.primary.opacity(0.25)))
                    ctx.fill(Path(roundedRect: CGRect(x: cx - 1.5, y: 0, width: 3, height: 42), cornerRadius: 1.5), with: .color(RuvoTheme.Colors.primary))
                }
            }
            .mask(LinearGradient(stops: [
                .init(color: .clear, location: 0), .init(color: .black, location: 0.09),
                .init(color: .black, location: 0.91), .init(color: .clear, location: 1),
            ], startPoint: .leading, endPoint: .trailing))
        }
        .frame(height: 74)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title)
        .accessibilityValue(spokenValue(m, imperial, v))
        .accessibilityAdjustableAction { dir in
            markSet()
            let target = min(max(v + (dir == .increment ? 1 : -1), c.min), c.max)
            ruler.tweenTo(CGFloat(target), dur: 0.22, reduce: reduceMotion)
        }
    }

    private func rulerLabel(_ u: Int, _ imperial: Bool) -> String {
        if m == .height && imperial { return u % 12 == 0 ? "\(u / 12)′" : "\(u / 12)′6″" }
        return "\(u)"
    }

    // MARK: interaction

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 3)
            .onChanged { g in
                if editing { return }
                let c = cfg
                if !ruler.dragging {
                    ruler.dragging = true; ruler.interacting = true
                    ruler.cancelTween()
                    ruler.dragV0 = ruler.rv; ruler.dragMoved = 0
                    grabbing = true
                }
                let dx = g.translation.width
                ruler.dragMoved = Swift.max(ruler.dragMoved, abs(dx))
                var p = ruler.dragV0 - dx / c.ppu
                if p < CGFloat(c.min) { p = CGFloat(c.min) + (p - CGFloat(c.min)) * 0.35 }   // rubber-band at the ends
                if p > CGFloat(c.max) { p = CGFloat(c.max) + (p - CGFloat(c.max)) * 0.35 }
                ruler.rv = p
                if ruler.dragMoved > 2 { markSet() }
            }
            .onEnded { g in
                guard ruler.dragging else { return }
                ruler.dragging = false
                grabbing = false
                let c = cfg
                let target = Int((ruler.rv - g.velocity.width * 0.26 / c.ppu).rounded())
                ruler.tweenTo(CGFloat(min(max(target, c.min), c.max)), dur: 0.42, reduce: reduceMotion)
            }
    }

    private func markSet() {
        if isSet { return }
        if m == .weight { state.weightSet = true } else { state.heightSet = true }
        state.commit(m, Int(min(max(ruler.rv, CGFloat(cfg.min)), CGFloat(cfg.max)).rounded()))
    }

    private func startEdit(_ v: Int) {
        guard !editing else { return }
        ruler.interacting = true
        ruler.cancelTween()
        t1 = impH ? "\(v / 12)" : "\(v)"
        t2 = "\(v % 12)"
        editing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { focus = .a }
    }

    private func finishEdit(apply: Bool) {
        guard editing else { return }
        editing = false
        focus = nil
        guard apply else { return }
        let c = cfg
        let value: Int?
        if impH { value = Int(t1).map { $0 * 12 + (Int(t2) ?? 0) } } else { value = Int(t1) }
        if let value = value {
            let target = min(max(value, c.min), c.max)
            ruler.rv = CGFloat(min(max(Int(ruler.rv.rounded()), c.min), c.max))
            markSet()
            ruler.tweenTo(CGFloat(target), dur: 0.3, reduce: reduceMotion)
            UISelectionFeedbackGenerator().selectionChanged()
        }
    }

    /// Continue tapped too early: nudge the first ruler that is still unset.
    private func nudgeIfNeeded() {
        let target: BioMeasure = !state.weightSet ? .weight : .height
        guard nudge > 0, m == target, !isSet else { return }
        warn = true
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        guard !reduceMotion else { return }
        for (i, x) in [-7, 6, -4, 0].enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.08 * Double(i)) {
                withAnimation(.easeOut(duration: 0.08)) { shakeX = CGFloat(x) }
            }
        }
    }

    /// First-use nudge: the ruler wiggles once (it does not set the value).
    private func scheduleHint() {
        let hinted = m == .weight ? state.weightHinted : state.heightHinted
        guard !reduceMotion, !hinted, !isSet else { return }
        if m == .weight { state.weightHinted = true } else { state.heightHinted = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + hintDelay) {
            let base = Int(ruler.rv.rounded())
            for (i, t) in [base + 5, base - 5, base].enumerated() {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.52 * Double(i)) {
                    if ruler.interacting || isSet { return }
                    ruler.tweenTo(CGFloat(t), dur: 0.46, reduce: false)
                }
            }
        }
    }
}
