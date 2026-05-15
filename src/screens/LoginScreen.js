import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView, Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput, TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/legacy-theme.js';
import { useUser } from '../context/UserContext';
import { checkHardwareSupport, enableBiometricLogin, getStoredCredentials, isBiometricEnabled, promptBiometricAuth } from '../utils/authStorage';
import { checkRateLimit, recordFailedAttempt, resetAttempts } from '../utils/rateLimit';
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
    const { login, loginWithGoogle, loginWithFacebook } = useUser(); // 3. Get the real Login function

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false); // 4. Add Loading State

    const [isEmailFocused, setIsEmailFocused] = useState(false);
    const [isPassFocused, setIsPassFocused] = useState(false);
    const [biometricAvailable, setBiometricAvailable] = useState(false);

    // --- BIOMETRIC CHECK ON MOUNT ---
    useEffect(() => {
        const checkBiometrics = async () => {
            const hasHardware = await checkHardwareSupport();
            const isEnabled = await isBiometricEnabled();
            setBiometricAvailable(hasHardware);

            if (isEnabled) {
                const creds = await getStoredCredentials();
                if (creds) {
                    const success = await promptBiometricAuth();
                    if (success) {
                        setLoading(true);
                        try {
                            const result = await login(creds.email, creds.password);
                            if (!result) {
                                errorFeedback();
                                Alert.alert("Login Failed", "Biometric login failed. Please log in manually.");
                            } else {
                                successFeedback();
                            }
                        } catch (e) {
                            errorFeedback();
                            Alert.alert("Login Failed", "Something went wrong during biometric login. Please try again manually.");
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            }
        };
        checkBiometrics();
    }, []);

    // --- REAL LOGIN ACTION ---
    const handleLogin = async () => {
        lightTap();
        
        if (!email || !password) {
            errorFeedback();
            Alert.alert("Missing Info", "Please enter your email and password.");
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
        const result = await login(email, password);
        setLoading(false);

        if (!result) {
            const { locked } = await recordFailedAttempt('auth');
            errorFeedback();
            if (locked) {
                // Fire-and-forget — don't await, don't block the UI
                httpsCallable(functions, 'notifyLoginFailure')({ email }).catch(() => {});
                Alert.alert(
                    "Account Locked",
                    "Too many failed attempts. Your account is locked for 15 minutes.\n\nIf this wasn't you, reset your password using 'Forgot Password' below."
                );
            } else {
                Alert.alert("Login Failed", "Invalid email or password. Please check your credentials and try again.");
            }
            return;
        }

        await resetAttempts('auth');
        successFeedback();

        // Note: result is 'true' if login succeeded without MFA
        if (result === true && biometricAvailable) {
            const isEnabled = await isBiometricEnabled();
            if (!isEnabled) {
                Alert.alert(
                    "Enable Face ID / Touch ID?",
                    "Would you like to use biometrics to log in faster next time?",
                    [
                        { text: "No Thanks", style: "cancel" },
                        {
                            text: "Enable",
                            onPress: async () => {
                                const authSuccess = await promptBiometricAuth();
                                if (authSuccess) {
                                    await enableBiometricLogin(email, password);
                                }
                            }
                        }
                    ]
                );
            }
        }
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
                Alert.alert("Login Failed", "Google sign-in failed. Please try again.");
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
                Alert.alert("Login Failed", "Facebook sign-in failed. Please try again.");
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
                <TouchableOpacity activeOpacity={0.7} style={styles.backBtn} onPress={() => { lightTap(); navigation.goBack(); }}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>

                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, paddingHorizontal: 30, justifyContent: 'center' }}>

                    <View style={{ marginBottom: 40 }}>
                        <Image
                            source={require('../../assets/images/Ruvo Logo Original.png')}
                            style={{ width: 140, height: 44, marginBottom: 28 }}
                            resizeMode="contain"
                        />
                        <Text style={styles.title}>Welcome Back!</Text>
                        <Text style={styles.subtitle}>{"Let's get you back on track."}</Text>
                    </View>

                    {/* INPUTS */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>EMAIL ADDRESS</Text>
                        <View style={[styles.inputContainer, isEmailFocused && styles.inputFocused]}>
                            <Ionicons name="mail-outline" size={20} color={isEmailFocused ? COLORS.accent : "#666"} style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.input}
                                placeholder="hello@runner.com"
                                placeholderTextColor="#444"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                                onFocus={() => setIsEmailFocused(true)}
                                onBlur={() => setIsEmailFocused(false)}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>PASSWORD</Text>
                        <View style={[styles.inputContainer, isPassFocused && styles.inputFocused]}>
                            <Ionicons name="lock-closed-outline" size={20} color={isPassFocused ? COLORS.accent : "#666"} style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.input}
                                placeholder="••••••••"
                                placeholderTextColor="#444"
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={setPassword}
                                onFocus={() => setIsPassFocused(true)}
                                onBlur={() => setIsPassFocused(false)}
                            />
                            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setShowPassword(!showPassword); }}>
                                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {/* FORGOT PASSWORD ACTIVE LINK */}
                        <TouchableOpacity activeOpacity={0.7} style={{ alignSelf: 'flex-end', marginTop: 10 }} onPress={() => { lightTap(); navigation.navigate('ForgotPassword'); }}>
                            <Text style={styles.forgotPass}>Forgot Password?</Text>
                        </TouchableOpacity>
                    </View>

                    {/* LOGIN BUTTON (With Loading State) */}
                    <TouchableOpacity
                        activeOpacity={0.7}
                        style={[styles.loginBtn, loading && { opacity: 0.7 }]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={styles.loginBtnText}>LOG IN</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.dividerContainer}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* ACTIVE SOCIAL BUTTONS */}
                    <View style={styles.socialRow}>
                        <TouchableOpacity activeOpacity={0.7} style={styles.socialBtn} onPress={() => handleSocialLogin('Google')}>
                            <FontAwesome5 name="google" size={20} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity activeOpacity={0.7} style={styles.socialBtn} onPress={() => handleSocialLogin('Facebook')}>
                            <FontAwesome5 name="facebook" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {/* SIGN UP ACTIVE LINK */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>{"Don't have an account? "}</Text>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.navigate('SignUp'); }}>
                            <Text style={styles.signupLink}>Sign Up</Text>
                        </TouchableOpacity>
                    </View>

                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    backgroundContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    floatingBlobTop: { position: 'absolute', top: -height * 0.2, left: -width * 0.2, width: width * 0.8, height: width * 0.8, borderRadius: width * 0.4, backgroundColor: COLORS.accent, opacity: 0.15, transform: [{ scaleX: 1.5 }] },
    floatingBlobBottom: { position: 'absolute', bottom: -height * 0.1, right: -width * 0.3, width: width * 0.9, height: width * 0.9, borderRadius: width * 0.45, backgroundColor: COLORS.accent, opacity: 0.1, transform: [{ scaleY: 1.2 }] },

    backBtn: { padding: 20, width: 60 },
    title: { fontSize: 32, fontFamily: 'Poppins_700Bold', color: '#FFF' },
    subtitle: { fontSize: 16, fontFamily: 'Poppins_400Regular', color: '#888', marginTop: 5 },

    inputGroup: { marginBottom: 25 },
    label: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#666', letterSpacing: 1, marginBottom: 8 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(28, 28, 30, 0.8)', height: 55, borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#333' },
    inputFocused: { borderColor: COLORS.accent },
    input: { flex: 1, color: '#FFF', fontFamily: 'Poppins_500Medium', fontSize: 16 },

    forgotPass: { color: COLORS.accent, fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
    loginBtn: { backgroundColor: COLORS.accent, height: 55, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 30, shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
    loginBtnText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_800ExtraBold', letterSpacing: 1 },

    dividerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#333' },
    dividerText: { marginHorizontal: 15, color: '#666', fontSize: 10, fontFamily: 'Poppins_700Bold' },

    socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 40 },
    socialBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },

    footer: { flexDirection: 'row', justifyContent: 'center' },
    footerText: { color: '#888', fontFamily: 'Poppins_400Regular' },
    signupLink: { color: '#FFF', fontFamily: 'Poppins_700Bold', textDecorationLine: 'underline' }
});