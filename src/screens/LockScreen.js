import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/legacy-theme';
import { useUser } from '../context/UserContext';
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';
import { promptBiometricAuth } from '../utils/authStorage';

const ACCENT = '#CCFF00';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function LockScreen() {
    const { unlockApp } = useUser();
    const [authFailed, setAuthFailed] = useState(false);

    // Double-ripple ring animation
    const ring1Scale = useSharedValue(1);
    const ring1Opacity = useSharedValue(0.5);
    const ring2Scale = useSharedValue(1);
    const ring2Opacity = useSharedValue(0.35);

    // Shake on auth failure
    const shakeX = useSharedValue(0);

    // Unlock button press feedback
    const btnScale = useSharedValue(1);

    useEffect(() => {
        // First ripple ring — starts immediately
        ring1Scale.value = withRepeat(
            withTiming(1.7, { duration: 2200, easing: Easing.out(Easing.quad) }),
            -1,
            false,
        );
        ring1Opacity.value = withRepeat(
            withTiming(0, { duration: 2200, easing: Easing.out(Easing.quad) }),
            -1,
            false,
        );

        // Second ripple ring — offset by 1.1s for double-ripple effect
        const rippleDelay = setTimeout(() => {
            ring2Scale.value = withRepeat(
                withTiming(1.7, { duration: 2200, easing: Easing.out(Easing.quad) }),
                -1,
                false,
            );
            ring2Opacity.value = withRepeat(
                withTiming(0, { duration: 2200, easing: Easing.out(Easing.quad) }),
                -1,
                false,
            );
        }, 1100);

        const checkHardware = async () => {
            const hasAuth =
                (await LocalAuthentication.hasHardwareAsync()) &&
                (await LocalAuthentication.isEnrolledAsync());

            if (!hasAuth) {
                // No biometric capability — lock has no mechanism, bypass immediately
                unlockApp();
                return;
            }

            handleUnlock();
        };
        checkHardware();

        return () => clearTimeout(rippleDelay);
    }, []);

    const triggerShake = () => {
        shakeX.value = withSequence(
            withTiming(-14, { duration: 50 }),
            withTiming(14, { duration: 50 }),
            withTiming(-10, { duration: 50 }),
            withTiming(10, { duration: 50 }),
            withTiming(-6, { duration: 50 }),
            withTiming(6, { duration: 50 }),
            withTiming(0, { duration: 50 }),
        );
    };

    const handleUnlock = async () => {
        setAuthFailed(false);
        const success = await promptBiometricAuth();
        if (success) {
            successFeedback();
            unlockApp();
        } else {
            errorFeedback();
            setAuthFailed(true);
            triggerShake();
        }
    };

    const ring1Style = useAnimatedStyle(() => ({
        transform: [{ scale: ring1Scale.value }],
        opacity: ring1Opacity.value,
    }));

    const ring2Style = useAnimatedStyle(() => ({
        transform: [{ scale: ring2Scale.value }],
        opacity: ring2Opacity.value,
    }));

    const lockShakeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeX.value }],
    }));

    const btnAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: btnScale.value }],
    }));

    const failed = authFailed;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />

            {/* Ambient glow behind lock icon */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <LinearGradient
                    colors={[
                        failed ? 'rgba(255,59,48,0.08)' : 'rgba(204,255,0,0.07)',
                        'transparent',
                    ]}
                    style={styles.bgGlow}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                />
            </View>

            <SafeAreaView style={styles.safeArea}>
                {/* Logo */}
                <Animated.View entering={FadeInDown.duration(500)} style={styles.logoRow}>
                    <Image
                        source={require('../../assets/images/Ruvo Logo Original.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </Animated.View>

                {/* Center content */}
                <View style={styles.content}>
                    {/* Lock icon with ripple rings */}
                    <Animated.View entering={FadeIn.duration(700).delay(150)} style={styles.lockSection}>
                        <Animated.View style={[styles.rippleRing, failed && styles.rippleRingFailed, ring1Style]} />
                        <Animated.View style={[styles.rippleRing, failed && styles.rippleRingFailed, ring2Style]} />

                        <Animated.View style={lockShakeStyle}>
                            <LinearGradient
                                colors={
                                    failed
                                        ? ['rgba(255,59,48,0.18)', 'rgba(255,59,48,0.05)']
                                        : ['rgba(204,255,0,0.18)', 'rgba(204,255,0,0.04)']
                                }
                                style={[styles.lockCircle, failed && styles.lockCircleFailed]}
                            >
                                <Ionicons
                                    name="lock-closed"
                                    size={48}
                                    color={failed ? '#FF3B30' : ACCENT}
                                />
                            </LinearGradient>
                        </Animated.View>
                    </Animated.View>

                    <Animated.Text entering={FadeInUp.duration(500).delay(250)} style={styles.title}>
                        {failed ? 'Authentication Failed' : 'Ruvo is Locked'}
                    </Animated.Text>

                    <Animated.Text entering={FadeInUp.duration(500).delay(350)} style={styles.subtitle}>
                        {failed
                            ? 'Your identity could not be verified.\nPlease try again to continue.'
                            : 'Your session was locked for security.\nAuthenticate to continue your run.'}
                    </Animated.Text>

                    {failed && (
                        <Animated.View entering={FadeIn.duration(300)} style={styles.errorBadge}>
                            <Ionicons name="alert-circle-outline" size={15} color="#FF3B30" style={{ marginRight: 6 }} />
                            <Text style={styles.errorText}>Biometric auth failed or was canceled</Text>
                        </Animated.View>
                    )}
                </View>

                {/* Footer */}
                <Animated.View entering={FadeInUp.duration(500).delay(450)} style={styles.footer}>
                    <AnimatedPressable
                        style={[styles.unlockBtnOuter, btnAnimStyle]}
                        onPressIn={() => { btnScale.value = withSpring(0.96, { damping: 15 }); }}
                        onPressOut={() => { btnScale.value = withSpring(1, { damping: 15 }); }}
                        onPress={() => { lightTap(); handleUnlock(); }}
                    >
                        <LinearGradient
                            colors={[ACCENT, '#AADE00']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.unlockBtnInner}
                        >
                            <Ionicons
                                name={failed ? 'refresh' : 'finger-print'}
                                size={22}
                                color="#000"
                                style={{ marginRight: 10 }}
                            />
                            <Text style={styles.unlockBtnText}>
                                {failed ? 'Try Again' : 'Unlock with Biometrics'}
                            </Text>
                        </LinearGradient>
                    </AnimatedPressable>
                </Animated.View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    bgGlow: {
        height: '60%',
    },
    safeArea: {
        flex: 1,
    },

    logoRow: {
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 8,
    },
    logo: {
        width: 110,
        height: 44,
    },

    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },

    lockSection: {
        width: 120,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 36,
    },
    rippleRing: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 1.5,
        borderColor: ACCENT,
    },
    rippleRingFailed: {
        borderColor: '#FF3B30',
    },
    lockCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(204,255,0,0.35)',
    },
    lockCircleFailed: {
        borderColor: 'rgba(255,59,48,0.4)',
    },

    title: {
        fontSize: 26,
        fontFamily: 'Poppins_700Bold',
        color: '#FFF',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 14,
        fontFamily: 'Poppins_400Regular',
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
    },

    errorBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,59,48,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,59,48,0.25)',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        marginTop: 20,
    },
    errorText: {
        color: '#FF3B30',
        fontFamily: 'Poppins_500Medium',
        fontSize: 13,
    },

    footer: {
        paddingHorizontal: 28,
        paddingBottom: 24,
        paddingTop: 8,
    },

    unlockBtnOuter: {
        borderRadius: 30,
        boxShadow: "0 6px 16px rgba(204, 255, 0, 0.4)",
    },
    unlockBtnInner: {
        height: 58,
        borderRadius: 30,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        overflow: 'hidden',
    },
    unlockBtnText: {
        color: '#000',
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
    },


});
