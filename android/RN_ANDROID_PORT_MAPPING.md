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
| ActiveRunScreen.js | 959 | `features/runtracking/RunTrackingScreen.kt` + `RunTrackingViewModel.kt` + `RunTrackingService.kt` | ~500+330+310 | 🟡 | Being worked through as the 15 independently-scopable sub-tasks in archive §1. Done: #2 background service, #3 GPS noise/speed filter, #4 distance/pace/calorie engine, #5 elevation gain, #6 pause/resume (`f4f5343`), #8 map style/follow/recenter (`1592bd0`), #9 HR zone module + Health Connect polling (2026-07-29, see Completed Work Log — live BPM population not verified, see log entry), #11 haptics (`e2838eb`), #14 run-completion handoff (`9b0affa`), #15 crash-recovery (`6d23d20`). Still open: #1 permission/GPS-acquisition polish, #7 draggable bottom sheet, #10 voice-coaching template accuracy, #12 live-run sharing (Cloud Functions + share sheet), #13 interval/workout-mode step engine integration. |
| PlanScreen.js | 1263 | `features/training/TrainingPlanScreen.kt` + `HabitsSection.kt` | 432 + 483 | 🟡 | Fixed schema + ported the real plan algorithm and status toggles (commit `d5ccfef`). Habits subsystem (CRUD, derived stats, 7×16 heatmap, Add Habit sheet) ported and live-verified 2026-07-24 (commit `ded5a01`) — exact match to archive §10. Still missing: day-by-day weekly calendar, tap-workout-to-start navigation, and `runDays` editing UI — kept 🟡 for those. |
| ProfileScreen.js | 1703 | `features/profile/ProfileScreen.kt` + `ProfileViewModel.kt` | 393 + 138 | 🟡 | Fixed follow/unfollow (systemic, 3 files) + avatar/location/bio field bugs (commit `7d36f08`). Still missing most of RN's ~15 sub-features (avatar upload, weekly strip, XP bar, gear card, country picker, streak, challenges, badges, dated activity list, saved tips) — kept 🟡, see Roadmap. |
| SaveActivityScreen.js | 1180 | `features/runtracking/SaveActivityScreen.kt` | 307 | 🟡 | Partially touched this session (gear picker added). Not fully compared otherwise. |
| RunDetailScreen.js | 730 | `features/runtracking/RunDetailScreen.kt` | 251 | 🟡 | Read-path/schema bug fixed 2026-07-29 (was reading a nonexistent `users/{uid}/runs/{id}` subcollection — see Completed Work Log) — screen now shows real saved-run data. Still 🟡: no map/route rendering, no HR-zone card, no weather/gear/tag chips, no AI-Coach handoff button (see archive §4). |
| RewardsScreen.js | 692 | `features/rewards/RewardsScreen.kt` | 440 | 🟡 | Fixed insecure client-side redemption → real Cloud Function call (commit `49fbc0a`). Design/catalog parity not otherwise re-compared. |
| ReferralScreen.js | 561 | `features/referral/ReferralScreen.kt` | 576 | 🟡 | Fixed `referralStats` nested-field schema mismatch (commit `49fbc0a`). Not fully live-verified this session (see Completed Work Log note). |
| SettingsDetailScreen.js | 457 | *(likely inlined into)* `features/settings/SettingsScreen.kt` | 281 | 🟡 | RN uses one generic param-driven detail screen for notifications/units/password/etc; needs audit of whether Android inlines all of these. |
| EditProfileScreen.js | 425 | `EditProfileSheet` inside `features/profile/ProfileScreen.kt` | — | 🟡 | RN: standalone screen. Android: bottom sheet inside ProfileScreen. Architecture differs by design; verify field parity. |
| AnalyticsScreen.js | 445 | `features/analytics/AnalyticsScreen.kt` + `AnalyticsViewModel.kt` + `PersonalRecordsScreen.kt` | 282+157+196 | 🟡 | Not yet compared. |
| ConnectedDevicesScreen.js | 397 | `features/healthintegrations/ConnectedDevicesScreen.kt` | 207 | 🟡 | Not yet compared. |
| WorkoutDetailScreen.js | 534 | `features/runtracking/WorkoutDetailScreen.kt` | 213 | 🟡 | Not yet compared. |
| RateEffortScreen.js | 400 | `features/runtracking/RateEffortScreen.kt` | 204 | 🟡 | Not yet compared. |
| SearchScreen.js | 411 | `features/search/SearchScreen.kt` | 249 | 🟡 | Note: a near-duplicate of FindFriendsScreen; confirm which is actually reachable from nav before editing (this tripped up an earlier session). |
| LeaderboardScreen.js | 289 | `features/leaderboard/LeaderboardScreen.kt` + `LeaderboardViewModel.kt` | 209 + 144 | 🟡 | Not yet compared. |
| MyRedemptionsScreen.js | 265 | `features/rewards/MyRedemptionsScreen.kt` | 125 | 🟡 | Fixed field-schema mismatch — was reading fields the backend never writes (commit `49fbc0a`). |
| AchievementsScreen.js | 266 | `features/achievements/AchievementsScreen.kt` + `AchievementsViewModel.kt` | 319 + 116 | 🟡 | Android larger — spot-check only. |
| HomeScreen.js | 891 | `features/home/HomeScreen.kt` + `HomeViewModel.kt` | 339 + 122 | 🟡 | Not yet compared. |
| CommunityScreen.js | 957 | `features/community/CommunityScreen.kt` + `CommunityViewModel.kt` | 508 + 350 | 🟡 | Not yet compared. |
| CreateClubScreen.js | 198 | `features/community/CreateClubScreen.kt` | 184 | 🟡 | Line counts close — spot-check only. |
| UserListScreen.js | 166 | `features/community/UserListScreen.kt` | 171 | 🟡 | Line counts close — spot-check only. |
| TipDetailScreen.js | 313 | `features/tips/TipDetailScreen.kt` | 313 | 🟡 | Line counts identical — likely already ported; spot-check only. |
| SettingsScreen.js | 268 | `features/settings/SettingsScreen.kt` | 281 | 🟡 | Line counts close — spot-check only. |
| HelpCenterScreen.js | 176 | `features/settings/HelpCenterScreen.kt` | 158 | 🟡 | Line counts close — spot-check only. |
| LoginScreen.js | 310 | `LoginScreen` composable inside `features/auth/AuthScreen.kt` | — | 🟡 | Android combines Landing/Login/SignUp/ForgotPassword into one file. Verify parity per composable. |
| SignUpScreen.js + OnboardingSignUpScreen.js | 342 + 357 | `SignUpScreen` composable inside `features/auth/AuthScreen.kt` | — | 🟡 | Same file as above. |
| WelcomeScreen.js | 98 | `LandingScreen` composable inside `features/auth/AuthScreen.kt` | — | 🟡 | Same file as above. |
| ForgotPasswordScreen.js | 140 | `features/auth/ForgotPasswordScreen.kt` (+ `ForgotPasswordDialog` in AuthScreen.kt) | 157 | 🟡 | Two Android implementations exist (standalone screen + dialog) — confirm which is live and dedupe if not. |
| OnboardingScreen.js | 887 | `features/auth/OnboardingScreen.kt` | 259 | 🟡 | Large gap — not yet compared. |
| LockScreen.js | 352 | `features/auth/LockScreen.kt` | 188 | 🟡 | Not yet compared. |
| CustomerCenterScreen.js | 19 | `features/paywall/CustomerCenterScreen.kt` | 19 | 🟡 | Both tiny/likely just a RevenueCat UI wrapper — spot-check only. |
| — (Android-only, no RN source) | — | `features/runtracking/IntervalTrainingScreen.kt` | 433 | — | Android-exclusive feature; nothing to port from RN. |
| — (Android-only, no RN source) | — | `features/runtracking/RunSummaryScreen.kt` | 461 | — | Android-exclusive feature; nothing to port from RN. |

