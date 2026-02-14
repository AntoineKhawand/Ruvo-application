import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, Linking, Modal, Platform, ScrollView, Share, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
// Forced update
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/legacy-theme.js';
import { useUser } from '../context/UserContext';

const { width } = Dimensions.get('window');

// Minimal 1-second silent MP3
// Minimal 1-second silent WAV logic moved to takeAudioControl

// ...

// ...

const MUSIC_SOURCES = [
  {
    id: 'anghami',
    name: 'Anghami',
    icon: 'music-note',
    lib: 'MaterialCommunityIcons',
    color: '#945CFF',
    sub: 'Play Your Likes',
    iosStore: 'https://apps.apple.com/us/app/anghami-play-music-podcasts/id517600392',
    androidStore: 'https://play.google.com/store/apps/details?id=com.anghami'
  },
  {
    id: 'spotify',
    name: 'Spotify',
    icon: 'spotify',
    lib: 'FontAwesome5',
    color: '#1DB954',
    sub: 'Open App',
    iosStore: 'https://apps.apple.com/us/app/spotify-music-and-podcasts/id324684580',
    androidStore: 'https://play.google.com/store/apps/details?id=com.spotify.music'
  },
  {
    id: 'apple',
    name: 'Apple Music',
    icon: 'music',
    lib: 'FontAwesome5',
    color: '#FA243C',
    sub: 'Open App',
    iosStore: 'https://apps.apple.com/us/app/apple-music/id1108187390',
    androidStore: 'https://play.google.com/store/apps/details?id=com.apple.android.music'
  },

  {
    id: 'none',
    name: 'No Music',
    icon: 'volume-mute',
    lib: 'Ionicons',
    color: '#888',
    sub: 'Focus Mode'
  },
];

const TERRAIN_OPTIONS = [
  { id: 'Flat Road', icon: 'map-outline', lib: 'Ionicons' },
  { id: 'Hilly Route', icon: 'image-filter-hdr', lib: 'MaterialCommunityIcons' },
  { id: 'Trail Path', icon: 'pine-tree', lib: 'MaterialCommunityIcons' },
  { id: 'Track (400m)', icon: 'flag-checkered', lib: 'MaterialCommunityIcons' },
];

const WARMUP_EXERCISES = [
  { name: 'High Knees (30s)', icon: 'run', lib: 'MaterialCommunityIcons' },
  { name: 'Leg Swings (30s)', icon: 'human-handsdown', lib: 'MaterialCommunityIcons' },
  { name: 'Butt Kicks (30s)', icon: 'run-fast', lib: 'MaterialCommunityIcons' },
  { name: 'Lunge Twist (30s)', icon: 'rotate-3d-variant', lib: 'MaterialCommunityIcons' },
];

