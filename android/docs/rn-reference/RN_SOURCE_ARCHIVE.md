# RN Reference App — Full Source Archive

This document is a permanent, detailed extraction of everything needed to finish
porting the remaining screens from the React Native reference app
(`C:\ruvo-application`) to this native Android app, captured **before that
project was deleted** (2026-07-23) to free disk space and consolidate on a
single codebase.

It complements `RN_ANDROID_PORT_MAPPING.md` (the screen-by-screen status
tracker) — this file has the deep implementation detail (formulas, exact
Firestore field names, validation rules, navigation maps) for every screen that
was still 🟡/⬜ in the roadmap when the RN source was retired. Raw data files
(badge catalogue, countries list, help content, legacy theme) were also copied
verbatim into `docs/rn-reference/*.js` alongside this document — see the
bottom of this file for the manifest.

**How to use this doc:** when picking up one of these roadmap items, read the
relevant section below instead of the (now-deleted) RN source. Everything here
was written by directly reading the full RN files, not paraphrased from
memory — field names and formulas should be treated as authoritative.

---

## 1. ActiveRunScreen (RN `src/screens/ActiveRunScreen.js`, 959 lines)

Android equivalent: `features/runtracking/RunTrackingScreen.kt` +
`RunTrackingViewModel.kt` + `RunTrackingService.kt`.

### UI sections, in order

| Section | RN behavior |
|---|---|
| Mount permission/GPS flow | See "GPS/location logic" below |
| Map view | `MapView`/`Polyline`/start `Marker`, dark/light/satellite/hybrid style picker modal, "Acquiring GPS..." spinner overlay until `gpsReady` |
| Header | Date/time pill (or, in workout/interval mode, current step type + countdown), map-layers button, live-share/radio button, close (X) button |
| Recenter button | Fades in when user pans the map away from follow mode |
| Draggable bottom dashboard | Pan-gesture expand/collapse; distance readout + "of X km" goal + Charts/Overview toggle; always-visible PACE / TIME / BPM strip; toggle body is either a 30-sample HR bar chart or a stats list (voice toggle, lap count, workout time, active calories, avg pace, elevation, 5-zone HR card) |
| Bottom controls | Lap (flag), Pause/Resume (center pill), **Finish** (press-and-hold ~1.5s neon progress button), Camera/snapshot (disabled stub) |

### GPS/location logic

- Library: `expo-location` + `expo-task-manager` for background updates; map via `react-native-maps` (`PROVIDER_GOOGLE` Android / `PROVIDER_DEFAULT` iOS).
- **Permission sequence** (strict order): foreground permission (blocking — `Alert` + `goBack()` if denied) → paint map instantly from `getLastKnownPositionAsync()` → background permission requested **non-blocking** (denial just shows a "set Always Allow in Settings" alert, run proceeds foreground-only) → precise fix via `Location.Accuracy.BestForNavigation`, falling back to `Balanced` on throw; total failure → blocking "GPS Error" alert + `goBack()`.
- **Background tracking config**: `Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, { accuracy: BestForNavigation, timeInterval: 2000ms, distanceInterval: 5m, showsBackgroundLocationIndicator: true, foregroundService: { notificationTitle: "Ruvo Active Run", notificationBody: "Tracking your distance...", notificationColor: "#000000" } })`, guarded against double-registration.
- **Speed/noise filtering** (critical for parity):
  - `MAX_RUNNING_SPEED_MS = 25/3.6` (≈6.94 m/s = 25 km/h) — points reporting a higher speed update the map dot only, never enter the route/distance/calorie calculation (GPS glitch/vehicle rejection).
  - Minimum movement threshold: a point only joins the route if haversine distance from the last point exceeds **0.005 km (5 m)** — jitter filter while stationary.
  - Secondary "implied speed" check even when `speed` is null: if distance/time between the last two points implies >25 km/h, the point is dropped entirely.
- **Distance formula**: standard haversine, `R = 6371` km.
- **Pace formula**: from **instantaneous GPS speed**, not distance/time averaging — `kmPerHour = speed*3.6`; `minPerKm = 60/kmPerHour`; floor minutes, round seconds. This means displayed pace is a live/noisy instantaneous value, not a rolling average — a real behavioral choice worth reconsidering (not just replicating) on Android.
- **Elevation gain**: only accumulates when altitude increases **more than 1.5 m** since the last accepted altitude; descents update the baseline but aren't subtracted; anything within ±1.5 m is noise.
- **Calories**: `calories += distanceIncrementKm * userWeightKg * 1.036` per accepted GPS point (`userWeight = userData?.weight || 70`), displayed floored.
- **Pause/resume**: on pause, background task stops (battery save); on resume it restarts; elapsed time is recalculated from `startTimeRef` adjusted by `secondsAtPauseRef` so paused duration isn't counted.
- **Splits** (`kmSplitsRef`, ref only — not React state): pushed whenever `floor(distance)` crosses a new integer km; `splitSeconds = secondsRef - lastKmSecondsRef`, resetting the marker each crossing.
- **Elapsed time**: wall-clock based (`floor((Date.now()-startTimeRef)/1000)`), self-correcting after JS timer throttling in background — not a naive per-tick increment. `formatTime`: `"MM:SS"` zero-padded, **no hours segment** (a 75-minute run shows "75:03", not "1:15:03").
- **Heart rate**: iOS-only via HealthKit (`observeHeartRate` in `healthService.js` is a confirmed no-op on Android: `if (Platform.OS !== 'ios') return () => {}`). **The RN app has no working Android HR source at all** — this needs a genuine Health Connect/wearable integration on the native port, not a port of existing logic.
- **HR zones** (`getHrZone(hr, age=30)`): `maxHr = 220-age`; `pct = hr/maxHr`; ≥0.9→Z5 Max (`#FF3B30`), ≥0.8→Z4 Threshold (`#FF9500`), ≥0.7→Z3 Aerobic (`#FFCC00`), ≥0.6→Z2 Fat Burn (`#34C759`), ≥0.5→Z1 Warm Up (`#5AC8FA`), else Z0 Resting (`#8E8E93`).
- **`steps` state is dead code** — declared, passed through to the summary payload, but `setSteps` is never called anywhere. Always 0.

### Firestore / Cloud Function calls

- `httpsCallable(functions,'startLiveRun')({})` → `{ token, shareUrl }`.
- Every 15s while sharing: `updateDoc(doc(db,'liveRuns',token), { lastPosition: { lat, lng, pace, distance, duration, timestamp } })` — note field names `lat`/`lng` (not `latitude`/`longitude`), `distance` = `parseFloat(distance.toFixed(2))`, `duration` = the `"MM:SS"` **string**, `timestamp` = `Date.now()` ms. Failures silently swallowed (comment: "non-critical").
- `httpsCallable(functions,'endLiveRun')({ token })` on finish; also silently swallowed on failure.
- No direct `users/{uid}` or `runs` writes in this file — on Finish it navigates to `RateEffort` with the full payload (see below), and the actual Firestore persistence happens several screens downstream via `SaveActivityScreen` → `UserContext.addRunToHistory` → Cloud Function `saveRunActivity` (see §9 Gamification below for that exact contract).