---

## Completed Work Log

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
- [ ] Day-by-day weekly calendar with a today-selector (RN's `weekDates`/
      `selectedDate` state) instead of Android's current "This week" list.
- [ ] Tapping a workout to start it, navigating into `WorkoutDetailScreen`
      with the workout's `name`/`desc`/`duration`/`type`/`intensity`.
- [ ] `runDays` editing UI (RN's schedule modal) — currently read-only on
      Android, defaulting to Mon/Wed/Fri if unset.

### 2. ActiveRunScreen → RunTrackingScreen (959 RN vs 641 Android combined)
Full spec: **`RN_SOURCE_ARCHIVE.md` §1** — GPS permission sequencing, the exact
speed/noise-filtering thresholds (25 km/h cutoff, 5m jitter, implied-speed
rejection), haversine distance + instantaneous-speed pace + calorie formulas,
elevation-gain noise threshold, HR zone bands, exact voice-coaching templates,
the `RateEffort` hand-off payload contract, and 15 independently-scopable
sub-tasks (already broken out at the end of that section) — use those as the
actual task list instead of re-deriving them.
- [x] Sub-tasks 1 (permission/GPS-acquisition polish), 2 (background
      service), 3 (GPS noise/speed filter), 4 (distance/pace/calorie
      engine), 5 (elevation gain), 6 (pause/resume), 8 (map view +
      controls), 9 (HR zone module + Health Connect), 10 (voice-coaching
      template accuracy), 11 (haptics), 14 (run-completion handoff), 15
      (crash-recovery, net-new) — see Completed Work Log entries 2026-07-24
      through 2026-07-30.
- [ ] Still open: 7 (draggable bottom dashboard sheet — note the voice
      on/off toggle mentioned in the archive's dashboard spec still needs a
      home once this is built), 12 (live-run sharing — currently pushes
      Firestore location updates but has no `startLiveRun`/`endLiveRun`
      Cloud Function call or share-sheet link), 13 (interval/workout-mode
      step engine — `IntervalTrainingScreen.kt` exists but is entirely
      separate, not integrated into `RunTrackingScreen`).
- [ ] This one is hardest to verify live — plan to mock GPS via `adb emu geo fix`
      or the emulator's Extended Controls location panel rather than skipping
      verification entirely.

### 3. ProfileScreen follow-up: remaining sub-features
The data-layer bugs (follow/unfollow, avatar/location/bio fields) are fixed —
see Completed Work Log. RN's `ProfileScreen.js` still has ~10 sub-features
with no Android equivalent yet (each independently scopable; the original
Explore survey's line ranges are in the 2026-07-16 log entry; badge/PR
specifics are now also in `RN_SOURCE_ARCHIVE.md` §2-3):
- [ ] Avatar upload/picker flow (`AvatarPickerModal` in RN) → `updateUserProfile({avatar})`.
- [ ] Weekly calendar strip (Mon-Sun run-dot row with a pulsing "today" ring).
- [ ] XP progress bar polish (Android has a bare stats row; RN has a dedicated leveled XP bar with a glow dot). Note per archive §9: RN's `level`/`xpToNextLevel` fields are static and never actually increment anywhere — don't build level-up logic that doesn't exist in the source.
- [ ] Gear preview card (primary shoe mileage bar + "near limit" warning, links to Gear screen).
- [ ] Country picker bottom sheet (writes `location.country`, now that the field is fixed).
- [ ] Streak card ("ON FIRE" badge + 7-day dot strip) — per archive §9, RN has **no persisted streak counter anywhere**; this card's "streak" is recomputed from scratch off run-history dates each render, same pattern as the `b_perfect_week` badge condition — don't assume a `currentStreak` field exists to read.
- [ ] Active challenges card list (RN hardcodes 3 monthly challenges in `getMonthlyChallenges()` — distance/count/elevation types with per-type progress formulas).
- [ ] Achievements/badges horizontal grid (locked/unlocked against `userData.badges`) — full badge catalogue + exact unlock conditions now in archive §3; check `AchievementsScreen.kt` for reusable badge-rendering logic first.
- [ ] Recent Activity: replace the bare distance-only grid with dated/typed run cards + All/Week/date-picker filters (RN's biggest sub-feature here).
- [ ] Saved Tips library tab (separate `contentService.fetchTips()` data source, filtered by `userData.savedTips`).
- [ ] Share-profile flow (native share sheet with `https://ruvo.app/u/{username}` deep link) and pull-to-refresh.
- [ ] Cross-check `EditProfileSheet` (inside `ProfileScreen.kt`) against RN's
      standalone `EditProfileScreen.js` for field parity — not yet done.

### 4. RewardsScreen / MyRedemptionsScreen / ReferralScreen — live verification follow-up
The security/schema bugs are fixed (see Completed Work Log, commit `49fbc0a`),
but the emulator crashed repeatedly before a full live click-through could be
done. Next session, with a stable emulator (check disk space first per the
Emulator/ADB Playbook note above):
- [ ] Redeem a reward end-to-end on a signed-in test account, confirm the
      Cloud Function actually deducts coins and a redemption record with
      the real fields (`rewardId`/`title`/`price`/`timestamp`) appears in
      `MyRedemptionsScreen`.
- [ ] Confirm the rooted-device lockout doesn't false-positive on a normal
      (non-rooted) emulator/device.
- [ ] Generate a referral code, redeem it from a second test account, and
      confirm `referralStats.totalInvites`/`coinsEarned` update on the
      referrer's `ReferralScreen`.
- [ ] Confirm the reward catalog and design otherwise match RN (not
      re-compared this pass — only the data-layer bugs were addressed).

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
- [ ] Batch these together — all are post-run data-visualization screens
      sharing similar chart/stat-card patterns (hand-rolled `SimpleBarChart`/
      `SimpleLineChart` in RN, no third-party charting lib — Compose needs a
      from-scratch Canvas-drawn equivalent either way).
- [ ] Decide the canonical "Personal Records" surface up front (see archive §3
      navigation note — RN's own Settings entry inconsistently routes
      "Personal Records" to the badge gallery, not the pace-PB card).
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
      buckets, pace trend, recent runs). Still open, deliberately not part
      of this fix: the half-blend chart averaging formula, VO2 Max (always
      0, card never renders), Consistency descriptor, real HR zones
      (currently a hardcoded placeholder distribution), Personal Records
      card, Race Predictor, Recovery Score — all archive §2/§3 features that
      were never built, not schema bugs.

### 6. SettingsDetailScreen audit
Full spec: **`RN_SOURCE_ARCHIVE.md` §6b** — all 6 active `route.params.type`
variants (`notifications`, `units`, `regenerate`, `Help`, `About`, `Password`)
with their exact Firestore fields, validation rules, and alert copy.
- [ ] Enumerate whether each variant already has a working Android equivalent
      (likely inlined in `SettingsScreen.kt`) — this is primarily an audit
      task, not necessarily a rewrite. `About` (fetches `system/app_config`)
      and `Password` (writes an `auditLog` entry via `logSensitiveAction`) are
      the two most likely to be fully missing on Android.

### 7. Auth flow consolidation check (Welcome/Login/SignUp/ForgotPassword)
Full spec: **`RN_SOURCE_ARCHIVE.md` §7** — the guest/authenticated/onboarding
navigation gate logic, the 6-step `OnboardingScreen` wizard (exact copy for
every step), the password-rule checklist (6 rules incl. a common-password
blocklist — raw list in `docs/rn-reference/passwordStrength.js`), the
rate-limiting/lockout math (raw logic in `docs/rn-reference/rateLimit.js` —
note the lockout-copy-vs-actual-math mismatch flagged in the archive),
`LockScreen`'s biometric-only (no PIN fallback) design, and the exact
`DEFAULT_USER_DATA`/`signUp()` Firestore write shape.
- [ ] Android combines these into `AuthScreen.kt`; RN keeps them as separate
      files (with `OnboardingSignUpScreen.js` as a second sign-up variant used
      specifically at the end of onboarding, not a duplicate of `SignUpScreen.js`
      — see archive §7 for exactly when each is used). Confirm no RN copy/
      validation/social-login option was dropped in the Android merge.
- [ ] Resolve the double ForgotPassword implementation (standalone screen vs.
      dialog) noted in the mapping table.
- [ ] Decide whether to replicate RN's SecureStore-plaintext-password biometric
      convenience login (a real security smell flagged in the archive) or do it
      properly on Android (e.g. Android Keystore-backed credential, no plaintext
      password at rest).

### 8. Spot-checks (small gaps, quick pass)
Full spec for the four RN-side ones already researched: **`RN_SOURCE_ARCHIVE.md`
§8** (CreateClubScreen, UserListScreen, TipDetailScreen, CustomerCenterScreen —
confirmed trivial, just a `RevenueCatUI.CustomerCenter` wrapper). SettingsScreen
is covered in archive §6a. HelpCenterScreen in §6c. AchievementsScreen in §3.
- [ ] Line counts are already close for all of these; a single side-by-side
      read (of the archive, not live RN source) + emulator screenshot per
      screen should be enough to confirm parity or find small gaps.

### 9. Remaining GamificationScreen function bug
Full fix recipe: **`RN_SOURCE_ARCHIVE.md` §9** — the exact formulas
(`earnedXp = floor(distanceKm*100 + durationMinutes*2)`,
`earnedCoins = floor(distanceKm*10)`), the client-side Pro ×2 coin bonus, and
an explicit list of what NOT to build (level-up, streak bonuses, pace/time
coin bonuses — all confirmed dead/unimplemented in RN itself, so building them
on Android would be inventing new product behavior, not porting).
- [ ] Fix `awardRunXP` call (see Known Backend Bugs) by switching to the real
      `saveRunActivity` Cloud Function with the payload shape documented in
      archive §9, while auditing whichever screen surfaces XP awarding (likely
      `GamificationScreen.kt` and/or `SaveActivityScreen.kt`'s post-save flow).
