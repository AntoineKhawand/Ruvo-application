# Ruvo Android — Setup Summary

## Project
- **Location:** `C:\Users\Administrateur\ruvo\android`
- **Package name:** `com.ruvo.app` (debug: `com.ruvo.app.debug`)
- **Build target:** Android SDK 35, min SDK 26
- **Status:** Compiles cleanly — no structural errors

---

## Step 1 — Firebase ✅ Done (2026-07-13)

**Firebase project:** `ruvo-app-99c85` (exists and active)  
**Auth:** Email/Password + Google + Phone enabled  
**Firestore:** Running with real data

- `com.ruvo.app` and `com.ruvo.app.debug` are both registered in Firebase (alongside the legacy `com.antoinekh.ruvoapplication`)
- Real `google-services.json` downloaded and dropped into `app/google-services.json` (project number `385760905493`)
- SHA-1 fingerprint from the local debug keystore added to both `com.ruvo.app` and `com.ruvo.app.debug`, so Google Sign-In OAuth clients now exist for both
- **Remaining for release builds:** add the *release* keystore's SHA-1/SHA-256 to `com.ruvo.app` once a release signing key exists — Google Sign-In will fail on release builds until that's added

---

## Step 2 — Google Maps API Key ✅ Done (2026-07-13)

- Enabled Maps SDK for Android + Places API on the `ruvo-app-99c85` GCP project
- Created a dedicated key ("Ruvo Android Maps Key") restricted to those 2 APIs and to Android apps `com.ruvo.app` / `com.ruvo.app.debug` (SHA-1 from the debug keystore)
- Key saved to `local.properties` as `MAPS_API_KEY`
- **Remaining for release builds:** add the release keystore's SHA-1 to this key's Android restrictions once a release signing key exists

---

## Step 3 — OpenWeather API Key ❌ Not done

- `local.properties` currently has `OPENWEATHER_API_KEY=` (empty)
- Sign up at openweathermap.org → My API Keys → copy key
- Paste into `local.properties`: `OPENWEATHER_API_KEY=YOUR_KEY`

---

## Step 4 — RevenueCat API Key ✅ Done (2026-07-13)

- A RevenueCat project ("Ruvo") already existed with an Android app entry, but its Google Play package name was still the old `com.antoinekh.ruvoapplication` — updated to `com.ruvo.app` and saved
- Public SDK key (`goog_xdIDuWutQSsqvTEGPExtzArXyOm`) added to `local.properties` as `REVENUECAT_API_KEY`
- **Needs attention:** RevenueCat now flags "Credentials need attention" on the service account — in Google Play Console, grant the RevenueCat service account (`revenuecat-service-account@ruvo-app-99c85.iam.gserviceaccount.com`) the "View app information and download bulk reports" and "View financial data, orders, and cancellation survey responses" permissions for the `com.ruvo.app` listing

---

## Step 5 — Oura & WHOOP OAuth ❌ Deferred

- `OURA_CLIENT_ID` and `WHOOP_CLIENT_ID` are empty — app builds without them
- Set up only when testing health integrations
- Oura: cloud.ouraring.com/personal-access-tokens
- WHOOP: developer.whoop.com (requires approval)

---

## Step 6 — Build ✅ Done (2026-07-13)

- Ran `gradle assembleDebug` from the command line (no `gradlew` wrapper script present in the repo, only `gradle-wrapper.properties` — used the cached Gradle 8.9 distribution directly)
- First run failed with 2 real Kotlin compile errors, unrelated to the config work above:
  - `SettingsScreen.kt:151` — `Switch(value = value, ...)` used the wrong parameter name; Compose's `Switch` takes `checked`. Fixed.
  - `RuvoApp.kt:184` — called `LeaderboardScreen(onBack = ...)` but `LeaderboardScreen` didn't accept an `onBack` param (every sibling screen reached via push navigation does). Added `onBack: () -> Unit = {}` to `LeaderboardScreen` plus a back button in its header, matching the pattern used in `AchievementsScreen` etc.
- Second run: **BUILD SUCCESSFUL**, `app/build/outputs/apk/debug/app-debug.apk` produced
- Still open in Android Studio: `gradlew`/`gradlew.bat`/`gradle-wrapper.jar` are missing from the repo — Android Studio will regenerate them on first open, or run `gradle wrapper` once to commit them

---

## Feature Availability by Step

| Steps completed | Features working |
|---|---|
| Step 1 only | App launches, auth, Firestore |
| + Step 2 | Maps and route tracking |
| + Step 3 | Weather data |
| + Step 4 | Subscriptions / paywall |
| All steps | Full app |

---

## Files to Edit

| File | What to change |
|---|---|
| `app/google-services.json` | Replace with real Firebase download |
| `local.properties` | Fill in all API keys |
