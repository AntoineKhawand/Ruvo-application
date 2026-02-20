/**
 * Unit Tests for aiService.js
 *
 * Tests:
 * - sendMessageToAI happy path (mocked fetch)
 * - Function call / tool execution handling
 * - Fallback to mock AI when API key is missing
 * - Error handling and graceful degradation
 * - System prompt construction with user context
 */

// --- MOCK FIREBASE ---
jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    updateDoc: jest.fn().mockResolvedValue(undefined),
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
}));

jest.mock('../../config/firebase', () => ({
    db: {},
}));

// --- MOCK FETCH ---
global.fetch = jest.fn();

// --- IMPORT ---
const { sendMessageToAI } = require('../aiService');

// --- HELPERS ---
const mockUserData = {
    uid: 'user123',
    name: 'Antoine',
    goal: '10k',
    experience: 'Intermediate',
    weight: 75,
    runFrequency: 4,
    weeklyDistance: 25,
    weeklyGoal: 40,
    trainingPlan: { status: 'Active', activeGoal: '10k' },
    runHistory: [
        { distance: 5.2, duration: '28:00', pace: '5:23' },
        { distance: 8.0, duration: '44:00', pace: '5:30' },
    ],
};

const makeGeminiResponse = (text) => ({
    ok: true,
    json: () =>
        Promise.resolve({
            candidates: [
                {
                    content: {
                        parts: [{ text }],
                    },
                },
            ],
        }),
});

const makeFunctionCallResponse = (functionName, args) => ({
    ok: true,
    json: () =>
        Promise.resolve({
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                functionCall: {
                                    name: functionName,
                                    args,
                                },
                            },
                        ],
                    },
                },
            ],
        }),
});

describe('aiService - sendMessageToAI', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return an object with text and actionTaken properties', async () => {
        fetch.mockResolvedValueOnce(makeGeminiResponse('Great run!'));

        const result = await sendMessageToAI('How was my run?', mockUserData);
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('actionTaken');
    });

    it('should return AI text response on success', async () => {
        fetch.mockResolvedValueOnce(makeGeminiResponse('Your pace is improving! 🏃'));

        const result = await sendMessageToAI('Analyze my pace', mockUserData);
        expect(result.text).toBe('Your pace is improving! 🏃');
        expect(result.actionTaken).toBe(false);
    });

    it('should include user context in the API request body', async () => {
        fetch.mockResolvedValueOnce(makeGeminiResponse('OK'));

        await sendMessageToAI('Hello', mockUserData);

        const fetchCall = fetch.mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);

        // Verify the request contains user name in the system context
        expect(body.contents[0].parts[0].text).toContain('Antoine');
        expect(body.contents[0].parts[0].text).toContain('10k');
    });

    it('should include recent run history in the prompt', async () => {
        fetch.mockResolvedValueOnce(makeGeminiResponse('OK'));

        await sendMessageToAI('How am I doing?', mockUserData);

        const body = JSON.parse(fetch.mock.calls[0][1].body);
        expect(body.contents[0].parts[0].text).toContain('5.2km');
        expect(body.contents[0].parts[0].text).toContain('8.0km');
    });

    it('should handle function call responses (set_injury_mode)', async () => {
        fetch.mockResolvedValueOnce(
            makeFunctionCallResponse('set_injury_mode', { is_injured: true, pain_level: 'High' })
        );

        const result = await sendMessageToAI('I hurt my knee', mockUserData);
        expect(result.actionTaken).toBe(true);
        expect(result.text).toContain('Recovery Mode');
    });

    it('should handle function call responses (change_plan_focus)', async () => {
        fetch.mockResolvedValueOnce(
            makeFunctionCallResponse('change_plan_focus', { new_goal: 'Marathon' })
        );

        const result = await sendMessageToAI('I want to train for a marathon', mockUserData);
        expect(result.actionTaken).toBe(true);
        expect(result.text).toContain('Marathon');
    });

    it('should fall back gracefully on API error', async () => {
        fetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await sendMessageToAI('Hello', mockUserData);
        expect(result.text).toContain('trouble connecting');
        expect(result.actionTaken).toBe(false);
    });

    it('should handle API error responses (non-200)', async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            json: () => Promise.resolve({ error: { message: 'Quota exceeded' } }),
        });

        const result = await sendMessageToAI('Hello', mockUserData);
        // Should fall back to mock
        expect(result.text).toBeDefined();
        expect(result.actionTaken).toBe(false);
    });

    it('should handle empty user data gracefully', async () => {
        fetch.mockResolvedValueOnce(makeGeminiResponse('Hello runner!'));

        const result = await sendMessageToAI('Hello', {});
        expect(result.text).toBe('Hello runner!');
    });

    it('should handle missing run history', async () => {
        fetch.mockResolvedValueOnce(makeGeminiResponse('Let me help!'));

        const userWithNoHistory = { ...mockUserData, runHistory: undefined };
        const result = await sendMessageToAI('Help me', userWithNoHistory);
        expect(result.text).toBe('Let me help!');
    });

    it('should include tool definitions in the request', async () => {
        fetch.mockResolvedValueOnce(makeGeminiResponse('OK'));

        await sendMessageToAI('Hello', mockUserData);

        const body = JSON.parse(fetch.mock.calls[0][1].body);
        expect(body.tools).toBeDefined();
        expect(body.tools[0].function_declarations).toHaveLength(2);
        expect(body.tools[0].function_declarations[0].name).toBe('set_injury_mode');
        expect(body.tools[0].function_declarations[1].name).toBe('change_plan_focus');
    });
});
