// Firebase Functions v2 — Node.js 22
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Secrets (must be created in Firebase Secret Manager before deploying)
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// --- HELPERS ---
const { generateQRDataUrl, getVerificationUrl } = require("./utils/qrHelper");
const { buildRewardEmailHtml } = require("./utils/emailTemplate");

const WEB_APP_URL = "https://ruvo-app-99c85.web.app";

const generateRedemptionCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const segments = [0, 1, 2].map(() =>
        Array.from({ length: 4 }, () =>
            chars[Math.floor(Math.random() * chars.length)]
        ).join("")
    );
    return `RUVO-${segments.join("-")}`;
};

const MAX_MONTHLY_REDEMPTIONS = 3;


// ─────────────────────────────────────────────────────────────────
// REDEEM REWARD
// ─────────────────────────────────────────────────────────────────
exports.redeemReward = onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to redeem rewards.");
    }

    const { rewardId, price, title, rewardType } = request.data;
    const uid = request.auth.uid;

    if (!rewardId || !price) {
        throw new HttpsError("invalid-argument", "Missing required fields: rewardId and price.");
    }

    const userRef = db.collection("users").doc(uid);
    const rewardRef = db.collection("rewards").doc(String(rewardId));

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    try {
        const result = await db.runTransaction(async (transaction) => {
            const [userDoc, rewardDoc] = await Promise.all([
                transaction.get(userRef),
                transaction.get(rewardRef),
            ]);

            if (!userDoc.exists) {
                throw new HttpsError("not-found", "User document not found.");
            }

            const userData = userDoc.data();
            const currentCoins = userData.coins || 0;

            const lastRedemptionAt = userData.lastRedemptionAt;
            if (lastRedemptionAt) {
                const lastMs = lastRedemptionAt.toMillis ? lastRedemptionAt.toMillis() : lastRedemptionAt;
                const secondsSinceLast = (Date.now() - lastMs) / 1000;
                if (secondsSinceLast < 300) {
                    const waitSeconds = Math.ceil(300 - secondsSinceLast);
                    throw new HttpsError(
                        "resource-exhausted",
                        `Please wait ${waitSeconds} seconds before redeeming another reward.`
                    );
                }
            }

            const redemptionStats = userData.redemptionStats || {};
            const monthlyCount = redemptionStats.month === currentMonth
                ? (redemptionStats.count || 0)
                : 0;

            if (monthlyCount >= MAX_MONTHLY_REDEMPTIONS) {
                throw new HttpsError(
                    "resource-exhausted",
                    `Monthly redemption limit of ${MAX_MONTHLY_REDEMPTIONS} reached. Resets next month.`
                );
            }

            const hasInventoryControl = rewardDoc.exists && rewardDoc.data().stockCount !== undefined;
            const stockCount = hasInventoryControl ? rewardDoc.data().stockCount : Infinity;

            if (stockCount <= 0) {
                throw new HttpsError("resource-exhausted", "This reward is currently out of stock.");
            }

            if (currentCoins < price) {
                throw new HttpsError("failed-precondition", "Insufficient coins to redeem this reward.");
            }

            const newCoins = currentCoins - price;
            const discountCode = generateRedemptionCode();
            const redemptionRef = userRef.collection("redemptions").doc();

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

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
                rewardId, title: title || "Unknown Reward", price,
                rewardType: rewardType || "digital", discountCode,
                status: "active",
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: expiresAt.toISOString(), uid,
            });

            return {
                success: true, newCoinBalance: newCoins,
                redemptionId: redemptionRef.id, discountCode,
                userName: userData.name || null, userEmail: userData.email || null,
            };
        });

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
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "An error occurred while redeeming the reward.");
    }
});

