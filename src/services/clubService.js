import {
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    limit,
    query,
    serverTimestamp,
    setDoc,
    updateDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Initial Club Data to Seed
const INITIAL_CLUBS = [
    {
        id: 'club_nrc_beirut',
        name: 'Nike Run Club Beirut',
        desc: 'The official NRC chapter in Beirut. Join us for weekly runs every Tuesday at 7 PM in Zaitunay Bay.',
        icon: 'run', // MaterialCommunityIcon name
        color: '#CCFF00', // Neon Lime
        members: [], // User IDs
        memberCount: 1240,
        type: 'public',
        location: 'Beirut, Lebanon',
        tags: ['Road', 'Social', '5K'],
        image: 'https://images.unsplash.com/photo-1552674605-46f5383a67d1?q=80&w=1000&auto=format&fit=crop'
    },
    {
        id: 'club_beirut_marathon',
        name: 'Beirut Marathon Quality',
        desc: 'Training for the annual Beirut Marathon. Long runs on Sundays. Elite and beginner groups available.',
        icon: 'trophy',
        color: '#FF0055', // Neon Pink
        members: [],
        memberCount: 850,
        type: 'public',
        location: 'Beirut, Lebanon',
        tags: ['Marathon', 'Training', 'Long Run'],
        image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1000&auto=format&fit=crop'
    },
    {
        id: 'club_inter_lebanon',
        name: 'Inter Lebanon',
        desc: 'Professional athletics club. Track and field focus. Access to CSj track required.',
        icon: 'flag-checkered',
        color: '#00D4FF', // Neon Blue
        members: [],
        memberCount: 120,
        type: 'private',
        location: 'Jamhour, Lebanon',
        tags: ['Track', 'Elite', 'Athletics'],
        image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=1000&auto=format&fit=crop'
    },
    {
        id: 'club_trail_blazers',
        name: 'Lebanon Trail Blazers',
        desc: 'Discovering the mountains of Lebanon one trail at a time. Monthly excursions to Qornet el Sawda and more.',
        icon: 'image-filter-hdr', // Mountain icon
        color: '#FFAA00', // Neon Orange
        members: [],
        memberCount: 430,
        type: 'public',
        location: 'Mount Lebanon',
        tags: ['Trail', 'Nature', 'Hiking'],
        image: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?q=80&w=1000&auto=format&fit=crop'
    },
    {
        id: 'club_early_birds',
        name: 'Early Birds DXB',
        desc: 'Sunrise runs in Dubai. Beat the heat and start your day right. 5:30 AM starts.',
        icon: 'weather-sunny',
        color: '#FFEE00', // Yellow
        members: [],
        memberCount: 310,
        type: 'public',
        location: 'Dubai, UAE',
        tags: ['Morning', 'Social', 'Coffee'],
        image: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?q=80&w=1000&auto=format&fit=crop'
    }
];

/**
 * Seeds the Firestore 'clubs' collection with initial data if empty.
 * @returns {Promise<void>}
 */
export const seedClubs = async () => {
    try {
        const clubsRef = collection(db, 'clubs');
        const q = query(clubsRef, limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            console.log('⚠️ Clubs collection is not empty. Skipping seed.');
            return;
        }

        console.log('🌱 Seeding clubs...');
        const batchPromises = INITIAL_CLUBS.map(async (club) => {
            const { id, ...clubData } = club;
            await setDoc(doc(db, 'clubs', id), {
                ...clubData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        });

        await Promise.all(batchPromises);
        console.log('✅ Clubs seeded successfully!');
        return true; // Return true to indicate seeding happened
    } catch (error) {
        console.error('❌ Error seeding clubs:', error);
        throw error;
    }
};

/**
 * Fetches all clubs from Firestore.
 * @returns {Promise<Array>} List of club objects
 */
export const getAllClubs = async () => {
    try {
        const clubsRef = collection(db, 'clubs');
        const snapshot = await getDocs(clubsRef);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching clubs:', error);
        return [];
    }
};

/**
 * Joins a club.
 * @param {string} userId 
 * @param {string} clubId 
 */
export const joinClub = async (userId, clubId) => {
    try {
        const clubRef = doc(db, 'clubs', clubId);

        // Check if club is private
        const clubSnap = await getDoc(clubRef);
        if (!clubSnap.exists()) throw new Error('Club not found');

        const clubData = clubSnap.data();

        if (clubData.type === 'private') {
            // Send request
            await updateDoc(clubRef, {
                pendingRequests: arrayUnion(userId)
            });
            return { status: 'requested' };
        } else {
            // Join directly
            await updateDoc(clubRef, {
                members: arrayUnion(userId),
                memberCount: increment(1)
            });
            return { status: 'joined' };
        }
    } catch (error) {
        console.error('Error joining club:', error);
        throw error;
    }
};

/**
 * Leaves a club.
 * @param {string} userId 
 * @param {string} clubId 
 */
export const leaveClub = async (userId, clubId) => {
    try {
        const clubRef = doc(db, 'clubs', clubId);
        await updateDoc(clubRef, {
            members: arrayRemove(userId),
            memberCount: increment(-1)
        });
        return { status: 'left' };
    } catch (error) {
        console.error('Error leaving club:', error);
        throw error;
    }
};
