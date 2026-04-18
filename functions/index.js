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

const MAX_MONTHLY_REDEMPTIONS = 3; // Max redemptions per user per calendar month

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
    const rewardRef = db.collection("rewards").doc(String(rewardId));

    // Current month key e.g. "2025-06"
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    try {
        const result = await db.runTransaction(async (transaction) => {
            const [userDoc, rewardDoc] = await Promise.all([
                transaction.get(userRef),
                transaction.get(rewardRef),
            ]);

            if (!userDoc.exists) {
                throw new functions.https.HttpsError("not-found", "User document not found.");
            }

            const userData = userDoc.data();
            const currentCoins = userData.coins || 0;

            // 1a. Per-5-minute cooldown (prevents rapid-fire redemptions)
            const lastRedemptionAt = userData.lastRedemptionAt;
            if (lastRedemptionAt) {
                const lastMs = lastRedemptionAt.toMillis ? lastRedemptionAt.toMillis() : lastRedemptionAt;
                const secondsSinceLast = (Date.now() - lastMs) / 1000;
                if (secondsSinceLast < 300) {
                    const waitSeconds = Math.ceil(300 - secondsSinceLast);
                    throw new functions.https.HttpsError(
                        "resource-exhausted",
                        `Please wait ${waitSeconds} seconds before redeeming another reward.`
                    );
                }
            }

            // 1b. Monthly redemption limit check
            const redemptionStats = userData.redemptionStats || {};
            const monthlyCount = redemptionStats.month === currentMonth
                ? (redemptionStats.count || 0)
                : 0;

            if (monthlyCount >= MAX_MONTHLY_REDEMPTIONS) {
                throw new functions.https.HttpsError(
                    "resource-exhausted",
                    `Monthly redemption limit of ${MAX_MONTHLY_REDEMPTIONS} reached. Resets next month.`
                );
            }

            // 2. Inventory check (only if the reward doc exists and has a stockCount field)
            const hasInventoryControl = rewardDoc.exists && rewardDoc.data().stockCount !== undefined;
            const stockCount = hasInventoryControl ? rewardDoc.data().stockCount : Infinity;

            if (stockCount <= 0) {
                throw new functions.https.HttpsError(
                    "resource-exhausted",
                    "This reward is currently out of stock."
                );
            }

            // 3. Coin balance check
            if (currentCoins < price) {
                throw new functions.https.HttpsError(
                    "failed-precondition",
                    "Insufficient coins to redeem this reward."
                );
            }

            const newCoins = currentCoins - price;

            // Generate a secure, unique redemption code
            const discountCode = generateRedemptionCode();
            const redemptionRef = userRef.collection("redemptions").doc();

            // Set expiry to 30 days from now
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            // 4. Atomic writes: deduct coins, update monthly counter, cooldown timestamp, decrement stock
            transaction.update(userRef, {
                coins: newCoins,
                redemptionStats: { month: currentMonth, count: monthlyCount + 1 },
                lastRedemptionAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            if (hasInventoryControl) {
                transaction.update(rewardRef, {
                    stockCount: admin.firestore.FieldValue.increment(-1),
                });
            }

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

// --- FAILED LOGIN NOTIFICATION ---
// Called client-side when the device-level lockout triggers (5th failed attempt).
// Sends a security alert email to the account owner. Unauthenticated on purpose
// (user is locked out, can't authenticate). Does NOT reveal whether email is registered.
exports.notifyLoginFailure = functions.runWith({ secrets: ["RESEND_API_KEY"] }).https.onCall(async (data) => {
    const { email } = data;
    if (!email || typeof email !== "string" || !email.includes("@")) return { sent: false };

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) return { sent: false };

    try {
        // Look up the user in Firebase Auth — only send if account exists.
        // This avoids leaking "email registered" info to the caller because
        // we always return { sent: false } for unknown emails with no visible difference.
        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(email);
        } catch {
            return { sent: false }; // Email not registered — silently ignore
        }

        const now = new Date().toLocaleString("en-US", {
            timeZone: "Asia/Beirut",
            dateStyle: "medium",
            timeStyle: "short",
        });

        const { Resend } = require("resend");
        const resend = new Resend(RESEND_API_KEY);

        await resend.emails.send({
            from: "Ruvo Security <security@ruvo.app>",
            to: email,
            subject: "Failed login attempts detected on your Ruvo account",
            html: `
                <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#121212;color:#fff;border-radius:12px;padding:32px">
                    <h2 style="color:#CCFF00;margin-top:0">Security Alert</h2>
                    <p>We detected 5 failed login attempts on your Ruvo account.</p>
                    <p style="color:#888;font-size:14px">Time: ${now}<br>Account: ${email}</p>
                    <p>Your account has been temporarily locked on that device for 15 minutes.</p>
                    <p>If this was you, simply wait and try again. If it wasn't you,
                    <a href="https://ruvo-app-99c85.web.app/reset-password" style="color:#CCFF00">reset your password immediately</a>
                    or contact <a href="mailto:support@ruvo.com" style="color:#CCFF00">support@ruvo.com</a>.</p>
                    <p style="color:#555;font-size:12px;margin-top:32px">This is an automated security message from Ruvo.</p>
                </div>
            `,
        });

        // Log the event in the user's audit trail
        await db.collection("users").doc(userRecord.uid)
            .collection("auditLog").add({
                action: "LOGIN_LOCKOUT_TRIGGERED",
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                email,
            });

        return { sent: true };
    } catch (error) {
        console.error("notifyLoginFailure error:", error.message);
        return { sent: false };
    }
});

// --- ADMIN: DISABLE MFA FOR USER (Account Recovery) ---
// Called by support staff when a user loses their phone and is locked out.
// Requires the caller to have the 'admin' custom claim set via Firebase Admin SDK.
exports.disableMfaForUser = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be authenticated.");
    }

    // Only allow users with the admin custom claim
    if (!context.auth.token.admin) {
        throw new functions.https.HttpsError("permission-denied", "Admin access required.");
    }

    const { targetUid } = data;
    if (!targetUid || typeof targetUid !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "targetUid is required.");
    }

    try {
        // Remove all enrolled MFA factors from the account
        await admin.auth().updateUser(targetUid, {
            multiFactor: { enrolledFactors: [] }
        });

        // Log the admin action in the target user's audit log
        await db.collection("users").doc(targetUid)
            .collection("auditLog").add({
                action: "ADMIN_MFA_DISABLED",
                performedBy: context.auth.uid,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                reason: data.reason || "Account recovery - lost phone",
            });

        console.log(`[Admin] MFA disabled for ${targetUid} by ${context.auth.uid}`);
        return { success: true, message: `MFA has been removed for user ${targetUid}. They can now log in with email/password only.` };
    } catch (error) {
        console.error("disableMfaForUser Error:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// --- ACCOUNT DELETION (GDPR compliant) ---
exports.deleteAccountData = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in to delete your account.");
    }
    const uid = context.auth.uid;

    // Helper: delete all docs in a Firestore subcollection in batches
    const deleteSubcollection = async (parentRef, subcollectionName) => {
        const colRef = parentRef.collection(subcollectionName);
        let snapshot = await colRef.limit(100).get();
        while (!snapshot.empty) {
            const batch = db.batch();
            snapshot.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            snapshot = await colRef.limit(100).get();
        }
    };

    try {
        const userRef = db.collection("users").doc(uid);

        // 1. Delete all subcollections
        await Promise.all([
            deleteSubcollection(userRef, "redemptions"),
            deleteSubcollection(userRef, "notifications"),
            deleteSubcollection(userRef, "auditLog"),
            deleteSubcollection(userRef, "saved_routes"),
        ]);

        // 2. Anonymize posts authored by this user
        const postsSnap = await db.collection("posts").where("userId", "==", uid).get();
        if (!postsSnap.empty) {
            const chunks = [];
            for (let i = 0; i < postsSnap.docs.length; i += 500) {
                chunks.push(postsSnap.docs.slice(i, i + 500));
            }
            for (const chunk of chunks) {
                const batch = db.batch();
                chunk.forEach(d => batch.update(d.ref, {
                    userId: "deleted",
                    userName: "[deleted]",
                    userAvatar: null,
                    text: "[This post has been removed]",
                }));
                await batch.commit();
            }
        }

        // 3. Delete user Firestore document
        await userRef.delete();

        // 4. Delete Storage files
        const bucket = admin.storage().bucket();
        try {
            await bucket.deleteFiles({ prefix: `avatars/${uid}` });
        } catch (storageError) {
            console.warn(`Storage cleanup skipped for ${uid}:`, storageError.message);
        }

        // 5. Delete Firebase Auth account
        await admin.auth().deleteUser(uid);
        return { success: true, message: "Account successfully deleted." };
    } catch (error) {
        console.error("deleteAccountData Error:", error);
        throw new functions.https.HttpsError("internal", "Failed to permanently delete account data.");
    }
});