// --- SEND REWARD EMAIL ---
const sendRewardEmail = async ({ discountCode, userName, userEmail, title }) => {
    try {
        const { Resend } = require("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);

        if (!process.env.RESEND_API_KEY || !userEmail) return;

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
    } catch (err) {
        console.error("[Email] Failed to send reward email:", err.message);
    }
};


// ─────────────────────────────────────────────────────────────────
// VERIFY REWARD CODE (store staff — public HTTP)
// ─────────────────────────────────────────────────────────────────
exports.verifyRewardCode = onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const code = (req.query.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ error: "Missing 'code' query parameter." });

    try {
        const usersSnap = await db.collection("users").get();
        let redemptionData = null;

        for (const userDoc of usersSnap.docs) {
            const snap = await db.collection("users").doc(userDoc.id)
                .collection("redemptions").where("discountCode", "==", code).limit(1).get();
            if (!snap.empty) {
                redemptionData = { id: snap.docs[0].id, ...snap.docs[0].data(), uid: userDoc.id };
                break;
            }
        }

        if (!redemptionData) return res.status(404).json({ error: "Code not found." });

        const { discountCode, title, status, timestamp, expiresAt, uid } = redemptionData;

        if (expiresAt && new Date(expiresAt) < new Date()) {
            return res.json({ code: discountCode, status: "expired", error: "This code has expired." });
        }

        let userName = "Ruvo Member";
        try {
            const userSnap = await db.collection("users").doc(uid).get();
            if (userSnap.exists) userName = userSnap.data().name || userName;
        } catch (_) { /* ignore */ }

        let redeemedAt = null;
        if (timestamp) {
            const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            redeemedAt = d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
        }

        return res.json({ code: discountCode, userName, rewardTitle: title, status, redeemedAt, isValid: status === "active" });
    } catch (err) {
        console.error("[Verify] Error:", err);
        return res.status(500).json({ error: "Internal server error." });
    }
});


// ─────────────────────────────────────────────────────────────────
// MARK CODE AS USED (store staff — public HTTP)
// ─────────────────────────────────────────────────────────────────
exports.redeemRewardCode = onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    let code;
    try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        code = (body.code || "").trim().toUpperCase();
    } catch (_) { code = ""; }

    if (!code) return res.status(400).json({ error: "Missing 'code' in request body." });

    try {
        const usersSnap = await db.collection("users").get();
        let redemptionRef = null;
        let redemptionData = null;

        for (const userDoc of usersSnap.docs) {
            const snap = await db.collection("users").doc(userDoc.id)
                .collection("redemptions").where("discountCode", "==", code).limit(1).get();
            if (!snap.empty) {
                redemptionRef = snap.docs[0].ref;
                redemptionData = snap.docs[0].data();
                break;
            }
        }

        if (!redemptionRef) return res.status(404).json({ success: false, error: "Code not found." });
        if (redemptionData.status === "used") return res.json({ success: false, error: "This code has already been used.", alreadyUsed: true });
        if (redemptionData.status === "expired") return res.json({ success: false, error: "This code has expired.", expired: true });

        await redemptionRef.update({ status: "used", redeemedAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.json({ success: true, message: "Code successfully redeemed." });
    } catch (err) {
        console.error("[Redeem] Error:", err);
        return res.status(500).json({ success: false, error: "Internal server error." });
    }
});


// ─────────────────────────────────────────────────────────────────
// COACH MEMORY HELPERS
// ─────────────────────────────────────────────────────────────────
const GEMINI_URL = (key) =>
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;

async function callGemini(apiKey, requestBody) {
    const response = await fetch(GEMINI_URL(apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
    });
    return response.json();
}

