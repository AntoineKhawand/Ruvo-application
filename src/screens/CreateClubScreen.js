import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Dimensions, Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/legacy-theme.js';
import { useUser } from '../context/UserContext';

const { width } = Dimensions.get('window');

const CLUB_ICONS = [
    { id: 'run', icon: 'run', color: '#B2FF59' },
    { id: 'tree', icon: 'pine-tree', color: '#448AFF' },
    { id: 'fire', icon: 'fire', color: '#FF5722' },
    { id: 'leaf', icon: 'leaf', color: '#00E676' },
    { id: 'heart', icon: 'heart', color: '#E040FB' },
    { id: 'trophy', icon: 'trophy', color: '#7C4DFF' },
];

export default function CreateClubScreen({ navigation }) {
    // Get the addNewClub function from Context
    const { addNewClub } = useUser();

    const [privacy, setPrivacy] = useState('Public');
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [location, setLocation] = useState('');
    const [selectedIcon, setSelectedIcon] = useState(CLUB_ICONS[0]);
    const [bannerImage, setBannerImage] = useState(null);

    const pickBanner = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [16, 9],
                quality: 0.8,
            });
            if (!result.canceled) {
                setBannerImage(result.assets[0].uri);
            }
        } catch (error) {
            Alert.alert("Error", "Could not open gallery.");
        }
    };

    const handleCreate = () => {
        if (!name.trim()) return;

        const newClub = {
            // id: Date.now().toString(), // REMOVED: Let Firestore generate ID
            name: name,
            // members: '1 member', // REMOVED: UserContext handles this
            icon: selectedIcon.icon,
            color: selectedIcon.color,
            joined: true, // IMPORTANT: Creator joins automatically
            role: 'admin',
            type: privacy.toLowerCase(),
            desc: desc || 'No description provided.',
            image: bannerImage,
            isCustom: true,
            location: location // Added location field
        };

        // Call Context function to save to State & Firebase
        addNewClub(newClub);

        Alert.alert("Club Created", `Your club "${name}" is now live!`, [
            { text: "Go to Clubs", onPress: () => navigation.goBack() }
        ]);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Create a New Club</Text>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* 1. Icon Selector */}
                    <View style={styles.coverUpload}>
                        <View style={[styles.bigIconPreview, { backgroundColor: selectedIcon.color }]}>
                            <MaterialCommunityIcons name={selectedIcon.icon} size={40} color="#000" />
                        </View>
                        <Text style={styles.uploadText}>Select a club icon</Text>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 15, maxHeight: 60 }}>
                            {CLUB_ICONS.map((item) => (
                                <TouchableOpacity key={item.id} style={[styles.iconOption, selectedIcon.id === item.id && styles.iconOptionSelected]} onPress={() => setSelectedIcon(item)}>
                                    <MaterialCommunityIcons name={item.icon} size={24} color={selectedIcon.id === item.id ? item.color : '#666'} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* 2. Banner Image Picker */}
                    <Text style={styles.label}>Club Banner (Optional)</Text>
                    <TouchableOpacity style={styles.bannerUpload} onPress={pickBanner}>
                        {bannerImage ? (
                            <Image source={{ uri: bannerImage }} style={styles.bannerImage} />
                        ) : (
                            <View style={styles.bannerPlaceholder}>
                                <Ionicons name="image-outline" size={32} color="#666" />
                                <Text style={styles.uploadText}>Tap to add cover image</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Inputs */}
                    <Text style={styles.label}>Club Name</Text>
                    <TextInput style={styles.input} placeholder="e.g., Beirut Seaside Runners" placeholderTextColor="#555" value={name} onChangeText={setName} />

                    <Text style={styles.label}>Club Description</Text>
                    <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: 15 }]} placeholder="Tell us what your club is about..." placeholderTextColor="#555" multiline value={desc} onChangeText={setDesc} />

                    <Text style={styles.label}>Location (Optional)</Text>
                    <View style={styles.inputIconContainer}>
                        <Ionicons name="location-sharp" size={18} color="#666" style={{ marginRight: 10 }} />
                        <TextInput style={{ flex: 1, color: '#FFF', fontFamily: 'Poppins_400Regular' }} placeholder="e.g., Beirut, Lebanon" placeholderTextColor="#555" value={location} onChangeText={setLocation} />
                    </View>

                    <Text style={styles.label}>Club Privacy</Text>
                    <TouchableOpacity style={[styles.privacyBox, privacy === 'Public' ? styles.privacyActive : styles.privacyInactive]} onPress={() => setPrivacy('Public')}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                                <Ionicons name="globe-outline" size={18} color={privacy === 'Public' ? "#FFF" : "#888"} />
                                <Text style={[styles.privacyTitle, privacy === 'Public' ? { color: '#FFF' } : { color: '#888' }]}>Public</Text>
                            </View>
                            <Text style={styles.privacyDesc}>Anyone can find and join this club instantly.</Text>
                        </View>
                        {privacy === 'Public' ? <Ionicons name="checkmark-circle" size={22} color={COLORS.accent} /> : <View style={styles.radioCircle} />}
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.privacyBox, privacy === 'Private' ? styles.privacyActive : styles.privacyInactive]} onPress={() => setPrivacy('Private')}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                                <Ionicons name="lock-closed" size={16} color={privacy === 'Private' ? "#FFF" : "#888"} />
                                <Text style={[styles.privacyTitle, privacy === 'Private' ? { color: '#FFF' } : { color: '#888' }]}>Private</Text>
                            </View>
                            <Text style={styles.privacyDesc}>Invite-only, new members must be approved by admin.</Text>
                        </View>
                        {privacy === 'Private' ? <Ionicons name="checkmark-circle" size={22} color={COLORS.accent} /> : <View style={styles.radioCircle} />}
                    </TouchableOpacity>

                    <View style={{ height: 100 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}>
                <TouchableOpacity style={[styles.createBtn, !(name.trim()) && { opacity: 0.5 }]} disabled={!name.trim()} onPress={handleCreate}>
                    <Text style={styles.createBtnText}>Create Club</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 10 },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
    scrollContent: { padding: 20 },

    // Banner Styles
    bannerUpload: { height: 150, borderRadius: 16, overflow: 'hidden', marginBottom: 10, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed' },
    bannerImage: { width: '100%', height: '100%' },
    bannerPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },

    coverUpload: { padding: 20, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', borderRadius: 16, alignItems: 'center', marginBottom: 10, backgroundColor: '#111' },
    bigIconPreview: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    uploadText: { color: '#666', fontFamily: 'Poppins_400Regular', marginTop: 5 },
    iconOption: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center', marginHorizontal: 6, borderWidth: 1, borderColor: '#333' },
    iconOptionSelected: { borderColor: COLORS.accent, backgroundColor: '#222' },

    label: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 14, marginBottom: 10, marginTop: 15 },
    input: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 15, color: '#FFF', fontFamily: 'Poppins_400Regular', borderWidth: 1, borderColor: '#333' },
    inputIconContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#333' },
    privacyBox: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
    privacyActive: { borderColor: COLORS.accent, backgroundColor: 'rgba(178, 255, 89, 0.05)' },
    privacyInactive: { borderColor: '#333', backgroundColor: '#1C1C1E' },
    privacyTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', marginLeft: 8 },
    privacyDesc: { color: '#888', fontSize: 12, fontFamily: 'Poppins_400Regular', lineHeight: 18, marginTop: 4 },
    radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#666' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 30, backgroundColor: '#000', borderTopWidth: 1, borderTopColor: '#222' },
    createBtn: { backgroundColor: COLORS.accent, height: 55, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
    createBtnText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_700Bold' }
});