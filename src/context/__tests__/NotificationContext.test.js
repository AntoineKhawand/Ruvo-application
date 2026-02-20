/**
 * Unit Tests for NotificationContext.js
 *
 * Tests notification state management:
 * - Adding notifications
 * - Marking as read (single / all)
 * - Removing / clearing notifications
 * - Unread count tracking
 * - Inactivity checker logic
 * - Schedule reminder calls
 * - Club reminder dispatching
 */


// Configure act() environment
global.IS_REACT_ACT_ENVIRONMENT = true;

// --- MOCK EXPO NOTIFICATIONS ---
const mockScheduleNotificationAsync = jest.fn().mockResolvedValue(undefined);
const mockCancelAllScheduledNotificationsAsync = jest.fn().mockResolvedValue(undefined);
const mockGetPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockRequestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockAddNotificationReceivedListener = jest.fn(() => ({ remove: jest.fn() }));

jest.mock('expo-notifications', () => ({
    setNotificationHandler: jest.fn(),
    getPermissionsAsync: (...args) => mockGetPermissionsAsync(...args),
    requestPermissionsAsync: (...args) => mockRequestPermissionsAsync(...args),
    addNotificationReceivedListener: (...args) => mockAddNotificationReceivedListener(...args),
    scheduleNotificationAsync: (...args) => mockScheduleNotificationAsync(...args),
    cancelAllScheduledNotificationsAsync: (...args) => mockCancelAllScheduledNotificationsAsync(...args),
}));

// --- IMPORT TESTING UTILITIES ---
const { renderHook, act } = require('@testing-library/react-hooks');

// --- IMPORT CONTEXT ---
const { NotificationProvider, useNotifications } = require('../NotificationContext');

const wrapper = ({ children }) => (
    <NotificationProvider>{children}</NotificationProvider>
);

