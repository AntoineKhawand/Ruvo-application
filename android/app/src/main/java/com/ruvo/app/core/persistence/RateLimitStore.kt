package com.ruvo.app.core.persistence

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

private val Context.rateLimitDataStore: DataStore<Preferences> by preferencesDataStore(name = "rate_limit")

private const val MAX_ATTEMPTS = 5
private const val BASE_LOCKOUT_MS = 30_000L

data class RateLimitCheck(val allowed: Boolean, val remainingMs: Long)
data class RateLimitRecord(val locked: Boolean, val durationMs: Long, val attempts: Int)

// Faithful port of RN's utils/rateLimit.js (checkRateLimit/recordFailedAttempt/
// resetAttempts — RN_SOURCE_ARCHIVE.md §7, raw source in
// docs/rn-reference/rateLimit.js): same MAX_ATTEMPTS=5, same 30s-base lockout
// that doubles per attempt past the max, same shared "auth" namespace across
// Login AND SignUp (RN's own deliberate design — a failed sign-up attempt
// counts toward the same lockout as a failed login, and vice versa; only
// OnboardingSignUpScreen skips this in RN, which the archive itself flags as
// an inconsistency, not a spec to replicate). Storage is DataStore Preferences
// (same pattern as AppLockStore.kt) instead of RN's AsyncStorage — a storage
// swap, not a behavior change.
//
// NOT ported: RN's `notifyLoginFailure` Cloud Function fire-and-forget call on
// the failure that trips the lock — per the "Known Backend Bugs" table this
// function doesn't exist even in RN's own backend, so it always silently
// failed there too; nothing real to port. Also NOT ported: RN's lockout alert
// copy hardcoding "locked for 15 minutes" regardless of the actual
// 30s-doubling duration — the archive flags this as a bug worth fixing, not a
// spec to copy, so callers should compute and show the real remaining time
// (see formatLockoutRemaining below) instead of a fixed, wrong number.
@Singleton
class RateLimitStore @Inject constructor(@ApplicationContext private val context: Context) {

    private fun attemptsKey(action: String) = intPreferencesKey("rate_limit_attempts_$action")
    private fun lockUntilKey(action: String) = longPreferencesKey("rate_limit_lock_until_$action")

    suspend fun check(action: String): RateLimitCheck {
        val prefs = context.rateLimitDataStore.data.first()
        val lockUntil = prefs[lockUntilKey(action)] ?: 0L
        val now = System.currentTimeMillis()
        if (lockUntil > now) {
            return RateLimitCheck(allowed = false, remainingMs = lockUntil - now)
        }
        if (lockUntil != 0L) {
            // Lockout expired — clear it, same as RN's AsyncStorage.removeItem.
            context.rateLimitDataStore.edit { it.remove(lockUntilKey(action)) }
        }
        return RateLimitCheck(allowed = true, remainingMs = 0L)
    }

    suspend fun recordFailedAttempt(action: String, customMax: Int = MAX_ATTEMPTS): RateLimitRecord {
        var attempts = 0
        context.rateLimitDataStore.edit { prefs ->
            attempts = (prefs[attemptsKey(action)] ?: 0) + 1
            prefs[attemptsKey(action)] = attempts
        }
        if (attempts >= customMax) {
            val overloadCount = attempts - customMax
            // BASE_LOCKOUT_MS * 2^overloadCount, matches RN's Math.pow(2, overloadCount).
            val durationMs = BASE_LOCKOUT_MS * (1L shl overloadCount.coerceAtMost(30))
            val lockUntil = System.currentTimeMillis() + durationMs
            context.rateLimitDataStore.edit { it[lockUntilKey(action)] = lockUntil }
            return RateLimitRecord(locked = true, durationMs = durationMs, attempts = attempts)
        }
        return RateLimitRecord(locked = false, durationMs = 0L, attempts = attempts)
    }

    suspend fun resetAttempts(action: String) {
        context.rateLimitDataStore.edit { prefs ->
            prefs.remove(attemptsKey(action))
            prefs.remove(lockUntilKey(action))
        }
    }
}

// Real remaining time, in place of RN's hardcoded (and wrong) "15 minutes" copy.
fun formatLockoutRemaining(remainingMs: Long): String {
    val totalSeconds = ((remainingMs + 999) / 1000).coerceAtLeast(1)
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return if (minutes > 0) "Try again in ${minutes}m ${seconds}s." else "Try again in ${seconds}s."
}
