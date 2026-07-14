import SwiftUI
import FirebaseAuth
import FirebaseFirestore
import FirebaseFunctions

// MARK: – Models

struct TrainingPlan: Identifiable, Codable {
    let id: String
    var goal: String
    var level: String
    var totalWeeks: Int
    var runsPerWeek: Int
    var weeks: [TrainingWeek]
    var isActive: Bool
    var createdAt: Date
}

struct TrainingWeek: Identifiable, Codable {
    var id: String { "W\(weekNumber)" }
    var weekNumber: Int
    var days: [TrainingDay]
    var targetDistanceKm: Double
}

struct TrainingDay: Identifiable, Codable {
    var id: String { "\(weekNumber)-\(dayOfWeek)" }
    var weekNumber: Int
    var dayOfWeek: String
    var type: RunType
    var distanceKm: Double
    var description: String
    var isCompleted: Bool = false
}

enum RunType: String, Codable, CaseIterable {
    case easy, tempo, long, interval, race, rest
    var color: Color {
        switch self {
        case .easy:     return .green
        case .tempo:    return .orange
        case .long:     return Color(red: 0.87, green: 1.0, blue: 0)  // lime
        case .interval: return .purple
        case .race:     return .red
        case .rest:     return Color.gray.opacity(0.5)
        }
    }
    var emoji: String {
        switch self {
        case .easy:     return "🟢"
        case .tempo:    return "🟠"
        case .long:     return "💛"
        case .interval: return "🟣"
        case .race:     return "🔴"
        case .rest:     return "💤"
        }
    }
}

// MARK: – ViewModel

@MainActor
final class TrainingPlanViewModel: ObservableObject {
    @Published var activePlan: TrainingPlan?
    @Published var allPlans: [TrainingPlan] = []
    @Published var isLoading = false
    @Published var isGenerating = false
    @Published var showGenerator = false
    @Published var selectedGoal = "Half Marathon"
    @Published var selectedLevel = "Intermediate"
    @Published var planWeeks = 12

    private let db = Firestore.firestore()
    private let functions = Functions.functions()

    let goals  = ["5K", "10K", "Half Marathon", "Marathon"]
    let levels = ["Beginner", "Intermediate", "Advanced", "Elite"]

