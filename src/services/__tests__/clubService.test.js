/**
 * Unit Tests for clubService.js
 *
 * Tests:
 * - seedClubs skips when clubs already exist
 * - getAllClubs returns formatted data
 * - joinClub handles public vs private clubs
 * - leaveClub updates member list
 * - Error handling for all operations
 */

// --- MOCK FIREBASE ---
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn().mockResolvedValue(undefined);
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    getDoc: (...args) => mockGetDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
    setDoc: (...args) => mockSetDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    query: jest.fn(),
    limit: jest.fn(),
    arrayUnion: jest.fn(val => ({ _type: 'arrayUnion', value: val })),
    arrayRemove: jest.fn(val => ({ _type: 'arrayRemove', value: val })),
    increment: jest.fn(val => ({ _type: 'increment', value: val })),
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
}));

jest.mock('../../config/firebase', () => ({
    db: {},
}));

const { seedClubs, getAllClubs, joinClub, leaveClub } = require('../clubService');

describe('clubService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- SEED CLUBS ---
    describe('seedClubs', () => {
        it('should skip seeding when clubs already exist', async () => {
            mockGetDocs.mockResolvedValueOnce({
                empty: false,
                docs: [{ id: 'club1', data: () => ({}) }],
            });

            await seedClubs();

            // setDoc should NOT have been called — data already exists
            expect(mockSetDoc).not.toHaveBeenCalled();
        });

        it('should seed clubs when collection is empty', async () => {
            mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });

            const result = await seedClubs();

            // Should have called setDoc for each initial club (5 clubs)
            expect(mockSetDoc).toHaveBeenCalledTimes(5);
            expect(result).toBe(true);
        });

        it('should throw on Firestore error', async () => {
            mockGetDocs.mockRejectedValueOnce(new Error('Permission denied'));

            await expect(seedClubs()).rejects.toThrow('Permission denied');
        });
    });

    // --- GET ALL CLUBS ---
    describe('getAllClubs', () => {
        it('should return array of club objects with IDs', async () => {
            mockGetDocs.mockResolvedValueOnce({
                docs: [
                    { id: 'club1', data: () => ({ name: 'NRC Beirut', memberCount: 100 }) },
                    { id: 'club2', data: () => ({ name: 'Trail Blazers', memberCount: 50 }) },
                ],
            });

            const clubs = await getAllClubs();

            expect(clubs).toHaveLength(2);
            expect(clubs[0]).toEqual({ id: 'club1', name: 'NRC Beirut', memberCount: 100 });
            expect(clubs[1]).toEqual({ id: 'club2', name: 'Trail Blazers', memberCount: 50 });
        });

        it('should return empty array on error', async () => {
            mockGetDocs.mockRejectedValueOnce(new Error('Offline'));

            const clubs = await getAllClubs();
            expect(clubs).toEqual([]);
        });
    });

    // --- JOIN CLUB ---
    describe('joinClub', () => {
        it('should join public club directly', async () => {
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ type: 'public', members: [], memberCount: 10 }),
            });

            const result = await joinClub('user123', 'club_nrc');

            expect(result).toEqual({ status: 'joined' });
            expect(mockUpdateDoc).toHaveBeenCalled();
        });

        it('should send request for private club', async () => {
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ type: 'private', members: [], memberCount: 5 }),
            });

            const result = await joinClub('user123', 'club_private');

            expect(result).toEqual({ status: 'requested' });
            expect(mockUpdateDoc).toHaveBeenCalled();
        });

        it('should throw error when club does not exist', async () => {
            mockGetDoc.mockResolvedValueOnce({
                exists: () => false,
            });

            await expect(joinClub('user123', 'nonexistent')).rejects.toThrow('Club not found');
        });

        it('should propagate Firestore errors', async () => {
            mockGetDoc.mockRejectedValueOnce(new Error('Network'));

            await expect(joinClub('user123', 'club1')).rejects.toThrow('Network');
        });
    });

    // --- LEAVE CLUB ---
    describe('leaveClub', () => {
        it('should return left status on success', async () => {
            const result = await leaveClub('user123', 'club_nrc');

            expect(result).toEqual({ status: 'left' });
            expect(mockUpdateDoc).toHaveBeenCalled();
        });

        it('should propagate errors', async () => {
            mockUpdateDoc.mockRejectedValueOnce(new Error('Offline'));

            await expect(leaveClub('user123', 'club1')).rejects.toThrow('Offline');
        });
    });
});
