import { FontAwesome5, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons'; // Pro Mode Active
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Linking, Modal, PanResponder, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { formatDistance } from '../utils/units';

const { width, height } = Dimensions.get('window');

// Height settings for the collapsible dashboard
const DASHBOARD_MAX_HEIGHT = height * 0.75;
const DASHBOARD_NO_MUSIC_HEIGHT = height * 0.60;
const DASHBOARD_MIN_HEIGHT = 160;

const BRAND_COLORS = {
  accent: "#CCFF00",
  gold: "#FFD700",
  danger: "#FF3B30",
  card: "#121212",
  gray: "#333333"
};

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2C2C2C" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] }
];

const lightMapStyle = [];

const formatTime = (seconds) => {
  const getMinutes = `0${Math.floor(seconds / 60)}`.slice(-2);
  const getSeconds = `0${seconds % 60}`.slice(-2);
  return `${getMinutes}:${getSeconds}`;
};

// ✅ HELPER: Format Pace (Metric/Imperial)
const formatPace = (paceString, unitSystem = 'metric') => {
  if (paceString === '--:--') return '--:--';
  const [min, sec] = paceString.split(':').map(Number);

  if (unitSystem === 'imperial') {
    const totalMinutes = min + (sec / 60);
    const milesMinutes = totalMinutes * 1.60934;
    const mileMin = Math.floor(milesMinutes);
    const mileSec = Math.round((milesMinutes - mileMin) * 60);
    return `${mileMin}:${mileSec < 10 ? `0${mileSec}` : mileSec}`;
  }
  return paceString;
};

