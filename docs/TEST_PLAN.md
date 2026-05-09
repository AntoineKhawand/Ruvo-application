# Ruvo App — Full Test Plan

## How to Use
Go through each section in order. Check off ✅ each test case after verifying it works.  
**Pre-requisite:** Install the app on a real Android device (not emulator).

---

## 1. App Launch & Loading

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 1.1 | Kill app, reopen | Logo + spinner appears, then navigates to correct screen | |
| 1.2 | Fresh install (no account) | Welcome screen appears | |
| 1.3 | App while auth loading | Shows branded loading screen with logo + "Preparing your gear..." | |
| 1.4 | Slow network → timeout | App doesn't crash, shows error or retry | |

---

## 2. Welcome Screen

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 2.1 | Logo displays | Logo is visible, properly sized (140×140) | |
| 2.2 | "Take Control of Your Running Journey" title | Text is readable, correctly spaced | |
| 2.3 | "Start Journey" button | Navigates to Onboarding Step 1 | |
| 2.4 | "Already have an account? Log In" link | Navigates to Login screen | |

---

## 3. Onboarding (Steps 1-5)

### Step 1 — Goal

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 3.1 | Select "Get Fitter" → Continue | Goes to Step 2 | |
| 3.2 | Select "Run a 5K" → Continue | Goes to Step 2 | |
| 3.3 | Select "Lose Weight" → Continue | Goes to Step 2 | |
| 3.4 | Swipe back (Android) | Does nothing or asks to confirm exit | |

### Step 2 — Bio

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 3.5 | Leave name empty → Continue | Alert: "Please fill in your name, weight, and height." | |
| 3.6 | Leave weight empty → Continue | Same alert | |
| 3.7 | Fill all fields → Continue | Goes to Step 3 | |
| 3.8 | Weight: non-numeric input | Accepts it but parses to NaN → saved as 0 | |

### Step 3 — Gender & DOB

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 3.9 | Select Male/Female → Continue | Goes to Step 4 | |
| 3.10 | Date picker opens | Shows date picker modal | |
| 3.11 | Pick a date → Continue | Goes to Step 4 | |

### Step 4 — Training Days

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 3.12 | Select 0 days → Continue | Alert: "Select Training Days" | |
| 3.13 | Select 1-7 days → Continue | Goes to Step 5 | |
| 3.14 | Frequency slider | Drag changes value, message updates | |

### Step 5 — Permissions & Finalize

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 3.15 | Location permission toggle | Requests OS location permission | |
| 3.16 | Notifications permission toggle | Requests OS notification permission | |
| 3.17 | Toggle ON both, click "Continue with Email" | Navigates to OnboardingSignUp | |
| 3.18 | Toggle ON both, click "Continue with Google" | Triggers Google Sign-In | |
| 3.19 | Click "Continue with Facebook" | Triggers Facebook Login | |
| 3.20 | Deny location permission | App proceeds but location features disabled | |

---

## 4. OnboardingSignUp Screen

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 4.1 | Empty email → CREATE ACCOUNT | Error: "Please enter a valid email address" | |
| 4.2 | Invalid email format → CREATE ACCOUNT | Error: "Please enter a valid email address" | |
| 4.3 | Weak password (< 8 chars) → CREATE ACCOUNT | Error: "Password does not meet requirements" | |
| 4.4 | **Already registered email → CREATE ACCOUNT** | **Error inline: "This email is already registered" — STAYS on screen** | |
| 4.5 | Valid email + password + referral → CREATE ACCOUNT | Creates account, navigates to Home | |
| 4.6 | Valid email + password + no referral → CREATE ACCOUNT | Creates account, navigates to Home | |
| 4.7 | Invalid referral code | Account still created, referral ignored | |
| 4.8 | Google Sign-In button | Triggers Google auth, creates account, navigates to Home | |
| 4.9 | Facebook Sign-In button | Triggers Facebook auth, creates account, navigates to Home | |
| 4.10 | "Log In" link in footer | Navigates to Login screen | |
| 4.11 | Back arrow | Goes back to Onboarding Step 5 | |
| 4.12 | Double-tap CREATE ACCOUNT quickly | Only one submission (button disabled) | |

---

