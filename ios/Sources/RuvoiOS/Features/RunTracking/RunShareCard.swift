import SwiftUI
import MapKit

// MARK: – Shareable run art card rendered as UIImage via ImageRenderer

struct RunShareCard: View {
    let run: RunRecord

    private var distanceText: String { String(format: "%.2f", run.distanceKm) }
    private var paceText: String { run.averagePaceMinPerKm.shareCardPace }
    private var durationText: String { run.durationSeconds.shareCardDuration }
    private var caloriesText: String { "\(run.calories)" }

    var body: some View {
        ZStack {
            // Background
            Color(hex: "#050505")

            VStack(spacing: 0) {
                // Header bar
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("RUVO")
                            .font(.system(size: 22, weight: .black, design: .default))
                            .foregroundColor(Color(hex: "#DFFF00"))
                            .tracking(4)
                        Text(run.startedAt.formatted(date: .abbreviated, time: .shortened))
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(Color(hex: "#777777"))
                    }
                    Spacer()
                    Image(systemName: "figure.run.circle.fill")
                        .font(.system(size: 36))
                        .foregroundColor(Color(hex: "#DFFF00"))
                }
                .padding(.horizontal, 24)
                .padding(.top, 24)
                .padding(.bottom, 16)

                // Route polyline area
                RoutePolylineView(route: run.route)
                    .frame(height: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 0))

                // Stats block
                VStack(spacing: 16) {
                    // Primary stat: distance
                    VStack(spacing: 0) {
                        HStack(alignment: .lastTextBaseline, spacing: 6) {
                            Text(distanceText)
                                .font(.system(size: 64, weight: .black))
                                .foregroundColor(.white)
                            Text("km")
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundColor(Color(hex: "#666666"))
                        }
                        Text("DISTANCE")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color(hex: "#DFFF00"))
                            .tracking(3)
                    }

                    // Secondary stats row
                    HStack(spacing: 0) {
                        ShareStat(value: durationText,  label: "TIME")
                        statDivider
                        ShareStat(value: paceText,      label: "PACE /KM")
                        statDivider
                        ShareStat(value: caloriesText,  label: "KCAL")
                    }
                    .padding(.horizontal, 24)

                    // XP earned pill
                    HStack(spacing: 8) {
                        Image(systemName: "bolt.fill")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.black)
                        Text("+\(run.xpEarned) XP earned")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.black)
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 8)
                    .background(Color(hex: "#DFFF00"))
                    .clipShape(Capsule())
                }
                .padding(.vertical, 20)

                // Bottom tag
                Text("ruvo.app")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(Color(hex: "#444444"))
                    .padding(.bottom, 20)
            }
        }
        .frame(width: 390, height: 620)
        .clipShape(RoundedRectangle(cornerRadius: 24))
    }

    private var statDivider: some View {
        Rectangle()
            .fill(Color(hex: "#222222"))
            .frame(width: 1, height: 40)
    }
}

// MARK: – Sub-components

private struct ShareStat: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 22, weight: .bold))
                .foregroundColor(.white)
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(Color(hex: "#666666"))
                .tracking(1.5)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: – Route Polyline drawn via Canvas (no MapKit needed for share card)

private struct RoutePolylineView: View {
    let route: [RunRecord.RoutePoint]

    var body: some View {
        Canvas { context, size in
            guard route.count >= 2 else {
                // Placeholder grid when no route
                drawGrid(context: context, size: size)
                return
            }
            drawGrid(context: context, size: size)
            drawRoute(context: context, size: size)
            drawStartEndDots(context: context, size: size)
        }
        .background(Color(hex: "#0A0A0A"))
    }

    private func normalizedPoints(in size: CGSize) -> [CGPoint] {
        let lats = route.map(\.latitude)
        let lons = route.map(\.longitude)
        guard let minLat = lats.min(), let maxLat = lats.max(),
              let minLon = lons.min(), let maxLon = lons.max() else { return [] }
        let latRange = maxLat - minLat; let lonRange = maxLon - minLon
        let span = max(latRange, lonRange) * 1.25
        let padding: CGFloat = 30
        let usableW = size.width - padding * 2
        let usableH = size.height - padding * 2
        return route.map { pt in
            let x = padding + CGFloat((pt.longitude - minLon + (span - lonRange) / 2) / span) * usableW
            let y = padding + CGFloat(1.0 - (pt.latitude - minLat + (span - latRange) / 2) / span) * usableH
            return CGPoint(x: x, y: y)
        }
    }

