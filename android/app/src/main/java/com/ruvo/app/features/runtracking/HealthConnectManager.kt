package com.ruvo.app.features.runtracking

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HealthConnectManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val client: HealthConnectClient? by lazy {
        runCatching { HealthConnectClient.getOrCreate(context) }.getOrNull()
    }

    val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
    )

    fun isAvailable(): Boolean =
        HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE

    suspend fun requestPermissions(): Set<String> = withContext(Dispatchers.IO) {
        val c = client ?: return@withContext emptySet()
        runCatching { c.permissionController.getGrantedPermissions() }.getOrElse { emptySet() }
    }

    suspend fun hasPermissions(): Boolean {
        val c = client ?: return false
        return runCatching {
            c.permissionController.getGrantedPermissions().containsAll(permissions)
        }.getOrElse { false }
    }

    suspend fun fetchSteps(days: Int = 1): Long = withContext(Dispatchers.IO) {
        val c = client ?: return@withContext 0L
        val end = Instant.now()
        val start = end.minusSeconds(days * 86400L)
        runCatching {
            val result = c.aggregate(
                AggregateRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(start, end),
                )
            )
            result[StepsRecord.COUNT_TOTAL] ?: 0L
        }.getOrElse { 0L }
    }

    suspend fun fetchLatestHeartRate(): Long = withContext(Dispatchers.IO) {
        val c = client ?: return@withContext 0L
        val end = Instant.now()
        val start = end.minusSeconds(3600)
        runCatching {
            val result = c.readRecords(
                ReadRecordsRequest(
                    recordType = HeartRateRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(start, end),
                )
            )
            result.records.lastOrNull()?.samples?.lastOrNull()?.beatsPerMinute ?: 0L
        }.getOrElse { 0L }
    }

    suspend fun fetchSleepHours(): Double = withContext(Dispatchers.IO) {
        val c = client ?: return@withContext 0.0
        val today = LocalDate.now(ZoneId.systemDefault())
        val start = today.minusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant()
        val end = today.atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant()
        runCatching {
            val result = c.readRecords(
                ReadRecordsRequest(
                    recordType = SleepSessionRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(start, end),
                )
            )
            result.records.sumOf { session ->
                val dur = session.endTime.epochSecond - session.startTime.epochSecond
                dur / 3600.0
            }
        }.getOrElse { 0.0 }
    }

    suspend fun fetchTodayCalories(): Int = withContext(Dispatchers.IO) {
        val c = client ?: return@withContext 0
        val today = LocalDate.now(ZoneId.systemDefault())
        val start = today.atStartOfDay(ZoneId.systemDefault()).toInstant()
        val end = Instant.now()
        runCatching {
            val result = c.aggregate(
                AggregateRequest(
                    metrics = setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(start, end),
                )
            )
            (result[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories ?: 0.0).toInt()
        }.getOrElse { 0 }
    }

    suspend fun saveRunSession(
        startEpochMs: Long,
        endEpochMs: Long,
        title: String = "Ruvo Run",
    ) = withContext(Dispatchers.IO) {
        val c = client ?: return@withContext
        runCatching {
            c.insertRecords(listOf(
                ExerciseSessionRecord(
                    startTime = Instant.ofEpochMilli(startEpochMs),
                    startZoneOffset = java.time.ZoneOffset.UTC,
                    endTime = Instant.ofEpochMilli(endEpochMs),
                    endZoneOffset = java.time.ZoneOffset.UTC,
                    exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_RUNNING,
                    title = title,
                )
            ))
        }
    }
}
