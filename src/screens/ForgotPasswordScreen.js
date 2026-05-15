import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect } from 'react';
import { Alert, Dimensions, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/legacy-theme.js';

// --- FIREBASE IMPORTS ---
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

const { width, height } = Dimensions.get('window');

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleReset = async () => {
    if (!email) {
        Alert.alert("Missing Email", "Please enter your email address.");
        return;
    }

    setIsLoading(true);

    try {
        const sendPasswordResetLink = httpsCallable(functions, 'sendPasswordResetLink');
        await sendPasswordResetLink({ email: email.trim().toLowerCase() });

        setCooldown(60);

        Alert.alert(
            "Check your inbox",
            `If an account exists for ${email}, a reset link has been sent. Check your spam folder if you don't see it.`,
            [{ text: "OK", onPress: () => navigation.navigate('Login') }]
        );
    } catch (error) {
        let errorMessage = "Could not send reset link. Please try again later.";
        if (error.code === 'auth/invalid-email') errorMessage = "Please enter a valid email address.";
        if (error.code === 'auth/too-many-requests') errorMessage = "Too many requests. Please try again later.";
        Alert.alert("Error", errorMessage);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background Blobs */}
      <View style={styles.backgroundContainer} pointerEvents="none">
          <View style={styles.floatingBlobTop} />
          <LinearGradient colors={['rgba(0,0,0,0.5)', '#000']} style={StyleSheet.absoluteFillObject} />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
            
            <View style={{ marginBottom: 30 }}>
                <Text style={styles.title}>Reset Password</Text>
                <Text style={styles.subtitle}>{"Enter the email associated with your account and we'll send you a link to reset it."}</Text>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>EMAIL ADDRESS</Text>
                <View style={[styles.inputContainer, isFocused && styles.inputFocused]}>
                    <Ionicons name="mail-outline" size={20} color={isFocused ? COLORS.accent : "#666"} style={{marginRight: 10}} />
                    <TextInput
                        style={styles.input}
                        placeholder="hello@runner.com"
                        placeholderTextColor="#444"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                    />
                </View>
            </View>

            <TouchableOpacity 
                style={[styles.resetBtn, (isLoading || cooldown > 0) && { opacity: 0.7 }]} 
                onPress={handleReset} 
                disabled={isLoading || cooldown > 0}
            >
                <Text style={styles.resetBtnText}>
                    {isLoading ? "SENDING..." : cooldown > 0 ? `RESEND IN ${cooldown}s` : "SEND RESET LINK"}
                </Text>
            </TouchableOpacity>

            {/* Escape Route to Login */}
            <TouchableOpacity style={styles.escapeBtn} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.escapeText}>Remember your password? <Text style={styles.escapeBold}>Log in</Text></Text>
            </TouchableOpacity>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  backgroundContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  floatingBlobTop: { position: 'absolute', top: -height * 0.1, right: -width * 0.2, width: width * 0.8, height: width * 0.8, borderRadius: width * 0.4, backgroundColor: COLORS.accent, opacity: 0.1, transform: [{ scale: 1.2 }] },
  
  backBtn: { padding: 20, width: 60 },
  content: { flex: 1, paddingHorizontal: 30, justifyContent: 'center', paddingBottom: 100 },
  
  title: { fontSize: 28, fontFamily: 'Poppins_700Bold', color: '#FFF' },
  subtitle: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: '#888', marginTop: 10, lineHeight: 22 },

  inputGroup: { marginBottom: 30, marginTop: 10 },
  label: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#666', letterSpacing: 1, marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', height: 55, borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#333' },
  inputFocused: { borderColor: COLORS.accent },
  input: { flex: 1, color: '#FFF', fontFamily: 'Poppins_500Medium', fontSize: 16 },
  
  resetBtn: { backgroundColor: '#FFF', height: 55, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: "#FFF", shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 10 },
  resetBtnText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_800ExtraBold', letterSpacing: 1 },
  
  escapeBtn: { alignSelf: 'center', marginTop: 30, padding: 10 },
  escapeText: { color: '#888', fontSize: 14, fontFamily: 'Poppins_400Regular' },
  escapeBold: { color: '#FFF', fontFamily: 'Poppins_700Bold' },
});