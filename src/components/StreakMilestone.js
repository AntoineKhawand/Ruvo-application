import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { successFeedback } from '../utils/haptics';

const STREAK_MILESTONES = [7, 14, 30, 60, 100, 200, 365];

const MILESTONE_MESSAGES = {
  7: { emoji: '🔥', title: '1 Week Streak!', message: "You've run every day for 7 days straight. Most people quit after 3 days." },
  14: { emoji: '💪', title: '2 Week Warrior!', message: "14 days in a row. You're building an unbreakable habit." },
  30: { emoji: '🏆', title: '30-Day Legend!', message: "A full month of running. Less than 5% of runners achieve this." },
  60: { emoji: '⚡', title: '60-Day Machine!', message: "Two months of consistency. Your VO2 max is thanking you." },
  100: { emoji: '👑', title: 'Century Runner!', message: "100 days. You are in the top 1% of all runners worldwide." },
  200: { emoji: '🌟', title: 'Unstoppable!', message: "200 consecutive days. You've redefined your limits." },
  365: { emoji: '🎯', title: 'Year-Long Streak!', message: "365 days. You didn't just build a habit — you became a runner." },
};

/**
 * StreakMilestone — shows a celebration overlay when streak hits a milestone.
 * @param {number} streak - Current consecutive day streak
 * @param {function} onDismiss - Callback when dismissed
 */
export default function StreakMilestone({ streak, onDismiss }) {
  const isMilestone = STREAK_MILESTONES.includes(streak);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const emojiScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isMilestone) {
      successFeedback();

      Animated.stagger(150, [
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 10,
          stiffness: 150,
          useNativeDriver: true,
        }),
        Animated.spring(emojiScale, {
          toValue: 1,
          damping: 8,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.2, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isMilestone]);

  if (!isMilestone) return null;

  const info = MILESTONE_MESSAGES[streak] || { emoji: '🔥', title: `${streak}-Day Streak!`, message: 'Incredible consistency!' };

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onDismiss}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDismiss}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          {/* Glow */}
          <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />

          {/* Emoji */}
          <Animated.Text style={[styles.emoji, { transform: [{ scale: emojiScale }] }]}>
            {info.emoji}
          </Animated.Text>

          {/* Streak number */}
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={20} color="#FF6B00" />
            <Text style={styles.streakNumber}>{streak}</Text>
          </View>

          <Text style={styles.title}>{info.title}</Text>
          <Text style={styles.message}>{info.message}</Text>

          <TouchableOpacity style={styles.button} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.buttonText}>Keep Going!</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

/** Check if a given streak count should trigger a celebration */
export function shouldCelebrateStreak(currentStreak, lastCelebratedStreak) {
  return STREAK_MILESTONES.includes(currentStreak) && currentStreak !== lastCelebratedStreak;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '85%',
    backgroundColor: '#1C1C1E',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B00',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -60,
    width: 200,
    height: 200,
    backgroundColor: '#FF6B00',
    borderRadius: 100,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 0, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  streakNumber: {
    color: '#FF6B00',
    fontSize: 24,
    fontFamily: 'Poppins_800ExtraBold',
    marginLeft: 6,
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontFamily: 'Poppins_800ExtraBold',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    color: '#999',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  button: {
    backgroundColor: '#FF6B00',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
});