export default function WorkoutDetailScreen({ route, navigation }) {
  // 1. SAFE FALLBACK DATA
  const { workout } = route.params || {};
  const safeWorkout = workout || { title: 'Run', desc: 'Go Run', intensity: 'Low', duration: 30, type: 'Run' };

  // 2. FIX: USE TITLE OR NAME (Corrected Logic)
  const workoutTitle = safeWorkout.title || safeWorkout.name || "Workout";

  const { userData, addRunToHistory, updateUserProfile } = useUser();
  const soundRef = useRef(null);

  const [musicVisible, setMusicVisible] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState('anghami');
  const [selectedRoute, setSelectedRoute] = useState('Flat Road');

  const [linkedDevices, setLinkedDevices] = useState({
    garmin: userData?.linkedGarmin || false,
    health: userData?.linkedHealth || false
  });

  useEffect(() => {
    setLinkedDevices({
      garmin: userData?.linkedGarmin || false,
      health: userData?.linkedHealth || false
    });
  }, [userData]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const getDynamicDescription = () => {
    if (safeWorkout.desc && safeWorkout.desc !== 'Go Run') return safeWorkout.desc;
    return `A ${safeWorkout.duration || 30}-minute session focusing on ${safeWorkout.intensity ? safeWorkout.intensity.toLowerCase() : 'steady'} intensity.`;
  };

  const workoutSteps = useMemo(() => {
    // 1. If custom steps exist (from AI Coach), use them
    if (safeWorkout.customSteps) return safeWorkout.customSteps;

    // 2. NEW FIX: REST DAY LOGIC
    // If it's a Rest Day, show Recovery structure instead of Run structure
    if (safeWorkout.type === 'Rest' || (safeWorkout.title && safeWorkout.title.includes('Rest')) || safeWorkout.intensity === 'Rest') {
      return [
        {
          type: 'Recovery',
          color: '#4CD964',
          steps: [
            { id: 1, text: 'Full Rest (No Running)', icon: 'bed', durationSec: 0 },
            { id: 2, text: 'Hydrate & Sleep', icon: 'water', durationSec: 0 }
          ]
        },
        {
          type: 'Optional',
          steps: [
            { id: 3, text: '15 min Mobility/Stretching', icon: 'yoga', durationSec: 900 },
            { id: 4, text: 'Light Walk', icon: 'walk', durationSec: 1200 }
          ]
        }
      ];
    }

    // 3. Default Logic (Fallback for Active Runs)
    const totalTime = safeWorkout.duration || 30;
    const warmUp = 5;
    const coolDown = 5;
    const mainSetTime = Math.max(totalTime - warmUp - coolDown, 10);

    // Fallback for missing steps
    return [
      { type: 'Warm-Up', steps: [{ id: 1, text: `${warmUp} mins easy walk`, icon: 'walk', durationSec: warmUp * 60 }] },
      { type: 'Main Effort', color: '#CCFF00', steps: [{ id: 2, text: `${mainSetTime} mins steady run`, icon: 'run', durationSec: mainSetTime * 60 }] },
      { type: 'Cool Down', steps: [{ id: 3, text: `${coolDown} mins cool down`, icon: 'walk', durationSec: coolDown * 60 }] }
    ];
  }, [safeWorkout]);

  const handleWarmUp = () => setWarmupVisible(true);
  const handleAddRoute = () => setRouteVisible(true);
  const handleLinkActivity = () => setLinkVisible(true);

  const handleSkipWorkout = () => {
    Alert.alert("Skip Workout", "Log as Rest Day?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Rest", style: 'destructive', onPress: () => {
          addRunToHistory({ date: new Date().toISOString(), distance: 0, duration: '00:00', pace: '0:00', calories: 0, title: 'Rest Day', type: 'Rest', badgeEarned: null });
          navigation.goBack();
        }
      }
    ]);
  };

  const handleStartWorkout = () => {
    // PREVENT STARTING A REST DAY LIKE A RUN
    if (safeWorkout.type === 'Rest' || safeWorkout.intensity === 'Rest') {
      Alert.alert("Rest Day", "Today is for recovery. Enjoy your rest!", [{ text: "OK" }]);
      return;
    }

    let flatSteps = [];
    if (workoutSteps) {
      workoutSteps.forEach(section => {
        let loops = 1;
        if (section.type && section.type.includes('(x')) {
          const match = section.type.match(/\(x(\d+)/);
          if (match) loops = parseInt(match[1]);
        }
        for (let i = 0; i < loops; i++) {
          if (section.steps) {
            section.steps.forEach(step => {
              flatSteps.push({
                name: step.text,
                type: step.icon.includes('walk') || step.icon.includes('human') ? 'WALK' : 'RUN',
                duration: step.durationSec,
                color: section.color || '#FFF'
              });
            });
          }
        }
      });
    }

    if (selectedMusic === 'none') takeAudioControl();
    else releaseAudioControl();

    navigation.navigate('ActiveRun', { workoutMode: true, playlist: flatSteps, musicAppId: selectedMusic, routeType: selectedRoute, initialTrackIndex: selectedTrackIndex });
  };

  const takeAudioControl = async () => {
    try {
      console.log("Attempting to take audio control (No Music)...");
      if (soundRef.current) await soundRef.current.unloadAsync();

      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 1, // DoNotMix
        interruptionModeAndroid: 1, // DoNotMix
        shouldDuckAndroid: false, // Don't duck, pause them
        playThroughEarpieceAndroid: false
      });

      // Ensure cache directory exists and clear old file
      const uri = FileSystem.cacheDirectory + 'silence.wav';
      const fileInfo = await FileSystem.getInfoAsync(uri);

      console.log("Cleaning up old silent file...");
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }

      console.log("Writing new valid silent wav...");
      // Valid WAV: 8-bit Mono 8kHz, ~100ms of silence (Header + Data)
      // RIFF header + fmt + data chunk with 0x80 (silence)
      const wavBase64 = 'UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACAgICAgICAgICAgICAgICAgICA';

      await FileSystem.writeAsStringAsync(uri, wavBase64, { encoding: 'base64' });

      console.log("Playing silent wav from:", uri);
      // Play immediately
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, isLooping: true });
      soundRef.current = sound;
      console.log("Silent sound playing successfully.");

    } catch (error) {
      console.log("Audio Focus Error:", error);
      Alert.alert("Audio Error", "Failed to silence music: " + error.message);
    }
  };

  const releaseAudioControl = async () => {
    try {
      if (soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null; }
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false
      });
    } catch (error) { console.log("Audio Release Error:", error); }
  };

  const openMusicApp = async (appId) => {
    const musicSource = MUSIC_SOURCES.find(m => m.id === appId);
    if (!musicSource || appId === 'none') return;
    let appUrl = appId === 'anghami' ? 'anghami://' : (appId === 'spotify' ? 'spotify://' : 'music://');
    let storeUrl = Platform.OS === 'ios' ? musicSource.iosStore : musicSource.androidStore;
    Linking.openURL(appUrl).catch(() => { if (storeUrl) Linking.openURL(storeUrl).catch(() => Alert.alert("Error", "Could not open Store")); else Alert.alert("App Not Found", "Please install the music app."); });
  };



  const handleMusicSelect = async (id) => {
    setSelectedMusic(id);
    if (id === 'none') {
      await takeAudioControl();
    }
    else { await releaseAudioControl(); openMusicApp(id); }
    setTimeout(() => setMusicVisible(false), 500);
  };

  const toggleDevice = (service, currentValue) => {
    const newValue = !currentValue;
    setLinkedDevices(prev => ({ ...prev, [service]: newValue }));
    const updateObj = service === 'health' ? { linkedHealth: newValue } : { linkedGarmin: newValue };
    updateUserProfile(updateObj);
  };

  const handleShare = async () => { try { await Share.share({ message: `🔥 Training on Ruvo! "${workoutTitle}"`, title: `Ruvo Training` }); } catch (error) { } };

  const getTerrainButtonData = () => {
    const data = TERRAIN_OPTIONS.find(t => t.id === selectedRoute) || TERRAIN_OPTIONS[0];
    return { icon: data.icon, lib: data.lib, label: selectedRoute.replace(' ', '\n') };
  };
  const terrainBtnData = getTerrainButtonData();

  const ActionButton = ({ icon, label, library = "Ionicons", onPress }) => (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
      <View style={styles.actionIconCircle}>
        {library === "Ionicons" ? <Ionicons name={icon} size={24} color="#FFF" /> : <MaterialCommunityIcons name={icon} size={24} color="#FFF" />}
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  // Helper to determine if we should show the "Start" button or just a "Rest" indicator
  const isRestDay = safeWorkout.type === 'Rest' || safeWorkout.intensity === 'Rest';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[COLORS.accent, '#121212']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }} style={styles.gradientBg} />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.headerNav}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={28} color="#FFF" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Details</Text>
          <TouchableOpacity onPress={handleShare}><Ionicons name="share-outline" size={24} color="#FFF" /></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.dateText}>TODAY'S SESSION</Text>

          {/* FIX: USING THE CORRECTED TITLE VARIABLE */}
          <Text style={styles.workoutTitle}>{workoutTitle}</Text>

          <Text style={styles.subTitle}>{getDynamicDescription()}</Text>

          {!isRestDay && (
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={20} color="#FFF" /><Text style={styles.timeText}>~{safeWorkout.duration || 30}m</Text>
            </View>
          )}

          {/* HIDE ACTIONS ON REST DAY */}
          {!isRestDay && (
            <View style={styles.actionsRow}>
              <ActionButton icon="body" label={`Warm-Up\nChecklist`} onPress={handleWarmUp} />
              <ActionButton icon={terrainBtnData.icon} library={terrainBtnData.lib} label={terrainBtnData.label} onPress={handleAddRoute} />
              <ActionButton icon="link-outline" label={`Sync\nApps`} onPress={handleLinkActivity} />
              <ActionButton icon="repeat" label={`Skip\nSession`} onPress={handleSkipWorkout} />
            </View>
          )}

          <View style={styles.divider} />

          <TouchableOpacity style={styles.descRow}>
            <Ionicons name="document-text-outline" size={20} color="#AAA" />
            <Text style={styles.descText}>{isRestDay ? "Recovery Plan" : "Workout Structure"}</Text>
          </TouchableOpacity>

          {workoutSteps && workoutSteps.map((section, index) => (
            <View key={index} style={styles.sectionContainer}>
              <View style={[styles.sectionHeader, section.color && { backgroundColor: section.color + '20' }]}>
                {section.color && <Ionicons name="repeat" size={16} color={section.color} style={{ marginRight: 5 }} />}
                <Text style={[styles.sectionHeaderText, section.color ? { color: section.color, fontWeight: 'bold' } : { color: '#AAA' }]}>{section.type}</Text>
              </View>
              {section.steps && section.steps.map((step, sIndex) => (
                <View key={sIndex} style={styles.stepRow}>
                  <Text style={styles.stepNumber}>{step.id || sIndex + 1}</Text>
                  <View style={styles.stepVerticalLine} />
                  <Text style={styles.stepText}>{step.text}</Text>
                  <View style={styles.stepTag}>
                    <MaterialCommunityIcons
                      name={step.icon === 'bed' ? 'bed' : (step.icon === 'yoga' ? 'yoga' : (step.icon === 'water' ? 'water' : (step.icon && step.icon.includes('run') ? 'run' : 'walk')))}
                      size={16}
                      color="#AAA"
                    />
                  </View>
                </View>
              ))}
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.bottomBar}>
          {/* DISABLE START BUTTON ON REST DAY */}
          <TouchableOpacity
            style={[styles.mainStartButton, isRestDay && { backgroundColor: '#333' }]}
            onPress={handleStartWorkout}
            disabled={isRestDay}
          >
            <Ionicons name={isRestDay ? "moon" : "play"} size={24} color={isRestDay ? "#AAA" : "#000"} />
            <Text style={[styles.mainStartText, isRestDay && { color: "#AAA" }]}>
              {isRestDay ? "Enjoy Your Rest" : "Start Workout"}
            </Text>
          </TouchableOpacity>

          {!isRestDay && (
            <TouchableOpacity style={[styles.musicButton, selectedMusic !== 'none' && styles.musicButtonActive]} onPress={() => setMusicVisible(true)}>
              <Ionicons name="musical-notes" size={24} color={selectedMusic !== 'none' ? "#000" : "#FFF"} />
            </TouchableOpacity>
          )}
        </View>

        {/* MODALS */}
        <Modal animationType="slide" transparent={true} visible={musicVisible} onRequestClose={() => setMusicVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMusicVisible(false)}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}><Text style={styles.modalTitle}>Soundtrack</Text><TouchableOpacity onPress={() => setMusicVisible(false)}><Ionicons name="close-circle" size={28} color="#666" /></TouchableOpacity></View>
              {MUSIC_SOURCES.map((item) => (
                <TouchableOpacity key={item.id} style={[styles.musicOption, selectedMusic === item.id && styles.musicOptionSelected]} onPress={() => handleMusicSelect(item.id)}>
                  <View style={[styles.musicIconBox, { backgroundColor: item.color + '20' }]}>
                    {item.lib === 'Ionicons' ? <Ionicons name={item.icon} size={24} color={item.color} /> : (item.lib === 'MaterialCommunityIcons' ? <MaterialCommunityIcons name={item.icon} size={24} color={item.color} /> : <FontAwesome5 name={item.icon} size={22} color={item.color} />)}
                  </View>
                  <View style={{ flex: 1, marginLeft: 15 }}>
                    <Text style={[styles.musicName, selectedMusic === item.id && { color: COLORS.accent }]}>{item.name}</Text>
                    <Text style={styles.musicSub}>
                      {item.sub}
                    </Text>
                  </View>
                  {selectedMusic === item.id && <Ionicons name="checkmark-circle" size={24} color={COLORS.accent} />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal animationType="slide" transparent={true} visible={warmupVisible} onRequestClose={() => setWarmupVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setWarmupVisible(false)}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}><Text style={styles.modalTitle}>Pre-Run Warmup</Text><TouchableOpacity onPress={() => setWarmupVisible(false)}><Ionicons name="close-circle" size={28} color="#666" /></TouchableOpacity></View>
              {WARMUP_EXERCISES.map((ex, i) => (
                <View key={i} style={styles.musicOption}>
                  <View style={[styles.musicIconBox, { backgroundColor: '#333' }]}><MaterialCommunityIcons name={ex.icon} size={24} color={COLORS.accent} /></View>
                  <Text style={[styles.musicName, { marginLeft: 15 }]}>{ex.name}</Text>
                </View>
              ))}
              <TouchableOpacity style={styles.modalMainBtn} onPress={() => setWarmupVisible(false)}><Text style={styles.mainStartText}>I'm Ready</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal animationType="slide" transparent={true} visible={routeVisible} onRequestClose={() => setRouteVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setRouteVisible(false)}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}><Text style={styles.modalTitle}>Select Terrain</Text><TouchableOpacity onPress={() => setRouteVisible(false)}><Ionicons name="close-circle" size={28} color="#666" /></TouchableOpacity></View>
              {TERRAIN_OPTIONS.map((item, i) => (
                <TouchableOpacity key={i} style={[styles.musicOption, selectedRoute === item.id && styles.musicOptionSelected]} onPress={() => setSelectedRoute(item.id)}>
                  <View style={[styles.musicIconBox, { backgroundColor: '#333' }]}>
                    {item.lib === 'Ionicons' ? <Ionicons name={item.icon} size={20} color={selectedRoute === item.id ? COLORS.accent : '#FFF'} /> : <MaterialCommunityIcons name={item.icon} size={20} color={selectedRoute === item.id ? COLORS.accent : '#FFF'} />}
                  </View>
                  <View style={{ flex: 1, marginLeft: 15 }}><Text style={[styles.musicName, { color: selectedRoute === item.id ? COLORS.accent : '#FFF' }]}>{item.id}</Text></View>
                  {selectedRoute === item.id && <Ionicons name="checkmark-circle" size={24} color={COLORS.accent} />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.modalMainBtn} onPress={() => setRouteVisible(false)}><Text style={styles.mainStartText}>Confirm Terrain</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal animationType="slide" transparent={true} visible={linkVisible} onRequestClose={() => setLinkVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setLinkVisible(false)}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}><Text style={styles.modalTitle}>Sync Settings</Text><TouchableOpacity onPress={() => setLinkVisible(false)}><Ionicons name="close-circle" size={28} color="#666" /></TouchableOpacity></View>
              <View style={styles.switchRow}><View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="logo-apple" size={24} color="#FFF" style={{ marginRight: 15 }} /><Text style={styles.musicName}>Apple Health</Text></View><Switch value={linkedDevices.health} onValueChange={(val) => toggleDevice('health', linkedDevices.health)} trackColor={{ true: COLORS.accent }} /></View>
              <View style={styles.switchRow}><View style={{ flexDirection: 'row', alignItems: 'center' }}><MaterialCommunityIcons name="watch-variant" size={24} color="#007CC3" style={{ marginRight: 15 }} /><Text style={styles.musicName}>Garmin Connect</Text></View><Switch value={linkedDevices.garmin} onValueChange={(val) => toggleDevice('garmin', linkedDevices.garmin)} trackColor={{ true: '#007CC3' }} /></View>
              <Text style={{ color: '#666', fontSize: 12, marginTop: 20, textAlign: 'center' }}>Syncing is {linkedDevices.health || linkedDevices.garmin ? 'Active' : 'Paused'}.</Text>
            </View>
          </TouchableOpacity>
        </Modal>



      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  gradientBg: { position: 'absolute', width: '100%', height: 400 },
  headerNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_600SemiBold' },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  dateText: { color: COLORS.accent, fontSize: 12, fontFamily: 'Poppins_700Bold', letterSpacing: 1, marginBottom: 5 },
  workoutTitle: { color: '#FFF', fontSize: 32, fontFamily: 'Poppins_700Bold', marginBottom: 5 },
  subTitle: { color: '#DDD', fontSize: 16, fontFamily: 'Poppins_400Regular', marginBottom: 15 },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  timeText: { color: '#FFF', fontSize: 16, marginLeft: 8, fontFamily: 'Poppins_500Medium' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  actionBtn: { alignItems: 'center', width: 80 },
  actionIconCircle: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: '#444', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionLabel: { color: '#AAA', fontSize: 10, textAlign: 'center', fontFamily: 'Poppins_500Medium', lineHeight: 14 },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 10 },
  descRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  descText: { color: '#FFF', fontSize: 16, marginLeft: 10, fontFamily: 'Poppins_600SemiBold' },
  sectionContainer: { marginBottom: 20, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#333' },
  sectionHeader: { padding: 10, paddingHorizontal: 15, backgroundColor: '#333', flexDirection: 'row', alignItems: 'center' },
  sectionHeaderText: { color: '#AAA', fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderTopWidth: 1, borderTopColor: '#2C2C2C' },
  stepNumber: { color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold', width: 30, textAlign: 'center' },
  stepVerticalLine: { width: 1, height: '80%', backgroundColor: '#444', marginRight: 15 },
  stepText: { flex: 1, color: '#FFF', fontSize: 14, fontFamily: 'Poppins_500Medium' },
  stepTag: { flexDirection: 'row', alignItems: 'center' },
  stepTagText: { color: '#FFF', fontSize: 12, marginLeft: 5, fontFamily: 'Poppins_700Bold' },
  bottomBar: { position: 'absolute', bottom: 0, width: '100%', flexDirection: 'row', padding: 20, paddingBottom: 30, backgroundColor: '#121212', borderTopWidth: 1, borderTopColor: '#333' },
  mainStartButton: { flex: 1, backgroundColor: COLORS.accent, borderRadius: 30, height: 55, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  mainStartText: { color: '#000', fontSize: 18, fontFamily: 'Poppins_700Bold', marginLeft: 10 },
  musicButton: { width: 55, height: 55, borderRadius: 15, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  musicButtonActive: { backgroundColor: COLORS.accent },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
  musicOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  musicOptionSelected: { backgroundColor: 'rgba(178, 255, 89, 0.05)', marginHorizontal: -20, paddingHorizontal: 20 },
  musicIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  musicName: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
  musicSub: { color: '#888', fontSize: 12, fontFamily: 'Poppins_400Regular' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  modalMainBtn: { backgroundColor: COLORS.accent, borderRadius: 30, paddingVertical: 15, alignItems: 'center', marginTop: 20 }
});