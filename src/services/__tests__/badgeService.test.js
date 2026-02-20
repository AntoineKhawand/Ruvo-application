/**
 * Unit Tests for badgeService.js
 *
 * Tests badge unlock logic including:
 * - First run badge
 * - Distance milestone badges (5K, 10K, Half Marathon)
 * - Time-of-day badges (Early Bird, Night Owl)
 * - Streak/consistency badges
 * - Already-owned badge deduplication
 */

const { checkNewBadges } = require('../badgeService');

// --- HELPER FACTORIES ---
const makeRun = (overrides = {}) => ({
    distance: 5,
    duration: '30:00',
    pace: '6:00',
    date: new Date('2026-01-15T10:00:00').toISOString(),
    elevation: 50,
    ...overrides,
});

const makeHistory = (count, overrides = {}) =>
    Array.from({ length: count }, (_, i) =>
        makeRun({
            date: new Date(2026, 0, i + 1, 10, 0, 0).toISOString(),
            ...overrides,
        })
    );

describe('badgeService - checkNewBadges', () => {
    it('should return an array', () => {
        const result = checkNewBadges(makeRun(), [], []);
        expect(Array.isArray(result)).toBe(true);
    });

    // --- FIRST RUN ---
    it('should award "First Steps" badge on first run', () => {
        const result = checkNewBadges(makeRun(), [], []);
        const firstSteps = result.find(b => b.id === 'b_first_run');
        expect(firstSteps).toBeDefined();
        expect(firstSteps.name).toBe('First Steps');
    });

    it('should NOT award "First Steps" if user already has runs', () => {
        const result = checkNewBadges(makeRun(), [makeRun()], []);
        const firstSteps = result.find(b => b.id === 'b_first_run');
        expect(firstSteps).toBeUndefined();
    });

    // --- DISTANCE MILESTONES ---
    it('should award "High Five" badge for 5km+ run', () => {
        const result = checkNewBadges(makeRun({ distance: 5.2 }), [makeRun()], []);
        const badge = result.find(b => b.id === 'b_5k');
        expect(badge).toBeDefined();
    });

    it('should NOT award "High Five" for sub-5km run', () => {
        const result = checkNewBadges(makeRun({ distance: 4.9 }), [makeRun()], []);
        const badge = result.find(b => b.id === 'b_5k');
        expect(badge).toBeUndefined();
    });

    it('should award "10K Finisher" for 10km+ run', () => {
        const result = checkNewBadges(makeRun({ distance: 10.5 }), [makeRun()], []);
        const badge = result.find(b => b.id === 'b_10k');
        expect(badge).toBeDefined();
    });

    it('should award "Half Marathon" for 21.1km+ run', () => {
        const result = checkNewBadges(makeRun({ distance: 21.2 }), [makeRun()], []);
        const badge = result.find(b => b.id === 'b_half');
        expect(badge).toBeDefined();
    });

    // --- DEDUPLICATION ---
    it('should NOT award a badge the user already owns (string IDs)', () => {
        const result = checkNewBadges(makeRun({ distance: 10 }), [makeRun()], ['b_10k']);
        const badge = result.find(b => b.id === 'b_10k');
        expect(badge).toBeUndefined();
    });

    it('should NOT award a badge the user already owns (object IDs)', () => {
        const result = checkNewBadges(makeRun({ distance: 10 }), [makeRun()], [{ id: 'b_10k' }]);
        const badge = result.find(b => b.id === 'b_10k');
        expect(badge).toBeUndefined();
    });

    // --- TIME OF DAY ---
    it('should award "Early Bird" for runs before 7 AM', () => {
        const earlyRun = makeRun({ date: new Date('2026-01-15T05:30:00').toISOString() });
        const result = checkNewBadges(earlyRun, [makeRun()], []);
        const badge = result.find(b => b.id === 'b_early_bird');
        expect(badge).toBeDefined();
    });

    it('should award "Night Owl" for runs after 8 PM', () => {
        const lateRun = makeRun({ date: new Date('2026-01-15T21:00:00').toISOString() });
        const result = checkNewBadges(lateRun, [makeRun()], []);
        const badge = result.find(b => b.id === 'b_night_owl');
        expect(badge).toBeDefined();
    });

    // --- CONSISTENCY ---
    it('should award "Dedicated" on 10th run (9 history + 1 current)', () => {
        const result = checkNewBadges(makeRun(), makeHistory(9), []);
        const badge = result.find(b => b.id === 'b_10_runs');
        expect(badge).toBeDefined();
    });

    it('should NOT award "Dedicated" before 10th run', () => {
        const result = checkNewBadges(makeRun(), makeHistory(7), []);
        const badge = result.find(b => b.id === 'b_10_runs');
        expect(badge).toBeUndefined();
    });

    // --- CENTURY CLUB ---
    it('should award "Century Club" when total distance reaches 100km', () => {
        // 9 runs of 10km each + 1 current of 10km = 100km
        const history = makeHistory(9, { distance: 10 });
        const result = checkNewBadges(makeRun({ distance: 10 }), history, []);
        const badge = result.find(b => b.id === 'b_century_club');
        expect(badge).toBeDefined();
    });

    // --- OUTPUT FORMAT ---
    it('should return serializable badge objects (no functions)', () => {
        const result = checkNewBadges(makeRun(), [], []);
        result.forEach(badge => {
            expect(badge).toHaveProperty('id');
            expect(badge).toHaveProperty('name');
            expect(badge).toHaveProperty('description');
            expect(badge).toHaveProperty('icon');
            expect(badge).toHaveProperty('color');
            expect(badge).toHaveProperty('category');
            expect(badge).toHaveProperty('earnedAt');
            // No functions should be present
            expect(badge.condition).toBeUndefined();
        });
    });

    // --- EDGE CASES ---
    it('should handle null/undefined currentBadges gracefully', () => {
        expect(() => checkNewBadges(makeRun(), [], null)).not.toThrow();
        expect(() => checkNewBadges(makeRun(), [], undefined)).not.toThrow();
    });

    it('should handle empty run data gracefully', () => {
        expect(() => checkNewBadges({}, [], [])).not.toThrow();
    });
});
