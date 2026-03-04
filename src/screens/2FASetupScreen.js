import { Ionicons } from '@expo/vector-icons';
// import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { multiFactor, PhoneAuthProvider, PhoneMultiFactorGenerator } from 'firebase/auth';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase'; // Ensure your firebase config exposes 'app' or you can get auth.app
import { COLORS } from '../constants/legacy-theme.js';
import { useUser } from '../context/UserContext';

export default function TwoFactorSetupScreen({ navigation }) {
    const { user, logSensitiveAction } = useUser();

    const recaptchaVerifier = useRef(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationId, setVerificationId] = useState('');
    const [verificationCode, setVerificationCode] = useState('');

    // UI States
    const [step, setStep] = useState(1); // 1 = Phone Input, 2 = Code Input
    const [loading, setLoading] = useState(false);

    // 1. Send SMS Code
    const handleSendVerification = async () => {
        if (!phoneNumber || phoneNumber.length < 10) {
            Alert.alert("Invalid Number", "Please enter a valid phone number with country code (e.g., +1234567890).");
            return;
        }

        try {
            setLoading(true);
            const userSession = await multiFactor(user).getSession();
            const phoneInfoOptions = {
                phoneNumber,
                session: userSession
            };

            const phoneAuthProvider = new PhoneAuthProvider(auth);
            const verId = await phoneAuthProvider.verifyPhoneNumber(
                phoneInfoOptions,
                recaptchaVerifier.current
            );

            setVerificationId(verId);
            setStep(2);
            Alert.alert("Code Sent", "Please check your messages for the verification code.");
        } catch (error) {
            console.error("SMS Send Error:", error);
            Alert.alert("Error Sending SMS", error.message);
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

        try {
            setLoading(true);
            const phoneAuthCredential = PhoneAuthProvider.credential(verificationId, verificationCode);
            const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(phoneAuthCredential);

            await multiFactor(user).enroll(multiFactorAssertion, "Primary Phone");

            if (logSensitiveAction) await logSensitiveAction("ENROLLED_2FA_SMS");

            Alert.alert(
                "Success!",
                "Step Complete! Two-Factor Authentication is now actively protecting your account.",
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
            {/* Firebase Recaptcha Modal (Hidden implicitly unless invoked) */}
            {/* <FirebaseRecaptchaVerifierModal
                ref={recaptchaVerifier}
                firebaseConfig={auth.app.options}
                attemptInvisibleVerification={true}
            /> */}

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

                        <TouchableOpacity onPress={handleSendVerification} style={{ marginTop: 20 }}>
                            <Text style={styles.resendText}>Didn't receive a code? Resend</Text>
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
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', borderRadius: 12, paddingHorizontal: 15, height: 55, w1idth: '100%', marginBottom: 25, borderWidth: 1, borderColor: '#333' },
    input: { flex: 1, color: '#FFF', fontSize: 18, fontFamily: 'Poppins_600SemiBold', letterSpacing: 2 },
    btnMain: { backgroundColor: COLORS.accent, width: '100%', paddingVertical: 15, borderRadius: 30, alignItems: 'center' },
    btnText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    resendText: { color: COLORS.accent, fontSize: 14, fontFamily: 'Poppins_500Medium' }
});
