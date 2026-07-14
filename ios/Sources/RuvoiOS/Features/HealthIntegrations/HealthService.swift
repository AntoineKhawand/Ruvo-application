import Foundation
import HealthKit
import Combine

@MainActor
final class HealthService: ObservableObject {
    @Published private(set) var isAuthorized = false
    @Published private(set) var stepCount: Int = 0
    @Published private(set) var heartRate: Double = 0
    @Published private(set) var sleepHours: Double = 0
    @Published private(set) var vo2max: Double = 0
    @Published private(set) var restingHeartRate: Double = 0

    private let store = HKHealthStore()

    private let readTypes: Set<HKObjectType> = [
        HKQuantityType(.stepCount),
        HKQuantityType(.heartRate),
        HKQuantityType(.restingHeartRate),
        HKQuantityType(.vo2Max),
        HKQuantityType(.activeEnergyBurned),
        HKQuantityType(.distanceWalkingRunning),
        HKCategoryType(.sleepAnalysis),
    ]

    private let writeTypes: Set<HKSampleType> = [
        HKQuantityType(.distanceWalkingRunning),
        HKQuantityType(.activeEnergyBurned),
        HKWorkoutType.workoutType(),
    ]

    func requestAuthorization() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        do {
            try await store.requestAuthorization(toShare: writeTypes, read: readTypes)
            isAuthorized = true
            await loadTodayStats()
        } catch {
            print("[HealthService] Auth error: \(error)")
        }
    }

    func loadTodayStats() async {
        async let steps = fetchSteps()
        async let hr = fetchLatestHeartRate()
        async let sleep = fetchSleepHours()
        async let vo2 = fetchVO2Max()
        async let rhr = fetchRestingHeartRate()

        let (s, h, sl, v, r) = await (steps, hr, sleep, vo2, rhr)
        stepCount = s
        heartRate = h
        sleepHours = sl
        vo2max = v
        restingHeartRate = r
    }

    private func fetchSteps() async -> Int {
        await withCheckedContinuation { continuation in
            let type = HKQuantityType(.stepCount)
            let start = Calendar.current.startOfDay(for: Date())
            let predicate = HKQuery.predicateForSamples(withStart: start, end: Date())
            let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, stats, _ in
                let count = Int(stats?.sumQuantity()?.doubleValue(for: .count()) ?? 0)
                continuation.resume(returning: count)
            }
            store.execute(query)
        }
    }

    private func fetchLatestHeartRate() async -> Double {
        await withCheckedContinuation { continuation in
            let type = HKQuantityType(.heartRate)
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
                let bpm = (samples?.first as? HKQuantitySample)?
                    .quantity.doubleValue(for: HKUnit(from: "count/min")) ?? 0
                continuation.resume(returning: bpm)
            }
            store.execute(query)
        }
    }

    private func fetchSleepHours() async -> Double {
        await withCheckedContinuation { continuation in
            let type = HKCategoryType(.sleepAnalysis)
            let start = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
            let predicate = HKQuery.predicateForSamples(withStart: start, end: Date())
            let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                let totalSeconds = (samples as? [HKCategorySample])?
                    .filter { $0.value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue ||
                              $0.value == HKCategoryValueSleepAnalysis.asleepCore.rawValue }
                    .reduce(0) { $0 + $1.endDate.timeIntervalSince($1.startDate) } ?? 0
                continuation.resume(returning: totalSeconds / 3600)
            }
            store.execute(query)
        }
    }

    private func fetchVO2Max() async -> Double {
        await withCheckedContinuation { continuation in
            let type = HKQuantityType(.vo2Max)
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
                let value = (samples?.first as? HKQuantitySample)?
                    .quantity.doubleValue(for: HKUnit(from: "ml/kg*min")) ?? 0
                continuation.resume(returning: value)
            }
            store.execute(query)
        }
    }

    private func fetchRestingHeartRate() async -> Double {
        await withCheckedContinuation { continuation in
            let type = HKQuantityType(.restingHeartRate)
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
                let bpm = (samples?.first as? HKQuantitySample)?
                    .quantity.doubleValue(for: HKUnit(from: "count/min")) ?? 0
                continuation.resume(returning: bpm)
            }
            store.execute(query)
        }
    }

    // MARK: – Write workout to HealthKit after a run
    func saveRun(distanceKm: Double, durationSeconds: Int, calories: Int, startDate: Date) async throws {
        let workout = HKWorkout(
            activityType: .running,
            start: startDate,
            end: Date(),
            duration: TimeInterval(durationSeconds),
            totalEnergyBurned: HKQuantity(unit: .kilocalorie(), doubleValue: Double(calories)),
            totalDistance: HKQuantity(unit: .meter(), doubleValue: distanceKm * 1000),
            device: nil,
            metadata: nil
        )
        try await store.save(workout)
    }
}