async function loadMemories(uid) {
    const snap = await db.collection("users").doc(uid)
        .collection("coach_memory").orderBy("confidence", "desc").limit(25).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function formatMemoryBlock(memories) {
    if (!memories.length) return "";
    const lines = memories.map(m => {
        const pct = Math.round((m.confidence || 0.5) * 100);
        return `[${(m.type || "note").toUpperCase()}] ${m.subject}: ${m.detail} (${pct}% confidence)`;
    });
    return `\n## Persistent Memory — What I Know About This Runner\n${lines.join("\n")}\nUse these facts to personalise your response. Do not repeat them verbatim.\n`;
}

async function extractAndSaveMemories(uid, userMessage, aiResponse, existingMemories, apiKey) {
    try {
        const existingSummary = existingMemories.map(m => `${m.type}|${m.subject}`).join(", ") || "none";
        const extractionPrompt = `You are a memory extraction assistant for a running coach AI.

Given the exchange below, extract any NEW facts worth remembering about the runner.
Only extract facts that are genuinely informative (injuries, goals, patterns, preferences, achievements).
Skip anything already captured in existing memories.
Existing memories: ${existingSummary}

Exchange:
USER: ${userMessage}
AI: ${aiResponse}

Respond with a JSON array of memory objects (empty array [] if nothing new):
[{ "type": "injury|goal|pattern|preference|achievement", "subject": "short label", "detail": "one sentence", "confidence": 0.0–1.0 }]
Only output the JSON array, nothing else.`;

        const result = await callGemini(apiKey, {
            contents: [{ parts: [{ text: extractionPrompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
        });

        const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return;

        const extracted = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(extracted) || extracted.length === 0) return;

        const memRef = db.collection("users").doc(uid).collection("coach_memory");
        const batch = db.batch();
        const now = admin.firestore.FieldValue.serverTimestamp();

        for (const mem of extracted) {
            if (!mem.type || !mem.subject || !mem.detail) continue;
            const existing = existingMemories.find(
                e => e.type === mem.type && e.subject?.toLowerCase() === mem.subject?.toLowerCase()
            );
            if (existing) {
                batch.update(memRef.doc(existing.id), {
                    detail: mem.detail,
                    confidence: Math.min((existing.confidence || 0.5) + 0.1, 1.0),
                    updatedAt: now,
                });
            } else {
                batch.set(memRef.doc(), {
                    type: mem.type, subject: mem.subject, detail: mem.detail,
                    confidence: Math.max(0, Math.min(mem.confidence || 0.7, 1.0)),
                    source: "chat", createdAt: now, updatedAt: now,
                });
            }
        }
        await batch.commit();
    } catch (e) {
        console.error("Memory extraction failed:", e.message);
    }
}


// ─────────────────────────────────────────────────────────────────
// GEMINI PROXY (with persistent memory)
// ─────────────────────────────────────────────────────────────────
exports.askGemini = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to use the AI Coach.");
    }

    const { requestBody, userMessage } = request.data;
    if (!requestBody) throw new HttpsError("invalid-argument", "Missing requestBody.");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new HttpsError("internal", "AI Service Configuration Error.");

    const uid = request.auth.uid;

    try {
        const memories = await loadMemories(uid);
        const memoryBlock = formatMemoryBlock(memories);

        let enrichedBody = requestBody;
        if (memoryBlock && requestBody.contents?.[0]?.parts?.[0]?.text) {
            enrichedBody = {
                ...requestBody,
                contents: [{
                    ...requestBody.contents[0],
                    parts: [{ text: requestBody.contents[0].parts[0].text + memoryBlock }, ...requestBody.contents[0].parts.slice(1)]
                }, ...requestBody.contents.slice(1)]
            };
        }

        const result = await callGemini(apiKey, enrichedBody);

        if (result.error) {
            console.error("Gemini API Error:", result.error);
            throw new HttpsError("internal", result.error.message || "Gemini processing failed");
        }

        if (userMessage) {
            const aiResponseText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            extractAndSaveMemories(uid, userMessage, aiResponseText, memories, apiKey).catch(() => {});
        }

        return result;
    } catch (error) {
        console.error("askGemini Error:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "An error occurred connecting to the AI Coach.");
    }
});


// ─────────────────────────────────────────────────────────────────
// AI WORKOUT SUGGESTION
// ─────────────────────────────────────────────────────────────────
exports.generateWorkoutSuggestion = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");

    const uid = request.auth.uid;
    const todayKey = new Date().toISOString().split("T")[0];
    const cacheRef = db.collection("users").doc(uid).collection("aiWorkout").doc(todayKey);

    const cached = await cacheRef.get();
    if (cached.exists) return cached.data().workout;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new HttpsError("internal", "AI Service Configuration Error.");

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) throw new HttpsError("not-found", "User not found.");
    const user = userSnap.data();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const recentRuns = (user.runHistory || [])
        .filter(r => r.date && new Date(r.date) >= cutoff)
        .slice(0, 14)
        .map(r => `${r.date}: ${typeof r.distance === "number" ? r.distance.toFixed(1) : "?"}km in ${r.duration || "?"}`)
        .join("; ") || "none";

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = dayNames[new Date().getDay()];
    const planStatus = user.trainingPlan?.status || "Active";
    const activeGoal = user.trainingPlan?.activeGoal || user.goal || "General fitness";

    const prompt = `You are a professional running coach. Generate a single personalized workout for today as JSON.

User:
- Goal: ${activeGoal}
- Experience: ${user.experience || "Intermediate"}
- Plan Status: ${planStatus}
- Preferred Distance: ${user.runningPreferences?.favoriteDistance || "5k"}

Recent runs (last 14 days): ${recentRuns}

Today: ${todayName}

Rules:
- If plan is "Injured" set isRest:true and intensity:"Rest"
- If plan is "Vacation" use Low intensity, short optional run
- Avoid back-to-back hard sessions; check last 1-2 days
- Sunday = potential long run, Wednesday = intervals are fine
- Match distance to user history (don't suggest 15km if they run 3km)

Output only valid JSON, no markdown, no code fences:
{"title":"<name>","desc":"<1-2 sentences>","distance":<km as number>,"intensity":"Low"|"Medium"|"High"|"Rest","isRest":<bool>,"explanation":"<1 sentence why this workout today>"}`;

    const result = await callGemini(apiKey, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 250 },
    });

    if (result.error) throw new HttpsError("internal", "AI generation failed.");

    let workout;
    try {
        const raw = result?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        workout = JSON.parse(cleaned);
    } catch {
        throw new HttpsError("internal", "Failed to parse AI response.");
    }

    const VALID_INTENSITIES = ["Low", "Medium", "High", "Rest"];
    const normalized = {
        title: String(workout.title || "Today's Run").slice(0, 50),
        desc: String(workout.desc || "A personalized run for your fitness level.").slice(0, 200),
        distance: typeof workout.distance === "number" && workout.distance >= 0 ? workout.distance : 5,
        intensity: VALID_INTENSITIES.includes(workout.intensity) ? workout.intensity : "Medium",
        isRest: !!workout.isRest,
        explanation: String(workout.explanation || "").slice(0, 200),
        isAIGenerated: true,
    };

    await cacheRef.set({ workout: normalized, generatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return normalized;
});


