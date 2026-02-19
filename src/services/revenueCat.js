// src/services/revenueCat.js
import { Platform } from 'react-native';

// ✅ Safe import — prevents crash on emulators where native module may not init
let Purchases = null;
try {
    Purchases = require('react-native-purchases').default;
} catch (e) {
    console.warn('⚠️ RevenueCat native module not available:', e.message);
}

// TODO: User needs to replace these with real keys
const API_KEYS = {
    apple: 'test_WRgbfGfJXKhHtlIKegbgqbuEmHh',
    google: 'test_WRgbfGfJXKhHtlIKegbgqbuEmHh'
};

// Single source of truth — update here if renamed in RevenueCat dashboard
const ENTITLEMENT_ID = 'Ruvo Pro';

export const initRevenueCat = async (userId) => {
    if (!Purchases) return;
    try {
        if (Platform.OS === 'ios') {
            await Purchases.configure({ apiKey: API_KEYS.apple, appUserID: userId });
        } else if (Platform.OS === 'android') {
            await Purchases.configure({ apiKey: API_KEYS.google, appUserID: userId });
        }
        await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
        console.log("✅ RevenueCat Initialized for user:", userId);
    } catch (e) {
        console.warn("RevenueCat Init Error:", e.message);
    }
};

export const getOfferings = async () => {
    if (!Purchases) return null;
    try {
        const offerings = await Purchases.getOfferings();
        return offerings.current ?? null;
    } catch (e) {
        console.error("Error fetching offerings:", e);
        return null;
    }
};

export const purchasePackage = async (pack) => {
    if (!Purchases) return false;
    try {
        const { customerInfo } = await Purchases.purchasePackage(pack);
        if (typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined") {
            return true;
        }
    } catch (e) {
        if (!e.userCancelled) {
            console.error("Purchase Error:", e);
            throw e;
        }
    }
    return false;
};

export const restorePurchases = async () => {
    if (!Purchases) return false;
    try {
        const customerInfo = await Purchases.restorePurchases();
        if (typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined") {
            return true;
        }
    } catch (e) {
        console.error("Restore Error:", e);
    }
    return false;
};

export const checkSubscriptionStatus = async () => {
    if (!Purchases) return false;
    try {
        const customerInfo = await Purchases.getCustomerInfo();
        if (typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined") {
            return true;
        }
    } catch (e) {
        console.warn("Check Status Error:", e);
    }
    return false;
};
