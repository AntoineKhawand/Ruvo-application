import SwiftUI
import Charts

struct AnalyticsDashboardView: View {
    @StateObject private var viewModel = AnalyticsViewModel()

    var body: some View {
        ScrollView {
            LazyVStack(spacing: RuvoTheme.Spacing.md, pinnedViews: .sectionHeaders) {
                Section {
                    // Period selector
                    PeriodSelectorView(selected: $viewModel.selectedPeriod)
                        .padding(.horizontal, RuvoTheme.Spacing.lg)

                    // Key stats row
                    KeyStatsRow(summary: viewModel.summary)
                        .padding(.horizontal, RuvoTheme.Spacing.lg)

                    // Weekly distance chart
                    WeeklyDistanceChart(data: viewModel.weeklyDistances)
                        .padding(.horizontal, RuvoTheme.Spacing.lg)

                    // Pace trend
                    PaceTrendChart(data: viewModel.paceTrend)
                        .padding(.horizontal, RuvoTheme.Spacing.lg)

                    // Heart rate zones
                    if !viewModel.heartRateZones.isEmpty {
                        HeartRateZonesChart(zones: viewModel.heartRateZones)
                            .padding(.horizontal, RuvoTheme.Spacing.lg)
                    }

                    // VO2 Max card
                    VO2MaxCard(vo2max: viewModel.vo2max)
                        .padding(.horizontal, RuvoTheme.Spacing.lg)

                    // Recent runs
                    RecentRunsSection(runs: viewModel.recentRuns)
                        .padding(.horizontal, RuvoTheme.Spacing.lg)
                }
            }
            .padding(.vertical, RuvoTheme.Spacing.lg)
        }
        .background(RuvoTheme.Colors.background.ignoresSafeArea())
        .navigationTitle("Analytics")
        .navigationBarTitleDisplayMode(.large)
        .task { await viewModel.loadData() }
    }
}

// MARK: – Period selector
enum AnalyticsPeriod: String, CaseIterable {
    case week = "1W"
    case month = "1M"
    case threeMonths = "3M"
    case year = "1Y"
    case allTime = "All"
}

struct PeriodSelectorView: View {
    @Binding var selected: AnalyticsPeriod

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AnalyticsPeriod.allCases, id: \.self) { period in
                Button {
                    withAnimation(RuvoTheme.Motion.springSettled()) { selected = period }
                } label: {
                    Text(period.rawValue)
                        .font(RuvoTheme.Typography.labelLarge)
                        .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                        .foregroundColor(selected == period ? .black : RuvoTheme.Colors.textSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 36)
                        .background(
                            selected == period
                            ? RuvoTheme.Colors.primary
                            : Color.clear
                        )
                        .clipShape(Capsule())
                }
            }
        }
        .padding(4)
        .background(
            RuvoTheme.Colors.glassSurface
                .overlay(RuvoTheme.Colors.surface.opacity(0.6))
        )
        .clipShape(Capsule())
        .overlay(Capsule().stroke(RuvoTheme.Colors.border, lineWidth: 1))
    }
}

// MARK: – Key stats
struct AnalyticsSummary {
    var totalDistanceKm: Double
    var totalRuns: Int
    var averagePaceMinPerKm: Double
    var totalDurationHours: Double
    var totalElevationM: Double
}

struct KeyStatsRow: View {
    let summary: AnalyticsSummary

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: RuvoTheme.Spacing.sm) {
            StatMiniCard(label: "Distance", value: String(format: "%.1f", summary.totalDistanceKm), unit: "km", color: RuvoTheme.Colors.primary)
            StatMiniCard(label: "Runs", value: "\(summary.totalRuns)", unit: "runs", color: RuvoTheme.Colors.teal)
            StatMiniCard(label: "Avg Pace", value: summary.averagePaceMinPerKm.formattedPace, unit: "/km", color: RuvoTheme.Colors.vo2max)
            StatMiniCard(label: "Time", value: String(format: "%.1f", summary.totalDurationHours), unit: "hrs", color: RuvoTheme.Colors.purple)
        }
    }
}

struct StatMiniCard: View {
    let label: String
    let value: String
    let unit: String
    let color: Color

