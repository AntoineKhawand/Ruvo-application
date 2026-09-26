//
//  WeekStep.swift
//
//  Onboarding step 4: which days the user can run, and at what time. A lime card
//  with a day-pill row, a stacked run/rest semicircle, a legend and a coaching
//  line, plus a preferred-run-time row that opens a wheel picker (same design
//  as Android's WeekStep.kt).
//
//  NOTE: written without a Swift toolchain in the authoring environment --
//  verify it builds and looks right on a Mac/simulator.
//

import SwiftUI

let weekDayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
private let weekDayLabels = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
private let onLime = Color(hex: "#121212")

private func insight(for count: Int) -> (String, String) {
    switch count {
    case 0:  return ("Pick at least one day", "Choose the days you can realistically run.")
    case 1:  return ("A gentle start", "One run keeps the habit alive. Add a second when it feels easy.")
    case 2:  return ("A gentle start", "Two runs a week builds a base without wearing you out.")
    case 3:  return ("A steady rhythm", "Three runs with rest between is the classic way to build fitness.")
    case 4:  return ("A solid routine", "Four runs works well. Keep at least two of them easy.")
    case 5:  return ("An ambitious week", "Five runs is a lot. Plan easy days so you stay injury-free.")
    case 6:  return ("A heavy week", "Six runs needs careful pacing. Keep one full rest day.")
    default: return ("Every day", "Seven days leaves no recovery. Make some of them very short.")
    }
}

struct ScheduleStep: View {
    @Binding var selectedDays: Set<Int>          // 0 = Monday ... 6 = Sunday
    @Binding var reminderTime: Date
    @State private var showTimePicker = false

