import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
    Alert,
    Dimensions,
    KeyboardAvoidingView, Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput, TouchableOpacity,
    View, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/legacy-theme.js';
import { useUser } from '../context/UserContext';

const { width, height } = Dimensions.get('window');

export default function OnboardingSignUpScreen({ route, navigation }) {
    // 1. Data handling
    const onboardingData = route.params?.onboardingData || {};
    const { signUp, loginWithGoogle, loginWithFacebook, updateUserProfile } = useUser();

    // 2. Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // 3. Focus State for styling
    const [focusedInput, setFocusedInput] = useState(null);

    // 4. Inline error state
    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- LOGIC ---
    const handleCreateAccount = async () => {
        setErrorMessage(''); // Clear previous errors

        if (!email.includes('@') || password.length < 6) {
            setErrorMessage('Please enter a valid email and a password of at least 6 characters.');
            return;
        }
        if (password !== confirmPassword) {
            setErrorMessage('Your passwords do not match.');
            return;
        }

        setIsSubmitting(true);
        const result = await signUp(email, password, onboardingData.name || 'Runner');

        if (!result?.success) {
            setIsSubmitting(false);
            const code = result?.error?.code || '';
            if (code === 'auth/email-already-in-use') {
                setErrorMessage('This email is already registered. Try logging in instead.');
            } else if (code === 'auth/invalid-email') {
                setErrorMessage('Please enter a valid email address.');
            } else if (code === 'auth/weak-password') {
                setErrorMessage('Password is too weak. Use at least 6 characters.');
            } else {
                setErrorMessage(result?.error?.message || 'Something went wrong. Please try again.');
            }
            return;
        }

        // ✅ BUG 2 FIX: Save all onboarding data to Firebase after successful signup
        const profileData = {
            name: onboardingData.name || 'Runner',
            gender: onboardingData.gender || 'Male',
            weight: parseFloat(onboardingData.weight) || 70,
            height: parseFloat(onboardingData.height) || 175,
            dob: onboardingData.dateOfBirth || new Date().toISOString(),
            runFrequency: onboardingData.frequency || 3,
            selectedDays: onboardingData.selectedDays || [],
            goal: onboardingData.userGoal || 'Get Fitter',
            level: 1,
            currentXP: 0,
            runHistory: [],
            weeklyDistance: 0,
            earningUnlockProgress: 0,
            pushToken: onboardingData.pushToken || null,
            onboardingCompleted: true,
        };

        try {
            await updateUserProfile(profileData);
        } catch (e) {
            // Account exists but profile write failed — offer retry to prevent the onboarding loop
            Alert.alert(
                "Profile Save Failed",
                "Your account was created, but we couldn't save your profile. Please check your connection and try again.",
                [
                    {
                        text: "Retry",
                        onPress: async () => {
                            try {
                                await updateUserProfile(profileData);
                            } catch (retryErr) {
                                Alert.alert("Still Failing", "Please restart the app and log in. Your account is safe.");
                            }
                        }
                    }
                ]
            );
            setIsSubmitting(false);
            return;
        }

        setIsSubmitting(false);
        // Navigation handled by Auth state change listener in UserContext/App.js
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* BACKGROUND (Matches LoginScreen but with Success Tint) */}
            <View style={styles.backgroundContainer} pointerEvents="none">
                <View style={styles.floatingBlobTop} />
                <View style={styles.floatingBlobBottom} />
                <View style={styles.floatingBlobCenter} />
                <LinearGradient colors={['rgba(0,0,0,0.3)', '#000']} style={StyleSheet.absoluteFillObject} />
            </View>

            <SafeAreaView style={{ flex: 1 }}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>

                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1, paddingHorizontal: 30, justifyContent: 'center' }}
                >

                    <View style={{ marginBottom: 30 }}>
                        <Text style={styles.title}>Create Account</Text>
                        <Text style={styles.subtitle}>Secure your plan to {onboardingData.userGoal || 'hit your goals'}.</Text>
                    </View>

                    {/* --- INPUTS --- */}

                    {/* EMAIL */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>EMAIL ADDRESS</Text>
                        <View style={[styles.inputContainer, focusedInput === 'email' && styles.inputFocused]}>
                            <Ionicons name="mail-outline" size={20} color={focusedInput === 'email' ? COLORS.accent : "#666"} style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.input}
                                placeholder="hello@runner.com"
                                placeholderTextColor="#444"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                                onFocus={() => setFocusedInput('email')}
                                onBlur={() => setFocusedInput(null)}
                            />
                        </View>
                        {errorMessage !== '' && (
                            <Text style={styles.errorText}>{errorMessage}</Text>
                        )}
                    </View>

                    {/* PASSWORD */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>PASSWORD</Text>
                        <View style={[styles.inputContainer, focusedInput === 'pass' && styles.inputFocused]}>
                            <Ionicons name="lock-closed-outline" size={20} color={focusedInput === 'pass' ? COLORS.accent : "#666"} style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.input}
                                placeholder="Min 6 characters"
                                placeholderTextColor="#444"
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={setPassword}
                                onFocus={() => setFocusedInput('pass')}
                                onBlur={() => setFocusedInput(null)}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* MAIN BUTTON */}
                    <TouchableOpacity
                        style={[styles.mainBtn, isSubmitting && { opacity: 0.7 }]}
                        onPress={handleCreateAccount}
                        disabled={isSubmitting}
                    >
                        <Text style={styles.mainBtnText}>{isSubmitting ? 'CREATING...' : 'CREATE ACCOUNT'}</Text>
                    </TouchableOpacity>

                    {/* DIVIDER */}
                    <View style={styles.dividerContainer}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>OR SIGN UP WITH</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* SOCIALS (Reverted to original UI) */}
                    <View style={styles.socialRow}>
                        <TouchableOpacity style={styles.socialBtn} onPress={() => Alert.alert("Apple", "Social Login Simulated")}>
                            <FontAwesome5 name="apple" size={22} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.socialBtn}
                            onPress={async () => {
                                setIsSubmitting(true);
                                try {
                                    const res = await loginWithGoogle();
                                    if (res?.success) {
                                        await updateUserProfile({
                                            name: onboardingData.name || 'Runner',
                                            gender: onboardingData.gender || 'Male',
                                            weight: parseFloat(onboardingData.weight) || 70,
                                            height: parseFloat(onboardingData.height) || 175,
                                            dob: onboardingData.dateOfBirth || new Date().toISOString(),
                                            runFrequency: onboardingData.frequency || 3,
                                            selectedDays: onboardingData.selectedDays || [],
                                            goal: onboardingData.userGoal || 'Get Fitter',
                                            level: 1, currentXP: 0, runHistory: [], weeklyDistance: 0,
                                            earningUnlockProgress: 0, pushToken: onboardingData.pushToken || null,
                                            onboardingCompleted: true,
                                        });
                                    } else if (res?.error?.code === 'SIGN_IN_CANCELLED') {
                                        // Do nothing on user cancellation
                                    } else {
                                        Alert.alert("Sign Up Failed", "Google sign-in failed. Please try again.");
                                    }
                                } catch (e) {
                                    Alert.alert("Sign Up Failed", "Google sign-in failed. Please try again.");
                                } finally {
                                    setIsSubmitting(false);
                                }
                            }}
                        >
                            <FontAwesome5 name="google" size={20} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.socialBtn} onPress={async () => {
                            setIsSubmitting(true);
                            try {
                                const res = await loginWithFacebook();
                                if (res?.success) {
                                    await updateUserProfile({
                                        name: onboardingData.name || 'Runner',
                                        gender: onboardingData.gender || 'Male',
                                        weight: parseFloat(onboardingData.weight) || 70,
                                        height: parseFloat(onboardingData.height) || 175,
                                        dob: onboardingData.dateOfBirth || new Date().toISOString(),
                                        runFrequency: onboardingData.frequency || 3,
                                        selectedDays: onboardingData.selectedDays || [],
                                        goal: onboardingData.userGoal || 'Get Fitter',
                                        level: 1, currentXP: 0, runHistory: [], weeklyDistance: 0,
                                        earningUnlockProgress: 0, pushToken: onboardingData.pushToken || null,
                                        onboardingCompleted: true,
                                    });
                                } else if (res?.error?.code === 'SIGN_IN_CANCELLED') {
                                    // Do nothing on user cancellation
                                } else {
                                    Alert.alert("Sign Up Failed", "Facebook sign-in failed. Please try again.");
                                }
                            } catch (e) {
                                Alert.alert("Sign Up Failed", "Facebook sign-in failed. Please try again.");
                            } finally {
                                setIsSubmitting(false);
                            }
                        }}>
                            <FontAwesome5 name="facebook" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {/* FOOTER */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.linkText}>Log In</Text>
                        </TouchableOpacity>
                    </View>

                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },

    // Background Blobs (Copied from LoginScreen)
    backgroundContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    floatingBlobTop: { position: 'absolute', top: -height * 0.2, left: -width * 0.2, width: width * 0.8, height: width * 0.8, borderRadius: width * 0.4, backgroundColor: COLORS.accent, opacity: 0.15, transform: [{ scaleX: 1.5 }] },
    floatingBlobBottom: { position: 'absolute', bottom: -height * 0.1, right: -width * 0.3, width: width * 0.9, height: width * 0.9, borderRadius: width * 0.45, backgroundColor: COLORS.accent, opacity: 0.1, transform: [{ scaleY: 1.2 }] },

    backBtn: { padding: 20, width: 60 },

    // Typography
    title: { fontSize: 32, fontFamily: 'Poppins_700Bold', color: '#FFF' },
    subtitle: { fontSize: 16, fontFamily: 'Poppins_400Regular', color: '#888', marginTop: 0 },

    // Input Styling (Exact match to LoginScreen)
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#666', letterSpacing: 1, marginBottom: 8 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(28, 28, 30, 0.8)', height: 55, borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#333' },
    inputFocused: { borderColor: COLORS.accent },
    input: { flex: 1, color: '#FFF', fontFamily: 'Poppins_500Medium', fontSize: 16 },
    errorText: { color: '#FF3B30', fontSize: 13, fontFamily: 'Poppins_500Medium', marginTop: 8, marginLeft: 5 },

    // Main Button
    mainBtn: { backgroundColor: COLORS.accent, height: 55, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginTop: 25, marginBottom: 30, shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
    mainBtnText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_800ExtraBold', letterSpacing: 1 },

    // Social & Footer
    dividerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#333' },
    dividerText: { marginHorizontal: 15, color: '#666', fontSize: 10, fontFamily: 'Poppins_700Bold' },

    // Socials
    socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 30 },
    socialBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },

    footer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 40, marginTop: 10 },
    footerText: { color: '#888', fontFamily: 'Poppins_400Regular' },
    linkText: { color: '#FFF', fontFamily: 'Poppins_700Bold', textDecorationLine: 'underline' },
    floatingBlobCenter: { position: 'absolute', width: width, height: width, borderRadius: width / 2, backgroundColor: COLORS.accent, opacity: 0.05, transform: [{ scale: 1.5 }] },
});