    var body: some View {
        RuvoCard(isHighlighted: false, glowColor: color) {
            VStack(alignment: .leading, spacing: 4) {
                Text(label.uppercased())
                    .font(RuvoTheme.Typography.caption)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
                    .tracking(RuvoTheme.Typography.Tracking.caption)
                HStack(alignment: .lastTextBaseline, spacing: 3) {
                    Text(value)
                        .font(RuvoTheme.Typography.headingLarge)
                        .tracking(RuvoTheme.Typography.Tracking.headingLarge)
                        .foregroundColor(color)
                    Text(unit)
                        .font(RuvoTheme.Typography.bodySmall)
                        .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                }
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}

// MARK: – Weekly distance bar chart (Swift Charts)
struct WeeklyDistanceChart: View {
    let data: [WeeklyDistance]

    var body: some View {
        RuvoCard {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.md) {
                Text("Weekly Distance")
                    .font(RuvoTheme.Typography.headingSmall)
                    .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)

                Chart(data) { entry in
                    BarMark(
                        x: .value("Week", entry.weekLabel),
                        y: .value("km", entry.distanceKm)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [RuvoTheme.Colors.primary, Color(hex: "#A8CC00")],
                            startPoint: .bottom,
                            endPoint: .top
                        )
                    )
                    .cornerRadius(4)
                }
                .chartYAxis {
                    AxisMarks(values: .automatic(desiredCount: 4)) { value in
                        AxisGridLine(stroke: StrokeStyle(dash: [4])).foregroundStyle(RuvoTheme.Colors.border)
                        AxisValueLabel().foregroundStyle(RuvoTheme.Colors.textTertiary)
                    }
                }
                .chartXAxis {
                    AxisMarks { value in
                        AxisValueLabel().foregroundStyle(RuvoTheme.Colors.textSecondary)
                    }
                }
                .frame(height: 180)
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}

struct WeeklyDistance: Identifiable {
    let id = UUID()
    var weekLabel: String
    var distanceKm: Double
}

// MARK: – Pace trend line chart
struct PaceTrendChart: View {
    let data: [PacePoint]

    var body: some View {
        RuvoCard {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.md) {
                HStack {
                    Text("Pace Trend")
                        .font(RuvoTheme.Typography.headingSmall)
                        .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                        .foregroundColor(RuvoTheme.Colors.textPrimary)
                    Spacer()
                    RuvoChip(label: "Improving ↑", isActive: true)
                }

                Chart(data) { point in
                    LineMark(
                        x: .value("Date", point.date),
                        y: .value("Pace", point.paceMinPerKm)
                    )
                    .foregroundStyle(RuvoTheme.Colors.teal)
                    .interpolationMethod(.catmullRom)

                    AreaMark(
                        x: .value("Date", point.date),
                        y: .value("Pace", point.paceMinPerKm)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [RuvoTheme.Colors.teal.opacity(0.3), .clear],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .interpolationMethod(.catmullRom)

                    PointMark(
                        x: .value("Date", point.date),
                        y: .value("Pace", point.paceMinPerKm)
                    )
                    .foregroundStyle(RuvoTheme.Colors.teal)
                    .symbolSize(20)
                }
                .chartYAxis {
                    AxisMarks(values: .automatic(desiredCount: 4)) { value in
                        AxisGridLine(stroke: StrokeStyle(dash: [4])).foregroundStyle(RuvoTheme.Colors.border)
                        AxisValueLabel {
                            if let pace = value.as(Double.self) {
                                Text(pace.formattedPace).foregroundStyle(RuvoTheme.Colors.textTertiary)
                            }
                        }
                    }
                }
                .frame(height: 160)
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}

struct PacePoint: Identifiable {
    let id = UUID()
    var date: Date
    var paceMinPerKm: Double
}

// MARK: – Heart rate zones
struct HeartRateZone: Identifiable {
    let id = UUID()
    var zone: Int
    var name: String
    var minutesInZone: Double
    var color: Color
}

struct HeartRateZonesChart: View {
    let zones: [HeartRateZone]
    var totalMinutes: Double { zones.map(\.minutesInZone).reduce(0, +) }

    var body: some View {
        RuvoCard {
            VStack(alignment: .leading, spacing: RuvoTheme.Spacing.md) {
                Text("Heart Rate Zones")
                    .font(RuvoTheme.Typography.headingSmall)
                    .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)

                ForEach(zones) { zone in
                    HStack(spacing: RuvoTheme.Spacing.sm) {
                        Text("Z\(zone.zone)")
                            .font(RuvoTheme.Typography.labelLarge)
                            .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                            .foregroundColor(zone.color)
                            .frame(width: 28)
                        GeometryReader { geo in
                            Capsule()
                                .fill(RuvoTheme.Colors.border)
                                .overlay(alignment: .leading) {
                                    Capsule()
                                        .fill(zone.color)
                                        .frame(width: totalMinutes > 0 ? geo.size.width * (zone.minutesInZone / totalMinutes) : 0)
                                }
                        }
                        .frame(height: 8)
                        Text(String(format: "%.0f min", zone.minutesInZone))
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textSecondary)
                            .frame(width: 50, alignment: .trailing)
                    }
                }
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}

// MARK: – VO2 Max card
struct VO2MaxCard: View {
    let vo2max: Double
    @State private var animationProgress: Double = 0

    var body: some View {
        RuvoCard {
            HStack(spacing: RuvoTheme.Spacing.lg) {
                ZStack {
                    Circle()
                        .stroke(RuvoTheme.Colors.border, lineWidth: 6)
                    Circle()
                        .trim(from: 0, to: animationProgress * (vo2max / 80))
                        .stroke(
                            AngularGradient(colors: [RuvoTheme.Colors.vo2max, .orange], center: .center),
                            style: StrokeStyle(lineWidth: 6, lineCap: .round)
                        )
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 2) {
                        Text("\(Int(vo2max))")
                            .font(RuvoTheme.Typography.statNumber)
                            .tracking(RuvoTheme.Typography.Tracking.statNumber)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                        Text("VO2 Max").font(RuvoTheme.Typography.caption).foregroundColor(RuvoTheme.Colors.textTertiary).tracking(RuvoTheme.Typography.Tracking.caption)
                    }
                }
                .frame(width: 100, height: 100)
                .onAppear {
                    withAnimation(.easeOut(duration: 1.5)) { animationProgress = 1 }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Aerobic Capacity")
                        .font(RuvoTheme.Typography.headingSmall)
                        .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                        .foregroundColor(RuvoTheme.Colors.textPrimary)
                    Text(vo2maxRating)
                        .font(RuvoTheme.Typography.labelLarge)
                        .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                        .foregroundColor(RuvoTheme.Colors.vo2max)
                    Text("Higher VO2 Max means your body uses oxygen more efficiently during intense runs.")
                        .font(RuvoTheme.Typography.bodySmall)
                        .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                        .lineSpacing(4)
                }
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }

    private var vo2maxRating: String {
        switch vo2max {
        case 60...: return "Elite"
        case 50..<60: return "Excellent"
        case 40..<50: return "Good"
        case 30..<40: return "Average"
        default:      return "Below Average"
        }
    }
}

// MARK: – Recent runs list
struct RecentRunsSection: View {
    let runs: [RunRecord]

    var body: some View {
        VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
            Text("Recent Runs")
                .font(RuvoTheme.Typography.headingSmall)
                .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                .foregroundColor(RuvoTheme.Colors.textPrimary)

            ForEach(runs) { run in
                RecentRunRow(run: run)
            }
        }
    }
}

struct RecentRunRow: View {
    let run: RunRecord

    var body: some View {
        RuvoCard {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(run.startedAt, style: .date)
                        .font(RuvoTheme.Typography.labelLarge)
                        .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                        .foregroundColor(RuvoTheme.Colors.textPrimary)
                    Text(String(format: "%.2f km  ·  %@  ·  %@/km",
                                run.distanceKm,
                                run.durationSeconds.formatted,
                                run.averagePaceMinPerKm.formattedPace))
                        .font(RuvoTheme.Typography.bodySmall)
                        .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                }
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: "bolt.fill")
                        .font(.caption)
                        .foregroundColor(RuvoTheme.Colors.primary)
                    Text("+\(run.xpEarned) XP")
                        .font(RuvoTheme.Typography.labelSmall)
                        .tracking(RuvoTheme.Typography.Tracking.labelSmall)
                        .foregroundColor(RuvoTheme.Colors.primary)
                }
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}