    private var count: Int { selectedDays.count }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("How often\ncan you run?")
                        .font(RuvoTheme.Typography.displayMedium)
                        .tracking(RuvoTheme.Typography.Tracking.displayMedium)
                        .foregroundColor(RuvoTheme.Colors.textPrimary)
                    Text("Choose the days that fit your week. You can change them later.")
                        .font(RuvoTheme.Typography.bodyLarge)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                }

                weekCard
                timeRow
            }
            .padding(.horizontal, RuvoTheme.Spacing.lg)
            .padding(.top, RuvoTheme.Spacing.xl)
            .padding(.bottom, RuvoTheme.Spacing.lg)
        }
        .sheet(isPresented: $showTimePicker) {
            VStack(spacing: 8) {
                Text("Preferred run time")
                    .font(.system(size: 17, weight: .semibold))
                    .padding(.top, 20)
                DatePicker("", selection: $reminderTime, displayedComponents: .hourAndMinute)
                    .datePickerStyle(.wheel)
                    .labelsHidden()
                RuvoButton(title: "Done", style: .primary) { showTimePicker = false }
                    .padding(.horizontal, RuvoTheme.Spacing.lg)
                    .padding(.bottom, 12)
            }
            .presentationDetents([.height(340)])
            .preferredColorScheme(.dark)
        }
    }

    // MARK: Card

    private var weekCard: some View {
        let rest = 7 - count
        let text = insight(for: count)
        return VStack(spacing: 14) {
            HStack(alignment: .lastTextBaseline) {
                Text("Your week").font(.system(size: 15, weight: .heavy))
                Spacer()
                Text("RUN · REST").font(.system(size: 12, weight: .semibold)).tracking(0.5).opacity(0.6)
            }
            .foregroundColor(onLime)
            .padding(.horizontal, 6)

            HStack(spacing: 6) {
                ForEach(0..<7, id: \.self) { dayPill($0) }
            }

            ZStack(alignment: .bottom) {
                StackedGauge(fraction: Double(count) / 7)
                VStack(spacing: 2) {
                    Text("\(count)")
                        .font(.system(size: 56, weight: .heavy, design: .rounded))
                        .contentTransition(.numericText())
                    Text("runs a week")
                        .font(.system(size: 14, weight: .semibold))
                        .opacity(0.65)
                }
                .foregroundColor(onLime)
            }
            .frame(width: 280, height: 154)

            HStack(spacing: 18) {
                legend(onLime, count == 1 ? "1 run day" : "\(count) run days")
                legend(onLime.opacity(0.25), rest == 1 ? "1 rest day" : "\(rest) rest days")
            }

            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 15, weight: .bold))
                    .padding(.top, 1)
                VStack(alignment: .leading, spacing: 2) {
                    Text(text.0).font(.system(size: 14, weight: .heavy))
                    Text(text.1).font(.system(size: 12.5, weight: .medium)).opacity(0.7)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .foregroundColor(onLime)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(onLime.opacity(0.09)))
        }
        .padding(.horizontal, 14)
        .padding(.top, 18)
        .padding(.bottom, 16)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 32, style: .continuous).fill(RuvoTheme.Colors.primary))
    }

    private func legend(_ color: Color, _ text: String) -> some View {
        HStack(spacing: 7) {
            Circle().fill(color).frame(width: 10, height: 10)
            Text(text).font(.system(size: 13, weight: .semibold)).foregroundColor(onLime)
        }
    }

    private func dayPill(_ i: Int) -> some View {
        let on = selectedDays.contains(i)
        return Button {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                if on { selectedDays.remove(i) } else { selectedDays.insert(i) }
            }
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        } label: {
            Text(weekDayLabels[i])
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(on ? RuvoTheme.Colors.primary : onLime)
                .frame(maxWidth: .infinity)
                .frame(height: 46)
                .background(Capsule().fill(on ? onLime : Color.white.opacity(0.38)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(weekDayNames[i])
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    // MARK: Preferred run time

    private var timeRow: some View {
        Button { showTimePicker = true } label: {
            HStack(spacing: 12) {
                Image(systemName: "clock")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(RuvoTheme.Colors.primary)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Preferred run time")
                        .font(.system(size: 12))
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                    Text(reminderTime.formatted(date: .omitted, time: .shortened))
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(RuvoTheme.Colors.textPrimary)
                }
                Spacer()
                Text("Change")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(RuvoTheme.Colors.primary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(RuvoTheme.Colors.surface))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(RuvoTheme.Colors.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Stacked radial

private struct StackedGauge: View {
    var fraction: Double
    private let thickness: CGFloat = 30

    var body: some View {
        GeometryReader { geo in
            let r = (geo.size.width - thickness) / 2
            ZStack {
                ArcSegment(from: fraction, to: 1, thickness: thickness, gap: 3, gapStart: fraction > 0.001, gapEnd: false)
                    .stroke(onLime.opacity(0.25), style: StrokeStyle(lineWidth: thickness, lineCap: .round))
                ArcSegment(from: 0, to: fraction, thickness: thickness, gap: 3, gapStart: false, gapEnd: fraction < 0.999)
                    .stroke(onLime, style: StrokeStyle(lineWidth: thickness, lineCap: .round))
            }
            .frame(width: r * 2, height: r)
            .position(x: geo.size.width / 2, y: thickness / 2 + r / 2)
            .animation(.spring(response: 0.5, dampingFraction: 0.8), value: fraction)
        }
    }
}

/// A slice of the top semicircle. `from`/`to` are 0...1 along it; the slice is shortened
/// by the round cap and a gap so neighbouring slices never touch.
private struct ArcSegment: Shape {
    var from: Double
    var to: Double
    let thickness: CGFloat
    let gap: Double
    let gapStart: Bool
    let gapEnd: Bool

    var animatableData: AnimatablePair<Double, Double> {
        get { AnimatablePair(from, to) }
        set { from = newValue.first; to = newValue.second }
    }

    func path(in rect: CGRect) -> Path {
        let r = rect.width / 2
        let capDeg = Double(thickness / 2 / r) * 180 / .pi
        let a = 180 * from + capDeg + (gapStart ? gap / 2 : 0)
        let b = 180 * to - capDeg - (gapEnd ? gap / 2 : 0)
        var p = Path()
        guard b - a > 0.2 else { return p }
        p.addArc(center: CGPoint(x: rect.midX, y: rect.maxY), radius: r,
                 startAngle: .degrees(180 + a), endAngle: .degrees(180 + b), clockwise: false)
        return p
    }
}
