import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@ruvo_pending_runs';

// Network-related Firebase error codes that warrant queuing (not logic errors)
const RETRYABLE_CODES = new Set([
  'unavailable',
  'deadline-exceeded',
  'unknown',
  'internal',
]);

export const isRetryableError = (error) => {
  if (!error) return false;
  const code = error.code || '';
  // Firebase Functions errors have codes like "functions/unavailable"
  const shortCode = code.replace('functions/', '');
  if (RETRYABLE_CODES.has(shortCode)) return true;
  // Plain network failure
  const msg = (error.message || '').toLowerCase();
  return msg.includes('network') || msg.includes('failed to fetch') || msg.includes('timeout');
};

export const savePendingRun = async (runEntry, calculatedUpdates) => {
  try {
    const existing = await getPendingRuns();
    // Use a unique ID so retries are idempotent
    const pendingItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      runEntry: { ...runEntry, savedOfflineAt: Date.now() },
      calculatedUpdates,
      queuedAt: Date.now(),
    };
    existing.push(pendingItem);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
    console.log('[PendingRuns] Run queued for later sync:', pendingItem.id);
    return pendingItem.id;
  } catch (e) {
    console.warn('[PendingRuns] Failed to queue run:', e.message);
    return null;
  }
};

export const getPendingRuns = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const removePendingRun = async (id) => {
  try {
    const existing = await getPendingRuns();
    const filtered = existing.filter(r => r.id !== id);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[PendingRuns] Failed to remove pending run:', e.message);
  }
};

export const clearPendingRuns = async () => {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch {}
};
