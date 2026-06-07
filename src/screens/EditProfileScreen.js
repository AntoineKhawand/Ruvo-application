import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';
import { storage } from '../config/firebase';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/legacy-theme.js';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { sanitizeInput } from '../utils/sanitize';
import UserAvatar from '../components/UserAvatar';

export default function EditProfileScreen({ navigation }) {
  const { userData, updateUserProfile, detectLocation, user } = useUser();
  const { theme } = useTheme();

  const [name, setName] = useState(userData.name);
  const [username, setUsername] = useState(userData.username || '');
  const [usernameError, setUsernameError] = useState('');
  const [bio, setBio] = useState(userData.bio || '');
  const [city, setCity] = useState(userData.city || '');
  const [weight, setWeight] = useState(userData.weight ? userData.weight.toString() : '');
  const [height, setHeight] = useState(userData.height ? userData.height.toString() : '');
  const [location, setLocation] = useState(userData.location?.address || '');
  const [avatarUri, setAvatarUri] = useState(userData.avatar || null);

  // Running Preferences
  const [preferredTime, setPreferredTime] = useState(userData.runningPreferences?.preferredTime || 'morning');
  const [favoriteDistance, setFavoriteDistance] = useState(userData.runningPreferences?.favoriteDistance || '5k');
  const [weeklyGoal, setWeeklyGoal] = useState(userData.runningPreferences?.weeklyGoal ? userData.runningPreferences.weeklyGoal.toString() : '');

  const [uploading, setUploading] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);

  const uploadAvatar = async (uri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const storageRef = ref(storage, `avatars/${user.uid}.jpg`);
      await uploadString(storageRef, base64, 'base64', { contentType: 'image/jpeg' });

      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Upload Failed', 'Could not upload avatar. Please try again.');
      return null;
    }
  };

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
    try {
      setUploading(true);

      let finalAvatarUrl = avatarUri;

      if (avatarUri && (avatarUri.startsWith('file://') || avatarUri.startsWith('content://'))) {
        finalAvatarUrl = await uploadAvatar(avatarUri);
        if (!finalAvatarUrl) {
          setUploading(false);
          return;
        }
      }

      // ✅ FIX CRITICAL-05: Strict validation to prevent NaN in Firestore
      const parsedWeight = parseFloat(weight);
      const finalWeight = isNaN(parsedWeight) ? (userData.weight || 0) : parsedWeight;

      const parsedHeight = parseFloat(height);
      const finalHeight = isNaN(parsedHeight) ? (userData.height || 0) : parsedHeight;

      // Validate username format: 3–20 chars, lowercase letters/numbers/underscores only
      const trimmedUsername = username.toLowerCase().trim();
      if (trimmedUsername) {
        if (!/^[a-z0-9_]{3,20}$/.test(trimmedUsername)) {
          setUploading(false);
          setUsernameError('3–20 characters: letters, numbers, underscores only.');
          return;
        }
        setUsernameError('');
      }

      // Save all profile data
      await updateUserProfile({
        name: sanitizeInput(name),
        username: trimmedUsername || null,
        bio: sanitizeInput(bio),
        city: sanitizeInput(city),
        weight: finalWeight,
        height: finalHeight,
        location: { ...userData.location, address: sanitizeInput(location) },
        avatar: finalAvatarUrl,
        runningPreferences: {
          preferredTime: preferredTime,
          favoriteDistance: favoriteDistance,
          weeklyGoal: parseFloat(weeklyGoal) || 0
        }
      });

      setUploading(false);
      Alert.alert("Success", "Profile updated successfully!");
      navigation.goBack();
    } catch (error) {
      setUploading(false);
      if (error.message === 'USERNAME_TAKEN') {
        setUsernameError('This username is already taken.');
      } else {
        console.error('Error saving profile:', error);
        Alert.alert("Error", "Could not save profile. Please try again.");
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} disabled={uploading}>
            <Text style={[styles.cancelText, { color: uploading ? '#666' : theme.colors.text }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
              <UserAvatar uri={avatarUri} name={name} size={90} borderColor={COLORS.accent} borderWidth={2} />
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

          <Text style={[styles.label, { color: theme.colors.subText }]}>Username</Text>
          <View style={[
            styles.usernameContainer,
            usernameFocused && styles.usernameContainerFocused,
            usernameError ? styles.usernameContainerError : null,
          ]}>
            <Text style={styles.usernameAt}>@</Text>
            <TextInput
              style={styles.usernameInput}
              value={username}
              onChangeText={(t) => { setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, '')); setUsernameError(''); }}
              onFocus={() => setUsernameFocused(true)}
              onBlur={() => setUsernameFocused(false)}
              placeholder="yourhandle"
              placeholderTextColor="#444"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            <Text style={[styles.usernameCounter, username.length === 20 && styles.usernameCounterMax]}>
              {username.length}/20
            </Text>
          </View>
          {usernameError ? (
            <View style={styles.usernameHintRow}>
              <Ionicons name="alert-circle-outline" size={12} color="#FF3B30" />
              <Text style={styles.usernameError}>{usernameError}</Text>
            </View>
          ) : username.length > 0 ? (
            <View style={styles.usernameHintRow}>
              <Ionicons name="link-outline" size={12} color="#555" />
              <Text style={styles.usernameHint}>ruvo.app/u/{username}</Text>
            </View>
          ) : (
            <View style={styles.usernameHintRow}>
              <Ionicons name="information-circle-outline" size={12} color="#444" />
              <Text style={styles.usernameHintMuted}>Letters, numbers and underscores only</Text>
            </View>
          )}

          <Text style={[styles.label, { color: theme.colors.subText, marginTop: 16 }]}>Bio</Text>
          <View>
            <TextInput
              style={[styles.bioInput, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
              value={bio}
              onChangeText={(text) => setBio(text.slice(0, 150))}
              placeholder="Tell others about your running journey..."
              placeholderTextColor="#666"
              multiline
              maxLength={150}
            />
            <Text style={[styles.charCount, { color: theme.colors.subText }]}>{bio.length}/150</Text>
          </View>

          <Text style={[styles.label, { color: theme.colors.subText }]}>City</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
            value={city}
            onChangeText={setCity}
            placeholder="e.g., Paris, New York"
            placeholderTextColor="#666"
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
            <View style={{ width: '48%' }}>
              <Text style={[styles.label, { color: theme.colors.subText }]}>Weight (kg)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
                value={weight} onChangeText={setWeight} keyboardType="numeric"
              />
            </View>
            <View style={{ width: '48%' }}>
              <Text style={[styles.label, { color: theme.colors.subText }]}>Height (cm)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
                value={height} onChangeText={setHeight} keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.colors.accent }]}>RUNNING PREFERENCES</Text>

          <Text style={[styles.label, { color: theme.colors.subText }]}>Preferred Running Time</Text>
          <View style={[styles.pickerContainer, { backgroundColor: theme.colors.card }]}>
            {['morning', 'afternoon', 'evening', 'night'].map((time) => (
              <TouchableOpacity
                key={time}
                style={[styles.pickerOption, preferredTime === time && { backgroundColor: COLORS.accent + '20' }]}
                onPress={() => setPreferredTime(time)}
              >
                <Ionicons
                  name={time === 'morning' ? 'sunny' : time === 'afternoon' ? 'partly-sunny' : time === 'evening' ? 'moon' : 'moon-outline'}
                  size={20}
                  color={preferredTime === time ? COLORS.accent : '#666'}
                />
                <Text style={[styles.pickerText, { color: preferredTime === time ? COLORS.accent : theme.colors.text }]}>
                  {time.charAt(0).toUpperCase() + time.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: theme.colors.subText }]}>Favorite Distance</Text>
          <View style={[styles.pickerContainer, { backgroundColor: theme.colors.card }]}>
            {[
              { value: '5k', label: '5K' },
              { value: '10k', label: '10K' },
              { value: 'half-marathon', label: 'Half Marathon' },
              { value: 'marathon', label: 'Marathon' }
            ].map((distance) => (
              <TouchableOpacity
                key={distance.value}
                style={[styles.pickerOption, favoriteDistance === distance.value && { backgroundColor: COLORS.accent + '20' }]}
                onPress={() => setFavoriteDistance(distance.value)}
              >
                <Text style={[styles.pickerText, { color: favoriteDistance === distance.value ? COLORS.accent : theme.colors.text }]}>
                  {distance.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: theme.colors.subText }]}>Weekly Goal (km)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
            value={weeklyGoal}
            onChangeText={setWeeklyGoal}
            placeholder="e.g., 20"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
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
  content: { padding: 20, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', marginBottom: 30 },
  avatarWrapper: { position: 'relative', marginBottom: 15 },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  avatarImage: { width: 100, height: 100, borderRadius: 50 },
  avatarText: { color: COLORS.accent, fontSize: 40, fontFamily: 'Poppins_700Bold' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.accent, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000' },
  changePhotoText: { color: COLORS.accent, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },

  sectionTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold', marginTop: 25, marginBottom: 10, letterSpacing: 1 },
  label: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', marginBottom: 8, marginTop: 15, textTransform: 'uppercase' },
  input: { borderRadius: 8, padding: 15, fontFamily: 'Poppins_500Medium', fontSize: 16 },
  bioInput: { borderRadius: 8, padding: 15, fontFamily: 'Poppins_500Medium', fontSize: 16, minHeight: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 11, fontFamily: 'Poppins_400Regular', textAlign: 'right', marginTop: 5 },

  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 15, height: 55 },
  inputFlex: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 16, height: '100%' },
  iconInside: { paddingLeft: 10 },

  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    height: 56,
    paddingHorizontal: 16,
  },
  usernameContainerFocused: {
    borderColor: COLORS.accent,
    backgroundColor: '#0D0D0D',
  },
  usernameContainerError: {
    borderColor: '#FF3B30',
  },
  usernameAt: {
    color: COLORS.accent,
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    marginRight: 6,
  },
  usernameInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
    height: '100%',
  },
  usernameCounter: {
    color: '#444',
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    marginLeft: 8,
  },
  usernameCounterMax: {
    color: '#FF9500',
  },
  usernameHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    marginLeft: 4,
  },
  usernameError: {
    color: '#FF3B30',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  usernameHint: {
    color: '#555',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  usernameHintMuted: {
    color: '#444',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },

  row: { flexDirection: 'row', justifyContent: 'space-between' },

  pickerContainer: { borderRadius: 8, padding: 8, marginBottom: 10 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 6, marginBottom: 4 },
  pickerText: { fontSize: 15, fontFamily: 'Poppins_500Medium', marginLeft: 10 }
});