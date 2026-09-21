import SwiftUI

/// Animated segmented step indicator for wizard-style flows (onboarding and
/// beyond) -- replaces a bare `HStack` of `Capsule`s animated with a bare
/// `.spring()`. Mirrors Android's `RuvoProgressSteps`: the active segment's
/// width morph uses `Motion.springSettled` (a size change, not a gesture or
/// celebration -- the critically-damped default); the fill color crossfade
/// uses `Motion.easeInOut` at the quick tier (two fixed states, done fast
/// since it repeats on every step).
struct RuvoProgressSteps: View {
    let totalSteps: Int
    let currentStep: Int
    var activeColor: Color = RuvoTheme.Colors.primary
    var inactiveColor: Color = RuvoTheme.Colors.border
    /// Draw the active pill half filled: "part 1 of 2" of a step that has two pages.
    var partialActive: Bool = false

    var body: some View {
        HStack(spacing: RuvoTheme.Spacing.xs) {
            ForEach(0..<totalSteps, id: \.self) { i in
                Capsule()
                    .fill(fill(for: i))
                    .frame(width: i == currentStep ? 24 : 8, height: 8)
                    .animation(
                        RuvoTheme.Motion.springSettled(duration: RuvoTheme.Motion.Duration.standard),
                        value: currentStep
                    )
                    .animation(
                        RuvoTheme.Motion.easeInOut(RuvoTheme.Motion.Duration.quick),
                        value: i <= currentStep
                    )
            }
        }
    }

    private func fill(for i: Int) -> AnyShapeStyle {
        if i == currentStep && partialActive {
            return AnyShapeStyle(LinearGradient(stops: [
                .init(color: activeColor, location: 0), .init(color: activeColor, location: 0.46),
                .init(color: .clear, location: 0.46), .init(color: .clear, location: 0.54),
                .init(color: activeColor.opacity(0.3), location: 0.54), .init(color: activeColor.opacity(0.3), location: 1),
            ], startPoint: .leading, endPoint: .trailing))
        }
        return AnyShapeStyle(i <= currentStep ? activeColor : inactiveColor)
    }
}
