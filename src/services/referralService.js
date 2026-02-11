import {
    collection,
    doc,
    getDocs,
    query,
    runTransaction,
    serverTimestamp,
    where
} from 'firebase/firestore';
import { db } from '../config/firebase';

// 1. Generate a personalized code (e.g., TOM2024)
export const generateReferralCode = (name) => {
    const firstName = (name || 'RUNNER').split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${firstName}${randomSuffix}`;
};

// 2. Validate if a code exists and return the referrer's UID
export const validateReferralCode = async (code) => {
    if (!code || code.length < 3) return null;

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('referralCode', '==', code.toUpperCase()));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // Return the first match (should be unique)
            const doc = snapshot.docs[0];
            return { uid: doc.id, ...doc.data() };
        }
        return null;
    } catch (error) {
        console.error("Error validating referral code:", error);
        return null;
    }
};

// 3. Process Success Referral (Give coins to referrer)
export const processReferralReward = async (referrerUid, newUserUid, codeUsed) => {
    if (!referrerUid || !newUserUid) return false;

    try {
        await runTransaction(db, async (transaction) => {
            const referrerRef = doc(db, 'users', referrerUid);
            const referralRef = doc(collection(db, 'referrals')); // New auto-ID doc

            const referrerDoc = await transaction.get(referrerRef);
            if (!referrerDoc.exists()) {
                throw "Referrer does not exist!";
            }

            const userData = referrerDoc.data();
            const currentCoins = userData.wallet?.coins || 0;
            const currentReferrals = userData.referralStats?.totalInvites || 0;
            const currentEarned = userData.referralStats?.coinsEarned || 0;

            // NEW: XP Reward
            const currentXP = userData.currentXP || 0;
            const xpReward = 500; // 500 XP per referral

            // Update Referrer
            transaction.update(referrerRef, {
                'wallet.coins': currentCoins + 100,
                'referralStats.totalInvites': currentReferrals + 1,
                'referralStats.coinsEarned': currentEarned + 100,
                'currentXP': currentXP + xpReward // Add XP
            });

            // Create Referral Record
            transaction.set(referralRef, {
                referrerUid,
                newUserUid,
                codeUsed,
                rewardAmount: 100,
                timestamp: serverTimestamp(),
                status: 'completed'
            });
        });

        console.log(`Referral reward processed for ${referrerUid}`);
        return true;
    } catch (error) {
        console.error("Referral Transaction Login Failed:", error);
        return false;
    }
};