// ─────────────────────────────────────────────────────────────────
// LIVE RUN SAFETY SHARING
// ─────────────────────────────────────────────────────────────────
exports.startLiveRun = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
    const uid = request.auth.uid;

    const userSnap = await db.collection("users").doc(uid).get();
    const displayName = userSnap.exists ? (userSnap.data().name || "A runner") : "A runner";

    const token = require("crypto").randomUUID();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    await db.collection("liveRuns").doc(token).set({
        uid, displayName, status: "active",
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt, lastPosition: null,
    });

    return { token, shareUrl: `${WEB_APP_URL}/live?token=${token}` };
});

exports.endLiveRun = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
    const uid = request.auth.uid;
    const { token } = request.data;

    if (!token || typeof token !== "string") {
        throw new HttpsError("invalid-argument", "Missing or invalid token.");
    }

    const runRef = db.collection("liveRuns").doc(token);
    const runSnap = await runRef.get();

    if (!runSnap.exists) throw new HttpsError("not-found", "Live run session not found.");
    if (runSnap.data().uid !== uid) throw new HttpsError("permission-denied", "Not authorized to end this session.");

    await runRef.update({
        status: "completed",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });

    return { success: true };
});


// ─────────────────────────────────────────────────────────────────
// FAILED LOGIN NOTIFICATION
// ─────────────────────────────────────────────────────────────────
exports.notifyLoginFailure = onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
    const { email } = request.data;
    if (!email || typeof email !== "string" || !email.includes("@")) return { sent: false };

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { sent: false };

    try {
        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(email);
        } catch {
            return { sent: false };
        }

        const now = new Date().toLocaleString("en-US", {
            timeZone: "Asia/Beirut", dateStyle: "medium", timeStyle: "short",
        });

        const { Resend } = require("resend");
        const resend = new Resend(apiKey);

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

        await db.collection("users").doc(userRecord.uid).collection("auditLog").add({
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


// ─────────────────────────────────────────────────────────────────
// ADMIN: DISABLE MFA
// ─────────────────────────────────────────────────────────────────
exports.disableMfaForUser = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated.");
    if (!request.auth.token.admin) throw new HttpsError("permission-denied", "Admin access required.");

    const { targetUid } = request.data;
    if (!targetUid || typeof targetUid !== "string") {
        throw new HttpsError("invalid-argument", "targetUid is required.");
    }

    try {
        await admin.auth().updateUser(targetUid, { multiFactor: { enrolledFactors: [] } });
        await db.collection("users").doc(targetUid).collection("auditLog").add({
            action: "ADMIN_MFA_DISABLED",
            performedBy: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            reason: request.data.reason || "Account recovery - lost phone",
        });
        return { success: true, message: `MFA has been removed for user ${targetUid}.` };
    } catch (error) {
        console.error("disableMfaForUser Error:", error);
        throw new HttpsError("internal", error.message);
    }
});


// ─────────────────────────────────────────────────────────────────
// ACCOUNT DELETION (GDPR)
// ─────────────────────────────────────────────────────────────────
exports.deleteAccountData = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in to delete your account.");
    const uid = request.auth.uid;

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
        await Promise.all([
            deleteSubcollection(userRef, "redemptions"),
            deleteSubcollection(userRef, "notifications"),
            deleteSubcollection(userRef, "auditLog"),
            deleteSubcollection(userRef, "saved_routes"),
            deleteSubcollection(userRef, "runs"),
        ]);

        const postsSnap = await db.collection("posts").where("userId", "==", uid).get();
        if (!postsSnap.empty) {
            const chunks = [];
            for (let i = 0; i < postsSnap.docs.length; i += 500) chunks.push(postsSnap.docs.slice(i, i + 500));
            for (const chunk of chunks) {
                const batch = db.batch();
                chunk.forEach(d => batch.update(d.ref, {
                    userId: "deleted", userName: "[deleted]", userAvatar: null,
                    text: "[This post has been removed]",
                }));
                await batch.commit();
            }
        }

        await userRef.delete();

        try {
            await admin.storage().bucket().deleteFiles({ prefix: `avatars/${uid}` });
        } catch (storageError) {
            console.warn(`Storage cleanup skipped for ${uid}:`, storageError.message);
        }

        await admin.auth().deleteUser(uid);
        return { success: true, message: "Account successfully deleted." };
    } catch (error) {
        console.error("deleteAccountData Error:", error);
        throw new HttpsError("internal", "Failed to permanently delete account data.");
    }
});


