import SwiftUI
import FirebaseAuth
import FirebaseFirestore

// MARK: – Models

struct IntervalWorkout: Identifiable, Codable {
    let id: String
    var name: String
    var repeats: Int
    var workSeconds: Int
    var restSeconds: Int
    var warmUpSeconds: Int
    var coolDownSeconds: Int
    var targetPaceMinPerKm: Double?

    func buildSteps() -> [IntervalStep] {
        var steps: [IntervalStep] = []
        if warmUpSeconds > 0  { steps.append(.init(type: .warmUp,   duration: warmUpSeconds,   label: "Warm Up")) }
        for i in 0..<repeats {
            steps.append(.init(type: .work, duration: workSeconds, pace: targetPaceMinPerKm, label: "Interval \(i + 1)"))
            if i < repeats - 1 { steps.append(.init(type: .rest, duration: restSeconds, label: "Recovery")) }
        }
        if coolDownSeconds > 0 { steps.append(.init(type: .coolDown, duration: coolDownSeconds, label: "Cool Down")) }
        return steps
    }

    func totalSeconds() -> Int {
        warmUpSeconds + (workSeconds + restSeconds) * repeats - restSeconds + coolDownSeconds
    }
}

struct IntervalStep: Identifiable {
    let id = UUID()
    let type: StepType
    let duration: Int
    var pace: Double? = nil
    var label: String = ""

    enum StepType { case warmUp, work, rest, coolDown }

    var color: Color {
        switch type {
        case .work:     return Color(red: 0.87, green: 1.0, blue: 0)
        case .rest:     return .teal
        case .warmUp:   return .orange
        case .coolDown: return .blue
        }
    }
}

// MARK: – ViewModel

@MainActor
final class IntervalTrainingViewModel: ObservableObject {
    @Published var presets: [IntervalWorkout] = []
    @Published var session: IntervalSessionState = .idle
    @Published var showBuilder = false

    // Builder fields
    @Published var builderName = "Custom Workout"
    @Published var builderRepeats = 5
    @Published var builderWorkSec = 300
    @Published var builderRestSec = 90
    @Published var builderWarmUp = 300
    @Published var builderCoolDown = 300
    @Published var builderPace: Double? = nil

    private let db = Firestore.firestore()
    private let voiceCoach = VoiceCoach()
    private var timerTask: Task<Void, Never>?

    enum IntervalSessionState {
        case idle
        case active(workout: IntervalWorkout, steps: [IntervalStep], stepIdx: Int, elapsedInStep: Int, totalElapsed: Int, paused: Bool)
        case finished(totalSeconds: Int)

        var isActive: Bool { if case .active = self { return true }; return false }
        var workout: IntervalWorkout? { if case .active(let w, _, _, _, _, _) = self { return w }; return nil }
        var steps: [IntervalStep]  { if case .active(_, let s, _, _, _, _) = self { return s }; return [] }
        var stepIdx: Int           { if case .active(_, _, let i, _, _, _) = self { return i }; return 0 }
        var elapsedInStep: Int     { if case .active(_, _, _, let e, _, _) = self { return e }; return 0 }
        var totalElapsed: Int      { if case .active(_, _, _, _, let t, _) = self { return t }; return 0 }
        var isPaused: Bool         { if case .active(_, _, _, _, _, let p) = self { return p }; return false }

        var currentStep: IntervalStep? { steps.indices.contains(stepIdx) ? steps[stepIdx] : nil }
        var progressInStep: Double {
            guard let d = currentStep?.duration, d > 0 else { return 0 }
            return Double(elapsedInStep) / Double(d)
        }
        var remainingInStep: Int { (currentStep?.duration ?? 0) - elapsedInStep }
    }

    init() { loadPresets() }

