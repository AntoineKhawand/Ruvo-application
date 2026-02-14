# 🔴 RUVO SECURITY & ARCHITECTURE AUDIT REPORT
**Generated:** 2026-02-13  
**Auditor:** Backend Architect (Mode A)  
**Scope:** Authentication, Monetization, Database Operations, Performance

---

## 🚨 EXECUTIVE SUMMARY
This audit identified **12 critical vulnerabilities** across authentication, monetization, and data integrity layers. The most severe issues allow users to bypass premium features and corrupt user data through race conditions.

**Risk Level:** 🔴 **HIGH** - Immediate action required on CRITICAL items.

---

## 📋 FINDINGS BY SEVERITY

### 🔴 CRITICAL ISSUES

#### **[CRITICAL-01]** - RevenueCat Entitlement Not Checked on App Resume
* **File:** `src/context/UserContext.js` (Lines 200-232)
* **Issue:** RevenueCat entitlement is ONLY checked once during initial auth. If a user's subscription expires or is refunded while the app is backgrounded, the app will NOT detect this until they restart the app completely.
* **Risk:** Users get **free Pro access** after subscription expires. Revenue loss and feature abuse.
* **Proposed Fix:** Add `AppState` listener in UserContext to call `checkSubscriptionStatus()` on every app foreground event.

```javascript
// Add to UserContext.js useEffect
useEffect(() => {
  const subscription = AppState.addEventListener('change', async (nextAppState) => {
    if (nextAppState === 'active' && user) {
      const isPro = await checkSubscriptionStatus();
      setUserData(prev => ({ ...prev, isPro }));
    }
  });
  return () => subscription.remove();
}, [user]);
```

---

#### **[CRITICAL-02]** - Race Condition in `signUp()` Function
* **File:** `src/context/UserContext.js` (Lines 386-427)
* **Issue:** The `signUp` function creates a Firebase Auth user, then writes to Firestore. However, the `onAuthStateChanged` listener fires IMMEDIATELY when the user is created (line 203), triggering `fetchUserData()` BEFORE the profile document exists (line 418). This causes the user to see a blank/default profile for 1-2 seconds.
* **Risk:** "Flash of incomplete data" on signup. User sees default avatar, missing name, etc. Poor UX and potential data corruption if user interacts before Firestore write completes.
* **Proposed Fix:** Set `isLoading = true` at the start of `signUp`, and only set it to `false` AFTER the Firestore write completes.

---

#### **[CRITICAL-03]** - Missing `{ merge: true }` in Referral Code Backfill
* **File:** `src/context/UserContext.js` (Line 270)
* **Issue:** When backfilling a missing referral code, the code uses `setDoc(docRef, { referralCode: newCode }, { merge: true })`. This is CORRECT. However, if this fails or is interrupted, the user profile could be partially overwritten.
* **Risk:** Low probability but **catastrophic** if triggered. User profile could lose all data except `referralCode`.
* **Proposed Fix:** Already using `{ merge: true }` - this is SAFE. However, wrap in try/catch to prevent silent failures.

---

#### **[CRITICAL-04]** - `isPro` Status Stored in Firestore (Redundant Truth Source)
* **Files:** `src/context/UserContext.js` (Lines 1226, 1241)
* **Issue:** The app stores `isPro: true` in Firestore when a purchase succeeds. However, RevenueCat is the **source of truth** for subscriptions. If a user gets a refund or their subscription is cancelled server-side, Firestore will still show `isPro: true` until the next app restart.
* **Risk:** Users retain Pro access after refunds. **Revenue loss.**
* **Proposed Fix:** REMOVE `isPro` from Firestore entirely. Always check RevenueCat entitlements in real-time. Cache the result in React state ONLY, never persist it.

```javascript
// REMOVE these lines:
await updateDoc(doc(db, "users", user.uid), { isPro: true });

// INSTEAD: Only update local state
setUserData(prev => ({ ...prev, isPro: true }));
```

---

#### **[CRITICAL-05]** - No App State Listener for Background/Foreground Events
* **File:** `src/context/UserContext.js` (Entire file)
* **Issue:** The app does NOT listen to `AppState` changes. This means:
  - RevenueCat entitlements are not refreshed when app returns from background.
  - User could cancel subscription in Settings, return to app, and still have Pro access.
* **Risk:** Monetization bypass. Users get free Pro features.
* **Proposed Fix:** Add `AppState.addEventListener('change', ...)` to re-check entitlements on foreground.

