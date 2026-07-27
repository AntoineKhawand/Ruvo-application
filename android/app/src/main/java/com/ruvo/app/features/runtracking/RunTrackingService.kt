package com.ruvo.app.features.runtracking

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Binder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.GeoPoint
import com.ruvo.app.MainActivity
import com.ruvo.app.R
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import javax.inject.Inject
import android.location.Location
import kotlin.math.*

private const val NOTIFICATION_CHANNEL_ID = "run_tracking"
private const val NOTIFICATION_ID = 1001
private const val LOCATION_INTERVAL_MS = 2000L
private const val LOCATION_FASTEST_INTERVAL_MS = 1000L
private const val MIN_DISTANCE_METERS = 5f
// RN: points implying >25 km/h (GPS glitch / vehicle) update the map dot only and
// never enter the route/distance/calorie calculation. See RN_SOURCE_ARCHIVE.md §1.
private const val MAX_RUNNING_SPEED_MS = 25.0 / 3.6
// RN: altitude noise threshold — only accumulate elevation gain past this delta.
private const val ELEVATION_NOISE_THRESHOLD_M = 1.5

@AndroidEntryPoint
class RunTrackingService : Service() {

    @Inject lateinit var firestore: FirebaseFirestore

    private val binder = LocalBinder()
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback

    // Exposed state flows (collected by ViewModel)
    private val _location = MutableStateFlow<Location?>(null)
    val location: StateFlow<Location?> = _location.asStateFlow()

    private val _distanceMeters = MutableStateFlow(0.0)
    val distanceMeters: StateFlow<Double> = _distanceMeters.asStateFlow()

    private val _currentPaceMinPerKm = MutableStateFlow(0.0)
    val currentPaceMinPerKm: StateFlow<Double> = _currentPaceMinPerKm.asStateFlow()

    private val _elapsedSeconds = MutableStateFlow(0)
    val elapsedSeconds: StateFlow<Int> = _elapsedSeconds.asStateFlow()

    private val _routePoints = MutableStateFlow<List<android.graphics.PointF>>(emptyList())
    val routeCoordinates = MutableStateFlow<List<Pair<Double, Double>>>(emptyList())

    private val _elevationGainMeters = MutableStateFlow(0.0)
    val elevationGainMeters: StateFlow<Double> = _elevationGainMeters.asStateFlow()

    private var lastLocation: Location? = null
    private var lastAcceptedAltitude: Double? = null
    private var timerJob: Job? = null
    private var liveSharingRunId: String? = null
    private var isPaused = false

    inner class LocalBinder : Binder() {
        fun getService(): RunTrackingService = this@RunTrackingService
    }

