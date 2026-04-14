# 🐛 Ruvo — Bug Report Log

---

## BUG-001 — Production App Crash on Launch (Android)

| Field | Details |
|---|---|
| **Severity** | 🔴 Critical |
| **Status** | ✅ Fixed |
| **Reported** | 2026-04-14 |
| **Fixed** | 2026-04-14 |
| **Affected Build** | versionCode 2 (1.0.1) |
| **Platform** | Android (Production `.aab`) |
| **Affected Users** | 100% — app crashed immediately on launch |

### Symptoms
- App icon grid (splash screen) appears, then app immediately terminates.
- No UI rendered at all.
- Crash occurred consistently on every launch.

### Error Stack Trace
```
This error is located at:
    at UserProvider
    at NotificationProvider
    at ThemeProvider
    at App

UserProvider@1:2734842
renderWithHooks@1:336751
updateFunctionComponent@1:355570
beginWork@1:363455
performUnitOfWork@1:382135

com.facebook.react.modules.core.ExceptionsManagerModule.reportException
```

### Root Cause
Two service files called `WebBrowser.maybeCompleteAuthSession()` at **module load time** (top-level, outside any function):

- `src/services/whoopService.js` — line 7
- `src/services/ouraService.js` — line 7

In a **development build**, this is harmless because the JS bridge is already warm. In a **production bundle**, all modules are imported synchronously during `UserContext`'s initialization chain before the React bridge is fully ready. This caused `expo-web-browser` to throw synchronously, crashing `UserProvider` during `renderWithHooks` before any UI could mount.

### Fix Applied
Wrapped both calls in `try/catch` to prevent the uncaught synchronous throw:

```js
// Before (crashing):
WebBrowser.maybeCompleteAuthSession();

// After (safe):
try {
  WebBrowser.maybeCompleteAuthSession();
} catch (e) {
  console.warn('[WhoopService] maybeCompleteAuthSession failed:', e.message);
}
```

**Files changed:**
- `src/services/whoopService.js`
- `src/services/ouraService.js`

### Why It Didn't Appear in Dev Builds
`maybeCompleteAuthSession()` is designed to complete an OAuth redirect back into the app. In Expo Go / dev-client, `expo-web-browser` initializes lazily and the call is a no-op. In a release bundle with Hermes and full native initialization sequence, the call occurs before the bridge is ready, causing it to throw.

### Verification
Rebuild with `eas build --platform android --profile production` and confirm app launches past splash screen to WelcomeScreen without crashing.

---

## BUG-002 — Version Code Conflict on Play Console Upload

| Field | Details |
|---|---|
| **Severity** | 🟡 Medium |
| **Status** | ✅ Fixed |
| **Reported** | 2026-04-13 |
| **Fixed** | 2026-04-13 |
| **Platform** | Android (Google Play Console) |

### Symptoms
`"Version code 1 has already been used. Try another version code."`

### Root Cause
`app.json` and `android/app/build.gradle` both had `versionCode: 1`, which was already consumed by the first internal test build uploaded to Play.

### Fix Applied
- `app.json`: `versionCode` → `2`, `version` → `"1.0.1"`
- `android/app/build.gradle`: `versionCode` → `2`, `versionName` → `"1.0.1"`

---

## BUG-003 — Camera Permission Privacy Policy Warning on Play Console

| Field | Details |
|---|---|
| **Severity** | 🟡 Medium |
| **Status** | ✅ Fixed |
| **Reported** | 2026-04-13 |
| **Fixed** | 2026-04-13 |
| **Platform** | Android (Google Play Console) |

### Symptoms
`"Your APK or Android App Bundle is using permissions that require a privacy policy: (android.permission.CAMERA)"`

### Root Cause
`expo-image-picker` implicitly declared `android.permission.CAMERA` in the merged manifest even though the app only uses the media library (gallery picker), not the live camera.

### Fix Applied
Added `blockedPermissions` to `app.json` to explicitly strip the camera permission from the final manifest:

```json
"android": {
  "blockedPermissions": ["android.permission.CAMERA"],
  ...
}
```

> **Note:** A privacy policy URL is still required in Play Console → Policy → App Content for `RECORD_AUDIO` (used by the AI Coach microphone feature). Host a policy at `https://ruvo-app-99c85.web.app/privacy.html` and paste the URL there.

---

## BUG-004 — SafeArea Content Overlap on Notched Devices

| Field | Details |
|---|---|
| **Severity** | 🟠 High |
| **Status** | ✅ Fixed |
| **Reported** | 2026-04-12 |
| **Fixed** | 2026-04-12 |
| **Platform** | iOS (notched) + Android (punch-hole / soft nav bar) |

### Symptoms
- `WelcomeScreen`: Logo and CTA button rendered under the status bar.
- `FindFriendsScreen`: Header text overlapping the system status bar.
- Bottom sheets (Challenges, Feed, Notifications): Home indicator / Android nav bar overlapping bottom action buttons.

### Fix Applied
| File | Fix |
|---|---|
| `WelcomeScreen.js` | Wrapped content in `<SafeAreaView edges={['top','bottom']}>` |
| `FindFriendsScreen.js` | Wrapped header in `<SafeAreaView edges={['top']}>`, removed brittle `Platform.OS` padding hack |
| `ChallengesTab.js` | `paddingBottom: Math.max(20, insets.bottom + 10)` on sticky footer |
| `FeedTab.js` | `paddingBottom` on comments and options sheets using `insets.bottom` |
| `NotificationSheet.js` | `paddingBottom: Math.max(30, insets.bottom + 10)` on sheet container |

---

*Last updated: 2026-04-14*
