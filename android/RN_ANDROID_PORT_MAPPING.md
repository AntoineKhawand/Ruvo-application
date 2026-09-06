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
| `runtracking/*` (if it calls `startLiveRun`/`endLiveRun` for live-run tokens) | — | **No** — RN itself calls these and they don't exist | **Resolved** — commit `9d40013` replaced this with a genuinely-working client-only live-run share (`LiveRunViewerScreen.kt`, deep link `live_run/{runId}` wired in `RuvoApp.kt`) that reads the real `runs/{runId}/liveLocation/current` doc `RunTrackingService` already writes, instead of calling the nonexistent functions. |
| Auth screens, if they call `sendPasswordResetLink`/`notifyLoginFailure` | — | **No** — RN itself calls these | **Confirmed N/A** 2026-08-26 — grep-confirmed zero call sites anywhere in `android/app/src/main/java`; `AuthViewModel.sendPasswordReset()` uses the real Firebase Auth SDK directly (see ForgotPasswordScreen.js row above). |
| AI workout suggestion (`fetchAIWorkoutSuggestion` equivalent, if any) | `generateWorkoutSuggestion` | **No** — RN itself calls this | **Confirmed N/A** 2026-08-26 — grep-confirmed zero call sites. |
| Oura/Whoop sync (if Android calls a sync function directly instead of the SDKs) | `syncOuraData`/`syncWhoopData` | **No** — RN itself calls these | **Confirmed N/A** 2026-08-26 — grep-confirmed zero call sites; the real `healthintegrations/*` feature (`HealthIntegrationsViewModel.kt`, `OAuthCallbackActivity.kt`) never calls these functions. |

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
  field) but this separate per-shoe-stats query was missed until now. Not
  live-verified (needs a shoe + a logged run tagged to it) but same proven
  pattern. **Resolved 2026-08-25**: GPS-tracked runs previously couldn't
  attach gear at all (only `SaveActivityScreen`'s manual "Log Activity"
  flow could) — `RateEffortScreen.kt` now has a real gear picker feeding
  into `RuvoApp.kt::submitRunActivity`, live-verified — see that file's
  Completed Work Log entry.
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