// ─────────────────────────────────────────────────────────────────
// GDPR DATA EXPORT
// ─────────────────────────────────────────────────────────────────
exports.exportUserData = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in to export your data.");
    const uid = request.auth.uid;

    try {
        const userSnap = await db.collection("users").doc(uid).get();
        if (!userSnap.exists) throw new HttpsError("not-found", "User data not found.");

        const userData = userSnap.data();
        const redemptionsSnap = await db.collection("users").doc(uid).collection("redemptions").get();
        const redemptions = redemptionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Also export subcollection runs (full history)
        const runsSnap = await db.collection("users").doc(uid).collection("runs").orderBy("date", "desc").limit(500).get();
        const runs = runsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const { fcmToken, ...exportableProfile } = userData;
        return { exportedAt: new Date().toISOString(), profile: exportableProfile, redemptions, runs };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error("exportUserData Error:", error);
        throw new HttpsError("internal", "Failed to export user data.");
    }
});


// ─────────────────────────────────────────────────────────────────
// SAVE RUN ACTIVITY
// Writes to users/{uid}/runs/{id} subcollection (primary storage)
// and maintains a capped array of last 100 runs on the user doc
// for quick reads by screens — preventing the 1MB Firestore limit.
// ─────────────────────────────────────────────────────────────────
exports.saveRunActivity = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in to save runs.");
    const uid = request.auth.uid;

    const { runEntry, calculatedUpdates = {} } = request.data;
    if (!runEntry || typeof runEntry.distance !== "number") {
        throw new HttpsError("invalid-argument", "Missing or invalid runEntry data.");
    }

    const distance = runEntry.distance;
    let durationMinutes = 0;
    if (runEntry.duration) {
        const parts = String(runEntry.duration).split(":").map(Number);
        if (parts.length === 2) durationMinutes = parts[0] + parts[1] / 60;
        else if (parts.length === 3) durationMinutes = parts[0] * 60 + parts[1] + parts[2] / 60;
    }

    // --- SANITY CHECKS ---
    if (distance <= 0) throw new HttpsError("invalid-argument", "Run distance must be greater than 0.");
    if (distance > 100) throw new HttpsError("invalid-argument", "Run distance exceeds maximum allowed (100km).");
    if (durationMinutes > 720) throw new HttpsError("invalid-argument", "Run duration exceeds maximum allowed (720 minutes).");
    if (durationMinutes > 0) {
        const avgSpeedKmh = distance / (durationMinutes / 60);
        if (avgSpeedKmh > 25) {
            throw new HttpsError("invalid-argument", `Average speed of ${avgSpeedKmh.toFixed(1)} km/h is not possible for a run.`);
        }
    }

    // --- READ USER DOCUMENT ONCE ---
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() || {};

    // Daily coin cap check
    const todayKey = new Date().toISOString().split("T")[0];
    const MAX_DAILY_COINS = 500;
    const dailyEarnings = userData.dailyEarnings || {};
    if ((dailyEarnings[todayKey] || 0) >= MAX_DAILY_COINS) {
        throw new HttpsError("resource-exhausted", "Daily coin limit reached. Come back tomorrow!");
    }

    // --- ROUTE INTEGRITY VALIDATION ---
    const routePath = runEntry.routePath;
    if (routePath && Array.isArray(routePath) && routePath.length >= 2) {
        const MAX_SEGMENT_SPEED_MS = 25 / 3.6;
        const toRad = (deg) => deg * Math.PI / 180;
        const haversineKm = (lat1, lon1, lat2, lon2) => {
            const R = 6371;
            const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        let routeDerivedKm = 0, suspiciousSegments = 0;
        for (let i = 1; i < routePath.length; i++) {
            const prev = routePath[i - 1], curr = routePath[i];
            if (!prev.latitude || !curr.latitude) continue;
            const segmentKm = haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
            if (prev.timestamp && curr.timestamp) {
                const timeDiffSec = (curr.timestamp - prev.timestamp) / 1000;
                if (timeDiffSec > 0 && (segmentKm * 1000) / timeDiffSec > MAX_SEGMENT_SPEED_MS) {
                    suspiciousSegments++;
                    continue;
                }
            }
            routeDerivedKm += segmentKm;
        }

        if (suspiciousSegments / (routePath.length - 1) > 0.3) {
            throw new HttpsError("invalid-argument", "Run data contains invalid GPS segments and could not be saved.");
        }
        if (routeDerivedKm > 0.1 && distance > routeDerivedKm * 1.2) {
            runEntry.distance = parseFloat(routeDerivedKm.toFixed(4));
        }
    }

    // --- COIN CALCULATION ---
    const BASE_RATE_PER_KM = 10;
    let earnedCoins = runEntry.distance * BASE_RATE_PER_KM;
    let breakdown = { base: Math.floor(earnedCoins), paceBonus: 0, streakBonus: 0, timeBonus: 0 };

    const paceMinPerKm = durationMinutes > 0 && runEntry.distance > 0 ? durationMinutes / runEntry.distance : 0;
    if (paceMinPerKm > 0 && paceMinPerKm <= 10) {
        let paceMultiplier = 0;
        if (paceMinPerKm < 5) paceMultiplier = 0.20;
        else if (paceMinPerKm < 6) paceMultiplier = 0.15;
        else if (paceMinPerKm < 7) paceMultiplier = 0.10;
        else if (paceMinPerKm < 8) paceMultiplier = 0.05;
        const paceBonus = Math.floor(earnedCoins * paceMultiplier);
        earnedCoins += paceBonus;
        breakdown.paceBonus = paceBonus;
    }

    // Streak bonus (+5% for 7+ day streaks) — computed from user doc read above
    try {
        const runHistory = userData.runHistory || [];
        if (runHistory.length > 0) {
            const uniqueDates = [...new Set(
                runHistory.flatMap(r => r.date ? [new Date(r.date).toDateString()] : [])
            )].sort((a, b) => new Date(b) - new Date(a));

            let streak = 0;
            const today = new Date().toDateString();
            const yesterday = new Date(Date.now() - 86400000).toDateString();

            if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
                streak = 1;
                for (let i = 0; i < uniqueDates.length - 1; i++) {
                    const diffDays = (new Date(uniqueDates[i]) - new Date(uniqueDates[i + 1])) / 86400000;
                    if (diffDays === 1) streak++;
                    else break;
                }
            }

            if (streak >= 7) {
                const streakBonus = Math.floor(earnedCoins * 0.05);
                earnedCoins += streakBonus;
                breakdown.streakBonus = streakBonus;
            }
        }
    } catch (err) {
        console.warn("Streak calculation error:", err);
    }

    // Time-of-day bonus
    const hour = new Date().getHours();
    let timeMultiplier = 0;
    if ((hour >= 6 && hour <= 8) || (hour >= 11 && hour <= 13) || (hour >= 14 && hour <= 17)) {
        timeMultiplier = 0.10;
    } else if (hour >= 18 && hour <= 21) {
        timeMultiplier = -0.10;
    }
    if (timeMultiplier !== 0) {
        const timeBonus = Math.floor(earnedCoins * timeMultiplier);
        earnedCoins += timeBonus;
        breakdown.timeBonus = timeBonus;
    }

    const earnedXp = Math.floor((runEntry.distance * 100) + (durationMinutes * 2));
    earnedCoins = Math.max(0, Math.floor(earnedCoins));

    // --- LEVEL-UP ---
    const getXpToNextLevel = (lvl) => Math.floor(1000 * Math.pow(1.15, lvl - 1));
    let levelsGained = 0;
    let newLevel = userData.level || 1;
    let newCurrentXP = (userData.currentXP || 0) + earnedXp;
    let newXpToNextLevel = userData.xpToNextLevel || getXpToNextLevel(newLevel);

    while (newCurrentXP >= newXpToNextLevel) {
        newCurrentXP -= newXpToNextLevel;
        newLevel++;
        levelsGained++;
        newXpToNextLevel = getXpToNextLevel(newLevel);
    }

    // --- WRITE ---
    // Strip GPS arrays — the slim entry goes into both runHistory cap and subcollection
    const { routePath: _rp, kmSplits, initialRegion, ...slimEntry } = runEntry;

    const userRef = db.collection("users").doc(uid);

    // 1. Write full run to subcollection (permanent, unbounded)
    const runId = slimEntry.id || Date.now().toString();
    await userRef.collection("runs").doc(runId).set(slimEntry);

    // 2. Build capped runHistory: prepend new run, keep last 100
    const currentHistory = userData.runHistory || [];
    const cappedHistory = [slimEntry, ...currentHistory].slice(0, 100);

    const safeUpdates = {};
    if (calculatedUpdates.gearList) safeUpdates.gearList = calculatedUpdates.gearList;
    if (typeof calculatedUpdates.totalKm === "number") safeUpdates.totalKm = calculatedUpdates.totalKm;
    if (typeof calculatedUpdates.earningUnlockProgress === "number")
        safeUpdates.earningUnlockProgress = calculatedUpdates.earningUnlockProgress;

    try {
        await userRef.update({
            runHistory: cappedHistory,
            totalRuns: admin.firestore.FieldValue.increment(1),
            weeklyDistance: admin.firestore.FieldValue.increment(runEntry.distance),
            currentXP: newCurrentXP,
            level: newLevel,
            xpToNextLevel: newXpToNextLevel,
            coins: admin.firestore.FieldValue.increment(earnedCoins),
            [`dailyEarnings.${todayKey}`]: admin.firestore.FieldValue.increment(earnedCoins),
            ...safeUpdates,
        });

        return { success: true, earnedXp, earnedCoins, coinBreakdown: breakdown, levelsGained, newLevel };
    } catch (error) {
        console.error("saveRunActivity Error:", error);
        throw new HttpsError("internal", "Could not save run activity securely.");
    }
});


