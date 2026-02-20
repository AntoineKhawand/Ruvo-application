/**
 * Unit Tests for referralService.js
 *
 * Tests:
 * - Referral code generation (pure logic)
 * - Code validation (mocked Firestore)
 * - Reward processing (mocked Firestore transaction)
 */

// --- MOCK FIREBASE ---
const mockGetDocs = jest.fn();
const mockRunTransaction = jest.fn();

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: (...args) => mockGetDocs(...args),
    runTransaction: (...args) => mockRunTransaction(...args),
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
}));

jest.mock('../../config/firebase', () => ({
    db: {},
}));

const {
    generateReferralCode,
    validateReferralCode,
    processReferralReward,
} = require('../referralService');

describe('referralService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- CODE GENERATION (Pure Logic) ---
    describe('generateReferralCode', () => {
        it('should generate a code in format NAME + 4 digits', () => {
            const code = generateReferralCode('Antoine Khawand');
            expect(code).toMatch(/^[A-Z]{1,4}\d{4}$/);
        });

        it('should use first 4 chars of first name, uppercased', () => {
            const code = generateReferralCode('Antoine');
            expect(code).toMatch(/^ANTO\d{4}$/);
        });

        it('should handle short names', () => {
            const code = generateReferralCode('Al');
            expect(code).toMatch(/^AL\d{4}$/);
        });

        it('should default to RUNN when name is empty', () => {
            const code = generateReferralCode('');
            expect(code).toMatch(/^RUNN\d{4}$/);
        });

        it('should default to RUNN when name is null', () => {
            const code = generateReferralCode(null);
            expect(code).toMatch(/^RUNN\d{4}$/);
        });

        it('should strip non-alpha characters from name', () => {
            const code = generateReferralCode('J0hn!');
            expect(code).toMatch(/^[A-Z]+\d{4}$/);
            // J0hn -> JHN (digits and special chars removed)
        });

        it('should generate unique codes on consecutive calls', () => {
            const codes = new Set();
            for (let i = 0; i < 100; i++) {
                codes.add(generateReferralCode('Test'));
            }
            // With 9000 possible suffixes, 100 calls should produce mostly unique codes
            expect(codes.size).toBeGreaterThan(80);
        });

        it('should always produce a 4-digit suffix between 1000-9999', () => {
            for (let i = 0; i < 50; i++) {
                const code = generateReferralCode('Test');
                const suffix = parseInt(code.replace(/[A-Z]/g, ''));
                expect(suffix).toBeGreaterThanOrEqual(1000);
                expect(suffix).toBeLessThanOrEqual(9999);
            }
        });
    });

    // --- CODE VALIDATION (Mocked Firestore) ---
    describe('validateReferralCode', () => {
        it('should return null for empty code', async () => {
            const result = await validateReferralCode('');
            expect(result).toBeNull();
        });

        it('should return null for code shorter than 3 chars', async () => {
            const result = await validateReferralCode('AB');
            expect(result).toBeNull();
        });

        it('should return null for null code', async () => {
            const result = await validateReferralCode(null);
            expect(result).toBeNull();
        });

        it('should return referrer data when code matches', async () => {
            mockGetDocs.mockResolvedValueOnce({
                empty: false,
                docs: [{ id: 'user123', data: () => ({ name: 'John', referralCode: 'JOHN1234' }) }],
            });

            const result = await validateReferralCode('JOHN1234');
            expect(result).toEqual({ uid: 'user123', name: 'John', referralCode: 'JOHN1234' });
        });

        it('should return null when no match found', async () => {
            mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });

            const result = await validateReferralCode('FAKE9999');
            expect(result).toBeNull();
        });

        it('should return null on Firestore error', async () => {
            mockGetDocs.mockRejectedValueOnce(new Error('Network error'));

            const result = await validateReferralCode('TEST1234');
            expect(result).toBeNull();
        });
    });

    // --- REWARD PROCESSING ---
    describe('processReferralReward', () => {
        it('should return false if referrerUid is missing', async () => {
            const result = await processReferralReward(null, 'user2', 'CODE');
            expect(result).toBe(false);
        });

        it('should return false if newUserUid is missing', async () => {
            const result = await processReferralReward('user1', null, 'CODE');
            expect(result).toBe(false);
        });

        it('should return true on successful transaction', async () => {
            mockRunTransaction.mockResolvedValueOnce(undefined);

            const result = await processReferralReward('referrer1', 'newUser1', 'TEST1234');
            expect(result).toBe(true);
        });

        it('should return false on transaction failure', async () => {
            mockRunTransaction.mockRejectedValueOnce(new Error('Transaction failed'));

            const result = await processReferralReward('referrer1', 'newUser1', 'TEST1234');
            expect(result).toBe(false);
        });
    });
});