## 5. Login Screen

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 5.1 | Empty email → Log In | Alert: validation error | |
| 5.2 | Wrong password | Error message shown | |
| 5.3 | Correct email + password | Navigates to Home (or Home if onboarding completed) | |
| 5.4 | "Forgot Password?" link | Navigates to ForgotPassword screen | |
| 5.5 | Google Sign-In | Triggers Google auth, navigates to Home | |
| 5.6 | Facebook Sign-In | Triggers Facebook auth, navigates to Home | |
| 5.7 | "Create One" link in footer | Navigates to SignUp screen | |

---

## 6. Forgot Password Screen

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 6.1 | Empty email → Send | Alert: enter email | |
| 6.2 | Valid email → Send | Success alert, 60s cooldown starts | |
| 6.3 | Click Send during cooldown | Button disabled, shows cooldown seconds | |
| 6.4 | "Remember your password? Log in" link | Navigates to Login | |

---

## 7. Home Screen

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 7.1 | Dashboard loads | Shows stats: weekly distance, XP, coins, streak | |
| 7.2 | "Start Run" button | Navigates to ActiveRun screen | |
| 7.3 | Pull-to-refresh | Refreshes data | |
| 7.4 | Floating Nav Bar | Shows 5 icons, current tab highlighted | |
| 7.5 | Tap each nav item (Home, Community, Coach, Plan, Rewards) | Navigates correctly, no stack buildup | |
| 7.6 | Weather widget | Shows current weather or "Unavailable" | |
| 7.7 | Pro banner (if not Pro) | Shows upgrade CTA | |
| 7.8 | Tap Pro banner | Navigates to Paywall | |
| 7.9 | Streak milestone celebration (7/14/30/60/100/200/365) | Shows celebration overlay when streak matches | |

---

## 8. Active Run Screen

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 8.1 | Tap "Start Run" from Home | Navigates to ActiveRun, location starts immediately | |
| 8.2 | Location permission already granted | Run starts immediately — no permission dialog | |
| 8.3 | Location permission denied | Alert: "Location Required" + back navigation | |
| 8.4 | Timer runs | Real-time counter increments every second | |
| 8.5 | Distance updates | Distance increases as GPS moves | |
| 8.6 | Pace shows | Average pace calculated from distance/time | |
| 8.7 | Heart Rate zone | Shows HR data if available, else "--" | |
| 8.8 | Map renders | Shows current position on map | |
| 8.9 | Voice toggle | Taps "Muted"/"Voice On" toggles voice cues | |
| 8.10 | Lap button | Lap count increments | |
| 8.11 | Collapse dashboard | Tap to collapse/expand dashboard | |
| 8.12 | Map type changer | Cycles through map styles | |
| 8.13 | Lock screen (Android) → unlock | Timer still correct, run continues | |
| 8.14 | Pause → Resume | Timer pauses, resumes correctly | |
| 8.15 | "Hold to Finish" | Navigates to RateEffort screen | |
| 8.16 | Background → foreground | Timer re-syncs from Date.now() | |

---

## 9. Rate Effort Screen

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 9.1 | Slide effort rating | Value updates | |
| 9.2 | Tap "Complete Activity" | Navigates to SaveActivity screen | |

---

## 10. Save Activity Screen

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 10.1 | Run stats displayed | Distance, time, pace, calories, HR zones shown | |
| 10.2 | Add photo | Image picker opens | |
| 10.3 | "Save Activity" | Saves to Firestore, shows badge/coins animation | |
| 10.4 | Animated coin counter | Counts up to final coin amount | |
| 10.5 | Coin breakdown shown | "+5 pace +3 streak +10 off-peak" labels | |
| 10.6 | Badge unlock (if new) | AchievementOverlay shows | |
| 10.7 | Streak milestone (if reached) | StreakMilestone celebration shows | |
| 10.8 | "Save Activity" while offline | Alert: "Saved Offline", queues in AsyncStorage | |

---

## 11. Community Screen

### Feed Tab

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 11.1 | Feed loads | Shows posts from all users (Global) | |
| 11.2 | Feed scope toggle (Global/Following) | Filters posts correctly | |
| 11.3 | Pull-to-refresh | Refreshes feed + leaderboard | |
| 11.4 | Tap cheer button | Optimistic update, heart fills immediately | |
| 11.5 | Tap comments | Opens comments modal | |
| 11.6 | Post a comment | Comment appears in real-time | |
| 11.7 | Reply to comment | Shows "@username" prefix | |
| 11.8 | Long-press post → options menu | Shows Share / Mute / Report | |
| 11.9 | Share option | Opens native share sheet | |
| 11.10 | Mute option | Mutes user, confirms with alert | |
| 11.11 | Report option | Submits report silently | |
| 11.12 | Skeleton loaders on first load | Shows 3 skeleton cards while loading | |

