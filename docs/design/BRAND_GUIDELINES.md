# Ruvo Brand Guidelines

*Maintained by Design. Source of truth for anything a designer, engineer, or
partner needs to know about how Ruvo looks, moves, and talks.*

*This document describes the system as it actually exists in the codebase
today (`android/app/src/main/java/com/ruvo/app/designsystem/`,
`ios/Sources/RuvoiOS/Core/DesignSystem/RuvoTheme.swift`). Every value below is
traceable to a real token. Where the codebase itself disagrees with the
system — and in a couple of places it does — that's called out explicitly
rather than papered over, because the fix is "converge on the token," not
"pretend the drift doesn't exist."*

---

## 1. Brand essence

Ruvo is a running app for people who already run, or are about to start
seriously — not a lifestyle-brand accessory. Everything in the product is
built to get out of the way at 6am and light up at the finish. The interface
is a near-black canvas (`#050505`) with one loud color on it — a lime that
appears nowhere else in the palette and is spent deliberately, on the thing
that matters: your primary action, your PR, your streak. That restraint *is*
the brand. A screen that puts lime on ten things has diluted the one thing
lime is supposed to mean: *this is the move.*

The product's own copy makes the same argument in words. Onboarding doesn't
ask "What's your fitness journey?" — it asks **"What's your goal?"** and
**"Your fitness level?"**, then adds **"Be honest — we'll calibrate from
there"** and **"Be honest — we'll calibrate intensity for you."** That's the
whole voice in one line: direct, a little blunt, respecting the runner enough
not to cushion the question. The reward copy ("**Solid rhythm! You're
building real endurance.**") is earned praise, not generic hype — it names
the specific thing you did. Ruvo talks to you the way a good coach does: says
the real thing, keeps it short, saves the enthusiasm for when you've
earned it.

Motion follows the same logic. Nothing bounces unless you actually did
something worth celebrating. The default spring is critically damped —
it arrives and stops, no wobble — because confidence doesn't overshoot.
Bounce is a reward, spent as deliberately as lime.

Put together: **Ruvo is quiet until it isn't.** Near-black, restrained,
direct — until your effort earns the lime, the bounce, or the "Solid
rhythm!"

---

## 2. Logo / wordmark

### The real treatment

The wordmark in production, on both platforms, is the literal string
**"RUVO"** (all caps, no tagline) set in **Poppins Black, 48pt** —
`RuvoTheme.Typography.displayLarge` / Compose `displayLarge` — colored the
brand's primary lime, centered on the `#050505` background. This is what
renders on the loading/splash state on both platforms today:

- **iOS** (`RootView.swift`, `SplashView`): an 80×80pt `ruvo-logo` mark
  stacked above the "RUVO" wordmark, both centered, 16pt apart, on
  `Colors.background`.
- **Android** (`RuvoApp.kt`, `SplashScreen()`): the wordmark alone —
  `Text("RUVO", style = displayLarge, color = RuvoColors.lime)` — no icon
  mark above it.

That's a real, minor lockup gap between platforms (icon+wordmark vs.
wordmark-only) worth closing eventually, but the wordmark treatment itself —
weight, case, color, face — already matches exactly. Treat **Poppins Black,
lime-on-near-black, all caps "RUVO"** as the canonical wordmark; the icon
mark is an optional companion element for use above/beside it, never a
replacement for it.

### Usage rules

- **Color**: the wordmark is lime (`#DFFF00`) on dark, or white/`textPrimary`
  on dark when lime is already spoken for elsewhere on the same screen (e.g.
  a lime CTA directly below it). It is **never** recolored to a secondary
  palette color (teal, purple, orange) — those are functional/semantic, not
  brand colors, and putting the wordmark in one reads as a mistake, not a
  variant.
- **Backgrounds**: the wordmark is built for `#050505` / `Surface`
  (`#111111`). On a photo or video background (as used on the Welcome/Landing
  hero), it must sit inside the same graduated scrim used for headline text
  (see §6) — never directly on unscrimmed imagery, where lime-on-photo
  contrast is uncontrolled and platform-dependent.
- **Minimum clear space**: keep clear space around the wordmark at least
  equal to the cap-height of the "R" (i.e., at 48pt Poppins Black, roughly
  36–40px of clear space on every side). Don't crowd it against nav chrome,
  status bars, or other text.
- **Don't**: stretch, skew, add a drop shadow or outline, set it in any
  weight other than Black, lowercase it, or pair it with a tagline baked into
  the same lockup. If a tagline is ever needed, it's a separate text element
  below the mark, not part of it.

