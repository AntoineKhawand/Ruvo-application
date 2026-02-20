/**
 * challengeService.test.js — Tests for Firestore-backed challenge management
 */

// --- Mock Firebase ---
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDoc = jest.fn(() => 'mock-doc-ref');
const mockCollection = jest.fn(() => 'mock-collection-ref');

jest.mock('firebase/firestore', () => ({
    collection: (...args) => mockCollection(...args),
    doc: (...args) => mockDoc(...args),
    getDoc: (...args) => mockGetDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
    setDoc: (...args) => mockSetDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    increment: (val) => ({ __increment: val }),
    arrayUnion: (val) => ({ __arrayUnion: val }),
    arrayRemove: (val) => ({ __arrayRemove: val }),
    query: jest.fn((...args) => args),
    where: jest.fn(),
    orderBy: jest.fn(),
    serverTimestamp: () => ({ __serverTimestamp: true }),
    Timestamp: {
        fromDate: (d) => ({ toDate: () => d, seconds: Math.floor(d.getTime() / 1000) })
    }
}));

jest.mock('../../config/firebase', () => ({
    db: 'mock-db'
}));

const {
    seedChallenges,
    fetchActiveChallenges,
    joinChallenge,
    leaveChallenge,
    getChallengeProgress,
    checkChallengeCompletion,
    challengeService
} = require('../challengeService');

const { generateMonthlyChallenges } = challengeService;

// ============================================================
// TESTS
// ============================================================

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
});

afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
});

// ----------------------------------------------------------
// generateMonthlyChallenges
// ----------------------------------------------------------
describe('generateMonthlyChallenges', () => {
    it('should return 4 challenges', () => {
        const challenges = generateMonthlyChallenges();
        expect(challenges).toHaveLength(4);
    });

    it('should include all goal types', () => {
        const challenges = generateMonthlyChallenges();
        const types = challenges.map(c => c.goalType);
        expect(types).toContain('distance');
        expect(types).toContain('pace');
        expect(types).toContain('elevation');
        expect(types).toContain('streak');
    });

    it('should have valid date ranges', () => {
        const challenges = generateMonthlyChallenges();
        challenges.forEach(c => {
            expect(c.startDate).toBeDefined();
            expect(c.endDate).toBeDefined();
            const start = c.startDate.toDate();
            const end = c.endDate.toDate();
            expect(end.getTime()).toBeGreaterThan(start.getTime());
        });
    });

    it('should set participants to 0', () => {
        const challenges = generateMonthlyChallenges();
        challenges.forEach(c => {
            expect(c.participants).toBe(0);
        });
    });

    it('should include XP and coin rewards', () => {
        const challenges = generateMonthlyChallenges();
        challenges.forEach(c => {
            expect(c.xp).toBeGreaterThan(0);
            expect(c.coins).toBeGreaterThan(0);
        });
    });
});

