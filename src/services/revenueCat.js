// src/services/revenueCat.js
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

// TODO: User needs to replace these with real keys
const API_KEYS = {
    apple: 'test_WRgbfGfJXKhHtlIKegbgqbuEmHh',
    google: 'test_WRgbfGfJXKhHtlIKegbgqbuEmHh'
};

export const initRevenueCat = async (userId) => {
    try {
        if (Platform.OS === 'ios') {
            await Purchases.configure({ apiKey: API_KEYS.apple, appUserID: userId });
        } else if (Platform.OS === 'android') {
            await Purchases.configure({ apiKey: API_KEYS.google, appUserID: userId });
        }

        // Enable debug logs for development
        await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);

        console.log("✅ RevenueCat Initialized for user:", userId);
    } catch (e) {
        console.error("RevenueCat Init Error:", e);
    }
};

export const getOfferings = async () => {
    try {
        const offerings = await Purchases.getOfferings();
        if (offerings.current !== null) {
            return offerings.current;
        }
        return null;
    } catch (e) {
        console.error("Error fetching offerings:", e);
        return null;
    }
};

export const purchasePackage = async (pack) => {
    try {
        const { customerInfo } = await Purchases.purchasePackage(pack);

        // check entitlement 'Ruvo Pro'
        if (typeof customerInfo.entitlements.active['Ruvo Pro'] !== "undefined") {
            return true; // Success
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
    try {
        const customerInfo = await Purchases.restorePurchases();
        if (typeof customerInfo.entitlements.active['Ruvo Pro'] !== "undefined") {
            return true;
        }
    } catch (e) {
        console.error("Restore Error:", e);
    }
    return false;
};

export const checkSubscriptionStatus = async () => {
    try {
        const customerInfo = await Purchases.getCustomerInfo();
        // CHECK FOR 'Ruvo Pro' ENTITLEMENT
        if (typeof customerInfo.entitlements.active['Ruvo Pro'] !== "undefined") {
            return true;
        }
    } catch (e) {
        console.error("Check Status Error:", e);
    }
    return false;
};