---

## 3. Color system

The palette is defined once per platform and consumed everywhere as named
roles — `Theme.kt`'s `RuvoColors` object on Android, `RuvoTheme.Colors` on
iOS. They are pixel-identical across platforms:

| Role | Hex | Notes |
|---|---|---|
| **Primary (lime)** | `#DFFF00` | The one brand color. CTAs, active states, key stats, the wordmark. Spent deliberately — see §1. |
| Primary dim | `#DFFF00` @ 15–24% alpha | Android: `LimeDim` = `0x26DFFF00` (~15%). iOS: `primaryDim` = 15% opacity. Used for subtle fills/glows behind lime content, e.g. `AchievementCard`'s glow gradient. |
| **Background** | `#050505` | Near-black, not pure black — the whole app lives on this. |
| Surface | `#111111` | Card / sheet base. |
| Surface elevated | `#1A1A1A` | Raised chrome above `Surface` (modals, elevated cards). |
| Border | `#222222` | Hairlines, dividers, card outlines. |
| Border (active) | `#DFFF00` @ 40% | iOS-only token for a focused/selected border — an alpha step of primary, not a new color. |
| Text primary | `#FFFFFF` | Headlines, primary body copy. |
| Text secondary | `#A1A1AA` | Supporting copy, subtitles. |
| Text tertiary | `#7A7A85` | Least prominent text — see WCAG note below. |
| Heart-rate red | `#EF4444` | Semantic: HR data/zones. Doubles as the `error` role. |
| VO2 orange | `#EA580C` | Semantic: VO2 max / effort metrics. |
| Teal | `#2DD4BF` | Semantic: secondary data series (Compose `secondary`). |
| Purple | `#A855F7` | Semantic: tertiary data series (Compose `tertiary`). |
| Success | `#22C55E` | Confirmations, positive deltas. |
| Warning | `#F59E0B` | Caution states. |
| Error | `#EF4444` | Same value as heart-rate red — intentionally shared, not a coincidence to "fix." |

### The contrast rule — and a worked example

Every text color is required to hit **WCAG AA, 4.5:1 minimum**, against the
surface it's actually used on. This isn't a nice-to-have appended after the
fact — it already forced a real correction this session:

> `textTertiary` was originally `#52525B`. Checked against `#050505`
> background, that resolves to roughly **3.2:1** — a fail. It was corrected
> to **`#7A7A85`**, which the code comments now document inline on both
> platforms as landing at **~4.8:1**, comfortably over the 4.5:1 floor.

That's the rule in action: when a token is added or a designer wants a
slightly dimmer gray for some "quiet" piece of UI, the obligation isn't
"does it look dim enough" — it's "run the contrast math against the surface
it sits on, and if it's under 4.5:1 for body text, it doesn't ship as-is."
`textTertiary` at `#7A7A85` is the reference point for how dim text is
allowed to get.

### Rules

