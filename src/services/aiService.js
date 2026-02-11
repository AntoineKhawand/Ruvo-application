// --- CONFIGURATION ---
// ⚠️ SECURITY WARNING: In a production app, never store API keys in plain text.
// Use react-native-dotenv or a backend proxy.
const AI_CONFIG = {
    apiKey: "AIzaSyD5JK5StdbG4cXk9C78mkHlXu8DfCmnaRY",
    provider: "gemini",
    model: "gemini-2.5-flash"
};

/**
 * Sends a message to the AI and gets a response.
 * @param {string} userMessage - The user's input text.
 * @param {object} userData - Context about the user (e.g., recent runs).
 * @returns {Promise<string>} - The AI's response text.
 */
export const sendMessageToAI = async (userMessage, userData) => {
    // 1. Check for API Key
    if (AI_CONFIG.apiKey) {
        try {
            return await callRealAI(userMessage, userData);
        } catch (error) {
            console.error("AI API Error:", error);
            // Fallback to mock if API fails, but keep the error visible in console
            return "I'm having trouble connecting to the cloud. Switching to offline mode... " + simulateMockAI(userMessage, userData);
        }
    } else {
        // 2. Fallback to Mock
        console.log("Using Mock AI (No API Key provided)");
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(simulateMockAI(userMessage, userData));
            }, 1000);
        });
    }
};

// --- MOCK LOGIC (Fallback) ---
const simulateMockAI = (userQuery, userData) => {
    const lowerQuery = userQuery.toLowerCase();
    if (!userQuery) return "Ready to run? Ask me about your schedule!";
    if (lowerQuery.includes('knee') || lowerQuery.includes('pain')) {
        return "I'm sorry to hear that. 🛑 Let's prioritize recovery. I recommend switching tomorrow's run to a low-impact activity like Swimming or Yoga.";
    }
    return "I'm offline right now. I can still track your runs, but my brain needs an internet connection!";
};

// --- REAL AI CALL (Gemini Implementation) ---
const callRealAI = async (text, userData) => {
    console.log("🧠 Calling Gemini AI...");

    // Construct System Prompt / Context
    const systemContext = `You are "Ruvo Coach", an elite personalized running coach.
    User Context:
    - Name: ${userData?.name || 'Runner'}
    - Total Runs: ${userData?.runHistory?.length || 0}
    - Recent Distances: ${userData?.runHistory?.slice(0, 3).map(r => r.distance + 'km').join(', ') || 'None'}

    Style: Encouraging, data-driven, concise. Use emojis occasionally.`;

    // Using gemini-2.5-flash on v1beta based on user diagnostics
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${AI_CONFIG.apiKey}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `${systemContext}\n\nUser: ${text}`
                }]
            }]
        })
    });



    const data = await response.json();

    if (data.error) {
        console.error("Gemini API Error:", JSON.stringify(data.error, null, 2));

        // --- DIAGNOSTIC: Check available models if not found ---
        if (data.error.code === 404 || data.error.message.includes("not found")) {
            console.log("🕵️ Inspecting available models for this key...");
            try {
                const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${AI_CONFIG.apiKey}`);
                const listData = await listResp.json();
                console.log("📜 AVAILABLE MODELS:", JSON.stringify(listData, null, 2));

                // Smart Auto-Fix (Optional: could retry with first available model)
                if (listData.models) {
                    const validModel = listData.models.find(m => m.supportedGenerationMethods?.includes("generateContent"));
                    if (validModel) console.log(`👉 SUGGESTION: Try using model '${validModel.name.replace('models/', '')}'`);
                }
            } catch (e) {
                console.error("Diagnostic check failed:", e);
            }
        }

        throw new Error(data.error.message || "Unknown Gemini API Error");
    }

    // Extract text from Gemini response structure
    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
        throw new Error("No response from Gemini");
    }

    return aiText;
};