// ----------------------------------------------------------
// seedChallenges
// ----------------------------------------------------------
describe('seedChallenges', () => {
    it('should skip if challenges already exist', async () => {
        mockGetDoc.mockResolvedValue({ exists: () => true });
        await seedChallenges();
        expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('should seed 4 challenges if none exist', async () => {
        mockGetDoc.mockResolvedValue({ exists: () => false });
        mockSetDoc.mockResolvedValue();
        await seedChallenges();
        expect(mockSetDoc).toHaveBeenCalledTimes(4);
    });

    it('should handle Firestore errors gracefully', async () => {
        mockGetDoc.mockRejectedValue(new Error('Firestore down'));
        await seedChallenges(); // Should not throw
        expect(console.error).toHaveBeenCalled();
    });
});

// ----------------------------------------------------------
// fetchActiveChallenges
// ----------------------------------------------------------
describe('fetchActiveChallenges', () => {
    it('should return challenges with future end dates', async () => {
        const futureDate = new Date(Date.now() + 86400000); // Tomorrow
        mockGetDocs.mockResolvedValue({
            forEach: (cb) => {
                cb({
                    id: 'c1',
                    data: () => ({
                        title: 'Active Challenge',
                        endDate: { toDate: () => futureDate },
                        startDate: { toDate: () => new Date() },
                        type: 'Active'
                    })
                });
            }
        });

        const result = await fetchActiveChallenges();
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Active Challenge');
    });

    it('should filter out expired challenges', async () => {
        const pastDate = new Date(Date.now() - 86400000); // Yesterday
        mockGetDocs.mockResolvedValue({
            forEach: (cb) => {
                cb({
                    id: 'c1',
                    data: () => ({
                        title: 'Expired',
                        endDate: { toDate: () => pastDate },
                        type: 'Active'
                    })
                });
            }
        });

        const result = await fetchActiveChallenges();
        expect(result).toHaveLength(0);
    });

    it('should sort Featured challenges first', async () => {
        const future = new Date(Date.now() + 86400000);
        mockGetDocs.mockResolvedValue({
            forEach: (cb) => {
                cb({ id: 'c1', data: () => ({ title: 'Normal', endDate: { toDate: () => future }, startDate: { toDate: () => new Date() }, type: 'Active' }) });
                cb({ id: 'c2', data: () => ({ title: 'Featured One', endDate: { toDate: () => future }, startDate: { toDate: () => new Date() }, type: 'Featured' }) });
            }
        });

        const result = await fetchActiveChallenges();
        expect(result[0].title).toBe('Featured One');
    });

    it('should return empty array on error', async () => {
        mockGetDocs.mockRejectedValue(new Error('Network error'));
        const result = await fetchActiveChallenges();
        expect(result).toEqual([]);
    });
});

// ----------------------------------------------------------
// joinChallenge
// ----------------------------------------------------------
describe('joinChallenge', () => {
    it('should increment participants and update user', async () => {
        mockUpdateDoc.mockResolvedValue();
        const result = await joinChallenge('user123', 'challenge1');
        expect(result.success).toBe(true);
        expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
    });

    it('should return error on failure', async () => {
        mockUpdateDoc.mockRejectedValue(new Error('Permission denied'));
        const result = await joinChallenge('user123', 'challenge1');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Permission denied');
    });
});

// ----------------------------------------------------------
// leaveChallenge
// ----------------------------------------------------------
describe('leaveChallenge', () => {
    it('should decrement participants and update user', async () => {
        mockUpdateDoc.mockResolvedValue();
        const result = await leaveChallenge('user123', 'challenge1');
        expect(result.success).toBe(true);
        expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
    });

    it('should return error on failure', async () => {
        mockUpdateDoc.mockRejectedValue(new Error('Not found'));
        const result = await leaveChallenge('user123', 'challenge1');
        expect(result.success).toBe(false);
    });
});

// ----------------------------------------------------------
// getChallengeProgress
// ----------------------------------------------------------
describe('getChallengeProgress', () => {
    const makeChallenge = (goalType, goalValue) => ({
        goalType,
        goalValue,
        startDate: { toDate: () => new Date('2025-01-01') },
        endDate: { toDate: () => new Date('2025-12-31') }
    });

    describe('distance type', () => {
        it('should sum distances from relevant runs', () => {
            const challenge = makeChallenge('distance', 100);
            const runs = [
                { date: '2025-03-15', distance: 10 },
                { date: '2025-03-16', distance: 25.5 },
                { date: '2025-03-17', distance: 14.5 }
            ];
            const result = getChallengeProgress(challenge, runs);
            expect(result.current).toBe('50.0');
            expect(result.percent).toBe(0.5);
            expect(result.target).toBe(100);
        });

        it('should cap percent at 1.0', () => {
            const challenge = makeChallenge('distance', 10);
            const runs = [{ date: '2025-03-15', distance: 50 }];
            const result = getChallengeProgress(challenge, runs);
            expect(result.percent).toBe(1);
        });

        it('should return 0 for empty run history', () => {
            const challenge = makeChallenge('distance', 100);
            const result = getChallengeProgress(challenge, []);
            expect(result.percent).toBe(0);
            expect(result.current).toBe('0.0');
        });
    });

    describe('elevation type', () => {
        it('should sum elevation from runs', () => {
            const challenge = makeChallenge('elevation', 300);
            const runs = [
                { date: '2025-03-15', elevation: 50 },
                { date: '2025-03-16', elevation: 100 }
            ];
            const result = getChallengeProgress(challenge, runs);
            expect(result.current).toBe('150.0');
            expect(result.percent).toBeCloseTo(0.5);
        });
    });

    describe('streak type', () => {
        it('should count consecutive run days', () => {
            const challenge = makeChallenge('streak', 7);
            const runs = [
                { date: '2025-03-10' },
                { date: '2025-03-11' },
                { date: '2025-03-12' },
                { date: '2025-03-13' },
                { date: '2025-03-14' }
            ];
            const result = getChallengeProgress(challenge, runs);
            expect(result.current).toBe('5.0');
            expect(result.percent).toBeCloseTo(5 / 7);
        });

        it('should return 0 for no runs', () => {
            const challenge = makeChallenge('streak', 7);
            const result = getChallengeProgress(challenge, []);
            expect(result.percent).toBe(0);
        });

        it('should not count non-consecutive days', () => {
            const challenge = makeChallenge('streak', 7);
            const runs = [
                { date: '2025-03-10' },
                { date: '2025-03-12' }, // gap!
                { date: '2025-03-13' }
            ];
            const result = getChallengeProgress(challenge, runs);
            expect(result.current).toBe('2.0'); // max streak = 2
        });
    });

    describe('edge cases', () => {
        it('should return zeros for null challenge', () => {
            const result = getChallengeProgress(null, []);
            expect(result.percent).toBe(0);
            expect(result.current).toBe('0');
        });

        it('should filter runs outside date range', () => {
            const challenge = {
                goalType: 'distance',
                goalValue: 50,
                startDate: { toDate: () => new Date('2025-06-01') },
                endDate: { toDate: () => new Date('2025-06-30') }
            };
            const runs = [
                { date: '2025-05-15', distance: 30 }, // Before range
                { date: '2025-06-15', distance: 10 }, // In range
                { date: '2025-07-01', distance: 20 }  // After range
            ];
            const result = getChallengeProgress(challenge, runs);
            expect(result.current).toBe('10.0');
        });

        it('should default to distance for unknown goalType', () => {
            const challenge = {
                goalType: 'unknown_type',
                goalValue: 50,
                startDate: { toDate: () => new Date('2025-01-01') },
                endDate: { toDate: () => new Date('2025-12-31') }
            };
            const runs = [{ date: '2025-03-15', distance: 20 }];
            const result = getChallengeProgress(challenge, runs);
            expect(result.current).toBe('20.0');
        });
    });
});

// ----------------------------------------------------------
// checkChallengeCompletion
// ----------------------------------------------------------
describe('checkChallengeCompletion', () => {
    const challenge = {
        id: 'c1',
        title: 'Test Challenge',
        goalType: 'distance',
        goalValue: 10,
        xp: 1000,
        coins: 500,
        startDate: { toDate: () => new Date('2025-01-01') },
        endDate: { toDate: () => new Date('2025-12-31') }
    };

    it('should detect completion and return rewards', () => {
        const runs = [{ date: '2025-03-15', distance: 15 }];
        const result = checkChallengeCompletion(challenge, runs, []);
        expect(result.completed).toBe(true);
        expect(result.xp).toBe(1000);
        expect(result.coins).toBe(500);
        expect(result.challengeId).toBe('c1');
    });

    it('should not award if already completed', () => {
        const runs = [{ date: '2025-03-15', distance: 15 }];
        const result = checkChallengeCompletion(challenge, runs, ['c1']);
        expect(result.completed).toBe(false);
        expect(result.xp).toBe(0);
    });

    it('should not complete if progress < 100%', () => {
        const runs = [{ date: '2025-03-15', distance: 5 }];
        const result = checkChallengeCompletion(challenge, runs, []);
        expect(result.completed).toBe(false);
    });

    it('should handle null challenge', () => {
        const result = checkChallengeCompletion(null, [], []);
        expect(result.completed).toBe(false);
    });
});
