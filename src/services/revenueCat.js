// src/services/revenueCat.js
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Alert, Platform } from 'react-native';
import { db } from '../config/firebase';

// ✅ Safe import — prevents crash on emulators where native module may not init
let Purchases = null;
try {
    Purchases = require('react-native-purchases').default;
} catch (e) {
    console.warn('⚠️ RevenueCat native module not available:', e.message);
}

// ✅ SECURE: Use Environment Variables (Fallback to production keys)
const API_KEYS = {
    apple: process.env.EXPO_PUBLIC_RC_APPLE || '', // TODO: Add Apple key when App Store account is ready
    google: process.env.EXPO_PUBLIC_RC_GOOGLE || 'goog_xdIDuWutQSsqvTEGPExtzArXyOm'
};

const ENTITLEMENT_ID = 'Ruvo Pro';

export const initRevenueCat = async (userId) => {
    if (!Purchases) return;
    try {
        if (Platform.OS === 'ios') {
            await Purchases.configure({ apiKey: API_KEYS.apple, appUserID: userId });
        } else if (Platform.OS === 'android') {
            await Purchases.configure({ apiKey: API_KEYS.google, appUserID: userId });
        }
        await Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.WARN : Purchases.LOG_LEVEL.ERROR);
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
        if (customerInfo.entitlements?.active?.[ENTITLEMENT_ID]?.isActive) {

            // Successfully purchased - Log Audit safely
            try {
                const userId = customerInfo.originalAppUserId;
                if (userId) {
                    await addDoc(collection(db, "users", userId, "auditLog"), {
                        action: "SUBSCRIPTION_PURCHASED",
                        timestamp: serverTimestamp(),
                        device: Platform.OS,
                        details: { package: pack.identifier, entitlement: ENTITLEMENT_ID }
                    });
                    console.log("🔒 Audit Log: SUBSCRIPTION_PURCHASED");
                }
            } catch (auditErr) {
                console.error("Audit log failed for purchase:", auditErr);
            }

            return true;
        }
    } catch (e) {
        if (!e.userCancelled) {
            // ✅ UX FIX: Handle the scenario where they already bought it but forgot
            if (e.code === Purchases.PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR ||
                e.code === Purchases.PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
                Alert.alert(
                    "Already Subscribed",
                    "This account already has an active Pro subscription. Please tap 'Restore Purchase' at the bottom of the screen."
                );
                return false;
            }

            console.error("Purchase Error:", e);
            throw e; // Pass unknown errors back to the PaywallScreen
        }
    }
    return false;
};

export const restorePurchases = async () => {
    if (!Purchases) return false;
    try {
        const customerInfo = await Purchases.restorePurchases();
        if (customerInfo.entitlements?.active?.[ENTITLEMENT_ID]?.isActive) {
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
        if (customerInfo.entitlements?.active?.[ENTITLEMENT_ID]?.isActive) {
            return true;
        }
    } catch (e) {
        console.warn("Check Status Error:", e);
    }
    return false;
};

export const deleteRevenueCatCustomer = async () => {
    if (!Purchases) return;
    try {
        await Purchases.logOut();
        console.log("✅ RevenueCat Customer Identity Unlinked");
    } catch (e) {
        console.warn("RevenueCat Logout Error:", e.message);
    }
};
