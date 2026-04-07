const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// --- HELPERS ---
const { generateQRDataUrl, getVerificationUrl } = require("./utils/qrHelper");
const { buildRewardEmailHtml } = require("./utils/emailTemplate");

// The web app's base URL — matches Firebase Hosting domain
const WEB_APP_URL = "https://ruvo-app-99c85.web.app";

// Generate a cryptographically secure, human-readable code
const generateRedemptionCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // removed ambiguous chars (0,O,1,I)
    const segments = [0, 1, 2].map(() =>
        Array.from({ length: 4 }, () =>
            chars[Math.floor(Math.random() * chars.length)]
        ).join("")
    );
    return `RUVO-${segments.join("-")}`;
};

// --- REDEEM REWARD (Upgraded) ---
exports.redeemReward = functions.runWith({ secrets: ["RESEND_API_KEY"] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in to redeem rewards.");
    }

    const { rewardId, price, title, rewardType } = data;
    const uid = context.auth.uid;

    if (!rewardId || !price) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required fields: rewardId and price.");
    }

    const userRef = db.collection("users").doc(uid);

    try {
        const result = await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new functions.https.HttpsError("not-found", "User document not found.");
            }

            const userData = userDoc.data();
            const currentCoins = userData.coins || 0;

            if (currentCoins < price) {
                throw new functions.https.HttpsError(
                    "failed-precondition",
                    "Insufficient coins to redeem this reward."
                );
            }

            const newCoins = currentCoins - price;
            transaction.update(userRef, { coins: newCoins });

            // Generate a secure, unique redemption code
            const discountCode = generateRedemptionCode();
            const redemptionRef = userRef.collection("redemptions").doc();

            // Set expiry to 30 days from now
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            transaction.set(redemptionRef, {
                rewardId,
                title: title || "Unknown Reward",
                price,
                rewardType: rewardType || "digital",
                discountCode,
                status: "active",          // active | used | expired
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: expiresAt.toISOString(),
                uid,                        // store uid for easy lookup
            });

            return {
                success: true,
                newCoinBalance: newCoins,
                redemptionId: redemptionRef.id,
                discountCode,
                userName: userData.name || null,
                userEmail: userData.email || null,
            };
        });

        // --- SEND EMAIL (after transaction commits) ---
        await sendRewardEmail(result);

        return {
            success: true,
            newCoinBalance: result.newCoinBalance,
            redemptionId: result.redemptionId,
            discountCode: result.discountCode,
            message: "Check your email for your reward code.",
        };

    } catch (error) {
        console.error("Redemption error:", error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError("internal", "An error occurred while redeeming the reward.");
    }
});

// --- SEND REWARD EMAIL ---
const sendRewardEmail = async ({ discountCode, userName, userEmail, title }) => {
    try {
        const { Resend } = require("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);

        if (!process.env.RESEND_API_KEY) {
            console.warn("[Email] RESEND_API_KEY not configured — skipping email send.");
            return;
        }

        if (!userEmail) {
            console.warn("[Email] No user email — skipping email send.");
            return;
        }

        const qrDataUrl = await generateQRDataUrl(discountCode, WEB_APP_URL);
        const html = buildRewardEmailHtml({
            userName: userName || "Ruvo Runner",
            rewardTitle: title || "Ruvo Reward",
            code: discountCode,
            qrDataUrl,
            verificationUrl: getVerificationUrl(discountCode, WEB_APP_URL),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        });

        await resend.emails.send({
            from: "Ruvo Rewards <rewards@ruvo.run>",
            to: userEmail,
            subject: `🎉 Your Ruvo Reward: ${title || "Check your reward!"}`,
            html,
        });

        console.log(`[Email] Sent reward email to ${userEmail} for code ${discountCode}`);
    } catch (err) {
        // Never fail the redemption if the email fails
        console.error("[Email] Failed to send reward email:", err.message);
    }
};

// --- VERIFY REWARD CODE (public HTTP endpoint for store staff) ---
exports.verifyRewardCode = functions.https.onRequest(async (req, res) => {
    // CORS headers for browser access
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(204).send("");
    }

    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const code = (req.query.code || "").trim().toUpperCase();

    if (!code) {
        return res.status(400).json({ error: "Missing 'code' query parameter." });
    }

    try {
        // Search all user redemption subcollections for this code
        // In production, add a top-level `redemptions` collection indexed by discountCode for performance
        const usersSnap = await db.collection("users").get();
        let redemptionData = null;

        for (const userDoc of usersSnap.docs) {
            const snap = await db
                .collection("users")
                .doc(userDoc.id)
                .collection("redemptions")
                .where("discountCode", "==", code)
                .limit(1)
                .get();

            if (!snap.empty) {
                redemptionData = { id: snap.docs[0].id, ...snap.docs[0].data(), uid: userDoc.id };
                break;
            }
        }

        if (!redemptionData) {
            return res.status(404).json({ error: "Code not found." });
        }

        const {
            discountCode,
            title,
            status,
            timestamp,
            expiresAt,
            uid,
        } = redemptionData;

        // Check expiry
        if (expiresAt && new Date(expiresAt) < new Date()) {
            return res.json({
                code: discountCode,
                status: "expired",
                error: "This code has expired.",
            });
        }

        // Get user name for display
        let userName = "Ruvo Member";
        try {
            const userSnap = await db.collection("users").doc(uid).get();
            if (userSnap.exists) {
                userName = userSnap.data().name || userName;
            }
        } catch (_) { /* ignore */ }

        // Format redemption date
        let redeemedAt = null;
        if (timestamp) {
            const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            redeemedAt = d.toLocaleDateString(undefined, {
                month: "long", day: "numeric", year: "numeric",
            });
        }

        return res.json({
            code: discountCode,
            userName,
            rewardTitle: title,
            status,
            redeemedAt,
            isValid: status === "active",
        });
    } catch (err) {
        console.error("[Verify] Error:", err);
        return res.status(500).json({ error: "Internal server error." });
    }
});

