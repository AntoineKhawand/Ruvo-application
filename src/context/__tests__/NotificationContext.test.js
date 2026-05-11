/**
 * @jest-environment jsdom
 * 
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

// --- MOCK REACT NATIVE (must come before component imports) ---
jest.mock('react-native', () => ({
    Platform: { OS: 'ios' },
    Alert: { alert: jest.fn() },
}));

// --- MOCK FIREBASE (must come before component imports) ---
jest.mock('../../config/firebase', () => ({
    auth: {},
    db: {},
}));

jest.mock('firebase/auth', () => ({
    onAuthStateChanged: jest.fn(() => jest.fn()),
}));

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    deleteDoc: jest.fn(),
    doc: jest.fn(),
    limit: jest.fn(),
    onSnapshot: jest.fn(() => jest.fn()),
    orderBy: jest.fn(),
    query: jest.fn(),
    setDoc: jest.fn(),
    updateDoc: jest.fn(),
    writeBatch: jest.fn(() => ({ update: jest.fn(), delete: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) })),
}));

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

// --- IMPORT REACT + REACT-DOM for React 19 compatible hook testing ---
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react');

// --- IMPORT CONTEXT ---
const { NotificationProvider, useNotifications } = require('../NotificationContext');

// --- HOOK TESTING HELPERS ---
// React 19 requires createRoot instead of ReactDOM.render
let _hookResult = null;
let _root = null;
let _container = null;

function TestConsumer() {
    _hookResult = useNotifications();
    return null;
}

function renderWithProvider() {
    _hookResult = null;
    _container = document.createElement('div');
    document.body.appendChild(_container);
    _root = createRoot(_container);

    act(() => {
        _root.render(
            React.createElement(NotificationProvider, null,
                React.createElement(TestConsumer)
            )
        );
    });

    return {
        get current() { return _hookResult; },
        unmount() {
            act(() => { _root.unmount(); });
            document.body.removeChild(_container);
        }
    };
}

describe('NotificationContext', () => {
    let rendered;
    let nowSpy;
    let realNow = new Date().getTime();

    beforeEach(() => {
        // Ensure Date.now() returns unique values for IDs in tests executing within the same millisecond
        // while remaining close to the actual real-world timestamp so interval math works!
        nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
            realNow += 1;
            return realNow;
        });
    });

    afterEach(() => {
        nowSpy.mockRestore();
        if (rendered) {
            try { rendered.unmount(); } catch (e) { /* already unmounted */ }
            rendered = null;
        }
        jest.clearAllMocks();
        _hookResult = null;
    });

    describe('addNotification', () => {
        it('should add a notification and increment unread count', () => {
            rendered = renderWithProvider();

            act(() => {
                rendered.current.addNotification({
                    title: 'New Badge!',
                    desc: 'You earned First Steps',
                    type: 'achievement',
                });
            });

            expect(rendered.current.notifications).toHaveLength(1);
            expect(rendered.current.notifications[0].title).toBe('New Badge!');
            expect(rendered.current.notifications[0].read).toBe(false);
            expect(rendered.current.unreadCount).toBe(1);
        });

        it('should prepend new notifications (newest first)', () => {
            rendered = renderWithProvider();

            act(() => {
                rendered.current.addNotification({ title: 'First', desc: '', type: 'system' });
            });
            act(() => {
                rendered.current.addNotification({ title: 'Second', desc: '', type: 'system' });
            });

            expect(rendered.current.notifications[0].title).toBe('Second');
            expect(rendered.current.notifications[1].title).toBe('First');
            expect(rendered.current.unreadCount).toBe(2);
        });

        it('should generate unique IDs for each notification', () => {
            rendered = renderWithProvider();

            act(() => {
                rendered.current.addNotification({ title: 'A', desc: '', type: 'system' });
            });
            act(() => {
                rendered.current.addNotification({ title: 'B', desc: '', type: 'system' });
            });

            const ids = rendered.current.notifications.map(n => n.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('should include correct notification fields', () => {
            rendered = renderWithProvider();

            act(() => {
                rendered.current.addNotification({
                    title: 'Test',
                    desc: 'Description',
                    type: 'achievement',
                    data: { badgeId: 'b_5k' },
                });
            });

            const notif = rendered.current.notifications[0];
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
            rendered = renderWithProvider();

            act(() => {
                rendered.current.addNotification({ title: 'Test', desc: '', type: 'system' });
            });

            const id = rendered.current.notifications[0].id;

            act(() => {
                rendered.current.markAsRead(id);
            });

            expect(rendered.current.notifications[0].read).toBe(true);
            expect(rendered.current.unreadCount).toBe(0);
        });

        it('should not go below 0 unread count', () => {
            rendered = renderWithProvider();

            act(() => {
                rendered.current.addNotification({ title: 'Test', desc: '', type: 'system' });
            });

            const id = rendered.current.notifications[0].id;

            act(() => {
                rendered.current.markAsRead(id);
            });
            act(() => {
                rendered.current.markAsRead(id);
            });

            expect(rendered.current.unreadCount).toBe(0);
        });
    });

    describe('markAllAsRead', () => {
        it('should mark all notifications as read and reset count', () => {
            rendered = renderWithProvider();

            act(() => {
                rendered.current.addNotification({ title: 'A', desc: '', type: 'system' });
            });
            act(() => {
                rendered.current.addNotification({ title: 'B', desc: '', type: 'system' });
            });
            act(() => {
                rendered.current.addNotification({ title: 'C', desc: '', type: 'system' });
            });

            act(() => {
                rendered.current.markAllAsRead();
            });

            expect(rendered.current.notifications.every(n => n.read)).toBe(true);
            expect(rendered.current.unreadCount).toBe(0);
        });
    });

    describe('resetNotifications / clearAll', () => {
        it('should clear all notifications', () => {
            rendered = renderWithProvider();

            act(() => {
                rendered.current.addNotification({ title: 'A', desc: '', type: 'system' });
            });
            act(() => {
                rendered.current.addNotification({ title: 'B', desc: '', type: 'system' });
            });

            act(() => {
                rendered.current.resetNotifications();
            });

            expect(rendered.current.notifications).toHaveLength(0);
            expect(rendered.current.unreadCount).toBe(0);
        });

        it('should expose clearAll as alias for resetNotifications', () => {
            rendered = renderWithProvider();

            expect(rendered.current.clearAll).toBeDefined();
            expect(typeof rendered.current.clearAll).toBe('function');
        });
    });

    describe('removeNotification', () => {
        it('should remove a specific notification by ID', () => {
            rendered = renderWithProvider();

            act(() => {
                rendered.current.addNotification({ title: 'Keep', desc: '', type: 'system' });
            });
            act(() => {
                rendered.current.addNotification({ title: 'Remove', desc: '', type: 'system' });
            });

            const removeId = rendered.current.notifications.find(n => n.title === 'Remove').id;

            act(() => {
                rendered.current.removeNotification(removeId);
            });

            expect(rendered.current.notifications).toHaveLength(1);
            expect(rendered.current.notifications[0].title).toBe('Keep');
        });

        it('should update unread count when removing unread notification', () => {
            rendered = renderWithProvider();

            act(() => {
                rendered.current.addNotification({ title: 'Test', desc: '', type: 'system' });
            });

            expect(rendered.current.unreadCount).toBe(1);

            const id = rendered.current.notifications[0].id;

            act(() => {
                rendered.current.removeNotification(id);
            });

            expect(rendered.current.unreadCount).toBe(0);
        });
    });

    describe('sendClubReminder', () => {
        it('should create a club_reminder notification', () => {
            rendered = renderWithProvider();

            act(() => {
                rendered.current.sendClubReminder('NRC Beirut', 'Run tonight at 7 PM!');
            });

            expect(rendered.current.notifications[0].title).toBe('Club Update: NRC Beirut');
            expect(rendered.current.notifications[0].desc).toBe('Run tonight at 7 PM!');
            expect(rendered.current.notifications[0].type).toBe('club_reminder');
        });
    });

    describe('scheduleReminder', () => {
        it('should schedule a notification', async () => {
            rendered = renderWithProvider();

            await act(async () => {
                await rendered.current.scheduleReminder({
                    title: 'Morning Run',
                    body: 'Time to hit the road!',
                    hour: 7,
                    minute: 0,
                });
            });

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
        it('should add nudge notification when inactive for 3+ days', () => {
            rendered = renderWithProvider();

            const fourDaysAgo = new Date();
            fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

            act(() => {
                rendered.current.checkInactivity(fourDaysAgo.toISOString());
            });

            expect(rendered.current.notifications.length).toBeGreaterThan(0);
            expect(rendered.current.notifications[0].title).toContain('running');
        });

        it('should NOT add nudge when recently active', () => {
            rendered = renderWithProvider();

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            act(() => {
                rendered.current.checkInactivity(yesterday.toISOString());
            });

            expect(rendered.current.notifications).toHaveLength(0);
        });

        it('should do nothing when lastRunDate is null', () => {
            rendered = renderWithProvider();

            act(() => {
                rendered.current.checkInactivity(null);
            });

            expect(rendered.current.notifications).toHaveLength(0);
        });
    });

    describe('context value shape', () => {
        it('should expose all expected functions', () => {
            rendered = renderWithProvider();

            expect(rendered.current).toHaveProperty('notifications');
            expect(rendered.current).toHaveProperty('unreadCount');
            expect(rendered.current).toHaveProperty('addNotification');
            expect(rendered.current).toHaveProperty('markAsRead');
            expect(rendered.current).toHaveProperty('markAllAsRead');
            expect(rendered.current).toHaveProperty('resetNotifications');
            expect(rendered.current).toHaveProperty('clearAll');
            expect(rendered.current).toHaveProperty('removeNotification');
            expect(rendered.current).toHaveProperty('scheduleReminder');
            expect(rendered.current).toHaveProperty('checkInactivity');
            expect(rendered.current).toHaveProperty('sendClubReminder');
        });
    });
});
