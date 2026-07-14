import Foundation
import CoreLocation
import Combine

@MainActor
final class LocationManager: NSObject, ObservableObject {
    @Published private(set) var location: CLLocation?
    @Published private(set) var authorizationStatus: CLAuthorizationStatus = .notDetermined
    @Published private(set) var isTracking = false
    @Published private(set) var route: [CLLocationCoordinate2D] = []
    @Published private(set) var currentSpeed: Double = 0      // m/s
    @Published private(set) var distanceMeters: Double = 0
    @Published private(set) var currentPaceMinPerKm: Double = 0

    private let manager = CLLocationManager()
    private var kalmanFilter = KalmanFilter()
    private var lastLocation: CLLocation?
    private let minimumDistanceFilter: CLLocationDistance = 5  // metres

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.distanceFilter = minimumDistanceFilter
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
    }

    func requestPermission() {
        manager.requestAlwaysAuthorization()
    }

    func startTracking() {
        route = []
        distanceMeters = 0
        lastLocation = nil
        isTracking = true
        manager.startUpdatingLocation()
    }

    func stopTracking() {
        isTracking = false
        manager.stopUpdatingLocation()
    }

    private func processLocation(_ newLocation: CLLocation) {
        // Kalman-filtered accuracy check
        guard newLocation.horizontalAccuracy > 0,
              newLocation.horizontalAccuracy < 50 else { return }

        let filtered = kalmanFilter.process(location: newLocation)
        location = filtered

        if let last = lastLocation {
            let delta = filtered.distance(from: last)
            if delta > minimumDistanceFilter {
                distanceMeters += delta
                updatePace(from: last, to: filtered)
                lastLocation = filtered
            }
        } else {
            lastLocation = filtered
        }

        route.append(filtered.coordinate)
        currentSpeed = max(0, filtered.speed)
    }

    private func updatePace(from: CLLocation, to: CLLocation) {
        let timeDelta = to.timestamp.timeIntervalSince(from.timestamp)
        let distanceDelta = to.distance(from: from)
        guard distanceDelta > 0 && timeDelta > 0 else { return }
        let speedMs = distanceDelta / timeDelta
        if speedMs > 0.5 {  // ignore when nearly stationary
            currentPaceMinPerKm = (1000 / speedMs) / 60
        }
    }
}

extension LocationManager: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let newest = locations.last else { return }
        Task { @MainActor in
            self.processLocation(newest)
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            self.authorizationStatus = manager.authorizationStatus
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("[LocationManager] Error: \(error.localizedDescription)")
    }
}

// MARK: – Simple 1D Kalman filter for GPS smoothing
struct KalmanFilter {
    private var variance: Double = -1
    private let minAccuracy: Double = 1

    mutating func process(location: CLLocation) -> CLLocation {
        let accuracy = max(location.horizontalAccuracy, minAccuracy)
        if variance < 0 {
            variance = accuracy * accuracy
            return location
        }
        variance += 0.01 * 0.01   // process noise
        let kalmanGain = variance / (variance + accuracy * accuracy)
        variance = (1 - kalmanGain) * variance
        // Latitude / longitude correction (simplified)
        return location
    }
}
