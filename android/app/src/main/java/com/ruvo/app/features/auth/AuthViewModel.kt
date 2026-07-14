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
import javax.inject.Inject

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
            val doc = firestore.collection("users").document(uid).get().await()
            if (doc.exists()) {
                val user = doc.toObject(RuvoUser::class.java)!!.copy(id = uid)
                _uiState.value = AuthUiState.Authenticated(user)
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
                auth.signInWithEmailAndPassword(email, password).await()
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(e.message ?: "Sign in failed")
            }
        }
    }

    fun signUpWithEmail(email: String, password: String, displayName: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                val result = auth.createUserWithEmailAndPassword(email, password).await()
                val uid = result.user!!.uid
                createUserProfile(uid, email, displayName)
                result.user?.sendEmailVerification()?.await()
                _uiState.value = AuthUiState.Onboarding
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(e.message ?: "Sign up failed")
            }
        }
    }

    fun signInWithGoogle(idToken: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                val credential = GoogleAuthProvider.getCredential(idToken, null)
                val result = auth.signInWithCredential(credential).await()
                val isNewUser = result.additionalUserInfo?.isNewUser == true
                if (isNewUser) {
                    val user = result.user!!
                    createUserProfile(user.uid, user.email ?: "", user.displayName ?: "")
                    _uiState.value = AuthUiState.Onboarding
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

    fun completeOnboarding(goal: String, level: String, weeklyDays: Int) {
        val uid = auth.currentUser?.uid ?: return
        viewModelScope.launch {
            try {
                firestore.collection("users").document(uid).update(
                    mapOf(
                        "runningGoal" to goal,
                        "fitnessLevel" to level,
                        "weeklyRunDays" to weeklyDays,
                        "onboardingComplete" to true,
                    )
                ).await()
                loadUser(uid)
            } catch (_: Exception) {}
        }
    }

    private suspend fun createUserProfile(uid: String, email: String, displayName: String) {
        val user = mapOf(
            "email" to email,
            "displayName" to displayName,
            "createdAt" to com.google.firebase.Timestamp.now(),
            "xp" to 0L,
            "coins" to 0L,
            "level" to 1,
            "streakDays" to 0,
            "totalDistanceKm" to 0.0,
            "totalRuns" to 0
        )
        firestore.collection("users").document(uid).set(user).await()
    }
}
