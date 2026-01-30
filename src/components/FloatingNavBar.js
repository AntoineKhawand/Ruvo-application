import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const COLORS = {
  active: "#CCFF00", // Ruvo Neon
  inactive: "#666666",
  tabBg: "#1C1C1E"
};

export default function FloatingNavBar({ current }) {
  const navigation = useNavigation();

  const handleNavigation = (screen) => {
    if (current === screen) return;
    navigation.navigate(screen);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBackground}>
        {/* 1. HOME */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleNavigation('Home')}>
            <Ionicons name={current === 'Home' ? "home" : "home-outline"} size={24} color={current === 'Home' ? COLORS.active : COLORS.inactive} />
        </TouchableOpacity>

        {/* 2. COMMUNITY */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleNavigation('Community')}>
            <Ionicons name={current === 'Community' ? "people" : "people-outline"} size={24} color={current === 'Community' ? COLORS.active : COLORS.inactive} />
        </TouchableOpacity>

        {/* 3. PLAN (Calendar) */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleNavigation('Plan')}>
            <Ionicons name={current === 'Plan' ? "calendar" : "calendar-outline"} size={24} color={current === 'Plan' ? COLORS.active : COLORS.inactive} />
        </TouchableOpacity>

        {/* 4. REWARDS */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleNavigation('Rewards')}>
            <Ionicons name={current === 'Rewards' ? "gift" : "gift-outline"} size={24} color={current === 'Rewards' ? COLORS.active : COLORS.inactive} />
        </TouchableOpacity>

        {/* 5. PROFILE */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleNavigation('Profile')}>
            <Ionicons name={current === 'Profile' ? "person" : "person-outline"} size={24} color={current === 'Profile' ? COLORS.active : COLORS.inactive} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 25,
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
    backgroundColor: '#1C1C1E',
    borderRadius: 35,
    opacity: 0.95,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'space-around', // Distributed evenly
    paddingHorizontal: 10,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: 50,
  },
});