// ─────────────────────────────────────────────────────────────────
// WHOOP INTEGRATION
// ─────────────────────────────────────────────────────────────────
exports.syncWhoopData = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in to sync Whoop data.");
    const uid = request.auth.uid;
    const { accessToken } = request.data;
    if (!accessToken) throw new HttpsError("invalid-argument", "Missing Whoop access token.");

    try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const [recoveryRes, cycleRes, sleepRes, hrRes] = await Promise.all([
            fetch("https://api.prod.whoop.com/developer/v1/recovery", { headers }),
            fetch("https://api.prod.whoop.com/developer/v1/cycle", { headers }),
            fetch("https://api.prod.whoop.com/developer/v1/sleep", { headers }),
            fetch("https://api.prod.whoop.com/developer/v1/user/measurement/heart_rate", { headers }).catch(() => null),
        ]);

        if (!recoveryRes.ok) throw new Error("Whoop API /recovery failed");

        const [recoveryData, cycleData, sleepData] = await Promise.all([
            recoveryRes.json(), cycleRes.json(), sleepRes.json(),
        ]);
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
        throw new HttpsError("internal", "Failed to sync Whoop data.");
    }
});


// ─────────────────────────────────────────────────────────────────
// OURA INTEGRATION
// ─────────────────────────────────────────────────────────────────
exports.syncOuraData = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in to sync Oura data.");
    const uid = request.auth.uid;
    const { accessToken } = request.data;
    if (!accessToken) throw new HttpsError("invalid-argument", "Missing Oura access token.");

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
        throw new HttpsError("internal", "Failed to sync Oura data.");
    }
});


