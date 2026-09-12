import SwiftUI

struct AICoachView: View {
    @StateObject private var viewModel = AICoachViewModel()
    @FocusState private var isInputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Header
            CoachHeaderView()

            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: RuvoTheme.Spacing.sm) {
                        ForEach(viewModel.messages) { msg in
                            MessageBubble(message: msg)
                                .id(msg.id)
                        }
                        if viewModel.isStreaming {
                            StreamingIndicator()
                        }
                    }
                    .padding(RuvoTheme.Spacing.md)
                }
                .onChange(of: viewModel.messages.count) { _ in
                    if let last = viewModel.messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            // Suggested prompts (when empty)
            if viewModel.messages.isEmpty {
                SuggestedPromptsView(onSelect: viewModel.send)
                    .padding(RuvoTheme.Spacing.md)
            }

            // Input bar
            MessageInputBar(
                text: $viewModel.inputText,
                isFocused: $isInputFocused,
                isLoading: viewModel.isStreaming,
                onSend: viewModel.send
            )
        }
        .background(RuvoTheme.Colors.background.ignoresSafeArea())
        .navigationTitle("AI Coach")
        .navigationBarTitleDisplayMode(.large)
    }
}

struct CoachHeaderView: View {
    var body: some View {
        HStack(spacing: RuvoTheme.Spacing.sm) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(colors: [Color(hex: "#4F46E5"), Color(hex: "#7C3AED")],
                                       startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
                    .frame(width: 48, height: 48)
                    .shadow(color: Color(hex: "#7C3AED").opacity(0.4), radius: 8)
                Image(systemName: "sparkles")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.white)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("RUVO Intelligence")
                    .font(RuvoTheme.Typography.headingSmall)
                    .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                    .foregroundColor(RuvoTheme.Colors.textPrimary)
                HStack(spacing: 4) {
                    Circle()
                        .fill(RuvoTheme.Colors.success)
                        .frame(width: 6, height: 6)
                    Text("Active Analysis")
                        .font(RuvoTheme.Typography.caption)
                        .foregroundColor(RuvoTheme.Colors.success)
                        .tracking(RuvoTheme.Typography.Tracking.caption)
                }
            }
            Spacer()
        }
        .padding(RuvoTheme.Spacing.md)
        .background(RuvoTheme.Colors.surface)
        .overlay(Divider().background(RuvoTheme.Colors.border), alignment: .bottom)
    }
}

struct MessageBubble: View {
    let message: CoachMessage

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if message.role == .assistant {
                CoachAvatar()
                BubbleContent(message: message)
                Spacer()
            } else {
                Spacer()
                BubbleContent(message: message)
            }
        }
    }
}

struct CoachAvatar: View {
    var body: some View {
        Circle()
            .fill(LinearGradient(colors: [Color(hex: "#4F46E5"), Color(hex: "#7C3AED")],
                                 startPoint: .topLeading, endPoint: .bottomTrailing))
            .frame(width: 28, height: 28)
            .overlay(
                Image(systemName: "sparkles")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white)
            )
    }
}

struct BubbleContent: View {
    let message: CoachMessage

    var body: some View {
        Text(message.content)
            .font(RuvoTheme.Typography.bodyMedium)
            .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
            .foregroundColor(message.role == .user ? .black : RuvoTheme.Colors.textPrimary)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                message.role == .user
                ? RuvoTheme.Colors.primary
                : RuvoTheme.Colors.surfaceElevated
            )
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(message.role == .assistant ? RuvoTheme.Colors.border : .clear, lineWidth: 1)
            )
            .frame(maxWidth: UIScreen.main.bounds.width * 0.75, alignment: message.role == .user ? .trailing : .leading)
    }
}

struct StreamingIndicator: View {
    @State private var phase = 0
    let timer = Timer.publish(every: 0.4, on: .main, in: .common).autoconnect()

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            CoachAvatar()
            HStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .fill(Color(hex: "#7C3AED"))
                        .frame(width: 6, height: 6)
                        .scaleEffect(phase == i ? 1.3 : 1)
                        .animation(.easeInOut(duration: 0.3), value: phase)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(RuvoTheme.Colors.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            Spacer()
        }
        .onReceive(timer) { _ in phase = (phase + 1) % 3 }
    }
}

struct SuggestedPromptsView: View {
    let onSelect: (String) -> Void

    private let prompts = [
        "Analyze my recent training and suggest improvements",
        "Create a 10K training plan for next month",
        "Why is my pace slower this week?",
        "How much should I run to lose weight?",
        "What's my optimal heart rate zone for fat burning?"
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: RuvoTheme.Spacing.sm) {
            Text("Suggested")
                .font(RuvoTheme.Typography.labelSmall)
                .foregroundColor(RuvoTheme.Colors.textTertiary)
                .tracking(RuvoTheme.Typography.Tracking.labelSmall)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(prompts, id: \.self) { prompt in
                        Button {
                            onSelect(prompt)
                        } label: {
                            Text(prompt)
                                .font(RuvoTheme.Typography.bodySmall)
                                .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                                .foregroundColor(RuvoTheme.Colors.textPrimary)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 10)
                                .background(RuvoTheme.Colors.surface)
                                .clipShape(Capsule())
                                .overlay(Capsule().stroke(RuvoTheme.Colors.border, lineWidth: 1))
                        }
                        .buttonStyle(ScaleButtonStyle())
                    }
                }
            }
        }
    }
}

struct MessageInputBar: View {
    @Binding var text: String
    @FocusState.Binding var isFocused: Bool
    let isLoading: Bool
    let onSend: (String) -> Void

    var body: some View {
        HStack(spacing: RuvoTheme.Spacing.sm) {
            TextField("Ask your AI coach...", text: $text, axis: .vertical)
                .font(RuvoTheme.Typography.bodyMedium)
                .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                .foregroundColor(RuvoTheme.Colors.textPrimary)
                .focused($isFocused)
                .lineLimit(1...5)
                .padding(.horizontal, RuvoTheme.Spacing.md)
                .padding(.vertical, 10)
                .background(RuvoTheme.Colors.surfaceElevated)
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(isFocused ? RuvoTheme.Colors.primary.opacity(0.4) : RuvoTheme.Colors.border, lineWidth: 1))

            Button {
                let msg = text.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !msg.isEmpty, !isLoading else { return }
                text = ""
                onSend(msg)
            } label: {
                ZStack {
                    Circle()
                        .fill(text.trimmingCharacters(in: .whitespaces).isEmpty || isLoading
                              ? RuvoTheme.Colors.border
                              : RuvoTheme.Colors.primary)
                        .frame(width: 40, height: 40)
                    Image(systemName: isLoading ? "stop.fill" : "arrow.up")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(text.isEmpty || isLoading ? RuvoTheme.Colors.textTertiary : .black)
                }
            }
            .buttonStyle(ScaleButtonStyle())
        }
        .padding(.horizontal, RuvoTheme.Spacing.md)
        .padding(.vertical, 12)
        .background(RuvoTheme.Colors.surface.overlay(Divider().background(RuvoTheme.Colors.border), alignment: .top))
    }
}
