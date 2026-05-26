# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Mobile Development
```bash
npx expo start                    # Start dev server (Expo Go)
npx expo run:android              # Build and run on Android device/emulator
npx expo run:ios                  # Build and run on iOS simulator
npx expo start --web              # Start web build (used by E2E tests)
npx expo lint                     # ESLint via expo lint
```

### Testing
```bash
npx jest                                                    # Run all unit tests with coverage
npx jest src/services/__tests__/badgeService.test.js        # Run a single test file
npm run test:e2e                                            # Playwright E2E (requires web build running)
npm run test:e2e:headed                                     # E2E with browser visible
```
Unit tests use `babel-jest` directly (not `jest-expo`) — see `jest.config.js`. E2E tests live in `e2e/` and target the web build via Playwright.

### Cloud Functions
```bash
cd functions
firebase deploy --only functions                            # Deploy all functions
firebase deploy --only functions:redeemReward               # Deploy a single function
firebase deploy --only firestore:rules                      # Deploy Firestore security rules
```
Functions require Node.js 20 (deadline to upgrade to 22: **2026-04-30**). The `firebase-functions` SDK is on 4.9.0 and needs upgrading to ≥5.1.0.

## Architecture

### Navigation (App.js)
Single `createStackNavigator` with three routing tiers decided at render time:
1. **Unauthenticated** — Welcome → Login → SignUp → ForgotPassword → MfaVerification
2. **Authenticated, onboarding incomplete** — Onboarding → OnboardingSignUp
3. **Authenticated, onboarding complete** — Home and all main app screens

The `LockScreen` is rendered by `AppContent` when `isLocked` is true, bypassing the navigator entirely. `jailMonkey` runs at boot to detect rooted/jailbroken devices.

### State Management
`UserContext` (`src/context/UserContext.js`) is the central hub — it owns:
- Firebase Auth state (`user`)
- Live Firestore user document synced via `onSnapshot` (`userData`)
- Every user action as an exported function: `login`, `logout`, `addPost`, `addRunToHistory`, `followUser`, `updateCoins`, etc.
- The `DEFAULT_USER_DATA` constant defines the full Firestore user document schema

**Rule:** screens never write to Firestore directly — they call functions from `useUser()`.

Three lightweight contexts wrap it: `NotificationContext` (push notifications + reminders), `ThemeContext` (dark-only, accent `#CCFF00`), `SecurityContext` (jailbreak flag).

### Cloud Functions (`functions/index.js`)
All security-sensitive operations run server-side. Key functions:

| Function | Type | Purpose |
|---|---|---|
| `redeemReward` | `onCall` | Atomic: coin deduction + inventory decrement + monthly cap (3/month) + 5-min cooldown + email via Resend |
| `saveRunActivity` | `onCall` | XP/coin award with anti-cheat: speed cap (25 km/h), route integrity validation, daily coin cap (500) |
| `askGemini` | `onCall` | AI Coach — proxies to Gemini API |
| `generateWorkoutSuggestion` | `onCall` | AI workout card for HomeScreen — reads last 14 days of run history, calls Gemini, caches result in `users/{uid}/aiWorkout/{YYYY-MM-DD}` |
| `startLiveRun` | `onCall` | Creates `liveRuns/{token}` doc, returns `{ token, shareUrl }`. Token is a UUID that acts as the secret. |
| `endLiveRun` | `onCall` | Marks run completed, sets `expiresAt` to 30 min from now. Viewer page shows "Run complete" after this. |
| `deleteAccountData` | `onCall` | GDPR: deletes all subcollections (redemptions, notifications, auditLog, saved_routes), anonymizes user's posts, wipes Storage + Firebase Auth user |
| `exportUserData` | `onCall` | GDPR: returns user profile + redemptions as JSON (strips internal fields like `fcmToken`) |
| `disableMfaForUser` | `onCall` | Admin-only (requires `admin` custom claim): removes all MFA factors for account recovery |
| `notifyLoginFailure` | `onCall` | Sends security alert email via Resend when account is locked after brute-force attempts |
| `verifyRewardCode` / `redeemRewardCode` | `onRequest` | Public endpoints for partner store staff to verify/mark QR codes as used |
| `syncWhoopData` / `syncOuraData` | `onCall` | Wearable data sync |

Secrets are managed via Firebase Secret Manager: `RESEND_API_KEY` (email), `GEMINI_API_KEY` (AI Coach).

### Firestore Data Model
```
users/{uid}                        # Profile, coins, XP, level, runHistory, badges, gear
users/{uid}/redemptions/{id}       # Reward redemption records (discountCode, status, expiresAt)
users/{uid}/notifications/{id}     # In-app notifications
users/{uid}/auditLog/{id}          # Sensitive action audit trail (write-only from client)
users/{uid}/saved_routes/{id}      # Saved GPS routes
users/{uid}/aiWorkout/{YYYY-MM-DD} # Daily AI workout suggestion cache (generated by Cloud Function)
liveRuns/{token}                   # Live run safety sharing: lastPosition, status, expiresAt (public read; token is the secret)
rewards/{id}                       # Reward inventory: stockCount, title, partner (IDs 1–7)
posts/{postId}                     # Social feed posts
clubs/{clubId}                     # Running clubs
clubs/{clubId}/posts/{postId}      # Club posts
chats/{chatId}                     # Chat metadata (users array)
chats/{chatId}/messages/{id}       # Messages
content/{docId}                    # Tips and articles (read-only from client)
help_categories/{id}               # Help center FAQs (public read)
```

