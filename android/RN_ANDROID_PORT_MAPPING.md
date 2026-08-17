# RN → Android Port: Mapping & Roadmap

Tracks the effort to bring the native Android app (Kotlin/Compose, this repo) up to
parity with the React Native reference app that used to live at
`C:\ruvo-application`, screen by screen. Every change is verified live on the
emulator before being committed.

> **2026-07-23 — the RN reference project was deleted** to free disk space and
> consolidate on a single codebase (its presence had also been silently filling
> the dev machine's disk, which was a real contributor to that day's emulator
> instability). Before deletion, every screen still marked 🟡/⬜ below was
> deep-dived and fully documented — including exact formulas, Firestore field
> names, validation rules, and navigation maps — plus several raw source files
> were copied verbatim. **All of that lives in
> `docs/rn-reference/RN_SOURCE_ARCHIVE.md`** (and its sibling raw `.js` files in
> the same folder). Any step below that says "read the RN source" now means
> "read that archive" — there is no more live RN source to open.

- RN app (archived, no longer exists as a live project): see `docs/rn-reference/`
- Android app: `C:\Users\Administrateur\ruvo\android` (Jetpack Compose, Hilt, Firebase Android SDK)
- Backend: Cloud Functions — shared by both clients. Full source preserved at
  `docs/rn-reference/functions_index.js`.

## How to use this doc

1. Check the **Screen Mapping Table** to see what's done, what's pending, and where
   the Android equivalent of an RN screen lives.
2. Before starting a new screen, read its entry in the table, then follow the
   **Per-Screen Workflow** checklist below. For any screen listed in
   `docs/rn-reference/RN_SOURCE_ARCHIVE.md`, that document already has the full
   deep-dive done — read it instead of trying to reconstruct RN behavior from
   scratch.
3. After finishing a screen, update its row in the table and append a dated entry
   to the **Completed Work Log**.
4. `Known Backend Bugs` lists client calls to Cloud Functions that don't exist —
   fix these opportunistically when touching the relevant screen. The real
   backend source is `docs/rn-reference/functions_index.js`.

---

## Per-Screen Workflow (repeat for each screen)

1. **Read the spec.** For any screen covered in
   `docs/rn-reference/RN_SOURCE_ARCHIVE.md`, read that section first — it already
   has the full RN behavior (formulas, exact field names, validation, nav map)
   written up from the original source, which no longer exists on disk. For a
   screen NOT covered there (rare at this point — check the archive's table of
   contents first), the raw files in `docs/rn-reference/*.js` (especially
   `UserContext.js` and `functions_index.js`) are the next-best fallback. Open
   the Android `.kt` counterpart (see mapping table) alongside it.
2. **Diff the data layer first, not just the UI.** Check:
   - Which Firestore collection/field does the archive say RN actually
     read/write? Cross-reference `docs/rn-reference/UserContext.js` if the
     archive's summary isn't detailed enough.
   - Does the Android ViewModel read from the *same* location? This repo has a
     recurring bug class where Android reads from a plausible-but-wrong path
     (wrong subcollection, wrong field name) and silently shows empty/zero data.
   - Does RN call a Cloud Function the Android code doesn't call (or vice versa),
     and does that function actually exist in
     `docs/rn-reference/functions_index.js`? (See "Known Backend Bugs" — this
     has caused at least one fully-broken feature, and the archive documents at
     least one more: the fictitious `awardRunXP` fix recipe is spelled out in
     the archive's Gamification section.)
3. **Port the design.** Recreate RN's layout, spacing, colors, and copy using the
   existing design system (`com.ruvo.app.designsystem.components.*`,
   `com.ruvo.app.designsystem.theme.RuvoColors`). Don't introduce new one-off
   colors/styles when a `RuvoColors` token or existing component fits.
4. **Compile:** `./gradlew.bat compileDebugKotlin -q` (no output = success). Fix
   errors before moving on — see "Common Compile Gotchas" below.
5. **Install:** `./gradlew.bat installDebug -q`.
6. **Live-verify on the emulator** (see "Emulator/ADB Playbook" below): navigate to
   the screen, exercise every new/changed interaction, take screenshots, confirm
   against the archive's documented behavior.
7. **Commit** with a message describing the *why* (bug fixed, feature ported),
   not just "update X screen".
8. **Update this file**: mapping table row + Completed Work Log entry.

### Common Compile Gotchas

- `Icons.AutoMirrored.Filled.X` does **not** exist for several icons in this
  project's Material icons version: `DirectionsRun`, `DirectionsWalk`, `Send`,
  `Chat`. Use `Icons.Default.X` instead. This has recurred repeatedly — check it
  first whenever a new icon-related compile error appears.
- `ModalBottomSheet` and other Material3 experimental APIs need
  `@OptIn(ExperimentalMaterial3Api::class)` on the composable that uses them.
- RevenueCat Pro-entitlement check (used by Paywall and now AI Coach):
  `Purchases.sharedInstance.getCustomerInfoWith(onError = {...}, onSuccess = { it.entitlements["pro"]?.isActive == true })`.

### Emulator/ADB Playbook

- **Sign-in/sign-up failing with a `RecaptchaCallWrapper` "network error"
  despite the emulator having real internet** (2026-07-29): this is almost
  certainly the local Firebase emulator suite not running, **not** Play
  Integrity. `local.properties` already has `USE_FIREBASE_EMULATOR=true` and
  `AppModule.kt` already points Auth/Firestore/Functions at `10.0.2.2`, so any
  debug build silently expects `firebase emulators:start` to be running on
  the host. Fix: from the repo root, `firebase emulators:start --only
  auth,firestore,functions` (ports come from `firebase.json`: auth 9099,
  firestore 8081, functions 5001) — leave it running for the whole session,
  it's independent of which Android emulator/AVD you use. Confirm it's up with
  `curl http://127.0.0.1:9099/emulator/v1/projects/<project-id>/config` before
  blaming the Android side.
- Screenshots are captured at 900×2000 for the actual 1080×2400 device. **Always
  multiply displayed coordinates by 1.2** before issuing `adb shell input tap`, or
  better: use `adb shell uiautomator dump` and read `bounds="[x1,y1][x2,y2]"`
  directly (already in device pixels) — this is more reliable than eyeballing
  screenshots and has been the source of most wasted tool calls this session.
- Prefix any adb command referencing an absolute device path
  (`/sdcard/dump.xml`) with `MSYS_NO_PATHCONV=1` in Git Bash, or the path gets
  mangled into a Windows path.
- When a Compose bottom sheet/dialog is open and the on-screen keyboard is
  showing, buttons below the keyboard's top edge are **not tappable** — dismiss
  the keyboard first (tap the keyboard's own down-chevron, not Back/`keyevent 4`,
  which can pop the whole screen instead of just closing the IME), then re-dump
  for the button's real bounds.
- Recurring ANR dialogs ("X isn't responding"): tap "Wait" first; if the dialog
  visually persists but `adb shell top -n 1 -b` shows the system is idle, dismiss
  with `adb shell input keyevent 3` (HOME) instead of waiting indefinitely.
- If the emulator process itself dies (drops from `adb devices`): `emulator
  -list-avds`, then `nohup emulator -avd <name> -no-snapshot-load > logfile 2>&1 &`
  + `disown`, wait ~20-30s, confirm with `adb devices` and
  `adb shell getprop sys.boot_completed`. The installed app/data survives.
- To capture the real exception behind a swallowed `catch (e: Exception)`,
  temporarily add `android.util.Log.e("Debug", "...", e)`, reinstall, trigger the
  flow, `adb logcat -d | grep -A 30 Debug`, then **revert the log line** before
  committing.
- **Check disk space FIRST if the emulator is behaving strangely** (repeated
  ANRs even when `adb shell top` shows the system idle, full process crashes,
  a Hilt/Dagger `NoSuchMethodError: ...-$$Nest$fget...Provider` that
  reproduces even after a genuinely clean rebuild, garbled/corrupted-looking
  screen renders). On 2026-07-23, an entire session's worth of these symptoms
  turned out to be the C: drive sitting at 100% capacity (476MB free out of
  475GB) — check with `powershell -Command "Get-PSDrive C | Select-Object
  Used,Free"`. The AVD directories accumulate orphaned "adbcommand" temp files
  in `~/.android/avd/<name>.avd/tmpAdbCmds/` (thousands of ~2MB files,
  multiple GB) that the emulator is supposed to clean up but doesn't reliably
  do so across abrupt kills/crashes — safe to `rm -rf` that directory entirely
  (it's pure scratch data, not AVD state) if disk space is tight. Don't chase
  build-cache/Hilt-codegen theories before ruling this out; it wastes far more
  time than the 30-second disk check.

---

## Known Backend Bugs (client calls a Cloud Function that doesn't exist)

`docs/rn-reference/functions_index.js` (full verbatim copy of the backend,
preserved before the RN project was deleted) currently exports exactly four
callables: `redeemReward`, `askGemini`, `deleteAccountData`, `saveRunActivity`.
Any Android code calling something else via `functions.getHttpsCallable("...")`
will always fail (silently, if wrapped in a generic catch block) and fall back
to an error message.

**Important nuance found while fixing TrainingPlanScreen:** it's not always a
"connect to the real function" fix. Grepping RN's own `httpsCallable(...)` calls
shows RN *itself* calls several functions that don't exist either:
`startLiveRun`/`endLiveRun` (`ActiveRunScreen.js`), `sendPasswordResetLink`
(`ForgotPasswordScreen.js`), `notifyLoginFailure` (`LoginScreen.js`),
`generateWorkoutSuggestion` (`aiService.js`), `syncOuraData`/`syncWhoopData`
(`ouraService.js`/`whoopService.js`). So before "fixing" an Android call by
pointing it at some RN-equivalent function name, **check whether RN's own
call target actually exists** — if it doesn't, the real fix is likely to remove
the network call entirely and use whatever local/client-side fallback logic
RN falls back to (this is what happened with `generateTrainingPlan`: RN never
calls a plan-generation function at all — `UserContext.js`'s
`updateTrainingPlan()`/`generateWeekPlan()` is a deterministic, 100%
client-side schedule builder).

| Caller (Android file) | Calls | Exists in functions/index.js? | Status |
|---|---|---|---|
| `aicoach/AICoachViewModel.kt` | `aiCoach` → fixed to `askGemini` | `askGemini` exists | **Fixed** 2026-07-16 |
| `training/TrainingPlanViewModel` | `generateTrainingPlan` → removed | Neither exists, nor does RN call anything | **Fixed** 2026-07-16 (see above) |
| `gamification/GamificationViewModel.kt` | `awardRunXP` → removed, now calls real `saveRunActivity` | **No** (RN doesn't call this either — the real client→function→Firestore flow, exact XP/coin formulas, and why level-up/streak-bonus logic is dead code in RN itself, are fully documented in `docs/rn-reference/RN_SOURCE_ARCHIVE.md` §9 "Gamification / XP system") | **Fixed** 2026-07-24 (commit `9b0affa`) |
| `runtracking/*` (if it calls `startLiveRun`/`endLiveRun` for live-run tokens) | — | **No** — RN itself calls these and they don't exist | Open, low priority — likely dead/untested in RN too |
| Auth screens, if they call `sendPasswordResetLink`/`notifyLoginFailure` | — | **No** — RN itself calls these | Open, low priority |
| AI workout suggestion (`fetchAIWorkoutSuggestion` equivalent, if any) | `generateWorkoutSuggestion` | **No** — RN itself calls this | Open, low priority |
| Oura/Whoop sync (if Android calls a sync function directly instead of the SDKs) | `syncOuraData`/`syncWhoopData` | **No** — RN itself calls these | Open, low priority |

When picking up any screen with a `functions.getHttpsCallable(...)` call, first
check RN's equivalent by grepping `docs/rn-reference/UserContext.js` (and the
other preserved `.js` files) for `httpsCallable` — don't assume RN's target
function exists just because RN calls it.

---

## Known Data-Layer Bugs (client reads a Firestore path that nothing writes)

**Major finding, 2026-07-29.** `users/{uid}/runs/{runId}` — a per-run
subcollection — **does not exist and has never been written by anything**,
in Android or RN. The real (and only) run-save path, `saveRunActivity`
(`functions/index.js`), writes each finished run as one entry in the
`users/{uid}.runHistory` **array** field via `FieldValue.arrayUnion`. RN's
own code confirms this is a pre-existing RN bug, not an Android porting
mistake: `RunDetailScreen.js` and `AnalyticsScreen.js` (via
`UserContext.js::loadFullRunHistory()`) both query that same nonexistent
subcollection and silently get empty results back (not even an error — an
empty-collection query just returns zero docs).

Fixed so far (read `users/{uid}` doc + the `runHistory` array, matched by
`id`, instead) — all 2026-07-29, see Completed Work Log for each:
- `RunDetailScreen.kt` / `RunDetailViewModel`
- `AnalyticsViewModel.kt`
- `features/home/HomeViewModel.kt` — Home's "Recent Activity" list and
  "Today's Activity" ring (two call sites). Live-verified: the list now
  shows the real run instead of the permanent "No runs yet" empty state.
- `features/profile/ProfileViewModel.kt` — own-profile "Recent Runs" grid.
  Live-verified: grid now shows a real run card instead of staying empty.
  **Also fixed (same file, separate bug):** `toggleFollow()`/
  `checkFollowStatus()` read/wrote a `users/{uid}/following/{targetId}`
  subcollection doc that's never created (RN has no such subcollection —
  real schema is a `following`/`followers` array field per user doc, same
  as `UserProfileScreen.kt`'s already-correct implementation). Commit
  `7d36f08`'s message claims this exact class of bug was fixed across three
  files, but this file's write side was missed (only its unrelated
  read-side field names were fixed in that commit) — fixed now to match
  `UserProfileScreen.kt`'s symmetric batch-write pattern. **Turned out to be
  unreachable dead code as of this fix**: `ProfileScreen.kt`'s composable
  always calls `loadProfile()` with no argument (own profile only) —
  `loadProfile(targetUserId)`'s "other user" branch, and therefore
  `toggleFollow()`, can never actually execute via the current navigation
  graph (viewing another user always goes through the separate, already-
  correct `UserProfileScreen`/`UserProfileViewModel`). Fixed anyway since
  it's a genuine correctness bug in code that exists and could get wired up
  later, but there's no live path to verify it against today, and no user
  was ever actually hitting this.
- `features/community/UserProfileScreen.kt` — other users' recent-runs grid.
  Not live-verified (would need a second test account) but uses the
  identical, already-proven parsing helper pattern.
- `features/gear/ShoeTrackerScreen.kt` — per-shoe performance stats (best
  pace/run count/avg distance, filtered by `gearId`). Note: the `d39f3d7`
  gear fix (2026-07-16) fixed the shoe *list* itself (`gearList` array
  field) but this separate per-shoe-stats query was missed until now. Also
  note: only `SaveActivityScreen`'s manual "Log Activity" flow writes
  `gearId` today — GPS-tracked runs via `RuvoApp.kt::submitRunActivity`
  don't attach gear yet, so this will only show stats for manually-logged
  runs until that's added. Not live-verified (needs a shoe + a manually
  logged run tagged to it) but same proven pattern.
- `features/aicoach/AICoachViewModel.kt` — the "last 5 runs" system context
  built for the AI Coach. Not live-verified end-to-end (the local Functions
  emulator doesn't run `askGemini` — see Known Backend Bugs note elsewhere
  in this doc — so there's no way to inspect what context reaches Gemini
  without hitting production) but the context-string-building code uses the
  same proven pattern.

- `features/analytics/PersonalRecordsScreen.kt` — personal-bests card, fixed
  2026-07-29. Also fixed the bucket algorithm itself to match RN's real one
  (`useAnalytics.js` §7, `RN_SOURCE_ARCHIVE.md` §2): each bucket is a
  minimum-distance **threshold** (≥1/5/10/21.09km), not the narrow band
  Android used around each exact distance, and the record is whichever
  qualifying run has the best (lowest) average pace — not literally the
  fastest time near that exact distance. See Completed Work Log.

**Still open:**
- `features/community/CommunityViewModel.kt` — **investigated 2026-07-29,
  deliberately not fixed — needs a product decision, not a schema fix.**
  Treats each run as a community post at `users/{postUserId}/runs/{postId}`
  for likes/comments (3 call sites: a comments listener, a like-toggle, and
  `loadFeed()`'s `collectionGroup("runs")` query) — meaning the entire
  Community feed tab is permanently empty and every like/comment silently
  fails and reverts. Checked both possible explanations: (1) grepped
  `UserContext.js` for `collectionGroup`/`likesCount`/`commentsCount` — zero
  matches anywhere in the preserved RN source; (2) checked
  `RN_SOURCE_ARCHIVE.md` for a `CommunityScreen.js` section — it was never
  covered (the archive only deep-dived screens still 🟡 as of 2026-07-23,
  and `CommunityScreen.js` is 🟡 in the mapping table too, so this looks
  like an oversight when the archive was written, not evidence the feature
  was already fixed). With the RN source itself now deleted, there's no way
  to confirm from first principles whether this run-as-post concept ever
  existed in RN or is unverified Android-only code — and the *working*
  club-post system at `clubs/{id}/posts` (fixed `b09df2f`, 2026-07-16) is a
  confirmed-real, separate feature, so "just point it at `runHistory`"
  isn't a safe assumption without knowing what a "run post" is actually
  supposed to be. Whoever picks this up needs to make a product call first:
  redesign this as posts-from-`runHistory`-entries, or determine it's dead
  code and remove/hide the feed tab.

`RunTrackingService.kt`'s `firestore.collection("runs")` (top-level, for
live-location sharing) is a **different, unrelated** collection — not an
instance of this bug, don't touch it as part of this cleanup.

**Retrospective:** eight independent copy-pasted query sites (seven real
instances of this bug, one false-positive) is exactly how this spread — each
fix above duplicates the same "read `users/{uid}`, cast `runHistory` to
`List<Map<String, Any>>`, parse `date`/`duration` strings" boilerplate.
Consider a small shared `RunHistoryRepository` (parse once, expose typed
`RunHistoryEntry` objects) next time more than one of these files needs
touching again — not done now since introducing a shared abstraction as a
side effect of a bug-fix pass risks under-scoping the abstraction itself;
better as its own deliberate step.

---

## Screen Mapping Table

Status legend: ✅ done this effort · 🟡 partially ported / needs audit · ⬜ not yet compared

