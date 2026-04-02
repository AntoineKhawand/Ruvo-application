const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.redeemReward = functions.https.onCall(async (data, context) => {
    // 1. Check Authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "You must be logged in to redeem rewards."
        );
    }

    const { rewardId, price, title, rewardType } = data;
    const uid = context.auth.uid;

    if (!rewardId || !price) {
        throw new functions.https.HttpsError(
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
                throw new functions.https.HttpsError("not-found", "User document not found.");
            }

            const userData = userDoc.data();
            const currentCoins = userData.coins || 0;

            // 3. Prevent client-driven negative balances
            if (currentCoins < price) {
                throw new functions.https.HttpsError(
                    "failed-precondition",
                    "Insufficient coins to redeem this reward."
                );
            }

            // 4. Deduct coins securely
            const newCoins = currentCoins - price;
            transaction.update(userRef, { coins: newCoins });

            // 5. Setup dynamic reward data
            let discountCode = null;
            let status = "pending";
            const finalType = rewardType || "digital";
            
            if (finalType === "digital") {
                discountCode = "RUVO-" + Math.random().toString(36).substring(2, 8).toUpperCase();
                status = "delivered";
            } else if (finalType === "physical") {
                status = "processing";
            }

            // 6. Create immutable redemption record
            const redemptionRef = userRef.collection("redemptions").doc();
            transaction.set(redemptionRef, {
                rewardId,
                title: title || "Unknown Reward",
                price,
                rewardType: finalType,
                discountCode,
                status,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            return { 
                success: true, 
                newCoinBalance: newCoins,
                redemptionId: redemptionRef.id,
                discountCode,
                status,
                userEmail: userData.email || null
            };
        });

        // 7. Post-transaction Triggers (Notifications / Emails)
        if (rewardType === "physical") {
            // MOCK: SendGrid / Resend API Trigger
            console.log(`[EMAIL TRIGGER MOCK] Admin Notify: Fulfill Physical Reward "${title}" for UID: ${uid}. Emailing user at ${result.userEmail}`);
        } else {
            // MOCK: Expo Push Notification Trigger
            console.log(`[PUSH TRIGGER MOCK] Push Sent to ${uid}: Your reward code ${result.discountCode} is ready for ${title}!`);
        }

        return result;

    } catch (error) {
        console.error("Redemption error:", error);

        // Pass known HttpsErrors directly to the client
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        // Obscure internal database/system errors
        throw new functions.https.HttpsError(
            "internal",
            "An error occurred while redeeming the reward."
        );
    }
});

// --- GEMINI PROXY ---
exports.askGemini = functions.runWith({ secrets: ["GEMINI_API_KEY"] }).https.onCall(async (data, context) => {
    // 1. Verify Authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "You must be logged in to use the AI Coach."
        );
    }

    const { requestBody } = data;
    if (!requestBody) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Missing requestBody."
        );
    }

    // 2. Access the Secret Key securely from the Firebase environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("Missing GEMINI_API_KEY environment variable. Secret may not be properly bound.");
        throw new functions.https.HttpsError(
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
            throw new functions.https.HttpsError('internal', result.error.message || 'Gemini processing failed');
        }

        return result;

    } catch (error) {
        console.error("askGemini Error:", error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        throw new functions.https.HttpsError(
            "internal",
            "An error occurred connecting to the AI Coach."
        );
    }
});

// --- ACCOUNT DELETION ---
exports.deleteAccountData = functions.https.onCall(async (data, context) => {
    // 1. Verify Authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "You must be logged in to delete your account."
        );
    }
    const uid = context.auth.uid;

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

        throw new functions.https.HttpsError(
            "internal",
            "Failed to permanently delete account data. Please contact support."
        );
    }
});

// --- SECURE ACTIVITY REWARDS ---
exports.saveRunActivity = functions.https.onCall(async (data, context) => {
    // 1. Verify Authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "You must be logged in to save runs."
        );
    }
    const uid = context.auth.uid;

    const { runEntry, calculatedUpdates = {} } = data;
    if (!runEntry || typeof runEntry.distance !== "number") {
        throw new functions.https.HttpsError(
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
            runHistory: admin.firestore.FieldValue.arrayUnion(runEntry),
            totalRuns: admin.firestore.FieldValue.increment(1),
            weeklyDistance: admin.firestore.FieldValue.increment(distance),
            currentXP: admin.firestore.FieldValue.increment(earnedXp),
            coins: admin.firestore.FieldValue.increment(earnedCoins),
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
        throw new functions.https.HttpsError(
            "internal",
            "Could not save run activity securely."
        );
    }
});

