import * as Notifications from 'expo-notifications';
import React, { createContext, useContext, useEffect, useState } from 'react';

const NotificationContext = createContext();

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

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

    // 1. Setup Permissions on Mount
    useEffect(() => {
        const registerForPushNotificationsAsync = async () => {
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
    const addNotification = ({ title, desc, type, data = null }) => {
        const newNotif = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            title,
            desc,
            type, // 'achievement', 'social', 'system', 'friend_request'
            data,
            read: false,
            time: new Date().toISOString()
        };
        setNotifications(prev => [newNotif, ...prev]);
        setUnreadCount(prev => prev + 1);
    };

    // 3. Mark specific notification as read
    const markAsRead = (id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    // 4. Mark all as read
    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    // 5. THE MISSING FUNCTION: Clear all notifications
    const resetNotifications = () => {
        setNotifications([]);
        setUnreadCount(0);
    };

    // 6. Remove a single notification
    const removeNotification = (id) => {
        setNotifications(prev => {
            const updated = prev.filter(n => n.id !== id);
            setUnreadCount(updated.filter(n => !n.read).length);
            return updated;
        });
    };

    // 7. Schedule Dynamic Reminder (Smart System)
    const scheduleReminder = async ({ title, body, hour, minute, day = null }) => {
        // Cancel existing to ensure we don't duplicate
        await Notifications.cancelAllScheduledNotificationsAsync();

        const trigger = day !== null
            ? { type: 'weekly', weekday: day, hour, minute } // Specific day
            : { type: 'daily', hour, minute };               // Daily repeat

        try {
            await Notifications.scheduleNotificationAsync({
                content: { title, body, sound: true },
                trigger,
            });
            console.log(`🔔 Scheduled: "${title}" at ${hour}:${minute}`);
        } catch (error) {
            console.log("Error scheduling notification:", error);
        }
    };

    // 8. Inactivity Check (Called on App Mount)
    const checkInactivity = async (lastRunDate) => {
        if (!lastRunDate) return;

        const diffTime = Math.abs(new Date() - new Date(lastRunDate));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 3) {
            // If inactive for 3+ days, schedule a nudge for tomorrow morning
            await scheduleReminder({
                title: "We miss you! 👟",
                body: "It's been a few days. Let's get back on track with a short run!",
                hour: 9,
                minute: 0
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
            removeNotification,
            scheduleReminder, // <--- New Smart Scheduler
            checkInactivity,  // <--- Inactivity Logic
            sendClubReminder
        }}>
            {children}
        </NotificationContext.Provider>
    );
};