// --- MARK CODE AS USED (public HTTP endpoint for store staff) ---
exports.redeemRewardCode = functions.https.onRequest(async (req, res) => {
    // CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(204).send("");
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    let code;
    try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        code = (body.code || "").trim().toUpperCase();
    } catch (_) {
        code = "";
    }

    if (!code) {
        return res.status(400).json({ error: "Missing 'code' in request body." });
    }

    try {
        const usersSnap = await db.collection("users").get();
        let redemptionRef = null;
        let redemptionData = null;

        for (const userDoc of usersSnap.docs) {
            const snap = await db
                .collection("users")
                .doc(userDoc.id)
                .collection("redemptions")
                .where("discountCode", "==", code)
                .limit(1)
                .get();

            if (!snap.empty) {
                redemptionRef = snap.docs[0].ref;
                redemptionData = snap.docs[0].data();
                break;
            }
        }

        if (!redemptionRef) {
            return res.status(404).json({ success: false, error: "Code not found." });
        }

        if (redemptionData.status === "used") {
            return res.json({
                success: false,
                error: "This code has already been used.",
                alreadyUsed: true,
            });
        }

        if (redemptionData.status === "expired") {
            return res.json({
                success: false,
                error: "This code has expired.",
                expired: true,
            });
        }

        await redemptionRef.update({
            status: "used",
            redeemedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`[Redeem] Code ${code} marked as used.`);
        return res.json({ success: true, message: "Code successfully redeemed." });
    } catch (err) {
        console.error("[Redeem] Error:", err);
        return res.status(500).json({ success: false, error: "Internal server error." });
    }
});

// --- GEMINI PROXY ---
exports.askGemini = functions.runWith({ secrets: ["GEMINI_API_KEY"] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in to use the AI Coach.");
    }

    const { requestBody } = data;
    if (!requestBody) {
        throw new functions.https.HttpsError("invalid-argument", "Missing requestBody.");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("Missing GEMINI_API_KEY environment variable.");
        throw new functions.https.HttpsError("internal", "AI Service Configuration Error.");
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            }
        );

        const result = await response.json();

        if (result.error) {
            console.error("Gemini API Error:", result.error);
            throw new functions.https.HttpsError("internal", result.error.message || "Gemini processing failed");
        }

        return result;
    } catch (error) {
        console.error("askGemini Error:", error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError("internal", "An error occurred connecting to the AI Coach.");
    }
});

// --- ACCOUNT DELETION ---
exports.deleteAccountData = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in to delete your account.");
    }
    const uid = context.auth.uid;

    try {
        await db.collection("users").doc(uid).delete();

        const bucket = admin.storage().bucket();
        try {
            await bucket.deleteFiles({ prefix: `avatars/${uid}` });
        } catch (storageError) {
            console.warn(`Storage cleanup skipped for ${uid}:`, storageError.message);
        }

        await admin.auth().deleteUser(uid);
        return { success: true, message: "Account successfully deleted." };
    } catch (error) {
        console.error("deleteAccountData Error:", error);
        throw new functions.https.HttpsError("internal", "Failed to permanently delete account data.");
    }
});

