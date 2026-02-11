import { BADGES } from '../constants/badges';

/**
 * Checks if the user earned any NEW badges based on their latest run.
 * @param {Object} currentRun - The run object being saved (distance, duration, date, etc.)
 * @param {Array} runHistory - The user's PREVIOUS run history (before this current run is added).
 * @param {Array} currentBadges - Array of badge IDs (strings) or objects the user already has.
 * @returns {Array} - Array of newly unlocked badge objects.
 */
export const checkNewBadges = (currentRun, runHistory, currentBadges) => {
    const newBadges = [];

    // Normalize currentBadges to a set of IDs for fast lookup
    // Handle case where currentBadges might be objects or strings
    const ownedBadgeIds = new Set(
        (currentBadges || []).map(b => (typeof b === 'string' ? b : b.id))
    );

    BADGES.forEach(badge => {
        // 1. Skip if already owned
        if (ownedBadgeIds.has(badge.id)) return;

        // 2. Check condition
        try {
            if (badge.condition(currentRun, runHistory)) {
                // Create a serializable badge object (no functions)
                const serializableBadge = {
                    id: badge.id,
                    name: badge.name,
                    description: badge.description,
                    icon: badge.icon,
                    color: badge.color,
                    category: badge.category,
                    earnedAt: new Date().toISOString()
                };
                newBadges.push(serializableBadge);
            }
        } catch (e) {
            console.warn(`Error evaluating badge ${badge.id}:`, e);
        }
    });

    return newBadges;
};
