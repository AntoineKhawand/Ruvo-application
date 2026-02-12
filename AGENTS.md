# RUVO Project Sync - Agent Communication Log

## ⚠️ INSTRUCTIONS FOR ALL AI AGENTS
Before making any code changes or writing a plan, you MUST read this file.
When you complete a task, you MUST append a short summary of your changes to the "Agent Work Log" at the bottom of this file. Do not overwrite previous logs.

## 🧱 Current Architecture State (LOCKED - DO NOT OVERWRITE)

**1. Core Stack & Environment:**
* **Framework:** React Native (0.81.5) + Expo (SDK 54).
* **Styling:** React Native `StyleSheet`. Custom fonts (`Poppins`) are already loaded globally. Do not use Tailwind or NativeWind.

**2. Navigation (`App.js` is the Source of Truth):**
* We are using `@react-navigation/stack` directly in `App.js` (ignore the `app/` folder for routing).
* **Auth Gating:** Navigation is strictly gated by `useUser()` from `src/context/UserContext`. 
* **Flow Logic:** If `user` is null -> Guest Flow. If `user` exists but `!userData?.onboardingCompleted` -> Onboarding Flow. Otherwise -> Main App Flow.

**3. Database & Authentication (`src/config/firebase.js`):**
* **Firebase (v12.8.0):** Modular SDK is fully initialized.
* **Auth:** Firebase Auth is configured with `getReactNativePersistence` using `@react-native-async-storage/async-storage`. Do not rewrite auth persistence.
* **Database:** Firestore is initialized and exported as `db`.
* **Storage:** Firebase Storage is initialized and exported as `storage`.

**4. State Management:**
* Global state is handled via React Context (`UserContext`, `ThemeContext`, `NotificationContext`). 
* When building UI components, ALWAYS check if the data can be destructured from `useUser()` before writing a direct Firestore fetch.

**5. Monetization (`src/services/revenueCat.js`):**
* **Provider:** `react-native-purchases` is fully initialized.
* **Entitlement Check:** The active premium entitlement string is EXACTLY `'Ruvo Pro'`.

## 🏗️ Active Roles
* **Agent 1 (Claude):** Lead Backend & Logic Engineer (Focus: RevenueCat, database schemas, API routes, data logic).
* **Agent 2 (Gemini):** Lead Product Architect & UI Designer (Focus: UI components, styling, user flow, component structure).

## 🎯 Current Global Objective
* Completed: Integrate RevenueCat paywall and Injury/Vacation Logic.
* Completed: Integrate `RuvoDashboard.tsx` Bento-Box UI.
* Next: [Waiting for new objective]

## 📝 Agent Work Log
* [2026-02-11] - Agent 1 (Claude): Implemented RevenueCat integration (Service, Native Paywall, Customer Center) and Injury/Vacation logic (aiCoach.js, UserContext.js). Verified entitlements and native UI components.
* [2026-02-11] - Agent 2 (Gemini): Created `src/components/RuvoDashboard.js` featuring a Bento-Box grid layout, Neon styling (#CCFF00), and integrated RevenueCat entitlement checks for the Pro banner. Ready for integration.
* [2026-02-11] - Agent 1 (Claude): Fixed infinite loading issue in `UserContext.js` by wrapping auth/RevenueCat initialization in a `try/catch/finally` block. App should now load even if RevenueCat fails.
* [2026-02-11] - Agent 2 (Gemini): UI is ready to be hooked up to the database. (Note for Claude: Dashboard component is implemented and ready for deeper data integration if needed).