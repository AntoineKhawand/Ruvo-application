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

    // 7. Schedule Smart Run Reminders (Called from UserContext or Home)
    const checkRunReminders = async (preferences, isEnabled = true) => {
        // Always cancel existing first to avoid duplicates or to silence if disabled
        await Notifications.cancelAllScheduledNotificationsAsync();

        if (!isEnabled) {
            console.log("🔕 Run reminders disabled by user.");
            return;
        }

        if (!preferences || !preferences.preferredTime) return;

        const timeMap = {
            'morning': 7,   // 7:00 AM
            'afternoon': 14, // 2:00 PM
            'evening': 18,  // 6:00 PM
            'night': 20     // 8:00 PM
        };

        const hour = timeMap[preferences.preferredTime] || 18; // Default to 6 PM

        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "Time to Run! 🏃",
                    body: `It's your preferred ${preferences.preferredTime} run time. Let's go!`,
                    sound: true,
                },
                trigger: {
                    type: 'calendar',
                    hour: hour,
                    minute: 0,
                    repeats: true,
                },
            });
            console.log(`🔔 Scheduled daily run reminder for ${hour}:00`);
        } catch (error) {
            console.log("Error scheduling notification:", error);
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
            checkRunReminders,
            sendClubReminder // <--- EXPORTED NEW FUNCTION
        }}>
            {children}
        </NotificationContext.Provider>
    );
};