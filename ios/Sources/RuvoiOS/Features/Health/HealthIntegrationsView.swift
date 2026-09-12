import SwiftUI
import FirebaseAuth
import FirebaseFirestore
import HealthKit

// MARK: – View Model

@MainActor
final class HealthIntegrationsViewModel: ObservableObject {
    @Published var todaySteps: Int = 0
    @Published var currentHR: Int = 0
    @Published var restingHR: Int = 0
    @Published var sleepHours: Double = 0
    @Published var todayCalories: Int = 0
    @Published var vo2max: Double = 0
    @Published var isHealthKitAuthorized = false

    @Published var isOuraConnected = false
    @Published var ouraReadiness: Int = 0
    @Published var ouraSleepScore: Int = 0
    @Published var ouraActivity: Int = 0
    @Published var ouraHrv: Int = 0

    @Published var isWhoopConnected = false
    @Published var whoopRecovery: Int = 0
    @Published var whoopStrain: Double = 0
    @Published var whoopSleepScore: Int = 0

    private let store = HKHealthStore()
    private let db   = Firestore.firestore()

    func refresh() async {
        async let hk: () = loadHealthKit()
        async let oauth: () = loadOAuthStatus()
        _ = await (hk, oauth)
    }

    func requestHealthKitAccess() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let types: Set<HKObjectType> = [
            HKQuantityType(.stepCount),
            HKQuantityType(.heartRate),
            HKQuantityType(.restingHeartRate),
            HKQuantityType(.vo2Max),
            HKQuantityType(.activeEnergyBurned),
            HKCategoryType(.sleepAnalysis),
        ]
        try? await store.requestAuthorization(toShare: [], read: types)
        await loadHealthKit()
    }

    // MARK: HealthKit queries
    private func loadHealthKit() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        isHealthKitAuthorized = true

        async let steps  = fetchSum(type: .stepCount,          unit: .count(), days: 1)
        async let cal    = fetchSum(type: .activeEnergyBurned, unit: .kilocalorie(), days: 1)
        async let vo2    = fetchLatest(type: .vo2Max,          unit: HKUnit(from: "ml/kg/min"))
        async let hr     = fetchLatest(type: .heartRate,       unit: HKUnit(from: "count/min"))
        async let rhr    = fetchLatest(type: .restingHeartRate,unit: HKUnit(from: "count/min"))
        async let sleep  = fetchSleepHours()

        todaySteps    = Int(await steps)
        todayCalories = Int(await cal)
        vo2max        = await vo2
        currentHR     = Int(await hr)
        restingHR     = Int(await rhr)
        sleepHours    = await sleep
    }

    private func fetchSum(type: HKQuantityTypeIdentifier, unit: HKUnit, days: Int) async -> Double {
        let quantityType = HKQuantityType(type)
        let now  = Date()
        let from = Calendar.current.date(byAdding: .day, value: -days, to: now) ?? now
        let pred = HKQuery.predicateForSamples(withStart: from, end: now)
        return await withCheckedContinuation { cont in
            let q = HKStatisticsQuery(quantityType: quantityType, quantitySamplePredicate: pred, options: .cumulativeSum) { _, result, _ in
                cont.resume(returning: result?.sumQuantity()?.doubleValue(for: unit) ?? 0)
            }
            store.execute(q)
        }
    }

    private func fetchLatest(type: HKQuantityTypeIdentifier, unit: HKUnit) async -> Double {
        let quantityType = HKQuantityType(type)
        return await withCheckedContinuation { cont in
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            let q = HKSampleQuery(sampleType: quantityType, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
                let v = (samples?.first as? HKQuantitySample)?.quantity.doubleValue(for: unit) ?? 0
                cont.resume(returning: v)
            }
            store.execute(q)
        }
    }

    private func fetchSleepHours() async -> Double {
        let sleepType = HKCategoryType(.sleepAnalysis)
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date()) ?? Date()
        let noon      = Calendar.current.date(bySettingHour: 12, minute: 0, second: 0, of: Date()) ?? Date()
        let pred      = HKQuery.predicateForSamples(withStart: yesterday, end: noon)
        return await withCheckedContinuation { cont in
            let q = HKSampleQuery(sampleType: sleepType, predicate: pred, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                let hours = (samples as? [HKCategorySample])?.filter {
                    $0.value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue
                }.reduce(0.0) { $0 + $1.endDate.timeIntervalSince($1.startDate) / 3600 } ?? 0
                cont.resume(returning: hours)
            }
            store.execute(q)
        }
    }

    // MARK: Firestore OAuth status
    private func loadOAuthStatus() async {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        guard let data = try? await db.collection("users").document(uid)
            .collection("integrations").document("oauth").getDocument().data() else { return }

        isOuraConnected  = (data["oura_access_token"]  as? String)?.isEmpty == false
        isWhoopConnected = (data["whoop_access_token"] as? String)?.isEmpty == false
        ouraReadiness    = (data["oura_readiness"]      as? Int) ?? 0
        ouraSleepScore   = (data["oura_sleep_score"]    as? Int) ?? 0
        ouraActivity     = (data["oura_activity_score"] as? Int) ?? 0
        ouraHrv          = (data["oura_hrv"]            as? Int) ?? 0
        whoopRecovery    = (data["whoop_recovery"]       as? Int) ?? 0
        whoopStrain      = (data["whoop_strain"]         as? Double) ?? 0
        whoopSleepScore  = (data["whoop_sleep_score"]   as? Int) ?? 0
    }

    func connectOura() {
        let clientId = Bundle.main.object(forInfoDictionaryKey: "OURA_CLIENT_ID") as? String ?? ""
        let redirect = "com.ruvo.app://oauth/oura"
        let scopes   = "daily heartrate workout personal session"
        guard var comps = URLComponents(string: "https://cloud.ouraring.com/oauth/authorize") else { return }
        comps.queryItems = [
            .init(name: "response_type", value: "code"),
            .init(name: "client_id",     value: clientId),
            .init(name: "redirect_uri",  value: redirect),
            .init(name: "scope",         value: scopes),
        ]
        if let url = comps.url { UIApplication.shared.open(url) }
    }

    func connectWhoop() {
        let clientId = Bundle.main.object(forInfoDictionaryKey: "WHOOP_CLIENT_ID") as? String ?? ""
        let redirect = "com.ruvo.app://oauth/whoop"
        let scopes   = "read:recovery read:cycles read:sleep read:workout offline"
        guard var comps = URLComponents(string: "https://api.prod.whoop.com/oauth/oauth2/auth") else { return }
        comps.queryItems = [
            .init(name: "response_type", value: "code"),
            .init(name: "client_id",     value: clientId),
            .init(name: "redirect_uri",  value: redirect),
            .init(name: "scope",         value: scopes),
        ]
        if let url = comps.url { UIApplication.shared.open(url) }
    }
}

