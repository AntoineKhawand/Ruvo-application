import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, ImageBackground, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, Stop, LinearGradient as SvgLinearGradient, Text as SvgText } from 'react-native-svg';
import { useNotifications } from '../context/NotificationContext';
import { useUser } from '../context/UserContext';
import { getTodayWorkout } from '../services/aiCoach';

import NotificationBell from '../components/NotificationBell';
import NotificationSheet from '../components/NotificationSheet';
import FloatingNavBar from '../components/FloatingNavBar';

const COLORS = {
    primary: "#000000",
    secondary: "#1C1C1E",
    accent: "#CCFF00", 
    danger: "#FF3B30",
    text: "#FFFFFF",
    subText: "#888888",
    border: "#333333",
    blue: "#007AFF"
};

const { width } = Dimensions.get('window');

const MOTIVATIONAL_QUOTES = [
    "Just show up.", "Defy your limits.", "Run your race.", "Keep moving forward.", "Stronger every step.", "Focus on today.", "Chase greatness.", "No excuses.", "Earn your miles.", "You got this.",
];

const TIP_LIBRARY = [
    { 
        id: 1, 
        title: 'Trail Adventures', 
        desc: 'Explore nature while building ankle strength and stability.', 
        img: 'https://images.pexels.com/photos/1571939/pexels-photo-1571939.jpeg?auto=compress&cs=tinysrgb&w=600', 
        why: 'Uneven terrain forces you to engage stabilizing muscles that road running ignores. This improves balance and prevents future injuries.',
        steps: [
            { title: "Scout Route", desc: "Check elevation maps and trail conditions before heading out." },
            { title: "Shorten Stride", desc: "Keep feet under you to react quickly to roots and rocks." },
            { title: "Scan Ahead", desc: "Look 10-15 feet ahead, not directly at your feet." }
        ]
    }, 
    { 
        id: 2, 
        title: 'Group Running', 
        desc: 'Find motivation and improve performance by running in a pack.', 
        img: 'https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=600', 
        why: 'Running with others creates "social facilitation," a psychological phenomenon where performance improves merely by being around others.',
        steps: [
            { title: "Find a Pack", desc: "Join a local Ruvo club that matches your pace." },
            { title: "Sync Up", desc: "Don't race. Fall into the group rhythm to conserve energy." },
            { title: "Drafting", desc: "On windy days, run behind others to reduce air resistance." }
        ]
    },
    { 
        id: 3, 
        title: 'Nutrition 101', 
        desc: 'Fuel your body correctly to hit the wall less often.', 
        img: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=600', 
        why: 'Timing your carbs is crucial. Eating complex carbohydrates 2-3 hours before a run ensures your glycogen stores are topped up.',
        steps: [
            { title: "Pre-Run", desc: "Eat a banana or toast 30-60 mins before running." },
            { title: "Hydrate", desc: "Drink 500ml of water 2 hours before your workout." },
            { title: "Recovery", desc: "Consume protein within 30 mins of finishing to repair muscle." }
        ]
    },
    { 
        id: 4, 
        title: 'Recovery Yoga', 
        desc: 'Unlock tight hips and hamstrings after hard runs.', 
        img: 'https://images.pexels.com/photos/4056723/pexels-photo-4056723.jpeg?auto=compress&cs=tinysrgb&w=600', 
        why: 'Static stretching after a run helps realign muscle fibers and flush out metabolic waste, reducing soreness the next day.',
        steps: [
            { title: "Downward Dog", desc: "Hold for 1 minute to stretch calves and hamstrings." },
            { title: "Pigeon Pose", desc: "Open up tight hips caused by repetitive running motion." },
            { title: "Breathe", desc: "Deep belly breathing activates the parasympathetic nervous system." }
        ]
    },
    { 
        id: 5, 
        title: 'Cadence Drills', 
        desc: 'Improve your efficiency by increasing your step rate.', 
        img: 'https://images.pexels.com/photos/4048182/pexels-photo-4048182.jpeg?auto=compress&cs=tinysrgb&w=600', 
        why: 'Increasing your cadence (steps per minute) reduces the impact load on your knees and hips by preventing overstriding.',
        steps: [
            { title: "Baseline", desc: "Count your steps for 1 minute at normal pace." },
            { title: "+5 Percent", desc: "Try to increase that number by 5% using short, quick steps." },
            { title: "Metronome", desc: "Use a beat track at 170-180 BPM to lock in the rhythm." }
        ]
    },
    { 
        id: 6, 
        title: 'Mental Toughness', 
        desc: 'Tricks to keep going when your legs want to quit.', 
        img: 'https://images.pexels.com/photos/3775603/pexels-photo-3775603.jpeg?auto=compress&cs=tinysrgb&w=600', 
        why: 'Discomfort is often a mental signal rather than a physical limit. "Chunking" distances helps the brain manage fatigue.',
        steps: [
            { title: "Chunking", desc: "Don't think '5km to go'. Think 'just to that next tree'." },
            { title: "Mantra", desc: "Repeat a phrase like 'Light and Fast' to block negative thoughts." },
            { title: "Form Check", desc: "When tired, focus intently on fixing your posture." }
        ]
    },
    { 
        id: 7, 
        title: 'Hydration Hacks', 
        desc: 'Stay hydrated without that annoying sloshing feeling.', 
        img: 'https://images.pexels.com/photos/4379227/pexels-photo-4379227.jpeg?auto=compress&cs=tinysrgb&w=600', 
        why: 'Dehydration increases heart rate and perceived effort. Even 2% fluid loss can significantly impact performance.',
        steps: [
            { title: "Sip, Don't Gulp", desc: "Take small sips frequently rather than large gulps." },
            { title: "Electrolytes", desc: "Add salt tabs on hot days to retain water better." },
            { title: "Carry Gear", desc: "Use a handheld bottle or vest for runs over 60 mins." }
        ]
    },
    { 
        id: 8, 
        title: 'Night Running', 
        desc: 'Stay safe and visible while owning the night.', 
        img: 'https://images.pexels.com/photos/1671324/pexels-photo-1671324.jpeg?auto=compress&cs=tinysrgb&w=600', 
        why: 'Sensory deprivation at night can heighten your sense of speed and focus, often leading to faster perceived runs.',
        steps: [
            { title: "Reflectivity", desc: "Wear gear with reflective strips on moving parts (ankles/wrists)." },
            { title: "Against Traffic", desc: "Always run facing cars so you can see them coming." },
            { title: "Headlamp", desc: "Use a light not just to see, but to be seen." }
        ]
    },
    { 
        id: 9, 
        title: 'Hill Repeats', 
        desc: 'Build explosive power on inclines.', 
        img: 'https://images.pexels.com/photos/1563277/pexels-photo-1563277.jpeg?auto=compress&cs=tinysrgb&w=600', 
        why: 'Hills are speed work in disguise. They build explosive power in your glutes and calves without the impact of sprinting.',
        steps: [
            { title: "Lean In", desc: "Lean into the hill from your ankles, not your waist." },
            { title: "Drive Arms", desc: "Pump your arms harder to help drive your legs." },
            { title: "Recovery", desc: "Jog down slowly to recover heart rate before the next rep." }
        ]
    },
    { 
        id: 10, 
        title: 'Proper Gear', 
        desc: 'Choosing the right shoes for your specific foot type.', 
        img: 'https://images.pexels.com/photos/2526878/pexels-photo-2526878.jpeg?auto=compress&cs=tinysrgb&w=600', 
        why: 'The right shoe supports your specific arch and pronation style, which is critical for long-term joint health.',
        steps: [
            { title: "Thumb Rule", desc: "Ensure a thumb's width of space between toe and shoe end." },
            { title: "Rotate Shoes", desc: "Switch between two pairs to let the foam decompress." },
            { title: "Socks Matter", desc: "Use synthetic running socks to prevent blisters." }
        ]
    },
];