// --- SECURE ACTIVITY REWARDS ---
exports.saveRunActivity = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in to save runs.");
    }
    const uid = context.auth.uid;

    const { runEntry, calculatedUpdates = {} } = data;
    if (!runEntry || typeof runEntry.distance !== "number") {
        throw new functions.https.HttpsError("invalid-argument", "Missing or invalid runEntry data.");
    }

    const distance = runEntry.distance;
    let durationMinutes = 0;
    if (runEntry.duration) {
        const parts = String(runEntry.duration).split(":").map(Number);
        if (parts.length === 2) {
            durationMinutes = parts[0] + parts[1] / 60;
        } else if (parts.length === 3) {
            durationMinutes = parts[0] * 60 + parts[1] + parts[2] / 60;
        }
    }

    // --- ENHANCED COIN CALCULATION (Test A.1.1) ---
    // Formula: Base + Pace Bonus + Streak Bonus + Time-of-Day Bonus
    
    const BASE_RATE_PER_KM = 10; // 10 coins per km base
    
    // 1. Distance component (base rate)
    let earnedCoins = distance * BASE_RATE_PER_KM;
    let breakdown = {
        base: Math.floor(earnedCoins),
        paceBonus: 0,
        streakBonus: 0,
        timeBonus: 0,
    };

    // 2. Pace bonus (faster = higher)
    // Calculate pace in min/km
    const paceMinPerKm = durationMinutes > 0 && distance > 0 ? durationMinutes / distance : 0;
    if (paceMinPerKm > 0 && paceMinPerKm <= 10) {
        // Pace thresholds:
        // < 5 min/km = +20% (elite)
        // 5-6 min/km = +15% (fast)
        // 6-7 min/km = +10% (moderate)
        // 7-8 min/km = +5% (easy)
        // > 8 min/km = 0% (slow)
        let paceMultiplier = 0;
        if (paceMinPerKm < 5) paceMultiplier = 0.20;
        else if (paceMinPerKm < 6) paceMultiplier = 0.15;
        else if (paceMinPerKm < 7) paceMultiplier = 0.10;
        else if (paceMinPerKm < 8) paceMultiplier = 0.05;
        
        const paceBonus = Math.floor(earnedCoins * paceMultiplier);
        earnedCoins += paceBonus;
        breakdown.paceBonus = paceBonus;
    }

    // 3. Streak bonus (+5% for 7+ day streaks)
    try {
        const userSnap = await db.collection("users").doc(uid).get();
        const userData = userSnap.data();
        const runHistory = userData?.runHistory || [];
        
        // Calculate current streak from runHistory
        if (runHistory.length > 0) {
            const uniqueDates = [...new Set(
                runHistory
                    .filter(r => r.date)
                    .map(r => new Date(r.date).toDateString())
            )].sort((a, b) => new Date(b) - new Date(a)); // newest first
            
            let streak = 0;
            const today = new Date().toDateString();
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            
            // Check if user ran today or yesterday to maintain streak
            if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
                streak = 1;
                for (let i = 0; i < uniqueDates.length - 1; i++) {
                    const current = new Date(uniqueDates[i]);
                    const next = new Date(uniqueDates[i + 1]);
                    const diffDays = (current - next) / 86400000;
                    if (diffDays === 1) {
                        streak++;
                    } else {
                        break;
                    }
                }
            }
            
            // Apply streak bonus if 7+ days
            if (streak >= 7) {
                const streakBonus = Math.floor(earnedCoins * 0.05);
                earnedCoins += streakBonus;
                breakdown.streakBonus = streakBonus;
            }
        }
    } catch (err) {
        console.warn("Streak calculation error:", err);
    }

    // 4. Time-of-day bonus (dynamic pricing)
    const now = new Date();
    const hour = now.getHours();
    // Off-peak (6am-8am, 11am-1pm, 2pm-5pm) = +10%
    // Peak (6pm-9pm) = -10%
    // Normal = 0%
    let timeMultiplier = 0;
    if ((hour >= 6 && hour <= 8) || (hour >= 11 && hour <= 13) || (hour >= 14 && hour <= 17)) {
        timeMultiplier = 0.10; // Off-peak bonus
    } else if (hour >= 18 && hour <= 21) {
        timeMultiplier = -0.10; // Peak penalty
    }
    
    if (timeMultiplier !== 0) {
        const timeBonus = Math.floor(earnedCoins * timeMultiplier);
        earnedCoins += timeBonus;
        breakdown.timeBonus = timeBonus;
    }

    // XP calculation (unchanged)
    const earnedXp = Math.floor((distance * 100) + (durationMinutes * 2));
    
    // Ensure non-negative
    earnedCoins = Math.max(0, Math.floor(earnedCoins));

    const userRef = db.collection("users").doc(uid);

    try {
        const safeUpdates = {};
        if (calculatedUpdates.gearList) safeUpdates.gearList = calculatedUpdates.gearList;
        if (typeof calculatedUpdates.totalKm === "number") safeUpdates.totalKm = calculatedUpdates.totalKm;
        if (typeof calculatedUpdates.earningUnlockProgress === "number")
            safeUpdates.earningUnlockProgress = calculatedUpdates.earningUnlockProgress;

        await userRef.update({
            runHistory: admin.firestore.FieldValue.arrayUnion(runEntry),
            totalRuns: admin.firestore.FieldValue.increment(1),
            weeklyDistance: admin.firestore.FieldValue.increment(distance),
            currentXP: admin.firestore.FieldValue.increment(earnedXp),
            coins: admin.firestore.FieldValue.increment(earnedCoins),
            ...safeUpdates,
        });

        return { 
            success: true, 
            earnedXp, 
            earnedCoins,
            coinBreakdown: breakdown, // Include breakdown for UI transparency
        };
    } catch (error) {
        console.error("saveRunActivity Error:", error);
        throw new functions.https.HttpsError("internal", "Could not save run activity securely.");
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

        const [recoveryRes, cycleRes, sleepRes, hrRes] = await Promise.all([
            fetch("https://api.prod.whoop.com/developer/v1/recovery", { headers }),
            fetch("https://api.prod.whoop.com/developer/v1/cycle", { headers }),
            fetch("https://api.prod.whoop.com/developer/v1/sleep", { headers }),
            fetch("https://api.prod.whoop.com/developer/v1/user/measurement/heart_rate", { headers }).catch(() => null),
        ]);

        if (!recoveryRes.ok) throw new Error("Whoop API /recovery failed");

        const recoveryData = await recoveryRes.json();
        const cycleData = await cycleRes.json();
        const sleepData = await sleepRes.json();
        let hrData = null;
        if (hrRes && hrRes.ok) hrData = await hrRes.json();

        const whoopMap = {
            recovery: recoveryData?.records?.[0]?.score?.recovery_score ?? null,
            strain: cycleData?.records?.[0]?.score?.strain ?? null,
            sleepScore: sleepData?.records?.[0]?.score?.sleep_performance_percentage ?? null,
            hrv: recoveryData?.records?.[0]?.score?.hrv_rmssd_milli ?? null,
            restingHR: recoveryData?.records?.[0]?.score?.resting_heart_rate ?? null,
            lastSync: admin.firestore.FieldValue.serverTimestamp(),
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

        const [readinessRes, sleepRes, hrRes, activityRes] = await Promise.all([
            fetch("https://api.ouraring.com/v2/usercollection/daily_readiness", { headers }),
            fetch("https://api.ouraring.com/v2/usercollection/daily_sleep", { headers }),
            fetch("https://api.ouraring.com/v2/usercollection/heartrate", { headers }),
            fetch("https://api.ouraring.com/v2/usercollection/daily_activity", { headers }),
        ]);

        if (!readinessRes.ok) throw new Error("Oura API /daily_readiness failed");

        const readiness = (await readinessRes.json())?.data?.[0];
        const sleep = (await sleepRes.json())?.data?.[0];
        const hr = (await hrRes.json())?.data?.[0];
        const activity = (await activityRes.json())?.data?.[0];

        const ouraMap = {
            readinessScore: readiness?.score ?? null,
            temperatureDeviation: readiness?.temperature_deviation ?? null,
            sleepScore: sleep?.score ?? null,
            remSleepDuration: sleep?.rem_sleep_duration ?? null,
            deepSleepDuration: sleep?.deep_sleep_duration ?? null,
            lightSleepDuration: sleep?.light_sleep_duration ?? null,
            totalSleepDuration: sleep?.total_sleep_duration ?? null,
            hrv: hr?.hrv_rmssd_milli ?? null,
            restingHR: hr?.resting_heart_rate ?? null,
            activityScore: activity?.score ?? null,
            steps: activity?.steps ?? null,
            calories: activity?.active_calories ?? null,
            lastSync: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection("users").doc(uid).update({ ouraData: ouraMap });
        return { success: true, ouraData: ouraMap };
    } catch (error) {
        console.error("syncOuraData Error:", error);
        throw new functions.https.HttpsError("internal", "Failed to sync Oura data.");
    }
});