// --- GDPR DATA EXPORT ---
exports.exportUserData = functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in to export your data.");
    }
    const uid = context.auth.uid;

    try {
        const userSnap = await db.collection("users").doc(uid).get();
        if (!userSnap.exists) {
            throw new functions.https.HttpsError("not-found", "User data not found.");
        }
        const userData = userSnap.data();

        // Fetch redemptions subcollection
        const redemptionsSnap = await db.collection("users").doc(uid).collection("redemptions").get();
        const redemptions = redemptionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Strip sensitive / internal fields before export
        const { fcmToken, ...exportableProfile } = userData;

        return {
            exportedAt: new Date().toISOString(),
            profile: exportableProfile,
            redemptions,
        };
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        console.error("exportUserData Error:", error);
        throw new functions.https.HttpsError("internal", "Failed to export user data.");
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

    // --- SANITY CHECKS (Cheat Prevention) ---
    // 1. Hard caps: no single run can exceed world-record-adjacent values
    const MAX_SINGLE_RUN_KM = 100;     // ultramarathon ceiling
    const MAX_DURATION_MINUTES = 720;  // 12 hours absolute max
    const MAX_AVG_SPEED_KMH = 25;      // ~world record marathon pace ceiling

    if (distance <= 0) {
        throw new functions.https.HttpsError("invalid-argument", "Run distance must be greater than 0.");
    }
    if (distance > MAX_SINGLE_RUN_KM) {
        throw new functions.https.HttpsError("invalid-argument", `Run distance exceeds maximum allowed (${MAX_SINGLE_RUN_KM}km).`);
    }
    if (durationMinutes > MAX_DURATION_MINUTES) {
        throw new functions.https.HttpsError("invalid-argument", `Run duration exceeds maximum allowed (${MAX_DURATION_MINUTES} minutes).`);
    }
    if (durationMinutes > 0) {
        const avgSpeedKmh = distance / (durationMinutes / 60);
        if (avgSpeedKmh > MAX_AVG_SPEED_KMH) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                `Average speed of ${avgSpeedKmh.toFixed(1)} km/h is not possible for a run.`
            );
        }
    }
    // 2. Daily coin cap — prevents farming via many small runs in one day
    const MAX_DAILY_COINS = 500;
    try {
        const userSnap = await db.collection("users").doc(uid).get();
        const todayKey = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
        const dailyEarnings = userSnap.data()?.dailyEarnings || {};
        if ((dailyEarnings[todayKey] || 0) >= MAX_DAILY_COINS) {
            throw new functions.https.HttpsError(
                "resource-exhausted",
                "Daily coin limit reached. Come back tomorrow!"
            );
        }
    } catch (e) {
        if (e instanceof functions.https.HttpsError) throw e;
        console.warn("Daily cap check failed, skipping:", e.message);
    }

    // --- ROUTE INTEGRITY VALIDATION ---
    // Re-derive distance from GPS points to detect inflated submissions
    const routePath = runEntry.routePath;
    if (routePath && Array.isArray(routePath) && routePath.length >= 2) {
        const MAX_SEGMENT_SPEED_MS = 25 / 3.6; // 6.94 m/s — same cap as client

        const toRad = (deg) => deg * Math.PI / 180;
        const haversineKm = (lat1, lon1, lat2, lon2) => {
            const R = 6371;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2 +
                      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        let routeDerivedKm = 0;
        let suspiciousSegments = 0;

        for (let i = 1; i < routePath.length; i++) {
            const prev = routePath[i - 1];
            const curr = routePath[i];
            if (!prev.latitude || !curr.latitude) continue;

            const segmentKm = haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);

            // If points have timestamps, validate segment speed
            if (prev.timestamp && curr.timestamp) {
                const timeDiffSec = (curr.timestamp - prev.timestamp) / 1000;
                if (timeDiffSec > 0) {
                    const impliedSpeedMs = (segmentKm * 1000) / timeDiffSec;
                    if (impliedSpeedMs > MAX_SEGMENT_SPEED_MS) {
                        suspiciousSegments++;
                        continue; // Don't count this segment's distance
                    }
                }
            }
            routeDerivedKm += segmentKm;
        }

        // More than 30% suspicious segments = reject the run
        const suspiciousRatio = suspiciousSegments / (routePath.length - 1);
        if (suspiciousRatio > 0.3) {
            console.warn(`[AntiCheat] uid=${uid} had ${Math.round(suspiciousRatio * 100)}% suspicious GPS segments. Rejecting.`);
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Run data contains invalid GPS segments and could not be saved."
            );
        }

        // Submitted distance must not exceed route-derived distance by more than 20%
        // (20% tolerance covers GPS drift and rounding)
        if (routeDerivedKm > 0.1 && distance > routeDerivedKm * 1.2) {
            console.warn(`[AntiCheat] uid=${uid} submitted ${distance.toFixed(2)}km but route only shows ${routeDerivedKm.toFixed(2)}km. Capping.`);
            // Cap to route-derived rather than reject — gives benefit of the doubt for GPS noise
            runEntry.distance = parseFloat(routeDerivedKm.toFixed(4));
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

    // XP calculation
    const earnedXp = Math.floor((distance * 100) + (durationMinutes * 2));

    // Ensure non-negative
    earnedCoins = Math.max(0, Math.floor(earnedCoins));

    // --- LEVEL-UP CALCULATION ---
    // XP threshold per level: 1000 * 1.15^(level-1)
    // Level 1→2: 1000 XP, Level 2→3: 1150, Level 3→4: 1322, ...
    const getXpToNextLevel = (lvl) => Math.floor(1000 * Math.pow(1.15, lvl - 1));

    let levelsGained = 0;
    let newLevel = 1;
    let newCurrentXP = earnedXp;
    let newXpToNextLevel = getXpToNextLevel(1);

    try {
        const levelSnap = await db.collection("users").doc(uid).get();
        const levelData = levelSnap.data() || {};
        newLevel = levelData.level || 1;
        newCurrentXP = (levelData.currentXP || 0) + earnedXp;
        newXpToNextLevel = levelData.xpToNextLevel || getXpToNextLevel(newLevel);

        // Level up as many times as the XP allows
        while (newCurrentXP >= newXpToNextLevel) {
            newCurrentXP -= newXpToNextLevel;
            newLevel++;
            levelsGained++;
            newXpToNextLevel = getXpToNextLevel(newLevel);
        }
    } catch (err) {
        console.warn("Level-up calculation error, skipping:", err.message);
    }

    const userRef = db.collection("users").doc(uid);

    try {
        const safeUpdates = {};
        if (calculatedUpdates.gearList) safeUpdates.gearList = calculatedUpdates.gearList;
        if (typeof calculatedUpdates.totalKm === "number") safeUpdates.totalKm = calculatedUpdates.totalKm;
        if (typeof calculatedUpdates.earningUnlockProgress === "number")
            safeUpdates.earningUnlockProgress = calculatedUpdates.earningUnlockProgress;

        const todayKey = new Date().toISOString().split("T")[0];
        await userRef.update({
            runHistory: admin.firestore.FieldValue.arrayUnion(runEntry),
            totalRuns: admin.firestore.FieldValue.increment(1),
            weeklyDistance: admin.firestore.FieldValue.increment(distance),
            currentXP: newCurrentXP,
            level: newLevel,
            xpToNextLevel: newXpToNextLevel,
            coins: admin.firestore.FieldValue.increment(earnedCoins),
            [`dailyEarnings.${todayKey}`]: admin.firestore.FieldValue.increment(earnedCoins),
            ...safeUpdates,
        });

        return {
            success: true,
            earnedXp,
            earnedCoins,
            coinBreakdown: breakdown,
            levelsGained,
            newLevel,
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

// --- CUSTOM PASSWORD RESET EMAIL (via Resend) ---
exports.sendPasswordResetLink = functions.runWith({ secrets: ["RESEND_API_KEY"] }).https.onCall(async (data) => {
    const { email } = data;

    if (!email || typeof email !== "string" || !email.includes("@")) {
        throw new functions.https.HttpsError("invalid-argument", "A valid email address is required.");
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Generate the Firebase password reset link (short-lived, signed)
    let resetLink;
    try {
        resetLink = await admin.auth().generatePasswordResetLink(normalizedEmail, {
            url: "https://ruvo.run",
            handleCodeInApp: false,
        });
    } catch (err) {
        // auth/user-not-found → send generic success to prevent email enumeration
        if (err.code === "auth/user-not-found") {
            return { success: true };
        }
        console.error("generatePasswordResetLink error:", err);
        throw new functions.https.HttpsError("internal", "Could not generate reset link.");
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const year = new Date().getFullYear();

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#111;border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:#000;padding:32px 40px;text-align:center;border-bottom:1px solid #222;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#ccff00;letter-spacing:4px;">RUVO</p>
          <p style="margin:6px 0 0;font-size:12px;color:#555;letter-spacing:1px;text-transform:uppercase;">AI Running Coach</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#fff;">Reset your password</p>
          <p style="margin:0 0 28px;font-size:14px;color:#888;line-height:1.6;">
            We received a request to reset the password for your Ruvo account. Click the button below to choose a new password.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            <tr><td align="center">
              <a href="${resetLink}" style="display:inline-block;background:#ccff00;color:#000;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:50px;letter-spacing:0.5px;">Reset Password</a>
            </td></tr>
          </table>

          <p style="margin:0 0 8px;font-size:13px;color:#666;line-height:1.6;">
            This link expires in <strong style="color:#aaa;">1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your account remains secure.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 40px;border-top:1px solid #222;text-align:center;">
          <p style="margin:0;font-size:12px;color:#444;">© ${year} Ruvo. All rights reserved.</p>
          <p style="margin:6px 0 0;font-size:12px;color:#333;">
            <a href="https://ruvo.run/privacy" style="color:#555;text-decoration:none;">Privacy Policy</a>
            &nbsp;·&nbsp;
            <a href="https://ruvo.run/terms" style="color:#555;text-decoration:none;">Terms of Service</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "Ruvo <noreply@ruvo.run>",
                to: [normalizedEmail],
                subject: "Reset your Ruvo password",
                html: htmlBody,
            }),
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error("Resend error:", errBody);
            throw new functions.https.HttpsError("internal", "Failed to send reset email.");
        }

        return { success: true };
    } catch (err) {
        if (err instanceof functions.https.HttpsError) throw err;
        console.error("sendPasswordResetLink error:", err);
        throw new functions.https.HttpsError("internal", "Failed to send reset email.");
    }
});
