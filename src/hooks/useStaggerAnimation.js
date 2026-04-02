import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Reusable staggered entrance animation for FlatList items.
 * Each item fades in and slides up with an index-based delay.
 *
 * Usage:
 *   const { animatedRenderItem } = useStaggerAnimation(originalRenderItem);
 *   <Animated.FlatList renderItem={animatedRenderItem} ... />
 */
export default function useStaggerAnimation(renderItem, { duration = 350, staggerDelay = 60, translateY = 20 } = {}) {
    const animatedValues = useRef({});

    const getAnimatedValue = useCallback((index) => {
        if (!animatedValues.current[index]) {
            const val = new Animated.Value(0);
            animatedValues.current[index] = val;

            // Trigger the entrance animation with stagger delay
            Animated.timing(val, {
                toValue: 1,
                duration,
                delay: index * staggerDelay,
                useNativeDriver: true,
            }).start();
        }
        return animatedValues.current[index];
    }, [duration, staggerDelay]);

    const animatedRenderItem = useCallback((info) => {
        const anim = getAnimatedValue(info.index);
        return (
            <Animated.View
                style={{
                    opacity: anim,
                    transform: [{
                        translateY: anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [translateY, 0],
                        }),
                    }],
                }}
            >
                {renderItem(info)}
            </Animated.View>
        );
    }, [renderItem, getAnimatedValue, translateY]);

    /** Call this to reset animations (e.g., on data refresh) */
    const resetAnimations = useCallback(() => {
        animatedValues.current = {};
    }, []);

    return { animatedRenderItem, resetAnimations };
}
