---
description: how to debug black screen or freezing screen on Android emulator
---

# Debugging Black Screen / Freezing Screen on Android Emulator

## Common Causes (in order of likelihood)

### 1. Missing Firebase imports
**Symptom:** App bundles to 100% then freezes or shows black screen.
**Check:** Look for `Property 'X' doesn't exist` errors in logcat.
```powershell
adb logcat -d -s "ReactNativeJS:*" | Select-Object -Last 30
```
**Fix:** Ensure all Firebase functions used in code are actually imported:
```javascript
// ❌ Common mistake — using onAuthStateChanged without importing it
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';

// ✅ Fix — add ALL functions you use
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
```

### 2. Circular dependencies
**Symptom:** `Require cycle` warning in Metro followed by black screen.
**Check:** Look for require cycle warnings in Metro output.
**Fix:** Extract shared contexts/utilities into their own files.
```
❌ App.js exports SecurityContext → PaywallScreen imports from App.js → cycle!
✅ SecurityContext.js (standalone) → both App.js and PaywallScreen import from it
```

### 3. SecureStore / AsyncStorage persistence
**Symptom:** App loads but spinner never stops. `onAuthStateChanged` callback never fires.
**Fix:** Use AsyncStorage instead of SecureStore for Firebase Auth persistence:
```javascript
// In src/config/firebase.js
import AsyncStorage from '@react-native-async-storage/async-storage';
auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
```

### 4. Firestore permission errors
**Symptom:** App loads but some features don't work. `Missing or insufficient permissions` in logs.
**Fix:** Update `firestore.rules` and deploy:
```powershell
npx firebase deploy --only firestore:rules
```

### 5. Network / IP address changes
**Symptom:** `CLEARTEXT communication not permitted` error.
**Check:** Your machine IP may have changed.  
```powershell
ipconfig | Select-String "IPv4"
```
**Fix:** Update `android/app/src/main/res/xml/network_security_config.xml` with new IP, then rebuild:
// turbo
```powershell
npx expo run:android
```

## Quick Debugging Steps

// turbo-all

1. Clear logcat and restart:
```powershell
adb logcat -c
adb shell am force-stop com.antoinekh.ruvoapplication
adb shell am start -n com.antoinekh.ruvoapplication/.MainActivity
```

2. Wait 15 seconds, then dump JS logs:
```powershell
adb logcat -d -s "ReactNativeJS:*" | Select-Object -Last 50
```

3. If no JS logs appear, the crash is BEFORE JS engine starts. Check native logs:
```powershell
adb logcat -d *:E | Select-Object -Last 30
```

4. If you see a specific error, search for it in the codebase:
```powershell
rg "error message here" src/
```

## Prevention Checklist
- [ ] Always import ALL Firebase functions you use (`onAuthStateChanged`, `onSnapshot`, etc.)
- [ ] Never import from `App.js` in screen files — extract shared code to `src/context/` or `src/utils/`
- [ ] Use `AsyncStorage` for Firebase Auth persistence (not `SecureStore`)
- [ ] Keep `firestore.rules` in sync with your Firestore collections
- [ ] After changing machine networks, update `network_security_config.xml`
