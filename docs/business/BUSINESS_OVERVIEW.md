# Ruvo — Business Overview

*Written from the actual codebase (native-rewrite branch), not from a pitch deck. Every claim below cites the file it comes from. Where the two platforms disagree, I say so plainly rather than describing an idealized single product.*

---

## 1. What Ruvo actually is

Ruvo is a run-tracking app with three things bolted on top of the core GPS-run loop: a coin/XP engagement economy, a social layer (feed, clubs, chat, segments, leaderboards), and a paid analytics/coaching tier. It is not "a running app for everyone" — it's specifically a **data-and-social layer over running**, aimed at people who want more than a stopwatch and a map.

The core loop, grounded in the data model (`android/app/src/main/java/com/ruvo/app/core/model/Models.kt`):
- `RunRecord` captures distance, duration, pace, calories, elevation gain, per-lap splits, full GPS route (with per-point elapsed time — added specifically so segment efforts can be computed later), and average heart rate.
- `RuvoUser` carries XP, coins, level, streak days, total distance/runs, a running goal, a fitness level, and follower/following counts — i.e., the profile is explicitly gamified and social from the schema up, not just a settings bag.
- Every finished run is saved through one server-validated path, the `saveRunActivity` Cloud Function (`functions/index.js`), which now enforces real plausibility bounds (max 200km, max 24h, min pace ~2.5 min/km) after a prior version had zero server-side checks — see the "SECURITY AUDIT" comment block at the top of `firestore.rules`. This tells you the business has already been burned by (or pre-emptively closed) the obvious "forge a run, mint free XP/coins" exploit — a sign coins/XP are treated as a real asset worth protecting, not a cosmetic afterthought.

On top of that loop sits a free social/gamification layer (clubs, feed, segments, leaderboards, achievements, rewards, referrals) and a paid layer (`PaywallScreen.kt` / `PaywallView.swift`) gating AI coaching, advanced physiological analytics, and 2x coin earning.

## 2. Who it's for