### Explore Tab

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 11.13 | Map loads | Shows map with route polylines | |
| 11.14 | Community routes listed | Shows real runs with GPS data | |
| 11.15 | Tap route card | Route highlights on map | |
| 11.16 | Bottom sheet expand/collapse | Tap drag handle → sheet animates | |
| 11.17 | No community routes | Empty state: "No community routes yet" | |

### Leaderboards Tab

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 11.18 | Leaderboard loads | Shows ranked users by weekly distance | |
| 11.19 | Scope filter (Global / Lebanon / Friends) | Filters correctly | |
| 11.20 | Time filter (Weekly / All-Time) | Switches between modes | |
| 11.21 | Current user highlighted | User row has accent border | |
| 11.22 | Podium top 3 | Shows 1st/2nd/3rd with trophies | |
| 11.23 | No data | "No runners yet" empty state with context | |

### Clubs Tab

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 11.24 | Clubs list loads | Shows joined + discoverable clubs | |
| 11.25 | Tap club card | Navigates to ClubDetail | |
| 11.26 | Join club | Request sent, button shows "Requested" | |
| 11.27 | Create club button | Navigates to CreateClubScreen | |

### Challenges Tab

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 11.28 | Challenges load from Firestore | Shows monthly challenges | |
| 11.29 | Join challenge | Button changes to "Joined" | |
| 11.30 | Leave challenge | Confirms, removes from joined list | |
| 11.31 | Challenge detail modal | Opens with full details | |

---

## 12. AI Coach Screen

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 12.1 | Zero state (no chat) | Shows Quick Action cards (Analyze, Plan, Recover) | |
| 12.2 | Pro vs Free user | Free: input disabled with Pro upsell | |
| 12.3 | Quick Action → "Analyze My Training" | Sends message, shows loading, response appears | |
| 12.4 | Quick Action → "Create a Plan" | Sends message, AI responds with plan | |
| 12.5 | Quick Action → "Recovery Advice" | Sends message, AI responds | |
| 12.6 | Type message + Send (Pro only) | Message sent, AI responds | |
| 12.7 | Chat history persists | Messages remain after navigating away | |
| 12.8 | Clear Chat button | Confirms, clears all messages | |

---

## 13. Plan Screen

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 13.1 | Weekly plan loads | Shows training plan for current week | |
| 13.2 | "Ask Coach" button | Navigates to Coach screen | |
| 13.3 | Tap workout card | Navigates to WorkoutDetail | |

---

## 14. Analytics Screen

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 14.1 | Charts load | Shows distance over time, pace trends | |
| 14.2 | HR zone breakdown | Horizontal bar chart of time in zones | |
| 14.3 | Empty state (no runs) | Message: "Complete your first run to see analytics" | |
| 14.4 | Pull-to-refresh | Refreshes data | |

---

## 15. Rewards Store

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 15.1 | Rewards list loads | Shows available rewards with prices | |
| 15.2 | Insufficient coins → Redeem | Alert: not enough coins | |
| 15.3 | Sufficient coins → Redeem | Confirms, deducts coins, shows success | |
| 15.4 | My Redemptions tab | Shows history + status (active/used/expired) | |
| 15.5 | Staggered animation on load | Items animate in one by one | |
| 15.6 | Redeemed digital code | Shows code in My Redemptions | |

---

## 16. Profile Screen

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 16.1 | Profile loads | Shows avatar, name, level, XP bar, stats | |
| 16.2 | Avatar displays | Shows uploaded photo, or initials fallback | |
| 16.3 | Edit button | Navigates to EditProfile | |
| 16.4 | Achievements section | Shows earned badges | |
| 16.5 | Followers / Following count | Displays correctly | |
| 16.6 | Pull-to-refresh | Refreshes profile data | |
| 16.7 | Tap edit avatar → pick photo | Image picker opens | |

---

## 17. Edit Profile Screen

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 17.1 | Change avatar (pick from gallery) | Local URI shown, uploaded on Save | |
| 17.2 | Change name → Save | Name updates in Firestore | |
| 17.3 | Change bio → Save | Bio updates | |
| 17.4 | Change weight → Save | Weight updates | |
| 17.5 | Change weekly goal → Save | Goal updates | |
| 17.6 | Cancel button | Goes back without saving | |
| 17.7 | Upload fails → Save | Alert: "Upload Failed", profile not saved | |