    func load() async {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let snap = try await db.collection("users").document(uid)
                .collection("trainingPlans")
                .order(by: "createdAt", descending: true)
                .getDocuments()
            allPlans = snap.documents.compactMap { decodeplan(from: $0) }
            activePlan = allPlans.first { $0.isActive } ?? allPlans.first
        } catch {}
    }

    func generateAIPlan() async {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        isGenerating = true
        defer { isGenerating = false }

        let planId = UUID().uuidString
        let plan: TrainingPlan
        do {
            let result = try await functions.httpsCallable("generateTrainingPlan").call([
                "goal": selectedGoal,
                "level": selectedLevel,
                "weeks": planWeeks,
                "runsPerWeek": 3,
            ])
            if let data = result.data as? [String: Any] {
                plan = parseFunctionPlan(data: data, id: planId)
            } else {
                plan = buildDefaultPlan(id: planId)
            }
        } catch {
            plan = buildDefaultPlan(id: planId)
        }

        await savePlan(uid: uid, plan: plan)
        activePlan = plan
        allPlans.insert(plan, at: 0)
        showGenerator = false
    }

    func markDayCompleted(weekNumber: Int, dayId: String) async {
        guard let uid = Auth.auth().currentUser?.uid,
              let planIndex = allPlans.firstIndex(where: { $0.id == activePlan?.id }) else { return }

        allPlans[planIndex].weeks[weekNumber - 1].days = allPlans[planIndex].weeks[weekNumber - 1].days.map { d in
            var day = d
            if d.id == dayId { day.isCompleted = true }
            return day
        }
        activePlan = allPlans[planIndex]

        let planId = allPlans[planIndex].id
        try? await db.collection("users").document(uid)
            .collection("trainingPlans").document(planId)
            .updateData(["weeks": allPlans[planIndex].weeks.map { encodedWeek($0) }])
    }

    // MARK: Private helpers

    private func savePlan(uid: String, plan: TrainingPlan) async {
        let data: [String: Any] = [
            "id": plan.id,
            "goal": plan.goal,
            "level": plan.level,
            "totalWeeks": plan.totalWeeks,
            "runsPerWeek": plan.runsPerWeek,
            "isActive": plan.isActive,
            "createdAt": Timestamp(date: plan.createdAt),
            "weeks": plan.weeks.map { encodedWeek($0) },
        ]
        try? await db.collection("users").document(uid)
            .collection("trainingPlans").document(plan.id)
            .setData(data)
    }

    private func encodedWeek(_ w: TrainingWeek) -> [String: Any] {
        [
            "weekNumber": w.weekNumber,
            "targetDistanceKm": w.targetDistanceKm,
            "days": w.days.map { d in
                [
                    "weekNumber": d.weekNumber,
                    "dayOfWeek": d.dayOfWeek,
                    "type": d.type.rawValue,
                    "distanceKm": d.distanceKm,
                    "description": d.description,
                    "isCompleted": d.isCompleted,
                ] as [String: Any]
            },
        ]
    }

    private func decodeplan(from doc: QueryDocumentSnapshot) -> TrainingPlan? {
        let d = doc.data()
        guard let id = d["id"] as? String,
              let goal  = d["goal"]  as? String,
              let level = d["level"] as? String else { return nil }
        let totalWeeks   = (d["totalWeeks"]   as? Int) ?? 12
        let runsPerWeek  = (d["runsPerWeek"]  as? Int) ?? 3
        let isActive     = (d["isActive"]     as? Bool) ?? false
        let createdAt    = (d["createdAt"]    as? Timestamp)?.dateValue() ?? Date()

        let rawWeeks     = (d["weeks"] as? [[String: Any]]) ?? []
        let weeks: [TrainingWeek] = rawWeeks.compactMap { w in
            let wn     = (w["weekNumber"]     as? Int) ?? 0
            let target = (w["targetDistanceKm"] as? Double) ?? 0
            let rawDays = (w["days"] as? [[String: Any]]) ?? []
            let days: [TrainingDay] = rawDays.compactMap { dd in
                guard let dow  = dd["dayOfWeek"] as? String,
                      let typeStr = dd["type"] as? String,
                      let t = RunType(rawValue: typeStr) else { return nil }
                return TrainingDay(
                    weekNumber: (dd["weekNumber"] as? Int) ?? wn,
                    dayOfWeek: dow,
                    type: t,
                    distanceKm: (dd["distanceKm"] as? Double) ?? 0,
                    description: (dd["description"] as? String) ?? "",
                    isCompleted: (dd["isCompleted"] as? Bool) ?? false
                )
            }
            return TrainingWeek(weekNumber: wn, days: days, targetDistanceKm: target)
        }
        return TrainingPlan(id: id, goal: goal, level: level, totalWeeks: totalWeeks,
                            runsPerWeek: runsPerWeek, weeks: weeks, isActive: isActive, createdAt: createdAt)
    }

    private func parseFunctionPlan(data: [String: Any], id: String) -> TrainingPlan {
        // If the Function returns weeks array, parse it; otherwise fall back.
        buildDefaultPlan(id: id)
    }

    private func buildDefaultPlan(id: String) -> TrainingPlan {
        let weeklyDistances = progressiveDistances(weeks: planWeeks, goal: selectedGoal)
        let weeks = weeklyDistances.enumerated().map { (idx, dist) in
            buildWeek(number: idx + 1, weeklyKm: dist)
        }
        return TrainingPlan(id: id, goal: selectedGoal, level: selectedLevel,
                            totalWeeks: planWeeks, runsPerWeek: 3,
                            weeks: weeks, isActive: true, createdAt: Date())
    }

    private func progressiveDistances(weeks: Int, goal: String) -> [Double] {
        let base: Double
        switch goal {
        case "5K":          base = 15
        case "10K":         base = 25
        case "Half Marathon": base = 35
        case "Marathon":    base = 50
        default:            base = 30
        }
        return (1...weeks).map { w in
            let taper = w > Int(Double(weeks) * 0.75)
            return taper ? base * Double(weeks - w + 1) / Double(weeks) * 1.4 : base * (1 + Double(w) * 0.05)
        }
    }

    private func buildWeek(number: Int, weeklyKm: Double) -> TrainingWeek {
        let long  = weeklyKm * 0.40
        let tempo = weeklyKm * 0.30
        let easy  = weeklyKm - long - tempo
        let days: [TrainingDay] = [
            TrainingDay(weekNumber: number, dayOfWeek: "Mon", type: .easy,  distanceKm: easy,  description: "Easy comfortable pace run"),
            TrainingDay(weekNumber: number, dayOfWeek: "Wed", type: .tempo, distanceKm: tempo, description: "Comfortably hard pace"),
            TrainingDay(weekNumber: number, dayOfWeek: "Sat", type: .long,  distanceKm: long,  description: "Long slow distance run"),
        ]
        return TrainingWeek(weekNumber: number, days: days, targetDistanceKm: weeklyKm)
    }
}

