import SwiftUI

/// A `RuvoCard` that is tappable and carries a selected/unselected state --
/// the shared shape behind Goal cards, Level rows, and any other "pick one
/// of these" option in onboarding (and beyond). Mirrors Android's
/// `RuvoSelectableCard`: press feedback comes from the same `ScaleButtonStyle`
/// every `RuvoButton` uses (gesture-driven, so `RuvoTheme.Motion.springBouncy`),
/// and the selection crossfade comes from `RuvoCard`'s own animated
/// `isHighlighted` transition -- no separate animation to wire up here.
///
/// Replaces the repeated `Button { RuvoCard(isHighlighted: ...) { ... } }
/// .buttonStyle(ScaleButtonStyle())` pattern (see the pre-existing `GoalCard`
/// and `LevelRow` in OnboardingView) with one named type.
struct RuvoSelectableCard<Content: View>: View {
    let isSelected: Bool
    var glowColor: Color = RuvoTheme.Colors.primary
    let action: () -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        Button(action: action) {
            RuvoCard(isHighlighted: isSelected, glowColor: glowColor, content: content)
        }
        .buttonStyle(ScaleButtonStyle())
    }
}
