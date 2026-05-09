appId: com.antoinekh.ruvoapplication
name: Ruvo App E2E Test Suite

# ======================================
# Ruvo App - Maestro E2E Test Flows
# ======================================
#
# ## Prerequisites
# - Maestro CLI v2.5.1 installed at C:\maestro\maestro\bin\ (already in PATH)
# - Android device or emulator connected with USB debugging ON
# - App built and installed (use the release APK or a dev build via `npx expo run:android`)
# - For authenticated flows: fill in MAESTRO_PASSWORD in .maestro.env (never commit this file)
#
# ## Quick Start
#   maestro test maestro/smoke.yaml
#
# ## Project Structure
# maestro/
#   smoke.yaml                 - Quick launch test (no login needed)
#   welcome_flow.yaml          - Welcome screen elements
#   login_flow.yaml            - Login form + navigation
#   signup_flow.yaml           - Signup form elements
#   forgot_password_flow.yaml  - Forgot password screen
#   onboarding_flow.yaml       - Onboarding wizard (5 steps)
#   login_authenticated.yaml   - Login setup for all auth flows (uses MAESTRO_PASSWORD env var)
#   home_screen.yaml           - Home screen labels
#   home_dashboard.yaml        - All bento cards, AI Coach, WEEKLY GOAL
#   community_feed.yaml        - Feed tab, cheer, scroll
#   community_leaderboard.yaml - All 3 scopes + all 3 time filters
#   community_clubs.yaml       - Club list, detail, Create Club sheet
#   community_explore.yaml     - Route filter pills
#   rewards_screen.yaml        - Balance, category filters, reward detail modal
#   profile_screen.yaml        - Stats, Activity/Saved Library tabs, Gear Tracker
#   settings_screen.yaml       - All settings rows, Help Center, Privacy Controls
#   ai_coach.yaml              - AI Coach screen, message input
#   active_run.yaml            - Start run, PAUSE/RESUME, HOLD TO FINISH, SaveActivity
#   plan_screen.yaml           - Training plan week view
#   all_guest_flows.yaml       - Master runner: all guest flows
#   all_auth_flows.yaml        - Master runner: all 12 authenticated flows
#   all_auth_deep.yaml         - Master runner: full deep authenticated suite
#   README.md                  - This file
#
# ## Running Tests
#
# ### Smoke test (device connected, app installed, no login needed):
#   maestro test maestro/smoke.yaml
#
# ### All guest flows:
#   maestro test maestro/all_guest_flows.yaml
#
# ### Authenticated flows (set password first):
#   1. Open .maestro.env and replace YOUR_PASSWORD_HERE with your real password
#   2. Run:
#   maestro test maestro/all_auth_deep.yaml --env MAESTRO_PASSWORD=<your_password>
#
# ### Single flow with password:
#   maestro test maestro/community_leaderboard.yaml --env MAESTRO_PASSWORD=<your_password>
#
# ### With JUnit output for CI:
#   maestro test maestro/all_auth_deep.yaml --env MAESTRO_PASSWORD=<pw> --format junit --output results.xml
#
# ### Live debug view (GUI):
#   maestro studio
#
# ## Architecture
#
# testIDs in FloatingNavBar (fully wired):
#   tab-home        → Home screen
#   tab-community   → Community screen
#   tab-plan        → Plan screen
#   tab-rewards     → Rewards screen
#   tab-profile     → Profile screen
#
# Test strategy:
# - Guest flows: clearState: true, all permissions denied, text-based selectors
# - Auth flows:  login_authenticated.yaml runs first, all subsequent flows reuse the session
#               via stopApp: false — no repeated login overhead
# - Password:    Never hardcoded. Always passed via --env MAESTRO_PASSWORD=... flag
#               or set in .maestro.env (gitignored)
#
# ## Security
# - .maestro.env is gitignored — your password is never committed to GitHub
# - Email is non-sensitive (test account) so it is safe in login_authenticated.yaml
# - For CI/CD: set MAESTRO_PASSWORD as a GitHub Actions secret, then pass with --env
#
# ## Known Limitations / Future Work
# - active_run.yaml and save_activity.yaml require location mock or real GPS
# - 2FA flow not testable (SMS code not automatable without Twilio integration)
# - Paywall screen not tested (RevenueCat sandbox required)
