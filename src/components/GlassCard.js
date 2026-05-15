import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

const GlassCard = ({ children, style, onPress, activeOpacity = 0.8, intensity }) => {
    const defaultIntensity = Platform.OS === 'ios' ? 40 : 10;
    
    const CardContent = (
        <BlurView 
            intensity={intensity || defaultIntensity} 
            tint="dark" 
            style={[styles.glassCard, style]}
        >
            {children}
        </BlurView>
    );

    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={activeOpacity}>
                {CardContent}
            </TouchableOpacity>
        );
    }

    return CardContent;
};

const styles = StyleSheet.create({
    glassCard: {
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },
});

export default GlassCard;
