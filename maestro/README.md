appId: com.antoinekh.ruvoapplication
name: Ruvo App E2E Test Suite

# ======================================
# Ruvo App - Maestro E2E Test Flows
# ======================================
#
# ## Prerequisites
# - Maestro CLI installed (see https://docs.maestro.dev/get-started/quickstart)
# - Android emulator running or device connected
# - App built and installed (APK or EAS build)
#
# ## Quick Start
#   maestro test maestro/all_guest_flows.yaml
#
# ## Project Structure
# maestro/
#   smoke.yaml                 - Quick launch test
#   welcome_flow.yaml          - Welcome screen elements
#   login_flow.yaml            - Login form + navigation
#   signup_flow.yaml           - Signup form elements
#   forgot_password_flow.yaml  - Forgot password screen
#   onboarding_flow.yaml       - Onboarding wizard (5 steps)
#   home_screen.yaml           - Main dashboard (auth required)
#   all_guest_flows.yaml       - Run all guest flows
#   all_auth_flows.yaml        - Run authenticated flows
#   README.md                  - This file
#
# ## Running Tests
#
# ### Single flow:
#   maestro test maestro/smoke.yaml
#
# ### All guest flows (clean state each time):
#   maestro test maestro/all_guest_flows.yaml
#
# ### Authenticated flows (must be logged in first):
#   maestro test maestro/all_auth_flows.yaml
#
# ### With JUnit output:
#   maestro test maestro/all_guest_flows.yaml --format junit --output results.xml
#
# ### Maestro Studio (GUI):
#   Download from https://studio.maestro.dev/
#   Select workspace = project root, run flows from GUI
#
# ## Test Strategy
#
# Guest flows:
# - Use `clearState: true` for clean state each run
# - Deny all permissions (location, notifications)
# - Text-based selectors only (no testIDs in codebase yet)
# - Cover: Welcome → Onboarding → Login → SignUp → ForgotPassword
#
# Authenticated flows:
# - Use `stopApp: false` to preserve login state
# - Only test HomeScreen elements reachable via text
# - Community/Profile/Settings screens not navigable via text (icon-only tab bar)
#   Future fix: add testIDs to FloatingNavBar + screen header icons
#
# ## Adding testIDs (recommended)
# To unlock full navigation testing, add testIDs to key components:
#
#   <TouchableOpacity testID="start_journey_button">
#   <TextInput testID="email_input">
#   <TouchableOpacity testID="nav_home">
#   <TouchableOpacity testID="nav_community">
#
# Then select by: - tapOn:
#                    id: "start_journey_button"
#
# ## Current Limitations
# - No testIDs → icon-only buttons (tab bar, header icons) not tappable
# - Firebase Auth needed for real signup/login → guest flows limit UI checks
# - Onboarding step 5 permissions require user interaction (Switch toggles)
# - HomeScreen requires prior login (can't automate auth setup)
