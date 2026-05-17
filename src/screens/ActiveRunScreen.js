import { FontAwesome5, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, AppState, DeviceEventEmitter, Dimensions, Easing, Modal, PanResponder, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from '../components/Map';
import { useUser } from '../context/UserContext';
import { formatDistance } from '../utils/units';
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';
import { observeHeartRate, requestHealthPermissions } from '../services/healthService';
const { height } = Dimensions.get('window');

const DASHBOARD_NO_MUSIC_HEIGHT = height * 0.7;
const DASHBOARD_MIN_HEIGHT = 240;

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

const getHrZone = (hr, age = 30) => {
  const maxHr = 220 - age;
  const percent = hr / maxHr;
  if (percent >= 0.9) return { zone: 5, color: '#FF3B30', name: 'Max' };
  if (percent >= 0.8) return { zone: 4, color: '#FF9500', name: 'Threshold' };
  if (percent >= 0.7) return { zone: 3, color: '#FFCC00', name: 'Aerobic' };
  if (percent >= 0.6) return { zone: 2, color: '#34C759', name: 'Fat Burn' };
  if (percent >= 0.5) return { zone: 1, color: '#5AC8FA', name: 'Warm Up' };
  return { zone: 0, color: '#8E8E93', name: 'Resting' };
};

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

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) { console.error("Background Location Error:", error); return; }
  if (data) {
    const { locations } = data;
    DeviceEventEmitter.emit('onBackgroundLocation', locations);
  }
});

