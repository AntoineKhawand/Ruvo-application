package com.ruvo.app.features.healthintegrations

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.time.Instant
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HealthConnectManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val client by lazy { HealthConnectClient.getOrCreate(context) }

    val requiredPermissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getWritePermission(ExerciseSessionRecord::class),
        HealthPermission.getWritePermission(DistanceRecord::class),
    )

    private val _healthData = MutableStateFlow(HealthSummary())
    val healthData: StateFlow<HealthSummary> = _healthData

    fun isAvailable(): Boolean {
        return HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
    }

    suspend fun requestPermissions() {
        // Permissions must be requested from an Activity via contract; here we just check
    }

    suspend fun checkPermissions(): Set<String> {
        return client.permissionController.getGrantedPermissions()
    }

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

    suspend fun saveRunSession(startTime: Instant, endTime: Instant, distanceMeters: Double, calories: Double) {
        try {
            val exercise = ExerciseSessionRecord(
                startTime = startTime,
                startZoneOffset = null,
                endTime = endTime,
                endZoneOffset = null,
                exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_RUNNING,
            )
            val distance = DistanceRecord(
                startTime = startTime,
                startZoneOffset = null,
                endTime = endTime,
                endZoneOffset = null,
                distance = androidx.health.connect.client.units.Length.meters(distanceMeters)
            )
            client.insertRecords(listOf(exercise, distance))
        } catch (e: Exception) {
            android.util.Log.e("HealthConnect", "Failed to save run session: ${e.message}")
        }
    }
}

data class HealthSummary(
    val stepCount: Int = 0,
    val latestHeartRate: Int = 0,
    val sleepHours: Double = 0.0,
    val vo2Max: Double = 0.0,
    val restingHeartRate: Int = 0,
)