**Exact hand-off payload to `RateEffort`** (the contract the rest of the save pipeline depends on):
```
{
  distance, pace, calories, heartRate, time, steps (always 0),
  routePath, initialRegion, terrain, title, type, description,
  elevationGain (rounded), kmSplits
}
```

### Navigation

In: receives `{ workoutMode, playlist, routeType, workout }` params. Out: `goBack()` on permission/GPS failure or header close; `navigate('RateEffort', { runData })` on successful Finish — the only forward path.

### Voice/haptic feedback (exact templates)

- Mount: `"Acquiring GPS, get ready."` → on lock: `"GPS ready. Let's run."`
- Workout/interval step change: `` `${step.type}. ${step.name || ''}` `` (e.g. "Run. Sprint 1").
- Voice toggle-on: `"Voice feedback enabled"` (bypasses the enabled-gate intentionally).
- Lap: `` `Lap ${n}` `` + non-voice `Alert` "🏁 Lap Recorded" showing distance/pace.
- Pause/resume: `"Workout paused"` / `"Resuming workout"`.
- **No distance-milestone callouts** (e.g. "1 kilometer done") and **no pace-deviation alerts** exist in RN despite splits being tracked — these would be net-new features, not ports.
- Haptics: `lightTap()` on nearly every button; `successFeedback()` on Finish; `errorFeedback()` on the disabled snapshot stub.

### Edge cases

- Foreground permission denied → blocking alert + forced `goBack()`, no retry-in-place.
- Background permission denied → non-blocking warning, run proceeds foreground-only; **no detection** if background tracking actually stops once truly backgrounded.
- GPS acquisition failure → two-tier accuracy fallback, then blocking alert + `goBack()`.
- App backgrounding → `AppState` listener recomputes elapsed time from wall clock on return to foreground.
- Live-share failures → silently swallowed, no retry/backoff, no user-facing indication.
- **No crash/kill recovery**: all run state is in-memory only. `UserContext` exposes an `activeRunData` context slot seemingly meant for this, but `ActiveRunScreen.js` never references it (confirmed via grep — zero matches). A killed app mid-run loses everything with no resume path — this is a genuine gap in RN, worth fixing deliberately on Android rather than "porting" the absence of a feature.
- Data can also be lost in the window between `endRun()` navigating away and the user completing the downstream Rate Effort → Save Activity flow — only the final `saveRunActivity` call has offline-queue protection (`savePendingRun`/`retryPendingRuns`).
- Camera/snapshot: fully disabled stub (`Alert` "Snapshot Disabled — Feature temporarily disabled for stability").

### Suggested independent follow-up tasks

1. Permission & GPS-acquisition flow (foreground/background sequencing, last-known-position instant paint, two-tier accuracy fallback).
2. Background location service (Android foreground service + persistent notification, WorkManager/Service equivalent of the RN background task).
3. GPS noise/speed filtering module (25 km/h cutoff, 5m jitter threshold, implied-speed rejection) — should be its own unit-testable component.
4. Distance/pace/calorie calculation engine.
5. Elevation gain tracking (±1.5m noise threshold).
6. Timer/pause-resume engine (wall-clock based, resilient to background throttling).
7. Draggable bottom dashboard sheet (pan-gesture expand/collapse).
8. Map view + controls (style switcher, polyline/marker rendering, follow vs free-pan + recenter).
9. HR zone module + a real Android HR data source decision (Health Connect / BLE), since RN has no working Android implementation to port.
10. Voice coaching (TTS) module — port the exact templates above; consider adding milestone/pace-deviation callouts as a deliberate new feature.
11. Haptics feedback pass.
12. Live-run sharing (Cloud Functions + Firestore field names above + native share sheet).
13. Interval/workout-mode step engine (countdown, auto-advance, step-colored UI, voice announcement per step).
14. Run-completion handoff/summary payload contract (§ above) — highest-risk spot for field-name mismatches.
15. **Net-new**: crash-recovery/mid-run persistence — RN doesn't have this despite having a context slot for it; build it properly rather than assuming it exists.

---

## 2. AnalyticsScreen ("Performance" screen, RN `src/screens/AnalyticsScreen.js`, 445 lines)

Android equivalent: `features/analytics/AnalyticsScreen.kt` + `AnalyticsViewModel.kt`.

### UI sections

