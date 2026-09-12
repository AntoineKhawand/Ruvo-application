import SwiftUI

/// A compact selectable tile/pill/chip -- the shared shape behind gender
/// pills, 0-7 frequency number tiles, and day-of-week chips in onboarding
/// (and any future "pick one" strip that isn't card-sized). Mirrors
/// Android's `RuvoSelectionChip`. Caller owns sizing (`.frame(...)`) and
/// `shape` (`Capsule()`, `Circle()`, a rounded rectangle, whatever the strip
/// calls for); this owns the press-scale + selection-crossfade motion.
struct RuvoSelectionChip: View {
    let label: String
    let isSelected: Bool
    var shape: AnyShape = AnyShape(RoundedRectangle(cornerRadius: RuvoTheme.Radius.sm))
    var selectedColor: Color = RuvoTheme.Colors.primary
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(RuvoTheme.Typography.labelLarge)
                .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                .fontWeight(.bold)
                .foregroundColor(isSelected ? .black : RuvoTheme.Colors.textPrimary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(shape.fill(isSelected ? selectedColor : RuvoTheme.Colors.surfaceElevated))
                .overlay(shape.stroke(isSelected ? selectedColor : RuvoTheme.Colors.border, lineWidth: 1))
                // Selection crossfade: two fixed states, so Motion.easeInOut per its
                // own doc -- quick tier, since these are small, high-repetition
                // targets where a standard-tier fade would read as sluggish next to
                // the press-scale from ScaleButtonStyle below.
                .animation(
                    RuvoTheme.Motion.easeInOut(RuvoTheme.Motion.Duration.quick),
                    value: isSelected
                )
        }
        .buttonStyle(ScaleButtonStyle())
    }
}