    private func loadPresets() {
        let defaults: [IntervalWorkout] = [
            .init(id: "1", name: "5×1 km Intervals",  repeats: 5,  workSeconds: 300, restSeconds: 90,  warmUpSeconds: 600, coolDownSeconds: 600, targetPaceMinPerKm: 4.5),
            .init(id: "2", name: "10×400m Speed",      repeats: 10, workSeconds: 100, restSeconds: 60,  warmUpSeconds: 300, coolDownSeconds: 300, targetPaceMinPerKm: 4.0),
            .init(id: "3", name: "Fartlek 20 min",     repeats: 6,  workSeconds: 120, restSeconds: 60,  warmUpSeconds: 300, coolDownSeconds: 300),
            .init(id: "4", name: "Tempo 3×1 km",       repeats: 3,  workSeconds: 300, restSeconds: 120, warmUpSeconds: 600, coolDownSeconds: 600, targetPaceMinPerKm: 5.0),
            .init(id: "5", name: "Beginner 8×30s",     repeats: 8,  workSeconds: 30,  restSeconds: 90,  warmUpSeconds: 300, coolDownSeconds: 300),
        ]
        guard let uid = Auth.auth().currentUser?.uid else { presets = defaults; return }
        Task {
            let snap = try? await db.collection("users").document(uid)
                .collection("intervalWorkouts").getDocuments()
            let saved: [IntervalWorkout] = snap?.documents.compactMap { doc in
                guard let name = doc["name"] as? String else { return nil }
                return IntervalWorkout(
                    id: doc.documentID, name: name,
                    repeats:       (doc["repeats"]       as? Int) ?? 5,
                    workSeconds:   (doc["workSeconds"]   as? Int) ?? 300,
                    restSeconds:   (doc["restSeconds"]   as? Int) ?? 90,
                    warmUpSeconds: (doc["warmUpSeconds"] as? Int) ?? 300,
                    coolDownSeconds:(doc["coolDownSeconds"] as? Int) ?? 300,
                    targetPaceMinPerKm: doc["targetPaceMinPerKm"] as? Double
                )
            } ?? []
            presets = saved + defaults
        }
    }

    func startWorkout(_ workout: IntervalWorkout) {
        let steps = workout.buildSteps()
        session = .active(workout: workout, steps: steps, stepIdx: 0, elapsedInStep: 0, totalElapsed: 0, paused: false)
        announceStep(steps.first)
        startTimer()
    }

    func pauseResume() {
        guard case .active(let w, let s, let i, let e, let t, let p) = session else { return }
        session = .active(workout: w, steps: s, stepIdx: i, elapsedInStep: e, totalElapsed: t, paused: !p)
        if p { startTimer() } else { timerTask?.cancel() }
    }

    func stop() {
        timerTask?.cancel()
        session = .idle
    }

    func saveCustom() {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        let workout = IntervalWorkout(
            id: UUID().uuidString, name: builderName, repeats: builderRepeats,
            workSeconds: builderWorkSec, restSeconds: builderRestSec,
            warmUpSeconds: builderWarmUp, coolDownSeconds: builderCoolDown,
            targetPaceMinPerKm: builderPace
        )
        let data: [String: Any] = [
            "name": workout.name, "repeats": workout.repeats,
            "workSeconds": workout.workSeconds, "restSeconds": workout.restSeconds,
            "warmUpSeconds": workout.warmUpSeconds, "coolDownSeconds": workout.coolDownSeconds,
            "targetPaceMinPerKm": workout.targetPaceMinPerKm as Any,
        ]
        db.collection("users").document(uid).collection("intervalWorkouts").addDocument(data: data)
        presets.insert(workout, at: 0)
        showBuilder = false
    }

    private func startTimer() {
        timerTask?.cancel()
        timerTask = Task {
            while true {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if Task.isCancelled { break }
                await tick()
            }
        }
    }

    private func tick() {
        guard case .active(let w, let s, let i, let e, let t, let p) = session, !p else { return }
        let newElapsed = e + 1
        let step = s[i]
        if newElapsed >= step.duration {
            let nextIdx = i + 1
            if nextIdx >= s.count {
                timerTask?.cancel()
                session = .finished(totalSeconds: t + 1)
                voiceCoach.speak("Workout complete! Great job!")
            } else {
                session = .active(workout: w, steps: s, stepIdx: nextIdx, elapsedInStep: 0, totalElapsed: t + 1, paused: false)
                announceStep(s[nextIdx])
            }
        } else {
            session = .active(workout: w, steps: s, stepIdx: i, elapsedInStep: newElapsed, totalElapsed: t + 1, paused: false)
            let remaining = step.duration - newElapsed
            if remaining <= 3 { voiceCoach.speak("\(remaining)") }
        }
    }