// ─────────────────────────────────────────────────────────────────
// CUSTOM PASSWORD RESET EMAIL
// ─────────────────────────────────────────────────────────────────
exports.sendPasswordResetLink = onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
    const { email } = request.data;
    if (!email || typeof email !== "string" || !email.includes("@")) {
        throw new HttpsError("invalid-argument", "A valid email address is required.");
    }

    const normalizedEmail = email.toLowerCase().trim();

    let resetLink;
    try {
        resetLink = await admin.auth().generatePasswordResetLink(normalizedEmail, {
            url: "https://ruvo.run", handleCodeInApp: false,
        });
    } catch (err) {
        if (err.code === "auth/user-not-found") return { success: true };
        console.error("generatePasswordResetLink error:", err);
        throw new HttpsError("internal", "Could not generate reset link.");
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const year = new Date().getFullYear();

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#111;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#000;padding:32px 40px;text-align:center;border-bottom:1px solid #222;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#ccff00;letter-spacing:4px;">RUVO</p>
          <p style="margin:6px 0 0;font-size:12px;color:#555;letter-spacing:1px;text-transform:uppercase;">AI Running Coach</p>
        </td></tr>
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
            This link expires in <strong style="color:#aaa;">1 hour</strong>. If you did not request a password reset, you can safely ignore this email.
          </p>
        </td></tr>
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
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendApiKey}` },
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
            throw new HttpsError("internal", "Failed to send reset email.");
        }

        return { success: true };
    } catch (err) {
        if (err instanceof HttpsError) throw err;
        console.error("sendPasswordResetLink error:", err);
        throw new HttpsError("internal", "Failed to send reset email.");
    }
});


// ─────────────────────────────────────────────────────────────────
// DREAM CYCLE (weekly memory refinement — every Monday 03:00 UTC)
// ─────────────────────────────────────────────────────────────────
exports.dreamCycle = onSchedule({
    schedule: "every monday 03:00",
    timeZone: "UTC",
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 540,
    memory: "512MiB",
}, async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { console.error("dreamCycle: missing GEMINI_API_KEY"); return; }

    const now = new Date();
    const weekKey = `${now.getFullYear()}-W${String(getISOWeek(now)).padStart(2, "0")}`;
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const usersSnap = await db.collection("users").limit(200).get();
    console.log(`dreamCycle: processing ${usersSnap.size} users for week ${weekKey}`);

    await Promise.allSettled(usersSnap.docs.map(async (userDoc) => {
        try {
            const uid = userDoc.id;
            const userData = userDoc.data();
            const runHistory = userData.runHistory || [];

            const recentRuns = runHistory.filter(r => r.date && new Date(r.date) >= sevenDaysAgo);
            if (recentRuns.length === 0) return;

            const memoriesSnap = await db.collection("users").doc(uid).collection("coach_memory").get();

            const staleMemories = memoriesSnap.docs.filter(d => {
                const updated = d.data().updatedAt?.toDate?.() || new Date(0);
                return updated < thirtyDaysAgo;
            });

            const decayBatch = db.batch();
            for (const memDoc of staleMemories) {
                const current = memDoc.data().confidence || 0.5;
                decayBatch.update(memDoc.ref, { confidence: Math.max(0.1, current - 0.15) });
            }
            if (staleMemories.length > 0) await decayBatch.commit();

            const runSummary = recentRuns
                .map(r => `${new Date(r.date).toDateString()}: ${r.distance?.toFixed(1) || "?"}km in ${r.duration || "?"}min, pace ${r.pace || "?"}`)
                .join("\n");

            const allTimeKm = runHistory.reduce((s, r) => s + (parseFloat(r.distance) || 0), 0);
            const existing = memoriesSnap.docs.map(d => `${d.data().type}: ${d.data().subject} — ${d.data().detail}`).join("\n") || "None";

            const insightPrompt = `You are an elite running coach. Analyse this runner's week and provide one concise, motivating insight paragraph (max 60 words). Be specific — reference their actual data.

