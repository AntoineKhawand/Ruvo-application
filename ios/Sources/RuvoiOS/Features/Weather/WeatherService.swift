import Foundation
import CoreLocation

// MARK: – Models

struct WeatherCondition {
    let emoji: String
    let condition: String
    let temperature: String
    let feelsLike: String
    let humidity: Int
    let windSpeed: Double
    let isGoodForRun: Bool
    let recommendation: String
    let tipTitle: String
    let tip: String
}

// MARK: – OpenWeather API Response

private struct OWResponse: Decodable {
    struct WeatherItem: Decodable { let id: Int; let description: String }
    struct Main: Decodable {
        let temp: Double; let feels_like: Double; let humidity: Int
    }
    struct Wind: Decodable { let speed: Double }
    let weather: [WeatherItem]
    let main: Main
    let wind: Wind
}

// MARK: – Service

@MainActor
final class WeatherService: ObservableObject {
    @Published var condition: WeatherCondition? = nil
    @Published var isLoading = false

    private let locationManager = CLLocationManager()
    private var locationDelegate: OneShotLocationDelegate?

    func fetchIfNeeded() async {
        guard condition == nil else { return }
        await fetch()
    }

    func fetch() async {
        isLoading = true
        defer { isLoading = false }
        guard let loc = await requestLocation() else { return }
        let apiKey = Bundle.main.object(forInfoDictionaryKey: "OPENWEATHER_API_KEY") as? String ?? ""
        guard !apiKey.isEmpty else { return }

        var comps = URLComponents(string: "https://api.openweathermap.org/data/2.5/weather")!
        comps.queryItems = [
            .init(name: "lat",   value: "\(loc.coordinate.latitude)"),
            .init(name: "lon",   value: "\(loc.coordinate.longitude)"),
            .init(name: "units", value: "metric"),
            .init(name: "appid", value: apiKey),
        ]
        guard let url = comps.url,
              let (data, _) = try? await URLSession.shared.data(from: url),
              let response = try? JSONDecoder().decode(OWResponse.self, from: data) else { return }

        condition = buildCondition(from: response)
    }

    private func requestLocation() async -> CLLocation? {
        locationManager.requestWhenInUseAuthorization()
        return await withCheckedContinuation { cont in
            let delegate = OneShotLocationDelegate { [weak self] loc in
                self?.locationDelegate = nil
                cont.resume(returning: loc)
            }
            locationDelegate = delegate
            locationManager.delegate = delegate
            locationManager.requestLocation()
        }
    }

    private func buildCondition(from r: OWResponse) -> WeatherCondition {
        let id   = r.weather.first?.id ?? 800
        let desc = (r.weather.first?.description ?? "Clear").capitalized
        let temp = r.main.temp; let feels = r.main.feels_like
        let humidity = r.main.humidity; let wind = r.wind.speed

        let isRain   = (200...599).contains(id)
        let isStorm  = (200...299).contains(id)
        let isSnow   = (600...699).contains(id)
        let isClear  = id == 800

        let emoji: String
        switch id {
        case 200...299: emoji = "⛈️"
        case 300...399: emoji = "🌦️"
        case 500...599: emoji = "🌧️"
        case 600...699: emoji = "❄️"
        case 800:       emoji = "☀️"
        case 801...802: emoji = "⛅"
        default:        emoji = "🌤️"
        }

        let isGood = !isStorm && !isSnow && (-5.0...35.0).contains(temp) && humidity < 90 && wind < 15

        let rec: String
        switch true {
        case isStorm:    rec = "Stay indoors — lightning risk is high."
        case isSnow:     rec = "Slippery surfaces. Consider a treadmill today."
        case isRain && temp > 15: rec = "Light rain is fine! Wear a cap and stay visible."
        case isRain:     rec = "Cold rain — waterproof jacket and warm layers."
        case temp > 32:  rec = "Extreme heat — run early morning, stay hydrated."
        case temp > 28:  rec = "Hot: slow down 10–15%, hydrate every 20 min."
        case temp < 5:   rec = "Cold run: layer up, warm up indoors first."
        case wind > 10:  rec = "Strong wind — run into it first for easier return."
        case isClear && (10.0...22.0).contains(temp): rec = "Perfect conditions today! Great day for a PR. 🏆"
        default:         rec = "Good conditions. Enjoy your run!"
        }

        let (tipTitle, tip): (String, String)
        switch true {
        case temp > 28:  (tipTitle, tip) = ("Heat Protocol", "Pre-cool with cold water, wear light colors, cut pace 10–15%.")
        case temp < 5:   (tipTitle, tip) = ("Cold Running", "Cover extremities. Expect 20–30s/km slower pace.")
        case isRain:     (tipTitle, tip) = ("Wet Weather", "Shorten stride, avoid puddles, anti-chafe on feet.")
        case wind > 8:   (tipTitle, tip) = ("Wind Tips", "Start into the headwind, benefit on return.")
        case humidity > 75: (tipTitle, tip) = ("Humidity", "High humidity feels warmer. Hydrate more.")
        default:         (tipTitle, tip) = ("Optimal Day", "Ideal temperature range. Good day to push your limits.")
        }

        return WeatherCondition(
            emoji: emoji, condition: desc,
            temperature: String(format: "%.0f°C", temp),
            feelsLike: String(format: "Feels %.0f°C", feels),
            humidity: humidity, windSpeed: wind,
            isGoodForRun: isGood,
            recommendation: rec, tipTitle: tipTitle, tip: tip
        )
    }
}

// One-shot CLLocationManagerDelegate (nonisolated since CLLocationManager callbacks run on main thread)
final class OneShotLocationDelegate: NSObject, CLLocationManagerDelegate {
    private let completion: (CLLocation?) -> Void
    private var done = false
    init(completion: @escaping (CLLocation?) -> Void) { self.completion = completion }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard !done else { return }; done = true
        completion(locations.first)
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard !done else { return }; done = true
        completion(nil)
    }
}
