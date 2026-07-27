const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

admin.initializeApp();
const db = getFirestore();

// NOTE: this file is for LOCAL EMULATOR testing only (see package.json
// description) — real production deploys the original v1-API source. These
// functions were rewritten from v1 (functions.https.onCall) to v2 (onCall
// from firebase-functions/v2/https) because the local Functions emulator's
// v1-compat auth bridge doesn't populate context.auth even when its own
// request-verification log confirms the ID token was valid — reproduced on
// both firebase-functions 7.3.2-rc.0 and the stable 7.3.0. v2's onCall
// exposes auth via request.auth instead and works correctly in the emulator.
// The wire protocol the client SDK speaks is identical for v1 and v2, so no
// Android-side change is needed.
//
// Also switched from the namespaced admin.firestore()/admin.firestore.FieldValue
// to the modular getFirestore()/FieldValue from "firebase-admin/firestore":
// the namespaced FieldValue came back undefined inside the emulator's runtime
// wrapper even though it works fine in a plain node script — the modular
// import isn't affected.

exports.redeemReward = onCall(async (request) => {
    // 1. Check Authentication
    if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "You must be logged in to redeem rewards."
        );
    }

    const { rewardId, price, title } = request.data;
    const uid = request.auth.uid;

    if (!rewardId || !price) {
        throw new HttpsError(
            "invalid-argument",
            "Missing required fields: rewardId and price."
        );
    }

    const userRef = db.collection("users").doc(uid);

    try {
        // 2. Perform a Firestore Transaction to ensure concurrency protection
        const result = await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new HttpsError("not-found", "User document not found.");
            }

            const userData = userDoc.data();
            const currentCoins = userData.coins || 0;

            // 3. Prevent client-driven negative balances
            if (currentCoins < price) {
                throw new HttpsError(
                    "failed-precondition",
                    "Insufficient coins to redeem this reward."
                );
            }

            // 4. Deduct coins securely
            const newCoins = currentCoins - price;
            transaction.update(userRef, { coins: newCoins });

            // 5. Create immutable redemption record
            const redemptionRef = userRef.collection("redemptions").doc();
            transaction.set(redemptionRef, {
                rewardId,
                title: title || "Unknown Reward",
                price,
                timestamp: FieldValue.serverTimestamp(),
            });

            return { success: true, newCoinBalance: newCoins };
        });

        return result;

    } catch (error) {
        console.error("Redemption error:", error);

        // Pass known HttpsErrors directly to the client
        if (error instanceof HttpsError) {
            throw error;
        }

        // Obscure internal database/system errors
        throw new HttpsError(
            "internal",
            "An error occurred while redeeming the reward."
        );
    }
});

// --- GEMINI PROXY ---
exports.askGemini = onCall({ secrets: ["GEMINI_API_KEY"] }, async (request) => {
    // 1. Verify Authentication
    if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "You must be logged in to use the AI Coach."
        );
    }

    const { requestBody } = request.data;
    if (!requestBody) {
        throw new HttpsError(
            "invalid-argument",
            "Missing requestBody."
        );
    }

    // 2. Access the Secret Key securely from the Firebase environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("Missing GEMINI_API_KEY environment variable. Secret may not be properly bound.");
        throw new HttpsError(
            "internal",
            "AI Service Configuration Error."
        );
    }

    try {
        // 3. Securely tunnel the request to Google API
        // Node 18+ has native fetch() available globally
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();

        if (result.error) {
            console.error("Gemini API Error:", result.error);
            throw new HttpsError('internal', result.error.message || 'Gemini processing failed');
        }

        return result;

    } catch (error) {
        console.error("askGemini Error:", error);

        if (error instanceof HttpsError) {
            throw error;
        }

        throw new HttpsError(
            "internal",
            "An error occurred connecting to the AI Coach."
        );
    }
});

// --- ACCOUNT DELETION ---
exports.deleteAccountData = onCall(async (request) => {
    // 1. Verify Authentication
    if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "You must be logged in to delete your account."
        );
    }
    const uid = request.auth.uid;

    try {
        // 2. Delete User Profile Document (Breaks all structural links)
        await db.collection("users").doc(uid).delete();

        // 3. Attempt to Delete Storage References (Avatars)
        const bucket = admin.storage().bucket();
        try {
            await bucket.deleteFiles({ prefix: `avatars/${uid}` });
        } catch (storageError) {
            console.warn(`Storage cleanup skipped for ${uid}:`, storageError.message);
        }

        // 4. Delete Firebase Auth Identity
        await admin.auth().deleteUser(uid);

        console.log(`Successfully Obliterated User: ${uid}`);
        return { success: true, message: "Account successfully deleted." };

    } catch (error) {
        console.error("deleteAccountData Error:", error);

        throw new HttpsError(
            "internal",
            "Failed to permanently delete account data. Please contact support."
        );
    }
});

// --- SECURE ACTIVITY REWARDS ---
exports.saveRunActivity = onCall(async (request) => {
    // 1. Verify Authentication
    if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "You must be logged in to save runs."
        );
    }
    const uid = request.auth.uid;

    const { runEntry, calculatedUpdates = {} } = request.data;
    if (!runEntry || typeof runEntry.distance !== "number") {
        throw new HttpsError(
            "invalid-argument",
            "Missing or valid runEntry data."
        );
    }

    const distance = runEntry.distance;

    // Parse duration from "MM:SS" or "HH:MM:SS"
    let durationMinutes = 0;
    if (runEntry.duration) {
        const parts = String(runEntry.duration).split(':').map(Number);
        if (parts.length === 2) {
            durationMinutes = parts[0] + (parts[1] / 60);
        } else if (parts.length === 3) {
            durationMinutes = (parts[0] * 60) + parts[1] + (parts[2] / 60);
        }
    }

    // A. Server-Side Calculations (Immutable by client)
    const earnedXp = Math.floor((distance * 100) + (durationMinutes * 2));
    const earnedCoins = Math.floor(distance * 10);

    const userRef = db.collection("users").doc(uid);

    try {
        // Whitelist only specific fields from calculatedUpdates
        const safeUpdates = {};
        if (calculatedUpdates.gearList) safeUpdates.gearList = calculatedUpdates.gearList;
        if (typeof calculatedUpdates.totalKm === 'number') safeUpdates.totalKm = calculatedUpdates.totalKm;
        if (typeof calculatedUpdates.earningUnlockProgress === 'number') safeUpdates.earningUnlockProgress = calculatedUpdates.earningUnlockProgress;

        // B. Merge and Apply Updates via Admin SDK
        const firebaseUpdates = {
            runHistory: FieldValue.arrayUnion(runEntry),
            totalRuns: FieldValue.increment(1),
            weeklyDistance: FieldValue.increment(distance),
            currentXP: FieldValue.increment(earnedXp),
            coins: FieldValue.increment(earnedCoins),
            ...safeUpdates
        };

        await userRef.update(firebaseUpdates);

        // C. Return the Truth to the Client payload
        return {
            success: true,
            earnedXp,
            earnedCoins
        };

    } catch (error) {
        console.error("saveRunActivity Error:", error);
        throw new HttpsError(
            "internal",
            "Could not save run activity securely."
        );
    }
});
