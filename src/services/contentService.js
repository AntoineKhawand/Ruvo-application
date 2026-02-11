import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

const CONTENT_COLLECTION = 'content';

// Hardcoded library for seeding/fallback
export const FALLBACK_TIPS = [
    {
        id: '1',
        title: 'Trail Adventures',
        desc: 'Explore nature while building ankle strength and stability.',
        img: 'https://images.pexels.com/photos/1571939/pexels-photo-1571939.jpeg?auto=compress&cs=tinysrgb&w=600',
        why: 'Uneven terrain forces you to engage stabilizing muscles that road running ignores. This improves balance and prevents future injuries.',
        steps: [
            { title: "Scout Route", desc: "Check elevation maps and trail conditions before heading out." },
            { title: "Shorten Stride", desc: "Keep feet under you to react quickly to roots and rocks." },
            { title: "Scan Ahead", desc: "Look 10-15 feet ahead, not directly at your feet." }
        ],
        viewCount: 12500
    },
    {
        id: '2',
        title: 'Group Running',
        desc: 'Find motivation and improve performance by running in a pack.',
        img: 'https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=600',
        why: 'Running with others creates "social facilitation," a psychological phenomenon where performance improves merely by being around others.',
        steps: [
            { title: "Find a Pack", desc: "Join a local Ruvo club that matches your pace." },
            { title: "Sync Up", desc: "Don't race. Fall into the group rhythm to conserve energy." },
            { title: "Drafting", desc: "On windy days, run behind others to reduce air resistance." }
        ],
        viewCount: 11200
    },
    // Adding more from the original list to ensure full migration
    {
        id: '3',
        title: 'Nutrition 101',
        desc: 'Fuel your body correctly to hit the wall less often.',
        img: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=600',
        why: 'Timing your carbs is crucial. Eating complex carbohydrates 2-3 hours before a run ensures your glycogen stores are topped up.',
        steps: [
            { title: "Pre-Run", desc: "Eat a banana or toast 30-60 mins before running." },
            { title: "Hydrate", desc: "Drink 500ml of water 2 hours before your workout." },
            { title: "Recovery", desc: "Consume protein within 30 mins of finishing to repair muscle." }
        ],
        viewCount: 15300
    },
    {
        id: '4',
        title: 'Recovery Yoga',
        desc: 'Unlock tight hips and hamstrings after hard runs.',
        img: 'https://images.pexels.com/photos/4056723/pexels-photo-4056723.jpeg?auto=compress&cs=tinysrgb&w=600',
        why: 'Static stretching after a run helps realign muscle fibers and flush out metabolic waste, reducing soreness the next day.',
        steps: [
            { title: "Downward Dog", desc: "Hold for 1 minute to stretch calves and hamstrings." },
            { title: "Pigeon Pose", desc: "Open up tight hips caused by repetitive running motion." },
            { title: "Breathe", desc: "Deep belly breathing activates the parasympathetic nervous system." }
        ],
        viewCount: 18900
    },
    {
        id: '5',
        title: 'Cadence Drills',
        desc: 'Improve your efficiency by increasing your step rate.',
        img: 'https://images.pexels.com/photos/4048182/pexels-photo-4048182.jpeg?auto=compress&cs=tinysrgb&w=600',
        viewCount: 9800
    },
    {
        id: '6',
        title: 'Mental Toughness',
        desc: 'Tricks to keep going when your legs want to quit.',
        img: 'https://images.pexels.com/photos/3775603/pexels-photo-3775603.jpeg?auto=compress&cs=tinysrgb&w=600',
        viewCount: 10500
    },
    {
        id: '7',
        title: 'Hydration Hacks',
        desc: 'Stay hydrated without that annoying sloshing feeling.',
        img: 'https://images.pexels.com/photos/4379227/pexels-photo-4379227.jpeg?auto=compress&cs=tinysrgb&w=600',
        viewCount: 14200
    },
    {
        id: '8',
        title: 'Night Running',
        desc: 'Stay safe and visible while owning the night.',
        img: 'https://images.pexels.com/photos/1671324/pexels-photo-1671324.jpeg?auto=compress&cs=tinysrgb&w=600',
        viewCount: 8900
    },
    {
        id: '9',
        title: 'Hill Repeats',
        desc: 'Build explosive power on inclines.',
        img: 'https://images.pexels.com/photos/1563277/pexels-photo-1563277.jpeg?auto=compress&cs=tinysrgb&w=600',
        viewCount: 11800
    },
    {
        id: '10',
        title: 'Proper Gear',
        desc: 'Choosing the right shoes for your specific foot type.',
        img: 'https://images.pexels.com/photos/2526878/pexels-photo-2526878.jpeg?auto=compress&cs=tinysrgb&w=600',
        viewCount: 16700
    }
];

export const contentService = {
    /**
     * Fetch all tips from Firestore.
     * Returns a list of tips.
     */
    fetchTips: async () => {
        try {
            const q = query(collection(db, CONTENT_COLLECTION), orderBy('id'));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                console.log("No tips found in Firestore. Seeding defaults...");
                await contentService.seedTipsToFirestore();
                return FALLBACK_TIPS;
            }

            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching tips:", error);
            return FALLBACK_TIPS;
        }
    },

    /**
     * Increment the view count for a specific tip.
     */
    incrementTipView: async (tipId) => {
        try {
            const tipRef = doc(db, CONTENT_COLLECTION, tipId.toString());
            // Check if exists first to avoid error if we try to update a non-existent tip (from fallback)
            const snap = await getDoc(tipRef);
            if (snap.exists()) {
                await updateDoc(tipRef, {
                    viewCount: (snap.data().viewCount || 0) + 1
                });
            }
        } catch (error) {
            console.error("Error incrementing tip view:", error);
        }
    },

    /**
     * Seed the initial tips to Firestore.
     * Call this ONCE manually or via a temporary button.
     */
    seedTipsToFirestore: async () => {
        try {
            const batch = writeBatch(db);

            FALLBACK_TIPS.forEach(tip => {
                const docRef = doc(db, CONTENT_COLLECTION, tip.id.toString());
                batch.set(docRef, {
                    ...tip,
                    type: 'tip',
                    createdAt: new Date().toISOString()
                });
            });

            await batch.commit();
            console.log("✅ Tips seeded successfully!");
            return true;
        } catch (error) {
            console.error("❌ Error seeding tips:", error);
            return false;
        }
    }
};