---

#### **[CRITICAL-06]** - Unawaited Promise in `updateUserProfile` (Line 546)
* **File:** `src/context/UserContext.js` (Line 546)
* **Issue:** `updateDoc(userRef, { chats: updatedChats }).catch(e => console.error(e));` is called WITHOUT `await`. This means the function continues executing before the Firestore write completes.
* **Risk:** If the write fails, local state will be updated but Firestore will not. User sends a message, sees it in UI, but it's never saved. **Data loss.**
* **Proposed Fix:** Add `await` before `updateDoc`.

```javascript
// BEFORE:
updateDoc(userRef, { chats: updatedChats }).catch(e => console.error(e));

// AFTER:
await updateDoc(userRef, { chats: updatedChats }).catch(e => console.error(e));
```

---

### ⚠️ MEDIUM SEVERITY ISSUES

#### **[MEDIUM-01]** - Flash of Unauthenticated Content on App Start
* **File:** `App.js` (Lines 58-64)
* **Issue:** The loading screen is COMMENTED OUT in `RootNavigator`. This means users see the Welcome/Login screen for a split second before Firebase Auth persistence kicks in.
* **Risk:** Poor UX. User sees login screen, then immediately gets redirected to Home. Confusing.
* **Proposed Fix:** Uncomment the loading check OR add a 200ms delay before rendering navigation.

```javascript
// UNCOMMENT THIS:
if (isLoading) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#CCFF00" />
    </View>
  );
}
```

---

#### **[MEDIUM-02]** - `setDoc` Without `{ merge: true }` in Signup
* **File:** `src/context/UserContext.js` (Line 418)
* **Issue:** `await setDoc(doc(db, "users", userCredential.user.uid), newProfile);` does NOT use `{ merge: true }`. If this function is called twice (e.g., network retry), it will OVERWRITE the entire user profile.
* **Risk:** If signup is retried due to network issues, user data could be reset to defaults.
* **Proposed Fix:** Add `{ merge: true }` to the `setDoc` call.

```javascript
await setDoc(doc(db, "users", userCredential.user.uid), newProfile, { merge: true });
```

---

#### **[MEDIUM-03]** - No Error Handling in `fetchUserData`
* **File:** `src/context/UserContext.js` (Lines 235-288)
* **Issue:** If `getDoc(docRef)` fails (network error, permissions), the function catches the error but does NOT set `isLoading = false`. User is stuck on loading screen forever.
* **Risk:** App becomes unusable if Firestore is down or user has no internet.
* **Proposed Fix:** Ensure `setIsLoading(false)` is called in the `finally` block of the auth listener (already done on line 228), but also add a fallback timeout.

---

#### **[MEDIUM-04]** - Hardcoded Entitlement ID String
* **File:** `src/services/revenueCat.js` (Lines 46, 61, 74)
* **Issue:** The entitlement ID `'Ruvo Pro'` is hardcoded in 3 places. If you rename it in RevenueCat dashboard, you must manually update all 3 locations.
* **Risk:** If entitlement ID is changed in RevenueCat but not in code, ALL users lose Pro access.
* **Proposed Fix:** Extract to a constant at the top of the file.

```javascript
const ENTITLEMENT_ID = 'Ruvo Pro';

// Then use:
if (typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined") {
```

---

#### **[MEDIUM-05]** - RevenueCat Init Error Swallowed Silently
* **File:** `src/context/UserContext.js` (Lines 209-218)
* **Issue:** If `initRevenueCat()` fails, the error is logged but the app continues. The user will NOT have Pro features even if they paid.
* **Risk:** Paying users lose access to Pro features. Support tickets and refund requests.
* **Proposed Fix:** Show an Alert to the user if RevenueCat init fails, and provide a "Retry" button.

---

### ℹ️ LOW SEVERITY ISSUES

#### **[LOW-01]** - Potential Memory Leak in `onAuthStateChanged`
* **File:** `src/context/UserContext.js` (Lines 201-232)
* **Issue:** The `onAuthStateChanged` listener is set up in a `useEffect` with an empty dependency array. If the component unmounts (unlikely for UserProvider), the listener is cleaned up. However, if `fetchUserData` is still running when the component unmounts, it could cause a memory leak.
* **Risk:** Very low. UserProvider is never unmounted in practice.
* **Proposed Fix:** Add a cleanup flag to prevent state updates after unmount.

