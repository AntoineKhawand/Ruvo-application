import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity, StatusBar, Image } from 'react-native';
import { COLORS } from '../constants/legacy-theme.js';
import { auth } from '../config/firebase'; 
import { signOut } from 'firebase/auth';

export default function WelcomeScreen({ navigation }) {
  // Inside your component:
  useEffect(() => {
    // UNCOMMENT THIS LINE ONCE TO CLEAR DATA, THEN COMMENT IT OUT AGAIN
    // signOut(auth); 
    // console.log("User signed out for testing!");
  }, []);
  return (
    <ImageBackground 
      source={require('../../assets/runner_cover.jpg')} 
      style={styles.background}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay} />

      <View style={styles.contentContainer}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/ruvo_logo.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.textSection}>
          <Text style={styles.title}>Take Control of Your Running Journey</Text>
          <Text style={styles.subtitle}>
            Track your progress, set new challenges, and conquer your goals with ease.
          </Text>

          <TouchableOpacity 
            style={styles.button} 
            onPress={() => navigation.navigate('Onboarding')}
          >
            <Text style={styles.buttonText}>Start Journey</Text>
          </TouchableOpacity>

          {/* ACTIVE LOGIN BUTTON */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('Login')} // <--- NOW ACTIVE
            style={{padding: 10}}
          >
            <Text style={styles.loginText}>
              Already have an account? <Text style={{fontFamily:'Poppins_700Bold', color: COLORS.accent}}>Log In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  contentContainer: { padding: 30, paddingBottom: 60, justifyContent: 'flex-end', flex: 1 },
  logoContainer: { marginBottom: 10, alignItems: 'flex-start', width: '100%' },
  logoImage: { width: 126, height: 60 },
  textSection: { width: '100%' },
  title: {
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 31, 
    color: COLORS.white,
    marginBottom: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
    lineHeight: 40,
  },
  subtitle: {
    fontFamily: 'Poppins_400Regular', 
    fontSize: 16,
    color: '#EEE',
    marginBottom: 30,
    lineHeight: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  button: {
    backgroundColor: COLORS.accent,
    padding: 14,
    borderRadius: 40,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    fontFamily: 'Poppins_700Bold', 
    color: '#121212',
    fontSize: 18,
  },
  loginText: {
    fontFamily: 'Poppins_400Regular', 
    color: '#EEE',
    textAlign: 'center',
    fontSize: 14,
  },
});