const fetchWeather = async (locationData) => {
    // FIX: Default to London if location is missing/denied
    const lat = locationData?.latitude || 51.5074;
    const lon = locationData?.longitude || -0.1278;

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.current_weather) return { temp: '--', icon: 'cloudy-outline' };
        
        const temp = Math.round(data.current_weather.temperature);
        const code = data.current_weather.weathercode;
        let icon = code === 0 ? 'sunny' : (code <= 3 ? 'partly-sunny' : (code >= 45 && code <= 48 ? 'cloudy' : 'rainy'));
        
        return { temp, icon: icon + '-outline' };
    } catch (error) { 
        console.log("Weather Error", error);
        return { temp: '--', icon: 'cloudy-outline' }; 
    }
};

const CircularProgress = ({ size, strokeWidth, progress }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress * circumference);
  return (
    <View style={{ width: size, height: size, transform: [{ rotate: '-90deg' }] }}>
      <Svg width={size} height={size}>
        <Defs><SvgLinearGradient id="grad" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={COLORS.accent} stopOpacity="1" /><Stop offset="1" stopColor="#FFFF00" stopOpacity="1" /></SvgLinearGradient></Defs>
        <Circle stroke="#333" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="transparent" />
        {progress > 0 && <Circle stroke="url(#grad)" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />}
      </Svg>
    </View>
  );
};

const LineChart = ({ data, height = 140, width = 300, color = COLORS.accent }) => {
    if (!data || data.length < 2) return null;
    const maxVal = Math.max(...data, 160);
    const minVal = Math.min(...data, 100); 
    const range = maxVal - minVal || 1;
    const paddingLeft = 30; const paddingRight = 20; const paddingBottom = 20;
    const chartWidth = width - paddingLeft - paddingRight; 
    const chartHeight = height - paddingBottom;
    const stepX = chartWidth / (data.length - 1);

    let pathD = `M ${paddingLeft} ${chartHeight - ((data[0] - minVal) / range) * chartHeight}`;
    data.forEach((val, i) => {
        const x = paddingLeft + (i * stepX);
        const y = chartHeight - ((val - minVal) / range) * chartHeight;
        pathD += ` L ${x} ${y}`;
    });
    const areaD = `${pathD} L ${paddingLeft + chartWidth} ${chartHeight} L ${paddingLeft} ${chartHeight} Z`;

    return (
        <View style={{ height, width }}>
            <Svg height={height} width={width}>
                <Defs><SvgLinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity="0.5" /><Stop offset="1" stopColor={color} stopOpacity="0" /></SvgLinearGradient></Defs>
                <Path d={`M ${paddingLeft} 0 L ${paddingLeft} ${chartHeight}`} stroke="#333" strokeWidth="1" />
                <Path d={`M ${paddingLeft} ${chartHeight} L ${width} ${chartHeight}`} stroke="#333" strokeWidth="1" />
                <SvgText x="0" y="10" fill="#666" fontSize="10">{Math.round(maxVal)}</SvgText>
                <SvgText x="0" y={chartHeight} fill="#666" fontSize="10">{Math.round(minVal)}</SvgText>
                <SvgText x={paddingLeft} y={height} fill="#666" fontSize="10">30d</SvgText>
                <SvgText x={width - 40} y={height} fill="#666" fontSize="10" textAnchor="start">Now</SvgText>
                <Path d={areaD} fill="url(#lineGrad)" />
                <Path d={pathD} stroke={color} strokeWidth="2" fill="none" />
                <Circle cx={paddingLeft + (data.length - 1) * stepX} cy={chartHeight - ((data[data.length - 1] - minVal) / range) * chartHeight} r="4" fill="#FFF" stroke={color} strokeWidth="2" />
            </Svg>
        </View>
    );
};

const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    d.setDate(diff); d.setHours(0,0,0,0); return d;
};

// --- HELPER: REAL DATA CALCULATIONS ---
const calculateRealAnalytics = (history, age = 30) => {
    // 1. Race Predictions (Based on best 5k)
    let best5kTime = Infinity;
    history.forEach(r => {
        const d = parseFloat(r.distance);
        if (d >= 5) {
            const [m, s] = r.duration.split(':').map(Number);
            const totalSec = (m * 60) + s;
            // Normalize to exactly 5k pace
            const paceSec = totalSec / d; 
            const projected5k = paceSec * 5;
            if (projected5k < best5kTime) best5kTime = projected5k;
        }
    });

    let predictions = null;
    if (best5kTime !== Infinity) {
        const predict = (dist) => {
            const t = best5kTime * Math.pow((dist / 5), 1.06);
            const h = Math.floor(t / 3600);
            const m = Math.floor((t % 3600) / 60);
            return h > 0 ? `${h}h ${m}m` : `${m}m`;
        };
        predictions = { '10k': predict(10), 'Half': predict(21.1), 'Marathon': predict(42.2) };
    }

    // 2. Heart Rate Zones (Distribution of Runs)
    const maxHR = 220 - age;
    const zones = [0, 0, 0, 0, 0]; // Z1, Z2, Z3, Z4, Z5
    
    history.forEach(r => {
        const hr = parseFloat(r.heartRate);
        if (hr > 0) {
            const pct = hr / maxHR;
            if (pct < 0.6) zones[0]++;
            else if (pct < 0.7) zones[1]++;
            else if (pct < 0.8) zones[2]++;
            else if (pct < 0.9) zones[3]++;
            else zones[4]++;
        }
    });
    
    // Normalize for bar height (max height 80px)
    const maxCount = Math.max(...zones, 1);
    const zoneHeights = zones.map(z => (z / maxCount) * 80 + 10); // Min 10px height

    // 3. Recovery Status
    const lastRun = history.length > 0 ? new Date(history[history.length - 1].date) : null;
    let recoveryText = "Ready to Train";
    let recoveryColor = "#4CD964"; // Green
    let recoveryPercent = "100%";
    
    if (lastRun) {
        const hoursSince = (new Date() - lastRun) / (1000 * 60 * 60);
        if (hoursSince < 24) {
            recoveryText = "Recovering";
            recoveryColor = "#FF9500"; // Orange
            recoveryPercent = "40%";
        } else if (hoursSince < 48) {
            recoveryText = "Almost Ready";
            recoveryColor = COLORS.accent; // Yellow
            recoveryPercent = "80%";
        }
    }

    return { predictions, zoneHeights, recovery: { text: recoveryText, color: recoveryColor, pct: recoveryPercent } };
};

