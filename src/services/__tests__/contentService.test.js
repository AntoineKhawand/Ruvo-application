/**
 * Unit Tests for contentService.js
 *
 * Covers the revised architecture:
 * - FALLBACK_TIPS is always the source of truth for content
 * - Firestore enriches view counts only
 * - fetchTips triggers a background reseed when Firestore is stale
 * - incrementTipView uses setDoc+merge (works even if doc doesn't exist)
 * - seedTipsToFirestore upserts all tips + writes _meta marker
 */

// ── mocks ────────────────────────────────────────────────────────
const mockGetDocs  = jest.fn();
const mockSetDoc   = jest.fn().mockResolvedValue(undefined);
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    getDocs: (...args) => mockGetDocs(...args),
    setDoc: (...args) => mockSetDoc(...args),
    orderBy: jest.fn(),
    query: jest.fn(),
    increment: jest.fn(n => ({ _increment: n })),
    writeBatch: jest.fn(() => ({
        set: mockBatchSet,
        commit: mockBatchCommit,
    })),
}));

jest.mock('../../config/firebase', () => ({ db: {} }));

const { contentService, FALLBACK_TIPS } = require('../contentService');

// ─────────────────────────────────────────────────────────────────
describe('FALLBACK_TIPS — data integrity', () => {
    it('has 25 tips', () => {
        expect(FALLBACK_TIPS).toHaveLength(25);
    });

    it('all tips have required fields', () => {
        FALLBACK_TIPS.forEach(tip => {
            expect(tip).toHaveProperty('id');
            expect(tip).toHaveProperty('title');
            expect(tip).toHaveProperty('desc');
            expect(tip).toHaveProperty('img');
            expect(tip).toHaveProperty('category');
            expect(tip).toHaveProperty('tag');
            expect(tip).toHaveProperty('readTime');
            expect(typeof tip.id).toBe('string');
        });
    });

    it('all IDs are unique', () => {
        const ids = FALLBACK_TIPS.map(t => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('all tips with steps have well-formed step objects', () => {
        FALLBACK_TIPS.filter(t => t.steps).forEach(tip => {
            expect(tip.steps.length).toBeGreaterThanOrEqual(1);
            tip.steps.forEach(step => {
                expect(step).toHaveProperty('title');
                expect(step).toHaveProperty('desc');
            });
        });
    });

    it('covers at least 5 distinct categories', () => {
        const cats = new Set(FALLBACK_TIPS.map(t => t.category));
        expect(cats.size).toBeGreaterThanOrEqual(5);
    });

    it('all tips have a keyTakeaway', () => {
        FALLBACK_TIPS.forEach(tip => {
            expect(typeof tip.keyTakeaway).toBe('string');
            expect(tip.keyTakeaway.length).toBeGreaterThan(10);
        });
    });
});

// ─────────────────────────────────────────────────────────────────
describe('contentService.fetchTips', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns FALLBACK_TIPS enriched with Firestore view counts', async () => {
        // Firestore has view counts for tips 1 and 2
        mockGetDocs.mockResolvedValueOnce({
            size: 25,
            docs: [
                { id: '1', data: () => ({ viewCount: 99999, category: 'Technique' }) },
                { id: '2', data: () => ({ viewCount: 50000, category: 'Technique' }) },
            ],
        });

        const tips = await contentService.fetchTips();

        // Should return all 25 FALLBACK_TIPS
        expect(tips).toHaveLength(25);
        // Should use Firestore view count for tip 1
        expect(tips.find(t => t.id === '1').viewCount).toBe(99999);
        // Should use Firestore view count for tip 2
        expect(tips.find(t => t.id === '2').viewCount).toBe(50000);
        // Tip 3 (not in Firestore mock) should use FALLBACK default
        expect(tips.find(t => t.id === '3').viewCount).toBe(
            FALLBACK_TIPS.find(t => t.id === '3').viewCount
        );
    });

    it('triggers a background seed when Firestore has fewer tips than FALLBACK_TIPS', async () => {
        mockGetDocs.mockResolvedValueOnce({
            size: 10, // old count before expansion
            docs: Array.from({ length: 10 }, (_, i) => ({
                id: String(i + 1),
                data: () => ({ viewCount: 100, category: 'Technique' }),
            })),
        });
        // The background seed will call batchCommit
        mockBatchCommit.mockResolvedValueOnce(undefined);

        const tips = await contentService.fetchTips();

        expect(tips).toHaveLength(25); // always returns full FALLBACK_TIPS
        // background seed should have been scheduled
        await new Promise(r => setTimeout(r, 10)); // let the .catch handler settle
        expect(mockBatchSet).toHaveBeenCalled();
    });

    it('triggers a background seed when Firestore docs are missing category field', async () => {
        mockGetDocs.mockResolvedValueOnce({
            size: 25,
            docs: Array.from({ length: 25 }, (_, i) => ({
                id: String(i + 1),
                data: () => ({ viewCount: 100 }), // no category = stale v1 data
            })),
        });
        mockBatchCommit.mockResolvedValueOnce(undefined);

        const tips = await contentService.fetchTips();

        expect(tips).toHaveLength(25);
        await new Promise(r => setTimeout(r, 10));
        expect(mockBatchSet).toHaveBeenCalled();
    });

    it('returns FALLBACK_TIPS on Firestore error (offline)', async () => {
        mockGetDocs.mockRejectedValueOnce(new Error('Offline'));

        const tips = await contentService.fetchTips();

        expect(tips).toEqual(FALLBACK_TIPS);
    });
});

// ─────────────────────────────────────────────────────────────────
describe('contentService.incrementTipView', () => {
    beforeEach(() => jest.clearAllMocks());

    it('calls setDoc with increment(1) and merge:true', async () => {
        await contentService.incrementTipView('5');

        expect(mockSetDoc).toHaveBeenCalledWith(
            undefined,                      // doc ref (mocked returns undefined)
            { viewCount: { _increment: 1 } },
            { merge: true }
        );
    });

    it('works for any tip ID without crashing', async () => {
        await expect(contentService.incrementTipView('999')).resolves.not.toThrow();
    });

    it('handles Firestore errors gracefully', async () => {
        mockSetDoc.mockRejectedValueOnce(new Error('Offline'));
        await expect(contentService.incrementTipView('1')).resolves.not.toThrow();
    });
});

// ─────────────────────────────────────────────────────────────────
describe('contentService.seedTipsToFirestore', () => {
    beforeEach(() => jest.clearAllMocks());

    it('upserts all 25 tips plus one _meta document', async () => {
        const result = await contentService.seedTipsToFirestore();

        expect(result).toBe(true);
        // 25 tips + 1 _meta = 26 calls
        expect(mockBatchSet).toHaveBeenCalledTimes(FALLBACK_TIPS.length + 1);
        expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it('uses merge:true to preserve existing view counts', async () => {
        await contentService.seedTipsToFirestore();

        // Every call should have merge: true as the third argument
        mockBatchSet.mock.calls.forEach(call => {
            expect(call[2]).toEqual({ merge: true });
        });
    });

    it('returns false on commit error', async () => {
        mockBatchCommit.mockRejectedValueOnce(new Error('Write failed'));
        const result = await contentService.seedTipsToFirestore();
        expect(result).toBe(false);
    });
});
