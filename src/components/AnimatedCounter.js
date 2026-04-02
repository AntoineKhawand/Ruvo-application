import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';

/**
 * AnimatedCounter — smoothly counts up/down to a target value.
 * @param {number} value - The target number to animate to
 * @param {number} duration - Animation duration in ms (default: 800)
 * @param {object} style - Text style overrides
 * @param {string} suffix - Optional suffix (e.g. ' km', ' XP')
 * @param {number} decimals - Number of decimal places (default: 0)
 */
export default function AnimatedCounter({
  value = 0,
  duration = 800,
  style,
  suffix = '',
  prefix = '',
  decimals = 0,
}) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const textRef = useRef(null);
  const prevValue = useRef(0);

  useEffect(() => {
    // Animate from previous value to new value
    animatedValue.setValue(prevValue.current);

    Animated.timing(animatedValue, {
      toValue: value,
      duration,
      useNativeDriver: false, // Must be false for text updates
    }).start();

    // Track the displayed value via listener
    const listenerId = animatedValue.addListener(({ value: v }) => {
      if (textRef.current) {
        const display = decimals > 0 ? v.toFixed(decimals) : Math.round(v);
        textRef.current.setNativeProps({
          text: `${prefix}${Number(display).toLocaleString()}${suffix}`,
        });
      }
    });

    prevValue.current = value;

    return () => {
      animatedValue.removeListener(listenerId);
    };
  }, [value]);

  const display = decimals > 0 ? value.toFixed(decimals) : Math.round(value);

  return (
    <Animated.Text
      ref={textRef}
      style={[styles.text, style]}
    >
      {`${prefix}${Number(display).toLocaleString()}${suffix}`}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#FFF',
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
  },
});
