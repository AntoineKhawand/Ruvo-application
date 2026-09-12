import SwiftUI
import MapKit

struct RunTrackingView: View {
    @StateObject private var viewModel: RunTrackingViewModel
    @Environment(\.dismiss) private var dismiss

    init() {
        _viewModel = StateObject(wrappedValue: RunTrackingViewModel(
            service: RunTrackingService(),
            gamification: GamificationService(db: .firestore(), functions: .functions(region: "us-central1"))
        ))
    }

    var body: some View {
        ZStack {
            // Map layer
            RunMapView(route: viewModel.locationManager.route, currentLocation: viewModel.locationManager.location?.coordinate)
                .ignoresSafeArea()

            // Overlay UI
            VStack {
                // Top HUD
                RunHUDView(viewModel: viewModel, onDismiss: { dismiss() })
                    .padding(.horizontal, 16)
                    .padding(.top, 60)

                Spacer()

                // Bottom metrics + controls
                RunControlsView(viewModel: viewModel)
            }

            // Countdown overlay
            if viewModel.isCountdown, case .countdown(let sec) = viewModel.runState {
                CountdownOverlay(seconds: sec)
            }

            // Finished card → navigates to summary
            if case .finished = viewModel.runState, viewModel.savedRun == nil {
                RunFinishedCard(viewModel: viewModel, onDone: { /* savedRun triggers sheet */ })
            }
        }
        .preferredColorScheme(.dark)
        .fullScreenCover(item: Binding(
            get: { viewModel.savedRun },
            set: { _ in }
        )) { run in
            NavigationStack {
                RunSummaryView(run: run)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { dismiss() }
                                .foregroundColor(RuvoTheme.Colors.primary)
                        }
                    }
            }
        }
    }
}

// MARK: – Map
struct RunMapView: View {
    let route: [CLLocationCoordinate2D]
    let currentLocation: CLLocationCoordinate2D?

    @State private var cameraPosition: MapCameraPosition = .userLocation(fallback: .automatic)

    var body: some View {
        Map(position: $cameraPosition) {
            if route.count > 1 {
                MapPolyline(coordinates: route)
                    .stroke(RuvoTheme.Colors.primary, lineWidth: 4)
            }
            if let loc = currentLocation {
                Annotation("", coordinate: loc) {
                    ZStack {
                        Circle()
                            .fill(RuvoTheme.Colors.primary)
                            .frame(width: 16, height: 16)
                        Circle()
                            .stroke(Color.white, lineWidth: 2)
                            .frame(width: 16, height: 16)
                    }
                }
            }
            UserAnnotation()
        }
        .mapStyle(.standard(emphasis: .muted))
        .mapControls { MapUserLocationButton() }
    }
}

// MARK: – HUD (top bar)
struct RunHUDView: View {
    @ObservedObject var viewModel: RunTrackingViewModel
    let onDismiss: () -> Void

    var body: some View {
        HStack {
            RuvoIconButton(icon: "xmark", action: onDismiss)
            Spacer()
            VStack(spacing: 2) {
                Text(viewModel.elapsedSeconds.formatted)
                    .font(RuvoTheme.Typography.displayMedium)
                    .tracking(RuvoTheme.Typography.Tracking.displayMedium)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                    .monospacedDigit()
                Text("Duration")
                    .font(RuvoTheme.Typography.caption)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
                    .tracking(RuvoTheme.Typography.Tracking.caption)
            }
            Spacer()
            Button {
                viewModel.toggleLiveSharing()
            } label: {
                Image(systemName: viewModel.isLiveSharingEnabled ? "antenna.radiowaves.left.and.right" : "antenna.radiowaves.left.and.right.slash")
                    .foregroundColor(viewModel.isLiveSharingEnabled ? RuvoTheme.Colors.primary : RuvoTheme.Colors.textTertiary)
                    .frame(width: 44, height: 44)
                    .background(RuvoTheme.Colors.surface.opacity(0.8))
                    .clipShape(Circle())
            }
        }
        .padding(16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20))
    }
}

// MARK: – Metrics Row
struct RunControlsView: View {
    @ObservedObject var viewModel: RunTrackingViewModel

    var body: some View {
        VStack(spacing: 16) {
            // Live metrics
            HStack(spacing: 0) {
                MetricCell(label: "Distance", value: String(format: "%.2f", viewModel.distanceKm), unit: "km")
                Divider().frame(height: 40).background(RuvoTheme.Colors.border)
                MetricCell(label: "Pace", value: viewModel.currentPace.formattedPace, unit: "/km")
                Divider().frame(height: 40).background(RuvoTheme.Colors.border)
                MetricCell(label: "Calories", value: "\(viewModel.calories)", unit: "kcal")
            }
            .padding(16)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20))

