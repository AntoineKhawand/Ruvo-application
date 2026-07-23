import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 30000; // 30 seconds base

/**
 * Checks if the current action is rate-limited.
 * @param {string} action The namespace for the action (e.g., 'login', 'signup', 'auth')
 * @returns {object} { allowed: boolean, remainingMs: number }
 */
export const checkRateLimit = async (action) => {
    try {
        const lockoutKey = `@rate_limit_lock_${action}`;
        const lockoutUntilStr = await AsyncStorage.getItem(lockoutKey);

        if (lockoutUntilStr) {
            const lockoutUntil = parseInt(lockoutUntilStr, 10);
            const now = Date.now();

            if (now < lockoutUntil) {
                // Still locked out
                return { allowed: false, remainingMs: lockoutUntil - now };
            } else {
                // Lockout expired, clear it
                await AsyncStorage.removeItem(lockoutKey);
            }
        }
        return { allowed: true, remainingMs: 0 };
    } catch (e) {
        console.warn('Rate limit check failed', e);
        return { allowed: true, remainingMs: 0 }; // Fail open
    }
};

/**
 * Records a failed attempt and locks out if threshold exceeded.
 * @param {string} action The namespace for the action
 * @param {number} customMax Optional custom max attempts
 */
export const recordFailedAttempt = async (action, customMax = MAX_ATTEMPTS) => {
    try {
        const attemptsKey = `@rate_limit_attempts_${action}`;
        const lockoutKey = `@rate_limit_lock_${action}`;

        let currentAttempts = 0;
        const attemptsStr = await AsyncStorage.getItem(attemptsKey);
        if (attemptsStr) {
            currentAttempts = parseInt(attemptsStr, 10);
        }

        currentAttempts += 1;
        await AsyncStorage.setItem(attemptsKey, currentAttempts.toString());

        if (currentAttempts >= customMax) {
            // Apply exponential backoff: past max attempts, double time every attempt
            const overloadCount = currentAttempts - customMax;
            const lockoutDuration = BASE_LOCKOUT_MS * Math.pow(2, overloadCount);

            const lockoutUntil = Date.now() + lockoutDuration;
            await AsyncStorage.setItem(lockoutKey, lockoutUntil.toString());

            return { locked: true, duration: lockoutDuration };
        }

        return { locked: false, attempts: currentAttempts };

    } catch (e) {
        console.warn('Failed to record attempt', e);
        return { locked: false, attempts: 0 };
    }
};

/**
 * Resets the attempt counter on successful action completion.
 * @param {string} action The namespace for the action
 */
export const resetAttempts = async (action) => {
    try {
        const attemptsKey = `@rate_limit_attempts_${action}`;
        const lockoutKey = `@rate_limit_lock_${action}`;

        await AsyncStorage.removeItem(attemptsKey);
        await AsyncStorage.removeItem(lockoutKey);
    } catch (e) {
        console.warn('Failed to reset attempts', e);
    }
};