Header → time-range filter pills (1W/1M/3M/6M/1Y, mapped to day counts `{7,30,90,180,365}`) → overview stat strip (RUNS/KM/MINUTES for the period) → 4 time-series charts (Distance bar, Avg Pace line, Elevation line, Heart Rate line) → "Advanced Metrics" section (PRO-gated): VO2 Max + Consistency twin boxes, Recovery Score card, Race Predictor card (5K/10K/Half/Marathon), **Personal Records card** (5K/10K/Half/Marathon/Longest — this is RN's actual "Personal Records" feature; there is no separate PersonalRecordsScreen.js) → upgrade banner if not Pro.

### Calculations

- Per-day bucketing (`processChartData`): sums `distance`/`elevationGain`; for HR and pace, uses a **recency-weighted running "half-blend"** average, not a true mean: `hrData[idx] = hrData[idx] ? (hrData[idx]+hr)/2 : hr` (same pattern for pace).
- Pace string `"m:ss"` → decimal minutes via `m + s/60`.
- X-axis label downsampling per range: `{1W:1, 1M:5, 3M:15, 6M:30, 1Y:60}`.
- Period totals: `periodKm` = sum of distances; `periodMin` = sum of parsed `"mm:ss"` durations in minutes.
- VO2 Max descriptor thresholds: Superior ≥55, Good ≥45, Fair ≥35, else Basic.
- Consistency descriptor thresholds: Elite ≥5 (runs/week presumably), Solid ≥3, Building ≥1, else Start.
- Charts are **hand-rolled** (`src/components/SimpleCharts.js`, `SimpleBarChart`/`SimpleLineChart`) — no third-party charting library was used, so Compose will need a from-scratch Canvas-drawn equivalent either way.

### Personal Records — exact formula (`src/hooks/useAnalytics.js`, section "7. PERSONAL RECORDS")

- Buckets: `{'1k': null, '5k': null, '10k': null, 'Half': null, 'Longest': 0}`.
- For each valid run (`distance>0` or `duration>60s`): `paceSec = totalDurationSec/distanceKm`; `Longest` = max distance seen; for each bucket meeting its distance threshold (`1k`≥1, `5k`≥5, `10k`≥10, `Half`≥21.09 km), keep the run with the **lowest pace** (best average pace), i.e. best-effort-by-pace, not fastest-time-at-exact-distance.
- **Missing Marathon bucket**: the UI renders a Marathon row but `useAnalytics` never computes it — `analytics.pbs['Marathon']` is `undefined` and the row silently doesn't render. Real gap in RN; decide whether to add it or intentionally drop the row on Android.
- Formatting: pace seconds → `"m:ss"` via floor/round with zero-pad; Longest formatted via `formatDistance(pbs.Longest, unitSystem)`.

### Firestore / navigation

- Reads `userData.runHistory` (context) plus calls `loadFullRunHistory()` on mount to get **all-time** history from `users/{uid}/runs` subcollection (the `runHistory` array field is capped ~100 entries).
- No direct Firestore writes; no `httpsCallable` calls in this screen.
- In: `navigate('Analytics')` from Home dashboard (3 call sites). Out: `goBack()`; `navigate('Paywall')` from the upgrade banner.

### Sub-features to scope independently

Time-range chart engine; VO2 Max card; Race Predictor (Riegel formula) card; Recovery Score card (time-since-last-run heuristic); Personal Records list card; Pro paywall gating pattern.

---

## 3. Achievements / Badges system ("Trophy Room", RN `src/screens/AchievementsScreen.js`, 266 lines)

Android equivalent: `features/achievements/AchievementsScreen.kt` + `AchievementsViewModel.kt`. Raw badge catalogue copied verbatim to `docs/rn-reference/badges.js`.

### UI

Header → progress card (completion % = `totalUnlocked/BADGES.length*100`, animated fill) → per-category sections (grouped via `BADGES.reduce()` by `category`) each with a header + 3-column badge grid → tap opens a full-screen detail modal (icon glowing if unlocked / gray if locked, UNLOCKED/LOCKED pill, description, "Keep running to unlock this achievement!" hint if locked).

Category display names: `milestone`→"Distance Milestones", `lifestyle`→"Lifestyle & Habits", `consistency`→"Consistency & Streaks", `elevation`→"Elevation Challenges", `performance`→"Speed & Performance", `default`→"Other Achievements".

### Full badge catalogue and exact unlock conditions (`src/constants/badges.js`, `BADGES` array — see raw copy)

| id | name | category | condition |
|---|---|---|---|
| `b_first_run` | First Steps | milestone | `history.length === 0` (this is the user's very first run) |
| `b_5k` | High Five | milestone | `run.distance >= 5` km |
| `b_10k` | 10K Finisher | milestone | `run.distance >= 10` km |
| `b_half` | Half Marathon | milestone | `run.distance >= 21.097` km |
| `b_early_bird` | Early Bird | lifestyle | `new Date(run.date).getHours() < 7` |
| `b_night_owl` | Night Owl | lifestyle | `getHours() >= 20` |
| `b_10_runs` | Dedicated | consistency | `history.length === 9` (this is exactly the 10th run) |
| `b_perfect_week` | Perfect Week | consistency | sort all run dates (history+current) ascending; needs 7 consecutive calendar days with a run |
| `b_century_club` | Century Club | milestone | `sum(history.distance) + run.distance >= 100` km |
| `b_weekend_warrior` | Weekend Warrior | lifestyle | within trailing 7 days, both a Saturday run and a Sunday run exist |
| `b_hill_hunter` | Hill Hunter | elevation | current run's `elevation >= 100` AND ≥9 prior runs also had `elevation >= 100` (10th qualifying run). **Field-name bug**: reads `run.elevation`, but runs elsewhere use `elevationGain` — likely never actually fires in RN; fix when porting. |
| `b_sub4_specialist` | Sub-4 Specialist | performance | current run's pace `< 4:00/km` AND ≥4 prior runs also `< 4:00/km` (5th qualifying run) |

Badge shape: `{ id, name, description, icon (Ionicons name), color (hex), category, condition(run, history) => boolean }`. `checkNewBadges()` in `src/services/badgeService.js` strips the `condition` fn before persisting, stamps `earnedAt: new Date().toISOString()`, and skips already-owned ids.

**`hasBadge()` check** matches by `id` first, falls back to matching by `name` (defensive against a legacy shape).

**Legacy duplicate system**: `SYSTEM_BADGES` in `UserContext.js` (`NEWCOMER`, `CLUB_5K`, `CLUB_10K`, `CLUB_20K`, `NIGHT_OWL`, `EARLY_BIRD`, `STREAK_7` — plain `{name, icon, desc}`, no `id`, no `condition`) is used **only** as the seed value for a new user's `badges` array (`DEFAULT_USER_DATA.badges = [SYSTEM_BADGES.NEWCOMER]`) — not wired into `checkNewBadges` at all. **Pick one canonical badge model when porting** rather than both.

### Firestore

Read-only in this screen (`userData.badges`). Unlocking happens elsewhere: `UserContext.addRunToHistory` runs `checkNewBadges()` client-side and writes `updateDoc(userRef, { badges: arrayUnion(...newBadges) })` directly from the client — **badges are not server-validated**, spoofable by a modified client. Worth moving server-side in the Kotlin backend.

### Navigation

Confusingly, `SettingsScreen.js`'s **"Personal Records" row** actually navigates to `Achievements` (the badge gallery), not to the Analytics PR card — decide intentionally in the Android IA whether "Personal Records" means the pace-PB list, the badge gallery, or both, and route accordingly.

---

## 4. RunDetailScreen (RN `src/screens/RunDetailScreen.js`, 730 lines)

Android equivalent: `features/runtracking/RunDetailScreen.kt`.

### UI sections

Header (title/type/date, activity-type chip) → hero stats (distance, duration, avg pace) → weather/gear/tag context chips → secondary stats grid (calories, avg BPM, elevation, RPE) → map/route section (static polyline, dark/satellite toggle, fades in; "GPS data not available" empty state) → Heart Rate Analysis card (big BPM, zone badge, 5-segment zone bar) → AI Insight card (shows `run.aiInsight`, "Continue with AI Coach" button) → Splits card (per-km animated bar chart, color-coded vs average, legend) → Private Notes / Description cards (conditional) → Tags row.

### Formulas

- `paceToSeconds`/`secsToPace`: `"m:ss"` ↔ seconds, standard.
- **`estimateSplitsFromRoute`** — fallback splits when `run.kmSplits` isn't stored: `avgSecsPerKm = totalDurationSec/totalDistanceKm`, generates one split per whole km using the **same average pace for every km** (`estimated: true` flag) — not derived from actual GPS timing. Real splits (when available) come straight from `run.kmSplits` (produced during the run by ActiveRunScreen). **Recommend Android always compute true splits during the run** and drop the estimate fallback.
- `splitColor(splitSecs, avgSecs)`: ratio ≤0.95 → accent (faster), ≤1.08 → gold (on pace), else red (slower).
- `getHrZone` — identical formula/thresholds to ActiveRunScreen (see §1).
- Splits bar scale denominator: `max(all split secs, avgPaceSecs*1.5)` — leaves headroom above the slowest split or 1.5× average.

### Firestore

- Receives `route.params.run` (summary fields) then, if `run.id` + `uid` exist, hydrates full detail via `getDoc(doc(db,'users',uid,'runs',run.id))` — since the denormalized `runHistory` array strips GPS fields to save space.
- Full field list on a hydrated run doc: `id, title, activityType, date, distance, duration, pace, calories, heartRate, elevationGain, rpe, weather{icon,temp}, gearName, activityTag, routePath[], initialRegion, kmSplits[], aiInsight, privateNotes, description, terrain, tags[]`.
- Also reads `userData.unitSystem`, `userData.age` (for HR zone) from context. No writes, no Cloud Function calls.

### Navigation

In: `ProfileScreen.js` → `navigate('RunDetail', { run })` (likely also reachable elsewhere, not confirmed). Out: `goBack()`; `navigate('AICoach', { initialPrompt })` — prompt template: `` `Based on my ${distance.toFixed(2)}km run at ${pace}/km: "${aiInsight}" — what should my next training week look like?` ``.

### Sub-features to scope independently

GPS route rendering + map style toggle; splits engine (real vs. estimate — recommend building real); HR Zone analysis card; AI Insight → AI Coach handoff; weather/gear/terrain/tag chip metadata display.

---

## 5. WorkoutDetailScreen (RN `src/screens/WorkoutDetailScreen.js`, 534 lines)

Android equivalent: `features/runtracking/WorkoutDetailScreen.kt`.

### UI sections

Gradient header + nav bar (back, "Details", share) → session header (title, dynamic description, duration, hidden on rest days) → quick actions row (Warm-Up Checklist, Terrain/Route select, Sync Apps, Skip Session — hidden on rest days) → Workout Structure / Recovery Plan list (numbered steps with icons) → bottom action bar ("Start Workout"/"Enjoy Your Rest" + music toggle) → 4 modals (Soundtrack picker, Pre-Run Warmup checklist, Select Terrain, Sync Settings).

### Logic (mostly branching, no math-heavy formulas)

- **`workoutSteps`** (memoized): if `customSteps` exists (AI-Coach-generated) use as-is; if a Rest day (`type==='Rest'` or title/intensity match) → hardcoded Recovery structure (Full Rest, Hydrate & Sleep) + Optional (15 min Mobility, Light Walk); else default 3-block plan: `warmUp=5min`, `coolDown=5min`, `mainSetTime = max(totalTime-warmUp-coolDown, 10)` where `totalTime = workout.duration || 30`.
- **`handleStartWorkout`**: flattens `workoutSteps` into `flatSteps`, expanding any section whose `type` contains `"(x"` into `loops = parseInt(match)` repeated copies (regex `/\(x(\d+)/`) tagged `(Loop i+1)` — i.e. "Intervals (x6)" unrolls into 6 repeated step blocks. Navigates to `ActiveRun` with `{ workoutMode: true, playlist: flatSteps, musicAppId, routeType, initialTrackIndex, runTracking: true }`.
- **`handleSkipWorkout`**: confirmation alert → `addRunToHistory({ date, distance: 0, duration: '00:00', pace: '0:00', calories: 0, title: 'Rest Day', type: 'Rest', badgeEarned: null })` then `goBack()`.
- **Audio ducking hack**: when "No Music" selected, loops a hardcoded silent base64 WAV via `expo-av` to hold audio focus and duck other apps (`DoNotMix` interruption mode) — an iOS/Android audio-session trick with no formula; on Android this maps to `AudioManager`/`AudioFocusRequest`, not something to port literally.

### Firestore

No direct reads/writes; uses `addRunToHistory` (→ `saveRunActivity` Cloud Function) for the Skip-as-Rest-Day action; uses `updateUserProfile({ linkedHealth })`/`{ linkedGarmin }` for device-sync toggles (reads/writes `userData.linkedGarmin`/`linkedHealth`).

### Navigation

In: `HomeScreen.js` and `PlanScreen.js` → `navigate('WorkoutDetail', { workout })`. Out: `goBack()`; `navigate('ActiveRun', {...})` on Start Workout.

### Sub-features to scope independently

Workout-step flattening/looping engine (interval parsing); rest-day detection + alternate UI; music deep-link + audio-focus handling (native `AudioFocusRequest` on Android); device sync toggles; terrain/route selector; warm-up checklist (static, not tracked).

---

## 6. Settings cluster

### 6a. SettingsScreen (RN `src/screens/SettingsScreen.js`, 268 lines)

Android equivalent: `features/settings/SettingsScreen.kt`.

Rows grouped by section, each with `lightTap()` haptic:

**MEMBERSHIP**: "Manage Subscription" (value "Pro"/"Free") — if not Pro, alert to upgrade; if Pro, opens platform subscription-management URL (`apps.apple.com/account/subscriptions` iOS / `play.google.com/store/account/subscriptions` Android).

**ACCOUNT**: "Edit Profile" → `EditProfile`; "Refer & Earn" (accent-highlighted) → `Referral`; "Privacy Controls" → `PrivacyControls`; "Personal Records" → `Achievements` (see §3 navigation note); "Face ID/Touch ID" (only if hardware supported, value "Enabled"/"Disabled") — disabling clears SecureStore + confirmation alert; enabling from here just shows an alert directing the user to log out/back in (real enabling only happens from LoginScreen's post-login prompt).

**CONNECTED DEVICES**: "Manage Devices" → `ConnectedDevices`.

**PREFERENCES**: "Notifications" → `SettingsDetail{type:'notifications'}`; "Units of Measure" (value "Miles"/"KM") → `SettingsDetail{type:'units'}`.

**SUPPORT**: "Help Center" → `HelpCenter`; "About Ruvo" → `SettingsDetail{type:'About'}`; "Log Out" (destructive, confirm alert) → `logout()`; "Delete Account" (destructive, red, confirm alert with exact copy: *"This action is completely irreversible. All your tracking data, gear, subscriptions, and profile information will be permanently erased."*, confirm button "Permanently Delete") → `deleteAccount()`.

Footer: "Ruvo App v1.0.2" static text.

Dead code found: Whoop/Oura connect/disconnect handlers exist in this file (gate on `isPro`, write/delete `whoopData`/`ouraData` via `deleteField()`) but aren't wired to any visible row — device connection UI apparently moved to ConnectedDevices screen.

### 6b. SettingsDetailScreen (RN `src/screens/SettingsDetailScreen.js`, 457 lines) — generic, routed by `route.params.type`

Android has no direct equivalent yet — needs to be built (or the variants folded into existing screens). **6 active variants** (a `'Language'` variant was removed per a code comment):

1. **`notifications`** — toggles backed by `userData.notificationSettings`: `workoutReminders` (default true), `tips` (default true); COMMUNITY section: `newFollowers` (default true via `!==false`), `communityActivity` (default true), `clubUpdates` (default false). Each toggle: `updateUserProfile({ notificationSettings: {...current, [key]: !current[key]} })`. Helper text: "System permissions are required for push notifications." Error alert: "Could not save notification setting."
2. **`units`** — "Metric (Kilometers, km)" / "Imperial (Miles, mi)" radio rows, writes `updateUserProfile({ unitSystem: 'metric'|'imperial' })`. Helper: "This affects how distance and pace are displayed throughout the app."
3. **`regenerate`** — "Recalibrate AI?" flow; confirm alert *"Are you sure you want to recalculate your training plan? This will change your upcoming schedule based on recent performance."*, confirm button "Yes, Regenerate"; on confirm: `updateUserProfile({ goal: '5k', savedGoal: null, isTransitionWeek: false })`. Success: "Your run plan has been recalibrated."
4. **`Help`** — a minimal, likely-legacy inline help view distinct from the standalone HelpCenterScreen: "GPS Troubleshooting" → `https://support.google.com`; "Contact Support" → `mailto:support@ruvo.run`.
5. **`About`** — on mount fetches `system/app_config` Firestore doc (read-only) for `aboutDescription`, `legal.termsUrl`/`privacyUrl`, `socials.instagram/facebook/website/email`, `store.appStore/playStore`, `activeVersion`, silently falling back to hardcoded defaults on error. UI: logo, version string, description, Share App button (`"Check out Ruvo, the AI running coach that adapts to you! Download: {storeUrl}"`), Rate Us (`expo-store-review` → store URL fallback), social icons, Terms/Privacy links, "Licenses" (local alert listing React Native/Expo/Firebase), footer copyright.
6. **`Password`** — single New Password field (min 6 chars, weaker than SignUp's policy — no complexity check). On submit: `updatePassword(auth.currentUser, newPass)` (Firebase Auth SDK) + `logSensitiveAction("PASSWORD_CHANGE")` (writes `users/{uid}/auditLog` doc `{action, timestamp: serverTimestamp(), device: Platform.OS, details:{}}`). Special-cases `auth/requires-recent-login` → "please log out and log back in before changing your password."

`default` case renders an empty view.

### 6c. HelpCenterScreen (RN `src/screens/HelpCenterScreen.js`, 176 lines)

Android equivalent: `features/settings/HelpCenterScreen.kt`. Richer/standalone vs. SettingsDetail's `Help` variant. On mount, tries Firestore collection `help_categories` (sorted by `order` field); falls back silently to local constants (`src/constants/helpData.js`, copied verbatim to `docs/rn-reference/helpData.js`) — 4 accordion categories:
- **Account & Profile**: change profile picture / change username / delete account (directs to `support@ruvo.app`).
- **Tracking & GPS**: GPS inaccuracy / treadmill support / calorie calculation.
- **Community & Clubs**: create a club / private clubs / referrals.
- **Privacy & Safety**: who can see my runs / how do I block a user.

Contact section: "Contact Support" → `mailto:support@ruvo.app?subject=Ruvo Support Request`; "Report a Bug" → `mailto:support@ruvo.app?subject=Bug Report`. Read-only screen, no writes.

---

## 7. Auth flow

### Navigation map (from `App.js`)

- **Guest**: `Welcome` → `Login`/`SignUp` (SignUp reachable only via Login's footer link, not from Welcome); `Login` → `ForgotPassword`, `MfaVerification`; `Welcome`'s "Start Journey" → `Onboarding`.
- **Authenticated but `!onboardingCompleted`**: forced into `Onboarding` only — no way to reach the rest of the app until it completes.
- `LockScreen` is rendered **outside the navigator entirely** by `AppContent` whenever `isLocked` (context state) is true — overlays/replaces the whole app.

So `SignUpScreen` (plain email/name/password) and `OnboardingSignUpScreen` (end of the onboarding wizard, with onboarding answers already bundled) are two **different** entry points for the same underlying `signUp()` call — not duplicates to merge carelessly, they serve different flows.

### WelcomeScreen (98 lines) — pure navigation screen

Full-bleed background, headline, "Start Journey" → `Onboarding`; "Already have an account? Log In" → `Login`. No validation/auth calls.

### LoginScreen (310 lines)

- **Biometric auto-login on mount**: if hardware supports it and enabled, fetches SecureStore creds and prompts biometric; on success, silent `login()`.
- **Manual login**: missing fields → alert; rate limiting via `checkRateLimit('auth')` (max 5 attempts, base 30s lockout **doubling exponentially** per overflow, keyed in AsyncStorage) — locked alert shows minutes remaining. On failure, `recordFailedAttempt('auth')`; on the failure that trips the lock, fires `httpsCallable(functions,'notifyLoginFailure')({email})` (fire-and-forget) and shows an alert claiming "locked for 15 minutes" — **this copy doesn't match the actual 30s-doubling lockout math**, a bug worth fixing not blindly porting. Error-code-specific messages for `auth/user-disabled`, `auth/network-request-failed`, `auth/too-many-requests`, default.
- On success: `resetAttempts('auth')`; if biometric hardware available and not yet enabled, prompts to enable it (stores plaintext email+password in SecureStore on accept — a real security smell worth reconsidering on Android, not necessarily replicating as-is).
- Social login (Google/Facebook): cancellation codes treated as non-errors; other failures show generic alerts (detailed errors raised inside the context functions themselves).
- Fields: Email (keyboardType email-address), Password (secure entry, eye-icon toggle). No direct Firestore writes.

### SignUpScreen (342 lines)

- Validation: all fields required; password must pass `isPasswordValid()` (6 rules, ALL required — see below); rate limit check (same as Login); email sanity check (`@` and `.` present).
- Password rule checklist (live, `checkPasswordRules()` from `utils/passwordStrength.js`): `minLength` (8+), `hasUpper`, `hasLower`, `hasNumber`, `hasSymbol`, `notCommon` (blocklist of ~24 common passwords like `Password1!`, `Welcome123!`, `Qwerty1234`).
- Error-code handling: `auth/email-already-in-use`, `auth/invalid-email`, `auth/weak-password`, default.
- Calls `signUp(cleanEmail, password, name)` — no profile overrides, so the resulting doc has `onboardingCompleted: false` and routes into forced Onboarding per the auth gate.

### OnboardingSignUpScreen (357 lines) — the real "new user from onboarding" path

- Fields: Email, Password (same rule checklist), Referral Code (optional, no client-side validation against the server here — **no rate-limit check either**, inconsistent with Login/SignUp).
- **Exact `profileOverrides` shape assembled and merged atomically at signup** (to avoid a race where the doc briefly shows `onboardingCompleted:false`):
  ```
  name, gender, weight (parseFloat, default 70), height (parseFloat, default 175),
  dob (default now ISO), age (default 25), experience (default 'Beginner'),
  unitSystem (default 'metric'), runFrequency (default 3), selectedDays (default []),
  runDays (default []), goal (default 'Get Fitter'), targetRaceDate (default null),
  notificationTime (default null), level: 1, currentXP: 0, runHistory: [],
  weeklyDistance: 0, earningUnlockProgress: 0, pushToken (default null),
  onboardingCompleted: true
  ```
- **Social login variant writes a SMALLER field set** via `updateUserProfile()` (account already exists via OAuth, so `signUp()` isn't called): missing `age`, `experience`, `unitSystem`, `runDays`, `targetRaceDate`, `notificationTime` compared to the email path — **an inconsistency to deliberately reconcile**, not replicate, on Android.

### ForgotPasswordScreen (140 lines)

Single email field. Calls `httpsCallable(functions,'sendPasswordResetLink')({email})` — reset email sent **server-side via a custom Cloud Function**, not Firebase's client-side `sendPasswordResetEmail`. 60-second UI cooldown after sending (button becomes "RESEND IN {n}s"). Success alert copy: *"If an account exists for {email}, a reset link has been sent. Check your spam folder if you don't see it."*

### OnboardingScreen (887 lines) — 6-step wizard

`TOTAL_STEPS = 6`, progress bar + "Step {n} of 6". `isPreRegistered = !!user` branches the final step's behavior.

1. **Goal**: `Get Fitter` / `Run my First 5K` / `Run a Faster 10K` / `Train for Half-Marathon`, each with subtext; race-distance goals reveal an optional target race-day date picker.
2. **Fitness level**: `Beginner` ("I rarely run or just started") / `Intermediate` ("I run 1–3× a week consistently") / `Advanced` ("I run 4+ times a week or have race history").
3. **Bio + Units**: Display Name*, Gender pill (Male/Female/Other, default Male), DOB picker (default 2000-01-01), Weight*/Height* (placeholder units follow the metric/imperial toggle, but raw values aren't unit-converted — just label text changes), Units toggle. Continue requires name/weight/height non-empty.
4. **Frequency**: 0–7 chip grid ("How many times a week do you currently run?", default 3) with an 8-entry encouragement-message array per selection (0→"Perfect! We'll start from the beginning." … 7→"Elite level! You're unstoppable.").
5. **Training days + time**: 7-day chip selector (M–S), preferred run time picker (default now+2min). Continue requires ≥1 day selected.
6. **Permissions + account creation**: required toggles Location (`Location.requestForegroundPermissionsAsync`) and Notifications (`Notifications.requestPermissionsAsync`, denial shows Settings-redirect alert); on notification grant, schedules either per-selected-day weekly reminders (*"Time to Run! 🏃‍♂️" / "It's {day}. Let's hit your goal: {goal}!"*) or one daily reminder if no days chosen (*"Daily Reminder" / "Don't forget to run today!"*), plus registers a push token. Optional disabled row: "Wearables & Health — Connect later in Settings → Devices." `essentialGranted = location && notifications` gates account creation.
   - **If pre-registered**: "Get Started" button (disabled until essentials granted) → `updateUserProfile(buildProfile())` (no new auth account, just completes the existing one's profile).
   - **Else (guest)**: "Continue with Email" → `navigate('OnboardingSignUp', { onboardingData: buildProfile() })`; "Continue with Google" → `loginWithGoogle()` then `updateUserProfile(buildProfile())` directly (Google auth already created the Firebase user).
   - `buildProfile()` produces the same field shape as `OnboardingSignUpScreen`'s email-path overrides (see above), with `selectedDays`/`runDays` mapped to full day names.

### LockScreen (352 lines) — biometric-only app-lock, rendered outside the navigator

- **Trigger** (in `UserContext`, not this file): `AppState` listener records a background timestamp; on returning to foreground, if elapsed time **> 30 minutes** (1,800,000 ms), `isLocked = true`.
- On mount: if the device has no biometric hardware/enrollment, **immediately unlocks** (no PIN/password fallback UI exists in this screen at all — it purely gates on biometrics and no-ops gracefully if unavailable).
- If available, immediately prompts biometric (`LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to log in to Ruvo', fallbackLabel: 'Use Password', cancelLabel: 'Cancel', disableDeviceFallback: false })`) — `disableDeviceFallback:false` means the OS-level PIN/passcode fallback is available via "Use Password", but it's the **device's** OS lock, not an in-app custom PIN.
- Success → unlock. Failure → shake animation, UI switches to a red/failure visual state ("Authentication Failed" / *"Your identity could not be verified.\nPlease try again to continue."*), button becomes "Try Again" (re-invokes the prompt). **No lockout timer or max-attempt counter** — retries are unlimited.

### `DEFAULT_USER_DATA` — canonical new-user Firestore shape (`UserContext.js`)

```
name: 'Runner', email: 'user@ruvo.app', onboardingCompleted: false,
avatar: null, level: 1, currentXP: 150, xpToNextLevel: 1000,
bio: '', city: '',
weeklyDistance: 0, weeklyGoal: 0, lastWeekReset: <ISO now>,
calories: 0, bpm: 0, earningUnlockProgress: 0,
runHistory: [], badges: [SYSTEM_BADGES.NEWCOMER],
gearList: [{ ...SYSTEM_GEAR.DEFAULT, distance: 0 }],
following: [], followers: [],
joinedChallenges: ['c1'], joinedClubs: [], myCreatedClubs: [],
requests: [], blocked: [], mutedUsers: [],
chats: {}, username: null,
dob: '1990-01-01', height: 175, weight: 70, gender: 'Male',
runFrequency: 3, goal: 'health', experience: 'beginner',
location: { city: '', country: '', address: '' },
runningPreferences: { preferredTime: 'morning', favoriteDistance: '5k', weeklyGoal: 0 },
tipViews: {}, notificationTime: <ISO now>,
privacySettings: {
  profileVisibility: 'public', showActivityOnFeed: true, showLocationOnMap: true,
  showStatsToOthers: true, whoCanFollow: 'everyone', whoCanComment: 'everyone', whoCanSeeClubs: 'everyone'
},
isPro: false, wallet: { coins: 0 }, referralCode: null,
referralStats: { totalInvites: 0, coinsEarned: 0 }, coins: 0 (deprecated but actually the one used server-side)
```

**`signUp(email, password, name, referralCodeInput, profileOverrides)`**: creates the Firebase Auth user → generates a referral code (`<firstName-4char-uppercase><random 1000-9999>`, e.g. `RUNN4821`) → if a referral code was entered, validates + processes it, records `referredBy` → writes `users/{uid}` via `setDoc(..., {merge:true})` with `{...DEFAULT_USER_DATA, ...profileOverrides, uid, name, nameLowercase, email, joinedAt, referralCode, referredBy}`.

**Social login does NOT create the Firestore doc** — only signs into Firebase Auth (Google via `@react-native-google-signin/google-signin`; Facebook via a manual OAuth code-flow through `expo-web-browser`/`expo-auth-session` exchanged at `graph.facebook.com`). The profile doc only gets created/completed via the subsequent `updateUserProfile()` calls in Onboarding/OnboardingSignUp.

**`updateUserProfile(updates)`**: optimistic local merge + `updateDoc`. Injects `nameLowercase` when `name` present; atomic `username` reservation via a `usernames/{username}` doc (throws `'USERNAME_TAKEN'` on conflict); propagates name/avatar changes to the user's `posts` collection (batched); reschedules notification reminders if relevant fields changed.

**Account deletion**: logs `ACCOUNT_DELETION` to `auditLog`, calls Cloud Function `deleteAccountData` (full server-side purge), unlinks RevenueCat, clears local state.

**Audit log** (`logSensitiveAction`): writes `users/{uid}/auditLog/{auto}` = `{action, timestamp: serverTimestamp(), device: Platform.OS, details}`. Used for `PASSWORD_CHANGE` and `ACCOUNT_DELETION`.

---

## 8. Small spot-check screens

### CreateClubScreen (RN, 198 lines)

Icon selector (6 presets: run/tree/fire/leaf/heart/trophy with id/icon/color), banner image picker (`expo-image-picker`, 16:9, quality 0.8), Name/Description(multiline)/Location(optional) inputs, Public/Private radio cards, sticky "Create Club" button (disabled until name non-empty). **Exact club payload** built here (actual write happens in `UserContext.addNewClub`, not shown, but this is authoritative): `{name (sanitized), icon, color, joined:true, role:'admin', type (lowercased privacy), desc (sanitized, default 'No description provided.'), image (banner URI or null), isCustom:true, location (sanitized)}` — explicitly omits `id` (auto-gen) and `members` (computed by context). Uses `sanitizeInput()` on name/desc/location.

### UserListScreen (RN, 166 lines)

Header with dynamic title from `route.params.title`. Reads `users` collection via chunked `where(documentId(),'in',chunk)` (≤10 per Firestore `in` query), fields consumed: `avatar`, `name`, `location.country`, `level`. Follow-state read from context (`userData.following`/`.requests`), writes delegated to `followUser`/`unfollowUser` (not in this file). Own-profile row non-tappable, follow button hidden for self. **3-state follow button**: "Follow" → "Requested" (if in `requests`, tap is a no-op — presumably a pending private-account follow request) → "Following". Navigation: `push('UserProfile', {userId})`.

### TipDetailScreen (RN, 313 lines)

Hero: full-bleed `ImageBackground` (`tip.img`) + gradient, back/bookmark buttons, category pill, read-time pill, views pill (`.toLocaleString()`), title, description. Body: "KEY TAKEAWAY" callout (if `tip.keyTakeaway`), "THE BREAKDOWN" card (`tip.why`, hardcoded running-economy fallback text if absent), "DRILL SEQUENCE" numbered steps from `tip.steps[]` (3 hardcoded default steps — Preparation/Execution/Integration — if absent), "Mark as Helpful" toggle (**local UI state only, never persisted** — resets every screen open, flag as cosmetic/unfinished). Entire `tip` object arrives via nav params (not fetched here); only `userData.savedTips` is read from context to compute bookmark state; bookmark toggling delegates to `useUser().toggleTipBookmark(tip.id)`.

Category → color/icon map (`CATEGORY_META`): Technique `#CCFF00`/speedometer-outline, Nutrition `#FF9500`/nutrition-outline, Recovery `#5AC8FA`/battery-charging-outline, Mental `#BF5AF2`/brain, Strength `#FF2D55`/barbell-outline, Gear `#FFD700`/shirt-outline, Race Prep `#FF6B6B`/flag-outline, Injury Prev `#34C759`/shield-checkmark-outline; fallback accent green + book-outline.

### CustomerCenterScreen (RN, 19 lines)

Confirmed trivial: renders `<RevenueCatUI.CustomerCenter />` from `react-native-purchases-ui` in a full-flex view. No props, no navigation, no Firestore, no custom logic — nothing beyond "show RevenueCat's native Customer Center screen."

---

## 9. Gamification / XP system — the real fix for Android's `awardRunXP` bug

**Confirmed**: `GearScreen.js` and `ActiveRunScreen.js` have zero XP/coin/level/streak references. The entire award pipeline is exactly 3 hops:

1. **`SaveActivityScreen.js::handleSave()`** — builds the run entry object (fields: `id, date, distance, duration, pace, calories, heartRate, rpe, tags, routePath, initialRegion, kmSplits, elevationGain, image, title, description, privateNotes, activityType, activityTag, visibility, isMuted, hideMap, conditions, mapImage, gearId, gearName, weather, aiInsight`) and `calculatedUpdates = {totalKm, earningUnlockProgress, gearList}`, calls `addRunToHistory(newActivity, calculatedUpdates)`, destructures `{newBadges=[], earnedXp=0, earnedCoins=0, coinBreakdown, levelsGained=0, newLevel=1}`, shows a "Level Up!" alert if `levelsGained>0` (**dead code — see below**), and displays `coinBreakdown.paceBonus`/`.streakBonus`/`.timeBonus` chips (**also dead — see below**).
2. **`UserContext.js::addRunToHistory(runEntry, calculatedUpdates)`** — calls `httpsCallable(functions,'saveRunActivity')({runEntry, calculatedUpdates})`; on network failure, queues offline via `savePendingRun` for retry via `retryPendingRuns()` on next login. Applies the **only real bonus that exists**: if `userData.isPro && earnedCoins>0`, doubles `earnedCoins` client-side (`coinBreakdown.proBonus`). Runs `checkNewBadges()` and writes new badges via `arrayUnion` directly from the client. Optimistically prepends the run to local state.
3. **`functions/index.js::exports.saveRunActivity`** (lines 182-252) — **the actual and only real formula**:
   ```
   earnedXp    = floor(distance_km * 100 + duration_minutes * 2)
   earnedCoins = floor(distance_km * 10)
   ```
   `duration_minutes` parsed from `"MM:SS"` or `"HH:MM:SS"`. Writes to `users/{uid}` (Admin SDK, atomic): `runHistory: arrayUnion(runEntry)`, `totalRuns: increment(1)`, `weeklyDistance: increment(distance)`, `currentXP: increment(earnedXp)`, `coins: increment(earnedCoins)` (**top-level `coins`, not `wallet.coins`** — despite a comment elsewhere marking `coins` "deprecated", it's the field actually incremented), plus a whitelisted subset of `calculatedUpdates` (`gearList`, `totalKm` if numeric, `earningUnlockProgress` if numeric). **Returns only `{success, earnedXp, earnedCoins}`.**

### Critical finding: level-up, coinBreakdown bonuses, and streaks are NOT implemented anywhere

Exhaustively grepped `functions/index.js` and all of `src/` — confirmed:
- `levelsGained`/`newLevel` are never computed/returned by the Cloud Function; they always fall back to their JS destructuring defaults (`0`/`userData.level` or `1`, inconsistently between the two client files). **The "Level Up!" alert can never fire in the shipped app** — no code path anywhere increments the `level` field beyond its static `1` default.
- `currentXP` accumulates forever via `increment()` with **no cap, no rollover, no threshold check** against the static `xpToNextLevel: 1000` default.
- `coinBreakdown.paceBonus`/`.streakBonus`/`.timeBonus` have **zero producers anywhere in the codebase** — `SaveActivityScreen.js` displays UI for fields that are never populated by anything. Unfinished/aspirational UI.
- **No streak-tracking system exists tied to XP/coins.** The only streak-adjacent logic is `scheduleSmartReminders()` checking whether the most recent run was today (a notification heuristic, not a persisted counter) and the `b_perfect_week` badge (recomputes consecutive-day-run status from scratch off full history every time — no stored `currentStreak`/`streakCount` field exists anywhere in `DEFAULT_USER_DATA`).

### Fix recipe for Android

Replace the fictitious `awardRunXP` call with the **real** `saveRunActivity` Cloud Function:
```
earnedXp    = floor(distanceKm * 100 + durationMinutes * 2)
earnedCoins = floor(distanceKm * 10)
```
Apply a client-side ×2 coin bonus if the user is Pro (matches RN exactly — this is genuinely client-side in RN too, not a server behavior to "fix"). **Do not build level-up, streak bonuses, pace bonuses, or time-of-day coin bonuses** — none of that exists in RN's real backend; it would be inventing new product behavior, not porting. Badge unlocking is a separate client-computed step (the `BADGES` catalogue in §3) that runs after the Cloud Function call and writes via `arrayUnion` directly from the client (not server-validated in RN — flag as a known integrity gap, worth fixing properly in the Kotlin backend if there's appetite). **Match the `coins` (not `wallet.coins`) field name** if Firestore schema interop with RN data matters.

---

## 10. TrainingPlanScreen — Habits subsystem (RN `src/screens/PlanScreen.js`, embedded, ~lines 139-165, 549-660, 867-907)

This is the piece of `PlanScreen.js` **not yet ported** per the roadmap (the core plan-generation algorithm and status toggles were already ported — see `RN_ANDROID_PORT_MAPPING.md`'s TrainingPlanScreen entry).

### Data model (Firestore, `UserContext.js` lines 393-432)

Collection `users/{uid}/habits/{habitId}`, fields: `name` (default 'New Habit'), `description` (default ''), `frequency` (default 3, target days/week), `icon` (MaterialCommunityIcons name, default `'run-fast'`), `completions` (array of `"YYYY-MM-DD"` date strings), `createdAt` (ISO string).

Context functions:
- `subscribeToUserData` sets up an `onSnapshot` on `users/{uid}/habits`, sorted by `createdAt` ascending, feeding `habits` state.
- `addHabit(habitData)` → `addDoc(collection(...,'habits'), {...defaults, completions: []})`.
- `deleteHabit(habitId)` → `deleteDoc`.
- `toggleHabitCompletion(habitId)` → toggles today's date (`new Date().toISOString().split('T')[0]`) in/out of the `completions` array via a plain array filter/push, then `updateDoc`.

### UI (PlanScreen.js, "My Habits" section)

- Section header "My Habits" + count subtext ("{n} habit(s) tracked") + "Add" button (opens the Add Habit modal).
- Empty state: tappable card "Build a habit / Track daily habits alongside your training" → opens Add modal.
- **Per-habit card**, computed fresh on every render (no memoization needed — cheap):
  - `today = new Date().toISOString().split('T')[0]`; `isDoneToday = completions.includes(today)`.
  - `monthStart` = first of current month; `weekStart` = most recent Sunday at midnight (`now.getDate() - now.getDay()`).
  - `monthCount` = completions this month; `weekCount` = completions this week.
  - `freq = max(habit.frequency||3, 1)`; `weekPct = min(round(weekCount/freq*100), 100)`.
  - Card visuals: left accent bar (lime if done today), icon box (lime-tinted if done today), title + description (or `` `${freq}× per week` `` fallback), a "🔥 On fire" badge if `weekPct>=100`, delete button (trash icon → confirm alert → `deleteHabit`).
  - Stats row: 3 cells — "This month" (`monthCount`), "This week" (`weekPct`%, lime if ≥100), "Total" (`completions.length`).
  - Progress bar: gradient fill (brighter/two-tone gradient if `weekPct>=100`) showing `weekPct` width, plus a `weekCount/freq` text label.
  - **Heatmap** (`renderHeatmap(getHabitIndices(completions))`): a GitHub-contributions-style grid.
    - `HEATMAP_COLS = 16` (weeks back), cell size computed to fit screen width: `floor((width - 108 - (cols-1)*gap) / cols)`, `gap = 3`.
    - `getHabitIndices(completions)`: for each completion date, computes `diffWeeks = floor((today - date) / (7*86400000))`; if `0 <= diffWeeks < 16`, marks cell index `date.getDay()*16 + (16-1-diffWeeks)` as active. Grid is rendered as `7 rows × 16 cols` (day-of-week × week-offset), with row labels `['S','M','T','W','T','F','S']`.
  - Mark-complete button ("Mark Done" / done state) → `toggleHabitCompletion(habit.id)`.

### Add Habit modal (bottom sheet, `Modal` slide-up)

Fields: Habit name (required, placeholder "Habit name (e.g. Daily Run)"), Description/goal (optional), "Days per week" — chip row 1–7 (default 3), "Icon" — picker grid of 12 MaterialCommunityIcons options: `run-fast, dumbbell, water, sleep, food-apple, meditation, bike, walk, yoga, heart-pulse, book-open-variant, pencil`. "Create Habit" button disabled until name is non-empty; on submit calls `addHabit({name, description, frequency, icon})` and resets all fields.

### Suggested scope for Android port

This is a fully independent sub-feature from the plan-generation logic already ported — a straightforward CRUD + derived-stats + heatmap-visualization component. The heatmap especially will need a Compose `Canvas`/`LazyVerticalGrid`-based equivalent of the 7×16 cell grid.

---

## Manifest of raw files copied verbatim (in this same `docs/rn-reference/` directory)

- `badges.js` — the full `BADGES` catalogue (see §3 above for the parsed table, but this is the authoritative source including exact description copy/icons/colors).
- `countries.js` — country list used by the country-picker (Profile country selector, per earlier ProfileScreen survey in `RN_ANDROID_PORT_MAPPING.md`).
- `helpData.js` — the fallback `HELP_CATEGORIES` FAQ content (see §6c above for the parsed summary; this file has the exact answer copy).
- `theme.js` — RN's design tokens (colors, spacing, etc.) — cross-reference against `com.ruvo.app.designsystem.theme.RuvoColors` for any values Android might be missing or diverging on.
- `functions_index.js` — the **entire live Cloud Functions backend** (`redeemReward`, `askGemini`, `deleteAccountData`, `saveRunActivity`) verbatim. This is shared infrastructure both apps hit — the ground truth for any future Android Cloud Function integration work, and the definitive answer to "does function X actually exist" (see the Known Backend Bugs section of `RN_ANDROID_PORT_MAPPING.md`).
- `UserContext.js` — the **entire RN data-layer file** (2174 lines) verbatim. This is the single most valuable reference file in this archive — nearly every Firestore field name, write shape, and business-logic function referenced throughout this document and the mapping doc traces back to this file. When in doubt about exact behavior, read this first.
- `badgeService.js` — `checkNewBadges()` implementation (badge-unlock evaluation engine, see §3).
- `referralService.js` — `generateReferralCode`/`validateReferralCode`/`processReferralReward` (see the Referral section of `RN_ANDROID_PORT_MAPPING.md`'s Completed Work Log for the already-ported schema fix).
- `useAnalytics.js` — the full Analytics/PR/VO2/Race-Predictor/Recovery-Score calculation hook (see §2 for the parsed summary; this file has every exact formula).
- `helpers.js` — small utilities including `detectShoeDistance` (already ported into Android's `ShoeTrackerScreen.kt`) and other shared formatting helpers.
- `passwordStrength.js` — `checkPasswordRules`/`isPasswordValid` (the 6-rule password policy + common-password blocklist, see §7 SignUpScreen).
- `rateLimit.js` — `checkRateLimit`/`recordFailedAttempt`/`resetAttempts` (the exponential-backoff login lockout logic, see §7 LoginScreen).

## API keys / secrets extracted

Copied into `local.properties` (gitignored) and wired as `BuildConfig` fields in `app/build.gradle.kts`:
- `GOOGLE_WEB_CLIENT_ID` = `385760905493-be6m37hdo6rhh86v1tb8id0o73imjc71.apps.googleusercontent.com` (for Google Sign-In `GoogleSignin.configure` — Android's `GoogleSignInButton` in `AuthScreen.kt` is currently a UI stub not wired to real Credential Manager sign-in; this value will be needed when that's implemented).
- `FACEBOOK_APP_ID` = `1107758504810502`, `FACEBOOK_CLIENT_TOKEN` = `0c30b1d5e28034655c0b7d6d956cc80e` (Facebook login — Android has no Facebook login implementation at all yet).

Firebase config (`google-services.json`, `.firebaserc`) confirmed to point at the **same Firebase project** (`ruvo-app-99c85`) already used by Android — no action needed, already shared.

RevenueCat, Maps, and other keys already present in Android's `local.properties` matched RN's values (`REVENUECAT_API_KEY` = `goog_xdIDuWutQSsqvTEGPExtzArXyOm` in both). Oura/Whoop/OpenWeather client IDs are **unconfigured placeholders in RN too** (`'your_oura_client_id'` etc.) — nothing real existed to extract for those; they remain empty in both projects until someone registers real developer accounts.
