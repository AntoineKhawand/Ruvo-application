package com.ruvo.app.features.auth

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.firestore.FirebaseFirestore
import com.ruvo.app.core.model.RuvoUser
import dagger.hilt.android.lifecycle.HiltViewModel
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
) : ViewModel() {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Loading)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

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

    private suspend fun loadUser(uid: String) {
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
        } catch (e: Exception) {
            Log.e("AuthViewModel", "loadUser failed for uid=$uid", e)
            _uiState.value = AuthUiState.Unauthenticated
        }
    }

    fun signInWithEmail(email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                val signedIn = withTimeoutOrNull(AUTH_NETWORK_TIMEOUT_MS) {
                    auth.signInWithEmailAndPassword(email, password).await()
                }
                if (signedIn == null) {
                    _uiState.value = AuthUiState.Error(TIMEOUT_ERROR_MESSAGE)
                }
                // On success, observeAuthState()'s listener fires and takes it from here.
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(e.message ?: "Sign in failed")
            }
        }
    }

    fun signUpWithEmail(email: String, password: String, displayName: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
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
                    _uiState.value = AuthUiState.Onboarding
                }
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(e.message ?: "Sign up failed")
            }
        }
    }

    fun signInWithGoogle(idToken: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
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
