import {
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ============================================================
// CHALLENGE SERVICE — Firestore-backed challenge management
// ============================================================

// --- SEED DATA (used for initial population) ---
const generateMonthlyChallenges = () => {
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month, daysInMonth, 23, 59, 59);

    return [
        {
            id: `challenge_${year}_${month}_ultra`,
            title: `The ${monthName} Ultra`,
            goal: 'Log 100km',
            goalValue: 100,
            goalType: 'distance', // 'distance' | 'pace' | 'elevation' | 'streak'
            image: 'https://images.unsplash.com/photo-1718248028293-934f04a578db?q=80&w=1286&auto=format&fit=crop',
            dates: `${monthName} 1 - ${monthName} ${daysInMonth}`,
            startDate: Timestamp.fromDate(startOfMonth),
            endDate: Timestamp.fromDate(endOfMonth),
            participants: 0,
            xp: 10000,
            coins: 1500,
            type: 'Featured',
            description: `The ultimate endurance test for ${monthName}. Log 100km total distance this month.`,
            createdAt: serverTimestamp()
        },
        {
            id: `challenge_${year}_${month}_speed`,
            title: 'Speed Week',
            goal: 'Run a 5k under 25 mins',
            goalValue: 25,
            goalType: 'pace',
            image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=1200&auto=format&fit=crop',
            dates: `${monthName.substring(0, 3)} 8 - ${monthName.substring(0, 3)} 15`,
            startDate: Timestamp.fromDate(new Date(year, month, 8)),
            endDate: Timestamp.fromDate(new Date(year, month, 15, 23, 59, 59)),
            participants: 0,
            xp: 2500,
            coins: 500,
            type: 'Upcoming',
            description: 'Focus on pace. Push your limits and try to set a new 5k Personal Best.',
            createdAt: serverTimestamp()
        },
        {
            id: `challenge_${year}_${month}_elevation`,
            title: 'Elevation King',
            goal: 'Gain 300m elevation',
            goalValue: 300,
            goalType: 'elevation',
            image: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?q=80&w=1200&auto=format&fit=crop',
            dates: `${monthName.substring(0, 3)} 20 - ${monthName.substring(0, 3)} 27`,
            startDate: Timestamp.fromDate(new Date(year, month, 20)),
            endDate: Timestamp.fromDate(new Date(year, month, 27, 23, 59, 59)),
            participants: 0,
            xp: 3000,
            coins: 750,
            type: 'Upcoming',
            description: 'Hills build character. Accumulate 300m of vertical gain.',
            createdAt: serverTimestamp()
        },
        {
            id: `challenge_${year}_${month}_streak`,
            title: '7-Day Streak',
            goal: 'Run 7 days in a row',
            goalValue: 7,
            goalType: 'streak',
            image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1200&auto=format&fit=crop',
            dates: `Any 7 consecutive days in ${monthName}`,
            startDate: Timestamp.fromDate(startOfMonth),
            endDate: Timestamp.fromDate(endOfMonth),
            participants: 0,
            xp: 5000,
            coins: 1000,
            type: 'Active',
            description: 'Consistency is king. Run at least once every day for 7 consecutive days.',
            createdAt: serverTimestamp()
        }
    ];
};

// --- CORE SERVICE FUNCTIONS ---

/**
 * Seed challenges collection if empty for the current month.
 * Safe to call multiple times — only seeds if no challenges exist for this month.
 */
export const seedChallenges = async () => {
    try {
        const now = new Date();
        const monthKey = `${now.getFullYear()}_${now.getMonth()}`;

        // Check if challenges already exist for this month
        const checkRef = doc(db, 'challenges', `challenge_${monthKey}_ultra`);
        const checkSnap = await getDoc(checkRef);

        if (checkSnap.exists()) {
            return; // Already seeded
        }

        const challenges = generateMonthlyChallenges();
        const promises = challenges.map(challenge =>
            setDoc(doc(db, 'challenges', challenge.id), challenge)
        );
        await Promise.all(promises);
        console.log(`[ChallengeService] Seeded ${challenges.length} challenges for ${monthKey}`);
    } catch (error) {
        console.error('[ChallengeService] Error seeding challenges:', error);
    }
};

/**
 * Fetch all active challenges from Firestore.
 * Returns challenges whose endDate is in the future.
 */
export const fetchActiveChallenges = async () => {
    try {
        const challengesRef = collection(db, 'challenges');
        const snapshot = await getDocs(challengesRef);

        const now = new Date();
        const challenges = [];

        snapshot.forEach(docSnap => {
            const data = { id: docSnap.id, ...docSnap.data() };
            // Only include challenges that haven't ended
            const endDate = data.endDate?.toDate ? data.endDate.toDate() : new Date(9999, 0);
            if (endDate >= now) {
                challenges.push(data);
            }
        });

        // Sort: Featured first, then by start date
        challenges.sort((a, b) => {
            if (a.type === 'Featured' && b.type !== 'Featured') return -1;
            if (b.type === 'Featured' && a.type !== 'Featured') return 1;
            const aStart = a.startDate?.toDate?.() || new Date();
            const bStart = b.startDate?.toDate?.() || new Date();
            return aStart - bStart;
        });

        return challenges;
    } catch (error) {
        console.error('[ChallengeService] Error fetching challenges:', error);
        return [];
    }
};