- Semantic colors (`heartRed`, `vo2Orange`, `teal`, `purple`, `success`,
  `warning`, `error`) mean one specific thing each. Don't repurpose teal for
  a random accent because it "looks nice here" — if a screen needs an
  accent, that's either lime (if it's the primary action) or a text-tier
  gray (if it isn't).
- Never hardcode a hex that already has a named token. If you find yourself
  typing `Color(0xFFDFFF00)` or `Color(hex: "#DFFF00")` outside
  `Theme.kt`/`RuvoTheme.swift`, use `RuvoColors.lime` /
  `RuvoTheme.Colors.primary` instead — a hardcoded literal is exactly how a
  palette drifts (see the Welcome-screen note in §6).
- New text colors must clear 4.5:1 against every surface they're actually
  composited on before they're accepted, the same way `textTertiary` was
  corrected.

---

## 4. Typography system

**Poppins** end to end (Black / Bold / SemiBold / Medium / Regular), bundled
as real OFL-licensed font files on both platforms
(`android/app/src/main/res/font/`,
`ios/Sources/RuvoiOS/Resources/Fonts/` + `OFL.txt`). One face, five weights,
no fallback font used anywhere in the product surface.

### Type scale (Android `Typography.kt` / iOS `RuvoTheme.Typography`)

| Style | Weight | Size | Line height | Tracking |
|---|---|---|---|---|
| Display large | Black | 48sp/pt | 52sp (Android) | **−1.0** |
| Display medium | Black | 36sp/pt | 40sp (Android) | **−0.5 / −0.6** |
| Heading large | Bold | 28sp/pt | 34sp (Android) | **−0.4** |
| Heading medium | Bold | 22sp/pt | 28sp (Android) | **−0.3** |
| Heading small | Bold | 18sp/pt | 24sp (Android) | **−0.2** |
| Title large *(Android only)* | SemiBold | 20sp | 28sp | −0.2 |
| Title medium *(Android only)* | SemiBold | 16sp | 24sp | −0.1 |
| Body large | Medium (iOS) / Regular (Android) | 16sp/pt | 24sp (Android) | **0** |
| Body medium | Regular | 14sp/pt | 20sp (Android) | **0** |
| Body small | Regular | 12sp/pt | 16sp (Android) | **0** |
| Label large | SemiBold | 14sp/pt | — | **+0.1** |
| Label medium | SemiBold | 12sp/pt | — | **+0.2 / +0.5** |
| Label small | SemiBold (iOS) / Bold (Android) | 11–10sp/pt | — | **+0.4 / +1.5** |
| Stat number *(iOS)* | Black | 40pt | — | **−0.8** |
| Caption *(iOS)* | Bold | 10pt | — | **+2.0** |

*(Android and iOS values match to within rounding at every shared tier;
where they diverge slightly — e.g. label-small tracking, `+0.4` on iOS vs.
`+1.5` on Android — treat iOS's `Typography.Tracking` enum as the reference
and bring the other platform in line rather than adding a third value.)*

### The tracking rule, as a felt quality

Tracking isn't decorative — it's doing real optical-correction work, and the
pattern is consistent: **the bigger and heavier the text, the tighter it
gets; the smaller and lighter it gets, the more it opens up.** Poppins Black
at 48pt has enough weight and size that its letterforms start to feel loose
at zero tracking, so display text is pulled in as far as −1.0. Body text sits
at exactly 0 — no correction needed at 14–16pt Regular. Labels and captions
(SemiBold/Bold at 10–14pt, often all-caps or near it) get opened up instead,
up to +2.0 on iOS's `caption` style — small bold text needs breathing room or
it clumps.

Practically: if you're introducing a new display-weight style, start
tighter than body, not looser. If you're introducing a new small-label
style, start looser than body, not tighter. Zero tracking is correct only in
the body range.

### Weight usage

- **Black**: display sizes and the splash wordmark only. It's the loudest
  weight in the system — reserve it for the one or two things per screen
  that should read as "biggest idea here" (a stat number, a headline, the
  wordmark).
- **Bold**: headings, CTA labels, achievement titles.
- **SemiBold**: titles, labels, buttons that aren't the primary CTA.
- **Medium / Regular**: everything else — body copy, subcopy, descriptions.

---

## 5. Motion & interaction language

Motion tokens live in `Motion.kt` (Android, `RuvoMotion`) and `RuvoTheme.swift`'s
`Motion` enum (iOS) — deliberately mirrored 1:1 across platforms so a
duration or curve means the same thing regardless of which app you're
looking at.

### Duration tiers (named by intent, not just a number)

| Name | Android (ms) | iOS (s) | Use |
|---|---|---|---|
| `instant` | 120 | 0.12 | Micro-feedback (press states) |
| `quick` | 160 | 0.16 | Button press-scale, small toggles |
| `standard` | 220 | 0.22 | Default for most transitions |
| `entrance` | 320 | 0.32 | Content appearing, wizard step transitions |
| `modal` | 400 | 0.40 | Sheets, dialogs |
| `screenEntrance` | 520 | 0.52 | Full-screen staggered reveals (Welcome/Landing) |

Stagger step between successive items in an entrance sequence: **60ms**
(Android `staggerStepMillis`) / **60ms** (iOS `staggerStep = 0.06`).

### The two curves

- **EaseOut** (`cubic-bezier(0.23, 1, 0.32, 1)`) — fast start, gentle
  settle. The default for anything **appearing or moving into place**: a
  card entering, a headline sliding up, a step transition arriving.
- **EaseInOut** (`cubic-bezier(0.77, 0, 0.175, 1)`) — symmetric
  acceleration. For things moving **between two fixed, already-visible
  states** — not an entrance, a transition.

These are the *only* two named easings in the system. A new
`.timingCurve(...)` or `CubicBezierEasing(...)` literal written inline in a
screen file is, by definition, an unauthorized third curve — both platforms'
source comments say this explicitly: *"a parallel, private curve per screen
is how motion stops feeling like one product."*

### Springs — and the "bounce is earned" rule

The default spring on both platforms is **critically damped**
(`dampingRatio = 1f` / `bounce: 0` — `springSettled`): it arrives at its
target and stops, with no overshoot. That's the correct default for
*routine* UI motion — a sheet opening, a value updating, a selection
changing. It reads as controlled and confident, not springy.

A **bouncy** variant exists (`dampingRatio = 0.65f` / `bounce: 0.2` —
`springBouncy`), and it is reserved for exactly two situations, matching how
it's actually used in the codebase today:

1. **Gesture-driven motion** — something the user is physically dragging or
   releasing, where a little overshoot reads as physical/responsive rather
   than as decoration.
2. **Celebratory moments** — `AchievementOverlay`'s unlock card uses a
   medium-bounce spring (`Spring.DampingRatioMediumBouncy`) specifically
   because it's a reward, not routine chrome.

The brand rule this expresses: **confidence doesn't overshoot; only a win
does.** If a bounce shows up on a settings toggle or a tab switch, that's a
tell something's off-brand, not a stylistic choice.

---

## 6. Iconography & imagery

### Material / SF Symbols vs. emoji — a hard split, not a style choice

Functional and informational iconography — navigation, settings, status,
anything that's *telling you what something is or does* — is **Material
Icons on Android, SF Symbols on iOS**. Full stop. `PrivacyControlsScreen`'s
empty states (`Icons.Default.Shield`, `Icons.Default.VolumeOff`) are the
right pattern: a system icon paired with plain text.

**Emoji are reserved for reward and celebration** — streaks, achievements,
unlocked badges — matching `AchievementOverlay.kt`'s established pattern:
the "🏆 Achievement Unlocked!" badge, the trophy emoji tied to
`AchievementData.emoji`, the "🪙 +N coins" line. Emoji there work precisely
*because* they're rare and tied to a specific win — the same "spent
deliberately" logic as lime and bounce.

*Known exception worth naming rather than hiding:* a few list empty-states
(`CommunityScreen.kt`'s Feed/Clubs/Challenges/Leaderboard/Routes tabs)
currently use an emoji as the empty-state glyph (🏃, 👥, 🏆, 📊, 🗺️) for a
plain "nothing here yet" message — that's an informational empty state, not
a celebration, so by this rule it should be a Material icon, the way
`PrivacyControlsScreen` does it. Flagged here as a cleanup item, not a second
allowed pattern — don't point to `CommunityScreen` as precedent for using
emoji functionally.

### Photography / video direction

The hero treatment on both Welcome/Landing screens (`WelcomeScreen.swift`,
Android `LandingScreen` in `AuthScreen.kt`) is a **motion-blurred, muted,
looping video of a runner in motion** (`bg_welcome`) — not a posed hero shot,
not stock-photo running-on-a-treadmill-smiling-at-camera. Grounded,
documentary, mid-stride. The direction is: this could be a clip from
someone's own run, not an ad.

Every use of this treatment sits under a **graduated dark scrim toward the
bottom**, so headline/CTA text stays legible regardless of what's happening
in the frame underneath. The real gradient stops (iOS `WelcomeScreen`):
background-color stops at 55% → 5% → 10% → 88% → 100% opacity from top to
bottom — i.e. it's lightest through the middle of the frame (where the
runner is) and darkens sharply in the bottom third, exactly where the
headline/CTA content sits. Android's `LandingScreen` uses the same shape with
a simpler 4-stop vertical gradient (transparent → 35% → 85% → 100%). Any new
full-bleed photo/video treatment should scrim the same way: **protect the
bottom third for text, don't flatten the middle of the frame.**

*Note for anyone extending this:* `WelcomeScreen.swift` defines its own
private `Ruvo` color enum with a slightly different lime/background
(`#D7FF3B`/`#07090A`) than the shared `RuvoTheme.Colors`
(`#DFFF00`/`#050505`) — the Android port's own code comment calls this out
directly ("brand colors come from RuvoColors... rather than copying the iOS
file's slightly different placeholder shade"). This is real, current drift,
not a deliberate variant — it should converge on `RuvoTheme.Colors`, and it's
cited here as the canonical example of why §3's "never hardcode a hex that
already has a token" rule exists.

### Materials — the "premium" surface

Elevated/floating chrome (cards, tab bars, sheets) uses a **glass** surface
token: real `.ultraThinMaterial` on iOS (`RuvoTheme.Colors.glassSurface`),
and a semi-transparent tint approximation on Android
(`RuvoColors.glassSurface` = `SurfaceElev` at 72% alpha), documented in the
Android source as a deliberate stand-in until a real backdrop-blur pipeline
is available at the app's minSdk. This translucent layering over the
near-black background is part of what makes the UI read as premium rather
than flat — use `glassSurface` for anything that should feel like it's
floating above content (nav chrome, overlays), and treat the Android
alpha-blend as a faithful placeholder for the same effect, not a different
design.

---

## 7. Voice & tone

Ruvo's voice, from real in-product copy:

- Onboarding: **"What's your goal?"** / **"We'll personalize your training
  plan."** / **"Your fitness level?"** / **"Be honest — we'll calibrate from
  there."**
- Post-log encouragement, scaled to what you actually reported: **"Perfect!
  We'll start from the beginning."** → **"Solid rhythm! You're building real
  endurance."** → **"Whoa, you're practically a pro already!"**
- The primary CTA: **"Start Journey"** (not "Get Started," not "Sign Up Now"
  — a word that implies a path, matching the running metaphor without
  overplaying it).
- Errors, when something breaks: **"Something went wrong. Please try
  again."** / **"We couldn't find an account with that email."** / **"We
  couldn't get a GPS fix. Make sure location services are on and you have a
  clear view of the sky, then try again."**
- Empty states: **"No runs yet — start your first run!"** / **"No runs yet.
  Log a run, or follow other runners to see theirs here!"**

The pattern across all of it: short sentences, plain words, "we" language on
errors (never blaming the user or hiding behind passive voice), and specific
rather than generic ("clear view of the sky," not "a network error
occurred"). Encouragement is calibrated to the actual input, not maximally
enthusiastic by default — the copy scales its excitement to what you
actually did.

### Do / don't

| Do | Don't |
|---|---|
| "What's your goal?" | "Let's set up your amazing fitness journey together!" |
| "Be honest — we'll calibrate from there." | "Tell us about yourself!" |
| "Solid rhythm! You're building real endurance." (tier-appropriate) | "AMAZING JOB CHAMPION!!!" for every single run regardless of effort |
| "We couldn't get a GPS fix. Make sure location services are on..." | "GPS Error: Code 4001" |
| "No runs yet — start your first run!" | "Oops! Nothing to see here :(" |
| "Start Journey" | "Get Started Now!" |

---

## 8. Do / don't summary — the working checklist

Use this before shipping anything that touches visual or motion design:

**Color**
- [ ] Don't hardcode a hex that already has a named token (`RuvoColors.*` /
  `RuvoTheme.Colors.*`) — that's how palettes drift (see §6's Welcome-screen
  note).
- [ ] Any new text color must clear **4.5:1** against the surface it's
  composited on (the `textTertiary` fix in §3 is the reference case).
- [ ] Don't repurpose a semantic color (teal/purple/orange/red) as a generic
  accent — each one means a specific data type.
- [ ] Lime is spent on the primary action or the standout stat, not sprinkled
  as decoration.

**Typography**
- [ ] Don't introduce a new type style outside the documented scale in §4
  without a real layout reason.
- [ ] Bigger/heavier text tightens tracking; smaller/lighter text opens it
  up. Body stays at 0. Don't invent a tracking value outside that gradient.
- [ ] Black weight is for display sizes and the wordmark — not body copy,
  not every heading.

**Motion**
- [ ] Don't write a new easing curve inline — use `EaseOut`/`EaseInOut` (or
  their iOS equivalents). There are only two.