            // Controls
            HStack(spacing: 24) {
                // Lap
                CircleControlButton(icon: "flag.fill", label: "Lap") {
                    viewModel.lap()
                }
                .opacity(viewModel.isRunning ? 1 : 0.3)
                .disabled(!viewModel.isRunning)

                // Main play/pause/start
                MainRunButton(viewModel: viewModel)

                // Stop
                CircleControlButton(icon: "stop.fill", label: "Stop") {
                    viewModel.finishRun()
                }
                .opacity(viewModel.isRunning || viewModel.isPaused ? 1 : 0.3)
                .disabled(viewModel.isIdle || viewModel.isCountdown)
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 40)
    }
}

struct MetricCell: View {
    let label: String
    let value: String
    let unit: String

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(RuvoTheme.Typography.headingLarge)
                .tracking(RuvoTheme.Typography.Tracking.headingLarge)
                .foregroundColor(RuvoTheme.Colors.textPrimary)
                .monospacedDigit()
            Text(label + " " + unit)
                .font(RuvoTheme.Typography.caption)
                .foregroundColor(RuvoTheme.Colors.textSecondary)
                .tracking(RuvoTheme.Typography.Tracking.caption)
        }
        .frame(maxWidth: .infinity)
    }
}

struct MainRunButton: View {
    @ObservedObject var viewModel: RunTrackingViewModel

    var body: some View {
        Button {
            switch viewModel.runState {
            case .idle:    viewModel.startCountdown()
            case .running: viewModel.pause()
            case .paused:  viewModel.resume()
            default:       break
            }
        } label: {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [RuvoTheme.Colors.primary, Color(hex: "#A8CC00")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 72, height: 72)
                    .shadow(color: RuvoTheme.Colors.primary.opacity(0.4), radius: 16, y: 4)

                Image(systemName: mainIcon)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(.black)
            }
        }
        .buttonStyle(ScaleButtonStyle())
    }

    private var mainIcon: String {
        if viewModel.isRunning { return "pause.fill" }
        if viewModel.isPaused  { return "play.fill" }
        return "figure.run"
    }
}

struct CircleControlButton: View {
    let icon: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                ZStack {
                    Circle()
                        .fill(RuvoTheme.Colors.surface)
                        .frame(width: 52, height: 52)
                        .overlay(Circle().stroke(RuvoTheme.Colors.border, lineWidth: 1))
                    Image(systemName: icon)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                }
                Text(label)
                    .font(RuvoTheme.Typography.caption)
                    .tracking(RuvoTheme.Typography.Tracking.caption)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
            }
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

// MARK: – Countdown overlay
struct CountdownOverlay: View {
    let seconds: Int
    @State private var scale: CGFloat = 1.5

    var body: some View {
        ZStack {
            Color.black.opacity(0.6).ignoresSafeArea()
            Text("\(seconds)")
                .font(.system(size: 120, weight: .black))
                .foregroundColor(RuvoTheme.Colors.primary)
                .scaleEffect(scale)
                .animation(RuvoTheme.Motion.springBouncy(duration: RuvoTheme.Motion.Duration.modal), value: seconds)
                .onAppear { scale = 1.0 }
        }
    }
}

// MARK: – Run Finished summary card
struct RunFinishedCard: View {
    @ObservedObject var viewModel: RunTrackingViewModel
    let onDone: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.8).ignoresSafeArea()
            VStack(spacing: 24) {
                Text("Run Complete!")
                    .font(RuvoTheme.Typography.displayMedium)
                    .tracking(RuvoTheme.Typography.Tracking.displayMedium)
                    .foregroundColor(RuvoTheme.Colors.primary)

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                    RuvoStatCard(label: "Distance", value: String(format: "%.2f", viewModel.distanceKm), unit: "km")
                    RuvoStatCard(label: "Duration", value: viewModel.elapsedSeconds.formatted, unit: "")
                    RuvoStatCard(label: "Avg. Pace", value: viewModel.averagePace.formattedPace, unit: "/km")
                    RuvoStatCard(label: "Calories", value: "\(viewModel.calories)", unit: "kcal")
                }

                RuvoButton(title: "Done", style: .primary, action: onDone)
            }
            .padding(24)
            .background(
                RuvoTheme.Colors.glassSurface
                    .overlay(RuvoTheme.Colors.surface.opacity(0.6))
            )
            .clipShape(RoundedRectangle(cornerRadius: 28))
            .padding(20)
        }
    }
}

// MARK: – Extensions
extension Int {
    var formatted: String {
        let h = self / 3600
        let m = (self % 3600) / 60
        let s = self % 60
        if h > 0 { return String(format: "%d:%02d:%02d", h, m, s) }
        return String(format: "%d:%02d", m, s)
    }
}

extension Double {
    var formattedPace: String {
        guard self > 0 && self < 30 else { return "--:--" }
        let minutes = Int(self)
        let seconds = Int((self - Double(minutes)) * 60)
        return String(format: "%d:%02d", minutes, seconds)
    }
}