// MARK: – Root View

struct TrainingPlanView: View {
    @StateObject private var vm = TrainingPlanViewModel()

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()
            Group {
                if vm.isLoading {
                    ProgressView().tint(RuvoTheme.Colors.primary)
                } else if let plan = vm.activePlan {
                    planContent(plan)
                } else {
                    emptyState
                }
            }
        }
        .sheet(isPresented: $vm.showGenerator) { planGeneratorSheet }
        .task { await vm.load() }
    }

    private func planContent(_ plan: TrainingPlan) -> some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header
                HStack {
                    Text("Training Plan").font(RuvoTheme.Typography.displayMedium).foregroundColor(.white)
                    Spacer()
                    Button { vm.showGenerator = true } label: {
                        Text("New Plan")
                            .font(RuvoTheme.Typography.labelMedium)
                            .foregroundColor(.white)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(RuvoTheme.Colors.surfaceElevated)
                            .clipShape(Capsule())
                    }
                }

                // Plan progress card
                planProgressCard(plan)

                // Current week
                if let currentWeek = plan.weeks.first(where: { week in
                    !week.days.allSatisfy { $0.isCompleted }
                }) {
                    weekSection(currentWeek, title: "This Week")
                }

                // All weeks
                DisclosureGroup("All \(plan.totalWeeks) Weeks") {
                    ForEach(plan.weeks) { week in
                        weekRow(week)
                    }
                }
                .foregroundColor(RuvoTheme.Colors.textSecondary)
                .padding(16)
                .background(RuvoTheme.Colors.surface)
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(RuvoTheme.Colors.border, lineWidth: 1))
            }
            .padding()
        }
    }

    private func planProgressCard(_ plan: TrainingPlan) -> some View {
        let totalDays = plan.weeks.flatMap { $0.days }.count
        let completed = plan.weeks.flatMap { $0.days }.filter { $0.isCompleted }.count
        let progress  = totalDays > 0 ? Double(completed) / Double(totalDays) : 0
        let currentWeek = plan.weeks.firstIndex { !$0.days.allSatisfy { $0.isCompleted } }.map { $0 + 1 } ?? plan.totalWeeks

        return RuvoCard(isHighlighted: true) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(plan.goal + " Plan").font(RuvoTheme.Typography.headingSmall).foregroundColor(RuvoTheme.Colors.primary)
                        Text("Goal: \(plan.goal)").font(RuvoTheme.Typography.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
                    }
                    Spacer()
                    Text("W\(currentWeek)/\(plan.totalWeeks)").font(RuvoTheme.Typography.headingMedium).foregroundColor(.white)
                }
                ProgressView(value: progress)
                    .tint(RuvoTheme.Colors.primary)
                    .background(RuvoTheme.Colors.border)
                    .clipShape(Capsule())
                Text("\(plan.runsPerWeek) runs/week · \(plan.totalWeeks) weeks total")
                    .font(RuvoTheme.Typography.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
            }
            .padding(20)
        }
    }

    private func weekSection(_ week: TrainingWeek, title: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(RuvoTheme.Typography.headingSmall).foregroundColor(.white)
            ForEach(week.days) { day in
                DayCard(day: day) {
                    Task { await vm.markDayCompleted(weekNumber: week.weekNumber, dayId: day.id) }
                }
            }
        }
    }

    private func weekRow(_ week: TrainingWeek) -> some View {
        let done = week.days.filter { $0.isCompleted }.count
        return HStack {
            Text("Week \(week.weekNumber)").font(RuvoTheme.Typography.labelMedium).foregroundColor(.white)
            Spacer()
            Text(String(format: "%.0f km", week.targetDistanceKm)).font(RuvoTheme.Typography.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
            Text("\(done)/\(week.days.count)").font(RuvoTheme.Typography.bodySmall).foregroundColor(RuvoTheme.Colors.primary)
        }
        .padding(.vertical, 6)
    }

    private var emptyState: some View {
        VStack(spacing: 20) {
            Text("🏃").font(.system(size: 64))
            Text("No Training Plan").font(RuvoTheme.Typography.headingMedium).foregroundColor(.white)
            Text("Create an AI-powered plan tailored\nto your goal and fitness level.")
                .font(RuvoTheme.Typography.bodyMedium)
                .foregroundColor(RuvoTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
            Button { vm.showGenerator = true } label: {
                Text("Create Plan")
                    .font(RuvoTheme.Typography.labelLarge)
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity).frame(height: 52)
                    .background(RuvoTheme.Colors.primary)
                    .clipShape(Capsule())
            }
            .padding(.horizontal, 40)
        }
        .padding()
    }

    // MARK: Plan Generator Sheet
    private var planGeneratorSheet: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 24) {
                Text("Create Training Plan").font(RuvoTheme.Typography.headingLarge).foregroundColor(.white)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Goal").font(RuvoTheme.Typography.labelMedium).foregroundColor(RuvoTheme.Colors.textSecondary)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(vm.goals, id: \.self) { goal in
                                Button(goal) { vm.selectedGoal = goal }
                                    .font(RuvoTheme.Typography.labelSmall)
                                    .foregroundColor(vm.selectedGoal == goal ? .black : .white)
                                    .padding(.horizontal, 16).padding(.vertical, 8)
                                    .background(vm.selectedGoal == goal ? RuvoTheme.Colors.primary : RuvoTheme.Colors.surfaceElevated)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Fitness Level").font(RuvoTheme.Typography.labelMedium).foregroundColor(RuvoTheme.Colors.textSecondary)
                    ForEach(vm.levels, id: \.self) { level in
                        Button {
                            vm.selectedLevel = level
                        } label: {
                            HStack {
                                Text(level).font(RuvoTheme.Typography.labelMedium).foregroundColor(.white)
                                Spacer()
                                if vm.selectedLevel == level {
                                    Image(systemName: "checkmark.circle.fill").foregroundColor(RuvoTheme.Colors.primary)
                                }
                            }
                            .padding(14)
                            .background(vm.selectedLevel == level ? RuvoTheme.Colors.limeDim : RuvoTheme.Colors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(
                                vm.selectedLevel == level ? RuvoTheme.Colors.primary.opacity(0.4) : RuvoTheme.Colors.border, lineWidth: 1))
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Duration: \(vm.planWeeks) weeks").font(RuvoTheme.Typography.labelMedium).foregroundColor(RuvoTheme.Colors.textSecondary)
                    Slider(value: Binding(get: { Double(vm.planWeeks) }, set: { vm.planWeeks = Int($0) }),
                           in: 4...24, step: 1)
                        .tint(RuvoTheme.Colors.primary)
                }

                Spacer()

                Button {
                    Task { await vm.generateAIPlan() }
                } label: {
                    Group {
                        if vm.isGenerating {
                            ProgressView().tint(.black)
                        } else {
                            Text("Generate AI Plan 🤖")
                        }
                    }
                    .font(RuvoTheme.Typography.labelLarge)
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity).frame(height: 52)
                    .background(RuvoTheme.Colors.primary)
                    .clipShape(Capsule())
                }
                .disabled(vm.isGenerating)
            }
            .padding()
        }
    }
}

