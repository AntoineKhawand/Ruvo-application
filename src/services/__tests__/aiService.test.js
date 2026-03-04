/**
 * Unit Tests for aiService.js
 *
 * Tests:
 * - sendMessageToAI happy path (mocked httpsCallable)
 * - Function call / tool execution handling
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
    functions: {},
}));

// Track the mock callable so tests can control its return value
const mockCallable = jest.fn();

jest.mock('firebase/functions', () => ({
    httpsCallable: jest.fn(() => mockCallable),
}));

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
    data: {
        candidates: [
            {
                content: {
                    parts: [{ text }],
                },
            },
        ],
    },
});

const makeFunctionCallResponse = (functionName, args) => ({
    data: {
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
    },
});

describe('aiService - sendMessageToAI', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return an object with text and actionTaken properties', async () => {
        mockCallable.mockResolvedValueOnce(makeGeminiResponse('Great run!'));

        const result = await sendMessageToAI('How was my run?', mockUserData);
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('actionTaken');
    });

    it('should return AI text response on success', async () => {
        mockCallable.mockResolvedValueOnce(makeGeminiResponse('Your pace is improving! 🏃'));

        const result = await sendMessageToAI('Analyze my pace', mockUserData);
        expect(result.text).toBe('Your pace is improving! 🏃');
        expect(result.actionTaken).toBe(false);
    });

    it('should include user context in the httpsCallable request body', async () => {
        mockCallable.mockResolvedValueOnce(makeGeminiResponse('OK'));

        await sendMessageToAI('Hello', mockUserData);

        const callArgs = mockCallable.mock.calls[0][0];
        const bodyText = callArgs.requestBody.contents[0].parts[0].text;

        // Verify the request contains user name in the system context
        expect(bodyText).toContain('Antoine');
        expect(bodyText).toContain('10k');
    });

    it('should include recent run history in the prompt', async () => {
        mockCallable.mockResolvedValueOnce(makeGeminiResponse('OK'));

        await sendMessageToAI('How am I doing?', mockUserData);

        const callArgs = mockCallable.mock.calls[0][0];
        const bodyText = callArgs.requestBody.contents[0].parts[0].text;
        expect(bodyText).toContain('5.2km');
        expect(bodyText).toContain('8.0km');
    });

    it('should handle function call responses (set_injury_mode)', async () => {
        mockCallable.mockResolvedValueOnce(
            makeFunctionCallResponse('set_injury_mode', { is_injured: true, pain_level: 'High' })
        );

        const result = await sendMessageToAI('I hurt my knee', mockUserData);
        expect(result.actionTaken).toBe(true);
        expect(result.text).toContain('Recovery Mode');
    });

    it('should handle function call responses (change_plan_focus)', async () => {
        mockCallable.mockResolvedValueOnce(
            makeFunctionCallResponse('change_plan_focus', { new_goal: 'Marathon' })
        );

        const result = await sendMessageToAI('I want to train for a marathon', mockUserData);
        expect(result.actionTaken).toBe(true);
        expect(result.text).toContain('Marathon');
    });

    it('should fall back gracefully on API error', async () => {
        mockCallable.mockRejectedValueOnce(new Error('Network error'));

        const result = await sendMessageToAI('Hello', mockUserData);
        expect(result.text).toContain('trouble connecting');
        expect(result.actionTaken).toBe(false);
    });

    it('should handle empty user data gracefully', async () => {
        mockCallable.mockResolvedValueOnce(makeGeminiResponse('Hello runner!'));

        const result = await sendMessageToAI('Hello', {});
        expect(result.text).toBe('Hello runner!');
    });

    it('should handle missing run history', async () => {
        mockCallable.mockResolvedValueOnce(makeGeminiResponse('Let me help!'));

        const userWithNoHistory = { ...mockUserData, runHistory: undefined };
        const result = await sendMessageToAI('Help me', userWithNoHistory);
        expect(result.text).toBe('Let me help!');
    });

    it('should include tool definitions in the request', async () => {
        mockCallable.mockResolvedValueOnce(makeGeminiResponse('OK'));

        await sendMessageToAI('Hello', mockUserData);

        const callArgs = mockCallable.mock.calls[0][0];
        expect(callArgs.requestBody.tools).toBeDefined();
        expect(callArgs.requestBody.tools[0].function_declarations).toHaveLength(2);
        expect(callArgs.requestBody.tools[0].function_declarations[0].name).toBe('set_injury_mode');
        expect(callArgs.requestBody.tools[0].function_declarations[1].name).toBe('change_plan_focus');
    });
});