// MARK: – Root View

struct HealthIntegrationsView: View {
    @StateObject private var vm = HealthIntegrationsViewModel()

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 20) {
                    headerText
                    todayCard
                    connectedServicesSection
                    if vm.isOuraConnected  { ouraSection  }
                    if vm.isWhoopConnected { whoopSection }
                }
                .padding()
            }
        }
        .task { await vm.refresh() }
    }

    private var headerText: some View {
        HStack {
            Text("Health").font(RuvoTheme.Typography.displayMedium).tracking(RuvoTheme.Typography.Tracking.displayMedium).foregroundColor(.white)
            Spacer()
        }
    }

    // MARK: Today Overview Card
    private var todayCard: some View {
        RuvoCard(isHighlighted: true) {
            VStack(spacing: 16) {
                Text("Today's Overview")
                    .font(RuvoTheme.Typography.labelLarge)
                    .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                    .foregroundColor(RuvoTheme.Colors.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 0) {
                    HealthMetricCell(icon: "figure.walk", label: "Steps", value: "\(vm.todaySteps)", tint: RuvoTheme.Colors.primary)
                    HealthMetricCell(icon: "heart.fill", label: "Heart Rate", value: "\(vm.currentHR) bpm", tint: .red)
                    HealthMetricCell(icon: "flame.fill", label: "Calories", value: "\(vm.todayCalories)", tint: .orange)
                }
                Divider().background(RuvoTheme.Colors.border)
                HStack(spacing: 0) {
                    HealthMetricCell(icon: "moon.fill", label: "Sleep", value: String(format: "%.1fh", vm.sleepHours), tint: .purple)
                    HealthMetricCell(icon: "heart.text.square", label: "Resting HR", value: "\(vm.restingHR) bpm", tint: .teal)
                    HealthMetricCell(icon: "bolt.fill", label: "VO₂ Max", value: String(format: "%.1f", vm.vo2max), tint: RuvoTheme.Colors.primary)
                }
            }
            .padding(20)
        }
    }

    // MARK: Connected Services
    private var connectedServicesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Connected Services").font(RuvoTheme.Typography.headingSmall).tracking(RuvoTheme.Typography.Tracking.headingSmall).foregroundColor(.white)
            ServiceCard(
                icon: "heart.fill",
                title: "Apple Health",
                subtitle: "Steps, heart rate, sleep, workouts",
                isConnected: vm.isHealthKitAuthorized,
                onConnect: { Task { await vm.requestHealthKitAccess() } }
            )
            ServiceCard(
                icon: "circle.fill",
                title: "Oura Ring",
                subtitle: "Sleep score, readiness, HRV",
                isConnected: vm.isOuraConnected,
                onConnect: { vm.connectOura() }
            )
            ServiceCard(
                icon: "waveform.path.ecg",
                title: "WHOOP",
                subtitle: "Recovery, strain, sleep performance",
                isConnected: vm.isWhoopConnected,
                onConnect: { vm.connectWhoop() }
            )
        }
    }

    // MARK: Oura Section
    private var ouraSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Oura Ring").font(RuvoTheme.Typography.headingSmall).tracking(RuvoTheme.Typography.Tracking.headingSmall).foregroundColor(.white)
                Text("💍 Synced").font(RuvoTheme.Typography.bodySmall).tracking(RuvoTheme.Typography.Tracking.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
            }
            HStack(spacing: 12) {
                RingScoreCard(label: "Readiness", value: vm.ouraReadiness, tint: .green)
                RingScoreCard(label: "Sleep",     value: vm.ouraSleepScore, tint: .purple)
                RingScoreCard(label: "Activity",  value: vm.ouraActivity,   tint: RuvoTheme.Colors.primary)
            }
            RuvoCard {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("HRV").font(RuvoTheme.Typography.labelMedium).tracking(RuvoTheme.Typography.Tracking.labelMedium).foregroundColor(RuvoTheme.Colors.textSecondary)
                        Text("\(vm.ouraHrv) ms").font(RuvoTheme.Typography.headingMedium).tracking(RuvoTheme.Typography.Tracking.headingMedium).foregroundColor(.white)
                    }
                    Spacer()
                    Image(systemName: "waveform.path.ecg").foregroundColor(.teal).font(.title2)
                }
                .padding(16)
            }
        }
    }

    // MARK: WHOOP Section
    private var whoopSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("WHOOP").font(RuvoTheme.Typography.headingSmall).tracking(RuvoTheme.Typography.Tracking.headingSmall).foregroundColor(.white)
                Text("⚡ Synced").font(RuvoTheme.Typography.bodySmall).tracking(RuvoTheme.Typography.Tracking.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
            }
            HStack(spacing: 12) {
                RingScoreCard(label: "Recovery", value: vm.whoopRecovery,   tint: .green)
                RingScoreCard(label: "Strain",   value: Int(vm.whoopStrain * 100 / 21), tint: .red)
                RingScoreCard(label: "Sleep",    value: vm.whoopSleepScore, tint: .purple)
            }
        }
    }
}