Runner: ${userData.name || "Runner"}, Level ${userData.level || 1}, ${allTimeKm.toFixed(0)}km lifetime
Goal: ${userData.trainingPlan?.activeGoal || userData.goal || "general fitness"}
Weekly runs:\n${runSummary}
Known facts:\n${existing}

Write only the insight paragraph. No headers, no lists.`;

            const geminiResult = await callGemini(apiKey, {
                contents: [{ parts: [{ text: insightPrompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 150 }
            });

            const insightText = geminiResult?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!insightText) return;

            await db.collection("users").doc(uid).collection("coach_insights").doc(weekKey).set({
                weekKey, text: insightText,
                runsThisWeek: recentRuns.length,
                kmThisWeek: recentRuns.reduce((s, r) => s + (parseFloat(r.distance) || 0), 0),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            const patternPrompt = `Given these running sessions, identify one specific training pattern worth remembering (e.g. consistent pace drop, strong morning performance, recovery issues). Be concise.

${runSummary}

Respond with JSON only: { "subject": "short label", "detail": "one sentence", "confidence": 0.6–0.9 }
If no clear pattern exists, return: {}`;

            const patternResult = await callGemini(apiKey, {
                contents: [{ parts: [{ text: patternPrompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 100 }
            });

            const patternRaw = patternResult?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            const patternJson = patternRaw.match(/\{[\s\S]*\}/)?.[0];
            if (patternJson) {
                const pattern = JSON.parse(patternJson);
                if (pattern.subject && pattern.detail) {
                    const memRef = db.collection("users").doc(uid).collection("coach_memory");
                    const existingMem = memoriesSnap.docs.find(
                        d => d.data().type === "pattern" && d.data().subject?.toLowerCase() === pattern.subject.toLowerCase()
                    );
                    const ts = admin.firestore.FieldValue.serverTimestamp();
                    if (existingMem) {
                        await existingMem.ref.update({ detail: pattern.detail, updatedAt: ts });
                    } else {
                        await memRef.add({ type: "pattern", subject: pattern.subject, detail: pattern.detail, confidence: pattern.confidence || 0.7, source: "dream_cycle", createdAt: ts, updatedAt: ts });
                    }
                }
            }
        } catch (e) {
            console.error(`dreamCycle: failed for user ${userDoc.id}:`, e.message);
        }
    }));

    console.log(`dreamCycle: completed week ${weekKey}`);
});


// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}