Security rules are in `firestore.rules`. All sensitive writes are blocked client-side and go through Cloud Functions using the Admin SDK.

### MFA / Authentication
- SMS MFA uses Firebase Phone Auth with a **custom WebView reCAPTCHA verifier** — do not use or re-add `expo-firebase-recaptcha` (deprecated/removed).
- The `RecaptchaVerifier` component is defined in `src/screens/2FASetupScreen.js` and duplicated in `src/screens/MfaVerificationScreen.js` — it uses a `WebView` modal with `grecaptcha.execute()`.
- Site key for reCAPTCHA comes from `EXPO_PUBLIC_RECAPTCHA_SITE_KEY` env var (falls back to Google's test key).

### Rewards System
- Reward inventory is tracked in `rewards/{1-7}` Firestore documents (`stockCount` field).
- `RewardsScreen` subscribes to all 7 docs via `onSnapshot` for real-time stock display.
- `redeemReward` Cloud Function enforces: coin balance ≥ price → stock > 0 → monthly count < 3 → last redemption > 5 min ago — all inside a single Firestore transaction.

### Live Run Safety Sharing
- Runner taps the share icon in `ActiveRunScreen` header → `startLiveRun` Cloud Function creates `liveRuns/{token}` and returns a share URL (`https://ruvo-app-99c85.web.app/live?token={token}`).
- The app then opens the native share sheet. While sharing, a red "radio" icon replaces the share button; tapping it re-opens the share sheet.
- Every 15 seconds, `ActiveRunScreen` writes the runner's current GPS, pace, distance, and duration directly to `liveRuns/{token}.lastPosition` (client-side Firestore update, allowed by security rules since auth.uid == resource.data.uid).
- On run end, `endLiveRun` marks the run completed and sets `expiresAt` to 30 min from now.
- Viewers open `public/live.html` (served at `/live?token=…`). It uses Firestore `onSnapshot` to stream real-time updates and Leaflet.js (dark CartoDB tiles) to render the runner's path with no API key required.
- The token acts as the secret — no authentication is required to view the page. Link auto-expires.

### Anti-Cheat (Runs)
- **Client**: GPS points with speed > 6.94 m/s (25 km/h) are filtered out in `ActiveRunScreen`.
- **Server**: `saveRunActivity` re-derives distance from submitted GPS coordinates, rejects runs where >30% of segments exceed the speed cap, and caps at 100 km / 720 min / 500 coins/day.

### Offline Run Queue
Failed `saveRunActivity` calls caused by network errors are queued in AsyncStorage via `src/utils/pendingRuns.js`. On the next successful login, `retryPendingRuns()` in `UserContext` replays them automatically. Non-retryable failures (bad data rejected by the server) are dropped after one retry. `SaveActivityScreen` shows a "Saved Offline" alert and navigates back when `addRunToHistory` returns `{ queued: true }`.

Retryable Firebase error codes: `unavailable`, `deadline-exceeded`, `unknown`, `internal`, plus any error message containing "network", "failed to fetch", or "timeout".

### Crash Reporting (Sentry)
`@sentry/react-native` is initialized in `App.js` before any component renders. The app is wrapped with `Sentry.wrap(App)` for automatic error boundaries. Set `EXPO_PUBLIC_SENTRY_DSN` in `.env` to enable reporting — if the variable is absent, Sentry is initialized but disabled (`enabled: false`). Trace sample rate is 0.2 (20%).

## Environment Variables
All in `.env` (prefixed `EXPO_PUBLIC_` for client-side access):
- `EXPO_PUBLIC_FIREBASE_*` — Firebase project config
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` — Google Sign-In
- `EXPO_PUBLIC_FACEBOOK_APP_ID` / `EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN`
- `EXPO_PUBLIC_RC_APPLE` / `EXPO_PUBLIC_RC_GOOGLE` — RevenueCat API keys
- `EXPO_PUBLIC_RECAPTCHA_SITE_KEY` — reCAPTCHA v3 site key
- `EXPO_PUBLIC_SENTRY_DSN` — Sentry DSN for crash reporting (optional; omit to disable)

## Design System
- **Dark theme only.** Background: `#000` / `#121212` / `#1C1C1E`. Accent: `#CCFF00` (neon green).
- Font: Poppins (loaded via `@expo-google-fonts/poppins`). Always specify the weight variant: `Poppins_400Regular`, `Poppins_700Bold`, etc.
- Colors and sizes imported from `src/constants/legacy-theme.js` as `COLORS` and `SIZES`.
- `FloatingNavBar` uses `useSafeAreaInsets()` for bottom inset — always account for Android system nav bar when positioning absolute elements.