describe('NotificationContext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('addNotification', () => {
        it('should add a notification and increment unread count', () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            act(() => {
                result.current.addNotification({
                    title: 'New Badge!',
                    desc: 'You earned First Steps',
                    type: 'achievement',
                });
            });

            expect(result.current.notifications).toHaveLength(1);
            expect(result.current.notifications[0].title).toBe('New Badge!');
            expect(result.current.notifications[0].read).toBe(false);
            expect(result.current.unreadCount).toBe(1);
        });

        it('should prepend new notifications (newest first)', () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            act(() => {
                result.current.addNotification({ title: 'First', desc: '', type: 'system' });
            });
            act(() => {
                result.current.addNotification({ title: 'Second', desc: '', type: 'system' });
            });

            expect(result.current.notifications[0].title).toBe('Second');
            expect(result.current.notifications[1].title).toBe('First');
            expect(result.current.unreadCount).toBe(2);
        });

        it('should generate unique IDs for each notification', () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            act(() => {
                result.current.addNotification({ title: 'A', desc: '', type: 'system' });
            });
            act(() => {
                result.current.addNotification({ title: 'B', desc: '', type: 'system' });
            });

            const ids = result.current.notifications.map(n => n.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('should include correct notification fields', () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            act(() => {
                result.current.addNotification({
                    title: 'Test',
                    desc: 'Description',
                    type: 'achievement',
                    data: { badgeId: 'b_5k' },
                });
            });

            const notif = result.current.notifications[0];
            expect(notif).toHaveProperty('id');
            expect(notif).toHaveProperty('title', 'Test');
            expect(notif).toHaveProperty('desc', 'Description');
            expect(notif).toHaveProperty('type', 'achievement');
            expect(notif).toHaveProperty('data', { badgeId: 'b_5k' });
            expect(notif).toHaveProperty('read', false);
            expect(notif).toHaveProperty('time');
        });
    });

    describe('markAsRead', () => {
        it('should mark a specific notification as read', () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            act(() => {
                result.current.addNotification({ title: 'Test', desc: '', type: 'system' });
            });

            const id = result.current.notifications[0].id;

            act(() => {
                result.current.markAsRead(id);
            });

            expect(result.current.notifications[0].read).toBe(true);
            expect(result.current.unreadCount).toBe(0);
        });

        it('should not go below 0 unread count', () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            act(() => {
                result.current.addNotification({ title: 'Test', desc: '', type: 'system' });
            });

            const id = result.current.notifications[0].id;

            act(() => {
                result.current.markAsRead(id);
            });
            act(() => {
                result.current.markAsRead(id);
            });

            expect(result.current.unreadCount).toBe(0);
        });
    });

    describe('markAllAsRead', () => {
        it('should mark all notifications as read and reset count', () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            act(() => {
                result.current.addNotification({ title: 'A', desc: '', type: 'system' });
            });
            act(() => {
                result.current.addNotification({ title: 'B', desc: '', type: 'system' });
            });
            act(() => {
                result.current.addNotification({ title: 'C', desc: '', type: 'system' });
            });

            act(() => {
                result.current.markAllAsRead();
            });

            expect(result.current.notifications.every(n => n.read)).toBe(true);
            expect(result.current.unreadCount).toBe(0);
        });
    });

    describe('resetNotifications / clearAll', () => {
        it('should clear all notifications', () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            act(() => {
                result.current.addNotification({ title: 'A', desc: '', type: 'system' });
            });
            act(() => {
                result.current.addNotification({ title: 'B', desc: '', type: 'system' });
            });

            act(() => {
                result.current.resetNotifications();
            });

            expect(result.current.notifications).toHaveLength(0);
            expect(result.current.unreadCount).toBe(0);
        });

        it('should expose clearAll as alias for resetNotifications', () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            expect(result.current.clearAll).toBeDefined();
            expect(typeof result.current.clearAll).toBe('function');
        });
    });

    describe('removeNotification', () => {
        it('should remove a specific notification by ID', () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            act(() => {
                result.current.addNotification({ title: 'Keep', desc: '', type: 'system' });
            });
            act(() => {
                result.current.addNotification({ title: 'Remove', desc: '', type: 'system' });
            });

            const removeId = result.current.notifications.find(n => n.title === 'Remove').id;

            act(() => {
                result.current.removeNotification(removeId);
            });

            expect(result.current.notifications).toHaveLength(1);
            expect(result.current.notifications[0].title).toBe('Keep');
        });

        it('should update unread count when removing unread notification', () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            act(() => {
                result.current.addNotification({ title: 'Test', desc: '', type: 'system' });
            });

            expect(result.current.unreadCount).toBe(1);

            const id = result.current.notifications[0].id;

            act(() => {
                result.current.removeNotification(id);
            });

            expect(result.current.unreadCount).toBe(0);
        });
    });

    describe('sendClubReminder', () => {
        it('should create a club_reminder notification', () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            act(() => {
                result.current.sendClubReminder('NRC Beirut', 'Run tonight at 7 PM!');
            });

            expect(result.current.notifications[0].title).toBe('Club Update: NRC Beirut');
            expect(result.current.notifications[0].desc).toBe('Run tonight at 7 PM!');
            expect(result.current.notifications[0].type).toBe('club_reminder');
        });
    });

    describe('scheduleReminder', () => {
        it('should cancel existing and schedule new notification', async () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            await act(async () => {
                await result.current.scheduleReminder({
                    title: 'Morning Run',
                    body: 'Time to hit the road!',
                    hour: 7,
                    minute: 0,
                });
            });

            expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalled();
            expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.objectContaining({
                        title: 'Morning Run',
                        body: 'Time to hit the road!',
                    }),
                })
            );
        });
    });

    describe('checkInactivity', () => {
        it('should schedule nudge when inactive for 3+ days', async () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            const fourDaysAgo = new Date();
            fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

            await act(async () => {
                await result.current.checkInactivity(fourDaysAgo.toISOString());
            });

            expect(mockScheduleNotificationAsync).toHaveBeenCalled();
        });

        it('should NOT schedule nudge when recently active', async () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            await act(async () => {
                await result.current.checkInactivity(yesterday.toISOString());
            });

            expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
        });

        it('should do nothing when lastRunDate is null', async () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            await act(async () => {
                await result.current.checkInactivity(null);
            });

            expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
        });
    });

    describe('context value shape', () => {
        it('should expose all expected functions', () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            expect(result.current).toHaveProperty('notifications');
            expect(result.current).toHaveProperty('unreadCount');
            expect(result.current).toHaveProperty('addNotification');
            expect(result.current).toHaveProperty('markAsRead');
            expect(result.current).toHaveProperty('markAllAsRead');
            expect(result.current).toHaveProperty('resetNotifications');
            expect(result.current).toHaveProperty('clearAll');
            expect(result.current).toHaveProperty('removeNotification');
            expect(result.current).toHaveProperty('scheduleReminder');
            expect(result.current).toHaveProperty('checkInactivity');
            expect(result.current).toHaveProperty('sendClubReminder');
        });
    });
});
