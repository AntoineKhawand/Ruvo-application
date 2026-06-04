import { FontAwesome5, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, AppState, DeviceEventEmitter, Dimensions, Easing, Modal, PanResponder, Platform, ScrollView, Share, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from '../components/Map';
import { useUser } from '../context/UserContext';
import { formatDistance } from '../utils/units';
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';
import { observeHeartRate, requestHealthPermissions } from '../services/healthService';
import { httpsCallable } from 'firebase/functions';
import { doc, updateDoc } from 'firebase/firestore';
import { db, functions } from '../config/firebase';

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
  const [hrHistory, setHrHistory] = useState(() => Array(30).fill(0));
  const [showCharts, setShowCharts] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [liveRunToken, setLiveRunToken] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);

  const [mapReady, setMapReady] = useState(false);
  const [gpsReady, setGpsReady] = useState(false);

  const [followUser, setFollowUser] = useState(true);
  const followUserRef = useRef(true);

  const activeMaxHeight = DASHBOARD_NO_MUSIC_HEIGHT;
  const dashboardHeight = useRef(new Animated.Value(activeMaxHeight)).current;
  const finishProgress = useRef(new Animated.Value(0)).current;
  const recenterBtnOpacity = useRef(new Animated.Value(0)).current;

  const [isExpanded, setIsExpanded] = useState(true);
  const isExpandedRef = useRef(isExpanded);
  useEffect(() => { isExpandedRef.current = isExpanded; }, [isExpanded]);

  const contentOpacity = dashboardHeight.interpolate({
    inputRange: [DASHBOARD_MIN_HEIGHT, activeMaxHeight],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });

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
      // 1. Foreground permission
      let { status: fgStatus } = await Location.getForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        const result = await Location.requestForegroundPermissionsAsync();
        fgStatus = result.status;
      }
      if (fgStatus !== 'granted') {
        Alert.alert('Location Required', 'Ruvo needs location access to track your run.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        return;
      }

      // 2. Show map immediately using last-known position (no age limit)
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          const r = { latitude: last.coords.latitude, longitude: last.coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
          setCurrentPosition(r);
        }
      } catch (_) {}
      setMapReady(true);

      // 3. Background permission (non-blocking)
      try {
        const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
          const result = await Location.requestBackgroundPermissionsAsync();
          if (result.status !== 'granted') {
            Alert.alert('Background Tracking', 'For tracking while your screen is locked, set location to "Always Allow" in Settings.', [{ text: 'Got it' }]);
          }
        }
      } catch (_) {}

      // 4. Get precise GPS fix — try high accuracy first, fall back to balanced
      const acquirePosition = async () => {
        try {
          return await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
        } catch {
          return await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }
      };

      try {
        const location = await acquirePosition();
        const region = { latitude: location.coords.latitude, longitude: location.coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
        setCurrentPosition(region);
        setRouteCoordinates([{ latitude: location.coords.latitude, longitude: location.coords.longitude }]);
        setGpsReady(true);
        mapRef.current?.animateToRegion(region, 800);
        startLocationTracking();
        speak("GPS ready. Let's run.");
      } catch {
        Alert.alert('GPS Error', 'Could not get your location. Make sure GPS is enabled and try again.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
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
    speak("Acquiring GPS, get ready.");
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

  const startLiveShare = async () => {
    lightTap();
    try {
      const startFn = httpsCallable(functions, 'startLiveRun');
      const result = await startFn({});
      const { token, shareUrl: url } = result.data;
      setLiveRunToken(token);
      setShareUrl(url);
      setIsSharing(true);
      await Share.share({ message: `Follow my live run on Ruvo: ${url}`, url });
    } catch (e) {
      Alert.alert('Sharing Error', 'Could not start live sharing. Please try again.');
    }
  };

  // Push location to Firestore every 15s while sharing is active
  useEffect(() => {
    if (!isSharing || !liveRunToken || !isActive) return;
    const interval = setInterval(async () => {
      if (!currentPosition) return;
      try {
        await updateDoc(doc(db, 'liveRuns', liveRunToken), {
          lastPosition: {
            lat: currentPosition.latitude,
            lng: currentPosition.longitude,
            pace,
            distance: parseFloat(distance.toFixed(2)),
            duration: formatTime(seconds),
            timestamp: Date.now(),
          },
        });
      } catch (_) { /* non-critical — viewer just sees last known position */ }
    }, 15000);
    return () => clearInterval(interval);
  }, [isSharing, liveRunToken, isActive, currentPosition, pace, distance, seconds]);

  const endRun = async () => {
    successFeedback();
    setIsActive(false);
    stopLocationTracking();
    if (isSharing && liveRunToken) {
      try {
        await httpsCallable(functions, 'endLiveRun')({ token: liveRunToken });
      } catch (_) { /* non-critical */ }
      setIsSharing(false);
    }
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

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <View style={styles.container}>
          <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

          {mapReady && currentPosition && (
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              mapType={mapType}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
              initialRegion={currentPosition}
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
          )}

          {/* GPS acquiring overlay — shown until precise lock is established */}
          {!gpsReady && (
            <View style={styles.gpsOverlay} pointerEvents="none">
              <View style={styles.gpsOverlayBadge}>
                <ActivityIndicator size="small" color={BRAND_COLORS.accent} style={{ marginRight: 8 }} />
                <Text style={styles.gpsOverlayText}>Acquiring GPS...</Text>
              </View>
            </View>
          )}

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
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.headerActionButton, { marginLeft: 10, backgroundColor: isSharing ? BRAND_COLORS.danger : 'transparent' }]}
                onPress={isSharing ? () => Share.share({ message: `Follow my live run on Ruvo: ${shareUrl}`, url: shareUrl }) : startLiveShare}
              >
                <Ionicons name={isSharing ? "radio" : "share-outline"} size={22} color="#FFF" />
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
            <BlurView intensity={80} tint="dark" style={[StyleSheet.absoluteFill, styles.dashboardBlur]} />
            <View style={styles.dragArea} {...panResponder.panHandlers}>
              <View style={styles.dragHandle} />
            </View>

            <View style={styles.dashboardContent}>
              {/* Distance Section — always visible, with Charts toggle on the right */}
              <View style={styles.distanceRow}>
                <View style={styles.distanceContainer}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={styles.distanceValue}>{formatDistance(distance, userData?.unitSystem, 1).split(' ')[0]}</Text>
                    <Text style={styles.distanceUnit}> {userData?.unitSystem === 'imperial' ? 'mi' : 'km'}</Text>
                  </View>
                  <Text style={styles.distanceSubtext}>of {workout?.goalDistance || 10} km</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => { lightTap(); setShowCharts(!showCharts); }}
                  style={styles.chartsToggleBtn}
                >
                  <MaterialCommunityIcons name={showCharts ? "format-list-bulleted" : "chart-bar"} size={16} color="#FFF" />
                  <Text style={styles.chartsToggleText}>{showCharts ? "Overview" : "Charts"}</Text>
                </TouchableOpacity>
              </View>

              <Animated.View style={{ opacity: contentOpacity, flex: 1 }}>
                {showCharts ? (
                  /* CHART VIEW */
                  <View style={styles.chartContainer}>
                    <View style={styles.chartHeader}>
                      <Text style={styles.chartTitle}>Heart rate</Text>
                      <Ionicons name="chevron-down" size={16} color="#888" />
                    </View>

                    <View style={styles.chartMain}>
                      <View style={styles.hrHistoryContainer}>
                        {hrHistory.map((hr, i) => (
                          <View
                            key={i}
                            style={[
                              styles.chartBar,
                              {
                                height: hr > 0 ? (hr / 200) * 100 : 2,
                                backgroundColor: hr > 160 ? '#FF3B30' : (hr > 140 ? '#FF9500' : '#FF6B6B'),
                                opacity: hr === 0 ? 0.15 : (i === hrHistory.length - 1 ? 1 : 0.6)
                              }
                            ]}
                          />
                        ))}
                        {heartRate > 0 && (
                          <View style={[styles.curHrBadge, { bottom: (heartRate / 200) * 100 + 10 }]}>
                            <View style={styles.curHrPointer} />
                            <Text style={styles.curHrText}>Cur: {heartRate}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.chartXAxis}>
                        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45].map(v => (
                          <Text key={v} style={styles.xAxisLabel}>{v}</Text>
                        ))}
                      </View>
                    </View>
                  </View>
                ) : (
                  /* STATS LIST VIEW */
                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                    <View style={styles.toolRow}>
                      <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={toggleVoice}>
                        <Ionicons name={isVoiceEnabled ? "volume-high" : "volume-mute"} size={18} color={isVoiceEnabled ? "#FFF" : "#666"} />
                        <Text style={[styles.toolText, !isVoiceEnabled && { color: '#666' }]}>{isVoiceEnabled ? "Voice On" : "Muted"}</Text>
                      </TouchableOpacity>
                      <View style={styles.toolDivider} />
                      <View style={styles.toolBtn}>
                        <MaterialCommunityIcons name="flag-variant" size={18} color={BRAND_COLORS.gold} />
                        <Text style={styles.toolText}>{laps.length} Laps</Text>
                      </View>
                    </View>

                    <View style={styles.statsList}>
                      <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Workout Time</Text>
                        <Text style={styles.statValue}>{formatTime(seconds)}</Text>
                      </View>
                      <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Active Calories</Text>
                        <Text style={styles.statValue}>{Math.floor(calories)} kcal</Text>
                      </View>
                      <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Avr pace</Text>
                        <Text style={styles.statValue}>{pace !== '--:--' ? `${pace.split(':')[0]}'${pace.split(':')[1] || '00'}"` : '--:--'}</Text>
                      </View>
                      <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Elevation</Text>
                        <Text style={styles.statValue}>{Math.round(elevationGain)} m</Text>
                      </View>
                    </View>

                    {heartRate === 0 ? (
                      <View style={styles.hrNoDevice}>
                        <FontAwesome5 name="heartbeat" size={13} color="#3A3A3C" />
                        <Text style={styles.hrNoDeviceText}>No heart rate device connected</Text>
                      </View>
                    ) : (() => {
                      const zone = getHrZone(heartRate, userData?.age || 30);
                      const HR_ZONES = [
                        { label: 'Z1', color: '#5AC8FA' },
                        { label: 'Z2', color: '#34C759' },
                        { label: 'Z3', color: '#FFCC00' },
                        { label: 'Z4', color: '#FF9500' },
                        { label: 'Z5', color: '#FF3B30' },
                      ];
                      return (
                        <View style={styles.hrCard}>
                          <View style={styles.hrTopRow}>
                            <View style={styles.hrBpmRow}>
                              <FontAwesome5 name="heartbeat" size={16} color={zone.color} style={{ marginRight: 6 }} />
                              <Text style={[styles.hrBpm, { color: zone.color }]}>{heartRate}</Text>
                              <Text style={styles.hrBpmUnit}>BPM</Text>
                            </View>
                            <View style={[styles.hrZoneBadge, { borderColor: zone.color }]}>
                              <Text style={[styles.hrZoneText, { color: zone.color }]}>Z{zone.zone} · {zone.name}</Text>
                            </View>
                          </View>
                          <View style={styles.hrBarRow}>
                            {HR_ZONES.map((z, i) => (
                              <View
                                key={z.label}
                                style={[
                                  styles.hrBarSegment,
                                  { backgroundColor: z.color, opacity: zone.zone > i ? 1 : 0.18 },
                                  i < HR_ZONES.length - 1 && { marginRight: 3 },
                                ]}
                              />
                            ))}
                          </View>
                        </View>
                      );
                    })()}
                  </ScrollView>
                )}

                {/* BOTTOM CONTROLS */}
                <View style={[styles.newControlsRow, { paddingBottom: Math.max(insets.bottom + 10, 20) }]}>
                  <TouchableOpacity activeOpacity={0.7} style={styles.controlSideBtn} onPress={handleLap}>
                    <MaterialCommunityIcons name="flag-checkered" size={22} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7} style={styles.pauseCircle} onPress={toggleTimer}>
                    <Text style={styles.pauseText}>{isActive ? "Pause" : "Resume"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.finishNeonBtn}
                    onPressIn={startFinishAnimation}
                    onPressOut={resetFinishAnimation}
                    activeOpacity={0.9}
                  >
                    <Animated.View style={[styles.finishNeonProgress, { width: progressWidth }]} />
                    <View style={styles.finishBtnContent}>
                      <Ionicons name="stop-circle" size={22} color="#FFF" />
                      <Text style={styles.finishNeonText}>Finish</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7} style={styles.controlSideBtn} onPress={takeSnapshot}>
                    <Ionicons name="camera" size={22} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
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
  gpsOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 5, backgroundColor: 'rgba(0,0,0,0.55)' },
  gpsOverlayBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(204,255,0,0.35)' },
  gpsOverlayText: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_600SemiBold' },

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
  recenterBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: BRAND_COLORS.accent, justifyContent: 'center', alignItems: 'center', boxShadow: "0 2px 3px rgba(0, 0, 0, 0.3)" },

  // DASHBOARD
  dashboard: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 36, borderTopRightRadius: 36, overflow: 'hidden' },
  dashboardBlur: { borderTopLeftRadius: 36, borderTopRightRadius: 36 },
  dragArea: { width: '100%', height: 30, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  dragHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
  dashboardContent: { flex: 1, paddingHorizontal: 25 },

  // DISTANCE SECTION
  distanceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 5, marginBottom: 20 },
  distanceContainer: { flexDirection: 'column' },
  chartsToggleBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, gap: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginTop: 12 },
  chartsToggleText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  distanceValue: { color: '#FFF', fontSize: 64, fontWeight: '800', letterSpacing: -1 },
  distanceUnit: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  distanceSubtext: { color: '#888', fontSize: 16, fontWeight: '500', marginTop: -5 },

  // STATS LIST
  statsList: { gap: 18 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  statLabel: { color: '#AAA', fontSize: 16, fontWeight: '500' },
  statValue: { color: '#FFF', fontSize: 18, fontWeight: '600' },

  // CHART
  chartContainer: { flex: 1, marginTop: 10 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  chartTitle: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  chartMain: { flex: 1, justifyContent: 'flex-end', paddingBottom: 20 },
  hrHistoryContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, width: '100%', paddingHorizontal: 5 },
  chartBar: { width: 6, borderRadius: 3 },
  chartXAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingHorizontal: 5 },
  xAxisLabel: { color: '#666', fontSize: 10, fontWeight: '600' },
  curHrBadge: { position: 'absolute', right: 0, backgroundColor: BRAND_COLORS.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, alignItems: 'center' },
  curHrPointer: { position: 'absolute', left: -6, top: '50%', marginTop: -4, borderTopWidth: 4, borderTopColor: 'transparent', borderBottomWidth: 4, borderBottomColor: 'transparent', borderRightWidth: 6, borderRightColor: BRAND_COLORS.accent },
  curHrText: { color: '#000', fontSize: 10, fontWeight: '800' },

  // TOOL ROW
  toolRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 15, marginBottom: 18, borderWidth: 1, borderColor: '#252525' },
  toolBtn: { flexDirection: 'row', alignItems: 'center' },
  toolText: { color: '#FFF', fontSize: 12, fontWeight: '600', marginLeft: 8 },
  toolDivider: { width: 1, height: 20, backgroundColor: '#333' },

  // HR ZONE CARD
  hrNoDevice: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: 'rgba(28,28,30,0.6)', borderRadius: 12, borderWidth: 1, borderColor: '#2C2C2E', gap: 8 },
  hrNoDeviceText: { fontSize: 12, color: '#3A3A3C' },
  hrCard: { marginTop: 12, backgroundColor: 'rgba(28,28,30,0.95)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#2C2C2E' },
  hrTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  hrBpmRow: { flexDirection: 'row', alignItems: 'baseline' },
  hrBpm: { fontSize: 28, fontWeight: '700', lineHeight: 32 },
  hrBpmUnit: { fontSize: 12, fontWeight: '600', color: '#666', marginLeft: 4, marginBottom: 2 },
  hrZoneBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  hrZoneText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  hrBarRow: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  hrBarSegment: { flex: 1, borderRadius: 3 },

  // CONTROLS
  newControlsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  controlSideBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  pauseCircle: { height: 60, borderRadius: 30, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  pauseText: { color: '#000', fontSize: 15, fontFamily: 'Poppins_700Bold' },
  finishNeonBtn: { flex: 1, height: 60, borderRadius: 30, backgroundColor: BRAND_COLORS.danger, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  finishNeonProgress: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.3)' },
  finishBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  finishNeonText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
});
