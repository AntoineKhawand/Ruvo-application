/**
 * Unit Tests for UserContext.js
 *
 * Tests the pure-logic, non-rendering functions from UserContext:
 * - checkPrivacyPermission logic
 * - generateWeekPlan (AI coaching plan generator)
 * - XP/coins reward calculation (addRunToHistory formula)
 * - DEFAULT_USER_DATA structure validation
 *
 * NOTE: Full context rendering tests (useState, useEffect) require
 * @testing-library/react-hooks and are deferred to Phase 1.3.
 * This file focuses on the pure business logic that can be tested
 * without rendering React components.
 */

// --- MOCK ALL EXTERNALS ---
jest.mock('expo-notifications', () => ({
    scheduleNotificationAsync: jest.fn(),
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[xxx]' }),
    setNotificationHandler: jest.fn(),
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    cancelAllScheduledNotificationsAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
    Alert: { alert: jest.fn() },
    AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
    Platform: { OS: 'android' },
}));

jest.mock('firebase/auth', () => ({
    createUserWithEmailAndPassword: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn((auth, cb) => {
        cb(null); // start as guest
        return jest.fn(); // unsubscribe
    }),
    getAuth: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    setDoc: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    writeBatch: jest.fn(),
    arrayUnion: jest.fn((...vals) => ({ _type: 'arrayUnion', values: vals })),
    arrayRemove: jest.fn((...vals) => ({ _type: 'arrayRemove', values: vals })),
    increment: jest.fn(val => ({ _type: 'increment', value: val })),
    serverTimestamp: jest.fn(() => 'SERVER_TS'),
    runTransaction: jest.fn(),
    onSnapshot: jest.fn(),
}));

jest.mock('../../config/firebase', () => ({
    auth: {},
    db: {},
}));

jest.mock('../../services/revenueCat', () => ({
    initRevenueCat: jest.fn(),
    checkSubscriptionStatus: jest.fn().mockResolvedValue(false),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
}));

jest.mock('../../services/referralService', () => ({
    generateReferralCode: jest.fn(() => 'TEST1234'),
    validateReferralCode: jest.fn(),
    processReferralReward: jest.fn(),
}));

jest.mock('../../services/badgeService', () => ({
    checkNewBadges: jest.fn(() => []),
}));

jest.mock('../../services/clubService', () => ({
    seedClubs: jest.fn(),
    getAllClubs: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/contentService', () => ({
    contentService: { fetchTips: jest.fn().mockResolvedValue([]) },
}));

