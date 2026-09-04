package com.ruvo.app.features.auth

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.FirebaseTooManyRequestsException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.core.model.RuvoUser
import com.ruvo.app.core.notifications.RunReminderScheduler
import com.ruvo.app.core.persistence.RateLimitStore
import com.ruvo.app.core.persistence.formatLockoutRemaining
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull
import javax.inject.Inject

// A flaky/throttled connection can otherwise leave auth.*().await() or a
// Firestore write suspended forever with nothing to catch — since Loading
// maps to a full-screen SplashScreen (RuvoApp.kt) with no retry affordance,
// that's not a spinner, it's a permanently bricked app until force-killed.
// Reproduced live: sign-up hung on the splash indefinitely (13+ min, never
// resolved) against this dev sandbox's throttled Firestore emulator
// connection (see RN_ANDROID_PORT_MAPPING.md's "too_many_pings" note).
private const val AUTH_NETWORK_TIMEOUT_MS = 15_000L
private const val TIMEOUT_ERROR_MESSAGE = "Connection timed out. Check your connection and try again."

// loadUser()'s post-auth profile read retries this many times (with a short
// delay between) before giving up — a momentary network blip shouldn't read
// as a sign-out. Bounded and short so a *genuine* offline user still lands
// on an honest error within a few seconds, not a long silent hang.
private const val LOAD_USER_MAX_ATTEMPTS = 3
private const val LOAD_USER_RETRY_DELAY_MS = 1_500L

// RN keys both Login and SignUp's rate limiting under the same 'auth'
// AsyncStorage namespace (see RateLimitStore.kt) — kept identical here.
private const val AUTH_RATE_LIMIT_ACTION = "auth"

