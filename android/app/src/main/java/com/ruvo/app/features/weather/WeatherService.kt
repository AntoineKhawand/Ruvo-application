package com.ruvo.app.features.weather

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import com.google.android.gms.location.LocationServices
import com.ruvo.app.BuildConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
data class WeatherResponse(
    val weather: List<WeatherItem> = emptyList(),
    val main: MainData = MainData(),
    val wind: WindData = WindData(),
    val rain: RainData? = null,
    val name: String = "",
)

@Serializable
data class WeatherItem(val id: Int = 0, val main: String = "", val description: String = "", val icon: String = "")

@Serializable
data class MainData(
    val temp: Double = 0.0,
    @SerialName("feels_like") val feelsLike: Double = 0.0,
    val humidity: Int = 0,
)

@Serializable
data class WindData(val speed: Double = 0.0, val deg: Int = 0)

@Serializable
data class RainData(@SerialName("1h") val oneHour: Double? = null)

data class RunWeatherAdvice(
    val emoji: String,
    val condition: String,
    val temperature: String,
    val recommendation: String,
    val isGoodForRun: Boolean,
    val tipTitle: String,
    val tip: String,
)

@Singleton
class WeatherService @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val client = OkHttpClient()
    private val json   = Json { ignoreUnknownKeys = true }

    @SuppressLint("MissingPermission")
    suspend fun fetchCurrentWeather(): WeatherResponse? = withContext(Dispatchers.IO) {
        try {
            val fused = LocationServices.getFusedLocationProviderClient(context)
            val loc: Location = fused.lastLocation.await() ?: return@withContext null
            val apiKey = BuildConfig.OPENWEATHER_API_KEY
            if (apiKey.isBlank()) return@withContext null
            val url = "https://api.openweathermap.org/data/2.5/weather?lat=${loc.latitude}&lon=${loc.longitude}&units=metric&appid=$apiKey"
            val req = Request.Builder().url(url).build()
            val body = client.newCall(req).execute().body?.string() ?: return@withContext null
            json.decodeFromString<WeatherResponse>(body)
        } catch (_: Exception) { null }
    }

    fun buildAdvice(weather: WeatherResponse): RunWeatherAdvice {
        val temp = weather.main.temp
        val humidity = weather.main.humidity
        val windSpeed = weather.wind.speed
        val conditionId = weather.weather.firstOrNull()?.id ?: 800
        val description = weather.weather.firstOrNull()?.description?.replaceFirstChar { it.uppercase() } ?: "Clear"

        val isRaining = conditionId in 200..599
        val isStormy  = conditionId in 200..299 || conditionId in 900..902
        val isSnow    = conditionId in 600..699
        val isClear   = conditionId in 800..802

        val emoji = when {
            isStormy  -> "⛈️"
            isRaining -> "🌧️"
            isSnow    -> "❄️"
            conditionId == 800 -> "☀️"
            conditionId in 801..802 -> "⛅"
            else -> "🌤️"
        }

        val isGoodForRun = !isStormy && !isSnow && temp in -5.0..35.0 && humidity < 90 && windSpeed < 15

        val recommendation = when {
            isStormy  -> "Stay indoors — lightning risk is high."
            isSnow    -> "Run with caution on slippery surfaces. Consider treadmill."
            isRaining -> if (temp > 15) "Light rain is fine! Wear a cap and stay visible." else "Cold rain: waterproof jacket and warm layers."
            temp > 32 -> "Extreme heat — run early morning, stay hydrated."
            temp > 28 -> "Hot weather — slow down 10–15%, hydrate every 20 min."
            temp < 5  -> "Cold run: layer up, warm up indoors first."
            windSpeed > 10 -> "Strong wind — run into the wind first for easier return."
            isClear && temp in 10.0..22.0 -> "Perfect running conditions today! Great day for a PR."
            else -> "Good conditions. Enjoy your run!"
        }

        val (tipTitle, tip) = when {
            temp > 28  -> "Heat Protocol" to "Pre-cool with cold water, wear light colors, cut pace by 10–15%."
            temp < 5   -> "Cold Running"  to "Cover extremities. Expect 20–30s/km slower pace. Breathe through nose."
            isRaining  -> "Wet Weather"   to "Shorten stride, avoid puddles, anti-chafe cream on feet."
            windSpeed > 8 -> "Wind Tips"  to "Start into the headwind, benefit from tailwind on return."
            humidity > 75 -> "Humidity"   to "High humidity feels warmer. Hydrate more, expect slower pace."
            else        -> "Optimal Day"  to "Ideal temperature range. Good day to push your limits."
        }

        return RunWeatherAdvice(
            emoji = emoji,
            condition = description,
            temperature = String.format("%.0f°C (feels %.0f°C)", temp, weather.main.feelsLike),
            recommendation = recommendation,
            isGoodForRun = isGoodForRun,
            tipTitle = tipTitle,
            tip = tip,
        )
    }
}
