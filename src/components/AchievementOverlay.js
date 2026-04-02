import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { successFeedback } from '../utils/haptics';

const { width, height } = Dimensions.get('window');

const COLORS = {
  accent: '#CCFF00',
  bg: 'rgba(0,0,0,0.92)',
};

/**
 * Full-screen achievement unlock overlay with scale spring + particle burst + haptic.
 * @param {boolean} visible - Whether the overlay is shown
 * @param {object} badge - { name, description, icon, color }
 * @param {function} onDismiss - Callback when user taps to dismiss
 */
export default function AchievementOverlay({ visible, badge, onDismiss }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const particles = useRef(
    Array.from({ length: 12 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(1),
      scale: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (visible && badge) {
      successFeedback();

      // Backdrop fade in
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Badge scale spring
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 12,
        stiffness: 180,
        mass: 0.8,
        useNativeDriver: true,
      }).start();

      // Glow pulse loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Particle burst
      particles.forEach((p, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const distance = 80 + Math.random() * 60;

        Animated.parallel([
          Animated.spring(p.scale, {
            toValue: 1,
            damping: 8,
            stiffness: 200,
            delay: 200,
            useNativeDriver: true,
          }),
          Animated.timing(p.x, {
            toValue: Math.cos(angle) * distance,
            duration: 600,
            delay: 200,
            useNativeDriver: true,
          }),
          Animated.timing(p.y, {
            toValue: Math.sin(angle) * distance,
            duration: 600,
            delay: 200,
            useNativeDriver: true,
          }),
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: 800,
            delay: 400,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      glowAnim.setValue(0);
      particles.forEach((p) => {
        p.x.setValue(0);
        p.y.setValue(0);
        p.opacity.setValue(1);
        p.scale.setValue(0);
      });
    }
  }, [visible, badge]);

  if (!visible || !badge) return null;

  const badgeColor = badge.color || COLORS.accent;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <TouchableOpacity 
          style={styles.dismissArea} 
          activeOpacity={1} 
          onPress={onDismiss}
        >
          {/* Particle burst */}
          <View style={styles.particleContainer}>
            {particles.map((p, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.particle,
                  {
                    backgroundColor: i % 3 === 0 ? COLORS.accent : i % 3 === 1 ? '#FFD700' : '#FF6B6B',
                    transform: [
                      { translateX: p.x },
                      { translateY: p.y },
                      { scale: p.scale },
                    ],
                    opacity: p.opacity,
                  },
                ]}
              />
            ))}
          </View>

          {/* Badge */}
          <Animated.View
            style={[
              styles.badgeContainer,
              {
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* Glow ring */}
            <Animated.View
              style={[
                styles.glowRing,
                {
                  backgroundColor: badgeColor,
                  opacity: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.1, 0.3],
                  }),
                  transform: [
                    {
                      scale: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.4],
                      }),
                    },
                  ],
                },
              ]}
            />

            <View style={[styles.iconCircle, { backgroundColor: badgeColor }]}>
              <Ionicons name={badge.icon || 'trophy'} size={48} color="#000" />
            </View>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
            <Text style={styles.unlockLabel}>ACHIEVEMENT UNLOCKED</Text>
            <Text style={styles.badgeName}>{badge.name}</Text>
            <Text style={styles.badgeDesc}>{badge.description}</Text>
          </Animated.View>

          <Animated.View style={[styles.tapHint, { opacity: opacityAnim }]}>
            <Text style={styles.tapText}>Tap to continue</Text>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  particleContainer: {
    position: 'absolute',
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  glowRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#CCFF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
  unlockLabel: {
    color: '#CCFF00',
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 3,
    marginBottom: 8,
  },
  badgeName: {
    color: '#FFF',
    fontSize: 28,
    fontFamily: 'Poppins_800ExtraBold',
    textAlign: 'center',
    marginBottom: 8,
  },
  badgeDesc: {
    color: '#999',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
  tapHint: {
    position: 'absolute',
    bottom: 80,
  },
  tapText: {
    color: '#555',
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
});
