/**
 * Unit Tests for revenueCat.js
 *
 * Tests the RevenueCat service layer including:
 * - Safe initialization when native module is missing
 * - Subscription status checks
 * - Purchase flow
 * - Restore purchases
 */

// --- MOCK SETUP ---
const mockPurchases = {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    logOut: jest.fn(),
    LOG_LEVEL: { DEBUG: 'DEBUG', WARN: 'WARN', ERROR: 'ERROR' },
    PURCHASES_ERROR_CODE: {
        RECEIPT_ALREADY_IN_USE_ERROR: 'RECEIPT_ALREADY_IN_USE',
        PRODUCT_ALREADY_PURCHASED_ERROR: 'PRODUCT_ALREADY_PURCHASED',
    },
};

// Mock the native module — this simulates it being available
jest.mock('react-native-purchases', () => ({
    __esModule: true,
    default: mockPurchases,
}));

jest.mock('../../config/firebase', () => ({
    db: {},
}));

jest.mock('firebase/firestore', () => ({
    addDoc: jest.fn(),
    collection: jest.fn(),
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
}));

jest.mock('react-native', () => ({
    Platform: { OS: 'android' },
    Alert: { alert: jest.fn() },
}));

// --- IMPORT AFTER MOCKS ---
const {
    initRevenueCat,
    checkSubscriptionStatus,
    getOfferings,
    purchasePackage,
    restorePurchases,
} = require('../revenueCat');

// --- TESTS ---
describe('revenueCat service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('initRevenueCat', () => {
        it('should configure Purchases with Google API key on Android', async () => {
            await initRevenueCat('user123');

            expect(mockPurchases.configure).toHaveBeenCalledWith({
                apiKey: expect.any(String),
                appUserID: 'user123',
            });
            expect(mockPurchases.setLogLevel).toHaveBeenCalledWith('WARN');
        });

        it('should not crash if configure throws', async () => {
            mockPurchases.configure.mockRejectedValueOnce(new Error('Native crash'));

            // Should not throw
            await expect(initRevenueCat('user123')).resolves.not.toThrow();
        });
    });

    describe('checkSubscriptionStatus', () => {
        it('should return true when Ruvo Pro entitlement is active', async () => {
            mockPurchases.getCustomerInfo.mockResolvedValueOnce({
                entitlements: {
                    active: { 'Ruvo Pro': { isActive: true } },
                },
            });

            const result = await checkSubscriptionStatus();
            expect(result).toBe(true);
        });

        it('should return false when no active entitlements', async () => {
            mockPurchases.getCustomerInfo.mockResolvedValueOnce({
                entitlements: { active: {} },
            });

            const result = await checkSubscriptionStatus();
            expect(result).toBe(false);
        });

        it('should return false on error', async () => {
            mockPurchases.getCustomerInfo.mockRejectedValueOnce(new Error('Network error'));

            const result = await checkSubscriptionStatus();
            expect(result).toBe(false);
        });
    });

    describe('getOfferings', () => {
        it('should return current offering when available', async () => {
            const mockOffering = { identifier: 'default', availablePackages: [] };
            mockPurchases.getOfferings.mockResolvedValueOnce({
                current: mockOffering,
            });

            const result = await getOfferings();
            expect(result).toEqual(mockOffering);
        });

        it('should return null when no current offering', async () => {
            mockPurchases.getOfferings.mockResolvedValueOnce({
                current: null,
            });

            const result = await getOfferings();
            expect(result).toBeNull();
        });

        it('should return null on error', async () => {
            mockPurchases.getOfferings.mockRejectedValueOnce(new Error('Offline'));

            const result = await getOfferings();
            expect(result).toBeNull();
        });
    });

    describe('purchasePackage', () => {
        it('should return true when purchase succeeds with Ruvo Pro entitlement', async () => {
            mockPurchases.purchasePackage.mockResolvedValueOnce({
                customerInfo: {
                    entitlements: {
                        active: { 'Ruvo Pro': { isActive: true } },
                    },
                },
            });

            const result = await purchasePackage({ identifier: 'monthly' });
            expect(result).toBe(true);
        });

        it('should return false when purchase succeeds but no entitlement', async () => {
            mockPurchases.purchasePackage.mockResolvedValueOnce({
                customerInfo: {
                    entitlements: { active: {} },
                },
            });

            const result = await purchasePackage({ identifier: 'monthly' });
            expect(result).toBe(false);
        });

        it('should return false when user cancels (not throw)', async () => {
            mockPurchases.purchasePackage.mockRejectedValueOnce({
                userCancelled: true,
            });

            const result = await purchasePackage({ identifier: 'monthly' });
            expect(result).toBe(false);
        });

        it('should throw when purchase fails with real error', async () => {
            const error = new Error('Payment failed');
            error.userCancelled = false;
            mockPurchases.purchasePackage.mockRejectedValueOnce(error);

            await expect(purchasePackage({ identifier: 'monthly' })).rejects.toThrow('Payment failed');
        });
    });

    describe('restorePurchases', () => {
        it('should return true when restore finds Ruvo Pro', async () => {
            mockPurchases.restorePurchases.mockResolvedValueOnce({
                entitlements: {
                    active: { 'Ruvo Pro': { isActive: true } },
                },
            });

            const result = await restorePurchases();
            expect(result).toBe(true);
        });

        it('should return false when restore finds nothing', async () => {
            mockPurchases.restorePurchases.mockResolvedValueOnce({
                entitlements: { active: {} },
            });

            const result = await restorePurchases();
            expect(result).toBe(false);
        });

        it('should return false on error', async () => {
            mockPurchases.restorePurchases.mockRejectedValueOnce(new Error('Network'));

            const result = await restorePurchases();
            expect(result).toBe(false);
        });
    });
});
