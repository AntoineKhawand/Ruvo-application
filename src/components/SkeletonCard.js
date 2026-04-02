import React from 'react';
import { StyleSheet, View } from 'react-native';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';

const COLORS = {
    bone: '#1C1C1E',
    highlight: '#2A2A2A',
    background: '#000',
};

/**
 * Generic skeleton card shimmer matching Ruvo's dark theme.
 * @param {'card' | 'row' | 'profile' | 'chart'} variant 
 */
export default function SkeletonCard({ variant = 'card', count = 1 }) {
    const items = Array.from({ length: count });

    if (variant === 'profile') {
        return (
            <SkeletonPlaceholder
                backgroundColor={COLORS.bone}
                highlightColor={COLORS.highlight}
                borderRadius={16}
            >
                <View style={{ alignItems: 'center', padding: 20 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40 }} />
                    <View style={{ width: 140, height: 18, marginTop: 16, borderRadius: 8 }} />
                    <View style={{ width: 100, height: 14, marginTop: 8, borderRadius: 6 }} />
                    <View style={s.statsRow}>
                        <View style={{ width: 60, height: 40, borderRadius: 10 }} />
                        <View style={{ width: 60, height: 40, borderRadius: 10 }} />
                        <View style={{ width: 60, height: 40, borderRadius: 10 }} />
                    </View>
                </View>
            </SkeletonPlaceholder>
        );
    }

    if (variant === 'chart') {
        return (
            <SkeletonPlaceholder
                backgroundColor={COLORS.bone}
                highlightColor={COLORS.highlight}
                borderRadius={16}
            >
                <View style={{ padding: 20 }}>
                    <View style={{ width: 120, height: 16, borderRadius: 8, marginBottom: 20 }} />
                    <View style={{ width: '100%', height: 180, borderRadius: 16 }} />
                </View>
            </SkeletonPlaceholder>
        );
    }

    if (variant === 'row') {
        return items.map((_, i) => (
            <SkeletonPlaceholder
                key={i}
                backgroundColor={COLORS.bone}
                highlightColor={COLORS.highlight}
                borderRadius={16}
            >
                <View style={s.rowContainer}>
                    <View style={{ width: 40, height: 40, borderRadius: 20 }} />
                    <View style={{ marginLeft: 15, flex: 1 }}>
                        <View style={{ width: '70%', height: 14, borderRadius: 6 }} />
                        <View style={{ width: '45%', height: 12, marginTop: 6, borderRadius: 6 }} />
                    </View>
                </View>
            </SkeletonPlaceholder>
        ));
    }

    // 'post' variant — mimics a feed/post card (avatar + text + image + action bar)
    if (variant === 'post') {
        return items.map((_, i) => (
            <SkeletonPlaceholder
                key={i}
                backgroundColor={COLORS.bone}
                highlightColor={COLORS.highlight}
                borderRadius={16}
            >
                <View style={{ padding: 15, marginBottom: 20 }}>
                    {/* Header: avatar + name + time */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20 }} />
                        <View style={{ marginLeft: 12 }}>
                            <View style={{ width: 120, height: 14, borderRadius: 6 }} />
                            <View style={{ width: 60, height: 10, marginTop: 6, borderRadius: 4 }} />
                        </View>
                    </View>
                    {/* Title text */}
                    <View style={{ width: '90%', height: 14, borderRadius: 6, marginBottom: 10 }} />
                    {/* Stats row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 }}>
                        <View style={{ width: 60, height: 30, borderRadius: 8 }} />
                        <View style={{ width: 60, height: 30, borderRadius: 8 }} />
                        <View style={{ width: 60, height: 30, borderRadius: 8 }} />
                    </View>
                    {/* Map placeholder */}
                    <View style={{ width: '100%', height: 140, borderRadius: 12, marginBottom: 12 }} />
                    {/* Action bar */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={{ width: 60, height: 16, borderRadius: 8 }} />
                        <View style={{ width: 60, height: 16, borderRadius: 8 }} />
                        <View style={{ width: 60, height: 16, borderRadius: 8 }} />
                    </View>
                </View>
            </SkeletonPlaceholder>
        ));
    }

    // 'chat' variant — mimics AI coach chat bubbles
    if (variant === 'chat') {
        return (
            <SkeletonPlaceholder
                backgroundColor={COLORS.bone}
                highlightColor={COLORS.highlight}
                borderRadius={16}
            >
                <View style={{ padding: 15 }}>
                    {/* AI response (left-aligned) */}
                    <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8 }} />
                        <View style={{ width: '70%' }}>
                            <View style={{ width: '100%', height: 60, borderRadius: 16, borderTopLeftRadius: 4 }} />
                        </View>
                    </View>
                    {/* User message (right-aligned) */}
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 20 }}>
                        <View style={{ width: '50%', height: 36, borderRadius: 16, borderBottomRightRadius: 4 }} />
                    </View>
                    {/* AI typing indicator */}
                    <View style={{ flexDirection: 'row' }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8 }} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4 }} />
                            <View style={{ width: 8, height: 8, borderRadius: 4 }} />
                            <View style={{ width: 8, height: 8, borderRadius: 4 }} />
                        </View>
                    </View>
                </View>
            </SkeletonPlaceholder>
        );
    }

    // Default 'card' variant
    return items.map((_, i) => (
        <SkeletonPlaceholder
            key={i}
            backgroundColor={COLORS.bone}
            highlightColor={COLORS.highlight}
            borderRadius={16}
        >
            <View style={s.cardContainer}>
                <View style={{ width: 44, height: 44, borderRadius: 12 }} />
                <View style={{ marginLeft: 15, flex: 1 }}>
                    <View style={{ width: '80%', height: 16, borderRadius: 8 }} />
                    <View style={{ width: '55%', height: 12, marginTop: 8, borderRadius: 6 }} />
                </View>
            </View>
        </SkeletonPlaceholder>
    ));
}

const s = StyleSheet.create({
    cardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginBottom: 12,
        borderRadius: 16,
    },
    rowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        marginBottom: 10,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginTop: 20,
    },
});
