import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants/legacy-theme.js';
import { useNotifications } from '../context/NotificationContext';

export default function NotificationBell({ onPress }) {
    const { unreadCount } = useNotifications();

    return (
        <TouchableOpacity onPress={onPress} style={styles.container}>
            <Ionicons name="notifications-outline" size={24} color="#FFF" />
            
            {/* The Red Dot Badge */}
            {unreadCount > 0 && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        padding: 5,
    },
    badge: {
        position: 'absolute',
        top: 2,
        right: 4,
        backgroundColor: '#FF3B30', // Standard Red
        width: 16,
        height: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#000', // Matches background for a cutout effect
    },
    badgeText: {
        color: '#FFF',
        fontSize: 9,
        fontWeight: 'bold',
    },
});
