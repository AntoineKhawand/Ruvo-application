/**
 * Unit Tests for contentService.js
 *
 * Tests:
 * - fetchTips returns data from Firestore
 * - fetchTips falls back to FALLBACK_TIPS on error
 * - fetchTips seeds when Firestore is empty
 * - incrementTipView updates view count
 * - seedTipsToFirestore writes all tips
 * - FALLBACK_TIPS data structure validation
 */

// --- MOCK FIREBASE ---
const mockGetDocs = jest.fn();
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    getDoc: (...args) => mockGetDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    orderBy: jest.fn(),
    query: jest.fn(),
    writeBatch: jest.fn(() => ({
        set: mockBatchSet,
        commit: mockBatchCommit,
    })),
}));

jest.mock('../../config/firebase', () => ({
    db: {},
}));

const { contentService, FALLBACK_TIPS } = require('../contentService');

describe('contentService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- FALLBACK_TIPS DATA VALIDATION ---
    describe('FALLBACK_TIPS', () => {
        it('should have at least 5 tips', () => {
            expect(FALLBACK_TIPS.length).toBeGreaterThanOrEqual(5);
        });

        it('each tip should have required fields', () => {
            FALLBACK_TIPS.forEach(tip => {
                expect(tip).toHaveProperty('id');
                expect(tip).toHaveProperty('title');
                expect(tip).toHaveProperty('desc');
                expect(tip).toHaveProperty('img');
                expect(typeof tip.id).toBe('string');
                expect(typeof tip.title).toBe('string');
            });
        });

        it('all tip IDs should be unique', () => {
            const ids = FALLBACK_TIPS.map(t => t.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('tips with steps should have well-formed step objects', () => {
            const tipsWithSteps = FALLBACK_TIPS.filter(t => t.steps);
            tipsWithSteps.forEach(tip => {
                tip.steps.forEach(step => {
                    expect(step).toHaveProperty('title');
                    expect(step).toHaveProperty('desc');
                });
            });
        });
    });

    // --- FETCH TIPS ---
    describe('fetchTips', () => {
        it('should return tips from Firestore when available', async () => {
            mockGetDocs.mockResolvedValueOnce({
                empty: false,
                docs: [
                    { id: '1', data: () => ({ title: 'Trail Tips', desc: 'Run on trails' }) },
                    { id: '2', data: () => ({ title: 'Speed Work', desc: 'Go faster' }) },
                ],
            });

            const tips = await contentService.fetchTips();

            expect(tips).toHaveLength(2);
            expect(tips[0]).toEqual({ id: '1', title: 'Trail Tips', desc: 'Run on trails' });
        });

        it('should seed and return FALLBACK_TIPS when Firestore is empty', async () => {
            mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });

            const tips = await contentService.fetchTips();

            expect(tips).toEqual(FALLBACK_TIPS);
            // Should have attempted to seed
            expect(mockBatchCommit).toHaveBeenCalled();
        });

        it('should return FALLBACK_TIPS on Firestore error', async () => {
            mockGetDocs.mockRejectedValueOnce(new Error('Offline'));

            const tips = await contentService.fetchTips();

            expect(tips).toEqual(FALLBACK_TIPS);
        });
    });

    // --- INCREMENT TIP VIEW ---
    describe('incrementTipView', () => {
        it('should increment view count for existing tip', async () => {
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ viewCount: 100 }),
            });

            await contentService.incrementTipView('1');

            expect(mockUpdateDoc).toHaveBeenCalledWith(
                undefined, // doc ref (mocked)
                { viewCount: 101 }
            );
        });

        it('should not crash for non-existent tip', async () => {
            mockGetDoc.mockResolvedValueOnce({
                exists: () => false,
            });

            // Should not throw
            await expect(contentService.incrementTipView('999')).resolves.not.toThrow();
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        it('should handle Firestore errors gracefully', async () => {
            mockGetDoc.mockRejectedValueOnce(new Error('Offline'));

            // Should not throw
            await expect(contentService.incrementTipView('1')).resolves.not.toThrow();
        });
    });

    // --- SEED TIPS ---
    describe('seedTipsToFirestore', () => {
        it('should batch write all fallback tips', async () => {
            const result = await contentService.seedTipsToFirestore();

            expect(result).toBe(true);
            expect(mockBatchSet).toHaveBeenCalledTimes(FALLBACK_TIPS.length);
            expect(mockBatchCommit).toHaveBeenCalledTimes(1);
        });

        it('should return false on error', async () => {
            mockBatchCommit.mockRejectedValueOnce(new Error('Write failed'));

            const result = await contentService.seedTipsToFirestore();
            expect(result).toBe(false);
        });
    });
});