**Resolved 2026-08-25:** `features/community/CommunityViewModel.kt` — the
product decision flagged below (2026-07-29) was made and built: redesigned
the feed as posts derived from `runHistory` entries rather than the
nonexistent `users/{uid}/runs` subcollection. See Completed Work Log for
the full design + live verification. Original investigation notes, for
context:
- **investigated 2026-07-29 — needs a product decision, not a schema fix.**
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
| GearScreen.js | 702 | `features/gear/ShoeTrackerScreen.kt` | 563 | ✅ | Was reading `users/{uid}/shoes` subcollection (doesn't exist); real data is `gearList` array field on user doc. Rewrote + ported design + wired `SaveActivityScreen` gear picker. Commit `d39f3d7`. **2026-08-25: GPS-tracked runs can now attach gear too** (previously only the manual "Log Activity" flow could — see `RateEffortScreen.kt`'s Completed Work Log entry), so `ShoeTrackerScreen`'s per-shoe stats query now has real data to show for GPS runs as well, not just manually-logged ones. |
| AICoachScreen.js | 783 | `features/aicoach/AICoachScreen.kt` + `AICoachViewModel.kt` | 406 + 192 | ✅ | Called nonexistent Cloud Function `aiCoach` (real one is `askGemini`) — every message failed. Fixed call, added Firestore persistence, markdown rendering, Pro-gating, quick actions grid. Commit `6574e30`. |
| UserProfileScreen.js | 747 | `features/community/UserProfileScreen.kt` | 599 | ✅ | Redesigned: stat cards, recent activity w/ filters, block/report/share overflow menu. (Earlier session.) Follow/unfollow + follower/following count schema fixed 2026-07-16 (commit `7d36f08`). |
| FindFriendsScreen.js | 317 | `features/community/FindFriendsScreen.kt` + `FindFriendsViewModel.kt` | 189 + 135 | ✅ | Avatar tap was dead (no nav). Wired `onUserProfile`. (Earlier session.) |
| ChatScreen.js | 398 | `features/community/ChatScreen.kt` | 330 | ✅ | Added empty state, Clear Chat / Block User menu. (Earlier session.) |
| PrivacyControlsScreen.js | 345 | `features/settings/PrivacyControlsScreen.kt` | 419 | ✅ | Schema was fully divergent from RN; realigned field names, added Blocked/Muted sections. (Earlier session.) |
| PaywallScreen.js | 629 | `features/paywall/PaywallScreen.kt` + `PaywallViewModel.kt` | 299 + 146 | ✅ | Ported hero/feature-grid/pricing-card design; unified mock-offerings fallback into the real package model. Commit `a8e74c4`. |
| ActiveRunScreen.js | 959 | `features/runtracking/RunTrackingScreen.kt` + `RunTrackingViewModel.kt` + `RunTrackingService.kt` | ~880+395+368 | ✅ | Worked through as the 15 independently-scopable sub-tasks in archive §1. Done: #2 background service, #3 GPS noise/speed filter, #4 distance/pace/calorie engine, #5 elevation gain, #6 pause/resume (`f4f5343`), #8 map style/follow/recenter (`1592bd0`), #9 HR zone module + Health Connect polling (2026-07-29, see Completed Work Log — live BPM population not verified, see log entry), #11 haptics (`e2838eb`), #14 run-completion handoff (`9b0affa`), #15 crash-recovery (`6d23d20`). #12 live-run sharing (share sheet + deep link, 2026-07-31, see Completed Work Log), #13 interval/workout-mode step engine (2026-07-31, verified live — see Completed Work Log), #7 draggable bottom sheet (2026-07-30, commit `9451d04`), #1 permission/GPS-acquisition polish (2026-07-30 partial via commit `879c456` + completed and live-verified 2026-08-14, see Completed Work Log). #12's map/metrics sync live-verified 2026-08-16 via mocked GPS (see Completed Work Log). **#10's last piece — RN's optional pace-deviation callouts — built and live-verified 2026-09-04** (see Completed Work Log): `VoiceCoach.onPaceCheck()`, confirmed via a real GPS-simulated interval workout. All 15 sub-tasks now fully built and live-verified — none left open. |
| PlanScreen.js | 1263 | `features/training/TrainingPlanScreen.kt` + `HabitsSection.kt` | 432 + 483 | 🟢 | Fixed schema + ported the real plan algorithm and status toggles (commit `d5ccfef`). Habits subsystem (CRUD, derived stats, 7×16 heatmap, Add Habit sheet) ported and live-verified 2026-07-24 (commit `ded5a01`) — exact match to archive §10. Day-by-day weekly calendar, tap-workout-to-start navigation, and `runDays` editing UI all built and live-verified 2026-07-31 (see Completed Work Log), including a fresh-app-restart persistence check on the `runDays` write. |
| ProfileScreen.js | 1703 | `features/profile/ProfileScreen.kt` + `ProfileViewModel.kt` + `Countries.kt` | 393 + 138 | ✅ | Fixed follow/unfollow (systemic, 3 files) + avatar/location/bio field bugs (commit `7d36f08`). Weekly calendar strip + streak card (2026-07-31), country picker + share-profile flow + refresh + XP progress bar + gear preview card + achievements preview (2026-08-01), dated/typed Recent Activity cards + All/This Week filter (2026-08-03) all built and live-verified — see Completed Work Log. Avatar upload/display built 2026-08-15; **Storage upload live-verified end-to-end 2026-09-06** (the earlier TLS-pin blocker didn't reproduce this session — see Completed Work Log), closing the last open item on this row. Saved Tips library tab built 2026-08-15 (cont.), live-verified end-to-end on a fresh account (see Completed Work Log). Active Challenges card (original Android content, no RN source survives) and EditProfileSheet's Running Goal/Fitness Level/Weekly Run Days fields both built and live-verified 2026-08-17 — see Completed Work Log. |
| SaveActivityScreen.js | 1180 | `features/runtracking/SaveActivityScreen.kt` | 309 | 🟡 | Gear picker added earlier session. Real bug fixed 2026-08-25: manually-logged runs never got an `id` field (unlike GPS-tracked runs), breaking `RunDetailScreen`'s lookup and any list keyed by run id. **Live-verified end-to-end 2026-08-27** (see Completed Work Log) — the id-fix was previously unverified due to Functions-emulator flakiness; confirmed via Firestore REST that a manually-logged run now gets a real UUID `id`. Kept 🟡: layout/copy parity vs RN not otherwise fully compared. |
| RunDetailScreen.js | 730 | `features/runtracking/RunDetailScreen.kt` | 484 | 🟡 | Read-path/schema bug fixed 2026-07-29. **Built 2026-08-25** (archive §4's "still missing" list): route map (static polyline + start/finish markers), Heart Rate Zone card (5-segment bar, same formula as AnalyticsViewModel's HR Zones), tags chips (RateEffortScreen's real context tags), and the "Continue with AI Coach" hand-off button (real `navigate('AICoach', {initialPrompt})`, exact archive template) — see Completed Work Log. All four live-verified. Kept 🟡: no weather/gear chips (never real data anywhere — see log entry for why these weren't stubbed in). |
| RewardsScreen.js | 692 | `features/rewards/RewardsScreen.kt` | 440 | ✅ | Fixed insecure client-side redemption → real Cloud Function call (commit `49fbc0a`). Redemption live-verified against the real `redeemReward` function 2026-08-13 (see Completed Work Log). Catalog/design parity check confirmed unwinnable (no RN UI source survives, 2026-08-16) — but re-checked 2026-08-17 and there's nothing to build regardless: the real 8-item catalog (commit `86ab459`) already exists, already modeled on RN's grid/gradient design, confirmed still rendering and redeeming correctly live. |
| ReferralScreen.js | 561 | `features/referral/ReferralScreen.kt` | 576 | 🟡 | Fixed `referralStats` nested-field schema mismatch (commit `49fbc0a`). Redemption live-verified end-to-end 2026-08-15 (cont. 3) — real code-generation, real Apply tap, both sides' coins/stats confirmed via Firestore ground truth (see Completed Work Log). Kept 🟡: design/catalog parity vs. RN not otherwise re-compared. |
| SettingsDetailScreen.js | 457 | *(inlined into)* `features/settings/SettingsScreen.kt` + `SettingsViewModel.kt` | 407 + 185 | ✅ | Audited 2026-08-03 — see Completed Work Log + Roadmap item #6. `notifications`/`units`/`Password` fixed (real persistence bugs). `regenerate` (Recalibrate AI) and Firestore-backed `About` built + live-verified 2026-08-24 — all 6 variants now closed; `Help` judged adequate as-is (routes to the richer standalone `HelpCenterScreen.kt` instead). |
| EditProfileScreen.js | 425 | `EditProfileSheet` inside `features/profile/ProfileScreen.kt` | — | 🟡 | RN: standalone screen. Android: bottom sheet inside ProfileScreen. Architecture differs by design, not a bug. **Audited 2026-08-27**: no RN source for `EditProfileScreen.js` was ever archived, so exact field-list parity can never be confirmed either way — but traced every field this sheet reads/writes (`name`/`displayName`, `bio`, `location.country`, `runningGoal`/`fitnessLevel`/`weeklyRunDays`) against every other reader/writer in the app (`AuthViewModel.completeOnboarding`, `UserProfileScreen`, `LeaderboardViewModel`'s `countryFlag`, `SearchViewModel`) and found them fully self-consistent — same field names, same enum `.name()` convention, country picker writes exactly the strings `countryFlag()` matches on. No real bug found. Kept 🟡 only because layout/copy parity itself is unverifiable without RN source. |
| AnalyticsScreen.js | 445 | `features/analytics/AnalyticsScreen.kt` + `AnalyticsViewModel.kt` + `PersonalRecordsScreen.kt` | 282+157+196 | ✅ | Read-path bug fixed 2026-07-29; VO2 Max/Consistency/HR-zones/Race Predictor/Recovery Score built+verified 2026-08-14; day-bucketed chart engine (exact per-day sum/half-blend formulas) + Elevation/Heart Rate charts built+verified 2026-08-16; Personal Records merged in as an embedded card (matching RN's real layout) + Pro-paywall gating on the whole Advanced Metrics section, both built+verified 2026-08-17 — see Completed Work Log. |
| ConnectedDevicesScreen.js | 397 | `features/healthintegrations/ConnectedDevicesScreen.kt` | 207 | 🟡 | Checked 2026-08-25: no schema bug — reads/writes its own self-consistent `connectedDevices` array field, nothing else references it. All toggles are UI-only mocks with no real wearable integration behind them (consistent with RN's own state: neither `functions_index.js` nor `UserContext.js` has a real device-sync path, matching the "Known Backend Bugs" table's `syncOuraData`/`syncWhoopData` entries). Layout/copy parity vs RN not compared. |
| WorkoutDetailScreen.js | 534 | `features/runtracking/WorkoutDetailScreen.kt` | 213 | 🟡 | Checked 2026-08-25: no Firestore access in this file at all (pure UI, params-driven) — no schema bug possible. Layout/copy parity vs RN not compared. |
| RateEffortScreen.js | 400 | `features/runtracking/RateEffortScreen.kt` | 204 | 🟡 | Checked 2026-08-25: confirmed the RPE/notes/tags this screen collects actually flow end-to-end into the saved run entry (`RuvoApp.kt::submitRunActivity`'s `rpe`/`notes`/`tags` fields) — not dead UI. Layout/copy parity vs RN's archived §1 hand-off contract not compared. |
| SearchScreen.js | 411 | `features/search/SearchScreen.kt` | 256 | 🟡 | **Reachability confirmed 2026-08-25**: both this ("Search Runners") and FindFriendsScreen ("Find Runners") are live, separate entries in `ProfileScreen.kt`'s overflow menu — not dead code, the earlier flag was inconclusive rather than wrong. Real bug fixed same day: `country` read a top-level field that's never written (real one is nested `location.country`), which also meant the **Nearby filter always returned zero results for every user** (`myCountry` was always `""`) — see Completed Work Log. Live-verified. Layout/copy parity vs RN still unconfirmed. |
| LeaderboardScreen.js | 289 | `features/leaderboard/LeaderboardScreen.kt` + `LeaderboardViewModel.kt` | 209 + 150 | 🟡 | Real bug fixed 2026-08-25: same wrong top-level `country` field (real one is `location.country`) — every entry showed the generic 🏃 flag instead of a real one. Live-verified. Layout/copy parity vs RN still unconfirmed. |
| MyRedemptionsScreen.js | 265 | `features/rewards/MyRedemptionsScreen.kt` | 125 | 🟡 | Fixed field-schema mismatch — was reading fields the backend never writes (commit `49fbc0a`). Confirmed the fields it reads match what `redeemReward` actually writes (2026-08-13). |
| AchievementsScreen.js | 266 | `features/achievements/AchievementsScreen.kt` + `AchievementsViewModel.kt` | 319 + 116 | ✅ | **Bug found and fixed 2026-08-01**: `ALL_BADGES` was a fully invented catalogue (wrong ids, extra badges, missing 4 real RN ones) — replaced with RN's exact 12 badges from `badges.js`, live-verified (see Completed Work Log). **checkNewBadges() built 2026-08-30, live-verified end-to-end same day** — the badge-*awarding* mechanism, previously entirely missing (every account showed all badges permanently locked), now wired into both real save paths. A fresh test account's very first manual-logged run correctly unlocked both `b_first_run` and `b_early_bird` in one save, confirmed via Firestore REST with all fields (id/name/description/icon/color/category/earnedAt) correct — see Completed Work Log. |
| HomeScreen.js | 891 | `features/home/HomeScreen.kt` + `HomeViewModel.kt` | 350 + 191 | 🟡 | No RN source survives for this screen (never archived) — full layout/copy parity can't be re-verified. Three real schema/dead-code bugs found and fixed 2026-08-24 (name/avatar read the wrong Firestore fields; Streak/Today XP read phantom fields that are never written) — see Completed Work Log. Kept 🟡: layout parity itself still unconfirmed. |
| CommunityScreen.js | 957 | `features/community/CommunityScreen.kt` + `CommunityViewModel.kt` | 516 + 448 | 🟡 | **Feed tab rebuilt 2026-08-25** (Android-original design, no RN source survives) — was permanently empty (dead `runs`-subcollection query), now a real Following+self feed off `runHistory` with working likes/comments, live-verified. Embedded Leaderboard tab: 3 wrong-field bugs fixed same day. **Clubs tab: 2 more wrong-field bugs fixed same day** (`emoji`→real `icon`-id lookup, `membersCount`→real `memberCount`) — every real club previously showed the generic 🏃 and "0 members" regardless of actual data; live-verified. Challenges tab investigated, found self-consistent, left alone (see "Known Data-Layer Bugs"). Kept 🟡: no RN reference survives for any tab's layout/copy. |
| CreateClubScreen.js | 198 | `features/community/CreateClubScreen.kt` | 184 | 🟡 | **Audited 2026-08-27**: club creation writes `icon`/`memberCount`/`members`/`weeklyKm`/`createdAt` — all real fields, matching `CommunityViewModel`'s Clubs-tab reader and the shared `ClubIcons.kt` emoji lookup fixed earlier this session. No bug found. Kept 🟡: layout/copy parity vs RN not compared. |
| UserListScreen.js | 166 | `features/community/UserListScreen.kt` | 171 | 🟡 | **Audited 2026-08-27**: reads real `totalKm` (matches the field `CommunityViewModel`'s leaderboard tab was fixed to use), follow/unfollow correctly uses the real `following` array field. No bug found. Kept 🟡: layout/copy parity vs RN not compared. |
| TipDetailScreen.js | 313 | `features/tips/TipDetailScreen.kt` | 313 | 🟡 | **Audited 2026-08-27** (beyond the original line-count spot-check): `ContentRepository.incrementTipView`/`toggleBookmark`/`fetchTips` all correctly self-healing and schema-consistent with `ProfileViewModel`'s `savedTips` reader. One note, not a bug: the "Mark as Helpful" button is local `remember` state only, resets on leaving the screen — grep-confirmed no `helpful`/`helpfulCount` field exists anywhere else in the app or Firestore schema to wire it into, so this isn't an incomplete port of a real RN feature, just cosmetic tap feedback with nothing real to persist to. Kept 🟡: layout/copy parity vs RN still unconfirmed (identical line count only). |
| SettingsScreen.js | 268 | `features/settings/SettingsScreen.kt` | 281 | ✅ | **Audited 2026-08-30** against archive §6a row-by-row: Recalibrate AI writes the exact real fields (`goal`/`savedGoal`/`isTransitionWeek`); "Personal Records" and "Refer & Earn" are reachable from Profile's menu instead of this screen's list (documented IA choice, see 2026-08-17 entry) rather than missing; "Manage Subscription" delegates to the real RevenueCat Customer Center widget instead of RN's manual Pro/Free branching — a legitimate native equivalent, not a gap. No new bugs found (the substantive fixes for this file already happened under the `SettingsDetailScreen.js` row below, since both RN files map to the same Android screen). |
| HelpCenterScreen.js | 176 | `features/settings/HelpCenterScreen.kt` | 158 | 🟡 | Real bugs fixed 2026-08-30 (see Completed Work Log): had 5 entirely invented FAQ categories instead of the real, verbatim-preserved RN content, and the wrong support-email domain. Not live-verified (emulator infra down this session). Kept 🟡: layout/copy-outside-the-FAQ-body parity vs RN not otherwise compared. |
| LoginScreen.js | 310 | `LoginScreen` composable inside `features/auth/AuthScreen.kt` | — | ✅ | Rate limiting built + live-verified 2026-08-27 (see Completed Work Log), which also surfaced and fixed a real, unrelated pre-existing bug: every failed sign-in/sign-up bounced the user back to the Welcome screen instead of showing the error. Biometric auto-login deliberately not ported (see the 2026-08-17 "Biometric app-lock" entry — a real Android-appropriate redesign was built instead, not a gap). `notifyLoginFailure` correctly not ported (function doesn't exist even in RN's own backend). |
| SignUpScreen.js + OnboardingSignUpScreen.js | 342 + 357 | `SignUpScreen` composable inside `features/auth/AuthScreen.kt` | — | ✅ | Password-checklist parity bug fixed 2026-08-13 (see Completed Work Log). Guest-onboards-before-account-exists vs. Android's account-first ordering is an accepted architectural difference, not a bug. Rate limiting (shared 'auth' namespace with Login, matching RN) built + live-verified 2026-08-27. RN's OnboardingSignUpScreen skips rate limiting entirely (archive flags this as an RN-side inconsistency); Android has no equivalent screen anyway per the account-first-ordering note above, so nothing to skip. |
| WelcomeScreen.js | 98 | `LandingScreen` composable inside `features/auth/AuthScreen.kt` | — | ✅ | Audited 2026-08-13 — pure navigation screen, matches. |
| ForgotPasswordScreen.js | 140 | `ForgotPasswordDialog` in `features/auth/AuthScreen.kt` | 157 | ✅ | Confirmed 2026-08-13 only `ForgotPasswordDialog` is actually wired up (from `LoginScreen`'s "Forgot Password?"); the dead standalone `ForgotPasswordScreen.kt` was deleted 2026-08-17 (grep-confirmed zero references). `sendPasswordReset()` correctly uses the real client SDK, not RN's nonexistent `sendPasswordResetLink` function. |
| OnboardingScreen.js | 887 | `features/auth/OnboardingScreen.kt` | 605 | ✅ | Archive §7: RN is a real 6-step wizard (Goal, Level, Bio+Units, Frequency, Schedule, Permissions+account). Android had only 4 steps, skipping Bio/Frequency entirely. **Steps 3-4 (Bio, Frequency) built 2026-08-25; step 6's real Location + Notifications permission requests also built same day** (real system dialogs, live-verified granting both) — see Completed Work Log for both. **Last gap closed 2026-09-04**: the Schedule step now collects real specific days (7-day chip selector) + a time instead of a bare day count, and granting notification permission schedules real `AlarmManager` weekly alarms (`RunReminderScheduler`) — live-verified end-to-end (`dumpsys alarm` showed the correct weekly `RTC_WAKEUP`, then jumping the clock to the trigger point fired a real notification with the correct title/body). See Completed Work Log 2026-09-04 through 2026-09-06 for this plus the reboot-persistence and Settings-editor follow-ups. |
| LockScreen.js | 352 | `features/auth/LockScreen.kt` | 188 | ✅ | Compared 2026-08-17: the screen itself already matched archive §7 closely (biometric prompt, graceful no-hardware auto-unlock, retry-on-failure). Fixed the real gap — nothing triggered it — by wiring RN's exact 30-min-background app-lock timer + a real persisted Settings toggle. Live-verified end-to-end (see Completed Work Log). Deliberately does not replicate RN's separate plaintext-credential biometric auto-login (no analog needed — Firebase Auth's Android SDK already persists the session). |
| CustomerCenterScreen.js | 19 | `features/paywall/CustomerCenterScreen.kt` | 19 | ✅ | **Confirmed 2026-08-30**: both are literally just `<RevenueCatUI.CustomerCenter />`/`CustomerCenter(...)` with no other logic — genuinely identical, not a spot-check guess. |
| — (Android-only, no RN source) | — | `features/runtracking/IntervalTrainingScreen.kt` | 433 | — | Android-exclusive feature; nothing to port from RN. |
| — (Android-only, no RN source) | — | `features/runtracking/RunSummaryScreen.kt` | 461 | — | Android-exclusive feature; nothing to port from RN. |

---

## Completed Work Log

### 2026-09-06 (cont. 5) — Route Discovery built and live-verified; AI Coach's function-calling request confirmed reaching Gemini (real blocker found: invalid local GEMINI_API_KEY, not networking)
Two follow-ups from the entry below.

**Route Discovery (competitor-analysis Tier 2 #8) built** —
`clusterRoutesByStartPoint()` in `CommunityViewModel.kt`, a new "Routes" tab
in `CommunityScreen.kt`. Same Following+self fetch pattern `loadFeed()`
already uses (see that function's own comment on why: `runHistory` is a
plain array per user, not a queryable subcollection, so a bounded fan-out
is what's actually buildable client-side — a true "near you, anyone" search
needs a Cloud Function this app doesn't have). Routes are grouped by a
cheap grid-cell + distance-bucket heuristic, not real polyline-similarity
matching — good enough to recognize a repeated loop from the same
trailhead. 8 new unit tests (`RouteDiscoveryTest.kt`) cover the clustering
logic (same-start-different-distance stays separate, sort order, dedup'd
contributor names, most-recent preview points). **Live-verified**: got a
real authenticated session working (see below), navigated to the Routes
tab, confirmed it renders the correct empty state
("No routes yet...") with no crash — the account has no run history yet,
so this confirms the read path and tab wiring, not a populated card.

**How a real session finally worked**: signed out, created a fresh account,
and this time — instead of stopping at the post-signup
"Connection timed out" (the write that kept failing) — let the app fall
into `AuthUiState.Onboarding` for a signed-in-but-no-profile-doc user (real
existing AuthViewModel behavior) and completed the onboarding wizard.
`completeOnboarding()`'s write uses `merge=true` specifically so it
self-heals a missing doc (see that function's own comment, written
2026-08-15 for exactly this scenario) — and this time it went through,
producing a real working session. The earlier Firestore-write flakiness
this same session documented is real (reproduced 5 times with the full
timeout waited out) but evidently not 100% consistent — this write
succeeded where 5 raw `createUserProfile()` attempts hadn't.

**AI Coach bridge (competitor-analysis Tier 1 #3) — real progress, different
blocker than assumed.** With the working session above, sent a message from
the Coach screen. Got "I'm having trouble connecting right now" in the UI,
but the local Functions emulator's own log (`firebase-emulators.log`) told
the real story:
```
functions: Beginning execution of "us-central1-askGemini"
Gemini API Error: { code: 400, message: 'API key not valid...', status: 'INVALID_ARGUMENT' }
```
The request reached the Functions emulator, reached the real Gemini API
over the network, and Gemini returned a normal, well-formed 400 for an
invalid key — not a parse error, not a timeout. That's real evidence this
session's `tools`/`functionDeclarations` request-body change is shaped
correctly enough for Gemini's endpoint to accept and process it. **The
actual blocker is this local dev environment's `GEMINI_API_KEY` secret
being invalid** (no `functions/.secret.local` file exists; whatever value
`firebase functions:secrets:access` resolved for `GEMINI_API_KEY@latest`
is rejected by Google) — unrelated to networking, unrelated to anything
built this session. Fixing the plan-adjustment function-calling path itself
still needs a valid key to actually exercise live (confirm a real
`rest_today`/`ease_this_week` functionCall comes back and the Firestore
write lands) — that's the one real follow-up left on this item.

### 2026-09-06 (cont. 4) — Five competitor-analysis Tier-1 features built; 4/5 live-tested, 1 blocked by local-emulator flakiness
Built all five Tier 1 "quick win" recommendations from the competitor-analysis
report (Strava/Nike Run Club/Garmin/Runna/WHOOP feature-gap review) in one
pass, each deliberately scoped to reuse existing infrastructure rather than
build a new subsystem:

1. **Real biometric Recovery Score** (`AnalyticsViewModel.kt`) — the
   Recovery Status card was a pure hours-since-last-run heuristic
   (`useAnalytics.js` port); now prefers a connected wearable's own score
   (WHOOP `whoop_recovery`/Oura `oura_readiness`, same Firestore doc
   `HealthIntegrationsViewModel` already reads) over a Health Connect
   resting-HR + sleep estimate, falling back to the original heuristic only
   when neither is available. `RecoveryStatus` gained a `source` field shown
   in the UI so it's visible when biometrics are actually driving the
   number. 8 new unit tests (`RecoveryStatusTest.kt`) cover the full
   preference order and both banding boundaries.
2. **Weather-aware Training Plan** (`TrainingPlanScreen.kt`) — the existing
   `WeatherService`/`WeatherWidget` only ever advised on Home for *today's*
   run; `TrainingPlanViewModel` now injects the same service and surfaces a
   caution banner directly on today's scheduled workout when conditions
   are poor (Runna shipped this exact feature in 2026).
3. **AI Coach → training-plan bridge** (`AICoachViewModel.kt`) — real Gemini
   function-calling (not a keyword heuristic): `askGemini`
   (`functions/index.js`) is a thin proxy that forwards whatever
   `requestBody` the client sends, so a `tools`/`functionDeclarations`
   payload works with zero Cloud Functions changes. Two safe, reversible
   actions — `rest_today` and `ease_this_week` — mutate
   `trainingPlan.weeks[0]` via the same read/replace-whole-field pattern
   `TrainingPlanViewModel.updateTrainingPlan()` already uses, so
   TrainingPlanScreen's live listener picks up the change with no changes
   on that end. A second Gemini round-trip (model's `functionCall` + a
   `functionResponse`) gets a natural-language confirmation instead of
   silently narrating a change that may not have applied. 7 new unit tests
   (`AICoachPlanAdjustmentTest.kt`) cover matching, idempotency (a repeat
   "ease" call is a no-op, not a double-discount), and the no-session-today
   case.
4. **Guided run narration** (`VoiceCoach.kt`/`RunTrackingViewModel.kt`) —
   scripted breathing/pacing/motivation lines at fixed elapsed-time
   milestones (60s, 5/10/15/20/30/45/60min) on free runs only (workout mode
   already has its own step-timeline narration), reusing the exact
   TTS/audio-focus pipeline every other voice cue already uses. 5 new unit
   tests (`nextGuidedRunLine` in `VoiceCoachTest.kt`) cover the no-repeat and
   catch-up-after-a-pause cases.
5. **Run photo attachment** (`RateEffortScreen.kt`/`RuvoApp.kt`/
   `CommunityScreen.kt`) — same system Photo Picker pattern as the avatar
   upload, captured alongside RPE/notes/tags on the post-run rating screen;
   uploads to `runs/$uid/$runId.jpg` before the run entry is built so the
   download URL goes straight into the same `saveRunActivity` map write, and
   renders in the Community feed card when present.

**Live-tested on-device (Medium_Phone_API_36.1 emulator), not just
code-reviewed:**
- **Guided narration (item 4): confirmed working, timing-exact.** Started a
  real GPS-simulated run (`adb emu geo fix`), and `dumpsys audio`'s focus-
  request history — the same indirect-verification technique this session
  used earlier for pace alerts — showed a new `requestAudioFocus()` at
  T+60s exactly (run started 14:14:29, milestone fired 14:15:29), held ~5s
  before `abandonAudioFocus()` (consistent with that milestone's longer
  sentence vs. the ~2s "Run started" cue). Confirms the tick-loop wiring
  and the pure `nextGuidedRunLine` selection both work end-to-end live, not
  just in the unit test.
- **Photo picker UI (item 5): confirmed working end-to-end up to the save
  call.** Pushed a sample image into the emulator's gallery, drove the real
  system Photo Picker from the new "Add a photo" row, confirmed the
  `AsyncImage` preview + remove-button overlay render correctly
  (`content-desc="Selected run photo"` visible in the UI tree), and that
  tapping Save & Continue proceeds to Run Complete without crashing.
- **Items 1 and 2: crash-free integration confirmed live**, not visually
  confirmed. `AnalyticsViewModel` (now injecting `HealthConnectManager`) and
  `TrainingPlanViewModel` (now injecting `WeatherService`) both load their
  screens correctly on-device with no exceptions in logcat. The Recovery
  Score card itself is Pro-gated behind `AnalyticsScreen`'s existing
  paywall banner and this test account isn't Pro-entitled; the weather
  banner needs both a real API key (not configured in this local debug
  build) and today being a scheduled workout day. Neither gap is caused by
  this session's changes.
- **Items 3 and 5's actual Firestore/Storage writes: not confirmed —
  root-caused, not just retried.** This build points at a local Firebase
  emulator suite (`BuildConfig.USE_FIREBASE_EMULATOR` →
  `10.0.2.2:8081/9199/9099/5001`) rather than production, and that suite
  wasn't running earlier in this session — starting it
  (`firebase emulators:start`) let plain Auth REST calls (sign-up, sign-in)
  succeed reliably, but every attempt to reach Firestore specifically from
  the app (the `createUserProfile()` write immediately after a real
  `createUserWithEmailAndPassword()` success) hit the full 15s
  `AUTH_NETWORK_TIMEOUT_MS` and surfaced the UI's real
  "Connection timed out" error — reproduced on 5 separate fresh accounts,
  confirmed with the full timeout window actually waited out (not an
  early-check false negative). Auth's plain REST calls over the same
  `10.0.2.2` route work every time; Firestore's gRPC/streaming connection
  over that same route does not — consistent with a known class of Android
  emulator NAT limitation with long-lived HTTP/2 connections, not
  something wrong with the app's `useEmulator(...)` setup (all four
  services are configured identically in `AppModule.kt`). This is
  host/emulator network infrastructure, not a defect in the AI-coach or
  photo-upload code — both were confirmed exception-free by compilation
  and, for the parts reachable without a persisted backend write, live UI
  behavior (the photo picker's full pick → preview → remove flow). Given
  how reproducible this turned out to be, re-verifying #3 and #5's actual
  Firestore/Storage persistence needs either a different AVD image/network
  config or a real device — not just retrying against this same emulator.

**New tests:** `RecoveryStatusTest.kt` (8), `AICoachPlanAdjustmentTest.kt`
(7), 5 added to `VoiceCoachTest.kt` — 20 new tests this entry, all passing
alongside the full existing suite.

### 2026-09-06 (cont. 3) — Avatar Storage upload live-verified end-to-end; the last open roadmap item closed
The one remaining gap anywhere in this roadmap: avatar upload's Storage
step was built 2026-08-15 but never verified end-to-end — a TLS
certificate-pin failure on outbound calls to real Google endpoints in that
session's dev environment blocked it, kept 🔶 pending a real-device/
unrestricted-network pass.

- **Retried live this session — it worked.** The earlier blocker didn't
  reproduce: generated a minimal test PNG, pushed it to the emulator's
  `DCIM` folder, triggered a media-scanner broadcast so the system Photo
  Picker could see it, then drove the real flow through
  `ProfileScreen.kt`'s camera-badge → `PickVisualMedia` → `uploadAvatar(uri)`.
  Confirmed via logcat that Firebase Storage's own internal calls proceeded
  (the "Pin verification failed" lines that did appear were App Check
  gracefully falling back to a placeholder token — Storage's documented
  behavior when App Check can't attest, not a hard failure) and the avatar
  circle updated to the real uploaded image.
- **Verified end-to-end, not just the upload call:** force-stopped and
  relaunched the app fresh — `ProfileViewModel.loadProfile()`'s real
  Firestore read pulled back the real `avatar` download URL this session's
  upload wrote, and Coil loaded it correctly. Confirms the full chain: real
  `Storage.putFile()` → real `downloadUrl` → real Firestore
  `update("avatar", ...)` → real fresh read → real image render.
- Screen Mapping Table's ProfileScreen.js row and Roadmap item #3's avatar
  bullet both updated from 🟡/🔶 to ✅/`[x]`. This was the only item left
  open anywhere in this document as of the entries above.
- Files: none (verification only, no code changes).

### 2026-09-06 (cont. 2) — Unit test infrastructure added (there was none): covers the logic this session's live-testing found bugs in
This codebase had zero test infrastructure — no JUnit dependency, no test
source set. Every real finding across the entries below (the auth race, the
fake reminders toggle, the reboot ANR, the reminder day/time math, the
pace-alert thresholds) took real emulator time to catch, each a manual,
non-repeating check.

- **Built:** `app/src/test/` (new), JUnit 4 wired into `app/build.gradle.kts`
  + `libs.versions.toml`. 29 tests across 4 files, extracting pure decision
  logic out of classes that previously needed a real Context/AlarmManager/
  TextToSpeech/DataStore to even construct:
  - `RunReminderScheduler`'s `nextTriggerMillis` → top-level, `now`-
    parameterized `nextRunReminderTriggerMillis` (`RunReminderSchedulerTest`,
    7 tests) — the day-of-week/time rollover math a live emulator run was
    needed to confirm during development.
  - `VoiceCoach.onPaceCheck`'s direction/threshold/cooldown decision →
    pure `decidePaceAlert` (`VoiceCoachTest`, 8 tests) — the exact scenarios
    a live GPS-simulated workout run was needed to exercise.
  - `RunReminderStore`'s CSV↔`Set<DayOfWeek>` round-trip → pure
    `formatReminderDays`/`parseReminderDays` (`RunReminderStoreTest`, 6 tests).
  - `PasswordStrength` (`PasswordStrengthTest`, 8 tests) — already pure,
    just untested.
- **Verified the tests have real teeth, not just green checkmarks:** while
  writing the pace-alert boundary test, first computed the boundary as
  `target + threshold` (threshold = 20.0/60.0) and asserted no alert —
  deliberately mutated the implementation's `>` to `>=` to confirm the test
  would catch it, and it didn't, because that computation doesn't reliably
  round-trip through subtraction back to the same double. Rewrote with an
  explicit, exactly-representable threshold (0.5) instead, re-ran the same
  mutation, confirmed it now fails correctly, then reverted the mutation.
  All 29 tests pass against the real code (`./gradlew testDebugUnitTest`,
  ~15s, no emulator).
- Files: `app/build.gradle.kts`, `gradle/libs.versions.toml`,
  `core/notifications/RunReminderScheduler.kt`,
  `core/persistence/RunReminderStore.kt`, `features/runtracking/VoiceCoach.kt`,
  4 new files under `app/src/test/java/com/ruvo/app/`.

### 2026-09-06 (cont.) — Reminder-restore-on-boot moved to WorkManager after a live reboot test caught a real ANR
Follow-up to the entry directly below: that first version did the restore
inline in the `BroadcastReceiver` via `goAsync()`, and a live `adb reboot`
test caught a real process-startup-timeout ANR — `Application.onCreate()`'s
Firebase/WorkManager/Room init (40+s in a bare broadcast-only process vs.
~8s warmed by a foreground launch moments later, during a boot-storm CPU/
memory congestion window) killed the process before `onReceive()` ever ran,
losing the restore for that boot with no way to retry.

- **Built:** Hilt wired into WorkManager (`hilt-work`/`hilt-compiler`
  dependencies; `RuvoApplication` implements `Configuration.Provider` with
  `HiltWorkerFactory`; default `WorkManagerInitializer` removed from the
  merged manifest). `RunReminderRestoreWorker` (new) holds the actual restore
  logic, moved out of the receiver — a WorkManager job is durable (tracked in
  its own database, survives the process dying mid-run, retried once the
  system has a free slot) instead of one-shot work lost forever if the
  process doesn't survive to finish it. `RunReminderBootReceiver` is now
  deliberately not a Hilt entry point and does nothing but enqueue that
  worker — the lightest possible `onReceive()`.
- **Doesn't (and can't) prevent** the specific failure mode found below —
  that ANR happens in `Application.onCreate()` itself, before any component
  callback, including this receiver's — but the restore is no longer lost
  outright if the process struggles.
- **Re-verified live** via a second real `adb reboot` (on a freshly-restarted
  emulator, clear of the earlier test's resource strain): ActivityManager log
  showed the process starting for the receiver, then
  `RunReminderRestoreWorker` completing with `Worker result SUCCESS` ~8s
  later, and `dumpsys alarm` confirming the exact original weekly alarm
  (Monday 18:46, matching what was configured before reboot) correctly
  restored. No ANR this run. Confirmed no regression on a normal app launch
  afterward (WorkManager's custom `Configuration` picked up correctly,
  `SystemJobScheduler` created, no crash).
- Files: `app/build.gradle.kts`, `gradle/libs.versions.toml`,
  `RuvoApplication.kt`, `core/notifications/RunReminderBootReceiver.kt`,
  `core/notifications/RunReminderRestoreWorker.kt` (new),
  `AndroidManifest.xml`.

### 2026-09-06 — Real gap closed: AlarmManager reminders now survive a reboot
Closed the "known, deliberate scope boundary" called out when the reminder
feature was first built (see 2026-09-04 entry below): `AlarmManager` alarms
don't survive a device reboot, and nothing restored them afterward.

- **Built:** `RunReminderStore` (new) — local DataStore Preferences snapshot
  of enabled/days/hour/minute/goal, same pattern as `RateLimitStore`/
  `AppLockStore`. `RunReminderScheduler.scheduleWeeklyReminders()` now saves
  it on every real schedule; `cancelAll()` marks it disabled (keeping the
  last days/time so re-enabling restores them). `RunReminderBootReceiver`
  (new) reads that local snapshot on `BOOT_COMPLETED` and resubmits the real
  alarms — deliberately a local read, not Firestore, since boot has no
  guaranteed network. `RECEIVE_BOOT_COMPLETED` permission + manifest
  registration added.
- **Superseded same day** by the WorkManager rework above once a live reboot
  test surfaced the ANR risk in this first version's inline `goAsync()`
  approach — see that entry for the fix and the final live-verified result.
- Files: `core/persistence/RunReminderStore.kt` (new),
  `core/notifications/RunReminderBootReceiver.kt` (new),
  `core/notifications/RunReminderScheduler.kt`, `AndroidManifest.xml`.

### 2026-09-05 — SettingsScreen's "Workout Reminders" toggle was fake; wired to the real alarms + added a day/time editor
Found while closing out the reminder feature above: the toggle only ever
wrote a Firestore preference flag (`notificationSettings.workoutReminders`)
— the real `AlarmManager` alarms kept firing regardless of this switch's
state, so turning it off gave a false sense reminders had stopped. There was
also no way to see or change which days/time a reminder fires on after
onboarding.

- **Fixed:** `SettingsViewModel.toggleNotification("workoutReminders", ...)`
  now actually calls `reminderScheduler.cancelAll()`/`scheduleWeeklyReminders()`
  instead of just writing the flag. Added a "Reminder Days & Time" row (live
  summary, e.g. "Mon at 6:46 PM") that opens an editor (day-chip selector +
  time picker, same pattern as `OnboardingScreen`'s Schedule step) persisting
  the same `selectedDays`/`runDays`/`notificationTime` fields onboarding
  writes, and re-applying them immediately via the same scheduler if
  reminders are on.
- **Live-verified end-to-end**, reusing the account/schedule from the
  reminder feature's own verification below: toggling off cancelled the real
  alarm (`dumpsys alarm` showed `Reason=pi_cancelled`, gone from the active
  list); toggling back on rescheduled it correctly from the Firestore-stored
  day/time; editing the schedule from Friday to Monday via the new dialog
  cancelled the old alarm and scheduled a new one at the correct next
  Monday, with the Settings UI subtitle updating to match.
- Files: `features/settings/SettingsScreen.kt`,
  `features/settings/SettingsViewModel.kt`.

### 2026-09-04 (cont. 2) — Real bug found: signUpWithEmail raced its own auth-state listener, could silently bounce a new user back to Welcome
Found live-testing the reminder feature below (a real account was created in
Firebase — confirmed via `FirebaseAuth` logs — but the app bounced back to
Welcome with no error shown). Root cause: `signUpWithEmail` set `_uiState`
to `Onboarding` directly on success, racing `observeAuthState()`'s listener
— which independently fires moments later and calls `loadUser()` to read the
user's Firestore profile. Any transient failure in that independent read set
`AuthUiState.Unauthenticated`, silently overwriting the signup's own
just-set `Onboarding` state. Welcome (`AuthGraph`'s start destination for
both `Unauthenticated` and `Error`) never renders `AuthUiState.Error`'s
message the way Login/SignUp do, so this was invisible — the proximate
trigger was this dev sandbox's flaky network, but the race itself doesn't
depend on that; any transient Firestore hiccup on a real device right after
signup could hit the same silent bounce.

- **Fixed:** `signUpWithEmail` no longer writes `_uiState` on success —
  `loadUser()` (via the listener) is now the *only* writer of post-auth-
  success state, same as `signInWithEmail` already relied on. `loadUser()`'s
  Firestore read now retries up to 3 times (1.5s apart) before giving up,
  and the final fallback is `AuthUiState.Error` (not `Unauthenticated`) —
  the listener only calls `loadUser()` when `currentUser` is non-null, so
  the user genuinely is signed in.
- **Verified:** cold-launched the app fully offline (airplane mode through
  init, restored ~3s in) against the account created during the reminder
  feature's own testing, and it correctly resolved to Authenticated/Home
  instead of bouncing to Welcome.
- Files: `features/auth/AuthViewModel.kt`.

### 2026-09-04 (cont.) — RunTrackingScreen sub-task 10's last open item: pace-deviation voice callouts built and live-verified
Roadmap item #2 (see below) explicitly listed RN's optional pace-deviation
callouts as never built, "a deliberate new feature, not a port" per the
archive — the one remaining open sub-task on ActiveRunScreen's 15-item list.

- **Built:** `VoiceCoach.onPaceCheck()` — announces "Speed up, you're behind
  pace"/"Ease up, you're ahead of pace" during a workout/interval step with a
  real target pace (`IntervalTrainingScreen.kt`'s `targetPaceMinPerKm`),
  gated by a 20 sec/km deviation threshold and a 45s same-direction cooldown
  (a direction change bypasses the cooldown immediately) — original
  thresholds, no RN spec exists for this feature. `RunTrackingViewModel`
  calls it every tick a workout step has a target pace, resetting the alert
  state on each new step.
- **Live-verified** against a real GPS-simulated interval workout: started a
  real "10×400m Speed" interval preset, fed synthetic slow-then-fast pace via
  `adb emu geo fix` during Work steps. Confirmed via `dumpsys audio`'s
  focus-request history (the only code path requesting audio focus with
  `USAGE_ASSISTANCE_NAVIGATION_GUIDANCE`/`CONTENT_TYPE_SPEECH`): 25 total
  requests vs. 21 expected step-announcement-only requests — the 4 extras
  landed exactly when synthetic off-pace GPS was being fed during a Work
  step, matching the code's `resetPaceAlertState()`-at-step-start +
  direction-change-bypasses-cooldown design.
- Files: `features/runtracking/VoiceCoach.kt`,
  `features/runtracking/RunTrackingViewModel.kt`.

### 2026-09-04 — OnboardingScreen's real per-day-of-week notification scheduling gap: closed
The Screen Mapping Table's OnboardingScreen.js row had one remaining gap:
RN's actual per-day-of-week notification *scheduling* wasn't built — the
Schedule step only ever collected a day *count* (a 1-7 slider), never
specific days, so there was nothing real to schedule against.

- **Built:** `ScheduleStep` now collects real days-of-week (7-day chip
  selector) plus a preferred reminder time, replacing the count-only slider.
  `AuthViewModel.completeOnboarding` persists `selectedDays`/`runDays` (RN's
  real redundant-field shape) and `notificationTime`, and exposes
  `scheduleRunReminders()` as a thin delegate. `RunReminderScheduler` (new)
  turns those into real `AlarmManager` `RTC_WAKEUP` alarms — one per
  selected day (weekly repeat), or a single daily fallback if none chosen;
  deliberately inexact (`setRepeating`, not `setExactAndAllowWhileIdle`)
  since a run nudge doesn't need to-the-second precision and this avoids the
  separate `SCHEDULE_EXACT_ALARM` permission ask. `RunReminderReceiver` (new)
  posts the actual notification, reusing `FcmService`'s "Training" channel.
  `PermissionsSection` schedules the moment notification permission is
  granted.
- **Live-verified end-to-end**: completed onboarding with Friday selected,
  granted notification permission, confirmed via `dumpsys alarm` a real
  weekly `RTC_WAKEUP` alarm was scheduled for the correct next Friday at the
  selected time, then jumped the system clock to that trigger point and
  confirmed the real alarm fired and posted a notification with the correct
  title/body ("Time to Run!" / "It's Friday. Let's hit your goal: <goal>!")
  on the `ruvo_training` channel — the whole path, not just the code.
- **Known, deliberate scope boundary at the time** (alarms don't survive a
  reboot) — closed two days later, see the 2026-09-06 entries above.
- Files: `AndroidManifest.xml`, `core/notifications/RunReminderReceiver.kt`
  (new), `core/notifications/RunReminderScheduler.kt` (new),
  `features/auth/AuthViewModel.kt`, `features/auth/OnboardingScreen.kt`.

### 2026-08-30 (cont. 2) — Real bug found live-testing the badge feature: unconditional pre-save Firestore read had no timeout, could hang a run save forever
Immediately after the first live-verification pass below (which proved
`checkNewBadges()` correct), a *second* manual-run save reproduced a
permanently-stuck "Saving…" button live — not a badge-logic bug, but a
side effect of how the badge feature was wired in.

- **Root cause:** both save paths' pre-save user-doc read
  (`RuvoApp.kt::submitRunActivity`, `SaveActivityViewModel.saveActivity`)
  used to run *only* when `gearId != null` (the original gear-mileage
  read). Wiring in badge evaluation made this read run on *every* save,
  since badge conditions always need the pre-save `runHistory`/`badges`.
  The read itself was only wrapped in a plain `try/catch` — but a wedged
  Firestore connection (this exact dev sandbox's own documented
  "too_many_pings" flakiness, hit repeatedly elsewhere this session)
  doesn't throw, it just hangs `.get().await()` forever. A plain
  `try/catch` never fires on a hang, so the whole save coroutine — and
  the "Saving…" button — stayed stuck permanently, reproduced live with
  no code path left to recover from it short of a fresh app process.
- **Fixed:** wrapped both reads in `withTimeoutOrNull(5_000L)`, the exact
  same defensive pattern `AuthViewModel.kt` already uses for its own
  Firestore reads in this identical environment (`AUTH_NETWORK_TIMEOUT_MS`)
  — falls back to `null` (skip badge awarding for that save, best-effort
  as already documented) instead of blocking the real save indefinitely.
- **Live re-verified same session:** rebuilt and reinstalled; a third
  manual-run save against the still-flaky emulator connection now failed
  *fast* with a real, user-visible error ("Could not save run activity
  securely.") and the button correctly reset to retryable — instead of
  hanging forever with no recovery. Exactly the intended behavior change.
- Files: `features/runtracking/SaveActivityScreen.kt`, `ui/RuvoApp.kt`.

### 2026-08-30 (cont.) — Badge-awarding mechanism built (`checkNewBadges()`), closing the last real gap on the Achievements/Trophy Room feature
Roadmap item flagged this as "a separate, larger feature" back when the
badge *catalogue* was fixed (2026-08-01) — every account showed all 12
badges permanently locked because nothing ever evaluated or awarded them.
Picked it up as the next real, well-specified gap after the spot-check
batch closed out.

- **Built:** `core/model/Badges.kt` — moved `Badge`/`ALL_BADGES` out of
  `AchievementsViewModel.kt` (now shared with the new evaluator instead of
  risking two copies drifting apart) and added:
  - `NormalizedRun` + `Map<String,Any?>.toNormalizedRunOrNull()` — parses a
    raw Firestore run entry once (date/distance/elevationGain/duration)
    instead of re-parsing per-condition.
  - A real `condition: (NormalizedRun, List<NormalizedRun>) -> Boolean`
    lambda on every one of the 12 badges, ported directly from archive
    §3's exact-copy table (`docs/rn-reference/badges.js`) — distance
    thresholds, early-bird/night-owl local-hour checks, the 10th-run and
    first-run exact-count triggers, century-club cumulative sum, hill-
    hunter's 10-qualifying-run count, sub-4-specialist's 5-qualifying-run
    count, and two full date-arithmetic ones: `hasSevenConsecutiveDays`
    (perfect week — sorts all run dates, scans for a 7-day consecutive
    run) and `hasWeekendPair` (weekend warrior — trailing 7-day window
    containing both a Saturday and Sunday run).
  - **Fixed, not blindly ported**: `b_hill_hunter`'s RN condition reads
    `run.elevation`, a field that doesn't exist anywhere real runs are
    written (the real field is `elevationGain`) — archive §3 itself flags
    this as "likely never actually fires in RN... fix when porting," so
    this uses the real field name instead of replicating the dead
    condition.
  - `checkNewBadges(runEntry, priorHistory, alreadyEarnedIds)` — the
    top-level pure function: evaluates all 12, skips already-owned ids,
    strips the condition fn and stamps `earnedAt` before returning
    Firestore-ready maps, exactly matching RN's real `badgeService.js`
    contract.
- **Wired into both real save paths** (GPS-tracked runs in
  `RuvoApp.kt::submitRunActivity` and manually-logged runs in
  `SaveActivityViewModel.saveActivity`) — each now reads the user doc
  *before* the `saveRunActivity` call (extended the gear-mileage read
  that GPS runs already did to always fire, not just when gear is
  attached, since badge evaluation needs the pre-save `runHistory`/
  `badges` too — one read serves both), then after a successful save,
  evaluates `checkNewBadges()` against that pre-save snapshot and writes
  any newly-earned ones via `FieldValue.arrayUnion(...)` on
  `users/{uid}.badges` — matching RN's real architecture exactly: this
  stays client-side, not server-validated (archive §3 flags this as
  spoofable and "worth moving server-side" as a *separate*, larger
  change, not something to invent unasked here).
- **Verified:** compiled clean end-to-end (`:app:compileDebugKotlin`) after
  each change.
  - **Live-verified end-to-end 2026-08-30**, in a follow-up session once
    the Firebase emulator suite + Android emulator were both back up:
    created a genuinely fresh test account (`badgeqa1@ruvo.test`, zero
    run history), completed onboarding, then logged a single 3.2km manual
    activity via `SaveActivityScreen` — this being the account's very
    first run ever, at a device-local time before 7 AM, correctly
    triggered **two** badges in one save: `b_first_run` (history was
    empty) and `b_early_bird` (local hour < 7). Confirmed via Firestore
    REST that `users/{uid}.badges` gained both entries with every field
    correct — `b_first_run`: `name: "First Steps"`, `icon: "👣"`,
    `color: "#CCFF00"`, `category: "Distance Milestones"`,
    `description: "Completed your first run!"`; `b_early_bird`:
    `name: "Early Bird"`, `icon: "☀️"`, `color: "#FDD835"`,
    `category: "Lifestyle & Habits"`, `description: "Finished a run
    before 7 AM."` — both stamped with a real `earnedAt`. Also visually
    confirmed in `AchievementsScreen`'s UI: "2/12" unlocked, the correct
    two badge tiles highlighted. The Home/Profile screens' XP/coins/
    totalRuns/weeklyDistance all updated correctly in the same write,
    confirming the mechanism doesn't interfere with the existing
    gamification pipeline. A second save attempt (6.5km, meant to
    additionally confirm `b_5k` and that already-earned badges don't
    re-fire) got permanently stuck on "Saving…" instead — this turned out
    to be a real bug the badge feature introduced, not emulator noise;
    see the entry directly below for the root cause and fix. After that
    fix, the same 6.5km save was confirmed via Firestore REST to have
    landed correctly: a 2nd `runHistory` entry, a new `b_5k` ("High
    Five") badge, and — importantly — `b_first_run`/`b_early_bird` were
    **not** re-added, confirming the already-earned exclusion works
    across multiple saves, not just a single one. Manually traced the
    two genuinely error-prone date-
    arithmetic algorithms (`hasSevenConsecutiveDays`, `hasWeekendPair`)
    against concrete example date sequences by hand as well, before live
    verification was available — both traced correctly for positive and
    negative cases. The remaining 10 conditions are simple numeric/count
    comparisons with low bug risk.
- Files: `core/model/Badges.kt` (new), `features/achievements/AchievementsViewModel.kt`,
  `features/profile/ProfileScreen.kt` (import path fix only), `ui/RuvoApp.kt`,
  `features/runtracking/SaveActivityScreen.kt`.

### 2026-08-30 — HelpCenterScreen had 5 invented FAQ categories instead of the real, verbatim-preserved RN content; also missing the real Firestore-config path and the wrong support email
Continuing the spot-check batch (CreateClubScreen/UserListScreen/EditProfileScreen/
TipDetailScreen audited 2026-08-27, all clean). This one had a real, clear-cut bug.

- **Found:** `docs/rn-reference/helpData.js` preserves RN's real
  `HELP_CATEGORIES` verbatim (4 categories: Account & Profile, Tracking &
  GPS, Community & Clubs, Privacy & Safety — 10 FAQ items total). The
  Android screen ignored this and shipped 5 entirely different, invented
  categories ("Getting Started", "Coins & Rewards", "RUVO PRO", "Technical
  Issues", "Community & Privacy") with original copy — not a labeled
  original design choice, just silently different content masquerading as
  the real thing. It also hardcoded the contact email as
  `support@ruvoapp.com` — a different domain from the real `support@ruvo.app`
  used throughout its own (now-replaced) FAQ answer text, and collapsed
  RN's two distinct contact actions ("Contact Support" / "Report a Bug",
  different mailto subjects) into one merged "Contact" button.
- **Fixed:** ported the real 4-category content verbatim; added
  `HelpCenterViewModel` that tries Firestore `help_categories` (sorted by
  `order`) first and falls back to the local constants on error/empty —
  matching archive §6c's real behavior and the same pattern
  `SettingsViewModel`'s `system/app_config` fetch already uses (grep-
  confirmed nothing in this repo's Cloud Functions seeds either collection,
  so both are real externally-managed config surfaces, not dead code);
  split the contact card into the two real actions, both to the correct
  `support@ruvo.app`.
- Also audited (as part of the same spot-check pass, no code changes
  needed): **SettingsScreen.js** — Recalibrate AI/Manage Subscription/
  Personal Records/Refer & Earn all traced against archive §6a and found
  correct or deliberately relocated to Profile's menu; **CustomerCenterScreen.js**
  — confirmed genuinely identical (both are a bare RevenueCat widget wrapper,
  nothing else to compare).
- Compiled clean (`:app:compileDebugKotlin`). **Not live-verified** — the
  Firebase emulator suite and Android emulator were both down this
  session (no `adb` device attached, Firestore emulator port 8081 not
  listening); the Firestore-fetch path mirrors an already-approved,
  previously-verified pattern (`SettingsViewModel.loadAppConfig()`), and
  the content/email changes are direct, carefully-diffed substitutions
  against the preserved source file, but neither has been exercised live
  this session.
- Files: `features/settings/HelpCenterScreen.kt`.

### 2026-08-27 (cont.) — SaveActivityScreen's manual-run `id` fix (2026-08-25) live-verified end-to-end
The 2026-08-25 fix (manually-logged runs now get a real `java.util.UUID`
`id`, matching GPS-tracked runs) had never been live-verified — the local
Functions emulator failed to load that session, so it shipped as
code-correct-but-unverified. Verified now while the emulator was already up
and healthy for the rate-limiting work above.

- **Live-verified:** fresh test account (created + onboarded during the
  rate-limiting testing above) → Profile → More → Log Activity → logged a
  5.2km / 30min manual run → "Saving…" → landed back on Profile with the
  entry correctly showing in Recent Activity (5.20 km, 5:46/km, Today).
  Confirmed via Firestore REST
  (`GET .../users/{uid}`) that the resulting `runHistory[0]` entry has a
  real, non-null `id`
  (`"4f3b87df-a25e-4ef7-9702-73d4e024a5d0"`) — not blank, not missing, as
  it would have been before the fix. Also incidentally confirmed the full
  `saveRunActivity` pipeline applied correctly alongside it: `currentXP`
  580, `coins` 52, `totalRuns` 1, `weeklyDistance` 5.2 all updated in the
  same write.
- No code changes this entry — verification only, closing out the 🟡 note
  left on 2026-08-25.

### 2026-08-27 — Login/SignUp rate limiting built (RN_SOURCE_ARCHIVE.md §7), which surfaced and fixed a real, unrelated navigation bug: every failed sign-in bounced the user back to Welcome
Roadmap item #7 had flagged rate limiting as "not fixed, lower priority."
Picked it up as a well-scoped, spec'd gap — and building it exposed a much
more consequential pre-existing bug in the process (see below).

**Rate limiting — faithful port of `docs/rn-reference/rateLimit.js`:**
- **Built:** `RateLimitStore.kt` (`core/persistence/`, same DataStore
  Preferences pattern as `AppLockStore.kt`) — `check`/`recordFailedAttempt`/
  `resetAttempts`, same `MAX_ATTEMPTS=5`, same 30s-base lockout that doubles
  per attempt past the max, same shared `"auth"` namespace across Login AND
  SignUp (RN's own deliberate design — confirmed in the archive: a failed
  sign-up attempt counts toward the same lockout as a failed login).
  `AuthViewModel.signInWithEmail`/`signUpWithEmail` check the lock before
  attempting, record failures, and reset on success.
- **Deliberately not ported:** RN's fire-and-forget `notifyLoginFailure`
  Cloud Function call on the failure that trips the lock — per the "Known
  Backend Bugs" table that function doesn't exist even in RN's own backend.
  Also not ported: RN's lockout alert copy hardcoding "locked for 15
  minutes" regardless of the real 30s-doubling math — the archive itself
  flags this as a bug worth fixing, not a spec to copy — so
  `formatLockoutRemaining()` computes and shows the *real* remaining time
  instead.
- **Bonus, in scope for the same archive spec:** added error-code-specific
  messages for both screens (`FirebaseAuthInvalidUserException`,
  `FirebaseAuthInvalidCredentialsException`, `FirebaseAuthUserCollisionException`,
  `FirebaseNetworkException`, `FirebaseTooManyRequestsException`) — previously
  every failure just showed Firebase's raw `e.message`. Exception-type
  checks (not `errorCode` string guesses) verified against the real
  `firebase-auth-23.0.0`/`firebase-common-21.0.0` `.aar` classes via `javap`
  where the class was actually present in those artifacts.

**Real bug found and fixed while wiring this up (not present in the
rate-limiting feature itself — pre-existing, affecting *any* auth error,
timeout included):** `RuvoApp.kt`'s root `AnimatedContent(targetState =
uiState, ...)` re-ran its content lambda fresh for every *distinct value*
of `uiState`, not just when the destination screen category actually
changed. `AuthUiState.Unauthenticated` and every distinct
`AuthUiState.Error(message)` are different values, so `AnimatedContent`
treated each one as a brand-new target state and recomposed
`AuthGraph(authViewModel)` from scratch — which recreated its
`rememberNavController()`, resetting the back stack to `"landing"`. Net
effect: **every failed sign-in or sign-up attempt silently bounced the user
back to the Welcome screen**, losing whatever they'd typed, instead of
showing the error on Login/SignUp where they were. This made rate limiting
itself hard to even trigger by hand (5 attempts required re-navigating to
Login from Welcome each time) and was clearly a real, user-facing bug
independent of anything this pass added.
- **Fixed:** introduced a coarser `RootScreen` enum
  (`Loading`/`AuthFlow`/`Onboarding`/`Authenticated`) derived from `uiState`,
  and keyed `AnimatedContent`'s `targetState` on *that* instead of the raw
  `uiState`. `AuthGraph` now stays mounted (keeping its nav position) across
  `Unauthenticated <-> Error` transitions; `LoginScreen`/`SignUpScreen`
  still read the live error message reactively straight from
  `authViewModel.uiState`, so it displays correctly without needing the
  screen to be torn down and rebuilt.
- **Related cleanup that made this fix possible:** `signInWithEmail`/
  `signUpWithEmail`/`signInWithGoogle` used to set the *shared* `uiState` to
  `AuthUiState.Loading` for the duration of the network call — the same
  `Loading` value the top-level splash uses for the true initial app-boot
  state. That's what originally made `AnimatedContent` swap all the way out
  to `SplashScreen()` and back on every login attempt (a related but
  distinct trigger for the same underlying bug class). Replaced with a
  dedicated `isSubmitting: StateFlow<Boolean>` on `AuthViewModel`, matching
  what `LoginScreen`/`SignUpScreen`'s own button spinners already expected
  — `uiState` is now reserved for actual screen-category transitions.
- **Live-verified end-to-end** on-device (fresh install, signed out): 4
  wrong-password sign-in attempts in a row, confirmed via screenshot after
  each one that the screen stayed on Login (fields/error visible in place,
  no bounce to Welcome) — then the 5th tripped the lock with the exact
  expected copy, **"Too many attempts. Try again in 30s."** Tapping "Sign
  In" again while locked immediately re-showed the same message with no
  spinner and no network call (confirmed the `rateLimitStore.check()` gate
  short-circuits before touching Firebase at all).
- Compiled clean (`:app:compileDebugKotlin`) after each change.
- Files: `core/persistence/RateLimitStore.kt` (new),
  `features/auth/AuthViewModel.kt`, `features/auth/AuthScreen.kt`,
  `ui/RuvoApp.kt`.

### 2026-08-26 — Health Connect "Connect" button was a complete no-op; fixed, plus filled in dead metric fields
Found while auditing `healthintegrations/*` (never previously covered in
this doc's screen table — Android-exclusive feature, no RN source). This is
a distinct, unrelated `HealthConnectManager` from the one `runtracking/*`
already uses correctly for HR-zone data during a run — two managers of the
same name in different packages, one done right, one broken.

- **Root bug:** `HealthConnectManager.requestPermissions()` (the
  `healthintegrations` copy) was a no-op stub — its own comment said
  "Permissions must be requested from an Activity via contract; here we
  just check" but the check never happened either. Tapping "Connect" on the
  Health screen called this, then silently reloaded (still-ungranted, still
  all-zero) data. No Activity Result launcher existed anywhere in this
  screen's code, so the real OS/Health-Connect permission dialog could
  never have appeared no matter how the user answered the RN-era Health
  Connect prompt — `RunTrackingScreen.kt` already had the correct pattern
  (`rememberLauncherForActivityResult(PermissionController.createRequestPermissionResultContract())`)
  for its own separate manager; this screen never got it.
- **Compounding bug:** the "Connected" chip and the whole metrics section
  were gated on `isHealthConnectAvailable`, which only means the Health
  Connect app/SDK is installed on the device — not that the user granted
  anything. A user who had never connected anything would see "Connected"
  with a wall of real-looking all-zero cards.
- **Fixed:** added the real launcher in `HealthIntegrationsScreen.kt`
  (identical pattern to `RunTrackingScreen.kt`); added
  `HealthConnectManager.hasAllPermissions()` and a new
  `isHealthConnectConnected` state field (permissions actually granted) to
  drive the chip and gate the metrics section, replacing
  `isHealthConnectAvailable` for both. Removed the dead
  `requestHealthConnectPermissions()` no-op from the ViewModel.
- **Also filled in dead metric fields** that were declared in
  `HealthIntegrationsUiState` but never fetched (`todayCalories`,
  `restingHeartRate`, `maxHeartRate`, `weeklySteps`, `weeklyActiveDays` —
  always 0 regardless of real device data), all genuinely buildable
  on-device via Health Connect (no external API key needed, unlike the
  Oura/WHOOP OAuth integrations on the same screen, which stay
  correctly gated behind real client IDs):
  - `fetchTodayCalories()` — `ActiveCaloriesBurnedRecord` aggregate.
  - `fetchRestingHeartRate()` — `RestingHeartRateRecord` (a distinct
    single-point record type from `HeartRateRecord`, not a filter on it).
  - `fetchMaxRunHeartRate()` — the highest HR sample recorded specifically
    during a running `ExerciseSessionRecord` window in the last 30 days
    (cross-references session time ranges against HR samples, not just
    "any max HR" — that's a different, weaker claim `fetchLatestHeartRate()`
    already covers).
  - `fetchWeeklyStepsSummary()` — `aggregateGroupByPeriod` bucketed by day
    over the trailing 7 days, giving both the weekly total and "Active
    Days" (days with any recorded steps) from a single call.
  - Left VO2 Max intentionally unbuilt (already degrades gracefully to
    "--" via existing guard) rather than guess at `Vo2MaxRecord`'s field
    shape without a way to verify it — same honest-gap treatment as the
    weather-chips/notification-scheduling items elsewhere in this doc.
  - Deleted `saveRunSession()` (healthintegrations copy) — grep-confirmed
    zero call sites anywhere in the app, and its write permissions were
    never actually requested by `requiredPermissions` even before this
    pass (RN's real write path is `runtracking/HealthConnectManager`).
- **Manifest:** added the three `uses-permission` entries the code already
  needed but the manifest never declared —
  `android.permission.health.READ_ACTIVE_CALORIES_BURNED` (silently
  broken before this fix: requested in code, absent from the manifest, so
  Health Connect could never actually grant it even if the request flow
  had worked), `READ_EXERCISE`, `READ_RESTING_HEART_RATE`.
- **Verified:** Kotlin compiles clean (`:app:compileDebugKotlin`,
  `:app:processDebugManifest`); every new Health Connect API call
  (`aggregateGroupByPeriod`, `AggregateGroupByPeriodRequest`,
  `AggregationResultGroupedByPeriod`, `RestingHeartRateRecord`) checked
  against the actual `connect-client-1.1.0-alpha10.aar` classes via
  `javap`, not assumed from memory. Live on-device: installed fresh build,
  signed in as the existing `GearQA` test account, navigated Profile → ⚙️
  → Health Integrations, tapped "Connect" on Health Connect — confirmed via
  `adb logcat` (not just a screenshot) that this now genuinely fires
  `android.health.connect.action.REQUEST_HEALTH_PERMISSIONS` and launches
  the real `com.google.android.healthconnect.controller` permission
  Activity, twice, on two separate taps — proof the previous no-op is
  fixed. `dumpsys package` confirmed all three new manifest permissions
  are present on the installed APK. Did not complete the full grant→data
  round trip: the Health Connect consent Activity closed itself within
  ~350ms of launching in this emulator both times, before a follow-up tap
  could reach it — a Health Connect UI flakiness in this specific AVD
  image, not a code issue (manifest and Activity Result contract are both
  independently confirmed correct per above). Recorded here rather than
  re-attempted further, matching this doc's established
  environment-flakiness disclosure pattern.
- Files: `features/healthintegrations/HealthConnectManager.kt`,
  `HealthIntegrationsViewModel.kt`, `HealthIntegrationsScreen.kt`,
  `AndroidManifest.xml`.

### 2026-08-25 (cont. 8) — GPS-tracked runs can now attach gear (RateEffortScreen gear picker), closing the last documented gear gap
`ShoeTrackerScreen.kt`'s own Completed Work Log entry already flagged this
precisely: "only `SaveActivityScreen`'s manual 'Log Activity' flow writes
`gearId` today — GPS-tracked runs via `RuvoApp.kt::submitRunActivity` don't
attach gear yet."

- **Built:** `RateEffortScreen.kt` — the natural hand-off point, since it's
  already where RPE/notes/tags get collected right before the real save —
  gained a new `RateEffortViewModel` (same `gearList` fetch pattern as
  `SaveActivityViewModel`, same default-shoe preselection) and a `GearPicker`
  dropdown mirroring `SaveActivityScreen`'s own. `onSubmit`/`onSkip` both
  now carry the selected `gearId` back to `RuvoApp.kt`.
- **`submitRunActivity`** (the single real GPS-run save point) gained a
  `gearId` parameter: writes it onto the `runEntry` (parity with
  `SaveActivityScreen`'s shape) and, when set, does the same one-shot
  read-modify-write `SaveActivityViewModel` already does — read the current
  `gearList`, add this run's `distanceKm` to the matching shoe's `distance`,
  send the whole updated array back as `calculatedUpdates.gearList`. Needed
  real `FirebaseFirestore`/`FirebaseAuth` access at that call site, so
  `RunSaveViewModel` (the existing thin Hilt entry point) gained those too,
  for the same "respect `USE_FIREBASE_EMULATOR`, don't construct an
  unconfigured instance" reason its `GamificationRepository` already did.
- **Verification was split across two methods** because of two separate,
  unrelated environment failures encountered live-testing this (both
  diagnosed, neither caused by this change):
  1. **Real app UI, live**: seeded a shoe, started a real GPS-tracked run
     (`adb emu geo fix` movement, same technique as the 2026-08-16 live-run-
     sharing verification), reached `RateEffortScreen` and confirmed the
     Gear picker rendered the real seeded shoe ("Nimbus 25") correctly
     pre-selected as default — proving the client-side fetch/picker/pass-
     through logic works. The actual save on that run failed silently, but
     `firebase-debug.log` conclusively showed why: `FirebaseError: Failed to
     load function` — the exact same Functions-emulator cold-start flake
     already hit once earlier this session (SaveActivityScreen's id fix) —
     not a bug in this code.
  2. **Direct Cloud Function call, live**: to verify the server round-trip
     specifically (the one piece the UI run couldn't confirm), restarted the
     emulator suite and called the real local `saveRunActivity` endpoint
     directly via REST with the *exact* payload shape `submitRunActivity`
     constructs (`gearId` on the entry, updated `gearList` in
     `calculatedUpdates`). Confirmed via Firestore REST: the new
     `runHistory` entry has `gearId: "shoe-gear-2"`, the matching shoe's
     `distance` went from the seeded `100` to `100.27` (exactly the run's
     distance), and `earnedXp`/`earnedCoins` matched the real formula.
  Between the two, every piece of the feature — client fetch/UI, payload
  construction, and server-side persistence — was independently confirmed
  against real Firestore data, just not in one unbroken run end-to-end.
- Compiled clean.
- Files: `features/runtracking/RateEffortScreen.kt`, `ui/RuvoApp.kt`,
  `features/gamification/GamificationViewModel.kt`.

### 2026-08-25 (cont. 6) — OnboardingScreen: real Location + Notifications permission requests added to the Ready step
Closes most of the remaining gap on step 6 ("Permissions + account
creation") — the part that's genuinely portable given Android's
account-first architecture (see below for what still isn't).

- **Built:** two `PermissionRow`s on the existing Ready step — real
  `ActivityResultContracts.RequestMultiplePermissions()` for
  `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` (same permissions
  `RunTrackingScreen.kt` already requests contextually when starting a run
  — this just surfaces the ask earlier, during onboarding, matching RN)
  and `ActivityResultContracts.RequestPermission()` for
  `POST_NOTIFICATIONS` (guarded to API 33+, since it isn't a runtime
  permission below that). A denial shows a small "you can grant this later"
  dialog with a real Settings deep link
  (`ACTION_APPLICATION_DETAILS_SETTINGS`) — the spirit of archive's
  "denial shows Settings-redirect alert", though the exact RN copy isn't
  preserved so this uses original wording, not a guess dressed as recovered
  text. Also added archive's documented disabled "Wearables & Health —
  connect later in Settings → Devices" row, which correctly describes
  Android's own real `ConnectedDevicesScreen` (reachable from Settings).
- **Deliberately not gating "Let's Go!"** on these being granted — RN's
  `essentialGranted` check gates *account creation itself*, which doesn't
  map cleanly onto Android's account-first flow (the account already
  exists by the time onboarding runs; this doc already treats that
  ordering difference as accepted elsewhere). Both permissions remain
  skippable, same as every other step already was.
- **Verified live** end-to-end: fresh signup → full wizard → Ready step
  showed both rows as "Allow" → tapping each triggered the real Android
  system permission dialogs (confirmed via UI dump, not assumed) → granting
  both updated the rows to "Granted" with the lime highlight → confirmed
  via `dumpsys package` that `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION`
  were actually `granted=true` at the OS level, not just a UI state flip →
  "Let's Go!" completed onboarding normally, landing on Home with no crash.
- **Not built (real gap, not this pass's scope):** RN's actual
  notification *scheduling* (per-day-of-week weekly reminders, or a daily
  fallback if no days chosen) — Android's Schedule step (the one right
  before Ready) only ever collects a run-days-per-week *count* via a
  slider, never which specific days, so there's no real data to schedule
  per-day reminders against. Building generic scheduling without that would
  be inventing behavior, not porting it; the underlying Schedule-step
  redesign needed first is a separate, larger, still-open gap.
- Compiled clean.
- Files: `features/auth/OnboardingScreen.kt`.

### 2026-08-25 (cont. 5) — Community's Clubs tab: 2 more wrong-field bugs found and fixed
Continuing the same field-name sweep — `CommunityViewModel.loadClubs()` read
`emoji` and `membersCount`, neither of which `CreateClubScreen.kt` (the real
write path, already confirmed correct/spot-checked) actually writes.

- **`emoji` — wrong field, and a category mismatch, not just a name typo.**
  The real field is `icon`, and it stores an *id* (e.g. `"trophy"`), not a
  raw emoji — the id→emoji mapping only ever existed as a `private` list
  inside `CreateClubScreen.kt`. Every real club silently showed the generic
  🏃 fallback. Extracted that mapping to a new shared
  `core/model/ClubIcons.kt` (`CLUB_ICONS`, `clubEmojiFor()`) — same
  shared-lookup precedent as `OnboardingOptions.kt` for
  `RunningGoal`/`FitnessLevel` — so `CreateClubScreen.kt` and
  `CommunityViewModel.kt` can't drift apart on what an icon id means.
- **`membersCount` — wrong field.** Real one is `memberCount` (singular
  "member"), confirmed against both `CreateClubScreen.kt`'s write and
  `ClubDetailScreen.kt`'s already-correct read of the `members` array
  (used as a size fallback here too). Every club always showed "0 members".
- **Not a bug, a genuine scope gap:** `city` was never a real field at
  all — club creation never collects a location. Left the read as-is
  (blank), and fixed `CommunityScreen.kt`'s club-card subtitle to not
  render a dangling "· " separator when `city` is empty, and to pluralize
  "member"/"members" correctly.
- **Verified live**: created a real club ("Trailblazers", 🏆 icon) through
  the actual Create Club flow, confirmed the Clubs tab showed the real
  trophy emoji and "1 member" — not the old 🏃/"0 members" — matching what
  was actually selected/written.
- Files: `features/community/CommunityViewModel.kt`,
  `features/community/CommunityScreen.kt`,
  `features/community/CreateClubScreen.kt`,
  `core/model/ClubIcons.kt` (new).

### 2026-08-25 (cont. 3) — OnboardingScreen: built RN's real Bio + Frequency steps (2 of the wizard's 6), the only path anywhere in the app that ever collects gender/dob/weight/height/runFrequency
Archive §7 documents RN's `OnboardingScreen` as a real 6-step wizard;
Android's version had silently collapsed to 4, entirely skipping steps 3
("Bio + Units") and 4 ("Frequency"). This wasn't just a missing UI section —
`dob` in particular has been the exact reason `AnalyticsViewModel`'s VO2/HR-
zone math has always had to hardcode `age = 30` (see that file's own
comment), since nothing anywhere in the app had ever written a real value
for it.

- **Built step 3 (Bio + Units):** Units toggle (metric/imperial — RN bundles
  this into the Bio step, not its own), Gender pill row (Male/Female/Other,
  default Male), a real Material3 `DatePicker`/`DatePickerDialog` for DOB
  (archive's documented screen-local default of 2000-01-01), Weight/Height
  fields. Skipped re-asking for name — Android's account-first flow already
  collected it at sign-up (an accepted architectural difference this doc
  already documents elsewhere, not a new one). Continue gated on
  weight/height non-blank, matching archive's exact requirement. Faithfully
  ported RN's own documented unit-toggle quirk: the metric/imperial switch
  changes displayed labels only, raw typed numbers are never actually
  converted — not "fixed" into real conversion, since that would be
  inventing behavior RN itself never had.
- **Built step 4 (Frequency):** 0-7 chip grid, default 3, with a
  per-selection encouragement message. Archive quotes only the two
  endpoints of RN's real 8-entry array (0 and 7) — the middle six were
  elided with "…" and RN's source is gone, so there's no way to recover
  them. Ported the two known-real strings verbatim; the middle six are
  original Android copy in the same voice, documented honestly as such
  rather than passed off as recovered RN text.
- **`AuthViewModel.completeOnboarding()`** gained optional
  `gender`/`dob`/`weight`/`height`/`unitSystem`/`runFrequency` params,
  writing real `UserContext.js` `DEFAULT_USER_DATA` field names — the only
  write path for these fields anywhere in the app.
- **Wired the new real `dob` into age-based HR-zone math**, replacing the
  hardcoded age-30 fallback in both `AnalyticsViewModel` (the account-wide
  HR Zones card) and `RunDetailScreen` (the per-run HR Zone card built
  earlier today) — computed via `Period.between`, sanity-guarded to 5-110
  years, falling back to 30 only for accounts that predate this step or
  skipped it. Both screens already shared the exact same zone-threshold
  formula on purpose; this keeps that shared formula accurate for anyone
  who completes the new step.
- **Verified live end-to-end**, real signup through real 6-step wizard
  through real Firestore write: created a fresh account through the actual
  Create Account screen, stepped through Goal (Run 5K) → Level
  (Intermediate) → Bio (Female, DOB picked via the real date-picker UI to
  Jan 15 2000, 68kg, 172cm, Metric) → Frequency (tapped through to 5,
  confirmed the encouragement text updated) → Schedule (existing step,
  confirmed still working with the new 6-dot progress indicator) → Ready
  ("Let's Go!"), landed on Home. Confirmed via Firestore REST that every
  single field matches exactly what was entered in the UI: `gender:
  "Female"`, `dob: "2000-01-15"`, `weight: 68`, `height: 172`, `unitSystem:
  "metric"`, `runFrequency: 5`, plus the pre-existing `runningGoal`/
  `fitnessLevel`/`weeklyRunDays`/`onboardingComplete` fields all still
  correct. Also confirmed the Continue-button gate on step 3 genuinely
  blocks advancing with empty weight/height (tapped it while both were
  blank — screen didn't move).
- Not built this pass (real platform integration, not a data-model gap):
  step 6's actual Location/Notifications permission requests and real
  notification scheduling. Android's account-first flow also means the
  "gate account creation on permissions" part of RN's step 6 doesn't apply
  the same way (account already exists by the time onboarding runs).
- Compiled clean throughout.
- Files: `features/auth/OnboardingScreen.kt`, `features/auth/AuthViewModel.kt`,
  `features/analytics/AnalyticsViewModel.kt`,
  `features/runtracking/RunDetailScreen.kt`.

### 2026-08-25 (cont. 2) — RunDetailScreen: route map, HR Zone card, tags chips, real AI-Coach hand-off — all four of archive §4's "still missing" sub-features built and live-verified
Full spec was already sitting in `RN_SOURCE_ARCHIVE.md` §4 (unlike
CommunityScreen/HomeScreen, this screen's RN source was deep-dived before
deletion) — no re-research needed, just implementation against fields the
real save path (`RuvoApp.kt::submitRunActivity`, `RateEffortScreen`) already
writes.

- **Route map.** `routePath` entries (`{latitude, longitude}` maps, written
  only for GPS-tracked runs) rendered via the same `GoogleMap`/`Polyline`
  Compose pattern `RunTrackingScreen.kt`'s live `RunMap` already uses —
  static camera fit to the route's bounds instead of a following camera,
  start/finish markers. Manually-logged runs (no `routePath` at all) show
  archive's specified "GPS data not available" empty state — expected, not
  a bug.
- **Heart Rate Zone card.** Same `maxHR = 220 - 30` / 60-70-80-90% zone
  thresholds `AnalyticsViewModel`'s HR Zones card already uses (kept
  identical on purpose — see that file's own comment on the age-30
  fallback), applied to this run's single average BPM instead of a
  distribution across many runs. 5-segment bar per archive, the run's own
  zone highlighted.
- **Tags chips.** `tags` — `RateEffortScreen`'s real context condition
  chips ("Strong 💪", "Hilly ⛰️", ...) already flow into the saved run
  entry via `RuvoApp.kt::submitRunActivity`; this card was simply never
  built to display them. Not invented data.
- **"Continue with AI Coach" hand-off.** Archive's exact template
  (`` Based on my {distance}km run at {pace}/km: "{aiInsight}" — what
  should my next training week look like? ``) — RN's `aiInsight` comes from
  a stored Gemini field this app has never had; substituted the same
  locally-computed summary the screen's own "AI Coach Insight" card already
  shows (not new content). Wired real navigation: `RuvoApp.kt` gained a
  `pendingCoachPrompt` state (same pending-then-navigate pattern as
  `pendingTrainingWorkout`), `AICoachScreen`/`AICoachViewModel` gained an
  `initialPrompt` param that auto-sends once via `LaunchedEffect` and
  reports back through `onPromptConsumed()` — deliberately not written
  directly in the composable body (a state write during composition, not
  in an effect).
- **Bonus fix along the way:** Home's own Recent Activity `RunRow` cards
  were never clickable at all (`Analytics`' identical Recent Runs list was
  already wired to `run_detail/{id}`, Home's copy just never got the same
  treatment) — added the same `onClick` wiring, guarded for the blank-`id`
  case documented below (pre-2026-08-25 manually-logged runs).
- **Verified live** end-to-end against the Firebase emulator with a seeded
  GPS-shaped run (5-point route around real Beirut coordinates, avg HR 152,
  tags `["Hilly", "Hot"]`): the map rendered a real Google Maps tile with
  actual street names and the correct polyline shape; the HR card showed
  "152 avg bpm" / "Z4 Threshold" with the 4th segment highlighted — and
  cross-checked against the *account's own* aggregate Analytics HR Zones
  card, which independently computed the same Z4 100% from the same run,
  confirming the two formulas agree; tags "Hilly"/"Hot" rendered as chips;
  tapping "Continue with AI Coach" navigated to the real `AICoachScreen`
  and correctly hit the same Pro-gate every other message goes through
  (confirmed the hand-off prompt actually reached `send()`, not just that
  navigation occurred). Also verified Home's newly-clickable run card lands
  on the same `RunDetailScreen`.
- Compiled clean throughout.
- Files: `features/runtracking/RunDetailScreen.kt`,
  `features/aicoach/AICoachScreen.kt`, `features/home/HomeScreen.kt`,
  `ui/RuvoApp.kt`.

### 2026-08-25 (cont.) — Trivial cleanup: deleted dead GamificationScreen.kt (unreachable, redundant with already-working screens)
Found while sweeping for the `streakDays`-phantom-field bug pattern (same
class just fixed on `HomeScreen`/`LeaderboardViewModel`/`SearchScreen`) —
`GamificationViewModel.kt`'s `streakDays` read the same nonexistent field.
Before fixing it, checked reachability the same way `ForgotPasswordScreen.kt`
was checked before its 2026-08-17 deletion: grepped for
`navigate("gamification")`/`onNavigate("gamification")` across the whole
app — zero matches. `GamificationScreen` (Level/Streak/Coins/Achievements/
Weekly-Goals hub) was registered as a nav route but nothing ever navigates
to it.

- **Confirmed genuinely dead, not just unreachable-but-useful:** every piece
  of its content is already covered by a real, working, wired-up screen —
  `AchievementsScreen.kt` for achievements, `RewardsScreen.kt` for coin
  redemption, `ProfileScreen.kt`'s XP progress bar and Streak card for
  level/streak. Its own "This Week" goals card (`weeklyDistanceKm`/
  `weeklyRuns`/`weeklyActiveDays`) was never even populated by its
  ViewModel — those fields stay at their `0.0`/`0` defaults forever, a
  second bug on top of the unreachability. Not worth fixing a phantom-field
  bug in code nothing can ever reach.
- **Deleted:** `GamificationScreen.kt` in full (grep-confirmed zero external
  references to any of its composables: `LevelCard`, `StreakCard`,
  `CoinCard`, `WeeklyGoalsCard`, `GoalRow`, `AchievementsGrid`,
  `RewardsShopBottomSheet`, `levelEmoji`, `AchievementItem`). Trimmed
  `GamificationViewModel.kt` down to just the parts that are genuinely
  live and critical — `RunActivityResult`, `GamificationRepository` (the
  real `saveRunActivity` call path), and `RunSaveViewModel` (its thin Hilt
  entry point) — removing only the dead `GamificationUiState`/
  `GamificationViewModel` class. Removed the `"gamification"` route and its
  now-unused import from `RuvoApp.kt`.
- **Verified:** compiles clean; relaunched the app on the emulator and
  confirmed no crash (logcat clean of `FATAL`/`AndroidRuntime`) — the
  route removal doesn't break navigation elsewhere since nothing pointed
  to it.
- Files: `features/gamification/GamificationScreen.kt` (deleted),
  `GamificationViewModel.kt`, `ui/RuvoApp.kt`.

### 2026-08-25 — Community feed rebuilt on runHistory (Following + self), replacing the dead runs-subcollection design; live-verified end-to-end
Closes the product-decision item this doc flagged open since 2026-07-29
(see "Known Data-Layer Bugs" above). Went with **redesign as posts from
`runHistory` entries** rather than hiding the tab, per this codebase's
established precedent of building reasonable originals for genuinely dead
features rather than leaving them open (Active Challenges, EditProfileSheet
fields, `regenerate`/`About` — see their own log entries).

- **The design:** a true global feed isn't buildable client-side — `runHistory`
  is an array field, not a subcollection, so it can't be queried across all
  users the way `collectionGroup("runs")` could (if that collection had ever
  actually existed). Scoped the feed to **Following + self** instead — the
  exact same bounded-fan-out shape already proven correct by
  `LeaderboardViewModel`'s "Friends" scope: fetch each followed user's doc
  (+ your own), read their `runHistory`, merge and sort by date, take the 20
  most recent. Respects the real, already-user-facing
  `privacySettings.showActivityOnFeed` field (`PrivacyControlsScreen.kt`) —
  a user who's turned that off is excluded from other people's feeds.
- **Likes/comments:** `runHistory` array entries can't have their own
  subcollections, so introduced `users/{ownerUid}/runInteractions/{runId}` —
  a doc created on-demand (via `set(merge=true)`, not `.update()`, since
  nothing pre-creates it — same self-healing fix already applied to
  `AuthViewModel.completeOnboarding()`) holding `likesCount`/`commentsCount`
  counters plus a `likes` subcollection (unchanged shape from the old design)
  and a `comments` subcollection (unchanged shape, just re-parented).
- **Also fixed while rewriting:** the old `loadFeed()` read `distanceKm`
  (real field: `distance`), `averagePaceMinPerKm`/`durationSeconds` as raw
  numbers (real run entries store `duration` as an `"MM:SS"` string, same as
  every other screen — pace is now computed from distance/duration, not
  read from a nonexistent field), and `userDisplayName` with no `name`
  fallback.
- **Verified live** against the Firebase emulator with two fresh accounts
  (one following the other, each with one seeded run): the feed correctly
  showed both runs (real names, correct distance/pace/duration computed
  from the seeded data), tapping Like created the `runInteractions` doc
  or on-demand with `likesCount: 1` (confirmed via Firestore REST — the
  `set(merge=true)` fix works, not just claimed), and posting a comment
  through the real UI correctly created a `comments` subcollection doc
  (`userName: "FeedQA One"`, the real `name` field) and incremented
  `commentsCount` to 1 on the same doc.
- Files: `features/community/CommunityViewModel.kt`, `CommunityScreen.kt`
  (empty-state copy updated to reflect the new Following-based scope).

### 2026-08-24/25 — Cross-screen field-name audit: 5 more real schema bugs found and fixed (Leaderboard, Search, Community's embedded leaderboard, SaveActivityScreen)
Continuing the same first-principles approach as the HomeScreen pass below —
no RN source survives for these screens either, so this read each
ViewModel against the real schema (`UserContext.js`, `functions_index.js`,
and other already-fixed ViewModels like `ProfileViewModel.kt`) looking for
the same "reads a field nothing writes" bug class, rather than attempting a
layout/copy parity audit.

- **`LeaderboardViewModel.kt` — wrong country field.** Read a top-level
  `data["country"]` that's never written; the real field is nested
  `location.country` (same as `ProfileViewModel`/`EditProfileSheet`). Every
  entry silently showed the generic 🏃 fallback flag instead of a real one.
- **`SearchScreen.kt`'s `SearchViewModel` — same wrong country field, in two
  places.** `myCountry` (used to gate the Nearby filter) and each result's
  `country` display both read the same nonexistent top-level field. Because
  `myCountry` was always `""`, the Nearby filter's condition
  (`it.country == myCountry && myCountry.isNotBlank()`) could **never**
  match anything — Nearby was silently 100% broken for every user, not just
  showing wrong flags.
- **`CommunityViewModel.kt`'s embedded Leaderboard tab (distinct from the
  standalone `LeaderboardScreen.kt` above) — three wrong fields.** Ordered
  by and read `data["xp"]` (real cumulative field is `currentXP`, per
  `saveRunActivity`'s `FieldValue.increment`), read `displayName` only with
  no `name` fallback, and read `totalDistanceKm` (real field is `totalKm`).
  This tab was always either empty or arbitrarily ordered, and every row
  showed "Runner" instead of the real name.
- **`SaveActivityScreen.kt`'s manually-logged runs never got an `id` field
  at all.** GPS-tracked runs get a real `UUID` (`RunTrackingViewModel.runId`)
  baked into their run entry; the manual "Log Activity" flow's `runEntry`
  map had no `id` key whatsoever. `RunDetailScreen.kt`'s lookup
  (`runHistory.firstOrNull { it["id"] == runId }`) could never find a
  manually-logged run, and multiple manual entries would have collided
  under the same blank id in any list using it as a key (e.g. Home's Recent
  Activity). Fixed by generating a `UUID.randomUUID()` the same way
  `RunTrackingViewModel` does.
- **Verified live** (Leaderboard country flag, Search prefix-match +
  Nearby filter, Community's embedded Leaderboard tab) against the Firebase
  emulator with two seeded accounts sharing a country: both tabs correctly
  showed real names/flags/km/XP-ordering, and the Nearby filter — previously
  guaranteed-empty for every user — correctly returned the same-country
  account. **Not live-verified:** the `SaveActivityScreen` id fix — the
  local Functions emulator failed to load `saveRunActivity` this session
  (`FirebaseError: User code failed to load... Timeout after 10000`, a cold-
  load flake this doc has hit before with `askGemini` — see
  `AICoachViewModel`'s Completed Work Log entry), so the manual-save flow
  couldn't be exercised end-to-end. The fix itself is a one-line,
  low-risk change following an already-proven pattern (same `UUID`
  generation `RunTrackingViewModel` already uses); compiles clean. Flagging
  honestly rather than claiming verification that didn't happen.
- **Investigated, not changed:** `CommunityViewModel.loadChallenges()`/
  `joinChallenge()`'s `challenges` collection with a `participants` array —
  `UserContext.js`'s only related field is a static `joinedChallenges: ['c1']`
  default with no collection-query evidence anywhere in the preserved RN
  source. Unlike the `runs`-subcollection bugs, this is internally
  consistent (writes and reads the same shape) and archive coverage for
  CommunityScreen never existed to confirm or deny it — left alone rather
  than guessing at a redesign, same principle as the Community feed's
  already-documented product-decision block below.
- Files: `features/leaderboard/LeaderboardViewModel.kt`,
  `features/search/SearchScreen.kt`, `features/community/CommunityViewModel.kt`,
  `features/runtracking/SaveActivityScreen.kt`.

### 2026-08-24 (cont.) — HomeScreen: 3 real data-layer bugs found and fixed (name/avatar wrong fields, Streak/Today XP phantom fields)
HomeScreen.js was never archived (no RN source survives to compare layout
against), so this wasn't a port-parity audit — instead, read `HomeViewModel.kt`
against the real schema (`UserContext.js`'s `DEFAULT_USER_DATA`,
`functions_index.js`'s `saveRunActivity`) the same way every other
data-layer-bug fix in this doc has been found, and turned up three:

- **Wrong Firestore field for the greeting name.** Read `data["displayName"]`
  — real field (and RN's default) is `name`, same as `ProfileViewModel`
  already reads with a `name ?: displayName ?: auth.displayName` fallback
  chain. Home previously silently fell back to Firebase Auth's cached
  display name (often stale/blank) instead of the real profile name. Fixed
  to use the same fallback chain.
- **Wrong Firestore field for the avatar, and the avatar was never actually
  rendered even when present.** Read `data["avatarUrl"]` — not a real field
  at all (real one is `avatar`, confirmed by `ProfileViewModel`'s own working
  avatar-upload code). Compounding bug: even after fixing the field name,
  `GreetingHeader`'s avatar `Box` never used the `avatarUrl` parameter it
  already received — always rendered the generic person-icon placeholder.
  Wired the same `AsyncImage`-or-placeholder pattern `ProfileScreen.kt`
  already uses.
- **"Streak" and "Today XP" read Firestore fields (`streakDays`, `todayXP`)
  that are never written anywhere** — not by `saveRunActivity`, not by
  anything else. Same "phantom field always reads as 0/default" bug class as
  the `users/{uid}/runs` subcollection bugs, just a scalar field instead of a
  subcollection. Fixed by deriving both from `runHistory` instead of reading
  a stored counter: Streak now uses the exact same walk-backward-from-today
  algorithm as `ProfileScreen.kt`'s already-correct `computeStreak()` (so
  Home and Profile can never disagree), and Today XP sums the public
  `saveRunActivity` formula (`floor(distanceKm*100 + durationMinutes*2)`)
  over just today's runs, reusing the same formula `loadRecentRuns()` already
  uses per-run.
- **Verified live** end-to-end against the real Firestore emulator: seeded a
  3-consecutive-day run history (today 5km/25:00, yesterday 8km/48:00, two
  days ago 3km/18:00) plus `name`/`avatar` fields distinct from the account's
  pre-existing `displayName`. Fresh app launch showed: greeting "Race" (first
  word of the new `name` field, not the old `displayName`), a real photo in
  the avatar circle (not the placeholder icon), Streak "3d" (matches 3
  consecutive days by hand), Today XP "+550" (matches `5*100 + 25*2` by
  hand), and Today's Activity ring at 5.0/5km, 310/500kcal, 25/30min —
  all correct against the seeded today-run.
- Compiled clean (`compileDebugKotlin`) before installing.
- Files: `features/home/HomeScreen.kt`, `HomeViewModel.kt`.

### 2026-08-24 — SettingsDetailScreen audit closed: "regenerate" (Recalibrate AI) and Firestore-backed "About" built + live-verified
Roadmap item #6's last two open sub-items (net-new `regenerate` variant,
hardcoded `About`). Code for both already existed uncommitted in the working
tree from a prior pass; this session compiled, live-verified, and closed them
out.

- **`regenerate` ("Recalibrate AI") — built.** New "Training" section in
  `SettingsScreen.kt` with a confirm dialog matching RN's exact copy
  ("Recalibrate AI?" / "Are you sure you want to recalculate your training
  plan? This will change your upcoming schedule based on recent
  performance."), wired to `SettingsViewModel.regenerateTrainingPlan()`,
  which writes RN's exact contract — `goal:'5k', savedGoal:null,
  isTransitionWeek:false` — via `.update()`, then shows a result dialog.
- **`About` — fixed.** `SettingsViewModel.loadAppConfig()` now fetches
  `system/app_config` (`activeVersion`, `aboutDescription`, `socials.*`,
  `legal.*`, `store.playStore`) into a new `AppConfig` state, replacing the
  hardcoded v1.0.0/description/social-link constants that were there before.
  Fails silently back to those same hardcoded values as defaults if the doc
  is missing or the fetch errors — matches RN's own fallback behavior, not
  new behavior. The Facebook icon only renders when `socials.facebook` is
  actually present (RN has 4 social icons; Android previously only ever had
  3, no invented placeholder URL).
- **Verified live end-to-end** against a fresh local Firebase emulator
  instance (a stale hub process from an earlier session was squatting on
  port 4400 — `EADDRINUSE` — killed before the emulators would start) and a
  freshly seeded test account (`settingsqa@ruvo.test`):
  - Seeded `system/app_config` with deliberately distinguishable values
    (`activeVersion: "v9.9.9-QA"`, `aboutDescription: "QA-TEST DESCRIPTION
    FROM FIRESTORE"`, a `facebook` social URL, etc.) via the Firestore
    emulator's REST API, confirming the screen reads real Firestore data and
    isn't just showing the hardcoded fallback. Settings' "About RUVO
    v9.9.9-QA" row and the opened dialog (title, description, all 4 social
    icons including the newly-conditional Facebook one) matched exactly.
  - Tapped "Recalibrate AI" → "Yes, Regenerate" for real through the Compose
    UI; got the "Your run plan has been recalibrated." result dialog, then
    confirmed via direct Firestore REST read on the emulator that the
    document actually has `goal: "5k"`, `savedGoal: null`,
    `isTransitionWeek: false` — the exact write shape, not just a UI-only
    success message.
  - Compiled clean (`compileDebugKotlin`) before installing.
- Files: `features/settings/SettingsScreen.kt`, `SettingsViewModel.kt`.

### 2026-08-20 — Voice-coaching audio ducking: full request→abandon cycle live-verified; a real (minor, unfixed) first-launch TTS race found along the way
Roadmap item #2 sub-task 10 was `[~]`: the `AudioFocusRequest` ducking
mechanism (built 2026-08-14 cont. 3) had only ever had its "request" half
confirmed via logcat — the "abandon on completion" half was never observed,
since prior verification attempts got stuck chasing a mock-GPS run start.

- **Full cycle now confirmed**, via a much simpler trigger than a full run:
  `RunTrackingScreen`'s expanded dashboard has a "Voice Coaching" toggle
  wired to `VoiceCoach.announceVoiceEnabled()`, which — per its own code
  comment — "bypasses the enabled-gate intentionally" and always speaks
  regardless of run state. Toggling it off/on with a temporary
  `Log.e`-instrumented `abandonAudioFocus()` (reverted after, no net diff —
  `git diff` on `VoiceCoach.kt` is empty) and reading logcat captured the
  complete real cycle:
  ```
  MediaFocusControl: requestAudioFocus() ... AA=USAGE_ASSISTANCE_NAVIGATION_GUIDANCE/CONTENT_TYPE_SPEECH ... req=3
  MediaFocusControl: abandonAudioFocus() ...                                    [~3.7s later, on TTS onDone]
  RUVO_DUCK_VERIFY: abandonAudioFocusRequest -> 1                               [1 = SUCCESS]
  ```
  This closes the item — both halves of the real platform-ducking mechanism
  (replacing RN's silent-looped-WAV hack) are now confirmed working on a
  real device, not just compiled.
- **Real (minor) finding along the way, not fixed this pass:** the very
  *first* announcement of a session — `announceGpsAcquiring()`, fired
  automatically on `RunTrackingScreen` mount before Start is tapped — was
  silently dropped in this run. Logcat showed `requestAudioFocus()` fire
  normally, immediately followed by the framework's own
  `TextToSpeech: Setting up the connection to TTS engine...` /
  `TextToSpeech: speak failed: TTS engine connection not fully set up`.
  This coincided exactly with the background-location permission dialog
  taking foreground, which appears to bump the app's TTS service connection
  into a reconnecting state; `VoiceCoach.speak()` calls
  `audioManager.requestAudioFocus()` then `tts?.speak()` immediately, with
  no check that the async `TextToSpeech(context) { status -> ... }` init/
  reconnect has actually completed — so a `speak()` call that lands in that
  window fails outright, and since it never starts, `onDone`/`onError` never
  fire, meaning `abandonAudioFocus()` never runs for that specific call
  (a narrow focus-leak edge case, distinct from the mechanism itself, which
  the clean second call above proves works correctly). Left unfixed: only
  observed once, specifically overlapping a permission-dialog interruption,
  and RN has no equivalent "wait for TTS ready" guard to port — building
  retry/queue logic here would be inventing new robustness behavior, not
  porting a gap. Flagging honestly rather than silently dropping it.

### 2026-08-17 (cont. 3) — Closed all 4 remaining roadmap items: Active Challenges, EditProfileSheet fields, Reward catalog (confirmed complete), Pro-paywall gating — plus a real sign-in bug found and fixed along the way
Per the user's explicit decision on how to treat the 3 blocked-on-source
items (build reasonable originals rather than leave them open, since
"finishing" them can't mean porting RN behavior that no longer exists):

- **Active Challenges card list — built.** Three original challenges (not
  RN content — RN's `getMonthlyChallenges()` definitions were never
  archived): "50K Month" (distance, ≥50km/month), "Consistency Club"
  (count, ≥12 runs/month), "Hill Climber" (elevation, ≥500m/month). New
  `MonthlyChallenge`/`ChallengeProgress` types and `MONTHLY_CHALLENGES` in
  `ProfileViewModel.kt`, computed off the same `runHistory[]` array
  filtered to the current calendar month; new `ActiveChallengesCard` in
  `ProfileScreen.kt`, placed between Achievements and Recent Activity.
  **Verified live** against the seeded 3-run test account (all runs within
  the current month): 16/50 km, 3/12 runs, 80/500 m — all three exactly
  matched hand-summing the seeded runs' `distance`/`elevationGain` fields.
- **`EditProfileSheet` field parity — built.** Added Running Goal, Fitness
  Level, and Weekly Run Days as editable fields, reusing the *exact* option
  sets and Firestore field names `AuthViewModel.completeOnboarding()`
  already writes — not invented copy. Extracted the `RunningGoal`/
  `FitnessLevel` enums (previously private to `OnboardingScreen.kt`) into
  shared `core/model/OnboardingOptions.kt` so onboarding and profile-editing
  use one definition instead of two that could drift. `ProfileViewModel.kt`
  now reads/writes `runningGoal`/`fitnessLevel`/`weeklyRunDays` the same way
  every other real field on this doc is read (raw map, not a second typed
  schema). **Verified live end-to-end**, write and read paths both: set
  Run 5K / Advanced / 5 days, saved, confirmed via direct Firestore REST
  query (`runningGoal: "RUN_5K"`, `fitnessLevel: "ADVANCED"`,
  `weeklyRunDays: 5`) — the exact enum-name format onboarding uses; then
  cold-relaunched and reopened the sheet, confirmed all three showed
  correctly pre-selected.
- **Reward catalog / design parity — re-checked, nothing to build.** The
  "blocked" status (2026-08-16) was always about the now-impossible RN
  comparison, not a missing feature — `RewardsScreen.kt` already has a
  real 8-item catalog (`git log` shows commit `86ab459`, "Redesign Rewards
  screen to match RN app's grid + gradient-card design," built before RN
  source was lost) wired to the real `redeemReward` Cloud Function
  (verified 2026-08-13). Confirmed live 2026-08-17 that it still renders
  and functions correctly — no changes made.
- **Pro-paywall gating on Analytics' Advanced Metrics — built.** The
  original framing of this item ("Android has no Pro/subscription system
  at all yet") was wrong — checked before building and found a working
  RevenueCat entitlement check already exists and is used by
  `AICoachViewModel`/`GamificationViewModel` (`Purchases.sharedInstance
  .getCustomerInfoWith`, `entitlements["pro"]?.isActive`). Added the same
  `checkProStatus()` pattern to `AnalyticsViewModel.kt`; `AnalyticsScreen.kt`
  now gates the VO2Max/Consistency/Recovery/RacePredictor/PersonalRecords
  block behind `isPro` (Heart Rate Zones stays ungated — RN's archive §2
  lists it separately from the PRO-gated Advanced Metrics section) and
  shows an "Unlock Advanced Metrics" banner otherwise, visually matching
  `AICoachScreen`'s existing "Unlock Full Coaching" banner rather than
  inventing a second style. **Verified live**: default (non-Pro) state
  correctly hides all four cards and shows the banner; tapping it correctly
  navigates to the real `PaywallScreen` (which already independently lists
  "Advanced Analytics — VO2 Max, Race Predictor & PRs" as a Pro feature,
  confirming this gate was the intended design all along, just never wired
  up).
- **Real bug found and fixed: `AuthViewModel.loadUser()` crashed on every
  real account.** Discovered while live-testing the above — signing back in
  hung indefinitely (well past the 15s timeout) or silently bounced back to
  the login screen. Root cause, confirmed via logcat:
  `doc.toObject(RuvoUser::class.java)` — Firestore's **typed** deserializer
  — threw `RuntimeException: Could not deserialize object. Failed to
  convert value of type java.util.HashMap to String (found in field
  'location')`, because `location` is a real `{country: ...}` map (the
  same field `ProfileViewModel`/`EditProfileSheet` read/write), not the
  plain `String?` `RuvoUser.location` declares. That exception was already
  caught, but the catch path sets `AuthUiState.Unauthenticated`, silently
  bouncing a legitimately-signed-in user back to the login screen — every
  sign-in looked like either an indefinite hang or a mystery sign-out.
  `RuvoUser` is otherwise never actually schema-correct against real
  Firestore documents (also `name`/`displayName` split, `avatar` vs
  `avatarUrl`, `currentXP` vs `xp`, arrays vs counts for
  followers/following, etc.) — but nothing reads `AuthUiState
  .Authenticated`'s `user` payload anywhere in the app (every screen loads
  its own data via its own ViewModel, same as everywhere else in this
  codebase), so **fixed by reading the raw map for just what `loadUser()`
  actually needs** (`onboardingComplete`, plus `email`/`displayName` for a
  minimally-populated `RuvoUser`) instead of patching `RuvoUser`'s schema
  field-by-field to chase a model nothing consumes. **Verified live**:
  cold sign-in after the fix landed on Home in ~4 seconds with zero
  exceptions in logcat, versus the same account hanging indefinitely
  before the fix.

### 2026-08-17 (cont. 2) — Personal Records merged into AnalyticsScreen as an embedded card
- **The decision (user's call, per Roadmap item #5):** merge PR into
  Analytics rather than keep it as its own screen, matching RN's real
  layout — `RN_SOURCE_ARCHIVE.md` §2: "Personal Records card
  (5K/10K/Half/Marathon/Longest — this is RN's actual 'Personal Records'
  feature; there is no separate PersonalRecordsScreen.js)", positioned
  right after the Race Predictor card in the Advanced Metrics section.
- **Built:** renamed `PersonalRecordsScreen.kt`'s top-level composable from
  a full-screen `PersonalRecordsScreen()` to an embeddable
  `PersonalRecordsCard()` (`RuvoCard`-wrapped, same `PersonalRecordsViewModel`
  and PR-bucket algorithm untouched — that logic was already schema-correct
  and live-verified back on 2026-07-29, only its container changed).
  Inserted it into `AnalyticsScreen.kt` immediately after `RacePredictorCard`,
  matching RN's exact card order. Removed the now-redundant standalone
  `"prs"` nav route from `RuvoApp.kt` (plus its now-unused import).
  `ProfileScreen.kt`'s "🏆 Personal Records" menu item now routes to
  `"analytics"` instead of the deleted `"prs"` route — **not** RN's own
  actual behavior of routing that menu item to the Achievements/badge
  gallery screen (archive §6a flags this as an RN inconsistency, not a
  deliberate design worth replicating; routing to where the content now
  actually lives is more useful).
- **Kept, not trimmed:** Android's PR card already covers more than RN's
  narrower 5K/10K/Half/Marathon/Longest set (adds 1K, Best Pace, Most
  Calories) — kept as-is since it's real schema-correct data, not invented,
  and RN itself never described removing detail as correct.
- **Verified live:** navigated Profile → gear menu → "Personal Records" and
  confirmed it now lands on the Analytics screen (route change worked);
  scrolled to the Advanced Metrics section and confirmed the card renders
  in the right position (right after Race Predictor) with correct data
  against the same seeded 3-run account used for the chart-engine
  verification: 1K and 5K PRs both showed the 5km/25:00 run (its 5.0 min/km
  pace beats the 8km run's 6.0 min/km for both brackets — correct, since
  the algorithm picks best-pace-among-qualifying-runs, not literal-distance
  match), and 10K/Half correctly showed "Not yet run" since no run in the
  seeded history reaches either threshold — all matching hand-calculation.

### 2026-08-17 (cont.) — Trivial cleanup: deleted dead ForgotPasswordScreen.kt
Flagged twice (2026-08-13 audit, then again in the Roadmap item #7
checklist) as a confirmed-safe delete never actually done. Re-confirmed via
a fresh grep across the whole `android/` tree before deleting: the only
remaining references were in this doc and `RN_SOURCE_ARCHIVE.md` (both
docs, not code) — no navigation route, import, or call site anywhere in
`app/src`. Only `ForgotPasswordDialog` inside `AuthScreen.kt` was ever
actually wired up (from `LoginScreen`'s "Forgot Password?" link).
**Note:** this session's Gradle/Bash build access was blocked mid-task by
an auto-mode classifier restriction (unrelated to this change), so the
deletion was verified via static grep rather than a real compile — flagged
to the user, who confirmed proceeding on the static check was fine.

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
  had zero references anywhere in the app outside its own declaration —
  only `ForgotPasswordDialog` (inside `AuthScreen.kt`) is actually reachable
  from `LoginScreen`. **Deleted 2026-08-17** (see the trivial-cleanup entry
  at the end of the Completed Work Log) — no navigation route, import, or
  reference to it survived a grep of the entire codebase.
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
- [x] Sub-task 10 (voice-coaching template accuracy) — templates fixed
      2026-07-29; real `AudioFocusRequest` audio-ducking added 2026-08-14
      (cont. 3), **full request→speak→abandon cycle live-verified
      2026-08-20** (see Completed Work Log) via logcat: `requestAudioFocus()`
      GRANTED, TTS speaks, `abandonAudioFocusRequest() → 1` (SUCCESS) fires
      on completion. **RN's optional pace-deviation callouts — the one
      remaining item here — built and live-verified 2026-09-04** (see
      Completed Work Log): `VoiceCoach.onPaceCheck()` announces "Speed
      up"/"Ease up" during a workout/interval step with a real target pace,
      gated by a 20 sec/km threshold + 45s same-direction cooldown (direction
      changes bypass the cooldown). Verified against a real GPS-simulated
      interval workout (`adb emu geo fix` feeding synthetic slow-then-fast
      pace) — confirmed via `dumpsys audio`'s focus-request log showing 4
      extra `requestAudioFocus()` calls beyond the 21 expected step
      announcements, each timed exactly to the synthetic off-pace windows.
      Distance-milestone callouts (RN's other optional item) already existed.
      All 15 sub-tasks now fully built and live-verified.
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
      Completed Work Log. All 15 sub-tasks are now fully built and live-
      verified, including #10's pace-deviation callouts (2026-09-04).

### 3. ProfileScreen follow-up: remaining sub-features
The data-layer bugs (follow/unfollow, avatar/location/bio fields) are fixed —
see Completed Work Log. RN's `ProfileScreen.js` still has ~10 sub-features
with no Android equivalent yet (each independently scopable; the original
Explore survey's line ranges are in the 2026-07-16 log entry; badge/PR
specifics are now also in `RN_SOURCE_ARCHIVE.md` §2-3):
- [x] Avatar upload/picker flow (`AvatarPickerModal` in RN) → `updateUserProfile({avatar})` — built 2026-08-15, see Completed Work Log. **Storage upload live-verified end-to-end 2026-09-06** (see Completed Work Log) — the earlier TLS-pin blocker didn't reproduce this session. Real upload, real Firestore write, and a fresh post-restart read all confirmed.
- [x] Weekly calendar strip (Mon-Sun run-dot row with a "today" ring) —
      merged with the Streak card below into one "Weekly Activity" card,
      see 2026-07-31 (cont.) Completed Work Log entry. Verified live (zero
      run-history case); filled-dot case not independently live-tested.
- [x] XP progress bar (ported the pattern already working in `UserProfileScreen.kt` rather than building a new one) — see 2026-08-01 (cont.) Completed Work Log entry. Verified live (0 XP case).
- [x] Gear preview card (primary shoe mileage bar + "near limit" warning, links to Gear screen) — see 2026-08-01 (cont.) Completed Work Log entry. Verified live end-to-end (hidden-with-no-gear case, populated case after adding a shoe, and tap-to-navigate).
- [x] Country picker bottom sheet (writes `location.country`, now that the field is fixed) — see 2026-08-01 Completed Work Log entry. Verified live end-to-end (search, select, save, persisted display).
- [x] Streak card ("ON FIRE" badge + 7-day dot strip) — per archive §9, RN has **no persisted streak counter anywhere**; this card's "streak" is recomputed from scratch off run-history dates each render, same pattern as the `b_perfect_week` badge condition — don't assume a `currentStreak` field exists to read. Built 2026-07-31, see Completed Work Log entry; verified live (0-day case).
- [x] **Active Challenges card list — built 2026-08-17** (user's explicit
      call: original Android content, not an RN port — no `getMonthlyChallenges()`
      definitions survive anywhere to port from). See Completed Work Log for
      the full build + live verification.
- [x] Achievements/badges horizontal grid (locked/unlocked against `userData.badges`) — see 2026-08-01 (cont.) Completed Work Log entry, which also fixed a real pre-existing bug (fabricated badge catalogue) found while scoping this. Verified live end-to-end, including the full "Trophy Room" screen's 5 categories/counts. Badge-*awarding* itself doesn't exist on Android yet (separate gap, see that entry) — every account shows 0 unlocked until it's built.
- [x] Recent Activity: replace the bare distance-only grid with dated/typed run cards + All/This Week filters — see 2026-08-03 (cont.) Completed Work Log entry. Verified live end-to-end (empty state, populated state with 3 runs, and the This Week filter). RN's date-picker filter (a third mode beyond All/Week) was not ported — only All/This Week exist on Android.
- [x] Saved Tips library tab (separate `contentService.fetchTips()` data source, filtered by `userData.savedTips`) — see 2026-08-15 (cont.) Completed Work Log entry. Verified live end-to-end (empty state, bookmarking, populated state, tap-to-navigate) on a fresh account. A real sandbox network-instability issue (Firestore emulator write-stream throttling, not a code bug) was found and documented while verifying — bookmark writes don't reliably reach the server in this environment, though the UI correctly reflects whatever Firestore's cache returns.
- [x] Share-profile flow (native share sheet — uses uid, not username; see
      2026-08-01 Completed Work Log entry for why) and refresh (manual
      button, not a swipe gesture — this Material3 version predates
      `PullToRefreshBox`). Both verified live.
- [x] **`EditProfileSheet` field parity — built 2026-08-17** (user's explicit
      call). RN's `EditProfileScreen.js` field list still can't be confirmed
      (no source survives), so this didn't try to match RN — instead it
      makes the fields onboarding *already* collects (`runningGoal`,
      `fitnessLevel`, `weeklyRunDays`) editable afterward too, which
      neither platform previously allowed. Not invented content: reuses the
      exact same `RunningGoal`/`FitnessLevel` option sets and Firestore
      field names `AuthViewModel.completeOnboarding()` already writes (now
      extracted to shared `core/model/OnboardingOptions.kt` so both places
      use one definition). See Completed Work Log for the full build + live
      verification.

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
- [x] **Blocked on missing RN source, confirmed 2026-08-16** — no RN UI
      source exists for the reward catalog anywhere in `docs/rn-reference/`.
      `RewardsScreen.js` itself was never archived (unlike `functions_index.js`,
      `UserContext.js`, `referralService.js`, etc.). A broad case-insensitive
      `reward` search across every archived file turns up only
      `functions_index.js`'s `redeemReward` **backend** logic (already ported
      and live-verified above — not a UI/catalog spec) and one unrelated FAQ
      line in `helpData.js` ("...you both earn rewards!"). **Re-checked
      2026-08-17**: nothing to build here regardless — `RewardsScreen.kt`
      already has a real 8-item catalog (commit `86ab459`, built before RN
      source was lost, explicitly "to match RN app's grid + gradient-card
      design") wired to the real `redeemReward` Cloud Function. The
      "blocked" status was always about the now-impossible parity
      *comparison*, not a missing feature — confirmed still rendering and
      functioning correctly live.

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
- [x] **Personal Records merged into Analytics as an embedded card —
      2026-08-17** (user's call). See Completed Work Log for the full
      change + live verification.
- [x] **Pro-paywall gating on Advanced Metrics — built 2026-08-17.** The
      earlier note above ("Android has no Pro/subscription system") turned
      out to be wrong — a real RevenueCat entitlement check already exists
      and is used by `AICoachViewModel`/`GamificationViewModel`; Analytics
      just never connected to it. See Completed Work Log for the build +
      live verification.

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
      - `regenerate` ("Recalibrate AI" training-plan reset) — **built
        2026-08-24**, see Completed Work Log. Exact RN write shape
        (`goal:'5k', savedGoal:null, isTransitionWeek:false`) and confirm-alert
        copy, live-verified against the real Firestore emulator.
      - `Help` — **not rebuilt as a separate variant**: Android's Settings
        already routes "Help Center" to the richer standalone
        `HelpCenterScreen.kt` (archive §6c), which functionally supersedes
        RN's minimal legacy `Help` variant. No gap worth closing.
      - `About` — **fixed 2026-08-24**: now reads `system/app_config`
        (version, description, socials, legal URLs, Play Store link) with a
        silent fallback to the same hardcoded copy that was there before —
        see Completed Work Log for the build + live verification.

All 6 variants now closed: `regenerate` and `About` were the last two open
sub-items in this audit.

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
      itself. **Dead file deleted 2026-08-17** (see Completed Work Log) —
      grep-confirmed zero references anywhere in the codebase first.
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