// MARK: – Sub-components

private struct HealthMetricCell: View {
    let icon: String; let label: String; let value: String; let tint: Color
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon).foregroundColor(tint).font(.title3)
            Text(value).font(RuvoTheme.Typography.headingSmall).tracking(RuvoTheme.Typography.Tracking.headingSmall).foregroundColor(.white)
            Text(label).font(RuvoTheme.Typography.bodySmall).tracking(RuvoTheme.Typography.Tracking.bodySmall).foregroundColor(RuvoTheme.Colors.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct ServiceCard: View {
    let icon: String; let title: String; let subtitle: String
    let isConnected: Bool; let onConnect: () -> Void
    var body: some View {
        RuvoCard(isHighlighted: isConnected) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(isConnected ? RuvoTheme.Colors.primaryDim : RuvoTheme.Colors.surfaceElevated)
                        .frame(width: 48, height: 48)
                    Image(systemName: icon)
                        .foregroundColor(isConnected ? RuvoTheme.Colors.primary : RuvoTheme.Colors.textSecondary)
                        .font(.title3)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(RuvoTheme.Typography.labelLarge).tracking(RuvoTheme.Typography.Tracking.labelLarge).foregroundColor(.white)
                    Text(subtitle).font(RuvoTheme.Typography.bodySmall).tracking(RuvoTheme.Typography.Tracking.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
                }
                Spacer()
                if isConnected {
                    RuvoChip(label: "Connected", color: RuvoTheme.Colors.primary, isActive: true)
                } else {
                    Button("Connect") { onConnect() }
                        .font(RuvoTheme.Typography.labelMedium)
                        .tracking(RuvoTheme.Typography.Tracking.labelMedium)
                        .foregroundColor(.white)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(RuvoTheme.Colors.surfaceElevated)
                        .clipShape(Capsule())
                }
            }
            .padding(16)
        }
    }
}

private struct RingScoreCard: View {
    let label: String; let value: Int; let tint: Color
    var body: some View {
        RuvoCard {
            VStack(spacing: 8) {
                ZStack {
                    Circle().stroke(RuvoTheme.Colors.border, lineWidth: 6)
                    Circle()
                        .trim(from: 0, to: CGFloat(value) / 100)
                        .stroke(tint, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        // Ring fills in rather than snapping to its value -- a settled
                        // entrance curve reads as data "arriving," not just appearing.
                        .animation(RuvoTheme.Motion.springSettled(duration: RuvoTheme.Motion.Duration.entrance), value: value)
                    Text("\(value)")
                        .font(RuvoTheme.Typography.headingSmall)
                        .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                        .foregroundColor(tint)
                }
                .frame(width: 64, height: 64)
                Text(label)
                    .font(RuvoTheme.Typography.bodySmall)
                    .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
            }
            .padding(12)
            .frame(maxWidth: .infinity)
        }
    }
}
