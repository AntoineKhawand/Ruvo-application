import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';

// --- CONFIGURATION ---
// ⚠️ SECURITY WARNING: In a production app, never store API keys in plain text.
// We are migrating to Cloud Functions for security.
const AI_CONFIG = {
    provider: "gemini",
    model: "gemini-2.5-flash"
};

// --- TOOL DEFINITIONS ---
const AI_TOOLS = [
    {
        name: "set_injury_mode",
        description: "Switches the user's training plan to 'Recovery Mode' if they report an injury or pain. Only use if the user explicitly mentions pain, injury, or needing recovery.",
        parameters: {
            type: "object",
            properties: {
                is_injured: { type: "boolean", description: "True to enable injury mode, False to disable." },
                pain_level: { type: "string", description: "Optional description of pain (Low, Medium, High)." }
            },
            required: ["is_injured"]
        }
    },
    {
        name: "change_plan_focus",
        description: "Updates the user's primary training goal (e.g., 5k, 10k, Marathon). Use this if the user wants to change their target distance or race.",
        parameters: {
            type: "object",
            properties: {
                new_goal: { type: "string", enum: ["5k", "10k", "Half Marathon", "Marathon"], description: "The new target distance." }
            },
            required: ["new_goal"]
        }
    }
];

/**
 * Sends a message to the AI and gets a response.
 * @param {string} userMessage - The user's input text.
 * @param {object} userData - Context about the user (e.g., recent runs).
 * @returns {Promise<object>} - { text: string, actionTaken: boolean }
 */
export const sendMessageToAI = async (userMessage, userData) => {
    // 1. Send via Secure Cloud Function
    try {
        return await callRealAI(userMessage, userData);
    } catch (error) {
        console.error("AI API Error:", error);
        return { text: "I'm having trouble connecting to the cloud. I can only track your runs right now.", actionTaken: false };
    }
};

// --- MOCK LOGIC (Fallback) ---
const simulateMockAI = (userQuery) => {
    const lowerQuery = userQuery.toLowerCase();
    if (lowerQuery.includes('knee') || lowerQuery.includes('pain')) {
        return "I'm sorry to hear that. 🛑 (Mock) I would normally switch you to Recovery Mode now.";
    }
    return "I'm offline right now. I can still track your runs, but I can't update your plan without internet.";
};

// --- REAL AI CALL (Gemini Implementation) ---
const callRealAI = async (text, userData) => {
    console.log("🧠 Calling Gemini AI (Agent Mode)...");

    const recentRuns = userData?.runHistory?.slice(0, 5) || [];
    const recentSummary = recentRuns.length > 0
        ? recentRuns.map(r => `${r.distance?.toFixed(1) || '?'}km in ${r.duration || '?'} (pace: ${r.pace || '?'})`).join('; ')
        : 'No recent runs';

    const systemContext = `You are **Ruvo Coach**, an elite personalized running coach inside the Ruvo app.

## User Profile
- **Name:** ${userData?.name || 'Runner'}
- **Goal:** ${userData?.goal || 'General fitness'}
- **Experience:** ${userData?.experience || 'Unknown'}
- **Weight:** ${userData?.weight || '?'}kg
- **Run Frequency:** ${userData?.runFrequency || '?'} days/week
- **Plan Status:** ${userData?.trainingPlan?.status || 'Active'}
- **Active Goal:** ${userData?.trainingPlan?.activeGoal || userData?.goal || 'Not set'}
- **Weekly Distance:** ${userData?.weeklyDistance?.toFixed(1) || '0'}km / ${userData?.weeklyGoal || '?'}km goal

## Recent Runs
${recentSummary}

## Response Rules
1. Format ALL responses in **markdown** — use bold, bullet lists, numbered lists, and headers.
2. Be encouraging, data-driven, and concise. Keep responses under 200 words.
3. Use emojis sparingly for warmth (🏃 💪 🎯 ✅).
4. When giving workout plans, use structured lists with clear labels.
5. Reference the user's actual data when possible.
6. You can DIRECTLY update the user's plan using tools. DO NOT just say you will do it — use the tool!`;

    // 1. CONSTRUCT REQUEST WITH TOOLS
    const requestBody = {
        contents: [{
            parts: [{ text: `${systemContext}\n\nUser: ${text}` }]
        }],
        tools: [{ function_declarations: AI_TOOLS }]
    };

    // 2. Secure Execution via Cloud Functions
    const askGemini = httpsCallable(functions, 'askGemini');
    const response = await askGemini({ requestBody });
    const data = response.data;

    const candidate = data?.candidates?.[0];
    const firstPart = candidate?.content?.parts?.[0];

    // 2. CHECK FOR FUNCTION CALL
    if (firstPart?.functionCall) {
        console.log("🛠️ AI TRIGGERED TOOL:", firstPart.functionCall.name);
        const toolResult = await executeTool(firstPart.functionCall, userData.uid);

        // Optional: Send tool result back to AI to get a final natural language response.
        // For simpler UX, we can just return a confirmation message.
        return {
            text: toolResult.message || "Done! I've updated your plan.",
            actionTaken: true
        };
    }

    // 3. NORMAL TEXT RESPONSE
    return {
        text: firstPart?.text || "I'm not sure what to say.",
        actionTaken: false
    };
};

// --- EXECUTE TOOLS ---
const executeTool = async (functionCall, userId) => {
    const { name, args } = functionCall;
    const userRef = doc(db, "users", userId);

    try {
        if (name === "set_injury_mode") {
            const isInjured = args.is_injured;
            await updateDoc(userRef, {
                "trainingPlan.status": isInjured ? "Injured" : "Active",
                "trainingPlan.lastUpdated": serverTimestamp()
            });
            return { message: isInjured ? "🚨 I've switched your plan to Recovery Mode. Focus on healing!" : "✅ Glad you're back! Plan set to Active." };
        }

        if (name === "change_plan_focus") {
            const newGoal = args.new_goal;
            await updateDoc(userRef, {
                "userData.weeklyGoal": newGoal === 'Marathon' ? 42 : (newGoal === 'Half Marathon' ? 21 : 10), // Simple heuristic
                "trainingPlan.status": "Active", // Reset status
                "trainingPlan.activeGoal": newGoal
            });
            return { message: `🎯 Plan updated! Let's train for that ${newGoal}.` };
        }

    } catch (e) {
        console.error("Tool Execution Error:", e);
        return { message: "I tried to update your plan, but something went wrong." };
    }

    return { message: "Action completed." };
};
