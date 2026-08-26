package com.ruvo.app.features.healthintegrations

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregationResultGroupedByPeriod
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.time.Instant
import java.time.LocalDateTime
import java.time.Period
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HealthConnectManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val client by lazy { HealthConnectClient.getOrCreate(context) }

    // Read-only permissions this screen actually has fetch methods for below.
    // Write permissions for ExerciseSessionRecord/DistanceRecord were requested
    // here previously for saveRunSession(), but that method has zero call sites
    // anywhere in the app (grep-confirmed 2026-08-26) — dropped from the
    // requested set so users aren't asked to grant write access this screen
    // never uses. (RunTrackingService owns the real write path via the separate
    // runtracking/HealthConnectManager.kt.)
    val requiredPermissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
    )

    private val _healthData = MutableStateFlow(HealthSummary())
    val healthData: StateFlow<HealthSummary> = _healthData

    fun isAvailable(): Boolean {
        return HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
    }

    suspend fun checkPermissions(): Set<String> {
        return client.permissionController.getGrantedPermissions()
    }

    suspend fun hasAllPermissions(): Boolean =
        try { checkPermissions().containsAll(requiredPermissions) } catch (_: Exception) { false }

    suspend fun loadTodayStats() {
        val now = Instant.now()
        val startOfDay = ZonedDateTime.now().truncatedTo(ChronoUnit.DAYS).toInstant()
        val timeRange = TimeRangeFilter.between(startOfDay, now)

        val steps = fetchSteps(timeRange = timeRange)
        val heartRate = fetchLatestHeartRate()
        val sleep = fetchSleepHours()

        _healthData.value = HealthSummary(
            stepCount = steps,
            latestHeartRate = heartRate,
            sleepHours = sleep,
        )
    }

    suspend fun fetchSteps(timeRange: TimeRangeFilter? = null): Int {
        val range = timeRange ?: TimeRangeFilter.between(
            ZonedDateTime.now().truncatedTo(ChronoUnit.DAYS).toInstant(), Instant.now()
        )
        return try {
            val request = ReadRecordsRequest(StepsRecord::class, range)
            val response = client.readRecords(request)
            response.records.sumOf { it.count }.toInt()
        } catch (e: Exception) { 0 }
    }

    suspend fun fetchLatestHeartRate(): Int {
        return try {
            val timeRange = TimeRangeFilter.between(
                Instant.now().minus(24, ChronoUnit.HOURS),
                Instant.now()
            )
            val request = ReadRecordsRequest(HeartRateRecord::class, timeRange, pageSize = 1)
            val response = client.readRecords(request)
            response.records.lastOrNull()?.samples?.lastOrNull()?.beatsPerMinute?.toInt() ?: 0
        } catch (e: Exception) { 0 }
    }

    suspend fun fetchSleepHours(): Double {
        return try {
            val timeRange = TimeRangeFilter.between(
                Instant.now().minus(36, ChronoUnit.HOURS),
                Instant.now()
            )
            val request = ReadRecordsRequest(SleepSessionRecord::class, timeRange)
            val response = client.readRecords(request)
            val totalMillis = response.records.sumOf {
                it.endTime.toEpochMilli() - it.startTime.toEpochMilli()
            }
            totalMillis / 3_600_000.0
        } catch (e: Exception) { 0.0 }
    }

    suspend fun fetchTodayCalories(): Int {
        return try {
            val timeRange = TimeRangeFilter.between(
                ZonedDateTime.now().truncatedTo(ChronoUnit.DAYS).toInstant(), Instant.now()
            )
            val result = client.aggregate(
                AggregateRequest(
                    metrics = setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),
                    timeRangeFilter = timeRange,
                )
            )
            (result[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories ?: 0.0).toInt()
        } catch (e: Exception) { 0 }
    }

    suspend fun fetchRestingHeartRate(): Int {
        return try {
            val timeRange = TimeRangeFilter.between(
                Instant.now().minus(7, ChronoUnit.DAYS), Instant.now()
            )
            val request = ReadRecordsRequest(RestingHeartRateRecord::class, timeRange, pageSize = 1)
            val response = client.readRecords(request)
            response.records.lastOrNull()?.beatsPerMinute?.toInt() ?: 0
        } catch (e: Exception) { 0 }
    }

    // "Max (run)" — the highest HR sample recorded during a running
    // ExerciseSessionRecord in the last 30 days, not just any HR sample (that's
    // what fetchLatestHeartRate() already covers). Requires cross-referencing
    // exercise session windows against HR samples since Health Connect doesn't
    // expose a single "max HR during exercise" aggregate.
    suspend fun fetchMaxRunHeartRate(): Int {
        return try {
            val timeRange = TimeRangeFilter.between(
                Instant.now().minus(30, ChronoUnit.DAYS), Instant.now()
            )
            val sessions = client.readRecords(
                ReadRecordsRequest(ExerciseSessionRecord::class, timeRange)
            ).records.filter { it.exerciseType == ExerciseSessionRecord.EXERCISE_TYPE_RUNNING }
            if (sessions.isEmpty()) return 0
            sessions.maxOf { session ->
                val hrRange = TimeRangeFilter.between(session.startTime, session.endTime)
                val hrRecords = client.readRecords(
                    ReadRecordsRequest(HeartRateRecord::class, hrRange)
                ).records
                hrRecords.flatMap { it.samples }.maxOfOrNull { it.beatsPerMinute }?.toInt() ?: 0
            }
        } catch (e: Exception) { 0 }
    }

    data class WeeklyStepsSummary(val totalSteps: Int, val activeDays: Int)

    // Buckets StepsRecord by calendar day over the trailing 7 days in a single
    // aggregate call — gives both the weekly total and how many of those days
    // had any recorded steps (the "Active Days" card), instead of firing 7
    // separate per-day requests.
    suspend fun fetchWeeklyStepsSummary(): WeeklyStepsSummary {
        return try {
            val end = LocalDateTime.now()
            val start = end.minusDays(7)
            val buckets: List<AggregationResultGroupedByPeriod> = client.aggregateGroupByPeriod(
                AggregateGroupByPeriodRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(start, end),
                    timeRangeSlicer = Period.ofDays(1),
                )
            )
            val perDay = buckets.map { (it.result[StepsRecord.COUNT_TOTAL] ?: 0L).toInt() }
            WeeklyStepsSummary(
                totalSteps = perDay.sum(),
                activeDays = perDay.count { it > 0 },
            )
        } catch (e: Exception) { WeeklyStepsSummary(0, 0) }
    }
}

data class HealthSummary(
    val stepCount: Int = 0,
    val latestHeartRate: Int = 0,
    val sleepHours: Double = 0.0,
    val vo2Max: Double = 0.0,
    val restingHeartRate: Int = 0,
)