- [ ] Default spring is critically damped (no bounce). Bounce is reserved for
  gesture-driven motion and celebratory moments (achievements, rewards) —
  not routine chrome.
- [ ] Use the named duration tiers (`instant` → `screenEntrance`); don't pick
  an arbitrary millisecond value.

**Icons & imagery**
- [ ] Functional/informational icons: Material Icons (Android) / SF Symbols
  (iOS). Emoji: reward and celebration only. If you're using an emoji for an
  empty state or a nav icon, that's the pattern to fix, not follow (see
  §6's `CommunityScreen` note).
- [ ] New photo/video hero treatments get a bottom-weighted dark scrim, in
  the shape of §6's gradient stops — don't rely on unscrimmed contrast.
- [ ] Use `glassSurface` for floating/elevated chrome rather than a one-off
  translucent tint.

**Voice**
- [ ] Short sentences, plain words, specific over generic.
- [ ] Scale encouragement to what the user actually did — don't max out
  enthusiasm by default.
- [ ] Errors use "we," and say what actually happened — never a raw error
  code or a blame-the-user tone.

**Logo**
- [ ] Wordmark is always Poppins Black, all-caps "RUVO," lime or white on
  dark. Never recolored into a secondary palette color, never restyled in
  another weight.
- [ ] Never place the wordmark on unscrimmed photography.