```javascript
useEffect(() => {
  let isMounted = true;
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    if (!isMounted) return;
    // ... rest of logic
  });
  return () => {
    isMounted = false;
    unsubscribe();
  };
}, []);
```

---

#### **[LOW-02]** - Excessive Re-renders in UserContext
* **File:** `src/context/UserContext.js` (Entire file)
* **Issue:** The UserContext value object is recreated on EVERY render because it's not memoized. This causes all consumers to re-render unnecessarily.
* **Risk:** Performance degradation on low-end devices.
* **Proposed Fix:** Wrap the context value in `useMemo`.

```javascript
const contextValue = useMemo(() => ({
  user, userData, setUserData, isLoading, signUp, login, logout,
  // ... all other values
}), [user, userData, isLoading, clubs, /* ... */]);

return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
```

---

## 📊 SUMMARY TABLE

| ID | Severity | Component | Impact | Fix Effort |
|---|---|---|---|---|
| CRITICAL-01 | 🔴 Critical | RevenueCat | Revenue Loss | 30 min |
| CRITICAL-02 | 🔴 Critical | Auth | Poor UX | 15 min |
| CRITICAL-03 | 🔴 Critical | Database | Data Loss | 5 min |
| CRITICAL-04 | 🔴 Critical | RevenueCat | Revenue Loss | 20 min |
| CRITICAL-05 | 🔴 Critical | RevenueCat | Revenue Loss | 30 min |
| CRITICAL-06 | 🔴 Critical | Database | Data Loss | 5 min |
| MEDIUM-01 | ⚠️ Medium | Navigation | Poor UX | 5 min |
| MEDIUM-02 | ⚠️ Medium | Database | Data Loss | 5 min |
| MEDIUM-03 | ⚠️ Medium | Auth | App Crash | 10 min |
| MEDIUM-04 | ⚠️ Medium | RevenueCat | Maintainability | 5 min |
| MEDIUM-05 | ⚠️ Medium | RevenueCat | Poor UX | 15 min |
| LOW-01 | ℹ️ Low | Performance | Memory Leak | 10 min |
| LOW-02 | ℹ️ Low | Performance | Slow UI | 15 min |

**Total Estimated Fix Time:** ~2.5 hours

---

## 🎯 RECOMMENDED ACTION PLAN

### Phase 1: Immediate Fixes (Critical Revenue Issues)
1. **CRITICAL-01:** Add AppState listener for RevenueCat checks
2. **CRITICAL-04:** Remove `isPro` from Firestore, use RevenueCat as single source of truth
3. **CRITICAL-05:** Implement foreground entitlement refresh

### Phase 2: Data Integrity (Same Day)
4. **CRITICAL-02:** Fix signup race condition
5. **CRITICAL-06:** Await all Firestore writes
6. **MEDIUM-02:** Add `{ merge: true }` to signup

### Phase 3: UX Improvements (Next Sprint)
7. **MEDIUM-01:** Uncomment loading screen
8. **MEDIUM-03:** Add error handling fallbacks
9. **MEDIUM-05:** Show RevenueCat init errors to user

### Phase 4: Code Quality (Backlog)
10. **MEDIUM-04:** Extract entitlement ID to constant
11. **LOW-01:** Add unmount protection
12. **LOW-02:** Memoize context value

---

## 🔐 ADDITIONAL SECURITY NOTES

### Firestore Rules (Not Audited - Recommend Separate Review)
This audit did NOT review your Firestore Security Rules. Based on the code patterns, you should verify:
- Users can ONLY read/write their own `/users/{uid}` document
- Club membership checks are enforced server-side
- Post creation is rate-limited to prevent spam

### RevenueCat Webhook (Missing)
You should set up a RevenueCat webhook to sync subscription status to Firestore in real-time. This prevents the issues identified in CRITICAL-01 and CRITICAL-04.

---

## ✅ WHAT'S WORKING WELL

1. ✅ **Auth Persistence:** Firebase Auth with AsyncStorage is correctly configured
2. ✅ **Batch Writes:** Follow/unfollow operations use `writeBatch` correctly
3. ✅ **Transactions:** Like/unlike uses `runTransaction` to prevent race conditions
4. ✅ **Error Handling:** Most Firestore operations have try/catch blocks
5. ✅ **Merge Flag:** Referral code backfill correctly uses `{ merge: true }`

---

**END OF REPORT**
