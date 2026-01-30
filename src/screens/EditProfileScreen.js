import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/legacy-theme.js';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';

export default function EditProfileScreen({ navigation }) {
  // Added updateUserProfile to imports
  const { userData, updateUserProfile, detectLocation } = useUser();
  const { theme } = useTheme();
  
  const [name, setName] = useState(userData.name);
  const [weight, setWeight] = useState(userData.weight ? userData.weight.toString() : '');
  const [height, setHeight] = useState(userData.height ? userData.height.toString() : '');
  const [location, setLocation] = useState(userData.location?.address || '');
  const [avatarUri, setAvatarUri] = useState(userData.avatar || null);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to grant access to your photos to change your profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleDetectLocation = async () => {
    const detectedAddress = await detectLocation();
    if (detectedAddress) {
      setLocation(detectedAddress);
    }
  };

  const handleSave = async () => {
      // Logic Update: Use updateUserProfile to save to Firebase + Local State
      await updateUserProfile({
          name: name,
          weight: parseFloat(weight) || userData.weight,
          height: parseFloat(height) || userData.height,
          location: { ...userData.location, address: location },
          avatar: avatarUri 
      });

      Alert.alert("Success", "Profile updated successfully!");
      navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={[styles.cancelText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSave}>
                <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.avatarSection}>
                <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
                    {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                    ) : (
                        <View style={[styles.avatarCircle, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <Text style={styles.avatarText}>{name.charAt(0)}</Text>
                        </View>
                    )}
                    <View style={styles.editBadge}>
                        <Ionicons name="pencil" size={14} color="#000" />
                    </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={pickImage}>
                    <Text style={styles.changePhotoText}>Change Profile Photo</Text>
                </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: theme.colors.subText }]}>Display Name</Text>
            <TextInput 
                style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text }]} 
                value={name} onChangeText={setName} 
            />

            <Text style={[styles.label, { color: theme.colors.subText }]}>Location</Text>
            
            <View style={[styles.inputContainer, { backgroundColor: theme.colors.card }]}>
                <TextInput 
                    style={[styles.inputFlex, { color: theme.colors.text }]} 
                    value={location} onChangeText={setLocation} placeholder="City, Country" placeholderTextColor="#666" 
                />
                <TouchableOpacity onPress={handleDetectLocation} style={styles.iconInside}>
                    <Ionicons name="navigate-circle-outline" size={24} color={COLORS.accent} />
                </TouchableOpacity>
            </View>
            
            <View style={styles.row}>
                <View style={{width: '48%'}}>
                    <Text style={[styles.label, { color: theme.colors.subText }]}>Weight (kg)</Text>
                    <TextInput 
                        style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text }]} 
                        value={weight} onChangeText={setWeight} keyboardType="numeric" 
                    />
                </View>
                <View style={{width: '48%'}}>
                    <Text style={[styles.label, { color: theme.colors.subText }]}>Height (cm)</Text>
                    <TextInput 
                        style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text }]} 
                        value={height} onChangeText={setHeight} keyboardType="numeric" 
                    />
                </View>
            </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold' },
  cancelText: { fontSize: 14, fontFamily: 'Poppins_400Regular' },
  saveText: { color: COLORS.accent, fontSize: 14, fontFamily: 'Poppins_700Bold' },
  content: { padding: 20 },
  
  avatarSection: { alignItems: 'center', marginBottom: 30 },
  avatarWrapper: { position: 'relative', marginBottom: 15 },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  avatarImage: { width: 100, height: 100, borderRadius: 50 },
  avatarText: { color: COLORS.accent, fontSize: 40, fontFamily: 'Poppins_700Bold' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.accent, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000' },
  changePhotoText: { color: COLORS.accent, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  
  label: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', marginBottom: 8, marginTop: 15, textTransform: 'uppercase' },
  input: { borderRadius: 8, padding: 15, fontFamily: 'Poppins_500Medium', fontSize: 16 },
  
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 15, height: 55 },
  inputFlex: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 16, height: '100%' },
  iconInside: { paddingLeft: 10 },

  row: { flexDirection: 'row', justifyContent: 'space-between' }
});