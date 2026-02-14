# New Services Implementation Guide

## 📦 Required Dependencies

Before using these services, install the required packages:

```bash
# For BLE Heart Rate Service
npm install react-native-ble-plx
npm install buffer

# iOS additional setup
cd ios && pod install && cd ..
```

## 🔧 Configuration

### 1. Pixabay API Setup

**File:** `src/services/pixabay.js`

Replace the API key on line 6:
```javascript
const PIXABAY_API_KEY = 'YOUR_ACTUAL_PIXABAY_API_KEY';
```

Get your free API key at: https://pixabay.com/api/docs/

### 2. BLE Permissions Setup

**Android:** Add to `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

**iOS:** Add to `ios/YourApp/Info.plist`:
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>We need Bluetooth to connect to your heart rate monitor</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>We need Bluetooth to connect to your heart rate monitor</string>
```

---

## 📖 Usage Examples

### Pixabay Music Service

```javascript
import { searchMotivationMusic, getTrendingMotivationMusic } from './services/pixabay';

// Search for motivational music
const loadMusic = async () => {
  try {
    const tracks = await searchMotivationMusic('workout', 10);
    console.log('Found tracks:', tracks);
    // tracks = [{ id, uri, title, artist, duration, thumbnail }, ...]
  } catch (error) {
    console.error('Failed to load music:', error);
  }
};

// Get trending tracks
const loadTrending = async () => {
  const trending = await getTrendingMotivationMusic();
  console.log('Trending:', trending);
};
```

### BLE Heart Rate Service

```javascript
import {
  initBLE,
  scanForHeartRateMonitors,
  connectToHeartRateMonitor,
  startHeartRateMonitoring,
  stopHeartRateMonitoring,
  disconnectHeartRateMonitor,
  cleanupBLE
} from './services/ble';

// 1. Initialize BLE
useEffect(() => {
  initBLE();
  return () => {
    cleanupBLE();
  };
}, []);

// 2. Scan for devices
const scanDevices = () => {
  const devices = [];
  
  scanForHeartRateMonitors(
    (device) => {
      devices.push(device);
      console.log('Found:', device.name);
    },
    10000 // Scan for 10 seconds
  );
};

// 3. Connect to device
const connectDevice = async (deviceId) => {
  try {
    await connectToHeartRateMonitor(deviceId);
    console.log('Connected!');
  } catch (error) {
    Alert.alert('Connection Failed', error.message);
  }
};

// 4. Start monitoring
const startMonitoring = async () => {
  try {
    await startHeartRateMonitoring((heartRate) => {
      console.log('Heart Rate:', heartRate, 'BPM');
      setHeartRate(heartRate); // Update your state
    });
  } catch (error) {
    Alert.alert('Monitoring Failed', error.message);
  }
};

// 5. Stop monitoring
const stopMonitoring = () => {
  stopHeartRateMonitoring();
};

// 6. Disconnect
const disconnect = async () => {
  await disconnectHeartRateMonitor();
};
```

---

## 🎯 Integration with ActiveRunScreen

### Add Heart Rate Monitoring

```javascript
import { 
  initBLE, 
  startHeartRateMonitoring, 
  disconnectHeartRateMonitor 
} from '../services/ble';

// In ActiveRunScreen component:
useEffect(() => {
  initBLE();
  
  // Auto-connect if device was previously paired
  const startHRMonitoring = async () => {
    try {
      await startHeartRateMonitoring((bpm) => {
        setHeartRate(bpm); // Update real heart rate instead of mock
      });
    } catch (error) {
      console.log('HR Monitor not available:', error);
    }
  };
  
  startHRMonitoring();
  
  return () => {
    disconnectHeartRateMonitor();
  };
}, []);
```

### Add Pixabay Music

```javascript
import { searchMotivationMusic } from '../services/pixabay';

// In music selection screen:
const loadPixabayMusic = async () => {
  try {
    const tracks = await searchMotivationMusic('running motivation', 20);
    setMusicLibrary(tracks);
  } catch (error) {
    Alert.alert('Music Error', 'Could not load Pixabay music');
  }
};
```

---

## ⚠️ Important Notes

### Pixabay Service
- **Rate Limits:** Free tier has 5,000 requests/hour
- **Video vs Music:** Pixabay doesn't have pure audio files, uses video files with music
- **Caching:** Consider caching results to avoid repeated API calls

### BLE Service
- **Battery Impact:** Continuous BLE scanning drains battery quickly
- **Range:** Bluetooth range is ~10 meters (30 feet)
- **Compatibility:** Works with any standard Bluetooth Heart Rate Monitor (Polar, Garmin, Wahoo, etc.)
- **Permissions:** Android 12+ requires runtime permissions for Bluetooth

---

## 🐛 Troubleshooting

### Pixabay Issues
- **Empty results:** Check API key validity
- **CORS errors:** Only occurs in web, not React Native
- **No URIs:** Some videos may not have downloadable URLs

### BLE Issues
- **Scan fails:** Ensure Bluetooth is enabled and permissions granted
- **Connection drops:** Check device battery and proximity
- **No heart rate data:** Verify device supports standard Heart Rate Profile (0x180D)
- **Android 12+ issues:** Ensure BLUETOOTH_SCAN and BLUETOOTH_CONNECT permissions are granted

---

## 📚 API Reference

### Pixabay Functions
- `searchMotivationMusic(query, perPage)` - Search for music
- `getTrendingMotivationMusic()` - Get trending tracks
- `searchByCategory(category)` - Search by category

### BLE Functions
- `initBLE()` - Initialize BLE manager
- `requestBLEPermissions()` - Request permissions
- `scanForHeartRateMonitors(callback, duration)` - Scan for devices
- `connectToHeartRateMonitor(deviceId)` - Connect to device
- `startHeartRateMonitoring(callback)` - Start monitoring
- `stopHeartRateMonitoring()` - Stop monitoring
- `disconnectHeartRateMonitor()` - Disconnect
- `cleanupBLE()` - Cleanup resources
- `isDeviceConnected()` - Check connection status
- `getConnectedDevice()` - Get device info