// MARK: – DayCard

private struct DayCard: View {
    let day: TrainingDay
    let onMarkComplete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Text(String(day.dayOfWeek.prefix(3)))
                .font(RuvoTheme.Typography.bodySmall)
                .foregroundColor(RuvoTheme.Colors.textTertiary)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 4) {
                    Text(day.type.emoji)
                    Text(day.type.rawValue.capitalized)
                        .font(RuvoTheme.Typography.labelMedium)
                        .foregroundColor(day.type == .rest ? RuvoTheme.Colors.textTertiary : day.type.color)
                }
                Text(day.description)
                    .font(RuvoTheme.Typography.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
            }
            Spacer()
            if day.type != .rest {
                Text(String(format: "%.1f km", day.distanceKm))
                    .font(RuvoTheme.Typography.labelSmall)
                    .foregroundColor(.white)
            }
            Button {
                if !day.isCompleted { onMarkComplete() }
            } label: {
                Image(systemName: day.isCompleted ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(day.isCompleted ? RuvoTheme.Colors.primary : RuvoTheme.Colors.textTertiary)
                    .font(.title3)
            }
        }
        .padding(14)
        .background(day.isCompleted ? RuvoTheme.Colors.limeDim : RuvoTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(
            day.isCompleted ? RuvoTheme.Colors.primary.opacity(0.3) : RuvoTheme.Colors.border, lineWidth: 1))
    }
}
