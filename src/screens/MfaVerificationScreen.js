import { Ionicons } from '@expo/vector-icons';
import { PhoneAuthProvider, PhoneMultiFactorGenerator } from 'firebase/auth';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { auth } from '../config/firebase';
import { COLORS } from '../constants/legacy-theme.js';

// Custom reCAPTCHA verifier using WebView (replaces deprecated expo-firebase-recaptcha)
const RecaptchaVerifier = forwardRef(({ firebaseConfig }, ref) => {
    const [visible, setVisible] = useState(false);
    const resolveRef = useRef(null);
    const rejectRef = useRef(null);

    useImperativeHandle(ref, () => ({
        verify: () => new Promise((resolve, reject) => {
            resolveRef.current = resolve;
            rejectRef.current = reject;
            setVisible(true);
        }),
        type: 'recaptcha',
    }));

    const siteKey = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
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
        <Modal transparent animationType="fade" visible={visible} onRequestClose={() => setVisible(false)}>
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

    // Preload reCAPTCHA verifier on mount
    useEffect(() => {
        if (recaptchaVerifier.current) {
            recaptchaVerifier.current.verify().catch(() => {});
        }
    }, []);

    // Auto-send SMS when screen loads if we have a valid resolver
    useEffect(() => {
        if (!resolver || typeof resolver.resolveSignIn !== 'function') {
            Alert.alert("Session Expired", "Please log in again.");
            navigation.replace('Login');
            return;
        }
        // Give WebView time to mount before sending SMS
        const timer = setTimeout(() => {
            handleSendSms();
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    const getFirebaseErrorMessage = (error) => {
        const code = error.code || '';
        const msg = error.message || '';
        if (code === 'auth/invalid-phone-number') return "The phone number format is invalid.";
        if (code === 'auth/quota-exceeded') return "SMS quota exceeded. The project needs the Blaze plan and phone auth enabled.";
        if (code === 'auth/too-many-requests') return "Too many requests. Please wait and try again.";
        if (code === 'auth/internal-error' || msg.includes('recaptcha') || msg.includes('ReCaptcha')) return "reCAPTCHA failed. Set EXPO_PUBLIC_RECAPTCHA_SITE_KEY in .env with a real key.";
        if (code === 'auth/network-request-failed') return "Network error. Check your internet connection.";
        return msg || "Could not send verification code.";
    };

    const handleSendSms = async () => {
        if (!resolver) return;

        if (!resolver.hints?.length) {
            Alert.alert("Error", "No MFA method found on this account.");
            return;
        }

        if (!recaptchaVerifier.current || typeof recaptchaVerifier.current.verify !== 'function') {
            Alert.alert("Error", "reCAPTCHA not ready. Please try again.");
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
        } catch (error) {
            console.error("SMS Send Error:", error.code, error.message);
            Alert.alert("Error Sending SMS", getFirebaseErrorMessage(error));
        } finally {
            setLoading(false);
            setResendCooldown(30);
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
            {/* Custom reCAPTCHA Verifier (replaces deprecated expo-firebase-recaptcha) */}
            <RecaptchaVerifier ref={recaptchaVerifier} firebaseConfig={auth.app.options} />

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

                    <TouchableOpacity style={{ marginTop: 20, padding: 10 }} onPress={() => Linking.openURL('mailto:support@ruvo.com?subject=Lost%20Phone%20-%20MFA%20Recovery&body=Hi%20Ruvo%20Support%2C%0A%0AI%20have%20lost%20access%20to%20my%20phone%20and%20cannot%20receive%20my%202FA%20SMS%20code.%20Please%20help%20me%20recover%20my%20account.%0A%0AEmail%3A%20')}>
                        <Text style={styles.resendText}>Lost your phone? Contact support</Text>
                    </TouchableOpacity>

                    {/* Escape Route to Login */}
                    <TouchableOpacity style={{ marginTop: 15, padding: 10 }} onPress={() => navigation.replace('Login')}>
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