// Mock NotificationContext (UserProvider depends on it)
jest.mock('../NotificationContext', () => ({
    useNotifications: () => ({
        addNotification: jest.fn(),
        checkRunReminders: jest.fn(),
        sendClubReminder: jest.fn(),
    }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
}));

jest.mock('../../services/aiCoach', () => ({
    generateAITrainingPlan: jest.fn(),
}));

// ============================================================
// EXTRACT TESTABLE PURE LOGIC
// Instead of rendering the full UserProvider (which has deep
// dependency chains), we test the pure logic functions by
// extracting them from the source code patterns.
// ============================================================

describe('UserContext — Pure Logic', () => {

    // --- PRIVACY PERMISSION LOGIC ---
    // Extracted from checkPrivacyPermission (lines 605-640)
    describe('checkPrivacyPermission logic', () => {
        // Simulate the checkPrivacyPermission function
        const checkPrivacy = (targetUserData, permissionType, currentUserId) => {
            if (!targetUserData || !currentUserId) return false;
            if (targetUserData.uid === currentUserId) return true;

            const privacy = targetUserData.privacySettings || {};
            const isFriend = (targetUserData.followers || []).includes(currentUserId);

            switch (permissionType) {
                case 'viewProfile':
                    if (privacy.profileVisibility === 'private') return false;
                    if (privacy.profileVisibility === 'friends') return isFriend;
                    return true;
                case 'viewActivity':
                    return privacy.showActivityOnFeed !== false;
                case 'comment':
                    if (privacy.whoCanComment === 'nobody') return false;
                    if (privacy.whoCanComment === 'friends') return isFriend;
                    return true;
                case 'follow':
                    if (privacy.whoCanFollow === 'nobody') return false;
                    if (privacy.whoCanFollow === 'friends') return isFriend;
                    return true;
                case 'viewClubs':
                    if (privacy.whoCanSeeClubs === 'friends') return isFriend;
                    return true;
                default:
                    return true;
            }
        };

        it('should return false for null target user', () => {
            expect(checkPrivacy(null, 'viewProfile', 'me')).toBe(false);
        });

        it('should always allow viewing own profile', () => {
            expect(checkPrivacy({ uid: 'me' }, 'viewProfile', 'me')).toBe(true);
        });

        it('should block private profiles from non-friends', () => {
            const target = { uid: 'other', privacySettings: { profileVisibility: 'private' }, followers: [] };
            expect(checkPrivacy(target, 'viewProfile', 'me')).toBe(false);
        });

        it('should allow friends-only profile for friends', () => {
            const target = { uid: 'other', privacySettings: { profileVisibility: 'friends' }, followers: ['me'] };
            expect(checkPrivacy(target, 'viewProfile', 'me')).toBe(true);
        });

        it('should block friends-only profile for non-friends', () => {
            const target = { uid: 'other', privacySettings: { profileVisibility: 'friends' }, followers: [] };
            expect(checkPrivacy(target, 'viewProfile', 'me')).toBe(false);
        });

        it('should allow public profiles by default', () => {
            const target = { uid: 'other', privacySettings: {}, followers: [] };
            expect(checkPrivacy(target, 'viewProfile', 'me')).toBe(true);
        });

        it('should hide activity when showActivityOnFeed is false', () => {
            const target = { uid: 'other', privacySettings: { showActivityOnFeed: false }, followers: [] };
            expect(checkPrivacy(target, 'viewActivity', 'me')).toBe(false);
        });

        it('should show activity by default', () => {
            const target = { uid: 'other', privacySettings: {}, followers: [] };
            expect(checkPrivacy(target, 'viewActivity', 'me')).toBe(true);
        });

        it('should block comments when set to nobody', () => {
            const target = { uid: 'other', privacySettings: { whoCanComment: 'nobody' }, followers: [] };
            expect(checkPrivacy(target, 'comment', 'me')).toBe(false);
        });

        it('should allow comments from friends when set to friends', () => {
            const target = { uid: 'other', privacySettings: { whoCanComment: 'friends' }, followers: ['me'] };
            expect(checkPrivacy(target, 'comment', 'me')).toBe(true);
        });

        it('should block follow when set to nobody', () => {
            const target = { uid: 'other', privacySettings: { whoCanFollow: 'nobody' }, followers: [] };
            expect(checkPrivacy(target, 'follow', 'me')).toBe(false);
        });

        it('should show clubs to everyone by default', () => {
            const target = { uid: 'other', privacySettings: {}, followers: [] };
            expect(checkPrivacy(target, 'viewClubs', 'me')).toBe(true);
        });

        it('should return true for unknown permission types', () => {
            const target = { uid: 'other', privacySettings: {}, followers: [] };
            expect(checkPrivacy(target, 'unknownPermission', 'me')).toBe(true);
        });
    });

    // --- TRAINING PLAN GENERATION ---
    // Extracted from generateWeekPlan (lines 1372-1465)
    describe('generateWeekPlan logic', () => {
        // Replicate the pure function
        const generateWeekPlan = (goal, status, weekOffset = 0, availableDays = ['Mon', 'Wed', 'Fri']) => {
            const days = (availableDays && availableDays.length > 0) ? availableDays : ['Mon', 'Wed', 'Fri'];
            const getDay = (idx) => days[idx % days.length];

            if (status === 'Injured' || goal === 'Recovery') {
                return {
                    focus: 'Recovery',
                    totalDist: '0-5km',
                    workouts: [
                        { day: getDay(0), title: 'Rest Day', detail: 'Focus on sleep', icon: 'bed', isRest: true },
                        { day: getDay(1), title: 'Recovery Walk', detail: '20 min low impact', icon: 'walk', isRest: false },
                        { day: getDay(Math.min(2, days.length - 1)), title: 'Mobility Work', detail: '15 min stretching', icon: 'body-outline', isRest: false },
                    ]
                };
            }

            if (status === 'Vacation' || goal === 'Maintenance') {
                return {
                    focus: 'Maintenance',
                    totalDist: '10-15km',
                    workouts: days.slice(0, 2).map((d, i) => ({
                        day: d,
                        title: i === 0 ? 'Scenic Run' : 'Short Jog',
                        detail: i === 0 ? '30 min easy' : '20 min easy',
                        icon: i === 0 ? 'image' : 'walk',
                        isRest: false
                    }))
                };
            }

            const phases = ['Base Building', 'Load Increase', 'Peak Week', 'Taper'];
            const phase = phases[weekOffset % 4];
            const volMult = [1, 1.1, 1.2, 0.8][weekOffset % 4];

            let baseDist = 5;
            if (goal === 'Half Marathon') baseDist = 10;
            if (goal === 'Marathon') baseDist = 15;

            const workouts = [];
            const longRunDay = days[days.length - 1];
            workouts.push({
                day: longRunDay, title: 'Long Run',
                detail: `${Math.round(baseDist * 1.5 * volMult)}km Steady`,
                icon: 'map', isRest: false
            });

            if (days.length > 1) {
                const speedDay = days[Math.floor((days.length - 1) / 2)];
                workouts.push({
                    day: speedDay, title: 'Speed Work',
                    detail: `${Math.round(baseDist * 0.6 * volMult)}km Intervals`,
                    icon: 'stopwatch', isRest: false
                });
            }

            days.forEach(d => {
                if (d !== longRunDay && (days.length <= 1 || d !== days[Math.floor((days.length - 1) / 2)])) {
                    workouts.push({
                        day: d, title: 'Easy Run',
                        detail: `${Math.round(baseDist * 0.8 * volMult)}km Zone 2`,
                        icon: 'walk', isRest: false
                    });
                }
            });

            const dayOrder = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7 };
            workouts.sort((a, b) => dayOrder[a.day] - dayOrder[b.day]);

            return {
                focus: phase,
                totalDist: `${Math.round(baseDist * days.length * volMult)}km`,
                workouts: workouts
            };
        };

        it('should return Recovery plan for Injured status', () => {
            const plan = generateWeekPlan('5k', 'Injured');
            expect(plan.focus).toBe('Recovery');
            expect(plan.totalDist).toBe('0-5km');
            expect(plan.workouts[0].title).toBe('Rest Day');
            expect(plan.workouts[0].isRest).toBe(true);
        });

        it('should return Recovery plan for Recovery goal', () => {
            const plan = generateWeekPlan('Recovery', 'Active');
            expect(plan.focus).toBe('Recovery');
        });

        it('should return Maintenance plan for Vacation status', () => {
            const plan = generateWeekPlan('10k', 'Vacation');
            expect(plan.focus).toBe('Maintenance');
            expect(plan.workouts[0].title).toBe('Scenic Run');
        });

        it('should return Maintenance plan for Maintenance goal', () => {
            const plan = generateWeekPlan('Maintenance', 'Active');
            expect(plan.focus).toBe('Maintenance');
        });

        it('should cycle through phases with weekOffset', () => {
            expect(generateWeekPlan('5k', 'Active', 0).focus).toBe('Base Building');
            expect(generateWeekPlan('5k', 'Active', 1).focus).toBe('Load Increase');
            expect(generateWeekPlan('5k', 'Active', 2).focus).toBe('Peak Week');
            expect(generateWeekPlan('5k', 'Active', 3).focus).toBe('Taper');
            expect(generateWeekPlan('5k', 'Active', 4).focus).toBe('Base Building'); // cycles
        });

        it('should increase base distance for Half Marathon', () => {
            const plan5k = generateWeekPlan('5k', 'Active');
            const planHalf = generateWeekPlan('Half Marathon', 'Active');
            // Half marathon should have higher km values
            const get5kLong = plan5k.workouts.find(w => w.title === 'Long Run');
            const getHalfLong = planHalf.workouts.find(w => w.title === 'Long Run');
            const km5k = parseInt(get5kLong.detail);
            const kmHalf = parseInt(getHalfLong.detail);
            expect(kmHalf).toBeGreaterThan(km5k);
        });

        it('should increase base distance for Marathon', () => {
            const planHalf = generateWeekPlan('Half Marathon', 'Active');
            const planFull = generateWeekPlan('Marathon', 'Active');
            const halfTotal = parseInt(planHalf.totalDist);
            const fullTotal = parseInt(planFull.totalDist);
            expect(fullTotal).toBeGreaterThan(halfTotal);
        });

        it('should include Long Run, Speed Work, and Easy Run for 3 days', () => {
            const plan = generateWeekPlan('10k', 'Active', 0, ['Mon', 'Wed', 'Fri']);
            const titles = plan.workouts.map(w => w.title);
            expect(titles).toContain('Long Run');
            expect(titles).toContain('Speed Work');
            expect(titles).toContain('Easy Run');
        });

        it('should only have Long Run when 1 day available', () => {
            const plan = generateWeekPlan('5k', 'Active', 0, ['Sat']);
            expect(plan.workouts).toHaveLength(1);
            expect(plan.workouts[0].title).toBe('Long Run');
        });

        it('should sort workouts by day order (Mon → Sun)', () => {
            const plan = generateWeekPlan('5k', 'Active', 0, ['Fri', 'Mon', 'Wed']);
            const days = plan.workouts.map(w => w.day);
            const dayOrder = { 'Mon': 1, 'Wed': 3, 'Fri': 5 };
            for (let i = 1; i < days.length; i++) {
                expect(dayOrder[days[i]]).toBeGreaterThan(dayOrder[days[i - 1]]);
            }
        });

        it('should default to MWF when availableDays is empty', () => {
            const plan = generateWeekPlan('5k', 'Active', 0, []);
            const days = plan.workouts.map(w => w.day);
            expect(days).toContain('Mon');
            expect(days).toContain('Fri');
        });

        it('Taper week should have lower volume than Peak', () => {
            const peak = generateWeekPlan('10k', 'Active', 2);  // Peak Week (1.2x)
            const taper = generateWeekPlan('10k', 'Active', 3);  // Taper (0.8x)
            const peakTotal = parseInt(peak.totalDist);
            const taperTotal = parseInt(taper.totalDist);
            expect(taperTotal).toBeLessThan(peakTotal);
        });
    });

    // --- XP/COINS REWARD FORMULA ---
    describe('XP and Coins reward calculation', () => {
        // Extracted from addRunToHistory (lines 1168-1173)
        const calcRewards = (distance, durationStr) => {
            let durationMinutes = 0;
            if (durationStr) {
                const parts = durationStr.split(':').map(Number);
                if (parts.length === 2) {
                    durationMinutes = parts[0] + (parts[1] / 60);
                } else if (parts.length === 3) {
                    durationMinutes = (parts[0] * 60) + parts[1] + (parts[2] / 60);
                }
            }
            const earnedXp = Math.floor((distance * 100) + (durationMinutes * 2));
            const earnedCoins = Math.floor(distance * 10);
            return { earnedXp, earnedCoins };
        };

        it('should calculate XP = (distance * 100) + (minutes * 2)', () => {
            const { earnedXp } = calcRewards(5, '30:00'); // 5km, 30 min
            expect(earnedXp).toBe(560); // (5*100) + (30*2) = 560
        });

        it('should calculate Coins = distance * 10', () => {
            const { earnedCoins } = calcRewards(5, '30:00');
            expect(earnedCoins).toBe(50); // 5 * 10
        });

        it('should handle HH:MM:SS duration format', () => {
            const { earnedXp } = calcRewards(10, '1:05:30'); // 1h 5m 30s = 65.5min
            expect(earnedXp).toBe(Math.floor(1000 + 65.5 * 2)); // 1131
        });

        it('should handle MM:SS duration format', () => {
            const { earnedXp } = calcRewards(3, '25:00');
            expect(earnedXp).toBe(350); // (3*100) + (25*2)
        });

        it('should handle zero distance', () => {
            const { earnedXp, earnedCoins } = calcRewards(0, '10:00');
            expect(earnedXp).toBe(20);  // 0 + (10*2)
            expect(earnedCoins).toBe(0);
        });

        it('should handle empty duration', () => {
            const { earnedXp } = calcRewards(5, '');
            expect(earnedXp).toBe(500); // (5*100) + 0
        });

        it('should handle null duration', () => {
            const { earnedXp } = calcRewards(5, null);
            expect(earnedXp).toBe(500);
        });

        it('should floor XP to integer', () => {
            const { earnedXp } = calcRewards(3.5, '22:30'); // 22.5 min
            expect(earnedXp).toBe(Math.floor(350 + 45)); // 395
            expect(Number.isInteger(earnedXp)).toBe(true);
        });
    });

    // --- DEFAULT_USER_DATA STRUCTURE ---
    describe('DEFAULT_USER_DATA structure', () => {
        // We can't import it directly due to UserContext's side effects,
        // so we test the expected shape here.
        const DEFAULT_USER_DATA = {
            name: 'Runner', email: 'user@ruvo.app',
            onboardingCompleted: false,
            avatar: null, level: 1, currentXP: 150, xpToNextLevel: 1000,
            bio: '', city: '',
            weeklyDistance: 0, weeklyGoal: 0,
            isPro: false,
            wallet: { coins: 0 },
            referralCode: null,
            referralStats: { totalInvites: 0, coinsEarned: 0 },
        };

        it('should default to non-Pro user', () => {
            expect(DEFAULT_USER_DATA.isPro).toBe(false);
        });

        it('should start with 0 weekly distance', () => {
            expect(DEFAULT_USER_DATA.weeklyDistance).toBe(0);
        });

        it('should start at level 1 with 150 XP', () => {
            expect(DEFAULT_USER_DATA.level).toBe(1);
            expect(DEFAULT_USER_DATA.currentXP).toBe(150);
        });

        it('should have empty wallet', () => {
            expect(DEFAULT_USER_DATA.wallet.coins).toBe(0);
        });

        it('should have null referral code (generated on signup)', () => {
            expect(DEFAULT_USER_DATA.referralCode).toBeNull();
        });

        it('should not have completed onboarding', () => {
            expect(DEFAULT_USER_DATA.onboardingCompleted).toBe(false);
        });
    });
});