    private func announceStep(_ step: IntervalStep?) {
        guard let step else { return }
        let paceStr = step.pace.map { p in
            let m = Int(p); let s = Int((p - Double(m)) * 60)
            return " at \(m):\(String(format: "%02d", s)) per km"
        } ?? ""
        let durMin = step.duration / 60; let durSec = step.duration % 60
        let durStr = durMin > 0 ? "\(durMin) minute\(durMin > 1 ? "s" : "")" : "\(durSec) seconds"
        voiceCoach.speak("\(step.label). \(durStr)\(paceStr).")
    }
}

// MARK: – Root View

struct IntervalTrainingView: View {
    @StateObject private var vm = IntervalTrainingViewModel()

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()
            if vm.session.isActive {
                activeSessionView
            } else if case .finished(let sec) = vm.session {
                finishedView(totalSeconds: sec)
            } else {
                pickerView
            }
        }
        .sheet(isPresented: $vm.showBuilder) { builderSheet }
    }

    // MARK: Picker
    private var pickerView: some View {
        ScrollView {
            VStack(spacing: 16) {
                HStack {
                    Text("Interval Training").font(RuvoTheme.Typography.displayMedium).foregroundColor(.white)
                    Spacer()
                    Button { vm.showBuilder = true } label: {
                        Image(systemName: "plus.circle.fill").foregroundColor(RuvoTheme.Colors.primary).font(.title2)
                    }
                }
                ForEach(vm.presets) { workout in
                    WorkoutPresetCard(workout: workout) { vm.startWorkout(workout) }
                }
                Spacer(minLength: 80)
            }
            .padding()
        }
    }

    // MARK: Active Session
    private var activeSessionView: some View {
        let step = vm.session.currentStep
        let stepColor = step?.color ?? .gray
        return VStack(spacing: 28) {
            Text(vm.session.workout?.name ?? "").font(RuvoTheme.Typography.labelLarge).foregroundColor(RuvoTheme.Colors.textSecondary)
            Text(step?.label ?? "Done").font(RuvoTheme.Typography.headingLarge).foregroundColor(stepColor)

            ZStack {
                Circle().stroke(RuvoTheme.Colors.border, lineWidth: 10).frame(width: 200, height: 200)
                Circle()
                    .trim(from: 0, to: vm.session.progressInStep)
                    .stroke(stepColor, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .frame(width: 200, height: 200)
                    .animation(.linear(duration: 1), value: vm.session.progressInStep)
                VStack(spacing: 4) {
                    Text(vm.session.remainingInStep.formattedInterval)
                        .font(.system(size: 48, weight: .black, design: .monospaced))
                        .foregroundColor(.white)
                    Text("remaining").font(RuvoTheme.Typography.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
                }
            }

            if let pace = step?.pace {
                let m = Int(pace); let s = Int((pace - Double(m)) * 60)
                RuvoCard {
                    VStack(spacing: 4) {
                        Text("Target Pace").font(RuvoTheme.Typography.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
                        Text("\(m):\(String(format: "%02d", s))/km").font(RuvoTheme.Typography.headingMedium).foregroundColor(stepColor)
                    }
                    .padding(14).frame(maxWidth: .infinity)
                }
            }

            // Step strip
            HStack(spacing: 3) {
                ForEach(vm.session.steps.indices, id: \.self) { i in
                    let s = vm.session.steps[i]
                    Capsule()
                        .fill(i <= vm.session.stepIdx ? s.color : RuvoTheme.Colors.border)
                        .frame(height: 8)
                        .frame(maxWidth: .infinity)
                }
            }

            Text("Total: \(vm.session.totalElapsed.formattedInterval)").font(RuvoTheme.Typography.bodyMedium).foregroundColor(RuvoTheme.Colors.textSecondary)

            HStack(spacing: 16) {
                Button { vm.stop() } label: {
                    Label("Stop", systemImage: "stop.fill").foregroundColor(.red)
                        .padding(.horizontal, 20).padding(.vertical, 12)
                        .background(RuvoTheme.Colors.surfaceElevated).clipShape(Capsule())
                }
                Button { vm.pauseResume() } label: {
                    Label(vm.session.isPaused ? "Resume" : "Pause",
                          systemImage: vm.session.isPaused ? "play.fill" : "pause.fill")
                        .foregroundColor(.black)
                        .padding(.horizontal, 24).padding(.vertical, 12)
                        .background(RuvoTheme.Colors.primary).clipShape(Capsule())
                }
            }
        }
        .padding(24)
    }

    // MARK: Finished
    private func finishedView(totalSeconds: Int) -> some View {
        VStack(spacing: 20) {
            Text("🎉").font(.system(size: 64))
            Text("Workout Complete!").font(RuvoTheme.Typography.headingLarge).foregroundColor(RuvoTheme.Colors.primary)
            Text("Total time: \(totalSeconds.formattedInterval)").font(RuvoTheme.Typography.bodyLarge).foregroundColor(.white)
            Button { vm.session = .idle } label: {
                Text("Done").foregroundColor(.black).frame(maxWidth: .infinity).frame(height: 52)
                    .background(RuvoTheme.Colors.primary).clipShape(Capsule())
            }
            .padding(.horizontal, 40)
        }
        .padding()
    }

    // MARK: Builder Sheet
    private var builderSheet: some View {
        ZStack { RuvoTheme.Colors.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Custom Workout").font(RuvoTheme.Typography.headingLarge).foregroundColor(.white)
                    builderField("Name", text: $vm.builderName)
                    builderStepper("Repeats", value: $vm.builderRepeats, range: 1...20)
                    builderStepper("Work (seconds)", value: $vm.builderWorkSec, range: 10...3600, step: 10)
                    builderStepper("Rest (seconds)", value: $vm.builderRestSec, range: 10...3600, step: 10)
                    builderStepper("Warm Up (seconds)", value: $vm.builderWarmUp, range: 0...1800, step: 60)
                    builderStepper("Cool Down (seconds)", value: $vm.builderCoolDown, range: 0...1800, step: 60)
                    Button { vm.saveCustom() } label: {
                        Text("Save Workout").foregroundColor(.black).frame(maxWidth: .infinity).frame(height: 52)
                            .background(RuvoTheme.Colors.primary).clipShape(Capsule())
                    }
                }
                .padding(20)
            }
        }
    }

    private func builderField(_ label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(RuvoTheme.Typography.labelSmall).foregroundColor(RuvoTheme.Colors.textSecondary)
            TextField("", text: text).foregroundColor(.white).padding(14)
                .background(RuvoTheme.Colors.surfaceElevated)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(RuvoTheme.Colors.border, lineWidth: 1))
        }
    }

    private func builderStepper(_ label: String, value: Binding<Int>, range: ClosedRange<Int>, step: Int = 1) -> some View {
        HStack {
            Text(label).font(RuvoTheme.Typography.labelMedium).foregroundColor(.white)
            Spacer()
            Stepper("\(value.wrappedValue)", value: value, in: range, step: step)
                .foregroundColor(RuvoTheme.Colors.primary)
        }
        .padding(14).background(RuvoTheme.Colors.surfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: – WorkoutPresetCard

private struct WorkoutPresetCard: View {
    let workout: IntervalWorkout
    let onStart: () -> Void

    var body: some View {
        RuvoCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(workout.name).font(RuvoTheme.Typography.labelLarge).foregroundColor(.white)
                    Spacer()
                    Text(workout.totalSeconds().formattedInterval).font(RuvoTheme.Typography.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        IntervalTag("\(workout.repeats)×", .primary)
                        IntervalTag("\(workout.workSeconds)s work", .green)
                        IntervalTag("\(workout.restSeconds)s rest", .teal)
                        if let p = workout.targetPaceMinPerKm {
                            let m = Int(p); let s = Int((p - Double(m)) * 60)
                            IntervalTag("\(m):\(String(format: "%02d", s))/km", .purple)
                        }
                    }
                }
                Button(action: onStart) {
                    Text("Start").font(RuvoTheme.Typography.labelMedium).foregroundColor(.black)
                        .frame(maxWidth: .infinity).frame(height: 40)
                        .background(RuvoTheme.Colors.primary).clipShape(Capsule())
                }
            }
            .padding(16)
        }
    }

    private func IntervalTag(_ label: String, _ color: Color) -> some View {
        Text(label).font(RuvoTheme.Typography.labelSmall).foregroundColor(color)
            .padding(.horizontal, 10).padding(.vertical, 4)
            .background(color.opacity(0.15)).clipShape(Capsule())
    }
}

// MARK: – Extensions
private extension Int {
    var formattedInterval: String {
        let m = self / 60; let s = self % 60
        return m > 0 ? "\(m):\(String(format: "%02d", s))" : "\(s)s"
    }
}