    override fun onBind(intent: Intent): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        setupLocationCallback()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground()
        startLocationUpdates()
        startTimer()
        return START_STICKY
    }

    private fun setupLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { processLocation(it) }
            }
        }
    }

    @Suppress("MissingPermission")
    private fun startLocationUpdates() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, LOCATION_INTERVAL_MS)
            .setMinUpdateIntervalMillis(LOCATION_FASTEST_INTERVAL_MS)
            .setMinUpdateDistanceMeters(MIN_DISTANCE_METERS)
            .build()
        fusedLocationClient.requestLocationUpdates(request, locationCallback, mainLooper)
    }

    private fun processLocation(newLocation: Location) {
        if (newLocation.accuracy > 50f) return  // ignore inaccurate fixes

        // Map dot always follows the raw fix, even points we reject below.
        _location.value = newLocation

        val last = lastLocation
        if (last == null) {
            lastLocation = newLocation
            lastAcceptedAltitude = if (newLocation.hasAltitude()) newLocation.altitude else null
            appendRoutePoint(newLocation)
            return
        }

        val delta = last.distanceTo(newLocation)
        if (delta < MIN_DISTANCE_METERS) return // jitter while stationary

        val elapsedSec = (newLocation.time - last.time) / 1000.0
        // RN: reject points implying >25 km/h. The GPS-reported speed and the
        // distance/time "implied speed" are checked independently — a reported speed
        // of 0 on a large single-jump teleport (common for injected/simulated fixes,
        // and possible after a real GPS dropout+reacquire) must NOT bypass the
        // implied-speed check just because hasSpeed() happened to be true.
        val impliedSpeedMs = if (elapsedSec > 0) delta / elapsedSec else 0.0
        val reportedSpeedMs = if (newLocation.hasSpeed()) newLocation.speed.toDouble() else 0.0
        if (impliedSpeedMs > MAX_RUNNING_SPEED_MS || reportedSpeedMs > MAX_RUNNING_SPEED_MS) return

        _distanceMeters.value += delta
        updatePace(last, newLocation)
        updateElevation(newLocation)
        lastLocation = newLocation
        appendRoutePoint(newLocation)

        pushLiveLocation()
    }

    private fun appendRoutePoint(location: Location) {
        val coords = routeCoordinates.value.toMutableList()
        coords.add(Pair(location.latitude, location.longitude))
        routeCoordinates.value = coords
    }

    private fun updateElevation(newLocation: Location) {
        if (!newLocation.hasAltitude()) return
        val baseline = lastAcceptedAltitude
        if (baseline == null) {
            lastAcceptedAltitude = newLocation.altitude
            return
        }
        val delta = newLocation.altitude - baseline
        if (delta > ELEVATION_NOISE_THRESHOLD_M) {
            _elevationGainMeters.value += delta
            lastAcceptedAltitude = newLocation.altitude
        } else if (delta < -ELEVATION_NOISE_THRESHOLD_M) {
            // RN: descents update the baseline but aren't subtracted from the total.
            lastAcceptedAltitude = newLocation.altitude
        }
    }

    private fun updatePace(from: Location, to: Location) {
        val time = (to.time - from.time) / 1000.0
        val dist = from.distanceTo(to)
        if (dist > 0 && time > 0) {
            val speedMs = dist / time
            if (speedMs > 0.5) {
                _currentPaceMinPerKm.value = (1000.0 / speedMs) / 60.0
            }
        }
    }

    private fun startTimer() {
        timerJob = serviceScope.launch {
            while (isActive) {
                delay(1000)
                _elapsedSeconds.value++
                updateNotification()
            }
        }
    }

    // RN: on pause the background location task stops entirely (battery save) and
    // resumes on resume; elapsed time is wall-clock based so paused duration isn't
    // counted. A prior version of this service had no-op pause/resume — tapping Pause
    // did nothing: location updates and the elapsed timer kept running underneath.
    @Suppress("MissingPermission")
    fun pauseTracking() {
        if (isPaused) return
        isPaused = true
        fusedLocationClient.removeLocationUpdates(locationCallback)
        timerJob?.cancel()
    }

    @Suppress("MissingPermission")
    fun resumeTracking() {
        if (!isPaused) return
        isPaused = false
        startLocationUpdates()
        startTimer()
    }

    // Crash-recovery: seed a freshly (re)started service with a checkpoint
    // saved before the process died, so tracking continues on top of the
    // prior distance/elapsed time instead of restarting from zero. The next
    // GPS fix is treated like a cold start's first point (lastLocation reset
    // to null) — there's no way to know how far the device moved while the
    // process was dead, so that gap is deliberately not counted as distance.
    fun restoreFromCheckpoint(checkpoint: com.ruvo.app.core.persistence.RunCheckpoint) {
        _distanceMeters.value = checkpoint.distanceMeters
        _elapsedSeconds.value = checkpoint.elapsedSeconds
        _elevationGainMeters.value = checkpoint.elevationGainMeters
        routeCoordinates.value = checkpoint.route.map { it.lat to it.lng }
        lastLocation = null
        lastAcceptedAltitude = null
        if (checkpoint.isPaused) {
            pauseTracking()
        }
    }

    fun enableLiveSharing(runId: String) {
        liveSharingRunId = runId
    }

    fun disableLiveSharing() {
        liveSharingRunId = null
    }

    private fun pushLiveLocation() {
        val runId = liveSharingRunId ?: return
        val loc = _location.value ?: return
        if (_elapsedSeconds.value % 5 != 0) return

        val data = mapOf(
            "lat" to loc.latitude,
            "lng" to loc.longitude,
            "pace" to _currentPaceMinPerKm.value,
            "distanceKm" to _distanceMeters.value / 1000.0,
            "updatedAt" to com.google.firebase.Timestamp.now()
        )
        firestore.collection("runs").document(runId)
            .collection("liveLocation").document("current")
            .set(data)
    }

    fun stopTracking() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        timerJob?.cancel()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    // MARK: – Foreground notification
    private fun startForeground() {
        val notification = buildNotification("0:00", "0.00 km")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun updateNotification() {
        val elapsed = _elapsedSeconds.value
        val dist = _distanceMeters.value / 1000.0
        val notification = buildNotification(elapsed.toFormattedTime(), String.format("%.2f km", dist))
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun buildNotification(time: String, distance: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("RUVO — Run in Progress")
            .setContentText("$time  ·  $distance")
            .setSmallIcon(R.drawable.ic_notification_run)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Run Tracking",
                NotificationManager.IMPORTANCE_LOW
            ).apply { description = "Shows live run stats" }
            val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }
}

private fun Int.toFormattedTime(): String {
    val h = this / 3600
    val m = (this % 3600) / 60
    val s = this % 60
    return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%d:%02d", m, s)
}
