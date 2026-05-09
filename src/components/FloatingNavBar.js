import React, { useRef, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lightTap } from '../utils/haptics';

const { width } = Dimensions.get('window');

const COLORS = {
  active: "#CCFF00", // Ruvo Neon
  inactive: "#888888",
};

export default function FloatingNavBar({ current }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isNavigating = useRef(false);

  const handleNavigation = useCallback((screen) => {
    if (current === screen || isNavigating.current) return;
    isNavigating.current = true;

    lightTap();

    // Quick press-scale feedback on the bar, then navigate
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95, // Slightly deeper scale for better haptic feel
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate immediately for responsiveness (animation is cosmetic)
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: screen }],
      })
    );

    // Reset lock after navigation settles
    setTimeout(() => { isNavigating.current = false; }, 400);
  }, [current, navigation, scaleAnim]);

  return (
    <View style={[styles.container, { bottom: 25 + insets.bottom }]}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '100%' }}>
        <BlurView 
            intensity={80} 
            tint="dark" 
            style={styles.tabBackground}
        >
            {/* 1. HOME */}
            <TouchableOpacity activeOpacity={0.7} style={styles.tabItem} onPress={() => handleNavigation('Home')}>
                <Ionicons name={current === 'Home' ? "home" : "home-outline"} size={24} color={current === 'Home' ? COLORS.active : COLORS.inactive} />
            </TouchableOpacity>

            {/* 2. COMMUNITY */}
            <TouchableOpacity activeOpacity={0.7} style={styles.tabItem} onPress={() => handleNavigation('Community')}>
                <Ionicons name={current === 'Community' ? "people" : "people-outline"} size={24} color={current === 'Community' ? COLORS.active : COLORS.inactive} />
            </TouchableOpacity>

            {/* 3. PLAN (Calendar) */}
            <TouchableOpacity activeOpacity={0.7} style={styles.tabItem} onPress={() => handleNavigation('Plan')}>
                <Ionicons name={current === 'Plan' ? "calendar" : "calendar-outline"} size={24} color={current === 'Plan' ? COLORS.active : COLORS.inactive} />
            </TouchableOpacity>

            {/* 4. REWARDS */}
            <TouchableOpacity activeOpacity={0.7} style={styles.tabItem} onPress={() => handleNavigation('Rewards')}>
                <Ionicons name={current === 'Rewards' ? "gift" : "gift-outline"} size={24} color={current === 'Rewards' ? COLORS.active : COLORS.inactive} />
            </TouchableOpacity>

            {/* 5. PROFILE */}
            <TouchableOpacity activeOpacity={0.7} style={styles.tabItem} onPress={() => handleNavigation('Profile')}>
                <Ionicons name={current === 'Profile' ? "person" : "person-outline"} size={24} color={current === 'Profile' ? COLORS.active : COLORS.inactive} />
            </TouchableOpacity>
        </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBackground: {
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    borderRadius: 35,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'space-around', // Distributed evenly
    paddingHorizontal: 10,
    overflow: 'hidden', // Required for BlurView borderRadius
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: 50,
  },
});
