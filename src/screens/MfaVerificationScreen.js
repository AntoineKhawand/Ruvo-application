import { Ionicons } from '@expo/vector-icons';
// import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { PhoneAuthProvider, PhoneMultiFactorGenerator } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import { COLORS } from '../constants/legacy-theme.js';

export default function MfaVerificationScreen({ route, navigation }) {
    // 1. Receive the resolver injected by LoginScreen
    const { resolver } = route.params || {};

    const recaptchaVerifier = useRef(null);
    const [verificationId, setVerificationId] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    useEffect(() => {
        let timer;
        if (resendCooldown > 0) {
            timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [resendCooldown]);

    // Auto-send SMS when screen loads if we have a valid resolver
    useEffect(() => {
        if (!resolver || typeof resolver.resolveSignIn !== 'function') {
            Alert.alert("Session Expired", "Please log in again.");
            navigation.replace('Login');
            return;
        }
        handleSendSms();
    }, []);

    const handleSendSms = async () => {
        if (!resolver) return;

        if (!resolver.hints?.length) {
            Alert.alert("Error", "No MFA method found on this account.");
            return;
        }

        try {
            setLoading(true);
            const phoneInfoOptions = {
                multiFactorHint: resolver.hints[0],
                session: resolver.session
            };

            const phoneAuthProvider = new PhoneAuthProvider(auth);
            const verId = await phoneAuthProvider.verifyPhoneNumber(
                phoneInfoOptions,
                recaptchaVerifier.current
            );

            setVerificationId(verId);
            // Alert user silently or visually
        } catch (error) {
            console.error("SMS Send Error:", error);
            Alert.alert("Error Sending SMS", error.message);
        } finally {
            setLoading(false);
            setResendCooldown(30); // 30s spam protection cooldown
        }
    };

    const handleVerifyAndLogin = async () => {
        if (!verificationCode || verificationCode.length < 6) {
            Alert.alert("Invalid Code", "Please enter the 6-digit code.");
            return;
        }

        if (!resolver) return;

        try {
            setLoading(true);
            const phoneAuthCredential = PhoneAuthProvider.credential(
                verificationId,
                verificationCode
            );

            const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(phoneAuthCredential);

            // 🔥 THIS RESOLVES THE LOGIN AND TRIGGERS ON_AUTH_STATE_CHANGED 🔥
            await resolver.resolveSignIn(multiFactorAssertion);

            // The Auth listener in UserContext will detect the sign-in and reroute the app automatically
        } catch (error) {
            console.error("Verification Error:", error);
            
            // Handle specific expiration errors that require a fresh login session
            if (error.code === 'auth/code-expired' || error.code === 'auth/session-expired') {
                Alert.alert("Session Expired", "Your 2FA session has expired. Please log in again.");
                navigation.replace('Login');
            } else {
                Alert.alert("Verification Failed", "Incorrect code. Please try again.");
                setLoading(false); // Only unset loading on failure, on success the unmount handles it
            }
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Firebase Recaptcha Modal */}
            {/* <FirebaseRecaptchaVerifierModal
                ref={recaptchaVerifier}
                firebaseConfig={auth.app.options}
                attemptInvisibleVerification={true}
            /> */}

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>2FA Verification</Text>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>

                <View style={styles.card}>
                    <Ionicons name="shield-checkmark-outline" size={60} color={COLORS.accent} style={styles.iconCenter} />
                    <Text style={styles.title}>Extra Security</Text>
                    <Text style={styles.description}>
                        Your account is protected by 2FA. Enter the 6-digit code sent to your phone number ending in {resolver?.hints?.[0]?.phoneNumber?.slice(-4) || 'XXXX'}.
                    </Text>

                    <View style={styles.inputContainer}>
                        <Ionicons name="key-outline" size={20} color="#666" style={{ marginRight: 10 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="123456"
                            placeholderTextColor="#444"
                            keyboardType="number-pad"
                            value={verificationCode}
                            onChangeText={setVerificationCode}
                            maxLength={6}
                            autoFocus
                        />
                    </View>

                    <TouchableOpacity style={styles.btnMain} onPress={handleVerifyAndLogin} disabled={loading || !verificationId}>
                        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>Verify & Log In</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleSendSms} style={{ marginTop: 20 }} disabled={loading || resendCooldown > 0}>
                        <Text style={[styles.resendText, (loading || resendCooldown > 0) && { color: '#666' }]}>
                            {resendCooldown > 0 ? `Wait ${resendCooldown}s to Resend` : "Didn't receive a code? Resend"}
                        </Text>
                    </TouchableOpacity>

                    {/* Escape Route to Login */}
                    <TouchableOpacity style={{ marginTop: 30, padding: 10 }} onPress={() => navigation.replace('Login')}>
                        <Text style={styles.escapeText}>Cancel & Return to <Text style={styles.escapeBold}>Login</Text></Text>
                    </TouchableOpacity>
                </View>

            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
    headerTitle: { fontSize: 18, color: '#FFF', fontFamily: 'Poppins_700Bold' },
    content: { flex: 1, padding: 20, justifyContent: 'center' },
    card: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 25, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
    iconCenter: { marginBottom: 20 },
    title: { fontSize: 22, color: '#FFF', fontFamily: 'Poppins_700Bold', marginBottom: 10, textAlign: 'center' },
    description: { fontSize: 14, color: '#888', fontFamily: 'Poppins_400Regular', textAlign: 'center', marginBottom: 30, lineHeight: 22 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', borderRadius: 12, paddingHorizontal: 15, height: 55, width: '100%', marginBottom: 25, borderWidth: 1, borderColor: '#333' },
    input: { flex: 1, color: '#FFF', fontSize: 18, fontFamily: 'Poppins_600SemiBold', letterSpacing: 2 },
    btnMain: { backgroundColor: COLORS.accent, width: '100%', paddingVertical: 15, borderRadius: 30, alignItems: 'center' },
    btnText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    resendText: { color: COLORS.accent, fontSize: 14, fontFamily: 'Poppins_500Medium' },
    escapeText: { color: '#888', fontSize: 14, fontFamily: 'Poppins_400Regular', textAlign: 'center' },
    escapeBold: { color: '#FFF', fontFamily: 'Poppins_700Bold' }
});