---

## 18. Settings Screen

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 18.1 | All settings rows visible | Help Center, About Ruvo, Log Out, Delete Account | |
| 18.2 | Help Center → navigates | Opens HelpCenter screen | |
| 18.3 | About Ruvo → navigates | Shows app info, social links, share, rate | |
| 18.4 | Share app | Opens native share sheet | |
| 18.5 | Rate app | Opens Play Store review prompt | |
| 18.6 | Log Out | Confirms, logs out, returns to Welcome | |
| 18.7 | Delete Account | Confirms (twice), deletes data, returns to Welcome | |
| 18.8 | Connected Devices | Shows health services + Whoop/Oura status | |

---

## 19. Paywall / Pro Upgrade

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 19.1 | Paywall loads | Shows feature list, pricing cards | |
| 19.2 | Monthly plan selected | Monthly card highlighted | |
| 19.3 | Annual plan selected | Annual card highlighted with savings badge | |
| 19.4 | Subscribe (no products configured) | Alert: "Subscriptions Not Configured" with setup guide | |
| 19.5 | Subscribe (products configured) | Shows Play Store billing dialog | |
| 19.6 | Restore Purchase | Checks RevenueCat, restores if found | |
| 19.7 | Close button | Goes back | |
| 19.8 | Terms / Privacy links | Opens browser | |

---

## 20. Edge Cases & Error Handling

| # | Test Case | Expected Result | ✅ |
|---|-----------|-----------------|---|
| 20.1 | No internet → open app | Shows cached data, no crash | |
| 20.2 | No internet → start run | Alert about offline mode | |
| 20.3 | No internet → save activity | Queued in AsyncStorage, retried on reconnect | |
| 20.4 | GPS off → start run | Alert: enable GPS | |
| 20.5 | Deny all permissions | App degrades gracefully, no crash | |
| 20.6 | Rapid button taps | Prevents double-navigation, no stack buildup | |
| 20.7 | Deep link → app opens | Correct screen loads | |
| 20.8 | Push notification → tap | Opens relevant screen | |
| 20.9 | App backgrounded during run → reopen | Run still active, timer correct | |
| 20.10 | Session expires → MFA required | MfaVerification screen shows | |

---

## Summary

| Section | Total Tests |
|---------|-------------|
| 1. App Launch | 4 |
| 2. Welcome | 4 |
| 3. Onboarding | 20 |
| 4. OnboardingSignUp | 12 |
| 5. Login | 7 |
| 6. Forgot Password | 4 |
| 7. Home | 9 |
| 8. Active Run | 16 |
| 9. Rate Effort | 2 |
| 10. Save Activity | 8 |
| 11. Community | 31 |
| 12. AI Coach | 8 |
| 13. Plan | 3 |
| 14. Analytics | 4 |
| 15. Rewards | 6 |
| 16. Profile | 7 |
| 17. Edit Profile | 7 |
| 18. Settings | 8 |
| 19. Paywall | 8 |
| 20. Edge Cases | 10 |
| **Total** | **178** |

---

## Bug Tracker

| # | Date | Screen | Bug | Fixed? |
|---|------|--------|-----|--------|
| B1 | — | OnboardingSignUp | Email already in use redirects to Welcome | ✅ Fixed |
| B2 | — | ActiveRun | Crashes on mount (missing useState) | ✅ Fixed |
| B3 | — | Community Leaderboard | Empty due to weeklyDistance not in Firestore | ✅ Fixed |
| B4 | — | Settings | "Download My Data" broken | ✅ Removed |
| B5 | — | Explore | Dummy hardcoded routes | ✅ Removed |
| B6 | — | EditProfile | Avatar upload disabled (file:// saved to Firestore) | ✅ Fixed |

---

## Recommendation: Next Steps

1. Go through this checklist on your device — check off each test
2. Focus on **Section 20 (Edge Cases)** — these are the most common crash sources
3. For automated testing, consider **Maestro** (https://maestro.mobile.dev) — it's the simplest mobile E2E tool. Installation:
   ```bash
   brew install maestro
   maestro test flows/
   ```
   It works on real devices and emulators, supports React Native
