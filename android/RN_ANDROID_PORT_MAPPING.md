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
| `gamification/GamificationViewModel.kt` | `awardRunXP` | **No** (RN doesn't call this either — the real client→function→Firestore flow, exact XP/coin formulas, and why level-up/streak-bonus logic is dead code in RN itself, are fully documented in `docs/rn-reference/RN_SOURCE_ARCHIVE.md` §9 "Gamification / XP system") | Open |
| `runtracking/*` (if it calls `startLiveRun`/`endLiveRun` for live-run tokens) | — | **No** — RN itself calls these and they don't exist | Open, low priority — likely dead/untested in RN too |
| Auth screens, if they call `sendPasswordResetLink`/`notifyLoginFailure` | — | **No** — RN itself calls these | Open, low priority |
| AI workout suggestion (`fetchAIWorkoutSuggestion` equivalent, if any) | `generateWorkoutSuggestion` | **No** — RN itself calls this | Open, low priority |
| Oura/Whoop sync (if Android calls a sync function directly instead of the SDKs) | `syncOuraData`/`syncWhoopData` | **No** — RN itself calls these | Open, low priority |

When picking up any screen with a `functions.getHttpsCallable(...)` call, first
check RN's equivalent by grepping `docs/rn-reference/UserContext.js` (and the
other preserved `.js` files) for `httpsCallable` — don't assume RN's target
function exists just because RN calls it.

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
| ActiveRunScreen.js | 959 | `features/runtracking/RunTrackingScreen.kt` + `RunTrackingViewModel.kt` + `RunTrackingService.kt` | 436+205+225 | 🟡 | Live GPS tracking screen — hardest to verify live (needs emulator GPS mocking). Not yet compared. |
| PlanScreen.js | 1263 | `features/training/TrainingPlanScreen.kt` | 431 | 🟡 | Fixed schema + ported the real plan algorithm and status toggles (commit `d5ccfef`) — but RN's Habits heatmap subsystem, day-by-day calendar, and workout-start-navigation are still not ported (still a real gap, kept 🟡). |
| ProfileScreen.js | 1703 | `features/profile/ProfileScreen.kt` + `ProfileViewModel.kt` | 393 + 138 | 🟡 | Fixed follow/unfollow (systemic, 3 files) + avatar/location/bio field bugs (commit `7d36f08`). Still missing most of RN's ~15 sub-features (avatar upload, weekly strip, XP bar, gear card, country picker, streak, challenges, badges, dated activity list, saved tips) — kept 🟡, see Roadmap. |
| SaveActivityScreen.js | 1180 | `features/runtracking/SaveActivityScreen.kt` | 307 | 🟡 | Partially touched this session (gear picker added). Not fully compared otherwise. |
| RunDetailScreen.js | 730 | `features/runtracking/RunDetailScreen.kt` | 251 | 🟡 | Not yet compared. |
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

### 1. TrainingPlanScreen follow-up: Habits subsystem + weekly calendar
The schema/algorithm/status-toggle fix is done (see Completed Work Log). Full
spec for what's left: **`RN_SOURCE_ARCHIVE.md` §10 "TrainingPlanScreen — Habits
subsystem"** — exact Firestore shape (`users/{uid}/habits/{id}`:
`name/description/frequency/icon/completions[]/createdAt`), the
month/week/total stat calculations, the 7×16 heatmap cell-indexing formula,
and the Add-Habit modal's exact fields (12-icon picker list, 1-7 frequency
chips). Still to build:
- [ ] Habits heatmap tracker (CRUD + derived stats + the heatmap grid — a
      Compose `Canvas`/`LazyVerticalGrid` equivalent of the RN 7×16 grid).
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
- [ ] Work through the 15 sub-tasks listed at the end of archive §1.
- [ ] This one is hardest to verify live — plan to mock GPS via `adb emu geo fix`
      or the emulator's Extended Controls location panel rather than skipping
      verification entirely.
- [ ] Deliberate product decision needed (not a port, since RN doesn't have it):
      crash/kill recovery for a run in progress — RN has zero mechanism for this
      despite having an unused `activeRunData` context slot that hints one was
      intended.

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