sealed interface AuthUiState {
    data object Loading : AuthUiState
    data object Unauthenticated : AuthUiState
    data object Onboarding : AuthUiState
    data class Authenticated(val user: RuvoUser) : AuthUiState
    data class Error(val message: String) : AuthUiState
}

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
    private val rateLimitStore: RateLimitStore,
    private val reminderScheduler: RunReminderScheduler,
) : ViewModel() {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Loading)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    // Real bug found 2026-08-27: signInWithEmail/signUpWithEmail/signInWithGoogle
    // used to set _uiState.value = AuthUiState.Loading for the duration of the
    // network call. RuvoApp.kt's top-level `when` renders a *different*
    // composable branch for Loading (a bare SplashScreen()) than for
    // Unauthenticated/Error (AuthGraph(authViewModel), which owns its own
    // rememberNavController()). Swapping through that Loading branch and back —
    // which happens on every single failed sign-in/sign-up attempt — tore down
    // and recreated AuthGraph's NavHost each time, silently bouncing the user
    // back to the Welcome/Landing screen (losing whatever they'd typed) instead
    // of keeping them on Login/SignUp to see the error. This state fixes that:
    // Loading now only ever represents the true initial app-boot state (its
    // MutableStateFlow default, before the first observeAuthState() callback);
    // in-flight submit state lives here instead, exactly like LoginScreen/
    // SignUpScreen's own inline button spinner already expected.
    private val _isSubmitting = MutableStateFlow(false)
    val isSubmitting: StateFlow<Boolean> = _isSubmitting.asStateFlow()

    init {
        observeAuthState()
    }

    private fun observeAuthState() {
        auth.addAuthStateListener { firebaseAuth ->
            val user = firebaseAuth.currentUser
            if (user == null) {
                _uiState.value = AuthUiState.Unauthenticated
            } else {
                viewModelScope.launch { loadUser(user.uid) }
            }
        }
    }

    // Real bug found 2026-09-04, live-reproduced against this dev sandbox's
    // flaky network: signUpWithEmail used to set _uiState to Onboarding
    // itself on success, racing this function — which observeAuthState()'s
    // listener *also* independently triggers the moment FirebaseAuth's
    // internal user object changes, milliseconds after auth.createUserWith-
    // EmailAndPassword() resolves. If this call's Firestore read then hit any
    // transient failure, its catch block (below) used to set Unauthenticated,
    // silently overwriting the signup's own just-set Onboarding state — the
    // account was genuinely created (confirmed via FirebaseAuth logs), but
    // the user landed back on the Welcome screen with zero indication
    // anything happened, since Welcome (AuthGraph's start destination) never
    // renders AuthUiState.Error's message the way Login/SignUp do. Two
    // changes here fix that: signUpWithEmail no longer writes _uiState on
    // success — this function is now the *only* writer of post-auth-success
    // state, same as signInWithEmail already relied on (see its "listener
    // fires and takes it from here" comment) — and a transient read failure
    // now retries a few times before giving up, since a momentary network
    // blip (the common real-world case) shouldn't read the same as an actual
    // sign-out.
    private suspend fun loadUser(uid: String) {
        var lastError: Exception? = null
        repeat(LOAD_USER_MAX_ATTEMPTS) { attempt ->
            try {
                val doc = withTimeoutOrNull(AUTH_NETWORK_TIMEOUT_MS) {
                    firestore.collection("users").document(uid).get().await()
                } ?: run {
                    _uiState.value = AuthUiState.Error(TIMEOUT_ERROR_MESSAGE)
                    return
                }
                if (doc.exists()) {
                    // Real bug found 2026-08-17: doc.toObject(RuvoUser::class.java)
                    // throws for every real account — Firestore's typed mapper can't
                    // convert `location` (a real {country: ...} map, same field
                    // ProfileViewModel/EditProfileSheet read/write) into RuvoUser's
                    // `location: String?`. That exception was already caught below,
                    // but the catch path (AuthUiState.Unauthenticated) silently
                    // bounces a signed-in user back to the login screen — every
                    // sign-in/cold-start looked like an indefinite hang or a mystery
                    // sign-out. AuthUiState.Authenticated's `user` payload isn't
                    // actually read anywhere (every screen loads its own data via
                    // its own ViewModel, same as everywhere else in this codebase)
                    // — only `onboardingComplete` matters here — so this reads the
                    // raw map like every other ViewModel does, instead of patching
                    // RuvoUser's schema to chase a model nothing consumes.
                    val data = doc.data
                    val onboardingComplete = data?.get("onboardingComplete") as? Boolean ?: false
                    val user = RuvoUser(
                        id = uid,
                        email = data?.get("email") as? String ?: "",
                        displayName = data?.get("name") as? String ?: data?.get("displayName") as? String ?: "",
                        onboardingComplete = onboardingComplete,
                    )
                    _uiState.value = if (onboardingComplete) {
                        AuthUiState.Authenticated(user)
                    } else {
                        AuthUiState.Onboarding
                    }
                } else {
                    _uiState.value = AuthUiState.Onboarding
                }
                return
            } catch (e: Exception) {
                lastError = e
                if (attempt < LOAD_USER_MAX_ATTEMPTS - 1) delay(LOAD_USER_RETRY_DELAY_MS)
            }
        }
        Log.e("AuthViewModel", "loadUser failed for uid=$uid after $LOAD_USER_MAX_ATTEMPTS attempts", lastError)
        // firebaseAuth.currentUser is non-null here — that's the only way
        // observeAuthState() ever calls loadUser(). This user IS signed in;
        // we just couldn't confirm their profile after retrying. Error (not
        // Unauthenticated) says that honestly instead of claiming they're
        // logged out, matching the timeout branch above.
        _uiState.value = AuthUiState.Error("Couldn't load your profile. Check your connection and try again.")
    }

    fun signInWithEmail(email: String, password: String) {
        viewModelScope.launch {
            val limit = rateLimitStore.check(AUTH_RATE_LIMIT_ACTION)
            if (!limit.allowed) {
                _uiState.value = AuthUiState.Error("Too many attempts. ${formatLockoutRemaining(limit.remainingMs)}")
                return@launch
            }
            clearError()
            _isSubmitting.value = true
            try {
                val signedIn = withTimeoutOrNull(AUTH_NETWORK_TIMEOUT_MS) {
                    auth.signInWithEmailAndPassword(email, password).await()
                }
                if (signedIn == null) {
                    _uiState.value = AuthUiState.Error(TIMEOUT_ERROR_MESSAGE)
                } else {
                    rateLimitStore.resetAttempts(AUTH_RATE_LIMIT_ACTION)
                }
                // On success, observeAuthState()'s listener fires and takes it from here.
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(onFailedAttempt(e))
            } finally {
                _isSubmitting.value = false
            }
        }
    }

    fun signUpWithEmail(email: String, password: String, displayName: String) {
        viewModelScope.launch {
            val limit = rateLimitStore.check(AUTH_RATE_LIMIT_ACTION)
            if (!limit.allowed) {
                _uiState.value = AuthUiState.Error("Too many attempts. ${formatLockoutRemaining(limit.remainingMs)}")
                return@launch
            }
            clearError()
            _isSubmitting.value = true
            try {
                val completed = withTimeoutOrNull(AUTH_NETWORK_TIMEOUT_MS) {
                    val result = auth.createUserWithEmailAndPassword(email, password).await()
                    val uid = result.user!!.uid
                    createUserProfile(uid, email, displayName)
                    result.user?.sendEmailVerification()?.await()
                }
                if (completed == null) {
                    _uiState.value = AuthUiState.Error(TIMEOUT_ERROR_MESSAGE)
                } else {
                    rateLimitStore.resetAttempts(AUTH_RATE_LIMIT_ACTION)
                    // On success, observeAuthState()'s listener fires and takes it
                    // from here — same as signInWithEmail. Previously set Onboarding
                    // directly here too, which raced that listener's own loadUser()
                    // call; see loadUser()'s comment for the bug that caused.
                }
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(onFailedAttempt(e))
            } finally {
                _isSubmitting.value = false
            }
        }
    }

    // Faithful port of LoginScreen.js/SignUpScreen.js's recordFailedAttempt('auth')
    // + error-code-specific messaging (RN_SOURCE_ARCHIVE.md §7). Not ported: RN's
    // fire-and-forget `notifyLoginFailure` Cloud Function call on the failure that
    // trips the lock — per the "Known Backend Bugs" table that function doesn't
    // exist even in RN's own backend.
    private suspend fun onFailedAttempt(e: Exception): String {
        val record = rateLimitStore.recordFailedAttempt(AUTH_RATE_LIMIT_ACTION)
        if (record.locked) {
            return "Too many attempts. ${formatLockoutRemaining(record.durationMs)}"
        }
        return mapAuthError(e)
    }

    private fun mapAuthError(e: Exception): String = when (e) {
        is FirebaseNetworkException -> "Network error. Check your connection and try again."
        is FirebaseTooManyRequestsException -> "Too many attempts. Please wait a moment and try again."
        is FirebaseAuthUserCollisionException -> "An account with this email already exists."
        is FirebaseAuthInvalidUserException -> when (e.errorCode) {
            "ERROR_USER_DISABLED" -> "This account has been disabled. Contact support if you think this is a mistake."
            else -> "We couldn't find an account with that email."
        }
        is FirebaseAuthInvalidCredentialsException -> when (e.errorCode) {
            "ERROR_INVALID_EMAIL" -> "That email address doesn't look right."
            "ERROR_WEAK_PASSWORD" -> "That password is too weak."
            else -> "Incorrect email or password."
        }
        is FirebaseAuthException -> e.message ?: "Something went wrong. Please try again."
        else -> e.message ?: "Something went wrong. Please try again."
    }

    fun signInWithGoogle(idToken: String) {
        viewModelScope.launch {
            clearError()
            _isSubmitting.value = true
            try {
                val completed = withTimeoutOrNull(AUTH_NETWORK_TIMEOUT_MS) {
                    val credential = GoogleAuthProvider.getCredential(idToken, null)
                    val result = auth.signInWithCredential(credential).await()
                    val isNewUser = result.additionalUserInfo?.isNewUser == true
                    if (isNewUser) {
                        val user = result.user!!
                        createUserProfile(user.uid, user.email ?: "", user.displayName ?: "")
                    }
                    isNewUser
                }
                when (completed) {
                    null -> _uiState.value = AuthUiState.Error(TIMEOUT_ERROR_MESSAGE)
                    true -> _uiState.value = AuthUiState.Onboarding
                    // Existing user: observeAuthState()'s listener already fired and takes it from here.
                    false -> {}
                }
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(e.message ?: "Google sign in failed")
            } finally {
                _isSubmitting.value = false
            }
        }
    }

    fun sendPasswordReset(email: String) {
        viewModelScope.launch {
            try {
                auth.sendPasswordResetEmail(email).await()
            } catch (_: Exception) {}
        }
    }

    fun signOut() {
        auth.signOut()
        _uiState.value = AuthUiState.Unauthenticated
    }

    fun clearError() {
        if (_uiState.value is AuthUiState.Error) {
            _uiState.value = AuthUiState.Unauthenticated
        }
    }

    // gender/dob/weight/height/unitSystem/runFrequency: OnboardingScreen's
    // Bio + Frequency steps, built 2026-08-25 (RN_SOURCE_ARCHIVE.md §7 steps
    // 3-4) — real DEFAULT_USER_DATA field names (UserContext.js), the only
    // place in the whole app that ever writes them. Optional/nullable so
    // existing call sites (none currently, but keeps the signature honest)
    // aren't forced to supply values that don't apply to them.
    fun completeOnboarding(
        goal: String,
        level: String,
        weeklyDays: Int,
        gender: String? = null,
        dob: String? = null,
        weight: Double? = null,
        height: Double? = null,
        unitSystem: String? = null,
        runFrequency: Int? = null,
        // RN_SOURCE_ARCHIVE.md §7's real `profileOverrides` shape has both
        // `selectedDays` and `runDays` (buildProfile() maps the raw selection
        // to full day names for both — a real redundant-field RN quirk, same
        // family as displayName/name elsewhere in this app, not invented
        // here) plus `notificationTime`. All three previously had no path to
        // ever be set: the old Schedule step only ever collected a day
        // *count*, never specific days or a time.
        selectedDays: List<String>? = null,
        notificationTime: String? = null,
    ) {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            try {
                val completed = withTimeoutOrNull(AUTH_NETWORK_TIMEOUT_MS) {
                    // .update() rather than .set(merge=true) here used to fail outright
                    // ("no entity to update") whenever createUserProfile()'s original
                    // .set() write from sign-up hadn't landed yet (a slow/flaky
                    // connection during sign-up, reproduced live in this dev sandbox) —
                    // permanently stranding the user on the onboarding wizard with no
                    // way to ever complete it, since every retry hit the same missing-
                    // document error. merge=true creates the doc if needed, same as a
                    // fresh createUserProfile() would, so this is now self-healing.
                    val fields = mutableMapOf<String, Any>(
                        "runningGoal" to goal,
                        "fitnessLevel" to level,
                        "weeklyRunDays" to weeklyDays,
                        "onboardingComplete" to true,
                    )
                    gender?.let { fields["gender"] = it }
                    dob?.let { fields["dob"] = it }
                    weight?.let { fields["weight"] = it }
                    height?.let { fields["height"] = it }
                    unitSystem?.let { fields["unitSystem"] = it }
                    runFrequency?.let { fields["runFrequency"] = it }
                    selectedDays?.let { fields["selectedDays"] = it; fields["runDays"] = it }
                    notificationTime?.let { fields["notificationTime"] = it }
                    firestore.collection("users").document(uid).set(
                        fields,
                        com.google.firebase.firestore.SetOptions.merge(),
                    ).await()
                    loadUser(uid)
                }
                if (completed == null) {
                    _uiState.value = AuthUiState.Error(TIMEOUT_ERROR_MESSAGE)
                }
            } catch (e: Exception) {
                Log.e("AuthViewModel", "completeOnboarding failed for uid=$uid", e)
                _uiState.value = AuthUiState.Error(e.message ?: "Couldn't save your info")
            }
        }
    }

    // Thin delegate so OnboardingScreen's PermissionsSection doesn't need its
    // own Hilt entry point for RunReminderScheduler — this ViewModel is
    // already in scope there via hiltViewModel(). Called the moment
    // notification permission is (or already was) granted on the Ready step.
    fun scheduleRunReminders(selectedDays: Set<java.time.DayOfWeek>, hour: Int, minute: Int, goal: String) {
        reminderScheduler.scheduleWeeklyReminders(selectedDays, hour, minute, goal)
    }

    private suspend fun createUserProfile(uid: String, email: String, displayName: String) {
        val now = com.google.firebase.Timestamp.now()
        val user = mapOf(
            "email" to email,
            "displayName" to displayName,
            "createdAt" to now,
            "xp" to 0L,
            "coins" to 0L,
            "level" to 1,
            "streakDays" to 0,
            "totalDistanceKm" to 0.0,
            "totalRuns" to 0,
            "onboardingComplete" to false,
            "referralCode" to generateReferralCode(displayName),
            // Canonical field names shared with the backend Cloud Functions and
            // other Ruvo clients, which read/write "name"/"joinedAt"/"totalKm"/
            // "weeklyDistance" rather than the aliases above.
            "name" to displayName,
            "joinedAt" to now,
            "totalKm" to 0.0,
            "weeklyDistance" to 0.0,
        )
        firestore.collection("users").document(uid).set(user).await()
    }

    private fun generateReferralCode(name: String): String {
        val firstName = name.split(" ").first().uppercase().filter { it in 'A'..'Z' }.take(4).ifEmpty { "RUNR" }
        val suffix = (1000..9999).random()
        return "$firstName$suffix"
    }
}