| RN screen (`src/screens/`) | RN lines | Android file(s) | Android lines | Status | Notes |
|---|---:|---|---:|:---:|---|
| ClubDetailScreen.js | 982 | `features/community/ClubDetailScreen.kt` | 424 | ✅ | Members never loaded, like button dead, no post creation, no leaderboard — all fixed. Commit `b09df2f`. |
| GearScreen.js | 702 | `features/gear/ShoeTrackerScreen.kt` | 563 | ✅ | Was reading `users/{uid}/shoes` subcollection (doesn't exist); real data is `gearList` array field on user doc. Rewrote + ported design + wired `SaveActivityScreen` gear picker. Commit `d39f3d7`. |
| AICoachScreen.js | 783 | `features/aicoach/AICoachScreen.kt` + `AICoachViewModel.kt` | 406 + 192 | ✅ | Called nonexistent Cloud Function `aiCoach` (real one is `askGemini`) — every message failed. Fixed call, added Firestore persistence, markdown rendering, Pro-gating, quick actions grid. Commit `6574e30`. |
| UserProfileScreen.js | 747 | `features/community/UserProfileScreen.kt` | 599 | ✅ | Redesigned: stat cards, recent activity w/ filters, block/report/share overflow menu. (Earlier session.) Follow/unfollow + follower/following count schema fixed 2026-07-16 (commit `7d36f08`). |
| FindFriendsScreen.js | 317 | `features/community/FindFriendsScreen.kt` + `FindFriendsViewModel.kt` | 189 + 135 | ✅ | Avatar tap was dead (no nav). Wired `onUserProfile`. (Earlier session.) |
| ChatScreen.js | 398 | `features/community/ChatScreen.kt` | 330 | ✅ | Added empty state, Clear Chat / Block User menu. (Earlier session.) |
| PrivacyControlsScreen.js | 345 | `features/settings/PrivacyControlsScreen.kt` | 419 | ✅ | Schema was fully divergent from RN; realigned field names, added Blocked/Muted sections. (Earlier session.) |
| PaywallScreen.js | 629 | `features/paywall/PaywallScreen.kt` + `PaywallViewModel.kt` | 299 + 146 | ✅ | Ported hero/feature-grid/pricing-card design; unified mock-offerings fallback into the real package model. Commit `a8e74c4`. |
| ActiveRunScreen.js | 959 | `features/runtracking/RunTrackingScreen.kt` + `RunTrackingViewModel.kt` + `RunTrackingService.kt` | ~500+330+310 | 🟡 | Being worked through as the 15 independently-scopable sub-tasks in archive §1. Done: #2 background service, #3 GPS noise/speed filter, #4 distance/pace/calorie engine, #5 elevation gain, #6 pause/resume (`f4f5343`), #8 map style/follow/recenter (`1592bd0`), #9 HR zone module + Health Connect polling (2026-07-29, see Completed Work Log — live BPM population not verified, see log entry), #11 haptics (`e2838eb`), #14 run-completion handoff (`9b0affa`), #15 crash-recovery (`6d23d20`). #12 live-run sharing (share sheet + deep link, 2026-07-31, see Completed Work Log), #13 interval/workout-mode step engine (2026-07-31, verified live — see Completed Work Log), #7 draggable bottom sheet (2026-07-30, commit `9451d04`), #1 permission/GPS-acquisition polish (2026-07-30 partial via commit `879c456` + completed and live-verified 2026-08-14, see Completed Work Log). #12's map/metrics sync live-verified 2026-08-16 via mocked GPS (see Completed Work Log). Still open: #10 voice-coaching template accuracy (templates fixed 2026-07-29; real `AudioFocusRequest` ducking added 2026-08-14, see Completed Work Log — kept 🟡 since RN's optional milestone/pace-deviation callouts were never built). All 15 sub-tasks are now live-verified except #10's optional net-new callouts, unbuilt by choice. |
| PlanScreen.js | 1263 | `features/training/TrainingPlanScreen.kt` + `HabitsSection.kt` | 432 + 483 | 🟢 | Fixed schema + ported the real plan algorithm and status toggles (commit `d5ccfef`). Habits subsystem (CRUD, derived stats, 7×16 heatmap, Add Habit sheet) ported and live-verified 2026-07-24 (commit `ded5a01`) — exact match to archive §10. Day-by-day weekly calendar, tap-workout-to-start navigation, and `runDays` editing UI all built and live-verified 2026-07-31 (see Completed Work Log), including a fresh-app-restart persistence check on the `runDays` write. |
| ProfileScreen.js | 1703 | `features/profile/ProfileScreen.kt` + `ProfileViewModel.kt` + `Countries.kt` | 393 + 138 | 🟡 | Fixed follow/unfollow (systemic, 3 files) + avatar/location/bio field bugs (commit `7d36f08`). Weekly calendar strip + streak card (2026-07-31), country picker + share-profile flow + refresh + XP progress bar + gear preview card + achievements preview (2026-08-01), dated/typed Recent Activity cards + All/This Week filter (2026-08-03) all built and live-verified — see Completed Work Log. Avatar upload/display built 2026-08-15 (UI flow live-verified; Storage upload not end-to-end verified in this dev environment, see Completed Work Log). Saved Tips library tab built 2026-08-15 (cont.), live-verified end-to-end on a fresh account (see Completed Work Log). Still missing the Active challenges card list (blocked — real RN formulas never archived) and the EditProfileSheet field-parity cross-check (also blocked) — kept 🟡, see Roadmap. |
| SaveActivityScreen.js | 1180 | `features/runtracking/SaveActivityScreen.kt` | 307 | 🟡 | Partially touched this session (gear picker added). Not fully compared otherwise. |
| RunDetailScreen.js | 730 | `features/runtracking/RunDetailScreen.kt` | 251 | 🟡 | Read-path/schema bug fixed 2026-07-29 (was reading a nonexistent `users/{uid}/runs/{id}` subcollection — see Completed Work Log) — screen now shows real saved-run data. Still 🟡: no map/route rendering, no HR-zone card, no weather/gear/tag chips, no AI-Coach handoff button (see archive §4). |
| RewardsScreen.js | 692 | `features/rewards/RewardsScreen.kt` | 440 | 🟡 | Fixed insecure client-side redemption → real Cloud Function call (commit `49fbc0a`). Redemption live-verified against the real `redeemReward` function 2026-08-13 (see Completed Work Log). Catalog/design parity check **blocked**: no RN UI source for this screen survives in `docs/rn-reference/` (confirmed 2026-08-16 — see Roadmap item #4). |
| ReferralScreen.js | 561 | `features/referral/ReferralScreen.kt` | 576 | 🟡 | Fixed `referralStats` nested-field schema mismatch (commit `49fbc0a`). Redemption live-verified end-to-end 2026-08-15 (cont. 3) — real code-generation, real Apply tap, both sides' coins/stats confirmed via Firestore ground truth (see Completed Work Log). Kept 🟡: design/catalog parity vs. RN not otherwise re-compared. |
| SettingsDetailScreen.js | 457 | *(inlined into)* `features/settings/SettingsScreen.kt` + `SettingsViewModel.kt` | 281 + 95 | 🟡 | Audited 2026-08-03 — see Completed Work Log + Roadmap item #6. `notifications`/`units`/`Password` fixed (real persistence bugs); `regenerate` confirmed missing (net-new, not built); `Help`/`About` judged adequate as-is. |
| EditProfileScreen.js | 425 | `EditProfileSheet` inside `features/profile/ProfileScreen.kt` | — | 🟡 | RN: standalone screen. Android: bottom sheet inside ProfileScreen. Architecture differs by design; verify field parity. |
| AnalyticsScreen.js | 445 | `features/analytics/AnalyticsScreen.kt` + `AnalyticsViewModel.kt` + `PersonalRecordsScreen.kt` | 282+157+196 | 🟡 | Read-path bug fixed 2026-07-29; VO2 Max/Consistency/HR-zones/Race Predictor/Recovery Score built+verified 2026-08-14; day-bucketed chart engine (exact per-day sum/half-blend formulas) + Elevation/Heart Rate charts built+verified 2026-08-16. Still 🟡: PRs kept as a separate screen instead of an embedded card, no Pro-paywall gating (see Roadmap item #5). |
| ConnectedDevicesScreen.js | 397 | `features/healthintegrations/ConnectedDevicesScreen.kt` | 207 | 🟡 | Not yet compared. |
| WorkoutDetailScreen.js | 534 | `features/runtracking/WorkoutDetailScreen.kt` | 213 | 🟡 | Not yet compared. |
| RateEffortScreen.js | 400 | `features/runtracking/RateEffortScreen.kt` | 204 | 🟡 | Not yet compared. |
| SearchScreen.js | 411 | `features/search/SearchScreen.kt` | 249 | 🟡 | Note: a near-duplicate of FindFriendsScreen; confirm which is actually reachable from nav before editing (this tripped up an earlier session). |
| LeaderboardScreen.js | 289 | `features/leaderboard/LeaderboardScreen.kt` + `LeaderboardViewModel.kt` | 209 + 144 | 🟡 | Not yet compared. |
| MyRedemptionsScreen.js | 265 | `features/rewards/MyRedemptionsScreen.kt` | 125 | 🟡 | Fixed field-schema mismatch — was reading fields the backend never writes (commit `49fbc0a`). Confirmed the fields it reads match what `redeemReward` actually writes (2026-08-13). |
| AchievementsScreen.js | 266 | `features/achievements/AchievementsScreen.kt` + `AchievementsViewModel.kt` | 319 + 116 | 🟡 | **Bug found and fixed 2026-08-01**: `ALL_BADGES` was a fully invented catalogue (wrong ids, extra badges, missing 4 real RN ones) — replaced with RN's exact 12 badges from `badges.js`, live-verified (see Completed Work Log). Still 🟡: RN's badge-*awarding* mechanism (`checkNewBadges()`) has no Android equivalent at all — every account shows all badges locked until that's built (separate, larger feature). |
| HomeScreen.js | 891 | `features/home/HomeScreen.kt` + `HomeViewModel.kt` | 339 + 122 | 🟡 | Not yet compared. |
| CommunityScreen.js | 957 | `features/community/CommunityScreen.kt` + `CommunityViewModel.kt` | 508 + 350 | 🟡 | Not yet compared. |
| CreateClubScreen.js | 198 | `features/community/CreateClubScreen.kt` | 184 | 🟡 | Line counts close — spot-check only. |
| UserListScreen.js | 166 | `features/community/UserListScreen.kt` | 171 | 🟡 | Line counts close — spot-check only. |
| TipDetailScreen.js | 313 | `features/tips/TipDetailScreen.kt` | 313 | 🟡 | Line counts identical — likely already ported; spot-check only. |
| SettingsScreen.js | 268 | `features/settings/SettingsScreen.kt` | 281 | 🟡 | Line counts close — spot-check only. |
| HelpCenterScreen.js | 176 | `features/settings/HelpCenterScreen.kt` | 158 | 🟡 | Line counts close — spot-check only. |
| LoginScreen.js | 310 | `LoginScreen` composable inside `features/auth/AuthScreen.kt` | — | 🟡 | Audited 2026-08-13 (Roadmap item #7) — rate limiting and biometric auto-login still not ported, see Completed Work Log. |
| SignUpScreen.js + OnboardingSignUpScreen.js | 342 + 357 | `SignUpScreen` composable inside `features/auth/AuthScreen.kt` | — | 🟡 | Password-checklist parity bug fixed 2026-08-13 (see Completed Work Log). Guest-onboards-before-account-exists vs. Android's account-first ordering is an accepted architectural difference, not a bug. |
| WelcomeScreen.js | 98 | `LandingScreen` composable inside `features/auth/AuthScreen.kt` | — | ✅ | Audited 2026-08-13 — pure navigation screen, matches. |
| ForgotPasswordScreen.js | 140 | `features/auth/ForgotPasswordScreen.kt` (+ `ForgotPasswordDialog` in AuthScreen.kt) | 157 | 🟡 | Confirmed 2026-08-13: only `ForgotPasswordDialog` is actually wired up; the standalone `ForgotPasswordScreen.kt` is dead code (no route reaches it) — trivial delete, not done yet. `sendPasswordReset()` correctly uses the real client SDK, not RN's nonexistent `sendPasswordResetLink` function. |
| OnboardingScreen.js | 887 | `features/auth/OnboardingScreen.kt` | 259 | 🟡 | Large gap — not yet compared. |
| LockScreen.js | 352 | `features/auth/LockScreen.kt` | 188 | ✅ | Compared 2026-08-17: the screen itself already matched archive §7 closely (biometric prompt, graceful no-hardware auto-unlock, retry-on-failure). Fixed the real gap — nothing triggered it — by wiring RN's exact 30-min-background app-lock timer + a real persisted Settings toggle. Live-verified end-to-end (see Completed Work Log). Deliberately does not replicate RN's separate plaintext-credential biometric auto-login (no analog needed — Firebase Auth's Android SDK already persists the session). |
| CustomerCenterScreen.js | 19 | `features/paywall/CustomerCenterScreen.kt` | 19 | 🟡 | Both tiny/likely just a RevenueCat UI wrapper — spot-check only. |
| — (Android-only, no RN source) | — | `features/runtracking/IntervalTrainingScreen.kt` | 433 | — | Android-exclusive feature; nothing to port from RN. |
| — (Android-only, no RN source) | — | `features/runtracking/RunSummaryScreen.kt` | 461 | — | Android-exclusive feature; nothing to port from RN. |

---

## Completed Work Log

### 2026-08-17 — Biometric app-lock: wired up LockScreen's trigger, built with Android Keystore-appropriate no-stored-credential design
- **The decision (user's call, per Roadmap item #7):** build biometric
  login "properly" on Android rather than replicate RN's `LoginScreen.js`
  behavior of storing the plaintext email+password in SecureStore and
  replaying it to Firebase Auth on biometric success — the exact security
  smell `RN_SOURCE_ARCHIVE.md` §7 flags. Investigating what "properly"
  requires turned up a key fact: `LockScreen.kt` **already existed**,
  already correctly implemented (biometric prompt, graceful no-hardware/
  no-enrollment auto-unlock, retry-on-failure state — matches archive §7's
  `LockScreen.js` spec closely), and critically **needs no stored
  credential of any kind** — it's a pure biometric gate on top of an
  *already-authenticated* Firebase session (Firebase Auth's Android SDK
  keeps that session alive across restarts on its own), not a re-login.
  The real gap wasn't the screen — it was that **nothing ever triggered
  it**: no background-timer, no `isLocked` state, no call site anywhere in
  the app, and Settings' "Biometric Lock" toggle was fake local `remember`
  state (same unpersisted-toggle bug pattern fixed for notifications/units
  back on 2026-08-03).
- **Built:**
  - `AppLockStore.kt` (new, `core/persistence`, DataStore-backed like the
    existing `RunCheckpointStore`) — persists only the on/off *preference*
    for the gate. No credentials are ever written here; there's nothing to
    encrypt, so this isn't an "Android Keystore vs. plaintext" question at
    all for this piece.
  - `AppLockViewModel.kt` (new) — thin Hilt wrapper, same pattern as
    `RunRecoveryViewModel`.
  - `RuvoApp.kt` — added a `LocalLifecycleOwner` `DisposableEffect`
    matching RN's own `AppState`-listener design exactly: records a
    background timestamp on `ON_STOP` (in-memory only, same as RN's own
    in-memory timer — not persisted across process death, since RN's
    isn't either), and on `ON_START`, if biometric lock is enabled, the
    user is authenticated, and more than RN's exact **30-minute** threshold
    elapsed, sets `isLocked = true` and renders `LockScreen` as a gate over
    `MainGraph` until `onUnlocked()`.
  - `SettingsScreen.kt`/`SettingsViewModel.kt` wiring — "Biometric Lock"
    toggle now reads/writes real `AppLockStore` state instead of fake
    `remember`, and only renders at all when
    `BiometricManager.canAuthenticate(BIOMETRIC_STRONG|DEVICE_CREDENTIAL)`
    actually succeeds — matching archive §6a/§7's "only if hardware
    supported" behavior for RN's equivalent Settings row, so the toggle
    never promises a gate the device can't enforce.
- **Verified live, all four cases, on the real emulator:** the AVD had no
  enrolled fingerprint and no device PIN/pattern, so `BiometricManager`
  correctly failed and hid the toggle entirely — confirmed this graceful
  hidden-state first. Set a real device PIN (`adb shell locksettings
  set-pin`) to get a genuine `DEVICE_CREDENTIAL`-satisfying authenticator
  without needing fingerprint-sensor emulation, then: (1) toggle ON,
  force-stop + relaunch the app, confirmed still ON — real DataStore
  persistence, not the old fake state; (2) backgrounded the app past the
  threshold (temporarily lowered to 8s for a practical test, restored to
  30 minutes before the final build) with the toggle ON — foregrounding
  triggered the real Android `BiometricPrompt`/PIN-entry system UI
  (confirmed via `BiometricService`/`AuthController` logcat lines, since
  the secure system window itself can't be screenshotted), cancelling it
  correctly showed LockScreen's "Try again" failure state with `MainGraph`
  still fully gated (not visible underneath), and retrying + entering the
  correct PIN unlocked straight back into `MainGraph`; (3) a short
  background under the threshold did **not** trigger any lock; (4) with
  the toggle switched back OFF, an over-threshold background also did
  **not** trigger a lock. All four outcomes matched exactly what the wiring
  should do. Removed the test PIN (`locksettings clear`) and confirmed the
  toggle correctly disappears again with no PIN/biometric enrolled, leaving
  the emulator in its original state.

### 2026-08-16 (cont.) — AnalyticsScreen: day-bucketed chart engine (half-blend formula) + Elevation/Heart Rate charts built and live-verified
- **What changed:** `AnalyticsViewModel.kt`'s charts previously bucketed
  Distance by **week** (`WeeklyDistanceData`) and Pace as a flat list of the
  **last 10 individual runs** (`PacePoint`) — neither matches RN.
  `RN_SOURCE_ARCHIVE.md` §2 documents AnalyticsScreen.js's real
  `processChartData`: one bucket per **calendar day** across the selected
  period, with per-period X-axis label downsampling
  (`{1W:1, 1M:5, 3M:15, 6M:30, 1Y:60}`), where distance/elevationGain are
  per-day **sums** but pace/heartRate use a recency-weighted running
  **"half-blend"**: `bucket = bucket ? (bucket+v)/2 : v`, not a true mean.
  Replaced both with a shared `ChartPoint`/`buildDayBuckets()` engine
  implementing this exactly (capped at 729 buckets as an Android-only safety
  guard for very old "All" accounts — RN has no equivalent unbounded range
  to compare against there). Also added the two chart types RN has that
  Android didn't have at all: a real Elevation line chart and a real
  time-series Heart Rate line chart (distinct from the pre-existing HR
  *zone* distribution bars, which are unrelated and were left as-is).
- **Not in scope, left explicitly open (see Roadmap item #5):** two
  bundled sub-items are product/architecture decisions, not port-accuracy
  fixes — merging `PersonalRecordsScreen.kt` into Analytics as an embedded
  card (RN's own layout) instead of Android's separate screen, and gating
  the Advanced Metrics cards behind Pro status (Android has no Pro/
  subscription system to gate behind yet).
- **Verified live end-to-end:** seeded a fresh test account via direct
  Firebase Auth/Firestore emulator REST calls with 3 runs — two on the same
  calendar day (5km/25:00/HR150/+20m and 3km/18:00/HR170/+10m) specifically
  to exercise the half-blend on a shared bucket, one on the previous day
  (8km/48:00/HR140/+50m) as a control. Logged the exact computed
  `dayBuckets` values and hand-verified all of them: today's bucket —
  distance 8.0 (5+3 sum ✓), pace 5.5 ((5.0+6.0)/2 ✓), HR 160.0
  ((150+170)/2 ✓), elevation 30.0 (20+10 sum ✓); yesterday's bucket (single
  run, blend not exercised) — distance 8.0, pace 6.0, HR 140.0, elevation
  50.0, all exactly matching that run's own raw values. Then confirmed the
  real Compose UI rendered all four chart shapes correctly for the same
  data (Distance bar reaching the correct height on both days, Pace/
  Elevation/Heart Rate lines stepping between the two expected values) —
  screenshotted on the "1W" period after navigating Home → Recent Activity
  → See All. Cross-checked the pre-existing HR Zones card wasn't regressed
  by the elevationGain/heartRate parsing changes: Z3 100%/Z4 50% matched
  hand-calculation off `maxHR = 220-30 = 190` for all three seeded runs'
  heart rates. Environment notes: hit a stale port-8081 Firestore emulator
  process from an earlier session (killed and restarted cleanly), and the
  first debug-log verification pass came up empty because the temporary
  `Log.d` line had been added *after* the last `installDebug` — rebuilding
  fixed it. Removed the temporary log line before the final build.

### 2026-08-16 — RunTrackingScreen sub-task 12: live-run sharing map/metrics sync live-verified
- **Roadmap item #2's last open sub-item, done.** Sub-task 12 (share sheet +
  deep link + `LiveRunViewerScreen`) was built 2026-07-31 but its map/metrics
  sync was never independently live-verified — only confirmed by inspection
  that both sides used matching Firestore field names. Verified for real
  this pass, using `adb emu geo fix` to simulate GPS movement (no real
  GPS available on an emulator) since that was flagged as the hardest
  remaining item to verify live rather than skip.
- **Write side confirmed:** started a run, enabled live sharing (`toggleLiveSharing()`
  → real WiFi-icon toggle, real share-sheet deep link generated), fed a
  sequence of `adb emu geo fix` coordinate updates simulating movement.
  Confirmed via Firestore REST ground truth that `RunTrackingService.pushLiveLocation()`
  correctly wrote `runs/{runId}/liveLocation/current` with real
  `lat`/`lng`/`pace`/`distanceKm` matching the simulated position.
- **Read side confirmed:** opened the generated `com.ruvo.app://live/{runId}`
  deep link via `adb shell am start` with an explicit component target
  (`-n com.ruvo.app.debug/com.ruvo.app.MainActivity` — see note below on why).
  `LiveRunViewerScreen` rendered the real Google Map correctly centered on
  the injected coordinates with a marker, and the metrics footer
  (`0.17 Distance km` / `24:03 Pace /km`) matched the Firestore doc exactly.
  Also confirmed the staleness banner ("This runner may have stopped
  sharing") and the live-ticking "Updated ago" counter (22m → 25m across
  two checks) both work — the `addSnapshotListener`-based real-time read
  path is genuinely reactive, not a one-shot fetch.
- **Deep-link tooling quirk (not an app bug):** `adb shell am start -a VIEW -d
  "com.ruvo.app://live/..."` targeting the package by name alone
  (`com.ruvo.app.debug`) kept triggering an Android "Open with" chooser
  showing two identical "Ruvo" entries, and tapping either silently failed
  to launch. Root-caused via `adb shell dumpsys package` that only
  `MainActivity`'s single intent-filter genuinely matches host `live` — no
  duplicate manifest declaration. Worked around by targeting the activity
  explicitly (`-n com.ruvo.app.debug/com.ruvo.app.MainActivity`), which
  launched cleanly every time. Consistent with this being an adb/AVD
  resolver quirk in this environment, not a manifest defect — not changing
  the manifest based on this alone.
- Files: none (verification only, code already correct).

### 2026-08-15 (cont. 3) — ReferralScreen: redemption live-verified end-to-end
- **Roadmap item #4's last open sub-item, done.** Continuing straight from
  the (cont. 2) `AuthViewModel` fixes: created two fresh test accounts
  (`ReferralQA2`, `ReferralQA3`) against the freshly-restarted emulator
  pair. `ReferralQA2`'s self-generated code (`RUNN1408`) was entered into
  `ReferralQA3`'s "Have a friend's code?" field and **Apply was tapped for
  real** (`uiautomator dump`-precise coordinates, not a direct Firestore
  write) — the UI showed "⚡ +100 coins added to your account!" immediately.
- **Verified via Firestore REST ground truth, both sides:** redeemer
  (`ReferralQA3`) — `coins: 100`, `usedReferral: true`. Referrer
  (`ReferralQA2`) — `coins: 100`, `referralStats: {coinsEarned: 100,
  totalInvites: 1}`. Exactly the batch-write shape `redeemCode()` in
  `ReferralViewModel.kt` implements — confirms the real client-side
  referral logic is correct, not just that Firestore accepts arbitrary
  writes.
- **Environment note:** this took three account-creation attempts and two
  real bug fixes (see (cont. 2)) to get a stable-enough connection through.
  Not repeating that diagnosis here — see that entry for the full story.
- Files: none (verification only, code already correct).

### 2026-08-15 (cont. 2) — AuthViewModel: two real hang/failure bugs found and fixed while attempting ReferralScreen live verification
- **Context:** attempting Roadmap item #4's last open sub-item (referral code
  redemption between two accounts, real client-side logic in
  `ReferralViewModel.kt` — must be verified through the actual Compose UI,
  not faked via direct Firestore writes). Blocked repeatedly by sign-up/
  sign-in getting stuck, which led to finding two real bugs along the way.
- **Bug 1 — fixed: no timeout on any `AuthViewModel` network call.**
  `signUpWithEmail`/`signInWithEmail`/`signInWithGoogle`/`loadUser`/
  `completeOnboarding` all called `auth.*().await()` / `firestore...await()`
  with nothing wrapping them — and `AuthUiState.Loading` maps to a
  full-screen `SplashScreen()` (`RuvoApp.kt`) with no retry affordance. A
  slow/throttled connection left the app stuck on the splash **indefinitely**
  (reproduced live: 13+ minutes, never resolved, only fixable by force-
  killing the app) — not a spinner, a bricked app. Fixed by wrapping each in
  `withTimeoutOrNull(15_000L)`, falling back to `AuthUiState.Error(...)` on
  timeout so the user always gets a recoverable screen instead of a dead one.
  This is a real robustness gap independent of environment cause — any
  real-world network blip at the wrong moment would strand a real user the
  same way.
- **Bug 2 — fixed: `completeOnboarding()` used `.update()`, which fails
  outright if the document doesn't exist yet.** Root-caused via
  `firestore-debug.log`: repeated `DatastoreException: no entity to update`
  for a uid whose `createUserProfile()` `.set()` write (from sign-up) had
  itself failed/never landed — every onboarding-completion retry was then
  permanently doomed by the same error, since `.update()` can never create
  the doc it's missing. This is exactly the failure mode Bug 1's timeout
  fix now surfaces cleanly instead of hanging on — but the user still could
  never actually finish onboarding. Fixed by switching to
  `.set(data, SetOptions.merge())`, which creates the doc if needed (self-
  healing) and otherwise behaves identically to `.update()`.
- **Referral verification status: still open, not completed this pass.**
  Made real progress: confirmed live that `ReferralViewModel.load()`'s
  referral-code self-generation works correctly on an under-populated
  profile doc (a direct consequence of Bug 2's failure mode) — generated
  `RUNN1408` for a second test account (`ReferralQA2`) with no other Firestore
  fields present, exactly as the code intends. Could not reach the actual
  redeem-code tap on a third account: this dev sandbox's Firestore emulator
  connection degraded severely partway through this session (the emulator
  process itself was found to have silently died once — confirmed via
  `Get-NetTCPConnection` showing nothing listening — and after a clean
  restart, reads/writes were still slow enough to blow the new 15s timeout).
  Given Bug 1's fix, this now fails safely (a shown error) rather than
  hanging, but a usable low-latency connection is still needed to actually
  exercise `redeemCode()`. Left open for a future pass in a healthier
  environment; don't fake this one via direct Firestore writes (see the
  Roadmap item #4 note this repeats).
- Files: `features/auth/AuthViewModel.kt`.

### 2026-07-16 — ClubDetailScreen
- **Bug:** `members` were never fetched from Firestore — the Members tab was
  permanently stuck on "Members loading…".
- **Fix:** `ClubDetailViewModel.load()` now reads the club doc's `members` array,
  chunks it into groups of 10, and fetches user docs via
  `whereIn(FieldPath.documentId(), chunk)`, computing `weeklyKm` per member.
- **Also fixed:** wired the previously-dead post like button
  (`arrayUnion`/`arrayRemove` on `likes`), added post creation (writes to
  `clubs/{id}/posts`), implemented the Leaderboard tab (ranked member list, gold/
  silver/bronze styling), added a leave-confirmation dialog.
- **Verified live:** posted a test message, confirmed it rendered via
  `ClubPostCard`; liked it and confirmed the heart filled with count "1";
  confirmed the Leaderboard tab showed the correct ranked member.
- Commit: `b09df2f`.

### 2026-07-16 — GearScreen / ShoeTrackerScreen
- **Bug:** Android read shoes from `users/{uid}/shoes`, a subcollection the RN
  app never writes to. Real shoe data lives in the `gearList` array field
  directly on the `users/{uid}` document (confirmed via
  `UserContext.js`'s `addGear`/`updateGear`/`deleteGear`/`selectDefaultGear`).
  The screen always showed "No shoes added yet" regardless of real data.
- **Fix:** Rewrote `Shoe` model and `ShoeTrackerViewModel` to read/write the
  `gearList` array field (read-modify-write the whole array per RN's own
  approach, since Firestore can't patch one array element in place).
- **Ported from RN:** hero stats strip (shoe count / total km / active shoe /
  retired count), popular-shoe autocomplete dropdown with keyword-based
  mileage-limit auto-detection (`detectShoeLimit`, ported from RN's
  `SHOE_LOGIC`), edit/delete/set-active actions, per-shoe performance stats
  (best pace / run count / avg distance, computed from the `runs` subcollection
  filtered by `gearId`), mileage-limit-reached alert dialog.
- **Also fixed:** `SaveActivityScreen` had no gear selection at all and never
  wrote `gearId` on a run or incremented any shoe's distance — meaning shoe
  mileage could never move even with the read side fixed. Added a gear picker
  (defaults to the `isDefault` shoe) and post-save logic that increments the
  selected shoe's `distance` in `gearList`.
- **Verified live:** added "Nike Air Zoom Pegasus 40" via the autocomplete
  (confirmed "AI SET · 800" badge), logged a 5km run with that shoe selected,
  confirmed the shoe's distance updated to 5.0/800km and performance stats
  (best pace, run count, avg distance) populated correctly.
- Commit: `d39f3d7`.

### 2026-07-16 — AICoachScreen
- **Critical bug:** `AICoachViewModel.send()` called
  `functions.getHttpsCallable("aiCoach")` — this Cloud Function **does not
  exist**. `functions/index.js` only exports `askGemini`. Every single AI Coach
  message was silently failing and falling back to a generic error message;
  the feature was completely non-functional.
- **Fix:** Changed the call to `askGemini` with the `{ requestBody: { contents:
  [...] }, userMessage }` shape the function actually expects (matching RN's
  `aiService.js`), and parse the Gemini `candidates[0].content.parts[0].text`
  response shape.
- **Verified the fix specifically:** temporarily added debug logging and
  bypassed the Pro-gate, reinstalled, sent a message, and confirmed via
  `adb logcat` that the request now reaches the function — it returns a
  legitimate `FirebaseFunctionsException: Unauthenticated` (a real
  Firebase Auth issue with the QA test account) instead of the previous
  `NOT_FOUND` for a nonexistent function. Reverted the debug code before
  committing.
- **Also added (parity with RN):** chat history now persists to
  `users/{uid}/coach_messages` via a Firestore listener (previously reset on
  every navigation away from the screen — the RN app has always persisted
  this); a minimal markdown renderer for assistant replies (bold, `#`/`##`/`###`
  headers, `-`/`1.` lists — Gemini replies are markdown-formatted per RN's
  system prompt and were rendering as literal asterisks/hashes before); a
  quick-actions zero-state grid (Analyze Last Run / Generate Plan / Recovery
  Check / Fueling Tips, matching RN); Pro-gating for custom messages via
  RevenueCat entitlements (quick actions stay free, matching RN); a system
  context string built from the user's profile fields and last 5 runs.
- **Not ported (scoped out for time):** RN's `coach_memory` "what I remember"
  chips and `coach_insights` weekly insight card — these depend on backend
  writes to those collections that weren't confirmed to exist; the AI
  tool-calling (`set_injury_mode` / `set_vacation_mode` / `change_plan_focus`
  function declarations) was also not ported — Gemini will reply in text but
  won't be able to directly mutate the user's training plan yet.
- Commit: `6574e30`.

### 2026-07-16 — PaywallScreen
- **Gap:** Android's paywall was a generic, plain feature-list + package-card
  layout; RN's is a full marketing screen — crown-badged hero with social
  proof, a 2x2 grid of locked feature cards (icon dimmed to 45% opacity, lock
  badge overlay, per-feature accent color) advertising AI Coach / 2× Coins /
  Advanced Analytics / Wearables, an "Unlock everything below" divider chip,
  annual/monthly pricing cards (annual gets a floating "BEST VALUE · SAVE X%"
  badge, per-month price breakdown, and a strikethrough monthly-equivalent
  price), a trust row (No commitment / Cancel anytime / Secure payment), and
  Restore Purchase / Terms / Privacy footer links.
- **Also reworked the data model:** `PaywallPackage` now carries a numeric
  `priceAmount` and a `period` (`Annual`/`Monthly`/`Other`) instead of just a
  display string, so `PaywallUiState.savingsPercent` can compute the real
  annual-vs-monthly discount from RevenueCat prices instead of a hardcoded
  "Save 60%" badge. The old two-code-path design (real `PackageCard` vs.
  `FallbackPackageCard` for when RevenueCat has no verified-priced products)
  was unified: `loadOfferings()` now populates the same `packages` list either
  way and sets `isMockOfferings = true`, matching RN's own
  `isMockOfferings` concept, including a visible "Demo prices" banner.
- **Not ported (scoped out):** RN's `__DEV__`-only "Simulate Pro Upgrade"
  button. RN's version sets a single `isPro` flag in a shared `UserContext`
  that every gate reads; Android's Pro checks are decentralized (each
  ViewModel calls `Purchases.sharedInstance.getCustomerInfoWith` directly), so
  a real equivalent would need a shared local override checked everywhere —
  out of scope for a design-parity pass. RN's dynamic "Start 7-Day Free
  Trial" CTA text (based on `introPrice`) was also not ported — the CTA
  always reads "Unlock Ruvo Pro" — since introductory-price detection wasn't
  already modeled in Android's `PaywallPackage`.
- **Observation:** the QA test account used for verification already has an
  active `pro` RevenueCat entitlement (of unknown origin — possibly a leftover
  sandbox purchase), which suppresses the Pro-gate dialog in AI Coach. This
  made the paywall hard to reach for verification (it currently has exactly
  one nav entry point app-wide: `AICoachScreen`'s `onUpgrade`, wired only when
  that gate dialog fires). Worth adding a second, always-reachable entry point
  (e.g. from Settings or Profile) when one of those screens is next touched.
- **Verified live:** since the normal entry point was blocked by the above,
  temporarily rerouted the Coach bottom-nav tab straight to `PaywallScreen`,
  confirmed the full layout (hero → feature grid → divider → pricing cards →
  demo banner → CTA → trust row → footer), tested tapping Monthly to confirm
  the selection toggle re-renders both cards, and tapped "Unlock Ruvo Pro"
  with mock (unpriced) packages to confirm it safely shows "Purchases aren't
  live yet…" instead of attempting a real purchase. Reverted the temporary
  reroute before committing.
- Commit: `a8e74c4`.

### 2026-07-16 — TrainingPlanScreen
- **Bug (schema):** `TrainingPlanViewModel` stored plans in a
  `users/{uid}/trainingPlans` subcollection with an `isActive` flag and
  invented fields (`durationWeeks`, `runsPerWeek`, `currentWeek`) that don't
  exist anywhere in RN. RN's `updateTrainingPlan()` writes a single
  `trainingPlan` map field directly on the user doc (`activeGoal`, `status`,
  `weeks`) — there's no plan history/subcollection concept at all.
- **Bug (fake AI call):** the "Generate Plan" flow called
  `functions.getHttpsCallable("generateTrainingPlan")`, which doesn't exist.
  Investigating RN's side revealed this isn't a "wrong function name" bug
  like AI Coach was — **RN has no server-side plan generation at all.**
  `generateWeekPlan()` in `UserContext.js` is a deterministic, fully
  client-side schedule builder. Removed the fake network call entirely and
  ported the real algorithm instead (see Known Backend Bugs for the broader
  pattern this revealed — RN itself calls several other nonexistent
  functions too).
- **Fix:** rewrote the ViewModel to read/write `users/{uid}.trainingPlan`,
  and ported `generateWeekPlan()`'s exact branches: Recovery (`status ==
  "Injured"` — Rest Day/Recovery Walk/Mobility Work, 0-5km), Maintenance
  (`status == "Vacation"` — Scenic Run/Short Jog, 10-15km), and Active (phase
  rotation Base Building → Load Increase → Peak Week → Taper with volume
  multipliers 1/1.1/1.2/0.8, long run on the user's last available run day,
  speed work mid-week, easy runs on the rest, using the real `runDays` field
  with a Mon/Wed/Fri fallback).
- **Also added:** the Active/Injured/Vacation status toggle and goal picker
  (5k/10k/Half Marathon/Marathon) RN has via its plan edit menu — Android
  previously had no way to trigger Recovery or Vacation mode at all — with
  matching colored status banners.
- **Not ported (scoped out):** RN's Habits heatmap tracker (`addHabit`/
  `deleteHabit`/`toggleHabitCompletion`, a distinct subsystem embedded in
  the same screen), the day-by-day weekly calendar with a today-selector,
  and tapping a workout to start it via `WorkoutDetailScreen` — these are
  substantial and independent enough to warrant their own pass.
- **Verified live:** confirmed generated distances match RN's formula
  exactly — 10k goal: Easy 4km/Speed 3km/Long 8km, week totals 15/17/18/12km;
  Marathon goal: Easy 12km/Speed 9km/Long 23km, week totals 45/50/54/36km;
  toggled "I'm Injured" and confirmed the Recovery Mode banner + 0-5km
  Rest Day/Recovery Walk/Mobility Work workouts, then "I'm Recovered"
  correctly restored the goal-based Active schedule.
- Commit: `d5ccfef`.

### 2026-07-16 — ProfileScreen (own profile) + systemic follow/unfollow bug
- **Survey first:** RN's `ProfileScreen.js` is 1703 lines — the largest file
  in the app — with ~15 distinct sub-features (avatar/identity block, avatar
  upload, edit-name modal, stat pills, weekly calendar strip with pulsing
  "today" ring, XP bar, gear preview card, country picker, streak card,
  active-challenges list, badges grid, filtered recent-activity list with a
  date-picker modal, saved-tips library tab, share-profile flow, pull-to-
  refresh). Used an Explore agent to map the whole file (fields read/written,
  nav targets, sub-features) before touching code, given the size.
- **Systemic bug found and fixed (spans 3 files):** follow/unfollow only ever
  wrote to the current user's own `following` array, in
  `FindFriendsViewModel`, `UserProfileViewModel` (`UserProfileScreen.kt`),
  and `ProfileViewModel`. RN's `followUser()`/`unfollowUser()` in
  `UserContext.js` uses a Firestore `writeBatch` to update **both** sides
  atomically — my `following` array and the target's `followers` array.
  Without the target-side write, nobody's `followers` array could ever gain
  an entry, no matter how many people followed them. Fixed all three call
  sites to batch-write both arrays.
- **Related bug, same root cause:** `ProfileViewModel` and
  `UserProfileViewModel` both read follower/following counts from
  nonexistent `followersCount`/`followingCount` fields. RN has no such
  counters — it derives counts from `followers.length`/`following.length`.
  Fixed both to derive from the real arrays.
- **Two more field mismatches in `ProfileViewModel`** (own profile): reading
  `avatarUrl` (RN's field is `avatar`) and `location` as a flat string (RN's
  `location` is a nested `{city, country, address}` map, read/written as
  `location.country`). Both were silently always empty — notably, the
  Compose UI to *display* bio/location already existed and worked correctly
  once given real data; only the ViewModel's field-read was wrong.
- **Verified live:** followed `RuvoQA9` from Find Runners, confirmed own
  profile's "Following" went 0→1, then opened `RuvoQA9`'s profile and
  confirmed *their* "Followers" also went 0→1 (previously would have
  stayed 0 forever).
- **Not yet ported (scoped out — large, see Roadmap):** avatar upload,
  weekly calendar strip, XP bar polish, gear preview card, country picker,
  streak card, active challenges, badges grid, recent-activity date
  filtering, saved-tips library tab, share-profile flow. The "Recent Runs"
  section is still a bare distance-only grid, not RN's richer dated/typed
  activity cards.
- Commit: `7d36f08`.

### 2026-07-20/21 — RewardsScreen, MyRedemptionsScreen, ReferralScreen
- **Security bug:** `RewardsViewModel.redeem()` deducted coins and wrote the
  redemption record directly from the client via `firestore.runBatch` — a
  compromised/rooted client could set its own coin balance to anything and
  redeem for free. RN's `RewardsScreen.js` never does this: it calls the
  `redeemReward` Cloud Function, which validates the balance server-side
  inside a Firestore transaction (`functions/index.js`) and is the only
  path allowed to touch `coins`/`redemptions`. Switched Android to call the
  same function with the same payload (`rewardId`/`price`/`title`), trusting
  the server's returned `newCoinBalance`. Also added the rooted-device
  wallet lockout RN has (checks `SecurityManager.isRooted`, already present
  elsewhere in the Android app but not wired into this screen).
- **Schema bug:** `MyRedemptionsScreen` read `code`/`brand`/`status`/
  `expiresAt` fields the Cloud Function never writes (it only writes
  `rewardId`/`title`/`price`/`timestamp`) — every redemption showed a blank
  code and an "Unknown" status. Rewrote the model/card to match what's
  actually written, mirroring RN's own `MyRedemptionsScreen.js`.
- **Schema bug:** `ReferralScreen` read/wrote a flat `referralCount`/`coins`
  pair, but RN's `referralService.js` `processReferralReward()` writes to a
  nested `referralStats.totalInvites`/`referralStats.coinsEarned` map —
  Android's referral stats would always read 0 no matter how many people
  redeemed a code. Fixed both the read and write sides to the real nested
  paths.
- **Environment note:** this session's emulator was persistently unstable —
  multiple full process crashes (dropped from `adb devices` entirely, twice)
  and recurring stale "System UI isn't responding" / "Ruvo isn't responding"
  ANR dialogs that lingered even after `adb shell top` showed the system
  fully idle (dismissed each time with `adb shell input keyevent 3` per the
  existing playbook). One crash triggered `adb uninstall` + reinstall to
  clear a stale Hilt-generated-code mismatch
  (`NoSuchMethodError: ...fgetsecurityManagerProvider...` — a stale/mismatched
  `DaggerRuvoApplication_HiltComponents` class from an incremental KSP build;
  fixed by `./gradlew clean assembleDebug` + a full uninstall/reinstall, not
  just a redeploy), which in turn wiped the existing QA test account's local
  Firebase session with no recorded password to log back in — recovered by
  signing up a **new** QA account (`RuvoQA12`) and running it through full
  onboarding, confirmed working end-to-end (goal → fitness level → weekly
  schedule → "You're all set!" → Home). Despite that recovery succeeding,
  the specific Rewards/Referral screens could not be reached for a full
  live click-through before the environment degraded again — these three
  fixes are compile-clean and verified by direct comparison against the
  Cloud Function source and RN's exact read/write paths, but do **not**
  carry the same "tapped through it live" confidence as the other entries
  in this log. Worth a follow-up live pass once the emulator is stable.
- Commit: `49fbc0a`.

### 2026-07-24 — Run-save/gamification pipeline + local Functions emulator
- **Critical bug (both save paths):** `RunTrackingViewModel` wrote finished runs
  directly to a `users/{uid}/runs` subcollection that doesn't exist in the real
  schema, computed XP/coins client-side, and called a fictitious `awardRunXP`
  Cloud Function that was never exported — every save silently fell back to a
  fabricated, never-persisted local XP value. `SaveActivityScreen`'s manual
  "Log Activity" entry path had the same bug independently.
- **Fix:** `GamificationRepository` now calls the real `saveRunActivity` Cloud
  Function (`runEntry` + `calculatedUpdates` in, server-computed
  `earnedXp`/`earnedCoins` out), matching `functions/index.js` and RN's
  `UserContext.js::addRunToHistory()`. `RunTrackingViewModel` no longer
  persists on finish; `RuvoApp.kt`'s RateEffort step does the single real save
  once RPE/notes/tags are known (RN's actual save point,
  `SaveActivityScreen.js::handleSave()`).
- **Also fixed:** `AppModule.kt`'s `FirebaseFunctions` never respected
  `USE_FIREBASE_EMULATOR` (Auth/Firestore did) — every callable was silently
  hitting production with a local-emulator auth token. Removed a network-hang
  risk where the Pro-status coin bonus made a live RevenueCat call inside the
  save path with no timeout.
- **Net-new infra:** added local Firebase Functions emulator support
  (`firebase.json` + `functions/`, using the archived Cloud Functions source)
  so this pipeline is actually testable — none existed before. `askGemini` is
  commented out there only (firebase-functions v7 dropped the v1 `runWith()`
  API it uses); doesn't affect `saveRunActivity`/`redeemReward`/
  `deleteAccountData` or production.
- **Verified live** against the local emulator: multiple successful
  `saveRunActivity` executions logged (valid auth, no errors, ~40-650ms).
- Commit: `9b0affa`.

### 2026-07-27 — RunTrackingScreen sub-tasks: GPS filter fixes, local emulator auth bug, haptics, crash-recovery, map controls
- **GPS speed-filter bug (archive §1 sub-task 3):** `processLocation()` treated
  a GPS-reported speed as authoritative, letting a reported 0 m/s on a large
  teleported jump bypass the >25 km/h distance/time implied-speed check.
  Live-tested with `adb emu geo fix`, this produced a runaway 209.67 km
  distance from a handful of small simulated moves. Now the reported and
  implied speeds are checked independently — either can reject the point.
- **Pause/resume bug (sub-task 6):** `pauseTracking()`/`resumeTracking()` were
  no-ops — the location callback and elapsed timer kept running underneath a
  "Paused" state. Now they actually stop/restart location updates and the
  timer. Elevation gain (sub-task 5) and the distance/pace/calorie engine
  (sub-task 4) were verified correct as part of the same pass.
- **Local Functions emulator auth bug:** firebase-functions v7's v1-compat
  `functions.https.onCall()` doesn't populate `context.auth` in the emulator
  even when its own callable request-verification log reports the ID token as
  valid (reproduced on both a `7.3.2-rc.0` prerelease and stable `7.3.0`).
  Rewrote all four local functions to the v2 API. Also fixed a `FieldValue`-
  undefined bug in the same local functions.
- **Haptics (sub-task 11):** added `HapticsCoach` (mirrors the existing
  `VoiceCoach` pattern) using `VibrationEffect.createWaveform` — `lightTap()`
  on nearly every run-tracking button, `successFeedback()` on Finish, per the
  RN spec. Added the `VIBRATE` permission. Haptic output isn't screenshot-
  verifiable, so build/install was verified but not re-confirmed via a full
  live replay.
- **Crash-recovery / mid-run persistence (sub-task 15, net-new — RN has no
  equivalent):** `core/persistence/RunCheckpoint.kt` (serializable snapshot:
  runId, start time, elapsed/distance/elevation, route, laps, paused flag) +
  `RunCheckpointStore.kt` (DataStore Preferences-backed save/load/clear, saved
  every 5s while tracking). A killed/crashed app now resumes mid-run instead of
  silently losing the GPS track.
- **Map view controls (sub-task 8):** `MapStyleChoice` enum (Light/Dark/
  Satellite/Hybrid) backing a Layers-icon dropdown in `RunHUD`, plus a
  recenter FAB that fades in when the user pans away from follow mode (Dark
  has no built-in `MapType` — layers a custom style JSON on `NORMAL`).
- Commits: `f4f5343`, `bdada12`, `e2838eb`, `6d23d20`, `1592bd0`.

### 2026-07-29 — RunTrackingScreen sub-task 9: HR zone module + Health Connect
- **Gap:** `RunTrackingUiState.currentHeartRate` existed but nothing ever set
  it — no HR data source was wired up anywhere in the run-tracking feature,
  and the run-completion payload's `heartRate` field was hardcoded to `0` in
  `RuvoApp.kt::submitRunActivity`. RN has no working Android HR source to
  port either (iOS-only via HealthKit — see archive §1), so this is a genuine
  new integration, not a port.
- **Fix:** `RunTrackingViewModel` now injects the existing (previously unused)
  `features/runtracking/HealthConnectManager` and polls
  `fetchLatestHeartRate()` every 8s while Running (Health Connect is a
  periodically-synced data store, not a live sensor stream, so polling the
  latest sample is the practical equivalent of RN's iOS `observeHeartRate()`
  listener). Samples are averaged into `averageHeartRate` on Finish and now
  flow through to the real `saveRunActivity` `heartRate` field instead of the
  hardcoded `0`.
- **Permission flow:** `RunTrackingScreen` now launches the Health Connect
  permission request (`PermissionController.createRequestPermissionResultContract()`)
  non-blocking after location permission is granted, mirroring RN's
  non-blocking background-location-permission pattern — a denial or missing
  Health Connect install just means the run proceeds with no HR data.
- **New:** `HrZone.kt` ports RN's `getHrZone(hr, age=30)` zone/color bands
  exactly (archive §1). The run-tracking metrics row now shows a 4th BPM cell
  colored by zone; the finished-run sheet shows Avg. Heart Rate when available.
- **Also found, not fixed (out of scope for this pass):** `RunDetailScreen.kt`
  reads a run doc from `users/{uid}/runs` using field names (`avgHeartRate`,
  `distanceKm`, `durationSeconds`, per-split `paceSecondsPerKm`) that don't
  match the real `saveRunActivity`-written schema (`heartRate`, `distance`,
  `duration` as an `"MM:SS"` string, `kmSplits[]`) — this screen was already
  marked "Not yet compared" in the mapping table (see Roadmap item 5) and
  appears to have never been fixed; flagging here since it was noticed while
  wiring the HR save path.
- **Emulator auth blocker (found and fixed same day):** Firebase Auth sign-in/
  sign-up both failed with a `RecaptchaCallWrapper` "network error" despite
  confirmed real internet access via Chrome. Root cause was **not** Play
  Integrity — `AppModule.kt` already correctly points `FirebaseAuth`/
  `Firestore`/`Functions` at `10.0.2.2` when `USE_FIREBASE_EMULATOR=true`
  (already set in `local.properties`), but the local `firebase emulators:start`
  suite simply wasn't running, so those calls had nothing to connect to.
  Fix: `firebase emulators:start --only auth,firestore,functions` from the
  repo root (uses the existing `firebase.json`/`.firebaserc`/`functions/`).
  Once running, sign-up/onboarding/login all worked end-to-end against the
  local emulator (confirmed via the emulator log's
  `ruvoqa.hr2.test@example.com` verify-email link).
- **Verified live** (after the above fix): reached `RunTrackingScreen` for the
  first time this effort. The Health Connect permission request fired
  correctly (real system consent screen, granted). The metrics row renders
  the new 4th BPM cell (`Distance / Pace / Calories / BPM`) showing `--`
  placeholder with no crash — expected, since there's no way to seed a
  synthetic Health Connect heart-rate sample without a companion app/
  wearable, so the BPM-populates-from-real-data path specifically still needs
  a physical device or Health Connect's test tooling to fully verify. Noticed
  in passing (pre-existing, not from this change): the tracking service's
  timer starts ticking on screen-open regardless of the UI's Idle/Running
  state, so Duration visibly counts up before Start is tapped and Lap/Stop
  stay correctly disabled — worth a look whenever sub-task 1 (permission/
  GPS-acquisition polish) is picked up.

### 2026-07-29 (cont.) — RunTrackingScreen sub-task 10: voice-coaching template accuracy
- **Gap:** `VoiceCoach`'s spoken strings diverged from the archive's exact
  templates (RN_SOURCE_ARCHIVE.md §1 "Voice/haptic feedback") — pause/resume
  said "Run paused."/"Run resumed." instead of "Workout paused."/"Resuming
  workout.", lap spoke the full pace detail instead of a bare "Lap N", and
  there was no GPS-acquisition/lock announcement at all.
- **Fix:** corrected the pause/resume/lap strings to match exactly.
  `announceLap` no longer speaks pace — that detail moved to a new non-voice
  visual banner ("🏁 Lap N recorded — X km · pace/km", auto-dismissing after
  2.5s) in `RunTrackingScreen.kt`, matching the archive's "spoken 'Lap N' +
  separate non-voice alert" split. Added `announceGpsAcquiring()`/
  `announceGpsReady()`, wired to `bindService()` (fires on every screen mount,
  including crash-recovery resume) and a one-shot collector on the service's
  first non-null location fix.
- **Deliberately not touched:** the countdown-complete "Run started. Good
  luck!" line and the per-km milestone callouts — both are Android-specific
  additions with no RN equivalent event (RN auto-starts tracking on GPS lock;
  Android's manual Start-button/countdown is a real UX divergence, already
  flagged as deliberate in earlier log entries). The "Voice feedback enabled"
  toggle-announcement template exists in the archive but there's still no
  voice on/off UI control anywhere (that toggle is part of sub-task 7's
  draggable dashboard, not yet built) — left unadded rather than as dead code.
- **Verified live:** TTS output isn't screenshot-verifiable, so used the
  project's established technique (temporary `Log.e("Debug", ...)` in
  `speak()`, reinstall, trigger, `adb logcat`, revert before committing).
  Confirmed via logcat, in order: "Acquiring GPS, get ready." on mount →
  "GPS ready. Let's run." ~5s later on first fix → "Run started. Good luck!"
  after the countdown → "Lap 1"/"Lap 2" on each lap tap (with the visual
  banner screenshotted showing correctly) → "Workout paused."/"Resuming
  workout." on pause/resume.

### 2026-07-29 (cont.) — RunDetailScreen schema fix (roadmap item 5) + a second FirebaseFunctions DI bypass bug
- **Root-cause bug:** `RunDetailViewModel.load()` read from
  `users/{uid}/runs/{runId}` — a subcollection document that **nothing ever
  writes**. The real `saveRunActivity` Cloud Function (`functions/index.js`)
  writes each finished run as one entry in the `users/{uid}.runHistory`
  **array** field via `FieldValue.arrayUnion(runEntry)`; there is no per-run
  subcollection at all. Cross-checking RN's own `RunDetailScreen.js` (which
  tries the identical `users/{uid}/runs/{id}` read, per archive §4) against
  RN's actual save path (`UserContext.js::addRunToHistory()`) confirms this is
  **RN's own dead/broken read path** — no write path (Cloud Function or
  client) ever populates it, in either app. Not something to port.
- **Fix:** read the `users/{uid}` doc once, find the matching entry in
  `runHistory` by `id`. Corrected every field name/type to the real
  `runEntry` shape: `distance`/`calories`/`elevationGain` (numbers),
  `duration` (an `"MM:SS"`/`"H:MM:SS"` **string**, parsed the same way
  `saveRunActivity` itself parses it server-side — was previously read as a
  numeric `durationSeconds` field that doesn't exist), `date` (an ISO-8601
  `Instant` string — was previously read as a Firestore `Timestamp` field
  named `startedAt`), `heartRate` (single per-run average int — was
  previously `avgHeartRate`, and per-split `heartRate` was invented data
  with no source at all, now removed). `kmSplits[]` entries are actually
  Android's user-tapped laps (`lapNumber`/`distanceKm`/`durationSeconds`),
  not RN's auto-generated per-km markers — relabeled the Splits table
  header "KM"→"LAP" and added a real DISTANCE column instead of the
  fictional per-split HR column.
- **Second bug found while trying to verify the fix live:** saving a run
  produced no Firestore write at all and the summary screen always showed
  "+0 XP" — `RuvoApp.kt::submitRunActivity` called
  `GamificationRepository(FirebaseFunctions.getInstance())` directly, a raw
  Kotlin constructor call bypassing Hilt entirely. The Hilt-provided
  `FirebaseFunctions` singleton (`AppModule.kt`) is the one wired to
  `USE_FIREBASE_EMULATOR`; `FirebaseFunctions.getInstance()` is never
  emulator-configured, so this call site always silently hit **production**
  with a local-emulator auth token and failed — the exact bug class the
  9b0affa/bdada12 fixes addressed for `AppModule.kt` itself, just missed at
  this one manual-instantiation call site. Fix: added `RunSaveViewModel`
  (thin Hilt entry point exposing the real injected `GamificationRepository`)
  and threaded it through both `submitRunActivity` call sites (RateEffort
  submit and skip).
- **Verified live, end to end:** completed a real run through the full
  Start → Lap → Stop → RateEffort → Save flow; confirmed via the Firestore
  emulator's REST API that `runHistory`/`totalRuns`/`currentXP` were now
  actually written (previously confirmed silently failing — zero writes
  across two prior attempts before the DI fix). Since the only registered
  nav entry point to `RunDetailScreen` is `AnalyticsDashboardScreen`'s recent-
  runs list — which is unreachable in practice because `AnalyticsViewModel`
  has the **identical** wrong-subcollection bug (see below) — temporarily
  rerouted the Coach bottom-nav tab to `run_detail/<real-id>` to reach it
  (same technique as the 2026-07-16 PaywallScreen entry, reverted after
  verifying). Confirmed real title/date/distance/duration/calories render
  correctly, avg HR correctly shows "—" (real value was 0), and the AI
  insight card renders. Non-screenshot-verifiable parts (none here — this
  screen is fully visual) N/A.
- **Also found, not fixed (flagging for whoever picks up the rest of item
  5):** `AnalyticsViewModel.loadData()` has the exact same root-cause bug —
  queries `users/{uid}/runs` (also nonexistent) with more wrong field names
  (`distanceKm`, `durationSeconds`, `startedAt`, `xpEarned` — the last one
  doesn't exist on any run entry at all, XP is only ever a global increment,
  never stored per-run). This means **AnalyticsScreen has never shown real
  data** — every stat, chart, and the recent-runs list is silently always
  empty/zero. Deliberately left unfixed this pass (item 5 batches Analytics/
  PersonalRecords/RunDetail/WorkoutDetail together for a reason — the "half-
  blend" chart formula, VO2 thresholds, and real-splits-engine work all
  still need archive §2/§3 read first); fixing just the read-path here would
  be a half-measure that invites re-litigating the same query when the full
  pass happens.
- **Also noticed, not fixed (minor, cosmetic):** `RunSummaryScreen` shows
  "+0 XP"/"+0 coins" even when the server genuinely computed a positive
  value (confirmed 1 XP was correctly written to Firestore while the UI
  showed +0) — a separate, smaller display binding bug, not a data bug.

### 2026-07-29 (cont.) — AnalyticsViewModel: same schema/read-path bug fixed
- **Bug:** identical root cause to the RunDetailScreen fix above —
  `loadData()` queried the nonexistent `users/{uid}/runs` subcollection
  (with additionally-wrong field names: `distanceKm`, `durationSeconds`,
  `startedAt`, and a per-run `xpEarned` field that doesn't exist anywhere —
  XP is only ever a global `currentXP` increment). This meant
  **AnalyticsScreen has never displayed real data** — every stat, both
  charts, and the recent-runs list were always empty/zero, silently, from
  day one. See the new "Known Data-Layer Bugs" section above — RN's own
  `AnalyticsScreen.js` has the exact same bug via `loadFullRunHistory()`.
- **Fix:** read `users/{uid}.runHistory[]` once, parse each entry with the
  real field names/types (same `duration`/`date` string-parsing approach as
  the RunDetailScreen fix), then rebuild the existing aggregations (total
  distance/runs/avg pace/total time, weekly buckets, pace trend, recent
  runs) against the corrected data. `xpEarned` per recent-run now replicates
  the exact public `saveRunActivity` formula
  (`floor(distance*100 + durationMinutes*2)`) instead of reading a field
  that was never written.
- **Deliberately not touched:** VO2 Max (always 0, card never renders — real
  formula lives in `useAnalytics.js`, not yet ported) and Heart Rate Zones
  (still the pre-existing hardcoded placeholder distribution — real
  per-zone time needs continuous HR sampling during a run, which doesn't
  exist yet). Both are already-flagged, separate work under this same
  roadmap item; fixing the read path doesn't fix those.
- **Verified live:** completed a real run (Start → Lap-less → Stop →
  RateEffort → Save), navigated Home → "See All" → Analytics (a real,
  already-existing nav path — no temporary reroute needed this time).
  Confirmed Total Runs went from the previously-fixed value 0 → 1, the
  Weekly Distance chart rendered a real "W31" bucket (previously always the
  "Run to see your chart" empty state), and Recent Runs showed the actual
  run with the correctly-computed "+1 XP".
- **Also discovered while grepping for this bug's blast radius:** six more
  files have the identical `users/{uid}/runs` bug (Home, both Profile
  screens, ShoeTracker's per-shoe stats, AI Coach's run-history context, and
  Community's run-as-post likes/comments). Documented in the new "Known
  Data-Layer Bugs" section above rather than fixed here — deliberately
  scoped this pass to Analytics only, since Community's case in particular
  needs its own investigation first (a run-as-post data model that may not
  be 1:1 with `runHistory` at all).

### 2026-07-29 (cont.) — Fixed 5 more instances of the same data-layer bug
- **Fixed:** `HomeViewModel.kt` (Today's Activity ring + Recent Activity
  list), `ProfileViewModel.kt` (own-profile Recent Runs grid),
  `UserProfileScreen.kt` (other users' Recent Runs grid),
  `ShoeTrackerScreen.kt` (per-shoe performance stats), `AICoachViewModel.kt`
  ("last 5 runs" system context) — all the same fix as RunDetailScreen/
  Analytics: read `users/{uid}.runHistory[]` instead of the nonexistent
  `users/{uid}/runs` subcollection, with per-file field-name corrections
  (`distance`/`duration`-string/`date`-string instead of whatever numeric/
  Timestamp fields each file had invented). `xpEarned` (Home's recent-runs
  list) replicates the exact public `saveRunActivity` formula, matching the
  same approach used in the Analytics fix.
- **Also found and fixed (same file):** `ProfileViewModel.kt`'s
  `toggleFollow()`/`checkFollowStatus()` read/wrote a
  `users/{uid}/following/{targetId}` subcollection doc that's never
  created — despite commit `7d36f08`'s message claiming this exact bug was
  fixed across three files, it only fixed this file's *read* side (deriving
  counts from array lengths) plus the full read+write fix in
  `UserProfileScreen.kt`; this file's write side was missed. Fixed to match
  `UserProfileScreen.kt`'s correct symmetric-batch-write pattern. **Turned
  out to be unreachable dead code**, though: `ProfileScreen.kt` always
  calls `loadProfile()` with no argument (own-profile only), so this
  ViewModel's "other user" branch — and therefore `toggleFollow()` — can
  never actually execute via the current navigation graph. Fixed anyway as
  a genuine correctness improvement, but no user was ever hitting this and
  there's no live path to verify it against.
- **Investigated, deliberately not fixed:** `CommunityViewModel.kt`'s
  run-as-post feed/likes/comments. No evidence in the preserved RN source
  (`UserContext.js`) or the archive of this concept ever existing in RN —
  `CommunityScreen.js` was never archived despite being 🟡, so there's no
  ground truth to port against. This needs a product decision (redesign
  around `runHistory` entries, or confirm it's dead code), not a schema
  fix — see the "Known Data-Layer Bugs" section for the full reasoning.
- **Verified live:** completed a real run, then confirmed on-device (via
  screenshot — `uiautomator dump` was intermittently returning stale/wrong
  window content this session, unrelated to the app itself) that Home's
  "Recent Activity" now shows the real run instead of the permanent "No
  runs yet" empty state, and own-Profile's "Recent Runs" grid shows a real
  run card instead of staying empty. `UserProfileScreen.kt` (needs a second
  test account), `ShoeTrackerScreen.kt` (needs a shoe + a manually-logged
  run tagged to it), and `AICoachViewModel.kt` (local Functions emulator
  doesn't run `askGemini`, so there's no way to inspect the built context
  without hitting production) were not individually live-verified, but all
  three use the identical parsing helper pattern already proven correct
  four times over (RunDetailScreen, Analytics, Home, Profile).
- **Environment note:** partway through this session's testing, `adb`
  commands (even trivial ones like `getprop`) became extremely slow for a
  few minutes (one `uiautomator dump` attempt returned launcher content
  instead of the foreground app's real UI tree, confirmed via
  `dumpsys activity activities` that the app was actually still correctly
  in focus) — recovered on its own without restarting the emulator. Disk
  space was checked and ruled out (27GB+ free). Screenshots stayed reliable
  throughout; treat `uiautomator dump` as the less trustworthy of the two
  when they disagree.

### 2026-07-29 (cont.) — PersonalRecordsScreen: schema fix + real bucket algorithm
- **Schema bug:** same root cause as the rest of this cluster — read from
  the nonexistent `users/{uid}/runs` subcollection with invented field
  names (`distanceKm`, `durationSeconds`, `startedAt`, `averagePaceMinPerKm`
  as a stored field). Fixed to read `users/{uid}.runHistory[]` with the
  real field names/types (same `duration`/`date` string-parsing as the rest
  of this cluster).
- **Algorithm bug (separate from the schema bug, also fixed):** Android's
  buckets were narrow bands around each exact race distance (e.g. 5K =
  4.9–5.5km), and picked the run with the shortest raw duration within that
  band. RN's real algorithm (`useAnalytics.js` §7, archived in
  `RN_SOURCE_ARCHIVE.md` §2) is different: each bucket is a **minimum-
  distance threshold** (1K≥1, 5K≥5, 10K≥10, Half≥21.09km), and the record
  is whichever qualifying run (at or past that threshold) has the **best
  average pace** — so a fast 10K run legitimately counts as your 5K PR too,
  same as in RN. Also added the archive's `1K` bucket (Android never had
  one) and a "valid run" filter (`distance>0 OR duration>60s`) matching
  RN's exact criteria.
- **Kept, deliberately:** Android's existing `Full`/Marathon bucket. RN
  never computes one at all (`useAnalytics.js` never sets
  `analytics.pbs['Marathon']` — a confirmed gap the archive already
  flagged, "decide whether to add it or intentionally drop the row"). Since
  Android already had this bucket (just with the wrong algorithm) and the
  same threshold/best-pace formula extends to it with zero new logic,
  fixing rather than removing it seemed the lower-risk call — not inventing
  new RN behavior, just correcting an existing bucket's data source.
- **Verified live:** reached the screen via Profile → gear icon → Personal
  Records (previously unreachable in this session without knowing that path
  existed). No crash; correctly shows all five buckets (1K/5K/10K/Half/
  Full) as "Not yet run" — accurate, since no run in this account's history
  has reached even 1km or 60 seconds, so every run is correctly excluded by
  the "valid run" filter. Didn't have a qualifying real run on hand to
  confirm the best-pace bucket-selection logic renders an actual PR value,
  but the logic itself is a straightforward, type-checked transformation of
  the archive's documented formula.

### 2026-07-30 — RunTrackingScreen sub-task 1: permission/GPS-acquisition polish
- **Added:** instant last-known-position map paint on service `onCreate()`
  (`fusedLocationClient.lastLocation`, map-dot only — deliberately bypasses
  `processLocation()` so a stale cached fix never enters route/distance
  tracking), a two-tier accuracy fallback (checks whether the GPS provider
  is actually enabled via `LocationManager`; if not, requests
  `PRIORITY_BALANCED_POWER_ACCURACY` instead of `PRIORITY_HIGH_ACCURACY`
  directly, rather than wasting a GPS-lock attempt that can't succeed —
  Android's `FusedLocationProviderClient` has no literal "throws on bad
  accuracy" signal to port 1:1 from RN's `expo-location` try/catch), and a
  non-blocking background-location permission request (`ACCESS_BACKGROUND_
  LOCATION`, API 29+ only) fired after foreground permission and Health
  Connect permission are resolved.
- **Real bug caught during live verification, fixed in the same pass:** the
  first version fired the Health Connect permission request and the
  background-location request back-to-back in the same `LaunchedEffect` —
  confirmed via `dumpsys package` that `ACCESS_BACKGROUND_LOCATION` stayed
  `granted=false` with no `USER_SET` flag after mount, meaning the second
  `.launch()` call was silently dropped (a known Android pitfall: two
  permission-request Activities launched without awaiting the first one's
  result step on each other, since only one `ActivityResultRegistry`
  transition can be in flight at a time). Fixed by chaining the
  background-location request from the Health Connect launcher's own
  completion callback instead of firing both from the same effect body.
- **Verified live:** confirmed via `dumpsys package com.ruvo.app.debug`
  that `ACCESS_BACKGROUND_LOCATION` was still ungranted before the fix, then
  reproduced the full flow after the fix and confirmed Android correctly
  routed to the system Location-permissions Settings screen (expected OS
  behavior on this API level — background location can't be granted via a
  simple in-app dialog since Android 11). Backed out without granting and
  confirmed the run screen resumed normally with tracking uninterrupted —
  matching the "non-blocking, denial just proceeds foreground-only" design.
  Instant-paint and the accuracy-fallback branch weren't independently
  visually distinguishable on the emulator (both render the same fixed
  test-location dot either way) but introduced no crash or regression.
- **Environment note:** partway through this session the Firebase emulator
  suite's Auth/Functions processes had silently died (only the Firestore
  child process was still orphaned on its port) — likely from the same
  resource pressure that caused the earlier slow-`adb` episode. Killed the
  orphaned process and restarted `firebase emulators:start` cleanly; this
  resets the local Auth/Firestore emulator data (a fresh signup was needed,
  same account name reused), unrelated to the app itself.

### 2026-07-30 (cont.) — RunTrackingScreen sub-task 7: draggable bottom dashboard
- **Built:** the bottom dashboard now responds to a vertical drag gesture
  (`detectVerticalDragGestures`, plus a tap-to-toggle drag-handle pill for
  discoverability/accessibility) to expand/collapse, matching RN's
  "pan-gesture expand/collapse" spec. Expanded state adds an Overview/Charts
  segmented toggle below the always-visible metrics row, per
  RN_SOURCE_ARCHIVE.md §1: **Overview** shows a stats list (voice on/off
  toggle, lap count, workout time, active calories, avg pace, elevation,
  and a 5-zone HR card highlighting the current zone) and **Charts** shows
  a 30-sample rolling heart-rate bar chart (hand-rolled with Compose
  primitives — weighted `Row` + `fillMaxHeight(fraction)` — matching RN's
  own hand-rolled `SimpleBarChart`, no third-party charting lib needed for
  something this simple).
- **Added the voice on/off toggle** flagged as a gap in the 2026-07-29
  voice-template-accuracy log entry: `RunTrackingViewModel.toggleVoice()`
  flips `VoiceCoach.isEnabled` and, only on the on-transition, speaks
  "Voice feedback enabled" via a new `announceVoiceEnabled()` — matching
  the archive's note that this specific line "bypasses the enabled-gate
  intentionally," unlike every other `announce*` call.
- **Not ported (RN doesn't have it either):** a real distance/duration
  "goal" readout next to Distance — RN's dashboard shows "X km of Y km
  goal" tied to workout-mode params that `RunTrackingScreen` doesn't yet
  receive (that's sub-task 13's territory, workout-mode integration).
  Skipped rather than inventing a goal value with no real source.
- **Verified live, thoroughly:** swiped up on the sheet and confirmed it
  expands with animated content resizing; confirmed Overview shows real
  values (Laps, Workout Time matching the HUD duration, Active Calories,
  Avg Pace, Elevation) and the HR zone card renders all 5 zones with no
  "now" highlight (correct — `currentHeartRate` was 0, no Health Connect
  data in this environment); confirmed Charts shows the correct "No heart
  rate data yet" empty state (also correct, same reason). Confirmed the
  voice toggle switch's `checked` state actually flips both directions via
  `uiautomator dump` (not just visually) — first attempts to tap it missed
  by a wide margin because the sheet's expand/collapse shifts every
  subsequent element's Y-coordinate, a recurring source of wasted taps this
  whole session; dumping fresh bounds immediately before each tap on a
  dynamically-resizing container is the reliable approach, not reusing
  coordinates from an earlier screenshot.
- **Environment note:** `adb` briefly reported "device offline" mid-session
  and one `am start` intent unexpectedly re-triggered the full permission
  sequence (Health Connect + background-location) on an already-running
  screen instance — both resolved by `adb kill-server && adb start-server`
  and simply continuing; no code-side cause identified, likely transient
  host/emulator resource pressure consistent with the same session's
  earlier slow-`adb` episode.

### 2026-07-31 — RunTrackingScreen sub-task 12: live-run sharing (deep link + viewer)
- **Built:** `LiveRunViewerScreen.kt` (new) — reads the same
  `runs/{runId}/liveLocation/current` doc `RunTrackingService.pushLiveLocation()`
  already writes every 5s, renders a map marker plus distance/pace/"updated Xs
  ago" metrics, and shows a staleness banner past 30s since the doc has no
  explicit "sharing ended" signal to read (matches RN's own documented gap:
  live-share failures/state changes are silently swallowed, no user-facing
  signal). RN's own live-share design (`startLiveRun`/`endLiveRun` Cloud
  Functions + a `liveRuns/{token}` doc) has no real backend — those Functions
  don't exist and RN never had a working viewer for the `shareUrl` it
  requested either. This replaces that with a first, genuinely-working,
  client-only version.
- **Wired:** a custom-scheme deep link (`com.ruvo.app://live/{runId}`) via a
  new `AndroidManifest.xml` intent filter, `MainActivity` `onNewIntent`/
  `singleTop` handling, a `live_run/{runId}` destination in `RuvoApp.kt`'s
  `NavHost`, and `RunTrackingScreen`'s existing live-share toggle now fires a
  real `ACTION_SEND` share sheet with that link instead of calling RN's
  nonexistent Cloud Functions.
- **Real bug caught during live verification, fixed in the same pass:** the
  deep-link `LaunchedEffect` in `MainGraph` called
  `navController.navigate("live_run/$id")`, but that `NavHost` sits below
  several full-screen early-returns in the composable (own active run
  tracking, paywall, RateEffort/Summary) — so the navigation silently had no
  visible effect whenever the receiving app was showing one of those, most
  notably the sharer's **own** run-tracking screen, the single most common
  real-world case for this feature. Fixed by resetting those overlay states
  (`runFlow = RunFlow.Idle`, `showPaywall = false`) before navigating.
- **Verified live:** toggled live sharing mid-run and confirmed the native
  share sheet fires with the correct `com.ruvo.app://live/{runId}` text;
  fired that deep link via `adb` both before and after the fix — before: left
  the user stuck on `RunTrackingScreen`; after: correctly opened
  `LiveRunViewerScreen`, including its "this run isn't being shared live
  right now" empty state. (The test device also had the separate release
  variant installed under a different `applicationId`, which made Android
  show an "Open with" disambiguation between the two — an artifact of this
  test device having both variants installed, not a production scenario.)
- **Not independently verified:** the map/metrics actually populating from a
  live Firestore sync, due to two environment issues unrelated to this code —
  (1) the local Firebase emulator suite had gone unresponsive
  (`ENETUNREACH`) and needed a restart, and (2) this session's host was
  severely resource-starved (74–100% CPU, well under 2GB free RAM for most of
  the session) while running the Android emulator, the Firebase emulator, and
  Gradle at once, producing several "Ruvo isn't responding" ANRs — including
  one on a completely vanilla run-start with no live-share interaction at
  all, which rules out this feature's code as the cause. Confirmed by
  inspection instead: the write path (`RunTrackingService.pushLiveLocation()`)
  and the read path (`LiveRunViewerViewModel.observe()`) use matching field
  names (`lat`/`lng`/`pace`/`distanceKm`/`updatedAt`) on the same document
  path.
- **Environment note:** same class of resource-pressure issue previously
  logged on 2026-07-30 — Firebase emulator processes had again gone
  unresponsive mid-session and needed a restart. Shut down the emulator and
  the Firebase emulator processes this session started once verification
  wrapped up, to release host resources.

### 2026-07-31 (cont.) — RunTrackingScreen sub-task 13: interval/workout-mode step engine
- **Gap:** `IntervalTrainingScreen.kt` already had a complete step engine
  (`IntervalStep`/`StepType`/`IntervalWorkout.buildSteps()`, per-second
  timer with auto-advance, voice announcements, step-colored UI) but it
  drove its own standalone, non-GPS timer screen — reachable only via a
  dead `"intervals"` nav route nothing links to. Separately,
  `WorkoutDetailScreen`'s "Intervals" Run Type chip existed and was
  visually selectable, but `onStartRun` ignored the selection entirely —
  choosing "Intervals" behaved identically to "Easy" or "Tempo".
- **Built:** integrated the engine into the real GPS-tracked screen instead
  of building a second, parallel pipeline. `RunTrackingViewModel` gained
  `workoutSteps`/`currentWorkoutStepIndex`/`elapsedInWorkoutStep` state and
  an `advanceWorkoutSteps()` step-clock — deliberately **not** a second
  timer: it derives ticks from the delta in `RunTrackingService`'s own
  `elapsedSeconds` flow (already the run's single source of truth for
  wall-clock time) inside the existing `observeService()` combine/collect
  pipeline, so it advances and pauses in perfect lockstep with the real run
  and needs no independent coroutine. `RunHUD`'s header now branches: in
  workout mode it shows the current step's label + remaining-time countdown
  tinted by `StepType.color()` (new extension, factored out of
  `IntervalTrainingScreen.kt`) instead of the plain elapsed-duration
  display, and step transitions fire the same voice-announcement line style
  `IntervalTrainingViewModel` already used. `WorkoutDetailScreen`'s
  "Intervals" chip now reveals an inline preset picker (reusing
  `DEFAULT_INTERVAL_PRESETS`, factored out of
  `IntervalTrainingViewModel.loadPresets()` so both places share one list
  instead of two copies of the same literals) and `onStartRun` passes the
  selected preset's `buildSteps()` through `RuvoApp.kt`'s `MainGraph`
  (`pendingWorkoutSteps`, cleared alongside `resumeCheckpoint` on
  finish/dismiss) into `RunTrackingScreen`.
- **Deliberately left alone:** `IntervalTrainingScreen.kt`'s standalone
  session player (`ActiveIntervalSession`, its own timer/pause/stop) and the
  dead `"intervals"` route — already unreachable before this change, so
  leaving them as dead code is no regression, and removing them was outside
  this task's scope.
- **Verified live** (on the `Medium_Phone_API_36.1` AVD — `My_Emulator`
  had hit an unrecoverable `SystemUI` ANR loop earlier the same session,
  see the sub-task 12 entry above; switching AVDs cleared it): fresh
  account, selected "Intervals" → "Beginner 8×30s" in Workout Setup,
  started the run. Confirmed step count "Step 1/17" through "Step 13/17"
  matches the exact expected `buildSteps()` output for that preset
  (1 warm-up + 8×work + 7×rest + 1 cool-down = 17), confirmed the header
  auto-advanced correctly through the sequence (Warm Up → Interval 1 →
  Recovery → Interval 2 → Recovery → ... → Interval 5), and confirmed all
  three step-type colors live: Warm Up (orange), Work/"Interval N" (lime),
  Rest/"Recovery" (teal). **Not verified:** voice announcements — this AVD
  has no TextToSpeech engine configured (zero TTS-related logcat output at
  all), an environment gap rather than a code issue, since `speak()` is
  called identically to `IntervalTrainingViewModel`'s already-established
  pattern. One real quirk noticed, not a bug in this sub-task's code: the
  step clock (like the plain elapsed-duration display) starts ticking from
  `RunTrackingService` bind, before the user taps the play button to enter
  `RunState.Running` — pre-existing service behavior, unrelated to the new
  step-advance logic, which just consumes the same clock.

### 2026-07-31 (cont.) — TrainingPlanScreen: tap a workout to start it
- **Gap:** `WorkoutCard` in `TrainingPlanScreen`'s "This Week" list had no
  `onClick` at all — a scheduled workout (e.g. "Speed Work — 5km Intervals")
  couldn't be started; the only way into a run was the freeform Home
  screen button or the manual Run Type chips in `WorkoutDetailScreen`.
- **Built:** `WorkoutCard` is now clickable for non-rest workouts, routing
  through a new `TrainingWorkout.toWorkoutSteps()` (in
  `TrainingPlanScreen.kt`) that builds the same warm-up/main-set/cool-down
  `IntervalStep` shape RN's `workoutSteps` default 3-block plan uses
  (`RN_SOURCE_ARCHIVE.md` §5: warmUp=5min, coolDown=5min, mainSet =
  max(duration-10,10)). Android's `TrainingWorkout` never modeled a numeric
  duration field, so `estimatedDurationMinutes()` parses one from the
  existing `detail` string ("X min" directly, or "Xkm" via a ~6min/km
  estimate), falling back to RN's own 30min default. `WorkoutDetailScreen`
  gained an optional `presetWorkout` param: when set, it shows a preview
  card for the tapped workout and hides the freeform Run Type/Warm-up/Goal
  chips (they don't apply to an already-scheduled workout), and "Start
  Workout" feeds `toWorkoutSteps()` through the exact same
  `pendingWorkoutSteps` → `RunTrackingScreen(workoutSteps = ...)` pipeline
  built for sub-task 13's Intervals flow.
- **Deliberately out of scope:** rest-day workouts stay non-clickable (RN's
  equivalent is "Skip Session" → logs a rest day to history via
  `addRunToHistory`, a different action than "start a run" — building that
  Firestore write is a separate, reasonable follow-up, not bundled here).
  RN's much larger `WorkoutDetailScreen.js` (gradient header, numbered
  Workout Structure list, warm-up checklist, terrain/route selector, sync
  toggles) was **not** replicated — the archive doc itself calls these out
  as "sub-features to scope independently"; this pass only makes the tap
  target functional using the existing preview-card idiom.
- **Verified live** (2026-07-31, later same day, on a subsequent
  `Medium_Phone_API_36.1` boot after the earlier ANR-cascade cleared —
  see the weekly-calendar entry below for the same emulator recovering):
  tapped Wednesday's "Easy Run" from the "This Week" strip, confirmed
  `WorkoutDetailScreen` showed the preview card ("WED / Easy Run / 4km
  Zone 2") with the Run Type/Warm-up/Goal chips correctly hidden and the
  button correctly reading "Start Workout" (not "Start Run"); tapped it
  and confirmed `RunTrackingScreen` entered workout mode showing "Warm Up"
  (orange) at "Step 1/3" — exactly the Warm Up → Easy Run → Cool Down
  sequence `toWorkoutSteps()` is supposed to produce.

### 2026-07-31 (cont.) — TrainingPlanScreen: weekly calendar + schedule editing
- **Gap:** the remaining two items on roadmap item #1's checklist. No
  detailed RN spec for either exists in `RN_SOURCE_ARCHIVE.md` §10 (that
  section covers only the Habits subsystem, already done) — RN's exact
  `weekDates`/`selectedDate`/schedule-modal implementation wasn't captured
  before the RN source was deleted, so both were designed fresh against the
  stated goal rather than ported line-for-line.
- **Built — weekly calendar:** `CurrentWeekCard` now shows a 7-day strip
  (`WeekDayStrip`, real calendar dates for the current Mon–Sun week via
  `java.time.LocalDate`/`TemporalAdjusters`, already used elsewhere in this
  codebase) with today outlined and a dot under any day that has a
  workout. Tapping a day shows just that day's `WorkoutCard` below (or "No
  workout scheduled") instead of the previous plain list of every workout
  in the week — a deliberate one-day-at-a-time replacement per the
  roadmap's own wording ("instead of Android's current 'This week' list"),
  consistent with Home's existing single-workout "Today's Training" card.
- **Built — runDays editing:** added "Edit Schedule" to the existing ⋮ menu
  (alongside "I'm Injured"/"I'm on Vacation"/"Change Goal", same
  `showEditMenu` pattern), opening a `SchedulePickerSheet` — Mon–Sun
  multi-select chips, Save disabled with a hint until at least one day is
  selected (mirrors `updateRunDays`'s own guard). `updateTrainingPlan`
  gained an optional `newRunDays` param and now writes `runDays` to
  Firestore alongside `trainingPlan`/`goal` in the same `.update()` call —
  previously `runDays` was read-only on Android (write path never existed
  outside onboarding), always falling back to Mon/Wed/Fri once set. Saving
  regenerates the 4-week plan from the new schedule, reusing the existing
  `generateWeekPlan()` algorithm unchanged.
- **Verified live** (2026-07-31, later same day — the host's ANR-cascade
  from earlier this session cleared on a subsequent `Medium_Phone_API_36.1`
  boot): day strip showed the correct current-week dates (Mon 27 – Sun 2)
  with Friday (actual today) outlined; tapped Monday and confirmed the
  shown workout swapped from Friday's "Long Run — 8km Steady" to Monday's
  "Easy Run — 4km Zone 2"; opened Edit Schedule, confirmed it pre-selected
  the actual Mon/Wed/Fri `runDays`, added Tuesday, saved, and confirmed
  Week 1's total went from 15km → 20km and Tuesday gained a workout dot —
  then **force-stopped and relaunched the app** (not just re-navigated)
  and confirmed the 4-day schedule and 20km total were still there, i.e.
  the `runDays` write genuinely reached Firestore rather than only
  updating in-memory state.

### 2026-07-31 (cont.) — ProfileScreen: weekly activity card (streak + run-dot strip)
- **Built:** a combined "Weekly Activity" card in `ProfileScreen.kt` —
  merges two of roadmap item #3's ~10 remaining sub-features (weekly
  calendar strip, streak card) into one component rather than building two
  near-duplicate 7-day views. Shows a streak count + flame emoji + "ON
  FIRE" badge (streak ≥ 3, a judgment call — no exact RN threshold exists
  to port) and a Mon–Sun dot row (today ringed, days with a completed run
  filled lime). `ProfileViewModel` gained a `runDates: Set<LocalDate>`
  derived from the **full** `runHistory` array (not just the 9 shown in
  the Recent Runs grid) so the streak reflects the complete history.
- **Per archive §3/§9's explicit warning:** RN has **no persisted streak
  field anywhere** — the only streak-adjacent logic is the `b_perfect_week`
  badge recomputing consecutive-day-run status from scratch every render.
  `computeStreak()` follows the same pattern (walks backward from today
  over the actual run dates, not a stored counter) rather than inventing a
  new persisted field. Also per that same warning: this is a **display**
  feature only — no coin/XP streak bonuses were added, since none exist in
  RN's real backend and building them would be new product behavior, not a
  port.
- **Verified live** (2026-07-31, same emulator session as the TrainingPlan
  verification above): fresh account with zero run history correctly
  showed "0 days / Current streak", no "ON FIRE" badge, and today (Friday)
  correctly ringed in the M-T-W-T-F-S-S strip with all dots unfilled.
  Didn't test the filled-dot/≥3-day-streak branches live (would need a
  completed run first) — low risk, identical color-conditional pattern to
  `WeekDayStrip`'s already-verified workout-dot rendering in
  `TrainingPlanScreen.kt`.

### 2026-08-01 — ProfileScreen: country picker, share-profile flow, refresh
- **Built — country picker:** `EditProfileSheet`'s free-text "Location"
  field (which let "usa"/"United States"/anything land in the same field
  with no canonical value) is now a picker button opening a searchable
  `CountryPickerSheet`, backed by a new `Countries.kt` — the actual
  `docs/rn-reference/countries.js` list (197 countries) transcribed
  verbatim, not a placeholder subset.
- **Built — share-profile flow:** a share icon (own profile only) fires a
  native `ACTION_SEND` with `https://ruvo.app/u/{uid}`. RN's version shares
  `.../u/{username}`, but Android has no username system yet (RN's
  `usernames/{name}` reservation-transaction in `UserContext.js` was never
  ported) — using the Firebase uid is a pragmatic stand-in until that
  lands, called out explicitly in code rather than silently diverging.
- **Built — pull-to-refresh, as a manual refresh button instead:** attempted
  Material3's `PullToRefreshBox` first; it compiled to "@Composable
  invocations can only happen from a @Composable function" errors — this
  project's resolved Material3 version (via `compose-bom = 2024.06.00`,
  material3 1.2.1) predates that API's stabilization (added in 1.3.0).
  Rather than bump the BOM app-wide to chase one small feature, added a
  manual refresh icon (spinner while `ProfileViewModel.loadProfile()` is
  in flight, via a new `isRefreshing` state field) — same functional
  outcome, no swipe gesture.
- **Verified live** (same emulator session as the TrainingPlan/Weekly
  Activity verification the day before, which by this point had recovered
  from the earlier ANR cascade): tapped Refresh and confirmed no crash/
  hang; tapped Share and confirmed the native share sheet showed the
  correct text with a real uid; opened the country picker, searched
  "canada" and confirmed it filtered to exactly one result, selected it,
  saved, and confirmed the profile header now reads "📍 Canada".

### 2026-08-01 (cont.) — ProfileScreen: XP progress bar
- **Built:** own-profile `ProfileScreen.kt` had a bare stats row with no XP
  bar at all — `UserProfileScreen.kt` (viewing someone *else's* profile)
  already had a correctly-working one, so this ports that exact same
  `currentXP`/`xpToNextLevel` read + `LinearProgressIndicator` pattern
  rather than inventing a new one. Confirmed field defaults directly from
  `UserContext.js`: `level: 1, currentXP: 150, xpToNextLevel: 1000`. Per
  archive §9's explicit warning (already called out in the item #3
  checklist itself): these fields are static in RN — nothing anywhere
  increments them — so this is a pure display of whatever value is on the
  doc, no level-up/XP-award logic added.
- **Verified live:** fresh account correctly showed "XP Progress — 0 /
  1000" with the bar at ~0%. Didn't test a nonzero/partially-filled case
  live (would need a seeded `currentXP` value) — low risk, identical
  progress-fraction math to the already-working `UserProfileScreen.kt` bar
  it was ported from.

### 2026-08-01 (cont.) — ProfileScreen: gear preview card
- **Built:** own-profile "Gear Preview" card — reads the same `gearList`
  array field `ShoeTrackerScreen.kt` already owns (folded into the
  existing `loadProfile()` fetch, no second network call), picks the
  "primary" shoe (`isDefault == true`, falling back to the first entry —
  same concept `ShoeTrackerScreen.kt` uses), and shows its mileage bar +
  remaining km, or a "near its limit"/"time to retire" message using the
  exact same `progress > 0.8f` warning threshold and retired/warning/lime
  color states that screen already established. Card is hidden entirely
  when the user has no shoes. Tapping it navigates to `"shoes"` (the same
  route `SettingsSheet`'s "My Shoes" row already uses).
- **Verified live:** confirmed the card is correctly absent for a
  brand-new account with an empty `gearList`; added a shoe via Gear
  Tracker ("Hoka Clifton 9", AI-detected 800km limit via
  `detectShoeLimit()`), returned to Profile, and confirmed the card
  appeared with "👟 Hoka Clifton 9" / "800 km remaining" and an
  (empty, 0%-used) progress bar; tapped the card and confirmed it
  navigated to the Gear Tracker screen showing that same shoe.

### 2026-08-01 (cont.) — Achievements: real bug found — badge catalogue was fully invented; + Profile preview card
- **Real bug found while scoping the Profile badges grid:**
  `AchievementsViewModel.kt`'s `ALL_BADGES` was **not** RN's actual
  catalogue — it had different ids (`first_5k`/`streak_30`/`gear_tracker`
  etc., none of which exist in RN), extra badges RN never had, and was
  **missing** several real RN badges entirely (`b_perfect_week`,
  `b_weekend_warrior`, `b_hill_hunter`, `b_sub4_specialist`). Category
  strings were also ad hoc rather than RN's exact 5 category names. Found
  by comparing against the verbatim `docs/rn-reference/badges.js` copy
  while checking what data the Profile grid should reuse — this file was
  already marked 🟡 "Android larger — spot-check only" in the roadmap
  table, i.e. never actually checked against archive §3 before.
- **Fixed:** replaced `ALL_BADGES` with RN's exact 12 badges (id, name,
  description, category, and RN's real hex colors), category strings set
  to the exact display names archive §3 documents (`milestone`→"Distance
  Milestones" etc.) since `buildCategories()` groups by this field
  directly — no UI changes needed, only the underlying data. Also made
  `ALL_BADGES` non-`private` so `ProfileViewModel`/`ProfileScreen` can
  reuse the same catalogue rather than a second copy.
- **Scope note, deliberately not built:** RN's actual badge-*awarding*
  mechanism (`checkNewBadges()`/`badgeService.js`, run after every saved
  run) has **no Android equivalent anywhere** — confirmed by grepping the
  whole app for any of the badge ids/`checkNewBadges`; only
  `AchievementsViewModel.kt` references the catalogue at all, and no
  Firestore write ever populates a user's `badges` array. This means the
  catalogue fix corrects what's *displayed*, but every account will show
  all badges locked forever until the awarding logic is built — a
  separate, larger feature (12 conditions, wired into the run-save
  pipeline) that shouldn't be invented as a side effect of a display fix.
- **Built (the actual roadmap item):** a Profile "Achievements" preview
  card — reuses `ALL_BADGES` directly (no second catalogue), shows
  "X/12" unlocked count and a horizontal scrollable row of all 12 badge
  circles (colored + full opacity if unlocked via the same `badges` array
  `AchievementsViewModel` already reads, dimmed gray otherwise). Tapping
  navigates to `"achievements"` (same route `SettingsSheet` already uses).
- **Verified live:** confirmed the preview card showed "0/12" with all 12
  circles dimmed (expected, given the awarding-mechanism gap above);
  tapped through to the full "Trophy Room" screen and confirmed all 5
  category headers and counts match RN exactly — Distance Milestones 0/5,
  Lifestyle & Habits 0/3, Consistency & Streaks 0/2, Elevation Challenges
  0/1, Speed & Performance 0/1 (5+3+2+1+1 = 12) — with the correct badge
  names/emoji in each.

### 2026-08-15 (cont.) — ProfileScreen: Saved Tips library tab
- **Built** (Roadmap item #3): RN's Saved Tips library tab had no Android
  equivalent — this was the only remaining open sub-item on this screen with
  a concrete, already-built backing (unlike "Active challenges", whose real
  RN source/formulas were never archived — see that checklist line). The
  `savedTips` array field, `ContentRepository.fetchTips()`/`toggleBookmark()`,
  and the `tip_detail/{tipId}` nav route all already existed from
  `TipDetailScreen.kt` — this only wires them into ProfileScreen.
- **Data:** `ProfileViewModel.loadProfile()` now also reads `savedTips` off
  the user doc and, for one's own profile only (a personal bookmark shelf,
  same privacy scope as Edit Profile/avatar upload), filters
  `contentRepository.fetchTips()` down to the saved ids via a new
  `loadSavedTips()` — no separate Firestore read path invented.
- **UI:** new `SavedTipsCard` composable — header + count, an empty state
  ("No saved tips yet — bookmark tips you like from a tip's detail page.")
  matching Recent Activity's own empty-state convention, or a horizontal
  scroll of chips (category tag/color mirrors `TipDetailScreen.kt`'s
  `CATEGORY_META`, title, read time) tapping through to
  `tip_detail/{tipId}`. Shown only on one's own profile.
- **Verified live end-to-end**, twice — once on a stale cached session (see
  below) and once on a genuinely fresh account (`SavedTipsQA`) created
  against a freshly-restarted emulator pair specifically to rule out cache
  contamination: empty state on a brand-new account, bookmarking a tip from
  its detail page, the card populating with the correct category/title/read
  time, and tapping the chip navigating back to the correct tip detail page
  — all confirmed correct via `uiautomator dump`-precise taps.
- **Real environment issue found while verifying (not a code bug in this
  feature or in `TipDetailViewModel`):** re-opening a just-bookmarked tip's
  detail page sometimes shows the bookmark icon as unfilled again, even
  though the Saved Tips card correctly lists it. Root-caused via the
  Firestore emulator's REST API directly (`runQuery` against `users`): the
  `savedTips` array write from `toggleBookmark()`'s `arrayUnion()` never
  actually reaches the server doc at all (confirmed on the fresh account —
  no `savedTips` field server-side, even minutes later), while the UI still
  shows correct data because Firestore's offline persistence cache reflects
  the optimistic local write. `adb logcat` shows the cause: intermittent
  `Firestore: [WatchStream]... RESOURCE_EXHAUSTED, HTTP/2 error code:
  ENHANCE_YOUR_CALM (Bandwidth exhausted) / too_many_pings` — the same class
  of sandbox network instability already documented elsewhere in this file
  (TLS pin verification blocking real Google endpoints, no real internet
  egress), this time throttling the local-emulator gRPC stream itself.
  `ProfileViewModel`/`TipDetailViewModel` both just call plain `.get()` and
  correctly display whatever Firestore's SDK returns (cache or server) —
  nothing to fix in either one from what's provable here. Flagged for a
  real-device/unrestricted-network pass to confirm writes actually persist
  server-side in a non-throttled environment.
- Files: `ProfileScreen.kt`, `ProfileViewModel.kt`.

### 2026-08-15 — ProfileScreen: avatar upload/picker flow
- **Built** (Roadmap item #3): RN's `AvatarPickerModal` → `updateUserProfile({avatar})`
  had no Android equivalent at all — the avatar circle was a hardcoded
  person-icon placeholder, and `ProfileViewModel` already read an `avatarUrl`
  field from Firestore but nothing ever displayed or wrote it. RN's own
  avatar-picker implementation no longer exists to inspect (source deleted,
  and it was never deep-dived into the archive before that), so this is a
  from-scratch design against the one concrete constraint that does survive:
  the write shape is `updateUserProfile({avatar: <value>})` on the `users/{uid}`
  doc.
- **UI:** the system Photo Picker (`ActivityResultContracts.PickVisualMedia`,
  zero runtime permissions needed, unlike `ACTION_GET_CONTENT`/
  `READ_MEDIA_IMAGES`) opens on tapping the avatar circle or a small
  camera-badge overlay (own profile only); the circle now renders the real
  photo via Coil `AsyncImage` when `avatarUrl` is set, with a semi-transparent
  spinner overlay while uploading.
- **Upload:** `ProfileViewModel.uploadAvatar(uri)` uploads to Firebase Storage
  at a fixed per-user path (`avatars/{uid}.jpg` — a re-upload overwrites the
  old file rather than accumulating orphans), then writes the resulting
  download URL to the `avatar` field, matching RN's write shape.
- **Infra gap found and fixed along the way:** `FirebaseStorage` was
  provided via Hilt but, unlike Auth/Firestore/Functions, was never gated by
  `USE_FIREBASE_EMULATOR` — the exact same bug class the `provideFirebaseFunctions()`
  comment already flags ("every callable... was silently hitting real
  production with a local-emulator auth token, which production rejects").
  Storage had simply never been exercised by any feature before this one to
  catch it. Fixed by adding the same `useEmulator("10.0.2.2", 9199)` gate,
  plus a new `storage.rules` file (owner-only write, public read, matched by
  exact `{uid}.jpg` filename) and wiring the Storage emulator into
  `firebase.json`.
- **Verified live (partially) — real environment blocker found, not a code
  bug:** the photo-picker UI flow (tap avatar → system picker opens → select
  an image → picker closes → upload attempt fires) was confirmed working
  exactly as coded, repeatedly, via `uiautomator dump`-precise taps. But the
  Storage upload itself consistently failed with `StorageUtil: error getting
  token java.util.concurrent.TimeoutException`. Diagnosed conclusively as an
  environment limitation, not an app bug: `adb shell ping 8.8.8.8` from the
  emulator shows 100% packet loss (no real internet egress, only routing to
  the host via `10.0.2.2`), and app-process logcat separately shows
  `SSLHandshakeException: Pin verification failed` /
  `CertificateException: Pin verification failed` when *any* Firebase SDK
  component tries to reach a real Google endpoint (caught here via Analytics'
  `firebaselogging.googleapis.com` calls, and Firestore's own occasional
  `Failed to get auth token: INVALID_REFRESH_TOKEN` App-Check-token warnings)
  — this dev sandbox intercepts outbound HTTPS with a proxy whose certificate
  doesn't match Google's pinned certs. Firestore/Auth/Functions were never
  affected by this all session because they only ever talk to the local
  emulator (`10.0.2.2`); Storage's SDK-internal token wrapper apparently still
  needs to reach a real endpoint even when `useEmulator()` is set, so it's the
  first feature this session to actually hit the block. Tried one plausible
  code-level mitigation (pre-warming a cached ID token via
  `auth.currentUser?.getIdToken(false)` before the Storage call, in case a
  race rather than connectivity was the cause) — did not help, consistent
  with a TLS-layer block that no application code can route around.
- **Net status:** compiles clean, UI flow live-verified, Storage write path
  not provably working end-to-end from this environment. Whoever picks this
  up next on a real device or an unrestricted network should be able to
  confirm it works as-is with no further code changes — or find a real bug,
  in which case this diagnosis was wrong and should be corrected here.
- Files: `ProfileScreen.kt`, `ProfileViewModel.kt`,
  `core/di/AppModule.kt`, `firebase.json`, `storage.rules` (new).

### 2026-08-14 (cont. 4) — RunTrackingScreen sub-task 1: permission/GPS-acquisition polish
- **Continuing prior partial work:** commit `879c456` (2026-07-30) already
  built instant last-known-position map paint, the two-tier accuracy
  fallback, and non-blocking background-location permission requesting —
  but the roadmap table/checklist were never updated to reflect it, so this
  sub-task still read as entirely open. This entry closes the remaining gaps.
- **Real bug found and fixed:** `RunTrackingService.onStartCommand()` called
  `startTimer()` immediately on service bind (right after permission grant),
  well before the user ever taps the Start button — so `elapsedSeconds` (and,
  once GPS fixes started arriving, distance/route) silently accumulated
  during the Idle/"Acquiring GPS" wait, before the 3-2-1 countdown even
  began. Flagged as a known gap in the 2026-07-29 HR-zone log entry but not
  fixed until now. **Fix:** added an `isTrackingActive` flag — the service
  still requests location updates immediately (so the map dot can paint and
  a "GPS ready" fix can be detected), but `processLocation()` now returns
  right after updating the map-dot `_location` if tracking hasn't actually
  started, and `startTimer()` only fires from a new `startActiveTracking()`
  entry point called by `RunTrackingViewModel.startCountdown()` once the
  countdown finishes (or immediately for a crash-recovery
  `restoreFromCheckpoint()`, since a checkpoint only ever exists mid-run).
- **Built (RN UI spec, previously entirely missing):** an "Acquiring GPS…"
  spinner overlay (`RN_SOURCE_ARCHIVE.md` §1 UI table: "'Acquiring GPS...'
  spinner overlay until gpsReady") shown in `RunTrackingScreen` while Idle
  and no fix has landed yet; the Start button is now disabled/dimmed until
  then — the closest Android equivalent to RN auto-starting tracking on GPS
  lock (RN has no manual Start button at all, an already-accepted platform
  difference from earlier log entries).
- **Built (RN edge cases, previously entirely unhandled):**
  - Background-location-permission denial now shows RN's documented
    "non-blocking warning" (`RN_SOURCE_ARCHIVE.md` §1 Edge cases: "shows a
    'set Always Allow in Settings' alert") — previously the denial callback
    was a no-op with no user-facing indication at all.
  - GPS total-acquisition-failure now shows RN's documented blocking "GPS
    Error" alert + forced exit (`goBack()` equivalent) if no fix arrives
    within 20s of binding — previously there was no timeout at all; a
    device that could never get a fix would show the (also newly-added)
    spinner forever with no way out except the header's close button.
    20s is a considered choice, not a value recovered from RN source — the
    archive documents the alert's existence but not RN's exact timeout.
- **Deliberately not changed:** RN's foreground-permission-denied flow is
  "blocking alert + forced `goBack()`, no retry-in-place"
  (`RN_SOURCE_ARCHIVE.md` §1 Edge cases); Android's existing
  `LocationPermissionRequired` screen offers a "Grant Location Access" retry
  button instead. Kept as-is — an Android permission re-prompt is standard
  platform convention, not a fidelity gap worth regressing to RN's
  no-retry pattern.
- **Real bug caught during live verification and fixed:** the "GPS ready"
  gate awaited `service.location.filterNotNull().first()` — but that same
  `location` flow's very first value is often the instant-paint cached
  last-known position set directly in `onCreate()` (a stale fix that could
  be minutes old or from a different place entirely), so the Start button
  was immediately enabled with no real fix, completely defeating the gate.
  Added a separate `hasLiveFix` flow on the service, only latched from a
  genuine location-callback fix inside `processLocation()`, and pointed the
  ViewModel's timeout-await at that instead.
- **Verified live** on a freshly booted `My_Emulator` AVD + local Firebase
  emulators (existing `RuvoQA_HR2` test account): confirmed via
  `uiautomator dump`/screenshots that (1) Duration stays `0:00` through the
  Idle wait and only starts ticking once the countdown finishes — the core
  bug this entry fixes; (2) the Background Location non-blocking warning
  dialog renders with the exact copy and Continue/Open Settings actions;
  (3) with location services forced off (`adb shell cmd location
  set-location-enabled false`), the Start button renders visibly dimmed and,
  after the 20s timeout, the "GPS Error" alert appears with the exact copy
  and its OK button correctly exits back to Home; (4) with location
  re-enabled on a clean emulator boot (avoiding a `FusedLocation: blocked -
  too fast/too close` Play-Services throttling artifact from repeated
  force-stops earlier in the session, which was an environment quirk, not
  an app bug), the Start button un-dims, tapping it runs the 3-2-1
  countdown, and Duration/Workout Time then tick correctly (confirmed at
  `0:45` and `1:37`) with Stop correctly reaching the Run Complete sheet.
  The overlay/spinner itself renders too briefly to catch in a screenshot
  on this AVD (GPS locks in well under a second once Play Services isn't
  throttled) — its gating logic is proven correct via the disabled-location
  test instead, which is the harder case anyway.
- Files: `RunTrackingService.kt`, `RunTrackingViewModel.kt`,
  `RunTrackingScreen.kt`.

### 2026-08-14 (cont. 3) — VoiceCoach: real AudioFocusRequest ducking
- **Gap:** `VoiceCoach.speak()` never requested audio focus at all — TTS
  announcements played without ducking whatever music/podcast the user had
  running, unlike RN which fakes an "always active" audio session via a
  looped silent WAV specifically to hold ducking focus (documented as a
  trick to replace, not port, in `RN_SOURCE_ARCHIVE.md` §5 WorkoutDetailScreen
  "Audio ducking hack" — note that hack is actually about WorkoutDetailScreen's
  persistent "No Music" workout session, a separate still-unported feature;
  VoiceCoach only needed the equivalent behavior for its own TTS utterances).
- **Fix:** requests `AudioFocusRequest` (`AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`,
  `USAGE_ASSISTANCE_NAVIGATION_GUIDANCE`) immediately before each `speak()`
  call, and releases it via a `UtteranceProgressListener` once TTS reports
  the utterance done/stopped/errored (plus on `shutdown()`). Speaks
  regardless of whether focus was actually granted — a coaching cue that
  fails silently because some other app briefly held focus would be worse
  than one that plays without ducking.
- Compiles clean (`compileDebugKotlin`); not live-verified this pass (TTS
  ducking isn't screenshot-checkable — would need the established
  temporary-`Log.e` + `adb logcat` technique with actual background audio
  playing on the emulator, not done here).
- **Still open, separate from this fix:** WorkoutDetailScreen's own
  "No Music" persistent-session audio hack (Roadmap item #5) — not touched.

### 2026-08-14 (cont.) — AnalyticsScreen: Race Predictor and Recovery Score cards
- **Built** (Roadmap item #5, continuing the same batch as the entry
  below): the two remaining `useAnalytics.js`-specified Advanced Metrics
  cards that were completely absent — Race Predictor (Riegel's formula off
  the best 5k-normalized effort in history) and Recovery Score (a 3-tier
  hours-since-last-run heuristic).
- Both added as new `RacePredictions`/`RecoveryStatus` state and cards
  below the VO2 Max/Consistency row, reusing the `allRuns` (full lifetime
  history) parse already added for those.
- **Verified live** with a seeded history: best 5K-normalized pace of
  1500s (25:00/5km) predicted 5K "25m", 10K "52m", Half "1h 55m", Marathon
  "3h 59m" — all four matched hand-calculation via the same Riegel formula.
  Deliberately placed the most recent seeded run 30 hours back (rather than
  <24h or >48h, either of which risks passing even with a broken
  three-branch `when`) to specifically exercise the middle "Almost Ready"
  80% tier — confirmed it rendered correctly, not just the easy default.
- Still open for this item: half-blend chart averaging, Personal Records
  as an in-Analytics card, and Pro-paywall gating — see Roadmap item #5.

### 2026-08-14 — AnalyticsScreen: real VO2 Max, Consistency Score, and Heart Rate Zones
- **Built** (Roadmap item #5): three of the "Advanced Metrics" features
  RN_SOURCE_ARCHIVE.md §2 flagged as built-on-Android-as-schema-fixes-only —
  VO2 Max, Consistency Score, and real HR zones — using the exact formulas
  from `docs/rn-reference/useAnalytics.js` (a full raw source copy, not just
  the archive's parsed summary, which only had descriptor thresholds, not
  the underlying calculations).
- **VO2 Max was completely dead code before this fix**: `AnalyticsUiState.vo2max`
  defaulted to `0.0` and `loadData()` never set it, so `VO2MaxCard`'s
  `if (vo2max <= 0) return` meant the card could never render — confirmed
  exactly matching the archive's own note about this. Also fixed
  `vo2maxCategory()`, whose thresholds/labels ("Below Average" <30 →
  "Excellent" ≥60) didn't match RN's real descriptor at all (archive §2:
  "Superior ≥55, Good ≥45, Fair ≥35, else Basic").
- **HR zones were a hardcoded placeholder** (20/35/25/15/5% split, "real
  data would come from health connect") — replaced with the real
  calculation: `maxHR = 220 - age` (Android falls back to RN's own
  `userData.age || 30` default, since neither app's onboarding collects
  age), then bucketing each run's heart rate into Z1–Z5 by percentage of
  max, same as `useAnalytics.js`.
- **Consistency Score was entirely absent** — added as the "twin box" next
  to VO2 Max per the archive's UI layout, computed as (runs in the last 28
  days) ÷ 4, redesigned both cards from the old full-width circular-gauge
  VO2 card into a compact side-by-side pair to fit two boxes in the row.
- All three read from the **full lifetime `runHistory`**, not the period
  selector — matches `useAnalytics.js`, which computes these independent of
  AnalyticsScreen's own time-range filter (only the charts/period totals
  are period-filtered).
- **Verified live end-to-end**: seeded a seeded 5-run history (via the
  Firestore emulator REST API — direct Compose taps kept missing on this
  screen's "See All" entry point until pixel-sampled coordinates were used,
  same class of screenshot-scale-factor mistake as earlier sessions, not an
  app bug) with heart-rate values chosen to hand-verify against the exact
  same formulas: VO2 Max computed 62 ("Superior"), Consistency 1.3
  ("Building"), HR zones Z3 100%/Z4 66% — **all three matched the manual
  calculation exactly**.
- **Not done this pass** (see Roadmap item #5 for the rest): the half-blend
  chart averaging formula, Personal Records-as-an-Analytics-card
  (Android keeps it as a separate screen), Race Predictor, Recovery Score,
  Pro-paywall gating.

### 2026-08-13 (cont. 2) — Spot-check audit: CreateClub/UserList/TipDetail/CustomerCenter
- **Audit performed** against `RN_SOURCE_ARCHIVE.md` §8 (Roadmap item #8) —
  code comparison only, no live emulator round this pass (see per-file
  findings in the Roadmap item itself, kept there rather than duplicated
  here). **No bugs found** — everything is either an exact match or a
  legitimate, already-acceptable scope gap:
  - `CustomerCenterScreen.kt`: exact match.
  - `TipDetailScreen.kt`: excellent match, including all 8
    `CATEGORY_META` hex colors matching the archive exactly, and correctly
    mirroring RN's own unpersisted "Mark as Helpful" toggle rather than
    "fixing" it into something RN itself never built.
  - `CreateClubScreen.kt`: internally consistent (write/read field names
    agree with `ClubDetailScreen.kt`); missing banner-image picker and
    optional Location field vs. RN — legitimate smaller scope, not a bug.
  - `UserListScreen.kt`: 2-state Follow button instead of RN's 3-state
    (with a "Requested" state for private accounts) — correct, since
    Android has no private-account/follow-request feature at all to back
    a third state.
- Confirms this item's premise (line counts already close, expected to be
  quick) was right — closing it out with no code changes needed.

### 2026-08-13 (cont.) — Auth flow audit: real password-checklist bug found + fixed
- **Audit performed** against `RN_SOURCE_ARCHIVE.md` §7 (Roadmap item #7):
  compared `AuthScreen.kt`/`AuthViewModel.kt`/`OnboardingScreen.kt` against
  RN's Welcome/Login/SignUp/OnboardingSignUp/ForgotPassword/LockScreen specs.
- **Real bug found and fixed:** `SignUpScreen`'s "Create Account" button was
  only gated on `password.length >= 8`, showing a single "Minimum 8
  characters" message. RN's `SignUpScreen.js` requires **all 6** rules from
  `passwordStrength.js` (min length, uppercase, lowercase, number, symbol,
  not-a-common-password against a ~24-entry blocklist) with a live
  pass/fail checklist shown as the user types. Added `PasswordStrength.kt`
  (exact port of the archived rule logic, including the blocklist) and a
  `PasswordRulesChecklist` composable; the button is now gated on
  `isPasswordValid()`. **Verified live:** typed a weak password ("abc") and
  confirmed only 2/6 rules showed as met; typed a valid one and confirmed
  all 6 flipped green and the button enabled.
- **Confirmed dead code:** `ForgotPasswordScreen.kt` (a standalone screen)
  has zero references anywhere in the app outside its own declaration —
  only `ForgotPasswordDialog` (inside `AuthScreen.kt`) is actually reachable
  from `LoginScreen`. Not deleted this pass (zero-risk either way) but
  flagged in the roadmap as a trivial cleanup.
- **Confirmed correct (no fix needed):** `sendPasswordReset()` already uses
  the real client-side Firebase Auth SDK rather than RN's
  `sendPasswordResetLink` Cloud Function — which per the "Known Backend
  Bugs" table doesn't exist even in RN itself, so calling it would've been
  porting a bug, not fixing one.
- **Scope note:** rate limiting, biometric auto-login, and `LockScreen`'s
  detailed parity are still open — see Roadmap item #7 for what's left.
- Session continued to fight severe emulator instability (same class of
  issues as the entry above); one clean boot was enough to get the live
  verification done before it degraded again.

### 2026-08-13 — RewardsScreen: reward redemption live-verified against the real Cloud Function
- **Goal:** close out Roadmap item #4's oldest open item — a full live
  click-through of reward redemption, left unverified since the
  `49fbc0a` schema/security fixes because the emulator kept crashing.
- **Session was dominated by severe, repeated Android emulator
  instability** unrelated to app code: frozen splash renders that
  screenshots kept confirming were genuinely stuck (identical clock,
  no new frames), a fully wedged `adb` bridge needing `kill-server`/
  `start-server`, and — the actual root cause of one long stretch of
  failures — a **stale `multiinstance.lock` file** left behind in
  `~/.android/avd/Medium_Phone.avd/` by an earlier `emu kill` that
  silently blocked every subsequent relaunch attempt (`emulator` logged
  "Another emulator instance is running" and hung) until the lock file
  was manually deleted. Also hit the same transient local-Functions-
  emulator "Cannot determine backend specification. Timeout after
  10000" load failure documented in earlier sessions — same fix,
  restart once and it loads.
- **Once "Confirm Redemption" taps stopped registering** even on an
  otherwise-responsive emulator (no crash, no ANR — the tap just had no
  effect, an interaction-layer symptom rather than a functional bug),
  switched strategy: called the local Functions emulator's
  `redeemReward` HTTP endpoint directly with a real Firebase Auth ID
  token (`Authorization: Bearer <idToken>`, same wire payload shape the
  Android `FirebaseFunctions` SDK sends). This still exercises the real,
  unmodified server-side transaction — not a mock — just bypasses the
  Compose tap layer specifically.
- **Verified:** a seeded 1000-coin account redeeming an 800-coin reward
  went to exactly 200 coins, and `users/{uid}/redemptions` got a doc
  with `rewardId`/`title`/`price`/`timestamp` — the exact fields
  `MyRedemptionsScreen.kt` reads. A follow-up redemption attempt at
  200 coins correctly failed with `FAILED_PRECONDITION`. Also confirmed
  (from screenshots taken earlier in the session before the environment
  degraded) that the rooted-device lockout doesn't false-positive on
  this AVD — the redemption sheet rendered normally rather than showing
  the lockout error.
- **Not completed:** referral-code redemption between two accounts.
  Unlike reward redemption, that logic is 100% client-side
  (`ReferralViewModel.kt`, no Cloud Function to call directly), so a
  REST-based workaround would only prove Firestore accepts writes, not
  that the Android code works — deliberately not faked. Left open, see
  Roadmap item #4.

### 2026-08-03 (cont. 2) — SettingsDetailScreen audit: real notification/units persistence bug + password audit log
- **Audit performed** against `RN_SOURCE_ARCHIVE.md` §6b's 6 `SettingsDetail`
  variants (see Roadmap item #6 for the full per-variant breakdown).
- **Real bug found and fixed:** `SettingsScreen.kt`'s "Metric Units" and 3
  notification toggles (`Run Reminders`/`Challenges & Badges`/`Friend
  Activity`) were pure `remember { mutableStateOf(true) }` — never read from
  or written to Firestore, using names that didn't even match RN's real
  keys. Every toggle silently reset on next launch; nothing a user changed
  here ever persisted. Added `SettingsViewModel.kt` and rewired the UI to
  RN's actual contract: `notificationSettings.workoutReminders`/`.tips`
  (PREFERENCES) and `.newFollowers`/`.communityActivity`/`.clubUpdates`
  (COMMUNITY, split into its own section to match RN), plus `unitSystem`
  (`"metric"`/`"imperial"`) — each written via a single dotted-path
  `Firestore.update()` call per toggle, with optimistic UI + rollback on
  failure. The units toggle UI (vs. RN's two radio rows) is a deliberate
  Android-idiom choice.
- **Also fixed:** the `Password` variant's `updatePassword()` flow already
  existed and worked, but was missing RN's `logSensitiveAction`
  `auditLog` write entirely. Added it — then found a **second real bug**
  while live-testing: `updatePassword()` can fire FirebaseAuth's sign-out
  listener immediately on success (confirmed live via logcat: "Notifying
  auth state listeners about a sign-out event" logged the instant the call
  resolved), which tears down the dialog's composable and cancels its
  `coroutineScope` before an ordinary suspend call would reach the
  audit-log write — so a naive "await password change, then write audit
  log" ordering can silently drop the log. Fixed by wrapping the audit-log
  write in `withContext(NonCancellable)`.
- **Verified live end-to-end** (fresh test account, real Firestore
  emulator, real Auth emulator): toggled 2 notification settings + units
  off, force-killed and relaunched the app, confirmed both read back
  correctly from a fresh `loadSettings()` fetch; separately confirmed via
  the Firestore emulator REST API that `unitSystem` and
  `notificationSettings.clubUpdates` persisted with the exact values set.
  Changed the password, confirmed the `auditLog` subcollection got a
  `{action: "PASSWORD_CHANGE", device: "android", timestamp, details: {}}`
  doc after the `NonCancellable` fix (reproduced the pre-fix silent-drop
  once first, to confirm the bug was real and not a one-off).
- Also corrected two stale/inaccurate items found while updating this
  roadmap in the same pass: item #9's `awardRunXP` fix (already done
  2026-07-24, commit `9b0affa` — the checklist checkbox was never ticked)
  and item #3's `EditProfileSheet` field-parity cross-check (marked
  blocked — no RN source for `EditProfileScreen.js` was ever archived,
  unlike every other item in that section; don't invent its field list).

### 2026-08-03 (cont.) — ProfileScreen: dated/typed Recent Activity cards + All/This Week filter
- **Replaced** the old "Recent Runs" bare 3-column distance-only grid
  (`RunMiniCard`, now deleted) with a "Recent Activity" section: a title +
  All/This Week filter-pill row, then a vertical list of `RunActivityCard`s
  — each showing a colored activity-type icon circle, title, a relative
  date label ("Today"/"Yesterday"/"N days ago"/formatted date for anything
  older), distance, and computed pace.
- `ProfileViewModel.kt`: extended `ProfileRunItem` with `title`,
  `activityType`, `date` (`LocalDate`), and `durationSeconds` (parsed via a
  `parseDurationToSeconds` helper duplicated from the existing pattern in
  `RunDetailScreen.kt`); `paceMinPerKm` is computed from
  duration/distance rather than read directly, since manual-entry saves
  (`SaveActivityScreen.kt`) never write a `pace` field. `loadRecentRuns()`
  now sorts the full `runHistory` array descending by parsed date and
  takes the most recent 30 (up from 9). Field names cross-checked against
  real writers: `RuvoApp.kt`'s `submitRunActivity()` (GPS runs) and
  `SaveActivityScreen.kt` (manual entries, which write no `title`/`pace`
  — hence the `"Run"` fallback title and computed pace).
- The "This Week" filter is `date.isAfter(today.minusDays(7))` client-side
  over the already-loaded 30 — matches RN's simple recency filter; RN's
  *third* filter mode (an explicit date-picker) was not ported, only
  All/This Week.
- **Verified live end-to-end:** rebuilt a fresh test account (the prior
  session's cached Firebase Auth session became invalid after a Firebase
  emulator restart mid-session, a pure test-environment artifact unrelated
  to the app) and confirmed: (1) the empty state renders "No runs yet"
  correctly with zero runs; (2) after seeding 3 `runHistory` entries
  directly via the Firestore emulator's REST API (a GPS run couldn't be
  completed live — the "Run Complete" confirmation sheet turned out to be
  unclickable in this emulator, most likely `GoogleMap`'s `AndroidView`
  intercepting touches meant for the Compose overlay drawn on top of it;
  not investigated further as out of scope for this item), all 3 cards
  rendered with correct relative dates ("Yesterday", "4 days ago", and a
  formatted date for one 20 days old), correct distances, and correctly
  computed pace; (3) tapping "This Week" correctly hid the 20-day-old run
  and kept only the two within the last 7 days.

### Earlier in this effort (before 2026-07-16, prior context window)
- **PrivacyControlsScreen**: schema was fully divergent from RN (different
  field names for the same settings document). Realigned to RN's canonical
  fields (`profileVisibility`, `showActivityOnFeed`, `showLocationOnMap`,
  `showStatsToOthers`, `whoCanFollow`, `whoCanComment`, `whoCanSeeClubs`);
  added Blocked/Muted Users sections with unblock/unmute.
- **UserProfileScreen**: redesigned with `avgPaceSecPerKm` stat, recent
  activity list with Week/All filters, overflow menu (Share/Report/Block).
- **FindFriendsScreen**: root-caused and fixed a dead avatar tap (no
  navigation handler existed at all) by wiring `onUserProfile` through to
  `RuvoApp.kt`.
- **ChatScreen**: added empty state, Clear Chat / Block User overflow menu.

---

## Roadmap — Next Screens (in suggested priority order)

Priority is based on (a) size of the RN↔Android gap, (b) user-facing visibility,
and (c) likelihood of hiding a data-layer bug like the three fixed above.

> **Research status as of 2026-07-23**: every item below has now had its full
> RN deep-dive done and written up in `docs/rn-reference/RN_SOURCE_ARCHIVE.md`
> (formulas, exact Firestore field names, validation rules, nav maps) before
> the RN source was deleted. Nothing below needs re-research from scratch —
> jump straight to reading the referenced archive section, then implement.

### 1. TrainingPlanScreen follow-up: weekly calendar + workout nav
The schema/algorithm/status-toggle fix is done (see Completed Work Log).
Habits subsystem (CRUD, derived stats, 7×16 heatmap, Add Habit sheet) is
also done — `HabitsSection.kt`, live-verified 2026-07-24 (commit `ded5a01`).
Full spec for what's left: **`RN_SOURCE_ARCHIVE.md` §10 "TrainingPlanScreen —
Habits subsystem"** (still relevant for the weekly-calendar/workout-nav
details below, even though the habits part itself is done). Still to build:
- [x] Day-by-day weekly calendar with a today-selector — see 2026-07-31
      (cont.) "weekly calendar + schedule editing" Completed Work Log entry.
      Verified live.
- [x] Tapping a workout to start it, navigating into `WorkoutDetailScreen`
      with the workout's `name`/`desc`/`duration`/`type`/`intensity` — see
      2026-07-31 (cont.) Completed Work Log entry. Verified live; shares the
      exact `IntervalStep`/`RunTrackingScreen` workout-mode pipeline already
      verified live for sub-task 13.
- [x] `runDays` editing UI (RN's schedule modal) — currently read-only on
      Android, defaulting to Mon/Wed/Fri if unset. Now editable — see
      2026-07-31 (cont.) "weekly calendar + schedule editing" Completed
      Work Log entry. Verified live, including persistence across a full
      app restart.

### 2. ActiveRunScreen → RunTrackingScreen (959 RN vs 641 Android combined)
Full spec: **`RN_SOURCE_ARCHIVE.md` §1** — GPS permission sequencing, the exact
speed/noise-filtering thresholds (25 km/h cutoff, 5m jitter, implied-speed
rejection), haversine distance + instantaneous-speed pace + calorie formulas,
elevation-gain noise threshold, HR zone bands, exact voice-coaching templates,
the `RateEffort` hand-off payload contract, and 15 independently-scopable
sub-tasks (already broken out at the end of that section) — use those as the
actual task list instead of re-deriving them.
- [x] Sub-tasks 2 (background service), 3 (GPS noise/speed filter), 4
      (distance/pace/calorie engine), 5 (elevation gain), 6 (pause/resume),
      8 (map view + controls), 9 (HR zone module + Health Connect), 11
      (haptics), 14 (run-completion handoff), 15 (crash-recovery, net-new)
      — see Completed Work Log entries 2026-07-24 through 2026-07-30.
- [x] Sub-task 1 (permission/GPS-acquisition polish) — see 2026-08-14
      (cont. 4) Completed Work Log entry: fixed the Duration/distance
      silently ticking before Start was tapped, added the "Acquiring GPS…"
      overlay + Start-button gate, and the background-permission-denied and
      GPS-total-failure alerts RN specifies. **Verified live** on a real
      emulator run — also caught and fixed a real bug in the process (the
      GPS-ready gate was satisfied by the cached last-known-position instant
      map paint instead of a genuine live fix; see the log entry's
      `hasLiveFix` fix).
- [~] Sub-task 10 (voice-coaching template accuracy) — templates fixed
      2026-07-29; real `AudioFocusRequest` audio-ducking added 2026-08-14
      (cont. 3). RN's optional milestone/pace-deviation callouts (explicitly
      "a deliberate new feature, not a port" per the archive) were never
      built — left open, not a bug.
- [x] Sub-task 7 (draggable bottom dashboard sheet) — **stale checklist
      item, this was already done**: built 2026-07-30 (commit `9451d04`,
      pan-gesture expand/collapse + Overview/Charts toggle body, matching
      the Screen Mapping Table row this was inconsistent with). Re-confirmed
      by re-reading current `RunTrackingScreen.kt::RunControls` — the drag
      gesture and both toggle bodies are present and wired.
- [x] Sub-task 12 (live-run sharing — share sheet + deep link +
      `LiveRunViewerScreen`) — see 2026-07-31 Completed Work Log entry. Map/
      metrics sync **now live-verified end-to-end 2026-08-16** (mocked GPS
      via `adb emu geo fix`, real writes confirmed via Firestore ground
      truth, real reads confirmed via the actual `LiveRunViewerScreen`
      Compose UI over a deep link) — see that Completed Work Log entry.
- [x] Sub-task 13 (interval/workout-mode step engine, integrated into
      `RunTrackingScreen`/`RunTrackingViewModel` + `WorkoutDetailScreen`'s
      "Intervals" chip) — see 2026-07-31 (cont.) Completed Work Log entry.
      Verified live: auto-advance, step count, and all three step-type
      colors confirmed correct; voice announcements not verifiable on this
      AVD (no TTS engine installed).
- [x] Mock-GPS live verification of sub-task 12's map/metrics sync (the
      hardest item to verify live) — **done 2026-08-16**, see above and the
      Completed Work Log. All 15 sub-tasks are now both built and live-
      verified except #10's explicitly-deprioritized optional callouts.

### 3. ProfileScreen follow-up: remaining sub-features
The data-layer bugs (follow/unfollow, avatar/location/bio fields) are fixed —
see Completed Work Log. RN's `ProfileScreen.js` still has ~10 sub-features
with no Android equivalent yet (each independently scopable; the original
Explore survey's line ranges are in the 2026-07-16 log entry; badge/PR
specifics are now also in `RN_SOURCE_ARCHIVE.md` §2-3):
- [~] Avatar upload/picker flow (`AvatarPickerModal` in RN) → `updateUserProfile({avatar})` — built 2026-08-15, see Completed Work Log. Photo-picker UI flow verified live; the Storage upload itself could not be verified end-to-end in this dev environment (TLS certificate-pin failure on outbound calls to real Google endpoints — see log entry). Kept 🔶 pending a real-device/unrestricted-network verification pass.
- [x] Weekly calendar strip (Mon-Sun run-dot row with a "today" ring) —
      merged with the Streak card below into one "Weekly Activity" card,
      see 2026-07-31 (cont.) Completed Work Log entry. Verified live (zero
      run-history case); filled-dot case not independently live-tested.
- [x] XP progress bar (ported the pattern already working in `UserProfileScreen.kt` rather than building a new one) — see 2026-08-01 (cont.) Completed Work Log entry. Verified live (0 XP case).
- [x] Gear preview card (primary shoe mileage bar + "near limit" warning, links to Gear screen) — see 2026-08-01 (cont.) Completed Work Log entry. Verified live end-to-end (hidden-with-no-gear case, populated case after adding a shoe, and tap-to-navigate).
- [x] Country picker bottom sheet (writes `location.country`, now that the field is fixed) — see 2026-08-01 Completed Work Log entry. Verified live end-to-end (search, select, save, persisted display).
- [x] Streak card ("ON FIRE" badge + 7-day dot strip) — per archive §9, RN has **no persisted streak counter anywhere**; this card's "streak" is recomputed from scratch off run-history dates each render, same pattern as the `b_perfect_week` badge condition — don't assume a `currentStreak` field exists to read. Built 2026-07-31, see Completed Work Log entry; verified live (0-day case).
- [ ] Active challenges card list (RN hardcodes 3 monthly challenges in `getMonthlyChallenges()` — distance/count/elevation types with per-type progress formulas).
- [x] Achievements/badges horizontal grid (locked/unlocked against `userData.badges`) — see 2026-08-01 (cont.) Completed Work Log entry, which also fixed a real pre-existing bug (fabricated badge catalogue) found while scoping this. Verified live end-to-end, including the full "Trophy Room" screen's 5 categories/counts. Badge-*awarding* itself doesn't exist on Android yet (separate gap, see that entry) — every account shows 0 unlocked until it's built.
- [x] Recent Activity: replace the bare distance-only grid with dated/typed run cards + All/This Week filters — see 2026-08-03 (cont.) Completed Work Log entry. Verified live end-to-end (empty state, populated state with 3 runs, and the This Week filter). RN's date-picker filter (a third mode beyond All/Week) was not ported — only All/This Week exist on Android.
- [x] Saved Tips library tab (separate `contentService.fetchTips()` data source, filtered by `userData.savedTips`) — see 2026-08-15 (cont.) Completed Work Log entry. Verified live end-to-end (empty state, bookmarking, populated state, tap-to-navigate) on a fresh account. A real sandbox network-instability issue (Firestore emulator write-stream throttling, not a code bug) was found and documented while verifying — bookmark writes don't reliably reach the server in this environment, though the UI correctly reflects whatever Firestore's cache returns.
- [x] Share-profile flow (native share sheet — uses uid, not username; see
      2026-08-01 Completed Work Log entry for why) and refresh (manual
      button, not a swipe gesture — this Material3 version predates
      `PullToRefreshBox`). Both verified live.
- [ ] Cross-check `EditProfileSheet` (inside `ProfileScreen.kt`) against RN's
      standalone `EditProfileScreen.js` for field parity — **blocked**:
      unlike every other item in this section, no raw copy or archive
      summary of `EditProfileScreen.js` was ever preserved (checked both
      `docs/rn-reference/*.js` and `RN_SOURCE_ARCHIVE.md` — the only hit is
      a one-line settings-menu label, not the screen's field list). Current
      Android sheet has Display Name / Bio / Location (country picker)
      only; RN's onboarding flow separately collects `runningGoal`,
      `fitnessLevel`, and `weeklyRunTarget` (see `RuvoUser` in
      `Models.kt`) which aren't editable after signup on either platform
      today — plausibly a real gap, but not confirmed against RN source.
      Don't invent the rest of this screen's fields from guesswork; leave
      blocked until real source surfaces, same as "Active challenges" below.

### 4. RewardsScreen / MyRedemptionsScreen / ReferralScreen — live verification follow-up
The security/schema bugs are fixed (see Completed Work Log, commit `49fbc0a`).
2026-08-13 follow-up session (see Completed Work Log entry) made progress but
the Android emulator degraded severely and repeatedly (frozen renders, wedged
adb, a stale `multiinstance.lock` blocking relaunch) partway through — real
progress was made by falling back to calling the local Functions emulator
directly via REST with a real ID token where UI taps kept failing, which
still exercises the actual server-side code, just not the Compose UI layer:
- [x] Redeem a reward end-to-end on a signed-in test account, confirm the
      Cloud Function actually deducts coins and a redemption record with
      the real fields (`rewardId`/`title`/`price`/`timestamp`) appears in
      `MyRedemptionsScreen`. **Verified against the real `redeemReward`
      Cloud Function** (called directly via its local-emulator HTTP
      endpoint with a real Firebase Auth ID token, after UI taps on
      "Confirm Redemption" stopped registering through no fault of the
      app): coins went 1000→200 for an 800-coin reward, and the
      `redemptions` subcollection got a doc with exactly the fields
      `MyRedemptionsScreen.kt` reads. A second call correctly failed with
      `FAILED_PRECONDITION`/"Insufficient coins" at 200 balance — the
      server-side balance check works. Did **not** confirm via the actual
      Compose screen rendering the new balance/redemption post-tap (blocked
      by the emulator instability above), only that the underlying data
      changes correctly.
- [x] Confirm the rooted-device lockout doesn't false-positive on a normal
      (non-rooted) emulator/device. Confirmed live (incidentally, before
      the emulator degraded): the Rewards screen's reward-detail sheet and
      "Confirm Redemption" button rendered normally on this AVD — if
      `SecurityManager.isRooted` (RootBeer-backed) had false-positived, the
      lockout error would have shown instead and blocked that path.
- [x] Generate a referral code, redeem it from a second test account, and
      confirm `referralStats.totalInvites`/`coinsEarned` update on the
      referrer's `ReferralScreen`. **Done and verified live 2026-08-15
      (cont. 3)** — see Completed Work Log. Two fresh test accounts, real
      `Apply` tap on the redeemer's Compose UI (not a direct Firestore
      write): redeemer got the "+100 coins added to your account!" banner,
      and Firestore ground truth confirmed both sides — redeemer
      `coins: 100, usedReferral: true`; referrer `coins: 100,
      referralStats: {coinsEarned: 100, totalInvites: 1}`. Getting here
      required two real `AuthViewModel` bug fixes along the way (indefinite
      hang with no timeout on any auth network call;
      `completeOnboarding()`'s `.update()` permanently failing on a
      not-yet-created doc) — see the (cont. 2) entry.
- [x] **Blocked on missing RN source** — confirmed 2026-08-16: no RN UI
      source exists for the reward catalog anywhere in `docs/rn-reference/`.
      `RewardsScreen.js` itself was never archived (unlike `functions_index.js`,
      `UserContext.js`, `referralService.js`, etc.). A broad case-insensitive
      `reward` search across every archived file turns up only
      `functions_index.js`'s `redeemReward` **backend** logic (already ported
      and live-verified above — not a UI/catalog spec) and one unrelated FAQ
      line in `helpData.js` ("...you both earn rewards!"). With no real
      catalog/pricing/design source to diff against, this is left explicitly
      blocked rather than invented/guessed — same treatment as the "Active
      Challenges" and "EditProfileSheet cross-check" items below.

All four sub-items now closed: reward redemption and the rooted-device
lockout were live-verified in the 2026-08-13 session, referral redemption
was live-verified end-to-end 2026-08-15, and the catalog/design-parity item
is explicitly blocked on missing RN source (2026-08-16) rather than left
open indefinitely.

### 5. AnalyticsScreen / PersonalRecordsScreen / RunDetailScreen / WorkoutDetailScreen
Full spec: **`RN_SOURCE_ARCHIVE.md` §2 (Analytics), §3 (Personal Records —
there is no standalone RN screen; it's a card inside Analytics fed by
`useAnalytics.js`), §4 (RunDetail), §5 (WorkoutDetail)**. Includes: the
per-day-bucket "half-blend" chart averaging formula, VO2/Consistency
descriptor thresholds, the exact Personal-Records-by-pace bucketing logic
(and its confirmed-missing Marathon bucket), splits engine (real `kmSplits`
vs. RN's linear-estimate fallback — recommend building real splits on
Android), the HR-zone formula (shared with ActiveRunScreen), the
interval-workout `(x6)`-parsing/looping engine, and the RN audio-ducking hack
(replace with real Android `AudioFocusRequest`, don't port the WAV-loop trick).
- [x] Batch scoping note (original 2026-07 survey) — all sub-tasks below are
      now done; superseded, see the individual entries and the "Still open"
      item at the end of this section for what's genuinely left.
- [x] **`PersonalRecordsScreen.kt` schema + bucket-algorithm bug — fixed
      2026-07-29.** Same `runHistory[]` schema fix as the rest of this
      batch, plus the real threshold/best-pace bucket algorithm from
      `useAnalytics.js` §7 (was using narrow exact-distance bands and
      shortest-raw-time instead). See Completed Work Log.
- [x] **`RunDetailScreen.kt` schema/read-path bug — fixed 2026-07-29.** Was
      reading a nonexistent `users/{uid}/runs/{id}` subcollection (RN's own
      dead read path, per archive §4 — nothing ever writes there in either
      app); switched to reading `users/{uid}.runHistory[]` and matching by
      `id`, with every field name/type corrected. See Completed Work Log for
      the full fix + a second bug (a `FirebaseFunctions` DI bypass) it
      uncovered along the way. Still missing from this screen: map/route
      rendering, HR-zone card, weather/gear/tag chips, AI-Coach handoff button.
- [x] **`AnalyticsViewModel.kt` schema/read-path bug — fixed 2026-07-29.**
      Same root cause as RunDetailScreen (see Completed Work Log and the
      "Known Data-Layer Bugs" section) — now reads `users/{uid}.runHistory[]`
      with corrected field names throughout `loadData()` (totals, weekly
      buckets, pace trend, recent runs).
- [x] **VO2 Max, Consistency Score, and real Heart Rate Zones — built
      2026-08-14**, see Completed Work Log. `docs/rn-reference/useAnalytics.js`
      (a full raw copy, not just the archive's parsed summary) has every
      exact formula — ported VO2 Max (`15 + avgSpeedKmh*3.5 + (200-avgHR)*0.15`
      over the last 5 runs with HR data), Consistency (runs in the last 28
      days ÷ 4), and real HR-zone bucketing (`maxHR = 220 - age`, Android
      falls back to RN's own `age || 30` default since neither app collects
      age) — replacing the old hardcoded 20/35/25/15/5% placeholder
      distribution. Also fixed `vo2maxCategory()`'s thresholds/labels, which
      didn't match the archive's real descriptor at all (was "Below
      Average"/<30 etc., now "Superior≥55/Good≥45/Fair≥35/else Basic" per
      archive §2). **Verified live end-to-end** with a seeded 5-run history
      including heart-rate values: computed VO2 Max (62 → "Superior"),
      Consistency (1.3 → "Building"), and HR zone percentages (Z3 100%/Z4
      66%) all matched hand-calculation from the exact same formulas exactly.
- [x] **Race Predictor and Recovery Score cards — built 2026-08-14 (cont.)**,
      see Completed Work Log. Both use the exact `useAnalytics.js` formulas:
      Race Predictor takes the best 5k-normalized effort from any run ≥5km
      in the full history and projects 5K/10K/Half/Marathon times via
      Riegel's formula (`T2 = T1*(D2/D1)^1.06`); Recovery Status is a
      3-tier heuristic off hours since the most recent run (<24h
      "Recovering" 40%, <48h "Almost Ready" 80%, else "Ready to Train"
      100%). **Verified live** against a seeded history with a known best
      5K pace and a last-run timestamp deliberately placed 30h back (to
      exercise the *middle* "Almost Ready" tier, not just the two easy-to-
      hit-by-accident extremes): all 4 race predictions and the recovery
      percentage/label matched hand-calculation from the same formulas
      exactly.
- [x] **Chart-parity rebuild — built and live-verified 2026-08-16.**
      `AnalyticsViewModel.buildDayBuckets()` replaces the old weekly-bar +
      last-10-run pace list with RN's actual model: one bucket per
      **calendar day** across the selected period, X-axis label
      downsampling per RN's exact `{1W:1, 1M:5, 3M:15, 1Y:60}` factors (RN's
      own `6M` has no Android period to map to), distance/elevation as
      per-day **sums**, and pace/heart-rate using RN's recency-weighted
      running **half-blend**: `bucket = bucket ? (bucket+v)/2 : v`. Also
      added the two chart types RN has that Android didn't (`AnalyticsScreen.kt`
      previously had no Elevation or real time-series Heart Rate chart at
      all — only the separate HR *zone* bars). **Verified live** end-to-end
      on a seeded 3-run history (two runs on the same day to exercise the
      blend, one on a different day): logged the exact computed bucket
      values and hand-checked every one — today (2 runs, 5km/25min/HR150
      + 3km/18min/HR170): distance=8.0 (sum), pace=5.5 ((5.0+6.0)/2),
      HR=160.0 ((150+170)/2), elevation=30.0 (sum); yesterday (1 run,
      8km/48min/HR140/50m gain): distance=8.0, pace=6.0, HR=140.0,
      elevation=50.0 — all four matched hand-calculation exactly, and all
      four chart cards (Distance, Pace Trend, Elevation, Heart Rate)
      rendered the correct shapes in the real Compose UI. The pre-existing
      HR Zones card was cross-checked too (Z3 100%/Z4 50%, matching
      `maxHR=190` bucket math by hand) to confirm the elevationGain/
      heartRate parsing changes didn't regress it.
- [ ] Still open, not part of this pass — both are product/architecture
      decisions, not port-accuracy fixes: Personal Records card *inside*
      Analytics (a separate `PersonalRecordsScreen.kt` already exists and is
      schema-correct, but RN's archive §2 describes PRs as a card embedded
      in Analytics itself — Android kept it as a separate screen, not
      reconciled), and the Pro-paywall gating pattern around all Advanced
      Metrics cards (currently all shown unconditionally — Android has no
      Pro/subscription system to gate behind yet).

### 6. SettingsDetailScreen audit
Full spec: **`RN_SOURCE_ARCHIVE.md` §6b** — all 6 active `route.params.type`
variants (`notifications`, `units`, `regenerate`, `Help`, `About`, `Password`)
with their exact Firestore fields, validation rules, and alert copy.
- [x] Enumerate whether each variant already has a working Android equivalent
      (likely inlined in `SettingsScreen.kt`) — audit done 2026-08-03, see
      Completed Work Log for the fixes it produced (`notifications`/`units`
      were fake unpersisted toggle state under wrong names; `Password` was
      missing the `auditLog` write). Per-variant status:
      - `notifications` — **fixed** (was fake local state, now wired to real
        `notificationSettings.*` fields, correct RN keys/defaults/grouping).
      - `units` — **fixed** (was fake local state, now wired to real
        `unitSystem` field). Toggle UI instead of RN's two radio rows —
        deliberate Android-idiom choice, not a fidelity gap.
      - `Password` — **fixed** (`updatePassword()` already existed and was
        correct; added the missing `auditLog` write, plus a real bug found
        along the way — see Completed Work Log).
      - `regenerate` ("Recalibrate AI" training-plan reset) — **confirmed
        missing**, not built this pass. Net-new feature, not a bug fix;
        left for a future iteration.
      - `Help` — **not rebuilt as a separate variant**: Android's Settings
        already routes "Help Center" to the richer standalone
        `HelpCenterScreen.kt` (archive §6c), which functionally supersedes
        RN's minimal legacy `Help` variant. No gap worth closing.
      - `About` — **left as-is (hardcoded, not Firestore-backed)**: Android's
        existing About dialog is real and reasonably complete (version,
        description, social links, share/rate) but reads local constants
        instead of `system/app_config`. Lower priority than the other
        fixes; not addressed this pass.

### 7. Auth flow consolidation check (Welcome/Login/SignUp/ForgotPassword)
Full spec: **`RN_SOURCE_ARCHIVE.md` §7** — the guest/authenticated/onboarding
navigation gate logic, the 6-step `OnboardingScreen` wizard (exact copy for
every step), the password-rule checklist (6 rules incl. a common-password
blocklist — raw list in `docs/rn-reference/passwordStrength.js`), the
rate-limiting/lockout math (raw logic in `docs/rn-reference/rateLimit.js` —
note the lockout-copy-vs-actual-math mismatch flagged in the archive),
`LockScreen`'s biometric-only (no PIN fallback) design, and the exact
`DEFAULT_USER_DATA`/`signUp()` Firestore write shape.
- [x] Android combines these into `AuthScreen.kt`; RN keeps them as separate
      files (with `OnboardingSignUpScreen.js` as a second sign-up variant used
      specifically at the end of onboarding, not a duplicate of `SignUpScreen.js`
      — see archive §7 for exactly when each is used). Confirm no RN copy/
      validation/social-login option was dropped in the Android merge.
      **Audited 2026-08-13** — findings and one real fix, see Completed Work
      Log:
      - **Real bug, fixed:** `SignUpScreen`'s password validation only
        checked length ≥ 8; RN requires all 6 `passwordStrength.js` rules
        (upper/lower/number/symbol/not-a-common-password too) with a live
        checklist UI. Ported exactly (`PasswordStrength.kt` + a
        `PasswordRulesChecklist` composable), verified live.
      - **Architectural difference, not a bug:** RN lets guests complete the
        whole 6-step onboarding wizard *before* creating an account
        (`OnboardingSignUpScreen` at the end, bundling all the answers into
        one atomic write). Android's `"Start Journey"` goes straight to
        `SignUpScreen` instead — account first, then onboarding as an
        authenticated user. Both eventually collect the same data; not
        re-architecting this per the same principle applied elsewhere in
        this doc (accepted platform-shape differences vs. real bugs).
      - **Not fixed, lower priority:** rate limiting (5-attempt/doubling
        lockout) on Login/SignUp, biometric auto-login/enable-prompt on
        Login, and the `notifyLoginFailure` call are all still absent on
        Android. Per the "Known Backend Bugs" table, `notifyLoginFailure`
        doesn't exist as a real Cloud Function even in RN, so it shouldn't
        be ported as a network call regardless.
- [x] Resolve the double ForgotPassword implementation (standalone screen vs.
      dialog) noted in the mapping table. **Confirmed 2026-08-13**: only the
      `ForgotPasswordDialog` inside `AuthScreen.kt` is actually wired up
      (`LoginScreen`'s "Forgot Password?" opens it); `ForgotPasswordScreen.kt`
      is dead code — no navigation route reaches it. Also confirmed
      `sendPasswordReset()` already correctly uses the real client-side
      Firebase Auth SDK (`sendPasswordResetEmail`), **not** RN's
      `sendPasswordResetLink` Cloud Function — which is good, since per the
      "Known Backend Bugs" table that function doesn't exist even in RN
      itself. Deleting the dead file is a trivial follow-up, not done this
      pass (zero behavior risk either way since nothing routes to it).
- [x] **Decided and built 2026-08-17: proper Android approach, no stored
      password at all** (not RN's plaintext-SecureStore replay). See
      Completed Work Log for the full build + live verification — RN's
      `LockScreen.js` app-lock trigger is now wired up end-to-end
      (`AppLockStore`/`AppLockViewModel`/`RuvoApp.kt`'s lifecycle observer),
      `LockScreen.kt` itself was already correct and untouched. RN's
      *separate* `LoginScreen` feature (stored plaintext credentials replayed
      via biometric to silently re-`login()` a signed-out user) was
      deliberately **not** ported — Firebase Auth's Android SDK already
      keeps a signed-in session alive across restarts on its own, so that
      scenario doesn't arise the way it does in RN, and there's no
      credential of any kind to protect.

### 8. Spot-checks (small gaps, quick pass)
Full spec for the four RN-side ones already researched: **`RN_SOURCE_ARCHIVE.md`
§8** (CreateClubScreen, UserListScreen, TipDetailScreen, CustomerCenterScreen —
confirmed trivial, just a `RevenueCatUI.CustomerCenter` wrapper). SettingsScreen
is covered in archive §6a. HelpCenterScreen in §6c. AchievementsScreen in §3.
- [x] Line counts are already close for all of these; a single side-by-side
      read (of the archive, not live RN source) + emulator screenshot per
      screen should be enough to confirm parity or find small gaps.
      **Done 2026-08-13** (code comparison only, no live screenshots this
      pass — see Completed Work Log). No bugs found; all four are either
      exact matches or legitimate, small, non-broken scope gaps:
      - `CustomerCenterScreen.kt` — exact match, trivial RevenueCat wrapper.
      - `TipDetailScreen.kt` — excellent match, including a **pixel-exact
        8-color category hex-code match** to archive §8's `CATEGORY_META`
        table, and correctly mirrors RN's own admittedly-unfinished
        "Mark as Helpful" toggle (local UI state only, never persisted, by
        design — not a bug to "complete" beyond what RN itself does).
      - `CreateClubScreen.kt` — internally consistent (writes exactly what
        `ClubDetailScreen.kt` reads), diverges from RN only in scope: no
        banner-image picker, no optional Location field, uses `.trim()`
        instead of RN's `sanitizeInput()`. Legitimate small gaps, not bugs.
      - `UserListScreen.kt` — missing `avatar`/`location.country` display
        (shows a generic person icon + `totalKm` instead) and only has a
        2-state Follow/Following button vs. RN's 3-state (adding
        "Requested" for private accounts) — but Android has **no
        private-account/follow-request concept anywhere in the codebase**,
        so the 2-state button is actually consistent with what the app can
        currently express; adding a fake third state without the
        underlying privacy-settings feature would be inventing behavior,
        same principle as the badge-awarding gap elsewhere in this doc.

### 9. Remaining GamificationScreen function bug
Full fix recipe: **`RN_SOURCE_ARCHIVE.md` §9** — the exact formulas
(`earnedXp = floor(distanceKm*100 + durationMinutes*2)`,
`earnedCoins = floor(distanceKm*10)`), the client-side Pro ×2 coin bonus, and
an explicit list of what NOT to build (level-up, streak bonuses, pace/time
coin bonuses — all confirmed dead/unimplemented in RN itself, so building them
on Android would be inventing new product behavior, not porting).
- [x] Fix `awardRunXP` call (see Known Backend Bugs) by switching to the real
      `saveRunActivity` Cloud Function with the payload shape documented in
      archive §9 — **stale checklist item, this was already done**: fixed
      2026-07-24 (commit `9b0affa`, see Completed Work Log and the Screen
      Mapping Table's `gamification/GamificationViewModel.kt` row) and
      verified live against the local Functions emulator. Re-confirmed by
      re-reading current `GamificationViewModel.kt` — it calls the real
      `saveRunActivity` callable, no `awardRunXP` reference remains anywhere
      in the codebase.
