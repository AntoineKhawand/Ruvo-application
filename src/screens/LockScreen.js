import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/legacy-theme';
import { useUser } from '../context/UserContext';
import { promptBiometricAuth } from '../utils/authStorage';

export default function LockScreen() {
    const { unlockApp, logout } = useUser();
    const [authFailed, setAuthFailed] = useState(false);
    const [hasHardware, setHasHardware] = useState(false);

    useEffect(() => {
        const checkHardware = async () => {
            // Must check both: hardware presence AND enrolled credentials
            const hasAuth = await LocalAuthentication.hasHardwareAsync() &&
                            await LocalAuthentication.isEnrolledAsync();
            setHasHardware(hasAuth);

            // Auto-prompt on mount only if biometrics are actually enrolled
            if (hasAuth) {
                handleUnlock();
            }
        };
        checkHardware();
    }, []);

    const handleUnlock = async () => {
        setAuthFailed(false);
        const success = await promptBiometricAuth();

        if (success) {
            unlockApp();
        } else {
            setAuthFailed(true);
        }
    };

    const handleForceLogout = () => {
        Alert.alert(
            "Session Expired",
            "Are you sure you want to log out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Log Out",
                    style: "destructive",
                    onPress: async () => {
                        unlockApp(); // Reset lock state mechanically
                        await logout(); // Process real logout
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Image
                    source={require('../../assets/images/Ruvo Logo Original.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />

                <View style={styles.iconContainer}>
                    <Ionicons name="lock-closed" size={60} color={COLORS.accent} />
                </View>

                <Text style={styles.title}>Ruvo is Locked</Text>
                <Text style={styles.subtitle}>
                    For your security, your session has been temporarily locked due to inactivity.
                </Text>

                {authFailed && (
                    <Text style={styles.errorText}>
                        Authentication failed or was canceled.
                    </Text>
                )}
            </View>

            <View style={styles.footer}>
                {hasHardware && (
                    <TouchableOpacity style={styles.unlockBtn} onPress={handleUnlock}>
                        <Ionicons name="finger-print" size={24} color="#000" style={{ marginRight: 10 }} />
                        <Text style={styles.unlockBtnText}>Unlock Ruvo</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.logoutBtn} onPress={handleForceLogout}>
                    <Text style={styles.logoutBtnText}>Log Out</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    logo: {
        width: 150,
        height: 60,
        marginBottom: 50,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(204, 255, 0, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
        borderWidth: 1,
        borderColor: 'rgba(204, 255, 0, 0.3)',
    },
    title: {
        fontSize: 24,
        fontFamily: 'Poppins_700Bold',
        color: '#FFF',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 14,
        fontFamily: 'Poppins_400Regular',
        color: '#888',
        textAlign: 'center',
        lineHeight: 22,
    },
    errorText: {
        marginTop: 20,
        color: '#FF3B30',
        fontFamily: 'Poppins_500Medium',
        fontSize: 14,
    },
    footer: {
        padding: 30,
        width: '100%',
    },
    unlockBtn: {
        backgroundColor: COLORS.accent,
        height: 55,
        borderRadius: 30,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    unlockBtnText: {
        color: '#000',
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
    },
    logoutBtn: {
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoutBtnText: {
        color: '#888',
        fontSize: 14,
        fontFamily: 'Poppins_600SemiBold',
    }
});