export default function ActiveRunScreen({ route, navigation }) {
  const { userData } = useUser();
  const insets = useSafeAreaInsets();
  const userWeight = userData?.weight || 70;

  const mapRef = useRef(null);
  const { workoutMode, playlist, routeType, workout } = route.params || {};

  const [seconds, setSeconds] = useState(0);
  const secondsRef = useRef(0);
  const [isActive, setIsActive] = useState(true);
  const startTimeRef = useRef(Date.now());
  const secondsAtPauseRef = useRef(0);
  const kmSplitsRef = useRef([]);
  const lastKmSecondsRef = useRef(0);
  const [mapType, setMapType] = useState("standard");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showMapMenu, setShowMapMenu] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepTimeRemaining, setStepTimeRemaining] = useState(playlist?.length ? (playlist[0].durationSec || playlist[0].duration || 0) : 0);
  const [distance, setDistance] = useState(0.00);
  const [pace, setPace] = useState("--:--");
  const [calories, setCalories] = useState(0);
  const [steps, setSteps] = useState(0);
  const [heartRate, setHeartRate] = useState(0);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [elevationGain, setElevationGain] = useState(0);
  const [lastAltitude, setLastAltitude] = useState(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [laps, setLaps] = useState([]);
  const [hrHistory, setHrHistory] = useState(Array(30).fill(0));
  const [activeTab, setActiveTab] = useState('overview');
  const [currentTime, setCurrentTime] = useState(new Date());

  const [followUser, setFollowUser] = useState(true);
  const followUserRef = useRef(true);

  const activeMaxHeight = DASHBOARD_NO_MUSIC_HEIGHT;
  const dashboardHeight = useRef(new Animated.Value(activeMaxHeight)).current;
  const finishProgress = useRef(new Animated.Value(0)).current;
  const recenterBtnOpacity = useRef(new Animated.Value(0)).current;
  const tabAnim = useRef(new Animated.Value(0)).current;

  const [isExpanded, setIsExpanded] = useState(true);
  const isExpandedRef = useRef(isExpanded);
  useEffect(() => { isExpandedRef.current = isExpanded; }, [isExpanded]);

  const contentOpacity = dashboardHeight.interpolate({
    inputRange: [DASHBOARD_MIN_HEIGHT, activeMaxHeight],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });

  useEffect(() => {
    Animated.spring(tabAnim, {
      toValue: activeTab === 'overview' ? 0 : 1,
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
  }, [activeTab]);

  const leftTabHeight = tabAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 48] });
  const leftTabTranslateY = tabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const leftTabBorderRadius = tabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 50] });

  const rightTabHeight = tabAnim.interpolate({ inputRange: [0, 1], outputRange: [48, 100] });
  const rightTabTranslateY = tabAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] });
  const rightTabBorderRadius = tabAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] });

  const mainBodyTopLeftRadius = tabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 36] });
  const mainBodyTopRightRadius = tabAnim.interpolate({ inputRange: [0, 1], outputRange: [36, 0] });

  const overviewOpacity = tabAnim.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0] });
  const overviewTranslateY = tabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });

  const chartsOpacity = tabAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1] });
  const chartsTranslateY = tabAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        let newHeight = isExpandedRef.current ? activeMaxHeight - gestureState.dy : DASHBOARD_MIN_HEIGHT - gestureState.dy;
        if (newHeight >= DASHBOARD_MIN_HEIGHT && newHeight <= activeMaxHeight) {
          dashboardHeight.setValue(newHeight);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 50) collapseDashboard();
        else if (gestureState.dy < -50) expandDashboard();
        else {
          if (isExpandedRef.current) expandDashboard();
          else collapseDashboard();
        }
      }
    })
  ).current;

  const collapseDashboard = () => {
    lightTap();
    Animated.parallel([
      Animated.timing(dashboardHeight, { toValue: DASHBOARD_MIN_HEIGHT, duration: 300, easing: Easing.out(Easing.poly(3)), useNativeDriver: false }),
      Animated.timing(recenterBtnOpacity, { toValue: 1, duration: 300, useNativeDriver: true })
    ]).start();
    setIsExpanded(false);
  };

  const expandDashboard = () => {
    lightTap();
    Animated.parallel([
      Animated.timing(dashboardHeight, { toValue: activeMaxHeight, duration: 300, easing: Easing.out(Easing.poly(3)), useNativeDriver: false }),
      Animated.timing(recenterBtnOpacity, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start();
    setIsExpanded(true);
  };

  const changeMapType = (type, darkModeSetting) => {
    lightTap();
    setMapType(type);
    if (type === 'standard') setIsDarkMode(darkModeSetting);
    else setIsDarkMode(false);
  };

  const recenterMap = () => {
    lightTap();
    setFollowUser(true);
    if (mapRef.current && currentPosition) {
      mapRef.current.animateToRegion(currentPosition, 1000);
    }
  };

  useEffect(() => {
    Animated.timing(recenterBtnOpacity, {
      toValue: followUser ? 0 : 1,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [followUser]);

  useEffect(() => {
    (async () => {
      let { status: fgStatus } = await Location.getForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        let result = await Location.requestForegroundPermissionsAsync();
        fgStatus = result.status;
      }
      if (fgStatus !== 'granted') {
        Alert.alert('Location Required', 'Ruvo needs location access to track your run.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        return;
      }

      let { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        let result = await Location.requestBackgroundPermissionsAsync();
        bgStatus = result.status;
      }
      if (bgStatus !== 'granted') {
        Alert.alert('Background Tracking Warning', 'To track your run while your phone is locked in your pocket, please go to Settings and change location access to "Always Allow".', [{ text: 'Got it' }]);
      }

      try {
        const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 300000 });
        if (lastKnown) {
          const lastRegion = { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
          setCurrentPosition(lastRegion);
          mapRef.current?.animateToRegion(lastRegion, 500);
        }
      } catch (_) {}

      try {
        let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
        const initialRegion = { latitude: location.coords.latitude, longitude: location.coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
        setCurrentPosition(initialRegion);
        setRouteCoordinates([{ latitude: location.coords.latitude, longitude: location.coords.longitude }]);
        if (mapRef.current) mapRef.current.animateToRegion(initialRegion, 1000);
        startLocationTracking();
        speak("Run started. GPS tracking active.");
      } catch (error) {
        Alert.alert('Location Error', 'Unable to get your location.');
      }
    })();

    return () => { stopLocationTracking(); };
  }, []);

  const startLocationTracking = async () => {
    try {
      const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
      if (alreadyRunning) return;
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 5,
        showsBackgroundLocationIndicator: true,
        foregroundService: { notificationTitle: "Ruvo Active Run", notificationBody: "Tracking your distance...", notificationColor: "#000000" },
      });
    } catch (err) { console.warn('[ActiveRun] startLocationTracking error:', err); }
  };

  const stopLocationTracking = async () => {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
      if (hasStarted) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch (err) { console.warn('[ActiveRun] stopLocationTracking error:', err); }
  };

  const MAX_RUNNING_SPEED_MS = 25 / 3.6;

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('onBackgroundLocation', (locations) => {
      if (!isActive) return;

      locations.forEach(newLocation => {
        const { latitude, longitude, altitude, speed, accuracy } = newLocation.coords;
        const timestamp = newLocation.timestamp || Date.now();
        let didAddPoint = false;

        const isTooFast = speed !== null && speed !== undefined && speed > MAX_RUNNING_SPEED_MS;
        if (isTooFast) {
          setCurrentPosition({ latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 });
          return;
        }

        setRouteCoordinates(prevRoute => {
          const lastCoord = prevRoute[prevRoute.length - 1];
          if (lastCoord) {
            const distIncrement = getDistanceFromLatLonInKm(lastCoord.latitude, lastCoord.longitude, latitude, longitude);
            if (distIncrement > 0.005) {
              if (lastCoord.timestamp) {
                const timeDiffSeconds = (timestamp - lastCoord.timestamp) / 1000;
                if (timeDiffSeconds > 0) {
                  const impliedSpeedMs = (distIncrement * 1000) / timeDiffSeconds;
                  if (impliedSpeedMs > MAX_RUNNING_SPEED_MS) return prevRoute;
                }
              }
              setDistance(d => {
                const next = d + distIncrement;
                const prevKm = Math.floor(d);
                const nextKm = Math.floor(next);
                if (nextKm > prevKm) {
                  const now = secondsRef.current;
                  kmSplitsRef.current.push({ km: nextKm, splitSeconds: now - lastKmSecondsRef.current });
                  lastKmSecondsRef.current = now;
                }
                return next;
              });
              setCalories(c => c + distIncrement * userWeight * 1.036);
              didAddPoint = true;
              return [...prevRoute, { latitude, longitude, timestamp, speed: speed || 0, accuracy: accuracy || 0 }];
            } else {
              return prevRoute;
            }
          }
          didAddPoint = true;
          return [...prevRoute, { latitude, longitude, timestamp, speed: speed || 0, accuracy: accuracy || 0 }];
        });

        if (speed && speed > 0) {
          const kmPerHour = speed * 3.6;
          const minPerKm = 60 / kmPerHour;
          const paceMin = Math.floor(minPerKm);
          const paceSec = Math.round((minPerKm - paceMin) * 60);
          setPace(formatPace(`${paceMin}:${paceSec < 10 ? `0${paceSec}` : paceSec}`, userData?.unitSystem));
        }

        if (altitude !== null) {
          setLastAltitude(prevAlt => {
            if (prevAlt !== null) {
              const diff = altitude - prevAlt;
              if (diff > 1.5) { setElevationGain(g => g + diff); return altitude; }
              else if (diff < -1.5) return altitude;
              return prevAlt;
            }
            return altitude;
          });
        }

        if (didAddPoint) {
          const newRegion = { latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
          setCurrentPosition(newRegion);
          if (mapRef.current && isExpanded && followUserRef.current) {
            mapRef.current.animateToRegion(newRegion, 1000);
          }
        }
      });
    });

    return () => subscription.remove();
  }, [isActive, userWeight, isExpanded]);

  const speak = (text) => {
    if (isVoiceEnabled) Speech.speak(text, { language: 'en', pitch: 1.0, rate: 0.9 });
  };

  useEffect(() => {
    Speech.isSpeakingAsync().catch(() => {});
    speak("Starting your session. Waiting for GPS signal.");
  }, []);

  // Real heart rate from HealthKit (iOS) — no-op on Android
  useEffect(() => {
    let stopObserver = () => {};
    requestHealthPermissions().then(granted => {
      if (!granted) return;
      stopObserver = observeHeartRate((hr) => {
        setHeartRate(hr);
        setHrHistory(prev => [...prev.slice(1), hr]);
      });
    });
    return () => stopObserver();
  }, []);

  useEffect(() => {
    if (workoutMode && playlist && isActive) {
      const step = playlist[currentStepIndex];
      Speech.stop();
      speak(`${step.type}. ${step.name || ''}`);
    }
  }, [currentStepIndex, workoutMode, playlist]);

  const toggleVoice = () => {
    lightTap();
    const newState = !isVoiceEnabled;
    setIsVoiceEnabled(newState);
    if (newState) Speech.speak("Voice feedback enabled");
  };

  const handleLap = () => {
    lightTap();
    const newLap = { time: formatTime(seconds), distance: distance.toFixed(2), number: laps.length + 1 };
    setLaps([newLap, ...laps]);
    speak(`Lap ${newLap.number}`);
    Alert.alert("🏁 Lap Recorded", `${newLap.distance}km at ${pace}/km`);
  };

  const takeSnapshot = async () => {
    errorFeedback();
    Alert.alert("Snapshot Disabled", "Feature temporarily disabled for stability.");
  };

  useEffect(() => {
    if (!isActive) return;
    startTimeRef.current = Date.now() - secondsAtPauseRef.current * 1000;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      secondsRef.current = elapsed;
      setSeconds(elapsed);
      setCurrentTime(new Date());

      if (workoutMode && playlist) {
        setStepTimeRemaining(prev => {
          if (prev <= 1) {
            if (currentStepIndex < playlist.length - 1) {
              setCurrentStepIndex(old => old + 1);
              return playlist[currentStepIndex + 1].durationSec || playlist[currentStepIndex + 1].duration || 0;
            } else return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, currentStepIndex]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isActive) {
        setSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    });
    return () => sub.remove();
  }, [isActive]);

  const toggleTimer = () => {
    lightTap();
    const nextActive = !isActive;
    if (!nextActive) {
      secondsAtPauseRef.current = seconds;
      speak("Workout paused");
      stopLocationTracking();
    } else {
      startTimeRef.current = Date.now() - secondsAtPauseRef.current * 1000;
      speak("Resuming workout");
      startLocationTracking();
    }
    setIsActive(nextActive);
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
    successFeedback();
    setIsActive(false);
    stopLocationTracking();
    navigation.navigate('RateEffort', {
      runData: {
        distance, pace, calories, heartRate,
        time: formatTime(seconds), steps,
        routePath: routeCoordinates,
        initialRegion: currentPosition,
        terrain: routeType || 'Flat Road',
        title: workout?.name || 'Free Run',
        type: workout?.type || 'Run',
        description: workout?.desc || '',
        elevationGain: Math.round(elevationGain),
        kmSplits: kmSplitsRef.current,
      }
    });
  };

  const currentStep = (workoutMode && playlist) ? playlist[currentStepIndex] : null;
  const getPolylineColor = () => (workoutMode && currentStep && currentStep.color) ? currentStep.color : BRAND_COLORS.accent;

  const progressWidth = finishProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const renderBars = () => {
    const step = Math.max(1, Math.floor(hrHistory.length / 13));
    const sampled = hrHistory.filter((_, i) => i % step === 0).slice(0, 13);
    return sampled.map((hr, i) => (
      <View key={i} style={styles.newBarContainer}>
        <View style={[styles.newBar, { height: `${(hr / 200) * 100}%` }, hr > 160 && styles.newBarPeak]} />
      </View>
    ));
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <View style={styles.container}>
          <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            mapType={mapType}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
            initialRegion={currentPosition || {
              latitude: userData?.location?.latitude || 0,
              longitude: userData?.location?.longitude || 0,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation={true}
            showsMyLocationButton={false}
            showsCompass={false}
            customMapStyle={mapType === 'standard' ? (isDarkMode ? darkMapStyle : lightMapStyle) : []}
            onPanDrag={() => setFollowUser(false)}
          >
            <Polyline coordinates={routeCoordinates} strokeColor={getPolylineColor()} strokeWidth={5} />
            {routeCoordinates.length > 0 && (
              <Marker coordinate={routeCoordinates[0]} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[styles.startDot, { borderColor: getPolylineColor() }]} />
              </Marker>
            )}
          </MapView>

          <SafeAreaView style={styles.header} pointerEvents="box-none">
            <View style={styles.headerDateContainer}>
              {workoutMode && currentStep ? (
                <View style={styles.coachingHeaderContent}>
                  <View style={[styles.coachIndicator, { backgroundColor: currentStep.color || BRAND_COLORS.accent }]} />
                  <Text style={styles.headerDateText}>{currentStep.type}: {formatTime(stepTimeRemaining)}</Text>
                </View>
              ) : (
                <Text style={styles.headerDateText}>
                  {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} | {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()}
                </Text>
              )}
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity activeOpacity={0.7} style={[styles.headerActionButton, showMapMenu && { backgroundColor: BRAND_COLORS.accent }]} onPress={() => { lightTap(); setShowMapMenu(true); }}>
                <Ionicons name="layers" size={22} color={showMapMenu ? "#000" : "#FFF"} />
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} style={[styles.headerActionButton, { marginLeft: 10 }]} onPress={() => { lightTap(); navigation.goBack(); }}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* MAP MENU MODAL */}
          <Modal animationType="slide" transparent={true} visible={showMapMenu} onRequestClose={() => setShowMapMenu(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.modalOverlay} onPress={() => { lightTap(); setShowMapMenu(false); }}>
              <View style={[styles.modalContent, { paddingBottom: Math.max(20, insets.bottom) }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Map type</Text>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setShowMapMenu(false); }}>
                    <Ionicons name="close" size={24} color="#FFF" />
                  </TouchableOpacity>
                </View>
                <View style={styles.mapOptionsRow}>
                  <TouchableOpacity activeOpacity={0.7} style={styles.mapOptionItem} onPress={() => changeMapType('standard', true)}><View style={[styles.mapOptionIcon, mapType === 'standard' && isDarkMode && styles.selectedOption]}><Ionicons name="map" size={32} color={mapType === 'standard' && isDarkMode ? BRAND_COLORS.accent : "#FFF"} /></View><Text style={styles.mapOptionText}>Default</Text></TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7} style={styles.mapOptionItem} onPress={() => changeMapType('standard', false)}><View style={[styles.mapOptionIcon, mapType === 'standard' && !isDarkMode && styles.selectedOption, { backgroundColor: '#EEE' }]}><Ionicons name="sunny" size={32} color="#333" /></View><Text style={styles.mapOptionText}>Light</Text></TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7} style={styles.mapOptionItem} onPress={() => changeMapType('satellite', false)}><View style={[styles.mapOptionIcon, mapType === 'satellite' && styles.selectedOption, { backgroundColor: '#333' }]}><Ionicons name="earth" size={32} color={mapType === 'satellite' ? BRAND_COLORS.accent : "#FFF"} /></View><Text style={styles.mapOptionText}>Satellite</Text></TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7} style={styles.mapOptionItem} onPress={() => changeMapType('hybrid', false)}><View style={[styles.mapOptionIcon, mapType === 'hybrid' && styles.selectedOption, { backgroundColor: '#444' }]}><Ionicons name="layers" size={32} color={mapType === 'hybrid' ? BRAND_COLORS.accent : "#FFF"} /></View><Text style={styles.mapOptionText}>Hybrid</Text></TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* RE-CENTER MAP BUTTON */}
          <Animated.View style={[styles.recenterBtnContainer, { opacity: recenterBtnOpacity }]}>
            <TouchableOpacity activeOpacity={0.7} style={styles.recenterBtn} onPress={recenterMap}>
              <MaterialIcons name="my-location" size={24} color="#000" />
            </TouchableOpacity>
          </Animated.View>

          {/* DASHBOARD */}
          <Animated.View style={[styles.dashboard, { height: dashboardHeight }]}>

            <Animated.View style={{ opacity: contentOpacity, flex: 1, paddingHorizontal: 20 }}>

              {/* Morphing Tabs Row */}
              <View style={styles.newTabsRow}>

                {/* Left Tab — Overview */}
                <Animated.View style={[
                  styles.newTabBlock,
                  { width: '54%', height: leftTabHeight, transform: [{ translateY: leftTabTranslateY }] },
                  activeTab === 'overview' ? styles.newTabActive : styles.newTabInactive,
                  { borderBottomLeftRadius: leftTabBorderRadius, borderBottomRightRadius: leftTabBorderRadius },
                ]}>
                  <TouchableOpacity activeOpacity={1} onPress={() => { lightTap(); setActiveTab('overview'); }} style={StyleSheet.absoluteFill}>
                    <Animated.View style={[styles.newTabContentFull, { opacity: overviewOpacity, paddingHorizontal: 20 }]}>
                      <View style={styles.newBigDistanceRow}>
                        <Text style={styles.newBigDistance}>
                          {formatDistance(distance, userData?.unitSystem, 1).split(' ')[0]}
                        </Text>
                        <Text style={styles.newSubDistance}>
                          {userData?.unitSystem === 'imperial' ? 'mi' : 'km'} of {workout?.goalDistance || 10} {userData?.unitSystem === 'imperial' ? 'mi' : 'km'}
                        </Text>
                      </View>
                    </Animated.View>
                    <Animated.View style={[styles.newTabContentPill, { opacity: chartsOpacity }]}>
                      <FontAwesome5 name="file-alt" size={14} color="#8e939a" />
                      <Text style={styles.newPillText}>Overview</Text>
                    </Animated.View>
                  </TouchableOpacity>
                </Animated.View>

                {/* Right Tab — Charts */}
                <Animated.View style={[
                  styles.newTabBlock,
                  { width: '42%', height: rightTabHeight, transform: [{ translateY: rightTabTranslateY }] },
                  activeTab === 'charts' ? styles.newTabActive : styles.newTabInactive,
                  { borderBottomLeftRadius: rightTabBorderRadius, borderBottomRightRadius: rightTabBorderRadius },
                ]}>
                  <TouchableOpacity activeOpacity={1} onPress={() => { lightTap(); setActiveTab('charts'); }} style={StyleSheet.absoluteFill}>
                    <Animated.View style={[styles.newTabContentFullRight, { opacity: chartsOpacity, paddingHorizontal: 20 }]}>
                      <Text style={styles.newChartTitleText}>Heart rate</Text>
                      <FontAwesome5 name="caret-down" size={12} color="#8e939a" style={{ marginLeft: 6 }} />
                    </Animated.View>
                    <Animated.View style={[styles.newTabContentPill, { opacity: overviewOpacity }]}>
                      <FontAwesome5 name="chart-bar" size={14} color="#8e939a" />
                      <Text style={styles.newPillText}>Charts</Text>
                    </Animated.View>
                  </TouchableOpacity>
                </Animated.View>

              </View>

              {/* Main Body Glass Card */}
              <Animated.View style={[
                styles.newMainBody,
                { borderTopLeftRadius: mainBodyTopLeftRadius, borderTopRightRadius: mainBodyTopRightRadius },
              ]}>

                {/* Drag Handle — inside the glass card */}
                <View style={styles.dragArea} {...panResponder.panHandlers}>
                  <View style={styles.dragHandle} />
                </View>

                {/* Overview Panel */}
                <Animated.View
                  pointerEvents={activeTab === 'overview' ? 'auto' : 'none'}
                  style={[styles.newBodyPanel, { opacity: overviewOpacity, transform: [{ translateY: overviewTranslateY }] }]}
                >
                  <View style={styles.toolRow}>
                    <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={toggleVoice}>
                      <Ionicons name={isVoiceEnabled ? "volume-high" : "volume-mute"} size={16} color={isVoiceEnabled ? "#FFF" : "#666"} />
                      <Text style={[styles.toolText, !isVoiceEnabled && { color: '#666' }]}>{isVoiceEnabled ? "Voice On" : "Muted"}</Text>
                    </TouchableOpacity>
                    <View style={styles.toolDivider} />
                    <View style={styles.toolBtn}>
                      <MaterialCommunityIcons name="flag-variant" size={16} color={BRAND_COLORS.gold} />
                      <Text style={styles.toolText}>{laps.length} Laps</Text>
                    </View>
                  </View>
                  <View style={styles.newStatsList}>
                    {[
                      { label: 'Workout Time', val: formatTime(seconds) },
                      { label: 'Active Calories', val: `${Math.floor(calories)} kcal` },
                      { label: 'Heart Rate', val: heartRate > 0 ? `${heartRate} bpm` : '--', alert: heartRate > 160 },
                      { label: 'Avr pace', val: pace !== '--:--' ? `${pace.split(':')[0]}'${pace.split(':')[1] || '00'}"` : '--:--' },
                      { label: 'Elevation', val: `${Math.round(elevationGain)} m` },
                    ].map((stat, idx) => (
                      <View key={idx} style={styles.newStatRow}>
                        <Text style={styles.newStatLabel}>{stat.label}</Text>
                        <Text style={[styles.newStatVal, stat.alert && styles.newStatValAlert]}>{stat.val}</Text>
                      </View>
                    ))}
                  </View>
                </Animated.View>

                {/* Charts Panel */}
                <Animated.View
                  pointerEvents={activeTab === 'charts' ? 'auto' : 'none'}
                  style={[styles.newBodyPanel, { opacity: chartsOpacity, transform: [{ translateY: chartsTranslateY }] }]}
                >
                  <View style={{ flex: 1, flexDirection: 'row' }}>
                    <View style={styles.newYAxis}>
                      <Text style={styles.newAxisText}>200</Text>
                      <Text style={styles.newAxisText}>150</Text>
                      <Text style={styles.newAxisText}>100</Text>
                      <Text style={styles.newAxisText}>50</Text>
                    </View>
                    <View style={styles.newBarChart}>
                      <View style={styles.newGridLinesContainer}>
                        {Array.from({ length: 10 }).map((_, i) => (
                          <View key={i} style={styles.newGridLine} />
                        ))}
                      </View>
                      <View style={styles.newBarsWrapper}>
                        {renderBars()}
                      </View>
                      {heartRate > 0 && (
                        <View style={[styles.newCurrentLine, { bottom: `${Math.min(Math.max((heartRate / 200) * 100, 5), 90)}%` }]}>
                          <View style={styles.newCurrentTag}>
                            <Text style={styles.newCurrentTagText}>Cur. {heartRate}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.newXAxis}>
                    {['0m', '10m', '20m', '30m', '40m'].map(v => (
                      <Text key={v} style={styles.newAxisText}>{v}</Text>
                    ))}
                  </View>
                </Animated.View>

              </Animated.View>

              {/* Bottom Controls */}
              <View style={[styles.newControlsRow, { paddingBottom: Math.max(insets.bottom + 10, 20) }]}>
                <TouchableOpacity activeOpacity={0.7} style={styles.controlSideBtn} onPress={handleLap}>
                  <MaterialCommunityIcons name="flag-checkered" size={22} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} style={styles.pauseCircle} onPress={toggleTimer}>
                  <Text style={styles.pauseText}>{isActive ? "00" : "▶"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.finishNeonBtn}
                  onPressIn={startFinishAnimation}
                  onPressOut={resetFinishAnimation}
                  activeOpacity={0.9}
                >
                  <Animated.View style={[styles.finishNeonProgress, { width: progressWidth }]} />
                  <View style={styles.finishBtnContent}>
                    <View style={styles.finishSquare} />
                    <Text style={styles.finishNeonText}>Finish</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} style={styles.controlSideBtn} onPress={takeSnapshot}>
                  <Ionicons name="camera" size={22} color="#FFF" />
                </TouchableOpacity>
              </View>

            </Animated.View>
          </Animated.View>

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // HEADER
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  headerDateContainer: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', minWidth: 150 },
  headerDateText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  coachingHeaderContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coachIndicator: { width: 8, height: 8, borderRadius: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerActionButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

  // MAP
  startDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFF', borderWidth: 3 },

  // MAP MENU MODAL
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#1E1E1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  mapOptionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mapOptionItem: { alignItems: 'center', width: '23%' },
  mapOptionIcon: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  selectedOption: { borderColor: '#CCFF00' },
  mapOptionText: { color: '#CCC', fontSize: 11, fontWeight: '600', textAlign: 'center' },

  // RE-CENTER BUTTON
  recenterBtnContainer: { position: 'absolute', bottom: 250, right: 20, zIndex: 50 },
  recenterBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: BRAND_COLORS.accent, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },

  // DASHBOARD SHELL — transparent, just a sizing/positioning container
  dashboard: { position: 'absolute', bottom: 0, left: 0, right: 0, overflow: 'hidden' },
  dragArea: { width: '100%', height: 28, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  dragHandle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 },

  // MORPHING TABS
  newTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 2,
    marginBottom: -2,
  },
  newTabBlock: {
    overflow: 'hidden',
    borderWidth: 1,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
  },
  newTabActive: {
    backgroundColor: 'rgba(35,37,41,0.95)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopColor: 'rgba(255,255,255,0.15)',
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  newTabInactive: {
    backgroundColor: 'rgba(25,27,30,0.8)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  newTabContentFull: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  newTabContentFullRight: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  newTabContentPill: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newPillText: { fontSize: 13, fontWeight: '600', color: '#8e939a', marginLeft: 8 },
  newBigDistanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  newBigDistance: { fontSize: 30, fontWeight: '700', color: '#fff', letterSpacing: -1 },
  newSubDistance: { fontSize: 11, color: '#8e939a', fontWeight: '500' },
  newChartTitleText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // MAIN BODY GLASS CARD
  newMainBody: {
    flex: 1,
    backgroundColor: 'rgba(35,37,41,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopColor: 'rgba(255,255,255,0.15)',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  newBodyPanel: {
    position: 'absolute',
    top: 28,
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },

  // OVERVIEW STATS
  newStatsList: { flex: 1, justifyContent: 'space-between', marginTop: 10 },
  newStatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  newStatLabel: { color: '#8e939a', fontSize: 14, fontWeight: '500' },
  newStatVal: { color: '#fff', fontSize: 14, fontWeight: '600' },
  newStatValAlert: { color: '#ff4d4d' },

  // CHART
  newYAxis: { width: 28, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6, paddingBottom: 2 },
  newAxisText: { fontSize: 10, color: '#8e939a', fontWeight: '600' },
  newBarChart: { flex: 1, position: 'relative' },
  newGridLinesContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 0,
  },
  newGridLine: { width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.04)' },
  newBarsWrapper: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    zIndex: 1,
  },
  newBarContainer: { flex: 1, maxWidth: 18, justifyContent: 'flex-end' },
  newBar: { width: '100%', borderRadius: 6, backgroundColor: '#ff6b8b' },
  newBarPeak: { backgroundColor: '#ff3333' },
  newCurrentLine: {
    position: 'absolute',
    left: 0,
    width: '100%',
    height: 1,
    backgroundColor: BRAND_COLORS.accent,
    zIndex: 2,
  },
  newCurrentTag: {
    position: 'absolute',
    left: 0,
    top: -11,
    backgroundColor: BRAND_COLORS.accent,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  newCurrentTagText: { color: '#000', fontSize: 11, fontWeight: '800' },
  newXAxis: {
    height: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 28,
  },

  // TOOL ROW
  toolRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(28,28,30,0.6)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#252525' },
  toolBtn: { flexDirection: 'row', alignItems: 'center' },
  toolText: { color: '#FFF', fontSize: 12, fontWeight: '600', marginLeft: 8 },
  toolDivider: { width: 1, height: 18, backgroundColor: '#333' },

  // CONTROLS
  newControlsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  controlSideBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  pauseCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  pauseText: { color: '#000', fontSize: 24, fontWeight: '900' },
  finishNeonBtn: { flex: 1, height: 60, borderRadius: 30, backgroundColor: BRAND_COLORS.accent, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  finishNeonProgress: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.4)' },
  finishBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  finishSquare: { width: 14, height: 14, borderRadius: 3, borderWidth: 2, borderColor: '#000' },
  finishNeonText: { color: '#000', fontSize: 18, fontWeight: '800' },
});