/**
 * Join a challenge. Atomically increments participant count
 * and adds challengeId to the user's profile.
 */
export const joinChallenge = async (userId, challengeId) => {
    try {
        const challengeRef = doc(db, 'challenges', challengeId);
        await updateDoc(challengeRef, {
            participants: increment(1)
        });

        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            joinedChallenges: arrayUnion(challengeId)
        });

        return { success: true };
    } catch (error) {
        console.error('[ChallengeService] Error joining challenge:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Leave a challenge. Atomically decrements participant count
 * and removes challengeId from the user's profile.
 */
export const leaveChallenge = async (userId, challengeId) => {
    try {
        const challengeRef = doc(db, 'challenges', challengeId);
        await updateDoc(challengeRef, {
            participants: increment(-1)
        });

        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            joinedChallenges: arrayRemove(challengeId)
        });

        return { success: true };
    } catch (error) {
        console.error('[ChallengeService] Error leaving challenge:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Calculate progress for a challenge based on the user's run history.
 * Supports goalTypes: 'distance', 'pace', 'elevation', 'streak'
 * 
 * @returns {{ percent: number, current: string, target: number }}
 */
export const getChallengeProgress = (challenge, runHistory = []) => {
    if (!challenge || !challenge.goalValue) {
        return { percent: 0, current: '0', target: 0, runCount: 0 };
    }

    // Handle Firestore Timestamps, plain JS Dates, and ISO strings uniformly
    const toDate = (val) => {
        if (!val) return null;
        if (typeof val?.toDate === 'function') return val.toDate(); // Firestore Timestamp
        if (val instanceof Date) return val;                         // JS Date
        return new Date(val);                                        // ISO string / ms number
    };

    const startDate = toDate(challenge.startDate) || new Date(0);
    const endDate   = toDate(challenge.endDate)   || new Date(9999, 0);

    const relevantRuns = runHistory.filter(run => {
        const d = new Date(run.date);
        return d >= startDate && d <= endDate;
    });

    let current = 0;

    switch (challenge.goalType) {
        case 'distance':
            current = relevantRuns.reduce((sum, run) => sum + (parseFloat(run.distance) || 0), 0);
            break;

        case 'count':
            // Number of runs in the date window
            current = relevantRuns.length;
            break;

        case 'elevation':
            // Accept both field names written by different parts of the app
            current = relevantRuns.reduce(
                (sum, run) => sum + (parseFloat(run.elevationGain) || parseFloat(run.elevation) || 0),
                0
            );
            break;

        case 'pace': {
            const fiveKRuns = relevantRuns.filter(r => (parseFloat(r.distance) || 0) >= 5);
            if (fiveKRuns.length > 0) {
                const bestTime = Math.min(...fiveKRuns.map(r => {
                    const parts = (r.duration || '00:00').split(':');
                    return parseInt(parts[0] || 0) * 60 + parseInt(parts[1] || 0);
                }));
                current = Math.max(0, challenge.goalValue - (bestTime / (parseFloat(fiveKRuns[0]?.distance) || 5) * 5));
            }
            break;
        }

        case 'streak': {
            if (relevantRuns.length === 0) break;
            const uniqueDates = [...new Set(relevantRuns.map(r => new Date(r.date).toDateString()))]
                .sort((a, b) => new Date(a) - new Date(b));
            let longest = 1, streak = 1;
            for (let i = 1; i < uniqueDates.length; i++) {
                const diff = Math.round(
                    (new Date(uniqueDates[i]) - new Date(uniqueDates[i - 1])) / 86400000
                );
                if (diff === 1) { streak++; longest = Math.max(longest, streak); }
                else streak = 1;
            }
            current = longest;
            break;
        }

        default:
            current = relevantRuns.reduce((sum, run) => sum + (parseFloat(run.distance) || 0), 0);
    }

    return {
        percent:  Math.min(current / challenge.goalValue, 1),
        current:  challenge.goalType === 'count'
            ? String(Math.floor(current))
            : (typeof current === 'number' ? current.toFixed(1) : String(current)),
        target:   challenge.goalValue,
        runCount: relevantRuns.length,
    };
};

/**
 * Check if a user has completed a challenge and award rewards.
 * Returns { completed, xp, coins } if newly completed.
 */
export const checkChallengeCompletion = (challenge, runHistory = [], completedChallenges = []) => {
    if (!challenge || completedChallenges.includes(challenge.id)) {
        return { completed: false, xp: 0, coins: 0 };
    }

    const progress = getChallengeProgress(challenge, runHistory);

    if (progress.percent >= 1) {
        return {
            completed: true,
            xp: challenge.xp || 0,
            coins: challenge.coins || 0,
            challengeId: challenge.id,
            challengeTitle: challenge.title
        };
    }

    return { completed: false, xp: 0, coins: 0 };
};

export const challengeService = {
    seedChallenges,
    fetchActiveChallenges,
    joinChallenge,
    leaveChallenge,
    getChallengeProgress,
    checkChallengeCompletion,
    generateMonthlyChallenges
};