    private func drawGrid(context: GraphicsContext, size: CGSize) {
        var gridPath = Path()
        let cols = 8; let rows = 6
        for i in 0...cols {
            let x = size.width / CGFloat(cols) * CGFloat(i)
            gridPath.move(to: CGPoint(x: x, y: 0))
            gridPath.addLine(to: CGPoint(x: x, y: size.height))
        }
        for i in 0...rows {
            let y = size.height / CGFloat(rows) * CGFloat(i)
            gridPath.move(to: CGPoint(x: 0, y: y))
            gridPath.addLine(to: CGPoint(x: size.width, y: y))
        }
        context.stroke(gridPath, with: .color(Color(hex: "#DFFF00").opacity(0.04)), lineWidth: 1)
    }

    private func drawRoute(context: GraphicsContext, size: CGSize) {
        let pts = normalizedPoints(in: size)
        guard pts.count >= 2 else { return }
        // Shadow / glow pass
        var glowPath = Path()
        glowPath.move(to: pts[0])
        for pt in pts.dropFirst() { glowPath.addLine(to: pt) }
        context.stroke(glowPath, with: .color(Color(hex: "#DFFF00").opacity(0.2)), style: StrokeStyle(lineWidth: 10, lineCap: .round, lineJoin: .round))
        // Main line
        var path = Path()
        path.move(to: pts[0])
        for pt in pts.dropFirst() { path.addLine(to: pt) }
        context.stroke(path, with: .color(Color(hex: "#DFFF00")), style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
    }

    private func drawStartEndDots(context: GraphicsContext, size: CGSize) {
        let pts = normalizedPoints(in: size)
        guard let first = pts.first, let last = pts.last else { return }
        // Start dot (green)
        context.fill(Path(ellipseIn: CGRect(x: first.x - 6, y: first.y - 6, width: 12, height: 12)), with: .color(Color(hex: "#22C55E")))
        context.fill(Path(ellipseIn: CGRect(x: first.x - 3, y: first.y - 3, width: 6, height: 6)), with: .color(.white))
        // End dot (red)
        context.fill(Path(ellipseIn: CGRect(x: last.x - 6, y: last.y - 6, width: 12, height: 12)), with: .color(Color(hex: "#EF4444")))
        context.fill(Path(ellipseIn: CGRect(x: last.x - 3, y: last.y - 3, width: 6, height: 6)), with: .color(.white))
    }
}

// MARK: – Share card renderer

@MainActor
enum RunShareRenderer {
    static func renderToImage(run: RunRecord) -> UIImage? {
        let card = RunShareCard(run: run)
        let renderer = ImageRenderer(content: card)
        renderer.scale = 3.0
        return renderer.uiImage
    }

    static func share(run: RunRecord, from viewController: UIViewController) {
        guard let image = renderToImage(run: run) else {
            // Fallback to text-only share
            let text = String(format: "Just ran %.2f km in %@ at %@/km with Ruvo! 🏃 #Ruvo #Running",
                run.distanceKm, run.durationSeconds.shareCardDuration, run.averagePaceMinPerKm.shareCardPace)
            let av = UIActivityViewController(activityItems: [text], applicationActivities: nil)
            viewController.present(av, animated: true)
            return
        }
        let text = String(format: "%.2f km • %@ • Ruvo 🟡⚡", run.distanceKm, run.durationSeconds.shareCardDuration)
        let av = UIActivityViewController(activityItems: [image, text], applicationActivities: nil)
        viewController.present(av, animated: true)
    }
}

// MARK: – Preview sheet

struct ShareCardPreviewSheet: View {
    let run: RunRecord
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color(hex: "#050505").ignoresSafeArea()
            VStack(spacing: 24) {
                Text("Share Your Run")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(.white)

                RunShareCard(run: run)
                    .scaleEffect(UIScreen.main.bounds.width / 390 * 0.88)
                    .frame(height: 545)

                HStack(spacing: 16) {
                    Button {
                        dismiss()
                    } label: {
                        Text("Cancel")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color(hex: "#1A1A1A"))
                            .foregroundColor(.white)
                            .cornerRadius(14)
                    }

                    Button {
                        Task { @MainActor in
                            guard let vc = UIApplication.shared.connectedScenes
                                .compactMap({ $0 as? UIWindowScene })
                                .first?.windows.first?.rootViewController else { return }
                            RunShareRenderer.share(run: run, from: vc)
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "square.and.arrow.up")
                            Text("Share")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color(hex: "#DFFF00"))
                        .foregroundColor(.black)
                        .fontWeight(.bold)
                        .cornerRadius(14)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 32)
            }
        }
    }
}

// MARK: – Formatting helpers

extension Double {
    var shareCardPace: String {
        guard self > 0, self < 30 else { return "--:--" }
        let m = Int(self); let s = Int((self - Double(m)) * 60)
        return String(format: "%d:%02d", m, s)
    }
}

extension Int {
    var shareCardDuration: String {
        let h = self / 3600; let m = (self % 3600) / 60; let s = self % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
    }
}