const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export default function ActiveRunScreen({ route, navigation }) {
  const { userData } = useUser();
  const userWeight = userData?.weight || 70;

  const mapRef = useRef(null);
  const viewShotRef = useRef(null);
  const { workoutMode, playlist, musicAppId, routeType, workout } = route.params || {};

  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [mapType, setMapType] = useState("standard");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showMapMenu, setShowMapMenu] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepTimeRemaining, setStepTimeRemaining] = useState(playlist ? playlist[0].duration : 0);
  const [distance, setDistance] = useState(0.00);
  const [pace, setPace] = useState("--:--");
  const [calories, setCalories] = useState(0);
  const [steps, setSteps] = useState(0);
  const [heartRate, setHeartRate] = useState(72); // Default / Fallback
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [elevationGain, setElevationGain] = useState(0);
  const [lastAltitude, setLastAltitude] = useState(null);
  const [locationSubscription, setLocationSubscription] = useState(null);

  // --- MAP SNAP STATE ---
  const [followUser, setFollowUser] = useState(true);
  const followUserRef = useRef(true);

  // --- MUSIC STATE (External Apps Only) ---
  const showMusicCard = musicAppId && musicAppId !== 'none';

  // BLE temporarily disabled due to native build issues

  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [laps, setLaps] = useState([]);

  // Sync ref for closure inside watchPosition
  useEffect(() => {
    followUserRef.current = followUser;
  }, [followUser]);

  // --- EXTERNAL MUSIC APP LOGIC ---
  const openMusicApp = () => {
    const appUrls = {
      spotify: Platform.OS === 'ios' ? 'spotify://' : 'spotify://open',
      apple: 'music://',
      anghami: 'anghami://'
    };

    const url = appUrls[musicAppId];
    if (url) {
      Linking.canOpenURL(url)
        .then(supported => {
          if (supported) {
            Linking.openURL(url);
          } else {
            Alert.alert('App Not Installed', `Please install ${musicAppId.charAt(0).toUpperCase() + musicAppId.slice(1)} to use this feature.`);
          }
        })
        .catch(err => console.error('Error opening music app:', err));
    }
  };

  // --- BLE HEART RATE LOGIC (DISABLED) ---
  // BLE code removed due to undefined dependencies causing crashes

  const activeMaxHeight = showMusicCard ? DASHBOARD_MAX_HEIGHT : DASHBOARD_NO_MUSIC_HEIGHT;
  const dashboardHeight = useRef(new Animated.Value(activeMaxHeight)).current;
  const finishProgress = useRef(new Animated.Value(0)).current;
  const recenterBtnOpacity = useRef(new Animated.Value(0)).current;

  const [isExpanded, setIsExpanded] = useState(true);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 50) collapseDashboard();
        else if (gestureState.dy < -50) expandDashboard();
      }
    })
  ).current;

  const collapseDashboard = () => {
    Animated.parallel([
      Animated.spring(dashboardHeight, { toValue: DASHBOARD_MIN_HEIGHT, useNativeDriver: false, friction: 8 }),
      Animated.timing(recenterBtnOpacity, { toValue: 1, duration: 300, useNativeDriver: true })
    ]).start();
    setIsExpanded(false);
  };

  const expandDashboard = () => {
    Animated.parallel([
      Animated.spring(dashboardHeight, { toValue: activeMaxHeight, useNativeDriver: false, friction: 8 }),
      Animated.timing(recenterBtnOpacity, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start();
    setIsExpanded(true);
  };

  const changeMapType = (type, darkModeSetting) => {
    setMapType(type);
    if (type === 'standard') setIsDarkMode(darkModeSetting);
    else setIsDarkMode(false);
  };

  const recenterMap = () => {
    setFollowUser(true); // ✅ Re-enable snapping
    if (mapRef.current && currentPosition) {
      mapRef.current.animateToRegion(currentPosition, 1000);
    }
  };

  // ✅ ANIMATE RE-CENTER BUTTON VISIBILITY
  useEffect(() => {
    Animated.timing(recenterBtnOpacity, {
      toValue: followUser ? 0 : 1, // Show only when NOT following
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [followUser]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const request = await Location.requestForegroundPermissionsAsync();
        if (request.status !== 'granted') {
          Alert.alert('Location Required', 'Ruvo needs location access to track your run.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
          return;
        }
      }
      try {
        let location = await Location.getCurrentPositionAsync({});
        const initialRegion = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        setCurrentPosition(initialRegion);
        setRouteCoordinates([{ latitude: location.coords.latitude, longitude: location.coords.longitude }]);
        startLocationTracking();
      } catch (error) {
        Alert.alert('Location Error', 'Unable to get your location.');
      }
    })();
    return () => { if (locationSubscription) locationSubscription.remove(); };
  }, []);

  const startLocationTracking = async () => {
    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 5 }, // ✅ Smoother tracking
      (newLocation) => {
        const { latitude, longitude, altitude, speed } = newLocation.coords;
        if (isActive) {
          setRouteCoordinates(prevRoute => {
            const lastCoord = prevRoute[prevRoute.length - 1];
            if (lastCoord) {
              const distIncrement = getDistanceFromLatLonInKm(lastCoord.latitude, lastCoord.longitude, latitude, longitude);
              if (distIncrement > 0.005) {
                setDistance(d => d + distIncrement);
                const burnt = distIncrement * userWeight * 1.036;
                setCalories(c => c + burnt);
              }
            }
            return [...prevRoute, { latitude, longitude }];
          });

          // ✅ INSTANT PACE
          if (speed && speed > 0) {
            const kmPerHour = speed * 3.6;
            const minPerKm = 60 / kmPerHour;
            const paceMin = Math.floor(minPerKm);
            const paceSec = Math.round((minPerKm - paceMin) * 60);
            const instantPace = `${paceMin}:${paceSec < 10 ? `0${paceSec}` : paceSec}`;
            setPace(formatPace(instantPace, userData?.unitSystem));
          } else {
            setPace("--:--");
          }

          if (altitude !== null) {
            setLastAltitude(prevAlt => {
              if (prevAlt !== null) {
                const diff = altitude - prevAlt;
                if (diff > 1.5) {
                  setElevationGain(prevGain => prevGain + diff);
                  return altitude;
                } else if (diff < -1.5) {
                  return altitude;
                }
                return prevAlt;
              }
              return altitude;
            });
          }

          const newRegion = { latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
          setCurrentPosition(newRegion);

          // ✅ CHECK FOLLOW USER
          if (mapRef.current && isExpanded && followUserRef.current) {
            mapRef.current.animateToRegion(newRegion, 500);
          }
        }
      }
    );
    setLocationSubscription(sub);
  };

  const speak = (text) => {
    if (isVoiceEnabled) {
      Speech.speak(text, { language: 'en', pitch: 1.0, rate: 0.9 });
    }
  };

  useEffect(() => {
    if (workoutMode && playlist && isActive) {
      const step = playlist[currentStepIndex];
      Speech.stop();
      speak(`${step.type}. ${step.name || ''}`);
    }
  }, [currentStepIndex, workoutMode, playlist]);

  const toggleVoice = () => {
    const newState = !isVoiceEnabled;
    setIsVoiceEnabled(newState);
    if (newState) Speech.speak("Voice feedback enabled");
  };

  const handleLap = () => {
    const newLap = { time: formatTime(seconds), distance: distance.toFixed(2), number: laps.length + 1 };
    setLaps([newLap, ...laps]);
    speak(`Lap ${newLap.number}`);
    Alert.alert("🏁 Lap Recorded", `${newLap.distance}km at ${pace}/km`);
  };

  const takeSnapshot = async () => {
    Alert.alert("Snapshot Disabled", "Feature temporarily disabled for stability.");
  };

  useEffect(() => {
    let interval = null;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds(sec => sec + 1);
        if (workoutMode && playlist) {
          setStepTimeRemaining(prev => {
            if (prev <= 1) {
              if (currentStepIndex < playlist.length - 1) {
                setCurrentStepIndex(old => old + 1);
                return playlist[currentStepIndex + 1].duration;
              } else return 0;
            }
            return prev - 1;
          });
        }
        setSteps(s => s + 2);

        // Simulate Heart Rate (Always on since BLE is removed)
        setHeartRate(prev => Math.min(Math.max(prev + (Math.random() > 0.5 ? 1 : -1), 110), 175));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, currentStepIndex]);

  const toggleTimer = () => {
    setIsActive(!isActive);
    isActive ? speak("Workout paused") : speak("Resuming workout");
  };

  const startFinishAnimation = () => {
    Animated.timing(finishProgress, { toValue: 1, duration: 1500, useNativeDriver: false }).start(({ finished }) => {
      if (finished) endRun();
    });
  };

  const resetFinishAnimation = () => {
    Animated.timing(finishProgress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const endRun = () => {
    setIsActive(false);
    if (locationSubscription) locationSubscription.remove();

    const runData = {
      distance: distance,
      pace: pace,
      calories: calories,
      heartRate: heartRate,
      time: formatTime(seconds),
      steps: steps,
      routePath: routeCoordinates,
      initialRegion: currentPosition,
      terrain: routeType || 'Flat Road',
      title: workout?.name || 'Free Run',
      type: workout?.type || 'Run',
      description: workout?.desc || '',
      elevationGain: Math.round(elevationGain)
    };

    navigation.navigate('SaveActivity', { runData: runData });
  };

  const currentStep = (workoutMode && playlist) ? playlist[currentStepIndex] : null;
  const getPolylineColor = () => (workoutMode && currentStep && currentStep.color) ? currentStep.color : BRAND_COLORS.accent;

  const progressWidth = finishProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });



  return (
    <View style={{ flex: 1 }}>
      {/* ViewShot Removed for Stability */}
      <View style={{ flex: 1 }}>
        <View style={styles.container}>
          <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

          {currentPosition && (
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              mapType={mapType}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
              initialRegion={currentPosition}
              showsUserLocation={true}
              showsMyLocationButton={false} // ✅ Disable default white square
              showsCompass={false}
              customMapStyle={mapType === 'standard' ? (isDarkMode ? darkMapStyle : lightMapStyle) : []}
              onPanDrag={() => setFollowUser(false)}
            >
              <Polyline coordinates={routeCoordinates} strokeColor={getPolylineColor()} strokeWidth={5} />
              {routeCoordinates.length > 0 && (
                <Marker coordinate={routeCoordinates[0]} anchor={{ x: 0.5, y: 0.5 }}><View style={[styles.startDot, { borderColor: getPolylineColor() }]} /></Marker>
              )}
            </MapView>
          )}

          <SafeAreaView style={styles.header} pointerEvents="box-none">
            {/* Spacer to maintain header layout balance */}
            <View />

            <View style={styles.headerCenter}>
              {workoutMode && currentStep ? (
                <View style={[styles.coachingCardHeader, { borderColor: currentStep.color || BRAND_COLORS.accent }]}>
                  <View style={styles.coachingTextContainer}>
                    <Text style={[styles.coachStepTitle, { color: currentStep.color || BRAND_COLORS.accent }]}>{currentStep.type}</Text>
                    <Text style={styles.coachStepName} numberOfLines={1}>{currentStep.name}</Text>
                  </View>
                  <View style={styles.verticalDivider} /><View style={styles.coachTimerBox}><Text style={styles.coachTimerText}>{formatTime(stepTimeRemaining)}</Text></View>
                </View>
              ) : (
                <View style={styles.liveBadgeHeader}><View style={[styles.liveIndicator, { opacity: seconds % 2 === 0 ? 1 : 0.5 }]} /><Text style={styles.liveText}>LIVE TRACKING</Text></View>
              )}
            </View>
            <TouchableOpacity style={[styles.iconButton, showMapMenu && { backgroundColor: BRAND_COLORS.accent }]} onPress={() => setShowMapMenu(true)}><Ionicons name="layers" size={24} color={showMapMenu ? "#000" : "#FFF"} /></TouchableOpacity>
          </SafeAreaView>

          {/* MAP MENU MODAL */}
          <Modal animationType="slide" transparent={true} visible={showMapMenu} onRequestClose={() => setShowMapMenu(false)}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMapMenu(false)}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}><Text style={styles.modalTitle}>Map type</Text><TouchableOpacity onPress={() => setShowMapMenu(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity></View>
                <View style={styles.mapOptionsRow}>
                  <TouchableOpacity style={styles.mapOptionItem} onPress={() => changeMapType('standard', true)}><View style={[styles.mapOptionIcon, mapType === 'standard' && isDarkMode && styles.selectedOption]}><Ionicons name="map" size={32} color={mapType === 'standard' && isDarkMode ? BRAND_COLORS.accent : "#FFF"} /></View><Text style={styles.mapOptionText}>Default</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.mapOptionItem} onPress={() => changeMapType('standard', false)}><View style={[styles.mapOptionIcon, mapType === 'standard' && !isDarkMode && styles.selectedOption, { backgroundColor: '#EEE' }]}><Ionicons name="sunny" size={32} color="#333" /></View><Text style={styles.mapOptionText}>Light</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.mapOptionItem} onPress={() => changeMapType('satellite', false)}><View style={[styles.mapOptionIcon, mapType === 'satellite' && styles.selectedOption, { backgroundColor: '#333' }]}><Ionicons name="earth" size={32} color={mapType === 'satellite' ? BRAND_COLORS.accent : "#FFF"} /></View><Text style={styles.mapOptionText}>Satellite</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.mapOptionItem} onPress={() => changeMapType('hybrid', false)}><View style={[styles.mapOptionIcon, mapType === 'hybrid' && styles.selectedOption, { backgroundColor: '#444' }]}><Ionicons name="layers" size={32} color={mapType === 'hybrid' ? BRAND_COLORS.accent : "#FFF"} /></View><Text style={styles.mapOptionText}>Hybrid</Text></TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* MUSIC SELECTION MODAL */}
          {/* MUSIC MODAL REMOVED FOR PRO MODE */}



          {/* RE-CENTER MAP BUTTON */}
          <Animated.View style={[styles.recenterBtnContainer, { opacity: recenterBtnOpacity }]}>
            <TouchableOpacity style={styles.recenterBtn} onPress={recenterMap}>
              <MaterialIcons name="my-location" size={24} color="#000" />
            </TouchableOpacity>
          </Animated.View>

          {/* DASHBOARD */}
          <Animated.View style={[styles.dashboard, { height: dashboardHeight }]}>
            <View style={styles.dragArea} {...panResponder.panHandlers}><View style={styles.dragHandle} /></View>

            <View style={styles.dashboardContent}>

              {/* 1. MAIN METRIC */}
              <View style={styles.mainMetricContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={styles.mainMetricValue}>{formatDistance(distance, userData?.unitSystem, 2).split(' ')[0]}</Text>
                  <Text style={[styles.mainMetricUnit, { color: BRAND_COLORS.accent }]}>{userData?.unitSystem === 'imperial' ? 'MI' : 'KM'}</Text>
                </View>
              </View>

              {/* COLLAPSE LOGIC */}
              <Animated.View style={{ opacity: isExpanded ? 1 : 0, flex: 1, overflow: 'hidden' }}>

                {/* 2. MUSIC PLAYER (Integrated) */}
                {/* 2. MUSIC PLAYER (Pro Mode - Conditional) */}
                {showMusicCard && (
                  <View style={styles.musicCard}>
                    <View style={styles.albumArtPlaceholder}>
                      <MaterialCommunityIcons
                        name={musicAppId === 'spotify' ? 'spotify' : musicAppId === 'apple' ? 'apple' : musicAppId === 'anghami' ? 'music-note' : 'music-circle'}
                        size={32}
                        color={musicAppId === 'spotify' ? '#1DB954' : musicAppId === 'anghami' ? '#945CFF' : '#FFF'}
                      />
                    </View>
                    <View style={styles.musicInfoCol}>
                      <Text style={styles.musicTrack}>External Audio Active</Text>
                      <Text style={styles.musicArtist}>Tap to Switch Playlist</Text>
                    </View>
                    <TouchableOpacity style={styles.openAppBtn} onPress={openMusicApp}>
                      <Text style={styles.openAppText}>OPEN APP</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 3. TOOLS ROW */}
                <View style={styles.toolRow}>
                  <TouchableOpacity style={styles.toolBtn} onPress={toggleVoice}>
                    <Ionicons name={isVoiceEnabled ? "volume-high" : "volume-mute"} size={20} color={isVoiceEnabled ? "#FFF" : "#666"} />
                    <Text style={[styles.toolText, !isVoiceEnabled && { color: '#666' }]}>{isVoiceEnabled ? "Voice On" : "Muted"}</Text>
                  </TouchableOpacity>
                  <View style={styles.toolDivider} />
                  <View style={styles.toolBtn}>
                    <MaterialCommunityIcons name="flag-variant" size={20} color={BRAND_COLORS.gold} />
                    <Text style={styles.toolText}>{laps.length} Laps</Text>
                  </View>
                </View>

                {/* 4. GRID STATS */}
                <View style={styles.gridContainer}>
                  <View style={styles.gridRow}>
                    <View style={styles.gridItemLeft}><Text style={styles.gridLabel}>TIME</Text><Text style={styles.gridValue}>{formatTime(seconds)}</Text></View>
                    <View style={styles.gridItemCenter}><Text style={styles.gridLabel}>PACE</Text><Text style={styles.gridValue}>{pace}</Text></View>
                    <View style={styles.gridItemRight}><Text style={styles.gridLabel}>KCAL</Text><Text style={styles.gridValue}>{Math.floor(calories)}</Text></View>
                  </View>

                  {/* Heart Rate Row (BLE Disabled - Simulated Only) */}
                  <View style={{ marginTop: 10 }}>
                    <View style={[styles.labelRow, { justifyContent: 'space-between' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <FontAwesome5 name="heartbeat" size={12} color={BRAND_COLORS.danger} />
                        <Text style={[styles.gridLabel, { marginLeft: 5 }]}>{heartRate} BPM</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', opacity: 0.5 }}>
                        <MaterialIcons name="bluetooth-disabled" size={14} color="#666" />
                        <Text style={{ color: "#666", fontSize: 10, marginLeft: 3 }}>SIMULATED</Text>
                      </View>
                    </View>
                    <View style={styles.hrBarBg}><View style={[styles.hrBarFill, { width: `${(heartRate / 200) * 100}%`, backgroundColor: BRAND_COLORS.danger }]} /></View>
                  </View>
                </View>

                {/* 5. CONTROLS ROW */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.controlButton} onPress={handleLap}>
                    <MaterialCommunityIcons name="flag-checkered" size={24} color="#FFF" />
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.mainControlBtn, isActive ? styles.pauseBtn : styles.resumeBtn]} onPress={toggleTimer} activeOpacity={0.8}>
                    <Ionicons name={isActive ? "pause" : "play"} size={22} color={isActive ? BRAND_COLORS.accent : "#000"} />
                    <Text style={[styles.textButtonLabel, isActive ? { color: BRAND_COLORS.accent } : { color: '#000' }]}>{isActive ? "PAUSE" : "RESUME"}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.controlButton} onPress={takeSnapshot}>
                    <Ionicons name="camera" size={24} color="#FFF" />
                  </TouchableOpacity>
                </View>

                {/* 6. FINISH BUTTON */}
                <TouchableOpacity style={[styles.textButton, styles.finishBtn]} onPressIn={startFinishAnimation} onPressOut={resetFinishAnimation} activeOpacity={1}>
                  <Animated.View style={[styles.finishProgressOverlay, { width: progressWidth }]} />
                  <View style={{ alignItems: 'center', zIndex: 2 }}>
                    <Text style={styles.finishBtnLabel}>HOLD TO FINISH</Text>
                    <Text style={styles.finishBtnSubLabel}>END SESSION</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>
        </View>
      </View >
    </View >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  headerCenter: { flex: 1, alignItems: 'center', marginHorizontal: 10 },
  liveBadgeHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(20,20,20,0.9)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 25, borderWidth: 1, borderColor: '#333' },
  liveIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', marginRight: 8 },
  liveText: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  coachingCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1E1E1E', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 25, borderWidth: 1, borderColor: '#333', minWidth: 180, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },
  coachingTextContainer: { alignItems: 'flex-start', justifyContent: 'center', flex: 1 },
  coachStepTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  coachStepName: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  verticalDivider: { width: 1, height: 24, backgroundColor: '#444', marginHorizontal: 10 },
  coachTimerBox: { alignItems: 'center', justifyContent: 'center' },
  coachTimerText: { color: '#FFF', fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#1E1E1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  mapOptionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mapOptionItem: { alignItems: 'center', width: '23%' },
  mapOptionIcon: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  selectedOption: { borderColor: "#CCFF00" },
  mapOptionText: { color: '#CCC', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  startDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFF', borderWidth: 3 },

  // DASHBOARD LAYOUT
  dashboard: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#121212', borderTopLeftRadius: 30, borderTopRightRadius: 30, alignItems: 'center', paddingBottom: 10 },
  dragArea: { width: '100%', height: 40, justifyContent: 'center', alignItems: 'center' },
  dragHandle: { width: 40, height: 5, backgroundColor: '#333', borderRadius: 2.5 },
  dashboardContent: { flex: 1, width: '100%', paddingHorizontal: 20 },

  // MAIN METRIC
  mainMetricContainer: { alignItems: 'center', marginTop: 10, marginBottom: 20 },
  mainMetricValue: { color: '#FFF', fontSize: 80, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -2 },
  mainMetricUnit: { fontSize: 20, fontWeight: '800', marginLeft: 5, color: BRAND_COLORS.accent },

  // MUSIC CARD
  musicCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 16, padding: 12, marginBottom: 25, borderWidth: 1, borderColor: '#333' },
  albumArtPlaceholder: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  musicInfoCol: { flex: 1, justifyContent: 'center' },
  musicTrack: { color: '#FFF', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  musicArtist: { color: '#AAA', fontSize: 12 },
  openAppBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: BRAND_COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  openAppText: { color: BRAND_COLORS.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // TOOL ROW
  toolRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 15, marginBottom: 25, borderWidth: 1, borderColor: '#252525' },
  toolBtn: { flexDirection: 'row', alignItems: 'center' },
  toolText: { color: '#FFF', fontSize: 12, fontWeight: '600', marginLeft: 8 },
  toolDivider: { width: 1, height: 20, backgroundColor: '#333' },

  // GRID STATS
  gridContainer: { marginBottom: 25 },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  gridItemLeft: { flex: 1, alignItems: 'flex-start' },
  gridItemCenter: { flex: 1, alignItems: 'center' },
  gridItemRight: { flex: 1, alignItems: 'flex-end' },
  gridLabel: { color: '#888', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  gridValue: { color: '#FFF', fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // HR ROW
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  hrBarBg: { height: 6, backgroundColor: '#333', borderRadius: 3, width: '100%', marginTop: 5 },
  hrBarFill: { height: 6, borderRadius: 3 },

  // CONTROLS ROW
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 15, paddingBottom: 10 },
  controlButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },

  mainControlBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 25 },
  pauseBtn: { backgroundColor: '#1A1A1A', borderColor: BRAND_COLORS.accent, borderWidth: 2 },
  resumeBtn: { backgroundColor: BRAND_COLORS.accent, borderColor: BRAND_COLORS.accent, borderWidth: 2 },
  textButtonLabel: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5, marginLeft: 8 },

  // FINISH BUTTON
  textButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 15, borderRadius: 30, overflow: 'hidden', position: 'relative' },
  finishBtn: { backgroundColor: '#FF3B30', width: '100%', marginTop: 20 },
  finishBtnLabel: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  finishBtnSubLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  finishProgressOverlay: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.3)', zIndex: 1 },

  // RECENTER BUTTON STYLES
  recenterBtnContainer: { position: 'absolute', bottom: DASHBOARD_MIN_HEIGHT + 30, right: 20, zIndex: 50 },
  recenterBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: BRAND_COLORS.accent, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },

  // TRACK ITEM STYLES
  trackItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  trackIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: BRAND_COLORS.accent, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  trackTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  trackArtist: { color: '#888', fontSize: 12 },
  trackDuration: { color: '#666', fontSize: 12 },

  // DEVICE ITEM STYLES
  deviceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  deviceName: { color: '#FFF', fontSize: 16, fontWeight: '600' }
});
