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

    var body: some View {
        HStack(spacing: RuvoTheme.Spacing.xs) {
            ForEach(0..<totalSteps, id: \.self) { i in
                Capsule()
                    .fill(i <= currentStep ? activeColor : inactiveColor)
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
}
