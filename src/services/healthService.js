import { Platform, Alert } from 'react-native';
import AppleHealthKit from 'react-native-health';
import {
  initialize,
  requestPermission,
  readRecords,
  insertRecords,
  getGrantedPermissions,
  aggregateRecord,
  ExerciseType,
} from 'react-native-health-connect';

// iOS HealthKit permissions
const permissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
    ],
    write: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
    ],
  },
};

// Android Health Connect permissions
const androidPermissions = [
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'write', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'write', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'write', recordType: 'Distance' },
  { accessType: 'write', recordType: 'ExerciseSession' },
];

/**
 * Requests necessary health permissions based on platform
 * @returns {Promise<boolean>} Success state
 */
export const requestHealthPermissions = async () => {
  try {
    if (Platform.OS === 'ios') {
      return new Promise((resolve) => {
        AppleHealthKit.initHealthKit(permissions, (err, results) => {
          if (err) {
            console.error('[HealthKit] error initializing Healthkit: ', err);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } else if (Platform.OS === 'android') {
      const isInitialized = await initialize();
      if (!isInitialized) return false;
      
      const grantedPermissions = await getGrantedPermissions();
      // Only request if not fully granted
      // We can also just eagerly request
      await requestPermission(androidPermissions);
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`[HealthService] Error requesting permissions: ${error}`);
    return false;
  }
};

/**
 * Syncs a completed run back to HealthKit / Health Connect
 * @param {Object} runData - Standardized run object from Ruvo
 */
export const syncRunToHealth = async (runData) => {
  if (!runData || !runData.distance || !runData.duration) return null;

  try {
    const distanceMeters = runData.distance * 1000;
    const durationParts = runData.duration.split(':');
    if (durationParts.length !== 2 || isNaN(durationParts[0]) || isNaN(durationParts[1])) {
      console.warn('[HealthService] Invalid duration format, expected MM:SS:', runData.duration);
      return null;
    }
    const durationSeconds = parseInt(durationParts[0], 10) * 60 + parseInt(durationParts[1], 10);
    const calories = runData.calories || 0; // if available
    
    // We assume the run ended "now" and duration is subtracted.
    // In reality, you'd want to use runData.date if available.
    const endTime = runData.date ? new Date(runData.date) : new Date();
    const startTime = new Date(endTime.getTime() - durationSeconds * 1000);

    if (Platform.OS === 'ios') {
      return new Promise((resolve) => {
        // Write Distance Workout
        const options = {
          type: 'Running',
          startDate: startTime.toISOString(),
          endDate: endTime.toISOString(),
          energyBurned: calories,
          energyBurnedUnit: 'calorie',
          distance: distanceMeters,
          distanceUnit: 'meter',
        };

        AppleHealthKit.saveWorkout(options, (err, results) => {
          if (err) {
            console.error('[HealthKit] error saving workout:', err);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } else if (Platform.OS === 'android') {
      const records = [
        {
          recordType: 'Distance',
          distance: { value: distanceMeters, unit: 'meters' },
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
        {
          recordType: 'ExerciseSession',
          exerciseType: ExerciseType.RUNNING,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      ];

      if (calories > 0) {
        records.push({
          recordType: 'ActiveCaloriesBurned',
          energy: { value: calories, unit: 'kilocalories' },
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });
      }

      await insertRecords(records);
      return true;
    }
  } catch (error) {
    console.warn(`[HealthService] Error syncing run: ${error}`);
    return false;
  }
};

/**
 * Fetches today's steps, resting HR, and calories
 */
export const fetchTodayStats = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Platform.OS === 'ios') {
      return new Promise((resolve) => {
        let stats = { steps: 0, restingHR: 0, calories: 0 };
        
        // 1. Fetch Steps
        AppleHealthKit.getStepCount(
          { date: today.toISOString() },
          (err, stepsResult) => {
            if (!err && stepsResult) stats.steps = stepsResult.value;

            // 2. Fetch Resting HR (latest today or general)
            AppleHealthKit.getRestingHeartRate(
              { startDate: today.toISOString() },
              (errHR, hrResult) => {
                if (!errHR && hrResult && hrResult.length > 0) {
                  stats.restingHR = hrResult[0].value;
                }

                // 3. Fetch Calories
                AppleHealthKit.getActiveEnergyBurned(
                  { startDate: today.toISOString() },
                  (errCal, calResult) => {
                    if (!errCal && calResult && calResult.length > 0) {
                      // Summing all calorie records for today
                      stats.calories = calResult.reduce((sum, record) => sum + record.value, 0);
                    }
                    resolve(stats);
                  }
                );
              }
            );
          }
        );
      });
    } else if (Platform.OS === 'android') {
      const timeRangeFilter = {
        operator: 'between',
        startTime: today.toISOString(),
        endTime: new Date().toISOString(),
      };

      try {
        const [stepsResult, hrResult, caloriesResult] = await Promise.all([
          aggregateRecord({ recordType: 'Steps', timeRangeFilter }),
          aggregateRecord({ recordType: 'HeartRate', timeRangeFilter }),
          aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter }),
        ]);

        const steps = stepsResult.COUNT_TOTAL || 0;
        const restingHR = hrResult.BPM_AVG ? Math.round(hrResult.BPM_AVG) : 0;
        const calories = caloriesResult.ACTIVE_CALORIES_TOTAL
          ? caloriesResult.ACTIVE_CALORIES_TOTAL.inKilocalories
          : 0;

        return { steps, restingHR, calories };
      } catch (err) {
        console.warn('[HealthConnect] aggregate failed', err);
        return { steps: 0, restingHR: 0, calories: 0 };
      }
    }
  } catch (error) {
    console.warn(`[HealthService] Error fetching today stats: ${error}`);
    return { steps: 0, restingHR: 0, calories: 0 };
  }
};

/**
 * Returns latest heart rate readings (last 24h)
 */
export const fetchRecentHeartRate = async () => {
    try {
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);

        if (Platform.OS === 'ios') {
            return new Promise((resolve) => {
                AppleHealthKit.getHeartRateSamples({
                    startDate: yesterday.toISOString(),
                    endDate: new Date().toISOString(),
                    limit: 100
                }, (err, results) => {
                    if (err || !results) resolve([]);
                    else resolve(results.map(r => ({ bpm: r.value, date: r.startDate })));
                });
            });
        } else if (Platform.OS === 'android') {
            const hrData = await readRecords('HeartRate', {
                timeRangeFilter: {
                    operator: 'between',
                    startTime: yesterday.toISOString(),
                    endTime: new Date().toISOString()
                }
            });
            // Map HC structure
            return hrData.records.flatMap(r => (r.samples || []).map(s => ({ bpm: s.beatsPerMinute, date: s.time })));
        }
    } catch (e) {
        console.warn(`[HealthService] HR fetch error`, e);
        return [];
    }
};

/**
 * Starts observing heart rate changes from HealthKit
 * @param {Function} callback - Called with new HR value when it changes
 * @returns {Function} Stop observer
 */
export const observeHeartRate = (callback) => {
    if (Platform.OS !== 'ios') return () => {};

    const options = {
        date: new Date().toISOString(),
    };

    let subscription;
    try {
        AppleHealthKit.observeHeartRate(options, (err, result) => {
            if (!err && result && result.length > 0) {
                const latestHR = result[result.length - 1].value;
                callback(latestHR);
            }
        }, (sub) => {
            subscription = sub;
        });
    } catch (e) {
        console.warn('[HealthService] HR observe error', e);
    }

    // Return cleanup function
    return () => {
        if (subscription) {
            try {
                subscription.remove();
            } catch (e) { /* ignore */ }
        }
    };
};