export default function HomeScreen({ route, navigation }) {
  const { userData, incrementTipView, isLoading } = useUser(); 
  const { addNotification } = useNotifications();
  
  const safeUserData = userData || {};
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRunSummary, setShowRunSummary] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [runSummaryData, setRunSummaryData] = useState(null);
  
  const isWorkoutCompleted = useMemo(() => {
      if (!safeUserData.runHistory) return false;
      const todayString = new Date().toDateString(); 
      return safeUserData.runHistory.some(run => new Date(run.date).toDateString() === todayString);
  }, [safeUserData.runHistory]);

  const [weather, setWeather] = useState({ temp: '--', icon: 'cloudy-outline' });
  const [displayedTips, setDisplayedTips] = useState([]);
  const [showBadgeReveal, setShowBadgeReveal] = useState(false);
  const badgeScale = useRef(new Animated.Value(0)).current; 
  const badgeOpacity = useRef(new Animated.Value(0)).current;

  // --- NEW FEATURE: STREAK CALCULATION ---
  const currentStreak = useMemo(() => {
      const history = safeUserData.runHistory || [];
      if (history.length === 0) return 0;

      // Get unique dates of runs
      const uniqueDates = [...new Set(history.map(r => new Date(r.date).toDateString()))];
      // Sort descending
      uniqueDates.sort((a, b) => new Date(b) - new Date(a));

      let streak = 0;
      let checkDate = new Date();
      
      // Check if ran today
      if (uniqueDates[0] === checkDate.toDateString()) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
      } else {
          // If haven't ran today, check yesterday to see if streak is still active but at risk
          let yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          if (uniqueDates[0] !== yesterday.toDateString()) return 0; // Streak broken
      }

      // Count backwards
      for (let i = (streak === 1 ? 1 : 0); i < uniqueDates.length; i++) {
          if (uniqueDates[i] === checkDate.toDateString()) {
              streak++;
              checkDate.setDate(checkDate.getDate() - 1);
          } else {
              break;
          }
      }
      return streak;
  }, [safeUserData.runHistory]);

  // --- TRENDS LOGIC ---
  const trends = useMemo(() => {
      const history = safeUserData.runHistory || [];
      const now = new Date();
      const startOfThisWeek = getStartOfWeek(now);
      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
      const endOfLastWeek = new Date(startOfThisWeek);
      
      const thisWeekRuns = history.filter(r => new Date(r.date) >= startOfThisWeek);
      const lastWeekRuns = history.filter(r => new Date(r.date) >= startOfLastWeek && new Date(r.date) < endOfLastWeek);
      
      const thisWeekCals = thisWeekRuns.reduce((acc, r) => acc + (parseFloat(r.calories) || 0), 0);
      const lastWeekCals = lastWeekRuns.reduce((acc, r) => acc + (parseFloat(r.calories) || 0), 0);
      let calPercent = 0;
      if (lastWeekCals > 0) calPercent = Math.round(((thisWeekCals - lastWeekCals) / lastWeekCals) * 100);
      else if (thisWeekCals > 0) calPercent = 100; 
      
      const getAvgBpm = (runs) => { if (runs.length === 0) return 0; const total = runs.reduce((acc, r) => acc + (parseFloat(r.heartRate) || 0), 0); return total / runs.length; };
      const thisWeekBpm = getAvgBpm(thisWeekRuns);
      const lastWeekBpm = getAvgBpm(lastWeekRuns);
      let bpmPercent = 0;
      if (lastWeekBpm > 0) bpmPercent = Math.round(((thisWeekBpm - lastWeekBpm) / lastWeekBpm) * 100);
      else if (thisWeekBpm > 0) bpmPercent = 100;
      
      const GREEN = "#4CD964"; const RED = "#FF3B30";

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const recentRuns = history.filter(r => new Date(r.date) >= thirtyDaysAgo).sort((a, b) => new Date(a.date) - new Date(b.date));

      const calculateAvgPace = (runs) => {
          if (runs.length === 0) return 0;
          const totalPaceSec = runs.reduce((acc, r) => {
              const parts = (r.pace || "0:00").split(':').map(Number);
              return acc + (parts[0] * 60) + (parts[1] || 0);
          }, 0);
          return totalPaceSec / runs.length;
      };
      const avgPace = calculateAvgPace(recentRuns);
      const avgPaceStr = avgPace > 0 ? `${Math.floor(avgPace / 60)}:${Math.round(avgPace % 60).toString().padStart(2, '0')}` : "--:--";

      const chartData = recentRuns.length > 1 ? recentRuns.map(r => parseFloat(r.heartRate) || 0).filter(hr => hr > 40) : [70, 75, 72, 80, 78, 85, 82]; 

      return {
          calText: calPercent >= 0 ? `+${calPercent}% vs last week` : `${calPercent}% vs last week`, 
          calIcon: calPercent >= 0 ? "trending-up" : "trending-down", calColor: calPercent >= 0 ? GREEN : RED, 
          bpmText: bpmPercent >= 0 ? `+${bpmPercent}% vs last week` : `${bpmPercent}% vs last week`, 
          bpmIcon: bpmPercent >= 0 ? "trending-up" : "trending-down", bpmColor: bpmPercent >= 0 ? GREEN : RED,
          avgPaceStr,
          runCount30: recentRuns.length,
          chartData
      };
  }, [safeUserData.runHistory]);

  const analyticsData = useMemo(() => {
      const history = safeUserData.runHistory || [];
      const gearList = safeUserData.gearList || [];
      const validRuns = history.filter(r => parseFloat(r.heartRate) > 0 && r.duration !== "00:00");
      const last5Runs = validRuns.slice(0, 5);
      let vo2Max = "N/A";
      
      if (last5Runs.length > 0) {
          const totalDist = last5Runs.reduce((acc, r) => acc + parseFloat(r.distance), 0);
          const totalHours = last5Runs.reduce((acc, r) => { const [m, s] = r.duration.split(':').map(Number); return acc + (m / 60) + (s / 3600); }, 0);
          const avgSpeedKmh = totalHours > 0 ? totalDist / totalHours : 0;
          const avgHR = last5Runs.reduce((acc, r) => acc + parseFloat(r.heartRate), 0) / last5Runs.length;
          if (avgSpeedKmh > 0 && avgHR > 0) { const rawVo2 = 15 + (avgSpeedKmh * 3.5) + (200 - avgHR) * 0.15; vo2Max = Math.round(rawVo2).toString(); }
      }

      const weeks = [0, 0, 0, 0];
      const now = new Date();
      now.setHours(0,0,0,0);
      history.forEach(run => {
          const runDate = new Date(run.date);
          runDate.setHours(0,0,0,0);
          const diffTime = Math.abs(now - runDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          const weekIndex = Math.floor(diffDays / 7);
          if (weekIndex < 4) weeks[3 - weekIndex] += parseFloat(run.distance) || 0;
      });
      const maxVol = Math.max(...weeks, 10); 

      const pbs = { '1k': null, '5k': null, '10k': null };
      const timeToSec = (timeStr) => { const [m, s] = timeStr.split(':').map(Number); return (m * 60) + s; };
      history.forEach(run => {
          const dist = parseFloat(run.distance);
          const paceSec = timeToSec(run.pace);
          if (dist >= 1 && (pbs['1k'] === null || paceSec < pbs['1k'].sec)) pbs['1k'] = { str: run.pace, sec: paceSec };
          if (dist >= 5 && (pbs['5k'] === null || paceSec < pbs['5k'].sec)) pbs['5k'] = { str: run.pace, sec: paceSec };
          if (dist >= 10 && (pbs['10k'] === null || paceSec < pbs['10k'].sec)) pbs['10k'] = { str: run.pace, sec: paceSec };
      });

      const formattedPbs = { '1k': pbs['1k'] ? pbs['1k'].str : '--:--', '5k': pbs['5k'] ? pbs['5k'].str : '--:--', '10k': pbs['10k'] ? pbs['10k'].str : '--:--' };
      const realStats = calculateRealAnalytics(history, safeUserData.age || 30);
    
      return { 
        vo2Max, weeks, maxVol, pbs: formattedPbs, gearList, 
        predictions: realStats.predictions,
        zones: realStats.zoneHeights,
        recovery: realStats.recovery
      };
  }, [safeUserData.runHistory, safeUserData.gearList]);

  const dailyQuote = useMemo(() => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)], []);

  // --- POST-RUN TRIGGER LOGIC ---
  useEffect(() => {
    if (route.params?.newRunData) {
        // 1. Show the "Great Run" Modal
        setShowRunSummary(true); 
        
        // 2. Set the data for the modal (XP earned, Distance)
        setRunSummaryData({
            distance: parseFloat(route.params.newRunData.distance),
            xpEarned: Math.floor(parseFloat(route.params.newRunData.distance) * 50),
        });

        // 3. Clear the params so it doesn't popup again if you reload
        navigation.setParams({ newRunData: null });
    }
  }, [route.params?.newRunData]);

  useEffect(() => {
      const loadDailyTips = async () => {
          try {
              const todayStr = new Date().toDateString();
              const lastFetchDate = await AsyncStorage.getItem('@ruvo_last_tip_date');
              const savedIndicesJson = await AsyncStorage.getItem('@ruvo_daily_tip_indices');
              let indices = [];
              if (lastFetchDate === todayStr && savedIndicesJson) {
                  const parsedIndices = JSON.parse(savedIndicesJson);
                  if (Array.isArray(parsedIndices) && parsedIndices.length === 4) indices = parsedIndices;
              }
              if (indices.length === 0) {
                  const totalTips = TIP_LIBRARY.length;
                  const allIndices = Array.from({ length: totalTips }, (_, i) => i);
                  for (let i = allIndices.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]]; }
                  indices = allIndices.slice(0, 4); 
                  await AsyncStorage.setItem('@ruvo_last_tip_date', todayStr);
                  await AsyncStorage.setItem('@ruvo_daily_tip_indices', JSON.stringify(indices));
              }
              const selection = indices.map(index => {
                  const safeIndex = index < TIP_LIBRARY.length ? index : 0; 
                  const tipData = TIP_LIBRARY[safeIndex];
                  const userViews = safeUserData.tipViews?.[tipData.id] || 0;
                  const baseViews = 12000 + (safeIndex * 500); 
                  return { ...tipData, views: baseViews + userViews, baseViews: baseViews };
              });
              setDisplayedTips(selection);
          } catch (e) {
              const fallback = TIP_LIBRARY.slice(0, 4).map((t, i) => ({ ...t, views: 12000 + (i * 500), baseViews: 12000 }));
              setDisplayedTips(fallback);
          }
      };
      loadDailyTips();
  }, [safeUserData.tipViews]);

  const todaysWorkout = useMemo(() => getTodayWorkout(userData), [userData]);

  useEffect(() => {
      fetchWeather(safeUserData.location || null).then(setWeather);
  }, [safeUserData.location]); 

  const progressPercent = (safeUserData.weeklyDistance || 0) / (safeUserData.weeklyGoal || 20);
  const weeklyDistance = safeUserData.weeklyDistance || 0;
  const weeklyGoal = safeUserData.weeklyGoal || 20;
  const isWeeklyGoalMet = weeklyDistance >= weeklyGoal;
  const hasRuns = safeUserData.runHistory && safeUserData.runHistory.length > 0;
  const currentXP = safeUserData.currentXP || 0;
  const xpTarget = safeUserData.xpToNextLevel || 1000;
  const xpProgressPercent = xpTarget > 0 ? currentXP / xpTarget : 0;
  const earningProgress = safeUserData.earningUnlockProgress || 0;
  const earningTarget = 100;
  const earningUnlockProgressPercent = earningProgress / earningTarget;

  const handleViewTip = (tip) => { incrementTipView(tip.id, tip.baseViews); navigation.navigate('TipDetail', { tip }); };
  const handleCollectRewards = () => { setShowRunSummary(false); if (runSummaryData?.newBadge) { setShowBadgeReveal(true); Animated.parallel([ Animated.spring(badgeScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }), Animated.timing(badgeOpacity, { toValue: 1, duration: 500, useNativeDriver: true }) ]).start(); } };
  const closeBadgeReveal = () => { setShowBadgeReveal(false); badgeScale.setValue(0); badgeOpacity.setValue(0); };

  const handleFullAnalytics = () => {
    if (userData.isPro) {
        setShowAnalyticsModal(true);
    } else {
        // --- THIS LINKS TO THE EXACT SAME SCREEN AS THE PLAN TAB ---
        navigation.navigate('Paywall'); 
    }
  };

  if (isLoading) {
    return (
        <View style={{flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center'}}>
            <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
    );
  }

  return (
    <ImageBackground source={{ uri: 'https://images.pexels.com/photos/5310917/pexels-photo-5310917.jpeg' }} style={styles.backgroundImage} imageStyle={{ opacity: 0.5 }}>
      <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', '#000']} locations={[0, 0.6, 1]} style={styles.overlay}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <StatusBar barStyle="light-content" />
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.navigate('Profile')}><Ionicons name="person-outline" size={24} color="#FFF" /></TouchableOpacity>
              <View style={styles.headerRight}>
                <NotificationBell onPress={() => setShowNotifications(true)} />
                {/* --- CALENDAR BUTTON FIX --- */}
                <TouchableOpacity style={{ marginLeft: 20 }} onPress={() => navigation.navigate('Plan')}>
                    <Ionicons name="calendar-outline" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.greetingContainer}>
              <View style={{flexDirection:'row', alignItems:'center'}}>
                  <Text style={styles.greetingText}>Hi, {safeUserData.name?.split(' ')[0] || 'Runner'}!</Text>
                  
                  {/* --- NEW: STREAK FLAME --- */}
                  {currentStreak > 0 && (
                      <View style={styles.streakBadge}>
                          <Ionicons name="flame" size={16} color="#FF3B30" />
                          <Text style={styles.streakText}>{currentStreak}</Text>
                      </View>
                  )}
              </View>
              <Text style={styles.subGreeting}>{dailyQuote}</Text>
            </View>

            {/* --- AI COACH INLINE SECTION --- */}
            <TouchableOpacity style={styles.aiCoachCard} onPress={() => navigation.navigate('AICoach')}>
                <View style={styles.aiCoachIconBox}>
                    <MaterialCommunityIcons name="robot" size={24} color="#000" />
                </View>
                <View style={{flex: 1}}>
                    <Text style={styles.aiCoachTitle}>Ask AI Coach</Text>
                    <Text style={styles.aiCoachSubtitle}>Analyze training, injuries & plans...</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>Your weekly goal</Text></View>
            <View style={styles.progressMainCard}>
              <View style={styles.progressRow}>
                <View>
                  <Text style={[styles.weeklyLabel, isWeeklyGoalMet && {color: COLORS.accent, fontFamily:'Poppins_700Bold'}]}>
                      {isWeeklyGoalMet ? "Goal Crushed! 🏆" : "Distance progress"}
                  </Text>
                  <Text style={[styles.percentageBig, { color: progressPercent > 0 ? COLORS.accent : '#666' }]}>{Math.round(progressPercent * 100)}%</Text>
                  <Text style={styles.kmSmall}>{weeklyDistance.toFixed(2)} km / {weeklyGoal} km</Text>
                </View>
                <View style={styles.ringWrapper}><CircularProgress size={70} strokeWidth={8} progress={progressPercent} /></View>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}><Ionicons name="flash" size={24} color="#FFD700" /></View>
                <Text style={styles.statNumber}>{hasRuns && safeUserData.calories > 0 ? Math.floor(safeUserData.calories) : '--'}</Text>
                <Text style={styles.statLabel}>Calories</Text>
                <View style={styles.trendRow}>
                    {hasRuns ? (<><Ionicons name={trends.calIcon} size={14} color={trends.calColor} /><Text style={{color: trends.calColor, fontSize:12, marginLeft:4}}>{trends.calText}</Text></>) : (<><Ionicons name="trending-up" size={14} color="#666" /><Text style={{color:'#666', fontSize:12, marginLeft:4}}>Start your first run</Text></>)}
                </View>
              </View>
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}><Ionicons name="heart-outline" size={24} color="#FF4081" /></View>
                <Text style={styles.statNumber}>{hasRuns && safeUserData.bpm > 0 ? Math.round(safeUserData.bpm) : '--'}</Text>
                <Text style={styles.statLabel}>Avg BPM</Text>
                <View style={styles.trendRow}>
                    {hasRuns ? (<><MaterialIcons name={trends.bpmIcon} size={14} color={trends.bpmColor} /><Text style={{color: trends.bpmColor, fontSize:12, marginLeft:4}}>{trends.bpmText}</Text></>) : (<><MaterialIcons name="trending-flat" size={14} color="#666" /><Text style={{color:'#666', fontSize:12, marginLeft:4}}>No data yet</Text></>)}
                </View>
              </View>
            </View>

            <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Performance Insights</Text>
                <TouchableOpacity onPress={handleFullAnalytics}>
                    <Text style={{color: COLORS.accent, fontSize: 12}}>Full Analytics</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.insightDashboard}>
                <View style={styles.insightTopRow}>
                    <View style={styles.insightCol}>
                        <Text style={styles.insightLabel}>30-DAY AVG PACE</Text>
                        <Text style={styles.insightValue}>{trends.avgPaceStr}<Text style={styles.insightUnit}>/km</Text></Text>
                        <View style={styles.improvementBadge}>
                            <Ionicons name="trending-down" size={12} color={COLORS.accent} />
                            <Text style={styles.improvementText}>STABLE</Text>
                        </View>
                    </View>
                    <View style={styles.verticalInsightDivider} />
                    <View style={styles.insightCol}>
                        <Text style={styles.insightLabel}>CONSISTENCY</Text>
                        <Text style={styles.insightValue}>{trends.runCount30}<Text style={styles.insightUnit}> RUNS</Text></Text>
                        <Text style={styles.insightSubtext}>Last 30 days</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.insightFooter} onPress={() => navigation.navigate('Gear')}>
                    <View style={{flexDirection:'row', alignItems:'center'}}>
                        <MaterialCommunityIcons name="shoe-sneaker" size={16} color="#888" />
                        <Text style={styles.insightFooterText}>Active Gear: {safeUserData.gearList?.find(g => g.isDefault)?.name || "Select Shoe"}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#666" />
                </TouchableOpacity>
            </View>

            <View style={styles.hrChartContainer}>
                <View style={styles.hrHeader}>
                    <Ionicons name="pulse" size={16} color={COLORS.accent} />
                    <Text style={styles.hrTitle}>Heart Rate Trend (30 Days)</Text>
                </View>
                <LineChart data={trends.chartData} width={width - 80} height={140} color={COLORS.accent} />
                <Text style={styles.hrAiAdvice}>
                    RUVO AI: Your intensity is trending {trends.chartData[trends.chartData.length - 1] > trends.chartData[0] ? "upward" : "steady"}. Monitor recovery.
                </Text>
            </View>

            <TouchableOpacity style={styles.workoutCard} activeOpacity={0.9} onPress={() => navigation.navigate('WorkoutDetail', { workout: todaysWorkout })}>
              <View style={styles.workoutHeader}>
                <View style={{flexDirection:'row', alignItems:'center'}}>
                    <View style={styles.aiBadge}><Ionicons name="sparkles" size={10} color="#000" style={{marginRight:3}} /><Text style={styles.aiBadgeText}>AI Plan</Text></View>
                    <Text style={styles.workoutTitle}>Today's workout</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name={weather.icon} size={16} color="#AAA" /><Text style={{ color: '#AAA', marginLeft: 5 }}>{weather.temp}°C</Text></View>
              </View>
              
              <Text style={styles.workoutName}>{todaysWorkout.title}</Text>
              
              <Text style={styles.workoutDesc}>{todaysWorkout.desc}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                <View style={styles.intensityBadge}><Text style={styles.intensityText}>{todaysWorkout.intensity} intensity</Text></View>
                {/* --- COMPLETED BADGE REMOVED --- */}
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.startRunButton} onPress={() => navigation.navigate('ActiveRun', { workout: todaysWorkout, userWeight: safeUserData.weight || 70 })}>
              <Ionicons name="play" size={24} color="#000" /><Text style={styles.startRunText}>Start run</Text>
            </TouchableOpacity>
            
            {/* LEVEL AND XP CARD (Updated with Coins) */}
            <View style={styles.xpCard}>
                <View style={styles.xpHeaderRow}>
                    <View>
                        <Text style={styles.xpLevelText}>Level {(safeUserData.level || 1)}: Rookie</Text>
                        <Text style={styles.xpTargetText}>{1000 - (safeUserData.currentXP || 0)} XP to next level</Text>
                    </View>
                    
                    {/* --- NEW COIN BADGE --- */}
                    <View style={styles.coinDisplay}>
                        <MaterialCommunityIcons name="star-circle" size={16} color="#000" />
                        <Text style={styles.coinDisplayText}>{(safeUserData.coins || 0).toLocaleString()}</Text>
                    </View>
                </View>

                <View style={{ marginBottom: 0 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                        <Text style={styles.xpCurrentProgressText}>Current progress</Text>
                        <Text style={styles.xpCurrentProgressPercentText}>{Math.round(xpProgressPercent * 100)}%</Text>
                    </View>
                    <View style={styles.xpProgressBarContainer}>
                        <View style={styles.xpProgressBarBg} />
                        <View style={[styles.xpProgressBarFill, { width: `${xpProgressPercent * 100}%` }]} />
                    </View>
                </View>

                <View style={styles.earningHeaderRow}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <View style={[styles.dot, earningUnlockProgressPercent >= 1 ? styles.dotUnlocked : styles.dotLocked]} />
                        <Text style={[styles.earningText, earningUnlockProgressPercent >= 1 ? styles.earningTextUnlocked : styles.earningTextLocked]}>
                            Earning feature
                        </Text>
                    </View>
                    <Text style={[styles.lockStatus, earningUnlockProgressPercent >= 1 ? styles.lockStatusUnlocked : styles.lockStatusLocked]}>
                        {earningUnlockProgressPercent >= 1 ? "Active" : "Locked"}
                    </Text>
                </View>
                
                <View style={styles.xpProgressBarContainer}>
                    <View style={styles.xpProgressBarBg} />
                    <View style={[styles.xpProgressBarFillEarning, { width: `${Math.min(earningUnlockProgressPercent, 1) * 100}%` }]} />
                </View>
                
                {earningUnlockProgressPercent < 1 && (
                    <Text style={styles.xpFooterRunText}>Run {earningProgress.toFixed(1)}km of {earningTarget}km to unlock Coin earning</Text>
                )}
            </View>
            
            {/* TIPS */}
            <Text style={styles.sectionTitle}>Tips for today</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 15 }}>
              {displayedTips.map((tip, index) => (
                <View key={index} style={styles.tipContainer}>
                  <ImageBackground source={{ uri: tip.img }} style={styles.tipImageBg} imageStyle={{ borderRadius: 20 }}>
                    <View style={styles.tipTopRow}><View style={styles.viewsBadge}><Ionicons name="eye" size={12} color="#FFF" /><Text style={styles.viewsText}>{tip.views?.toLocaleString()}</Text></View></View>
                    <TouchableOpacity style={styles.viewButtonContainer} onPress={() => handleViewTip(tip)}><View style={styles.viewButtonOpaque}><Text style={styles.viewButtonText}>View</Text></View></TouchableOpacity>
                  </ImageBackground>
                  <Text style={styles.tipTitleText}>{tip.title}</Text>
                  <Text style={styles.tipDescText} numberOfLines={2}>{tip.desc}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={{ height: 40 }} /> 
          </ScrollView>

          {/* MODALS */}
          <Modal animationType="fade" transparent={true} visible={showRunSummary} onRequestClose={() => setShowRunSummary(false)}><View style={styles.modalOverlay}><View style={styles.summaryCard}><Ionicons name="trophy" size={60} color={COLORS.accent} style={{ marginBottom: 15 }} /><Text style={styles.summaryTitle}>Great Run!</Text><Text style={styles.summaryStats}>You ran <Text style={{color: COLORS.accent}}>{runSummaryData?.distance.toFixed(2)} km</Text></Text><View style={styles.xpBadge}><Text style={styles.xpBadgeText}>+{runSummaryData?.xpEarned} XP Earned</Text></View><TouchableOpacity style={styles.summaryButton} onPress={handleCollectRewards}><Text style={styles.summaryButtonText}>Collect Rewards</Text></TouchableOpacity></View></View></Modal>
          <Modal animationType="fade" transparent={false} visible={showBadgeReveal} onRequestClose={closeBadgeReveal}><View style={styles.badgeRevealContainer}><TouchableOpacity style={styles.closeRevealButton} onPress={closeBadgeReveal}><Ionicons name="close-circle-outline" size={40} color="#666" /></TouchableOpacity><Animated.View style={{ alignItems: 'center', opacity: badgeOpacity, transform: [{ scale: badgeScale }] }}><Text style={styles.revealTitle}>MILESTONE UNLOCKED</Text><Ionicons name="trophy" size={120} color="#FFD700" /><Text style={styles.revealName}>{runSummaryData?.newBadge?.name}</Text></Animated.View></View></Modal>
          <Modal animationType="slide" transparent={true} visible={showAnalyticsModal} onRequestClose={() => setShowAnalyticsModal(false)}>
              <View style={styles.analyticsModalContainer}>
                  <View style={styles.analyticsModalContent}>
                      <View style={styles.analyticsHeader}>
                          <Text style={styles.analyticsTitle}>FULL ANALYTICS</Text>
                          <TouchableOpacity onPress={() => setShowAnalyticsModal(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity>
                      </View>
                      <ScrollView showsVerticalScrollIndicator={false}>
                          <View style={styles.analyticsSection}>
                              <View style={{flexDirection:'row', alignItems:'center', marginBottom:10}}><Ionicons name="heart-circle" size={20} color={COLORS.danger} style={{marginRight:8}} /><Text style={styles.analyticsSubTitle}>Estimated VO2 Max</Text></View>
                              <Text style={styles.analyticsBigNumber}>{analyticsData.vo2Max}</Text>
                              <Text style={styles.analyticsText}>{analyticsData.vo2Max === "N/A" ? "Not enough data yet." : "Measures aerobic capacity."}</Text>
                          </View>

                          {/* --- RACE PREDICTOR --- */}
                          <View style={styles.analyticsSection}>
                              <View style={{flexDirection:'row', alignItems:'center', marginBottom:15}}>
                                  <Ionicons name="stopwatch" size={20} color="#FF9500" style={{marginRight:8}} />
                                  <Text style={styles.analyticsSubTitle}>Race Day Predictor</Text>
                              </View>
                              {analyticsData.predictions ? (
                                  <>
                                      <View style={styles.pbRow}><Text style={styles.pbLabel}>10k Predicted</Text><Text style={styles.pbValue}>{analyticsData.predictions['10k']}</Text></View>
                                      <View style={styles.pbRow}><Text style={styles.pbLabel}>Half Marathon</Text><Text style={styles.pbValue}>{analyticsData.predictions['Half']}</Text></View>
                                      <View style={styles.pbRow}><Text style={styles.pbLabel}>Marathon</Text><Text style={styles.pbValue}>{analyticsData.predictions['Marathon']}</Text></View>
                                      <Text style={styles.analyticsText}>Based on your recent performance.</Text>
                                  </>
                              ) : (
                                  <Text style={styles.analyticsText}>Complete at least one 5k+ run to unlock.</Text>
                              )}
                          </View>

                          {/* --- REAL HEART RATE ZONES --- */}
                          <View style={styles.analyticsSection}>
                              <View style={{flexDirection:'row', alignItems:'center', marginBottom:10}}>
                                  <Ionicons name="pulse" size={20} color="#FF3B30" style={{marginRight:8}} />
                                  <Text style={styles.analyticsSubTitle}>Training Zones Distribution</Text>
                              </View>
                              <View style={{height: 100, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 10}}>
                                  {analyticsData.zones.map((h, i) => (
                                      <View key={i} style={{alignItems: 'center'}}>
                                          <View style={{width: 40, height: h, backgroundColor: i === 1 ? COLORS.accent : '#333', borderRadius: 4}} />
                                          <Text style={{color: '#666', fontSize: 10, marginTop: 4}}>Z{i+1}</Text>
                                      </View>
                                  ))}
                              </View>
                              <Text style={styles.analyticsText}>Shows where you spend your training time (Zones 1-5).</Text>
                          </View>

                          {/* --- REAL RECOVERY TRENDS --- */}
                          <View style={styles.analyticsSection}>
                              <View style={{flexDirection:'row', alignItems:'center', marginBottom:10}}>
                                  <Ionicons name="battery-charging" size={20} color={analyticsData.recovery.color} style={{marginRight:8}} />
                                  <Text style={styles.analyticsSubTitle}>Recovery Status</Text>
                              </View>
                              <View style={{backgroundColor: '#333', height: 10, borderRadius: 5, marginTop: 10, overflow: 'hidden'}}>
                                  <View style={{width: analyticsData.recovery.pct, height: '100%', backgroundColor: analyticsData.recovery.color}} />
                              </View>
                              <View style={{flexDirection:'row', justifyContent:'space-between', marginTop: 5}}>
                                  <Text style={{color:'#FFF', fontWeight:'bold'}}>{analyticsData.recovery.text}</Text>
                                  <Text style={{color:'#666'}}>{analyticsData.recovery.pct === "100%" ? "Fully Rested" : "Resting..."}</Text>
                              </View>
                          </View>

                          <View style={styles.analyticsSection}>
                              <View style={{flexDirection:'row', alignItems:'center', marginBottom:10}}><Ionicons name="bar-chart" size={20} color={COLORS.accent} style={{marginRight:8}} /><Text style={styles.analyticsSubTitle}>Volume Load (Last 4 Weeks)</Text></View>
                              <View style={styles.volChartRow}>{analyticsData.weeks.map((val, idx) => (<View key={idx} style={styles.volBarWrapper}><View style={[styles.volBar, { height: (val / analyticsData.maxVol) * 80 || 2 }]} /><Text style={styles.volLabel}>W{idx+1}</Text></View>))}</View>
                              <Text style={styles.analyticsText}>Monitor total distance.</Text>
                          </View>
                          <View style={styles.analyticsSection}>
                              <View style={{flexDirection:'row', alignItems:'center', marginBottom:15}}><Ionicons name="medal" size={20} color="#FFD700" style={{marginRight:8}} /><Text style={styles.analyticsSubTitle}>Personal Records</Text></View>
                              <View style={styles.pbRow}><Text style={styles.pbLabel}>1 km</Text><Text style={styles.pbValue}>{analyticsData.pbs['1k']}</Text></View>
                              <View style={styles.pbRow}><Text style={styles.pbLabel}>5 km</Text><Text style={styles.pbValue}>{analyticsData.pbs['5k']}</Text></View>
                              <View style={styles.pbRow}><Text style={styles.pbLabel}>10 km</Text><Text style={styles.pbValue}>{analyticsData.pbs['10k']}</Text></View>
                          </View>
                          <View style={styles.analyticsSection}>
                              <View style={{flexDirection:'row', alignItems:'center', marginBottom:10}}><MaterialCommunityIcons name="shoe-sneaker" size={20} color={COLORS.blue} style={{marginRight:8}} /><Text style={styles.analyticsSubTitle}>Gear Mileage</Text></View>
                              {analyticsData.gearList.map(g => (<View key={g.id} style={{flexDirection:'row', justifyContent:'space-between', marginBottom:8, borderBottomWidth:1, borderBottomColor:'#333', paddingBottom:4}}><Text style={{color:'#CCC', fontSize:12}}>{g.name}</Text><Text style={{color:COLORS.accent, fontSize:12, fontFamily:'Poppins_700Bold'}}>{(g.distance || 0).toFixed(1)} km</Text></View>))}
                          </View>
                      </ScrollView>
                  </View>
              </View>
          </Modal>

          <NotificationSheet visible={showNotifications} onClose={() => setShowNotifications(false)} />

          <FloatingNavBar current="Home" />
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width: '100%', height: '100%', backgroundColor: '#000' }, 
  overlay: { flex: 1 }, 
  container: { flex: 1, paddingTop: Platform.OS === 'android' ? 50 : 0 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  greetingContainer: { marginBottom: 20 },
  greetingText: { fontSize: 32, fontFamily: 'Poppins_700Bold', color: '#FFF' },
  subGreeting: { fontSize: 14, color: '#888', marginTop: 5 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontFamily: 'Poppins_600SemiBold', color: '#FFF' },
  
  // GLASS EFFECT FOR CARDS
  insightDashboard: { backgroundColor: 'rgba(28, 28, 30, 0.65)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', marginBottom: 25 },
  hrChartContainer: { backgroundColor: 'rgba(28, 28, 30, 0.65)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', marginBottom: 25 },
  progressMainCard: { backgroundColor: 'rgba(28, 28, 30, 0.65)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', marginBottom: 25 },
  statCard: { width: '48%', backgroundColor: 'rgba(28, 28, 30, 0.65)', padding: 15, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', justifyContent: 'space-between' },
  workoutCard: { backgroundColor: 'rgba(28, 28, 30, 0.65)', borderRadius: 20, padding: 20, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  xpCard: { backgroundColor: 'rgba(28, 28, 30, 0.65)', borderRadius: 20, padding: 20, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },

  // INNER COMPONENTS
  insightTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  insightCol: { flex: 1, alignItems: 'center' },
  verticalInsightDivider: { width: 1, height: 40, backgroundColor: '#333' },
  insightLabel: { color: '#666', fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1, marginBottom: 5 },
  insightValue: { color: '#FFF', fontSize: 24, fontFamily: 'Poppins_700Bold' },
  insightUnit: { fontSize: 12, color: '#666' },
  improvementBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(204, 255, 0, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 5 },
  improvementText: { color: "#CCFF00", fontSize: 9, fontFamily: 'Poppins_700Bold', marginLeft: 4 },
  insightSubtext: { color: '#444', fontSize: 10, marginTop: 5 },
  insightFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#222', paddingTop: 15 },
  insightFooterText: { color: '#888', fontSize: 12, marginLeft: 8, fontFamily: 'Poppins_500Medium' },
  
  hrHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  hrTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold', marginLeft: 10 },
  hrAiAdvice: { color: '#666', fontSize: 11, fontStyle: 'italic', marginTop: 15, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 10 },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weeklyLabel: { color: '#AAA', fontSize: 14, fontFamily: 'Poppins_400Regular' },
  percentageBig: { fontSize: 36, fontFamily: 'Poppins_700Bold', marginVertical: 5 },
  kmSmall: { color: '#666', fontSize: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  statIconContainer: { marginBottom: 10 },
  statNumber: { fontSize: 28, fontFamily: 'Poppins_700Bold', color: '#FFF' },
  statLabel: { fontSize: 14, color: '#AAA', fontFamily: 'Poppins_400Regular', marginBottom: 5 },
  trendRow: { flexDirection: 'row', alignItems: 'center' },
  workoutHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginRight: 8 },
  aiBadgeText: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#000' },
  workoutTitle: { color: '#FFF', fontFamily: 'Poppins_600SemiBold' },
  workoutName: { color: '#FFF', fontSize: 22, fontFamily: 'Poppins_700Bold', marginBottom: 5 },
  workoutDesc: { color: '#AAA', fontSize: 14, marginBottom: 15 },
  intensityBadge: { backgroundColor: '#333', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
  intensityText: { color: '#FFF', fontSize: 12 },
  completedBadge: { backgroundColor: '#4CD964', borderRadius: 15 },
  startRunButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent, borderRadius: 25, padding: 20, justifyContent: 'center', marginBottom: 25, height: 60 },
  startRunText: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#000', marginLeft: 10 },
  xpHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  xpLevelText: { color: '#FFF', fontFamily: 'Poppins_700Bold' },
  xpTargetText: { color: '#AAA', fontSize: 12, paddingTop: 5, },
  xpProgressBarContainer: { height: 6, backgroundColor: '#333', borderRadius: 3, marginTop: 4, overflow: 'hidden' },
  xpProgressBarFill: { height: '100%', backgroundColor: COLORS.accent },
  xpProgressBarFillEarning: { height: '100%', backgroundColor: '#FFD700' },
  xpCurrentProgressText: { color: '#AAA', fontSize: 12 },
  xpCurrentProgressPercentText: { color: '#FFF', fontSize: 12 },
  earningHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  dotLocked: { backgroundColor: '#333' },
  dotUnlocked: { backgroundColor: '#FFD700' },
  earningText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  earningTextLocked: { color: '#666' },
  earningTextUnlocked: { color: '#FFF' },
  lockStatus: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
  lockStatusLocked: { color: '#666' },
  lockStatusUnlocked: { color: '#FFD700' },
  xpFooterRunText: { color: '#666', fontSize: 10, marginTop: 10, fontStyle: 'italic' },
  tipContainer: { width: 220, marginRight: 15 },
  tipImageBg: { width: 220, height: 140, justifyContent: 'space-between', padding: 10 },
  tipTopRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  viewsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  viewsText: { color: '#FFF', fontSize: 10, marginLeft: 4 },
  viewButtonContainer: { alignSelf: 'flex-start' },
  viewButtonOpaque: { backgroundColor: COLORS.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  viewButtonText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#000' },
  tipTitleText: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', marginTop: 10, fontSize: 14 },
  tipDescText: { color: '#AAA', fontSize: 12, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  promptCard: { width: '80%', backgroundColor: '#222', borderRadius: 20, padding: 25, alignItems: 'center' },
  promptTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold', marginBottom: 10 },
  promptMessage: { color: '#AAA', textAlign: 'center', marginBottom: 20 },
  promptButton: { backgroundColor: COLORS.accent, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  promptButtonText: { fontFamily: 'Poppins_700Bold', color: '#000' },
  promptSkipText: { color: '#666' },
  summaryCard: { width: '85%', backgroundColor: '#222', borderRadius: 20, padding: 30, alignItems: 'center', borderColor: COLORS.accent, borderWidth: 1 },
  summaryTitle: { fontSize: 24, fontFamily: 'Poppins_700Bold', color: '#FFF', marginBottom: 10 },
  summaryStats: { color: '#AAA', fontSize: 16, marginBottom: 20 },
  xpBadge: { backgroundColor: '#333', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15, marginBottom: 20 },
  xpBadgeText: { color: '#FFD700', fontFamily: 'Poppins_700Bold' },
  summaryButton: { backgroundColor: COLORS.accent, paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30 },
  summaryButtonText: { fontFamily: 'Poppins_700Bold', color: '#000' },
  badgeRevealContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  revealTitle: { color: COLORS.accent, fontSize: 18, fontFamily: 'Poppins_700Bold', marginBottom: 20, letterSpacing: 2 },
  glowContainer: { shadowColor: '#FFD700', shadowOpacity: 0.8, shadowRadius: 30, elevation: 20 },
  revealName: { color: '#FFF', fontSize: 28, fontFamily: 'Poppins_700Bold', marginTop: 20 },
  revealDesc: { color: '#AAA', textAlign: 'center', paddingHorizontal: 40, marginTop: 10 },
  revealCongrat: { color: '#666', fontSize: 12, marginTop: 20, textTransform: 'uppercase', letterSpacing: 1 },
  divider: { height: 1, width: 50, backgroundColor: '#333', marginTop: 20 },
  closeRevealButton: { position: 'absolute', top: 50, right: 20 },

  // --- ANALYTICS MODAL STYLES ---
  analyticsModalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
  analyticsModalContent: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 25, borderTopRightRadius: 25, height: '80%', padding: 25 },
  analyticsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  analyticsTitle: { color: COLORS.accent, fontSize: 20, fontFamily: 'Poppins_700Bold', letterSpacing: 2 },
  analyticsSection: { marginBottom: 30, backgroundColor: '#222', borderRadius: 15, padding: 15, borderWidth: 1, borderColor: '#333' },
  analyticsSubTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold', paddingBottom: 5, },
  analyticsText: { color: '#888', fontSize: 13, lineHeight: 20, marginTop: 5 },
  analyticsBigNumber: { color: '#FFF', fontSize: 48, fontFamily: 'Poppins_700Bold', marginVertical: 5 },
  volChartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100, paddingVertical: 10 },
  volBarWrapper: { alignItems: 'center', flex: 1 },
  volBar: { width: 12, backgroundColor: COLORS.accent, borderRadius: 4 },
  volLabel: { color: '#666', fontSize: 10, marginTop: 5 },
  pbRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 4 },
  pbLabel: { color: '#CCC', fontSize: 14, fontFamily: 'Poppins_500Medium' },
  pbValue: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_700Bold' },

  // --- STREAK STYLES ---
  streakBadge: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      backgroundColor: '#333', 
      borderRadius: 15, 
      paddingHorizontal: 10, 
      paddingVertical: 5, 
      marginLeft: 10 
  },
  streakText: { 
      color: '#FFF', 
      fontSize: 14, 
      fontFamily: 'Poppins_700Bold', 
      marginLeft: 4 
  },

  // --- AI COACH CARD STYLES ---
  aiCoachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.65)',
    borderRadius: 20,
    padding: 15,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  aiCoachIconBox: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  aiCoachTitle: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  aiCoachSubtitle: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  // Add these new styles:
  coinDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent, // Neon Yellow background
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  coinDisplayText: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    color: '#000', // Black text for contrast
    marginLeft: 5,
  },
});