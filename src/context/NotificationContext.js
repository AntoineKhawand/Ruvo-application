import * as Notifications from 'expo-notifications';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../config/firebase';

const NotificationContext = createContext();

import { Platform } from 'react-native';

// Wrapped in try/catch — this runs at MODULE LEVEL (before React)
// If it crashes, the entire app is a permanent black screen
try {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });

    // Android 8+ requires a notification channel for consistent icon & color
    if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('ruvo-default', {
            name: 'Ruvo Notifications',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#CCFF00',
            sound: 'default',
        });
    }
} catch (e) {
    console.warn('Notifications setup failed:', e);
}

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotifications must be used within a NotificationProvider");
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [currentUser, setCurrentUser] = useState(null);

    // Track authenticated user for Firestore sync
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    // Sync notifications from Firestore when user logs in
    useEffect(() => {
        if (!currentUser) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        const q = query(
            collection(db, 'users', currentUser.uid, 'notifications'),
            orderBy('time', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setNotifications(fetched);
            setUnreadCount(fetched.filter(n => !n.read).length);
        }, (err) => console.error("Notification sync error:", err));

        return () => unsubscribe();
    }, [currentUser]);

    // 1. Setup Permissions on Mount — wrapped in try/catch for emulator safety
    useEffect(() => {
        const registerForPushNotificationsAsync = async () => {
            try {
                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                let finalStatus = existingStatus;
                if (existingStatus !== 'granted') {
                    const { status } = await Notifications.requestPermissionsAsync();
                    finalStatus = status;
                }
                if (finalStatus !== 'granted') {
                    console.log('Failed to get push token for push notification!');
                    return;
                }
            } catch (e) {
                console.warn('Notification permission request failed:', e);
            }
        };

        registerForPushNotificationsAsync();

        // Listener for incoming notifications while app is open
        const subscription = Notifications.addNotificationReceivedListener(notification => {
            const { title, body, data } = notification.request.content;
            addNotification({
                title: title || "New Notification",
                desc: body || "",
                type: data?.type || "system",
                data: data || null
            });
        });

        return () => subscription.remove();
    }, []);

    // 2. Add a new in-app notification
    const addNotification = async ({ title, desc, type, data = null }) => {
        const newNotif = {
            title,
            desc,
            type, // 'achievement', 'social', 'system', 'friend_request'
            data,
            read: false,
            time: new Date().toISOString()
        };

        if (currentUser) {
            try {
                const notifRef = doc(collection(db, 'users', currentUser.uid, 'notifications'));
                await setDoc(notifRef, newNotif);
                // State updates automatically via onSnapshot
            } catch (e) {
                console.error("Failed to save notification to Firestore:", e);
            }
        } else {
            // Fallback to local state if not logged in
            const localNotif = { id: Date.now().toString(), ...newNotif };
            setNotifications(prev => [localNotif, ...prev]);
            setUnreadCount(prev => prev + 1);
        }
    };

    // 3. Mark specific notification as read
    const markAsRead = async (id) => {
        if (currentUser) {
            try {
                await updateDoc(doc(db, 'users', currentUser.uid, 'notifications', id), { read: true });
            } catch (e) {
                console.error("Failed to mark notification as read:", e);
            }
        } else {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    // 4. Mark all as read
    const markAllAsRead = async () => {
        if (currentUser) {
            try {
                const batch = writeBatch(db);
                notifications.filter(n => !n.read).forEach(n => {
                    batch.update(doc(db, 'users', currentUser.uid, 'notifications', n.id), { read: true });
                });
                await batch.commit();
            } catch (e) {
                console.error("Failed to mark all as read:", e);
            }
        } else {
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        }
    };

    // 5. THE MISSING FUNCTION: Clear all notifications
    const resetNotifications = async () => {
        if (currentUser) {
            try {
                const batch = writeBatch(db);
                notifications.forEach(n => {
                    batch.delete(doc(db, 'users', currentUser.uid, 'notifications', n.id));
                });
                await batch.commit();
            } catch (e) {
                console.error("Failed to clear notifications:", e);
            }
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    };

    // 6. Remove a single notification
    const removeNotification = async (id) => {
        if (currentUser) {
            try {
                await deleteDoc(doc(db, 'users', currentUser.uid, 'notifications', id));
            } catch (e) {
                console.error("Failed to delete notification:", e);
            }
        } else {
            setNotifications(prev => {
                const updated = prev.filter(n => n.id !== id);
                setUnreadCount(updated.filter(n => !n.read).length);
                return updated;
            });
        }
    };

    // 7. Schedule Dynamic Reminder (Smart System)
    const scheduleReminder = async (payload) => {
        if (!payload) return;
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: payload.title,
                    body: payload.body,
                    sound: true,
                    ...(Platform.OS === 'android' && { channelId: 'ruvo-default' }),
                },
                trigger: null,
            });
            console.log(`🔔 Scheduled: "${payload.title}"`);
        } catch (error) {
            console.log("Error scheduling notification:", error);
        }
    };

    // 8. Inactivity Check
    const checkInactivity = (lastRunDate) => {
        if (!lastRunDate) return;
        const daysSince = (Date.now() - new Date(lastRunDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 3) {
            addNotification({
                title: "Miss running? 🏃",
                desc: "You haven't logged a run in a few days. Let's get back on track!",
                type: 'system'
            });
        }
    };

    // 8. Send Club Reminder (Admin Feature)
    const sendClubReminder = (clubName, message) => {
        addNotification({
            title: `Club Update: ${clubName}`,
            desc: message,
            type: 'club_reminder'
        });
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            addNotification,
            markAsRead,
            markAllAsRead,
            resetNotifications,
            clearAll: resetNotifications, // Alias for NotificationSheet compatibility
            removeNotification,
            scheduleReminder, // <--- New Smart Scheduler
            checkInactivity,  // <--- Inactivity Logic
            sendClubReminder
        }}>
            {children}
        </NotificationContext.Provider>
    );
};