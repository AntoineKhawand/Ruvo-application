import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import ShimmerPlaceholder from 'react-native-shimmer-placeholder';

const Shimmer = (props) => (
    <ShimmerPlaceholder
        LinearGradient={LinearGradient}
        shimmerColors={['#1C1C1E', '#2A2A2A', '#1C1C1E']}
        {...props}
    />
);

export default function SkeletonCard({ variant = 'card', count = 1 }) {
    const items = Array.from({ length: count });

    if (variant === 'profile') {
        return (
            <View style={{ alignItems: 'center', padding: 20 }}>
                <Shimmer style={{ width: 80, height: 80, borderRadius: 40 }} />
                <Shimmer style={{ width: 140, height: 18, marginTop: 16, borderRadius: 8 }} />
                <Shimmer style={{ width: 100, height: 14, marginTop: 8, borderRadius: 6 }} />
                <View style={s.statsRow}>
                    <Shimmer style={{ width: 60, height: 40, borderRadius: 10 }} />
                    <Shimmer style={{ width: 60, height: 40, borderRadius: 10 }} />
                    <Shimmer style={{ width: 60, height: 40, borderRadius: 10 }} />
                </View>
            </View>
        );
    }

    if (variant === 'chart') {
        return (
            <View>
                <Shimmer style={{ width: 120, height: 16, borderRadius: 8, marginBottom: 20 }} />
                <Shimmer style={{ width: '100%', height: 180, borderRadius: 16 }} />
            </View>
        );
    }

    if (variant === 'row') {
        return items.map((_, i) => (
            <View key={i} style={s.rowContainer}>
                <Shimmer style={{ width: 40, height: 40, borderRadius: 20 }} />
                <View style={{ marginLeft: 15, flex: 1, gap: 6 }}>
                    <Shimmer style={{ width: '70%', height: 14, borderRadius: 6 }} />
                    <Shimmer style={{ width: '45%', height: 12, borderRadius: 6 }} />
                </View>
            </View>
        ));
    }

    if (variant === 'post') {
        return items.map((_, i) => (
            <View key={i} style={{ padding: 15, marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Shimmer style={{ width: 40, height: 40, borderRadius: 20 }} />
                    <View style={{ marginLeft: 12, gap: 6 }}>
                        <Shimmer style={{ width: 120, height: 14, borderRadius: 6 }} />
                        <Shimmer style={{ width: 60, height: 10, borderRadius: 4 }} />
                    </View>
                </View>
                <Shimmer style={{ width: '90%', height: 14, borderRadius: 6, marginBottom: 10 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 }}>
                    <Shimmer style={{ width: 60, height: 30, borderRadius: 8 }} />
                    <Shimmer style={{ width: 60, height: 30, borderRadius: 8 }} />
                    <Shimmer style={{ width: 60, height: 30, borderRadius: 8 }} />
                </View>
                <Shimmer style={{ width: '100%', height: 140, borderRadius: 12, marginBottom: 12 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Shimmer style={{ width: 60, height: 16, borderRadius: 8 }} />
                    <Shimmer style={{ width: 60, height: 16, borderRadius: 8 }} />
                    <Shimmer style={{ width: 60, height: 16, borderRadius: 8 }} />
                </View>
            </View>
        ));
    }

    if (variant === 'chat') {
        return (
            <View style={{ padding: 15 }}>
                <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                    <Shimmer style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8 }} />
                    <Shimmer style={{ width: '70%', height: 60, borderRadius: 16 }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 20 }}>
                    <Shimmer style={{ width: '50%', height: 36, borderRadius: 16 }} />
                </View>
                <View style={{ flexDirection: 'row' }}>
                    <Shimmer style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8 }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Shimmer style={{ width: 8, height: 8, borderRadius: 4 }} />
                        <Shimmer style={{ width: 8, height: 8, borderRadius: 4 }} />
                        <Shimmer style={{ width: 8, height: 8, borderRadius: 4 }} />
                    </View>
                </View>
            </View>
        );
    }

    // Default 'card' variant
    return items.map((_, i) => (
        <View key={i} style={s.cardContainer}>
            <Shimmer style={{ width: 44, height: 44, borderRadius: 12 }} />
            <View style={{ marginLeft: 15, flex: 1, gap: 8 }}>
                <Shimmer style={{ width: '80%', height: 16, borderRadius: 8 }} />
                <Shimmer style={{ width: '55%', height: 12, borderRadius: 6 }} />
            </View>
        </View>
    ));
}

const s = StyleSheet.create({
    cardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginBottom: 12,
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
