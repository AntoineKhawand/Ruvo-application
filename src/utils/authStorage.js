import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIO_ENABLED_KEY = 'RUVO_BIOMETRIC_ENABLED';
const RUVO_EMAIL_KEY = 'RUVO_STORED_EMAIL';
const RUVO_PASS_KEY = 'RUVO_STORED_PASS';

/**
 * Checks if device hardware supports biometrics and if a preferred method is enrolled.
 */
export const checkHardwareSupport = async () => {
    const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && isEnrolled;
};

/**
 * Prompts user to authenticate with biometrics.
 * @returns {boolean} True if successful, false otherwise.
 */
export const promptBiometricAuth = async () => {
    const isSupported = await checkHardwareSupport();
    if (!isSupported) return false;

    try {
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Authenticate to log in to Ruvo',
            fallbackLabel: 'Use Password',
            cancelLabel: 'Cancel',
            disableDeviceFallback: false,
        });
        return result.success;
    } catch (error) {
        console.error('Biometric Auth Error:', error);
        return false;
    }
};

/**
 * Stores credentials securely if user opts into biometrics.
 */
export const enableBiometricLogin = async (email, password) => {
    try {
        await Promise.all([
            SecureStore.setItemAsync(BIO_ENABLED_KEY, 'true'),
            SecureStore.setItemAsync(RUVO_EMAIL_KEY, email),
            SecureStore.setItemAsync(RUVO_PASS_KEY, password),
        ]);
        return true;
    } catch (error) {
        console.error('SecureStore Error:', error);
        return false;
    }
};

/**
 * Removes biometrics preference and stored credentials.
 */
export const disableBiometricLogin = async () => {
    try {
        await Promise.all([
            SecureStore.deleteItemAsync(BIO_ENABLED_KEY),
            SecureStore.deleteItemAsync(RUVO_EMAIL_KEY),
            SecureStore.deleteItemAsync(RUVO_PASS_KEY),
        ]);
        return true;
    } catch (error) {
        console.error('SecureStore Deletion Error:', error);
        return false;
    }
};

/**
 * Retrieves whether biometrics is currently enabled by the user.
 */
export const isBiometricEnabled = async () => {
    try {
        const value = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
        return value === 'true';
    } catch (error) {
        return false;
    }
};

/**
 * Retrieves stored credentials if biometrics is enabled.
 */
export const getStoredCredentials = async () => {
    try {
        const enabled = await isBiometricEnabled();
        if (!enabled) return null;

        const [email, password] = await Promise.all([
            SecureStore.getItemAsync(RUVO_EMAIL_KEY),
            SecureStore.getItemAsync(RUVO_PASS_KEY),
        ]);

        if (email && password) {
            return { email, password };
        }
        return null;
    } catch (error) {
        return null;
    }
};
