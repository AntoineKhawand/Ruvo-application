/**
 * Focused test for the redeemReward callable's pricing authority.
 *
 * The callable must charge the reward's own price. A caller that sends
 * `price: 1` (or a negative price) must not be able to underpay or mint coins.
 *
 * firebase-admin / firebase-functions are not installed in this checkout, so the
 * test drives the exported handler with a minimal in-memory Firestore double.
 */
const mockState = { env: null };

jest.mock(
    "firebase-functions/v2/https",
    () => {
        class HttpsError extends Error {
            constructor(code, message) {
                super(message);
                this.code = code;
            }
        }
        const wrap = (a, b) => (typeof a === "function" ? a : b);
        return { HttpsError, onCall: wrap, onRequest: wrap };
    },
    { virtual: true }
);

jest.mock(
    "firebase-functions/v2/scheduler",
    () => ({ onSchedule: (a, b) => (typeof a === "function" ? a : b) }),
    { virtual: true }
);

jest.mock("firebase-functions/params", () => ({ defineSecret: (name) => ({ name }) }), {
    virtual: true,
});

jest.mock("qrcode", () => ({ toDataURL: async () => "data:image/png;base64,mock" }), {
    virtual: true,
});

jest.mock(
    "resend",
    () => ({ Resend: class { constructor() {} } }),
    { virtual: true }
);

jest.mock(
    "firebase-admin",
    () => {
        const increment = (n) => ({ __op: "increment", n });
        const serverTimestamp = () => ({ __op: "serverTimestamp" });
        const firestore = () => mockDb;
        firestore.FieldValue = { increment, serverTimestamp };
        return { initializeApp: () => {}, firestore };
    },
    { virtual: true }
);

const mockDb = {
    collection: (name) => mockState.env.collection(name),
    runTransaction: (fn) => mockState.env.runTransaction(fn),
};

const { redeemReward } = require("../index.js");

const currentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const makeEnv = ({ coins = 5000, reward = { stockCount: 5 }, redemptionStats = {}, lastRedemptionAt = null } = {}) => {
    const userRef = { kind: "user" };
    const rewardRef = { kind: "reward" };
    userRef.collection = () => ({ doc: () => ({ kind: "redemption" }) });

    const env = {
        updates: [],
        sets: [],
        collection: (name) => ({ doc: () => (name === "users" ? userRef : rewardRef) }),
        runTransaction: async (fn) =>
            fn({
                get: async (ref) =>
                    ref.kind === "user"
                        ? {
                              exists: true,
                              data: () => ({
                                  coins,
                                  name: "Tester",
                                  email: null,
                                  redemptionStats,
                                  ...(lastRedemptionAt ? { lastRedemptionAt } : {}),
                              }),
                          }
                        : { exists: reward !== null, data: () => reward || {} },
                update: (ref, data) => env.updates.push({ ref: ref.kind, data }),
                set: (ref, data) => env.sets.push({ ref: ref.kind, data }),
            }),
    };
    return env;
};

const call = (data, auth = { uid: "uid-1" }) => redeemReward({ auth, data });
const userCoinsWritten = () => mockState.env.updates.find((u) => u.ref === "user").data.coins;

describe("redeemReward pricing authority", () => {
    test("charges the reward's own price, not the caller's price", async () => {
        mockState.env = makeEnv({ coins: 5000 });

        const res = await call({ rewardId: "1", price: 1, title: "Cheap" });

        expect(res.success).toBe(true);
        expect(userCoinsWritten()).toBe(2500); // 5000 - 2500, never 5000 - 1
        expect(mockState.env.sets[0].data.price).toBe(2500);
        expect(mockState.env.sets[0].data.title).toBe("20% Off Sportswear");
    });

    test("a negative caller price cannot mint coins", async () => {
        mockState.env = makeEnv({ coins: 5000 });

        await call({ rewardId: "3", price: -100000 });

        expect(userCoinsWritten()).toBe(3500); // 5000 - 1500
        expect(userCoinsWritten()).toBeLessThan(5000);
    });

    test("redeems when the caller sends no price at all", async () => {
        mockState.env = makeEnv({ coins: 2000 });

        const res = await call({ rewardId: "6" });

        expect(res.newCoinBalance).toBe(0); // 2000 - 2000
    });

    test("rejects a reward id that has no server-side price", async () => {
        mockState.env = makeEnv({ coins: 999999 });

        await expect(call({ rewardId: "999", price: 1 })).rejects.toMatchObject({
            code: "invalid-argument",
        });
    });

    test("rejects a redemption the caller cannot afford at the reward's price", async () => {
        mockState.env = makeEnv({ coins: 100 });

        await expect(call({ rewardId: "7", price: 1 })).rejects.toMatchObject({
            code: "failed-precondition",
        });
    });

    test("still enforces the monthly redemption cap", async () => {
        mockState.env = makeEnv({
            coins: 999999,
            redemptionStats: { month: currentMonth(), count: 3 },
        });

        await expect(call({ rewardId: "1" })).rejects.toMatchObject({
            code: "resource-exhausted",
        });
    });

    test("still enforces stock", async () => {
        mockState.env = makeEnv({ coins: 999999, reward: { stockCount: 0 } });

        await expect(call({ rewardId: "1" })).rejects.toMatchObject({
            code: "resource-exhausted",
        });
    });

    test("rejects an unauthenticated caller", async () => {
        mockState.env = makeEnv();

        await expect(call({ rewardId: "1", price: 1 }, null)).rejects.toMatchObject({
            code: "unauthenticated",
        });
    });
});
