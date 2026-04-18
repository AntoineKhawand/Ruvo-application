import { Alert } from 'react-native';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const REASONS = [
    { label: 'Spam or Advertising', value: 'spam' },
    { label: 'Inappropriate Content', value: 'inappropriate' },
    { label: 'Harassment or Bullying', value: 'harassment' },
    { label: 'Misinformation', value: 'misinformation' },
    { label: 'Other', value: 'other' },
];

/**
 * Shows a reason picker then writes a report document to Firestore.
 *
 * @param {object} opts
 * @param {string} opts.reporterId   - UID of the user filing the report
 * @param {string} opts.reporterName - Display name (for admin convenience)
 * @param {string} opts.itemId       - ID of the post / club / user being reported
 * @param {string} opts.itemType     - 'post' | 'club' | 'user'
 * @param {string} [opts.itemLabel]  - Human-readable label shown in the dialog title
 */
export const submitReport = ({ reporterId, reporterName, itemId, itemType, itemLabel }) => {
    const title = itemLabel ? `Report "${itemLabel}"` : `Report ${itemType}`;

    Alert.alert(
        title,
        "What's the issue?",
        [
            ...REASONS.map(r => ({
                text: r.label,
                onPress: () => writeReport(reporterId, reporterName, itemId, itemType, r.value),
            })),
            { text: 'Cancel', style: 'cancel' },
        ]
    );
};

const writeReport = async (reporterId, reporterName, itemId, itemType, reason) => {
    try {
        await addDoc(collection(db, 'reports'), {
            reporterId,
            reporterName: reporterName || 'Unknown',
            itemId,
            itemType,   // 'post' | 'club' | 'user'
            reason,
            status: 'pending',
            createdAt: serverTimestamp(),
        });

        Alert.alert(
            'Report Submitted',
            'Thank you. Our team reviews all reports within 24–48 hours and will take action if community guidelines were violated.',
            [{ text: 'OK' }]
        );
    } catch (e) {
        console.error('Report write failed:', e);
        Alert.alert('Error', 'Could not submit your report. Please try again.');
    }
};
