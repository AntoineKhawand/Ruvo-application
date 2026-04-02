import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
    ActivityIndicator // 1. Added ActivityIndicator for loading spinner
    ,










    Alert,
    Dimensions,
    KeyboardAvoidingView, Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput, TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/legacy-theme.js';
import { useUser } from '../context/UserContext'; // 2. Import the backend engine
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';
import { checkRateLimit, recordFailedAttempt, resetAttempts } from '../utils/rateLimit';

const { width, height } = Dimensions.get('window');

export default function SignUpScreen({ navigation }) {
    const { signUp, loginWithGoogle, loginWithFacebook } = useUser(); // 3. Get the real Sign Up function

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [loading, setLoading] = useState(false); // 4. Add loading state
    const [focusedInput, setFocusedInput] = useState(null);

    // Inside src/screens/SignUpScreen.js

    const handleSignUp = async () => {
        lightTap();

        if (!name || !email || !password) {
            errorFeedback();
            Alert.alert("Missing Info", "Please fill in all fields.");
            return;
        }

        if (password.length < 6) {
            errorFeedback();
            Alert.alert("Weak Password", "Password must be at least 6 characters.");
            return;
        }

        const { allowed, remainingMs } = await checkRateLimit('auth');
        if (!allowed) {
            errorFeedback();
            const minutes = Math.ceil(remainingMs / 60000);
            Alert.alert("Action Blocked", `Too many failed attempts. Please try again in ${minutes} minute(s).`);
            return;
        }

        setLoading(true);
        const result = await signUp(email, password, name);
        setLoading(false);

        // signUp returns { success, error } — check the success field
        if (!result?.success) {
            await recordFailedAttempt('auth');
            errorFeedback();
            // Show a user-friendly error message
            const code = result?.error?.code || '';
            if (code === 'auth/email-already-in-use') {
                Alert.alert("Email Taken", "This email is already registered. Try logging in instead.");
            } else if (code === 'auth/weak-password') {
                Alert.alert("Weak Password", "Password must be at least 6 characters.");
            } else {
                Alert.alert("Signup Failed", result?.error?.message || "Something went wrong. Please try again.");
            }
            return;
        }

        await resetAttempts('auth');
        successFeedback();
        // Navigation handled automatically by auth state change in App.js
    };

    const handleSocialLogin = async (platform) => {
        lightTap();

        if (platform === 'Google') {
            setLoading(true);
            try {
                await loginWithGoogle();
                successFeedback();
                // Navigation handled automatically by auth state change
            } catch (e) {
                errorFeedback();
                Alert.alert("Sign Up Failed", "Google sign-in failed. Please try again.");
            } finally {
                setLoading(false);
            }
            return;
        }
        if (platform === 'Facebook') {
            setLoading(true);
            try {
                await loginWithFacebook();
                successFeedback();
                // Navigation handled automatically by auth state change
            } catch (e) {
                errorFeedback();
                Alert.alert("Sign Up Failed", "Facebook sign-in failed. Please try again.");
            } finally {
                setLoading(false);
            }
            return;
        }
        errorFeedback();
        Alert.alert(`Connect with ${platform}`, "This login method is not yet available.");
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* BACKGROUND */}
            <View style={styles.backgroundContainer} pointerEvents="none">
                <View style={styles.floatingBlobTop} />
                <View style={styles.floatingBlobBottom} />
                <LinearGradient colors={['rgba(0,0,0,0.3)', '#000']} style={StyleSheet.absoluteFillObject} />
            </View>

            <SafeAreaView style={{ flex: 1 }}>

                {/* HEADER */}
                <View style={styles.header}>
                    <TouchableOpacity activeOpacity={0.7} style={styles.backBtn} onPress={() => { lightTap(); navigation.goBack(); }}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1, paddingHorizontal: 30, justifyContent: 'center' }}
                >

                    <View style={{ marginBottom: 30 }}>
                        <Text style={styles.title}>Create Account</Text>
                        <Text style={styles.subtitle}>Join the community and start tracking.</Text>
                    </View>

                    {/* --- FORM INPUTS --- */}

                    {/* NAME */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>FULL NAME</Text>
                        <View style={[styles.inputContainer, focusedInput === 'name' && styles.inputFocused]}>
                            <Ionicons name="person-outline" size={20} color={focusedInput === 'name' ? COLORS.accent : "#666"} style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.input}
                                placeholder="John Doe"
                                placeholderTextColor="#444"
                                value={name}
                                onChangeText={setName}
                                onFocus={() => setFocusedInput('name')}
                                onBlur={() => setFocusedInput(null)}
                            />
                        </View>
                    </View>

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
                            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setShowPassword(!showPassword); }}>
                                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* SIGN UP BUTTON (With Loading State) */}
                    <TouchableOpacity
                        activeOpacity={0.7}
                        style={[styles.signupBtn, loading && { opacity: 0.7 }]}
                        onPress={handleSignUp}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={styles.signupBtnText}>SIGN UP</Text>
                        )}
                    </TouchableOpacity>

                    {/* DIVIDER */}
                    <View style={styles.dividerContainer}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>OR SIGN UP WITH</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* SOCIALS */}
                    <View style={styles.socialRow}>
                        <TouchableOpacity activeOpacity={0.7} style={styles.socialBtn} onPress={() => handleSocialLogin('Apple')}>
                            <FontAwesome5 name="apple" size={22} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            style={styles.socialBtn}
                            onPress={() => handleSocialLogin('Google')}
                        >
                            <FontAwesome5 name="google" size={20} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity activeOpacity={0.7} style={styles.socialBtn} onPress={() => handleSocialLogin('Facebook')}>
                            <FontAwesome5 name="facebook" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {/* FOOTER */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Already have an account? </Text>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.navigate('Login'); }}>
                            <Text style={styles.loginLink}>Log In</Text>
                        </TouchableOpacity>
                    </View>

                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },

    // Background Styling
    backgroundContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    floatingBlobTop: { position: 'absolute', top: -height * 0.2, left: -width * 0.2, width: width * 0.8, height: width * 0.8, borderRadius: width * 0.4, backgroundColor: COLORS.accent, opacity: 0.15, transform: [{ scaleX: 1.5 }] },
    floatingBlobBottom: { position: 'absolute', bottom: -height * 0.1, right: -width * 0.3, width: width * 0.9, height: width * 0.9, borderRadius: width * 0.45, backgroundColor: COLORS.accent, opacity: 0.1, transform: [{ scaleY: 1.2 }] },

    // Header
    header: { paddingHorizontal: 20, paddingTop: 10, marginBottom: 10 },
    backBtn: { padding: 5 },

    // Typography
    title: { fontSize: 32, fontFamily: 'Poppins_700Bold', color: '#FFF', marginBottom: 10 },
    subtitle: { fontSize: 16, fontFamily: 'Poppins_400Regular', color: '#888' },

    // Inputs
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#666', letterSpacing: 1, marginBottom: 8 },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(28, 28, 30, 0.8)',
        height: 55,
        borderRadius: 12,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#333'
    },
    inputFocused: { borderColor: COLORS.accent },
    input: { flex: 1, color: '#FFF', fontFamily: 'Poppins_500Medium', fontSize: 16 },

    // Main Button
    signupBtn: {
        backgroundColor: COLORS.accent,
        height: 55,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
        marginTop: 10,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10
    },
    signupBtnText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_800ExtraBold', letterSpacing: 1 },

    // Divider
    dividerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#333' },
    dividerText: { marginHorizontal: 15, color: '#666', fontSize: 10, fontFamily: 'Poppins_700Bold' },

    // Socials
    socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 30 },
    socialBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },

    // Footer
    footer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
    footerText: { color: '#888', fontFamily: 'Poppins_400Regular' },
    loginLink: { color: '#FFF', fontFamily: 'Poppins_700Bold', textDecorationLine: 'underline' }
});