Onboarding asks exactly two questions that define the target user (`OnboardingOptions.kt`, shared verbatim between onboarding and profile editing so the two can't drift):

- **Goal**: Stay Healthy, Run 5K, Run 10K, Half Marathon, Full Marathon, Lose Weight.
- **Fitness level**: Beginner ("just starting out") → Intermediate (1-3x/week) → Advanced (4+/week) → Elite ("competitive runner").

That's a wide net at signup — casual health-motivated joggers through competitive racers all land in the same onboarding funnel. The free/paid split is where the product actually decides who it's building for: the free tier is the complete tracking + social + gamification loop (this is real, not a stripped demo — clubs, feed, chat, segments, challenges, leaderboards, rewards redemption all work unauthenticated by Pro status). What's paywalled is specifically the *data-driven athlete* layer: VO2 Max, Race Predictor, PRs, training load, and full AI coaching (`PAYWALL_FEATURES` in `PaywallScreen.kt`; `PaywallFeature.allFeatures` in `PaywallView.swift`).

So the real target-user story implied by the code is a **funnel from "anyone who wants to run more" to "the subset who start caring about VO2 Max and training load."** Beginners are onboarded and retained for free (streaks, coins, social pressure via clubs/leaderboards); the upsell moment is when a runner's ambition outgrows "did I run today" and becomes "how is my fitness actually trending."

One concrete, easy-to-miss data point: the Rewards catalog (`RewardsScreen.kt`) is hardcoded to Lebanese brand partners — Nike Lebanon, Adidas Lebanon, Decathlon Lebanon, Beirut Marathon, Starbucks Lebanon — and the leaderboard's country-flag mapping (`LeaderboardViewModel.kt`) special-cases Lebanon first in its lookup table. This strongly suggests Ruvo's actual go-to-market is (or started as) Lebanon/MENA-focused, not a generic global launch — worth confirming explicitly with product/marketing, since nothing else in the app (onboarding copy, unit defaults) advertises this, but the reward economy — the thing that requires real commercial partnerships to exist at all — is unambiguously localized.

## 3. How it makes money

**Primary: Ruvo Pro subscription**, sold via RevenueCat on both platforms (`Purchases.shared.offerings()` / `com.revenuecat.purchases.Purchases`). Both paywalls offer annual (marketed as the default/best-value choice, "SAVE 33%" on Android / "Save 60%" on iOS — the two platforms don't even agree on the discount framing) and monthly packages; iOS's copy also mentions a free-trial framing ("Start Free Trial") that Android's paywall doesn't surface at all — another small but real cross-platform inconsistency in the actual monetization pitch.

What's behind the paywall, consistently on both platforms:
- Advanced Analytics (VO2 Max, Race Predictor, PRs, training load / ACWR)
- Full AI Coach access (Android explicitly gates free-form chat — `AICoachViewModel.send()` checks `!_uiState.value.isPro && !isQuickAction` and blocks with a Pro prompt; the 4 canned "Quick Actions" — Analyze Last Run, Generate Plan, Recovery Check, Fueling Tips — are free hooks into the same backend)
- 2x coins/XP per run

**Secondary surface worth flagging: the coin economy is not currently a monetization channel — coins cannot be bought with real money anywhere in the codebase** (no purchase-coins / coin-pack flow found in either client). Coins are earned only (runs, referrals — 100 coins each side per `ReferralScreen.kt` — and a Pro-only 2x multiplier) and spent only on the `RewardsScreen.kt` catalog, which is redeemed server-side via the `redeemReward` Cloud Function inside a Firestore transaction (real anti-cheat: balance check + atomic deduction + immutable redemption record, plus a root/jailbreak lockout via `SecurityManager.isRooted`).

One reward item is worth calling out directly: **"Free Premium Month" costs 5,000 coins and grants a month of Ruvo Pro** (`REWARD_CATALOG` item #6 in `RewardsScreen.kt`). This means the free engagement loop has a real, if indirect, path to bypassing the subscription entirely for highly engaged users — not a bug, clearly intentional copy ("Unlock one month of RUVO PRO"), but it is a genuine tension with subscription revenue that the business should have an explicit view on (see Open Questions).

## 4. Moat / differentiation

Individually, none of Ruvo's pieces are novel — GPS run tracking, streaks/XP, a social feed, wearable sync, and an AI chat coach all exist elsewhere. The differentiation claim has to be about the *combination*, and the combination that's actually implemented is a fairly specific bet:

- **Real third-party health-data integrations, not just HealthKit/Health Connect passthrough.** `HealthIntegrationsScreen.kt` and `HealthService.swift` both wire up Oura Ring (readiness, sleep score, HRV) and WHOOP (recovery, strain, sleep stages) as first-class connected services alongside the platform-native store (Health Connect on Android, HealthKit on iOS). That's a real product bet that a meaningful slice of the target user already owns one of these devices — a materially different assumption than a generic Strava-style tracker makes.
- **A coin economy backed by real, geography-specific brand partnerships** (see §2) rather than a purely cosmetic points system — this is a genuine differentiator versus most run-trackers' badge-only gamification, though it's also a business liability if those partnerships don't scale past the current market.
- **An AI coach that can actually act, not just chat.** `AICoachViewModel.kt`'s Gemini integration (via the `askGemini` proxy Cloud Function, `functions/index.js`) uses real function-calling (`ADJUST_PLAN_TOOLS`) scoped to two safe, reversible actions — `rest_today` and `ease_this_week` — that directly mutate the user's live training plan. This is a step beyond "chatbot that gives generic advice"; it's a coach that can touch the product's own state. Android also backs this with a standing, non-chat adaptive nudge (`AdaptivePlan.kt`): the plan screen itself notices 2+ missed sessions in a week and proactively offers to ease the schedule, using the exact same `easeWorkouts()` function the chat path uses, so the two surfaces can't disagree.
- **Segments** (Android only — `features/segments/`, referenced in `firestore.rules`' `/segments/{segmentId}/efforts/{effortUid}` rule): Strava-style "who's run this stretch of road fastest" competition, computed from the per-point `elapsedSeconds` field explicitly added to `RoutePoint` for this purpose.

What's *not* distinctive: the streak/level/badge mechanics, the club/feed social layer, and the paywalled analytics metrics themselves (VO2 Max, training load/ACWR, race prediction) are now table stakes among serious run-tracking apps. The real moat, if there is one, is the combination of (a) third-party recovery-data integrations, (b) an agentic coach that edits your plan instead of just describing changes, and (c) a coin economy tied to real local commerce — not any single piece.

## 5. Where the platforms disagree (a real business risk, not a style nitpick)

This is the section most worth the CEO's direct attention: **Android and iOS are currently different products wearing the same visual skin**, and the gap is bigger than typical platform lag.

**Gamification suite — Android has it, iOS doesn't.** Android ships standalone `AchievementsScreen`, `LeaderboardScreen` (Friends/Country/Global × Weekly/All-Time), `RewardsScreen` + `MyRedemptionsScreen`, and `ReferralScreen` — each independently wired to real Firestore data and (for rewards) the real `redeemReward` Cloud Function. iOS has exactly one file, `GamificationView.swift`, which bundles a level card, streak banner, coin balance, a small achievements grid, and a "Rewards Shop" sheet — and that Rewards Shop's `rewards: [Reward] = []` array is never populated from anywhere in the file (no Firestore read, no catalog constant — it will render permanently empty). iOS has no leaderboard and no referral screen at all. Worth knowing: Android itself had a redundant `GamificationScreen.kt` that was deleted as confirmed-dead code (zero navigation call sites) because its functionality was already covered by the standalone screens — so "one unified gamification hub" was tried and abandoned as an information architecture on Android already; iOS's single `GamificationView` is structurally the pattern Android moved away from.

**Training plan generation — the more surprising finding: both platforms are effectively deterministic, but only one admits it.** The task brief for this review described this as "different product bets" (iOS: AI-generated via Cloud Function; Android: deterministic generator). Reading the actual code shows something more concerning: **iOS's "Generate AI Plan" button calls a Cloud Function, `generateTrainingPlan`, that does not exist in the backend** (`functions/index.js` exports exactly `redeemReward`, `askGemini`, `deleteAccountData`, `saveRunActivity` — nothing else; confirmed independently by `android/RN_ANDROID_PORT_MAPPING.md`'s "Known Backend Bugs" table, which documents that neither the current backend nor the original React Native app ever called such a function). Worse, iOS's own fallback-parsing function doesn't even try to use a response if one came back:
```swift
private func parseFunctionPlan(data: [String: Any], id: String) -> TrainingPlan {
    // If the Function returns weeks array, parse it; otherwise fall back.
    buildDefaultPlan(id: id)
}
```
`parseFunctionPlan` ignores `data` entirely and always calls `buildDefaultPlan`. So iOS's "AI-generated training plan" is, today, cosmetic: it always silently produces the same kind of locally-computed progressive-distance plan Android produces deterministically — it just pays a network round-trip to a function that doesn't exist first, then falls back. Android, by contrast, is upfront that its plan generator (`generateWeekPlan` in `TrainingPlanScreen.kt`, ported faithfully from the original app's `UserContext.js`) is a deterministic rolling generator with three explicit modes — Active, Injured (0-5km recovery week), Vacation (2 short scenic runs) — plus the adaptive nudge system described above. Android's version is the more honest and more developed of the two; iOS's is presented to the user as AI-powered but currently is not.

**Settings/account depth.** Android's `SettingsScreen.kt` + `SettingsViewModel.kt` run to 539 + 185 lines covering notifications, units, password/account management, a real "Recalibrate AI" plan-regeneration flow, and a Firestore-backed About/help section. iOS's entire settings surface, `SettingsView.swift` (under `Features/Profile/`), is 74 lines. Whatever iOS's settings screen currently covers, it is a small fraction of Android's.

**Gear/equipment data model.** Android stores shoe mileage tracking as a `gearList` array field directly on the `users/{uid}` document — and `firestore.rules` explicitly names `gearList` as one of the fields the owner may freely update. iOS's `ShoeTrackerViewModel` (`ShoeTrackerView.swift`) instead reads/writes a `users/{uid}/shoes` **subcollection** — a path that has no matching `match` block anywhere in `firestore.rules`. Under Firestore's default-deny security model, any path with no matching rule is rejected. Taken at face value, this means iOS's shoe tracker is currently writing to a Firestore path the deployed security rules do not permit — i.e., a real, previously-undiscovered bug in the same class as the ones `RN_ANDROID_PORT_MAPPING.md` documents extensively for Android's own port history. This is worth an engineering ticket regardless of this document's purpose, but it's also a business signal: the security-rules audit that hardened `firestore.rules` (see §1) was clearly done against the Android client's call sites only — iOS wasn't in scope, and it shows.

**Segments** exist only on Android (no equivalent iOS feature directory or Firestore rule usage found).

**The plain business read:** if a user's experience of "what Ruvo is" depends heavily on which phone they own, that's a retention and brand-consistency risk, and it also raises the practical question of which platform is actually being treated as the reference implementation for product decisions going forward — right now, by depth and correctness, it's Android.

## 6. Open questions for the business

These are product/business decisions the code can tell you the *current default* for, but not the *intended* answer — worth deciding explicitly rather than leaving as an accident of whichever platform shipped a feature first:

1. **Is the coin/rewards economy meant to stay a pure retention mechanic, or become a real secondary revenue surface?** Today coins are earn-only (no purchase path exists in either client) and one redemption option (5,000 coins → a free Pro month) already creates a soft bypass around the subscription. Is that bypass intentional (a loyalty reward for the most engaged free users, who are unlikely Pro converts anyway) or an unpriced leak that should be capped, monitored, or removed?
2. **Is the AI Coach a Pro-exclusive feature or a free-tier hook?** Currently it's split down the middle by design (free-form chat is Pro-gated; 4 fixed quick actions are free) — worth confirming this is the intended acquisition funnel (free users get a taste, convert for full access) versus simply the state the last engineering pass left it in.
3. **Which platform is the source of truth for training-plan generation, and should iOS's "AI-generated plan" framing be fixed or made honest?** Right now iOS markets an AI-generated plan it doesn't deliver (see §5). That's a real user-trust and App Store-description risk independent of any engineering fix.
4. **Is Android's fuller gamification suite (Leaderboard, Referral, standalone Achievements/Rewards) the intended long-term feature set, or was it over-built relative to what iOS needs?** Someone should decide whether iOS is meant to catch up to Android's scope, or whether Android should be trimmed toward iOS's — "build iOS up" and "simplify Android" are very different roadmap investments, and nothing in the code signals which was intended.
5. **Is Lebanon/MENA the primary launch market, or an artifact of where the rewards catalog and test data happen to be seeded?** This materially changes marketing spend, localization priorities, and which wearable partnerships (Oura/WHOOP — both niche, higher-income-market devices) actually make sense to prioritize supporting well.
6. **What's the real ARPU story once Pro is the only monetization surface?** With no ads and no coin-purchase IAP anywhere in the code, subscription is 100% of monetization today. Worth confirming that's the deliberate strategy (versus, say, a planned-but-unbuilt ads or coin-pack revenue line) before treating Pro conversion as the only lever available.

---

*Sources consulted: `android/app/src/main/java/com/ruvo/app/features/paywall/PaywallScreen.kt`, `ios/Sources/RuvoiOS/Features/Paywall/PaywallView.swift`, `android/app/src/main/java/com/ruvo/app/core/model/Models.kt`, `android/app/src/main/java/com/ruvo/app/core/model/OnboardingOptions.kt`, `android/app/src/main/java/com/ruvo/app/features/{gamification,rewards,referral,leaderboard,achievements,healthintegrations,aicoach,training,gear}/*`, `ios/Sources/RuvoiOS/Features/{Gamification,HealthIntegrations,AICoach,Training,Gear,Profile}/*`, `functions/index.js`, `firestore.rules`, `android/RN_ANDROID_PORT_MAPPING.md`.*
