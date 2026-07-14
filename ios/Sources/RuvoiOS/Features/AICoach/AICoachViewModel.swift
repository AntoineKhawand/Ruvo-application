import Foundation
import FirebaseFunctions

struct CoachMessage: Identifiable {
    let id = UUID()
    var role: MessageRole
    var content: String

    enum MessageRole { case user, assistant }
}

@MainActor
final class AICoachViewModel: ObservableObject {
    @Published var messages: [CoachMessage] = []
    @Published var inputText = ""
    @Published private(set) var isStreaming = false

    private let functions = Functions.functions(region: "us-central1")

    init() {
        addWelcome()
    }

    private func addWelcome() {
        messages.append(.init(
            role: .assistant,
            content: "Hi! I'm your RUVO AI Coach, powered by Gemini 2.5 Flash. I've analyzed your recent training data. Ask me anything — pace improvements, training plans, recovery advice, or race strategy."
        ))
    }

    func send(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        messages.append(.init(role: .user, content: trimmed))
        inputText = ""
        isStreaming = true

        Task {
            do {
                let response = try await callAICoach(message: trimmed)
                messages.append(.init(role: .assistant, content: response))
            } catch {
                messages.append(.init(role: .assistant, content: "Sorry, I couldn't connect right now. Please try again."))
            }
            isStreaming = false
        }
    }

    private func callAICoach(message: String) async throws -> String {
        let callable = functions.httpsCallable("aiCoach")
        let history = messages.dropLast().map { ["role": $0.role == .user ? "user" : "model", "content": $0.content] }

        let result = try await callable.call([
            "message": message,
            "history": history
        ])

        guard let data = result.data as? [String: Any],
              let reply = data["reply"] as? String else {
            throw AICoachError.invalidResponse
        }
        return reply
    }

    enum AICoachError: Error {
        case invalidResponse
    }
}
