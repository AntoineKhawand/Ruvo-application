import { Ionicons } from '@expo/vector-icons';
import { multiFactor, PhoneAuthProvider, PhoneMultiFactorGenerator } from 'firebase/auth';
import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { auth } from '../config/firebase';
import { COLORS } from '../constants/legacy-theme.js';
import { useUser } from '../context/UserContext';

// Custom reCAPTCHA verifier using WebView (for SMS verification)
const RecaptchaVerifier = forwardRef(({ firebaseConfig, onVerify, onError }, ref) => {
    const [visible, setVisible] = useState(false);
    const resolveRef = useRef(null);
    const rejectRef = useRef(null);

    useImperativeHandle(ref, () => ({
        // Firebase expects a verifier with .verify() that returns a Promise<string>
        verify: () => new Promise((resolve, reject) => {
            resolveRef.current = resolve;
            rejectRef.current = reject;
            setVisible(true);
        }),
        type: 'recaptcha',
        clear: () => {}, // no-op required by some Firebase SDK versions
    }));

    const siteKey = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'; // TODO: set EXPO_PUBLIC_RECAPTCHA_SITE_KEY in production
    const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <script src="https://www.google.com/recaptcha/api.js?render=${siteKey}"></script></head>
        <body><script>
        grecaptcha.ready(function(){
            grecaptcha.execute('${siteKey}',{action:'submit'}).then(function(token){
                window.ReactNativeWebView.postMessage(JSON.stringify({type:'success',token:token}));
            }).catch(function(err){
                window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:err.message}));
            });
        });</script></body></html>`;

    const handleMessage = useCallback((event) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            setVisible(false);
            if (data.type === 'success' && resolveRef.current) {
                resolveRef.current(data.token);
            } else if (rejectRef.current) {
                rejectRef.current(new Error(data.message || 'reCAPTCHA failed'));
            }
        } catch (e) {
            setVisible(false);
            if (rejectRef.current) rejectRef.current(e);
        }
    }, []);

    if (!visible) return null;

    return (
        <Modal transparent animationType="fade" visible={visible} onRequestClose={() => { setVisible(false); if (rejectRef.current) rejectRef.current(new Error('Cancelled')); }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ width: 1, height: 1, overflow: 'hidden' }}>
                    <WebView
                        source={{ html }}
                        onMessage={handleMessage}
                        javaScriptEnabled
                        onError={() => { setVisible(false); if (rejectRef.current) rejectRef.current(new Error('WebView error')); }}
                    />
                </View>
            </View>
        </Modal>
    );
});

export default function TwoFactorSetupScreen({ navigation }) {
    const { user, logSensitiveAction } = useUser();

    const recaptchaVerifier = useRef(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationId, setVerificationId] = useState(null);
    const [verificationCode, setVerificationCode] = useState('');

    // UI States
    const [step, setStep] = useState(1); // 1 = Phone Input, 2 = Code Input
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    useEffect(() => {
        let timer;
        if (resendCooldown > 0) {
            timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [resendCooldown]);

    // Preload reCAPTCHA verifier on mount
    useEffect(() => {
        if (recaptchaVerifier.current) {
            recaptchaVerifier.current.verify().catch(() => {});
        }
    }, []);

    // 1. Send SMS Code using MFA enrollment flow
    const handleSendVerification = async () => {
        if (!phoneNumber || phoneNumber.length < 10) {
            Alert.alert("Invalid Number", "Please enter a valid phone number with country code (e.g., +1234567890).");
            return;
        }

        if (!recaptchaVerifier.current || typeof recaptchaVerifier.current.verify !== 'function') {
            Alert.alert("Error", "reCAPTCHA not ready. Please try again.");
            return;
        }

        try {
            setLoading(true);
            // Get the MFA session for the currently signed-in user
            const session = await multiFactor(user).getSession();
            const phoneInfoOptions = { phoneNumber, session };
            const phoneAuthProvider = new PhoneAuthProvider(auth);
            
            // Use recaptchaVerifier - Firebase will call .verify() on it when needed
            const id = await phoneAuthProvider.verifyPhoneNumber(
                phoneInfoOptions,
                recaptchaVerifier.current
            );
            
            setVerificationId(id);
            setStep(2);
            setResendCooldown(30);
            Alert.alert("Code Sent", "Please check your messages for the verification code.");
        } catch (error) {
            console.error("SMS Send Error:", error);
            Alert.alert("Error Sending SMS", error.message || "Could not send verification code.");
        } finally {
            setLoading(false);
        }
    };

    // 2. Verify Code & Enroll
    const handleEnroll = async () => {
        if (!verificationCode || verificationCode.length < 6) {
            Alert.alert("Invalid Code", "Please enter the 6-digit code sent to your phone.");
            return;
        }

        if (!verificationId) {
            Alert.alert("Error", "Session expired. Please try again.");
            setStep(1);
            return;
        }

        try {
            setLoading(true);
            const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
            const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(credential);
            await multiFactor(user).enroll(multiFactorAssertion, "Primary Phone");

            if (logSensitiveAction) await logSensitiveAction("ENROLLED_2FA_SMS");

            Alert.alert(
                "Success!",
                "Two-Factor Authentication is now protecting your account.",
                [{ text: "OK", onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            console.error("Enrollment Error:", error);
            Alert.alert("Verification Failed", "Incorrect code or the session expired. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Custom reCAPTCHA Verifier (replaces deprecated expo-firebase-recaptcha) */}
            <RecaptchaVerifier
                ref={recaptchaVerifier}
                firebaseConfig={auth.app.options}
            />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>2FA Setup</Text>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>

                {step === 1 ? (
                    <View style={styles.card}>
                        <Ionicons name="phone-portrait-outline" size={60} color={COLORS.accent} style={styles.iconCenter} />
                        <Text style={styles.title}>Secure Your Account</Text>
                        <Text style={styles.description}>
                            Enter your phone number including the country code (e.g. +1). We'll send you an SMS to verify ownership.
                        </Text>

                        <View style={styles.inputContainer}>
                            <Ionicons name="call" size={20} color="#666" style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.input}
                                placeholder="+1 234 567 8900"
                                placeholderTextColor="#666"
                                keyboardType="phone-pad"
                                value={phoneNumber}
                                onChangeText={setPhoneNumber}
                                autoFocus
                            />
                        </View>

                        <TouchableOpacity style={styles.btnMain} onPress={handleSendVerification} disabled={loading}>
                            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>Send Code</Text>}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.card}>
                        <Ionicons name="chatbubble-ellipses-outline" size={60} color={COLORS.accent} style={styles.iconCenter} />
                        <Text style={styles.title}>Verify Phone Number</Text>
                        <Text style={styles.description}>
                            Enter the 6-digit code we just sent to {phoneNumber}.
                        </Text>

                        <View style={styles.inputContainer}>
                            <Ionicons name="key" size={20} color="#666" style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.input}
                                placeholder="123456"
                                placeholderTextColor="#666"
                                keyboardType="number-pad"
                                value={verificationCode}
                                onChangeText={setVerificationCode}
                                maxLength={6}
                                autoFocus
                            />
                        </View>

                        <TouchableOpacity style={styles.btnMain} onPress={handleEnroll} disabled={loading}>
                            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>Enable 2FA</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleSendVerification} style={{ marginTop: 20 }} disabled={loading || resendCooldown > 0}>
                            <Text style={[styles.resendText, (loading || resendCooldown > 0) && { color: '#666' }]}>
                                {resendCooldown > 0 ? `Wait ${resendCooldown}s to Resend` : "Didn't receive a code? Resend"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

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
    resendText: { color: COLORS.accent, fontSize: 14, fontFamily: 'Poppins_500Medium' }
});
