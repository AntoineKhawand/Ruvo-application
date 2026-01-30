import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Dimensions, FlatList, Modal, Platform, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useNotifications } from '../context/NotificationContext';
import { useUser } from '../context/UserContext';
import DateTimePicker from '@react-native-community/datetimepicker';

const COLORS = {
    accent: "#B2FF59", 
    secondary: "#1C1C1E",
    text: "#FFFFFF",
    subText: "#888888",
    danger: "#FF3B30",
};

const { height } = Dimensions.get('window');

// Helper for nice date formatting
const formatNotificationTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function NotificationSheet({ visible, onClose }) {
    const { notifications, clearAll, removeNotification, markAsRead } = useNotifications();
    const { followUser } = useUser();
    
    // Date Filter State
    const [filterDate, setFilterDate] = useState(null);
    const [tempDate, setTempDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    const filteredNotifications = useMemo(() => {
        if (!filterDate) return notifications;
        return notifications.filter(n => {
            const nDate = new Date(n.time);
            return nDate.getDate() === filterDate.getDate() &&
                   nDate.getMonth() === filterDate.getMonth() &&
                   nDate.getFullYear() === filterDate.getFullYear();
        });
    }, [notifications, filterDate]);

    const openDatePicker = () => {
        setTempDate(filterDate || new Date());
        setShowDatePicker(true);
    };

    const handleDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
            if (selectedDate) setFilterDate(selectedDate);
        } else {
            if (selectedDate) setTempDate(selectedDate);
        }
    };

    const confirmDate = () => {
        setFilterDate(tempDate);
        setShowDatePicker(false);
    };

    // --- HANDLE ACCEPT ---
    const handleAccept = (notification) => {
        if (notification.data && notification.data.userId) {
            followUser(notification.data.userId, { 
                id: notification.data.userId, 
                name: notification.data.userName || "New Friend",
                avatar: 'https://randomuser.me/api/portraits/women/44.jpg' 
            });
        }
        removeNotification(notification.id);
    };

    // --- HANDLE DECLINE ---
    const handleDecline = (id) => {
        removeNotification(id);
    };

    // --- ICON HELPER ---
    const getIconProps = (type) => {
        switch (type) {
            case 'friend_request': return { name: 'person-add', color: '#4FC3F7', bg: 'rgba(79, 195, 247, 0.1)' };
            case 'new_connection': return { name: 'person-add', color: '#4FC3F7', bg: 'rgba(79, 195, 247, 0.1)' };
            case 'mention': return { name: 'at', color: '#E040FB', bg: 'rgba(224, 64, 251, 0.1)' };
            case 'cheer_up': return { name: 'thumbs-up', color: '#B2FF59', bg: 'rgba(178, 255, 89, 0.1)' };
            case 'comment': return { name: 'chatbubble-ellipses', color: '#FFF', bg: 'rgba(255, 255, 255, 0.1)' };
            case 'like': return { name: 'heart', color: '#FF4081', bg: 'rgba(255, 64, 129, 0.1)' };
            case 'club_reminder': return { name: 'megaphone', color: '#FFD700', bg: 'rgba(255, 215, 0, 0.1)' };
            case 'achievement': return { name: 'trophy', color: '#FFD700', bg: 'rgba(255, 215, 0, 0.1)' };
            case 'alert': return { name: 'alert-circle', color: COLORS.danger, bg: 'rgba(255, 59, 48, 0.1)' };
            default: return { name: 'notifications', color: COLORS.accent, bg: 'rgba(178, 255, 89, 0.1)' };
        }
    };

    const renderItem = ({ item }) => {
        const isUnread = !item.read;
        const iconProps = getIconProps(item.type);
        
        return (
            <TouchableOpacity 
                activeOpacity={0.9}
                style={[styles.itemContainer, isUnread && styles.unreadItem]}
                onPress={() => markAsRead(item.id)}
            >
                <View style={[styles.iconCircle, { backgroundColor: iconProps.bg }]}>
                    <Ionicons 
                        name={iconProps.name} 
                        size={20} 
                        color={isUnread ? iconProps.color : '#888'} 
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                        <Text style={[styles.itemTitle, isUnread && styles.unreadTitle]}>{item.title}</Text>
                        <Text style={[styles.itemTime, isUnread && { color: COLORS.accent }]}>{formatNotificationTime(item.time)}</Text>
                    </View>
                    <Text style={[styles.itemDesc, !isUnread && { color: '#666' }]}>{item.desc}</Text>
                    
                    {/* --- ACCEPT / DECLINE BUTTONS --- */}
                    {item.type === 'friend_request' && (
                        <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item)}>
                                <Text style={styles.acceptText}>Accept</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(item.id)}>
                                <Text style={styles.declineText}>Decline</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableWithoutFeedback>
                    <View style={styles.sheetContainer}>
                        <View style={styles.header}>
                            <Text style={styles.title}>Notifications</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TouchableOpacity onPress={openDatePicker} style={styles.filterBtn}>
                                    <Ionicons name={filterDate ? "calendar" : "calendar-outline"} size={20} color={filterDate ? COLORS.accent : COLORS.subText} />
                                    {filterDate && <Text style={styles.filterDateText}>{filterDate.toLocaleDateString([], { month:'short', day:'numeric' })}</Text>}
                                </TouchableOpacity>
                                {filterDate && (
                                    <TouchableOpacity onPress={() => setFilterDate(null)} style={{ marginLeft: 10 }}>
                                        <Ionicons name="close-circle" size={20} color="#666" />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={clearAll} disabled={notifications.length === 0} style={{ marginLeft: 20 }}>
                                    <Text style={[styles.clearText, { opacity: notifications.length === 0 ? 0.5 : 1 }]}>
                                        Clear all
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <FlatList
                            data={filteredNotifications}
                            keyExtractor={item => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <Ionicons name="notifications-off-outline" size={40} color="#333" />
                                    <Text style={styles.emptyText}>No notifications found</Text>
                                </View>
                            }
                        />

                        {showDatePicker && (
                            <Modal transparent={true} animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
                                <View style={styles.datePickerOverlay}>
                                    <View style={styles.datePickerContainer}>
                                        <Text style={styles.datePickerTitle}>Filter by Date</Text>
                                        <DateTimePicker
                                            value={tempDate}
                                            mode="date"
                                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                            onChange={handleDateChange}
                                            maximumDate={new Date()}
                                            themeVariant="dark"
                                            textColor="#FFFFFF" 
                                        />
                                        {Platform.OS === 'ios' && (
                                            <View style={styles.datePickerButtons}>
                                                <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.datePickerCancelBtn}>
                                                    <Text style={styles.datePickerCancelText}>Cancel</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={confirmDate} style={styles.datePickerDoneBtn}>
                                                    <Text style={styles.datePickerDoneText}>Done</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </Modal>
                        )}
                    </View>
                </TouchableWithoutFeedback>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheetContainer: { height: height * 0.7, backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
    title: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    clearText: { color: COLORS.subText, fontSize: 14 },
    listContent: { padding: 20 },
    itemContainer: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, padding: 10, borderRadius: 12 },
    unreadItem: { backgroundColor: 'rgba(178, 255, 89, 0.05)' },
    iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15, marginTop: 2 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    itemTitle: { color: '#CCC', fontSize: 14, fontWeight: '500', flex: 1, marginRight: 10 },
    unreadTitle: { color: '#FFF', fontWeight: 'bold' },
    itemDesc: { color: COLORS.subText, fontSize: 12, lineHeight: 18 },
    itemTime: { color: '#666', fontSize: 10 },
    emptyState: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#666', marginTop: 10 },
    actionRow: { flexDirection: 'row', marginTop: 10 },
    acceptBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 15, paddingVertical: 6, borderRadius: 15, marginRight: 10 },
    acceptText: { color: '#000', fontSize: 12, fontWeight: 'bold' },
    declineBtn: { backgroundColor: '#333', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 15 },
    declineText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
    filterBtn: { flexDirection: 'row', alignItems: 'center' },
    filterDateText: { color: COLORS.accent, fontSize: 12, marginLeft: 5, fontWeight: 'bold' },
    
    // Date Picker Styles
    datePickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
    datePickerContainer: { backgroundColor: '#1C1C1E', borderRadius: 20, padding: 20, alignItems: 'center', width: 320 },
    datePickerTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 10, letterSpacing: 0.5 },
    datePickerButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 },
    datePickerCancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, marginRight: 10, backgroundColor: '#333', borderRadius: 12 },
    datePickerCancelText: { color: '#FFF', fontWeight: '600' },
    datePickerDoneBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, marginLeft: 10, backgroundColor: COLORS.accent, borderRadius: 12 },
    datePickerDoneText: { color: '#000', fontWeight: 'bold' }
});