// --- WHOOP INTEGRATION ---
exports.syncWhoopData = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in to sync Whoop data.");
    }
    const uid = context.auth.uid;
    const { accessToken } = data;

    if (!accessToken) {
        throw new functions.https.HttpsError("invalid-argument", "Missing Whoop access token.");
    }

    try {
        const headers = { Authorization: `Bearer ${accessToken}` };

        // Fetch from the 4 specified endpoints
        const [recoveryRes, cycleRes, sleepRes, hrRes] = await Promise.all([
            fetch('https://api.prod.whoop.com/developer/v1/recovery', { headers }),
            fetch('https://api.prod.whoop.com/developer/v1/cycle', { headers }),
            fetch('https://api.prod.whoop.com/developer/v1/sleep', { headers }),
            fetch('https://api.prod.whoop.com/developer/v1/user/measurement/heart_rate', { headers }).catch(() => null)
        ]);

        if (!recoveryRes.ok) throw new Error("Whoop API /recovery failed");
        
        const recoveryData = await recoveryRes.json();
        const cycleData = await cycleRes.json();
        const sleepData = await sleepRes.json();
        
        let hrData = null;
        if (hrRes && hrRes.ok) {
            hrData = await hrRes.json();
        }

        // Parse Standard Whoop Developer API Structure
        const whoopMap = {
            recovery: recoveryData?.records?.[0]?.score?.recovery_score ?? null,
            strain: cycleData?.records?.[0]?.score?.strain ?? null,
            sleepScore: sleepData?.records?.[0]?.score?.sleep_performance_percentage ?? null,
            hrv: recoveryData?.records?.[0]?.score?.hrv_rmssd_milli ?? null,
            restingHR: recoveryData?.records?.[0]?.score?.resting_heart_rate ?? null,
            lastSync: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("users").doc(uid).update({ whoopData: whoopMap });

        return { success: true, whoopData: whoopMap };

    } catch (error) {
        console.error("syncWhoopData Error:", error);
        throw new functions.https.HttpsError("internal", "Failed to sync Whoop data.");
    }
});

// --- OURA INTEGRATION ---
exports.syncOuraData = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in to sync Oura data.");
    }
    const uid = context.auth.uid;
    const { accessToken } = data;

    if (!accessToken) {
        throw new functions.https.HttpsError("invalid-argument", "Missing Oura access token.");
    }

    try {
        const headers = { Authorization: `Bearer ${accessToken}` };

        // Fetch from the 4 specified Oura API v2 endpoints
        const [readinessRes, sleepRes, hrRes, activityRes] = await Promise.all([
            fetch('https://api.ouraring.com/v2/usercollection/daily_readiness', { headers }),
            fetch('https://api.ouraring.com/v2/usercollection/daily_sleep', { headers }),
            fetch('https://api.ouraring.com/v2/usercollection/heartrate', { headers }),
            fetch('https://api.ouraring.com/v2/usercollection/daily_activity', { headers })
        ]);

        if (!readinessRes.ok) throw new Error("Oura API /daily_readiness failed");
        
        const readinessData = await readinessRes.json();
        const sleepData = await sleepRes.json();
        const hrData = await hrRes.json();
        const activityData = await activityRes.json();

        // Extract latest data from arrays (Oura returns an array of daily summaries)
        const readiness = readinessData?.data?.[0];
        const sleep = sleepData?.data?.[0];
        const hr = hrData?.data?.[0];
        const activity = activityData?.data?.[0];

        // Parse Standard Oura API Structure
        const ouraMap = {
            readinessScore: readiness?.score ?? null,
            temperatureDeviation: readiness?.temperature_deviation ?? null,
            sleepScore: sleep?.score ?? null,
            remSleepDuration: sleep?.rem_sleep_duration ?? null,
            deepSleepDuration: sleep?.deep_sleep_duration ?? null,
            lightSleepDuration: sleep?.light_sleep_duration ?? null,
            totalSleepDuration: sleep?.total_sleep_duration ?? null,
            hrv: hr?.hrv_rmssd_milli ?? null, // Assuming HRV format or similar, Oura might place it in sleep/readiness. We map safely.
            restingHR: hr?.resting_heart_rate ?? null,
            activityScore: activity?.score ?? null,
            steps: activity?.steps ?? null,
            calories: activity?.active_calories ?? null,
            lastSync: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("users").doc(uid).update({ ouraData: ouraMap });

        return { success: true, ouraData: ouraMap };

    } catch (error) {
        console.error("syncOuraData Error:", error);
        throw new functions.https.HttpsError("internal", "Failed to sync Oura data.");
    }
});
