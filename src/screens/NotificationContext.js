import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { createContext, useContext, useEffect, useState } from 'react';

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

// --- CONFIGURATION UPDATE ---
// "shouldShowAlert: false" means NO banner when app is open.
// Background notifications will still appear automatically.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // <--- CHANGED TO FALSE
    shouldPlaySound: true,  // You can keep sound if you want a subtle alert
    shouldSetBadge: false,
  }),
});

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]); 

    // --- LOAD SAVED NOTIFICATIONS ---
    useEffect(() => {
        const loadNotifs = async () => {
            try {
                const saved = await AsyncStorage.getItem('@ruvo_notifications_v4');
                if (saved) setNotifications(JSON.parse(saved));
            } catch (e) { console.error("Failed to load notifications", e); }
        };
        loadNotifs();
    }, []);

    // --- SAVE NOTIFICATIONS ---
    useEffect(() => {
        const saveNotifs = async () => {
            try {
                await AsyncStorage.setItem('@ruvo_notifications_v4', JSON.stringify(notifications));
            } catch (e) { console.error("Failed to save notifications", e); }
        };
        saveNotifs();
    }, [notifications]);

    const unreadCount = notifications.filter(n => !n.read).length;

    // --- ADD NOTIFICATION ---
    const addNotification = async (notif) => {
        // 1. Add to App State (Red Dot updates instantly)
        const newNotif = {
            id: Date.now().toString() + Math.random().toString(),
            date: new Date(),
            read: false,
            type: 'system', 
            ...notif
        };
        setNotifications(prev => [newNotif, ...prev]);

        // 2. Trigger System Notification
        // If App is OPEN: Handler prevents banner (Professional behavior).
        // If App is CLOSED: System shows banner automatically.
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: notif.title,
                    body: notif.desc, 
                    sound: true,
                    data: { internalId: newNotif.id }
                },
                trigger: null, 
            });
        } catch (error) {
            console.log("Error sending push notification:", error);
        }
    };

    const markAsRead = (id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const checkRunReminders = (schedule) => {
        // Placeholder logic
    };

    return (
        <NotificationContext.Provider value={{ 
            notifications, 
            unreadCount, 
            addNotification, 
            markAsRead, 
            markAllAsRead,
            checkRunReminders
        }}>
            {children}
        </NotificationContext.Provider>
    );
};