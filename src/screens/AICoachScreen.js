import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { sendMessageToAI } from '../services/aiService';
import { lightTap, successFeedback, errorFeedback } from '../utils/haptics';

const { width } = Dimensions.get('window');

const COLORS = {
  accent: "#CCFF00",
  bg: "#000000",
  card: "#121212", // Slightly lighter than true black for depth
  userBubble: "#CCFF00",
  aiBubble: "#1A1A1A", // Darker, cleaner AI bubble
  text: "#FFFFFF",
  subText: "#A0A0A0",
  border: "#262626" // Glimmer standard border color
};

// --- Lightweight Markdown Renderer (no external deps) ---
const SimpleMarkdown = ({ children, style }) => {
  if (!children || typeof children !== 'string') return null;
  const lines = children.split('\n');

  const renderInline = (text, baseStyle) => {
    const parts = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch) {
        const idx = remaining.indexOf(boldMatch[0]);
        if (idx > 0) parts.push(<Text key={key++} style={baseStyle}>{remaining.slice(0, idx)}</Text>);
        parts.push(<Text key={key++} style={[baseStyle, { color: COLORS.accent, fontFamily: 'Poppins_700Bold' }]}>{boldMatch[1]}</Text>);
        remaining = remaining.slice(idx + boldMatch[0].length);
      } else {
        parts.push(<Text key={key++} style={baseStyle}>{remaining}</Text>);
        break;
      }
    }
    return parts;
  };

  const bodyStyle = { color: '#FFF', fontSize: 16, lineHeight: 24, fontFamily: 'Poppins_500Medium', ...style }; // Glimmer Body weight (520)

  return (
    <View>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <View key={i} style={{ height: 8 }} />;

        if (trimmed.startsWith('### '))
          return <Text key={i} style={[bodyStyle, { fontFamily: 'Poppins_600SemiBold', marginTop: 8, marginBottom: 4 }]}>{renderInline(trimmed.slice(4), bodyStyle)}</Text>;
        if (trimmed.startsWith('## '))
          return <Text key={i} style={[bodyStyle, { color: COLORS.accent, fontSize: 18, fontFamily: 'Poppins_700Bold', marginTop: 10, marginBottom: 6 }]}>{renderInline(trimmed.slice(3), { ...bodyStyle, color: COLORS.accent })}</Text>;
        if (trimmed.startsWith('# '))
          return <Text key={i} style={[bodyStyle, { color: COLORS.accent, fontSize: 22, fontFamily: 'Poppins_800ExtraBold', marginTop: 12, marginBottom: 8 }]}>{renderInline(trimmed.slice(2), { ...bodyStyle, color: COLORS.accent })}</Text>;

        if (trimmed.startsWith('- ') || trimmed.startsWith('• '))
          return <View key={i} style={{ flexDirection: 'row', paddingLeft: 8, marginBottom: 4 }}>
            <Text style={{ color: COLORS.accent, fontSize: 16 }}>• </Text>
            <Text style={[bodyStyle, { flex: 1 }]}>{renderInline(trimmed.slice(2), bodyStyle)}</Text>
          </View>;

        const numMatch = trimmed.match(/^(\d+)\.\s/);
        if (numMatch)
          return <View key={i} style={{ flexDirection: 'row', paddingLeft: 8, marginBottom: 4 }}>
            <Text style={{ color: COLORS.accent, fontFamily: 'Poppins_700Bold', fontSize: 16 }}>{numMatch[1]}. </Text>
            <Text style={[bodyStyle, { flex: 1 }]}>{renderInline(trimmed.slice(numMatch[0].length), bodyStyle)}</Text>
          </View>;

        return <Text key={i} style={[bodyStyle, { marginBottom: 6 }]}>{renderInline(trimmed, bodyStyle)}</Text>;
      })}
    </View>
  );
};

const MEMORY_ICONS = {
  injury: '🩹',
  goal: '🎯',
  pattern: '📊',
  preference: '⚙️',
  achievement: '🏆',
};

const QUICK_ACTIONS = [
  { id: 'analyze', title: 'Analyze Last Run', icon: 'analytics-outline', prompt: "📊 Analyze my last run and give me 3 tips." },
  { id: 'plan', title: 'Generate Plan', icon: 'calendar-outline', prompt: "📅 Create a training plan for next week." },
  { id: 'recover', title: 'Recovery Check', icon: 'medical-outline', prompt: "🩹 My legs are sore. What should I do?" },
  { id: 'nutrition', title: 'Fueling Tips', icon: 'nutrition-outline', prompt: "🍎 What should I eat before my 10k?" },
];

export default function AICoachScreen({ navigation, route }) { // Added route for param access
  const { userData, user, refreshUser, healthData, whoopData, ouraData } = useUser();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [coachMemories, setCoachMemories] = useState([]);
  const [latestInsight, setLatestInsight] = useState(null);

  // Auto-send prompt if passed via params (e.g. from PlanScreen)
  useEffect(() => {
    if (route.params?.initialPrompt) {
      handleSend(route.params.initialPrompt);
    }
  }, [route.params]);

  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in immediately on mount so zero state is always visible
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true
    }).start();
  }, []);

  // --- 1. LOAD HISTORY & INIT ---
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, `users/${user.uid}/coach_messages`),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    }, (error) => {
      if (error.code !== 'permission-denied') console.error("Snapshot Error:", error);
    });

    // Load memories (live) and latest weekly insight (one-shot)
    const memQ = query(
      collection(db, `users/${user.uid}/coach_memory`),
      orderBy('confidence', 'desc'),
      limit(10)
    );
    const unsubMem = onSnapshot(memQ, snap => {
      setCoachMemories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});

    getDocs(query(
      collection(db, `users/${user.uid}/coach_insights`),
      orderBy('createdAt', 'desc'),
      limit(1)
    )).then(snap => {
      if (!snap.empty) setLatestInsight(snap.docs[0].data());
    }).catch(() => {});

    return () => { unsubscribe(); unsubMem(); };
  }, [user]);

  const saveMessageToFirestore = async (msg) => {
    if (!user) return;
    try {
      await addDoc(collection(db, `users/${user.uid}/coach_messages`), msg);
    } catch (e) {
      console.error("Error saving message:", e);
    }
  };

// --- 2. SEND MESSAGE LOGIC ---
    const handleSend = async (text = inputText) => {
        if (!text.trim()) return;

        const isQuickAction = QUICK_ACTIONS.some(a => a.prompt === text);
        if (!userData.isPro && !isQuickAction) {
            Alert.alert(
                "Pro Feature",
                "Custom AI Coaching is available for Pro members. Try the Quick Actions for free, or upgrade for unlimited coaching!",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Upgrade", onPress: () => navigation.navigate("Paywall") }
                ]
            );
            return;
        }

        const userMsg = { text: text, sender: 'user', timestamp: serverTimestamp() };
        setInputText("");
        Keyboard.dismiss();
        saveMessageToFirestore(userMsg);

        setIsTyping(true);
        try {
            const contextWithUid = { 
                ...userData, 
                uid: user.uid,
                healthData,
                whoopData,
                ouraData
            };
            const response = await sendMessageToAI(text, contextWithUid);

            const aiText = response.text || response;

            if (response.actionTaken) {
                if (refreshUser) refreshUser();
            }

            saveMessageToFirestore({ text: aiText, sender: 'ai', timestamp: serverTimestamp() });
            successFeedback();
        } catch (error) {
            console.error(error);
            errorFeedback();
            saveMessageToFirestore({ text: "I'm having trouble connecting right now. Try again later.", sender: 'ai', timestamp: serverTimestamp() });
        } finally {
            setIsTyping(false);
        }
    };

    const handleClearChat = async () => {
        if (!user) return;
        setShowMenu(false);
        Alert.alert("Clear History", "Delete all chat history?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: 'destructive', onPress: async () => {
                    const q = query(collection(db, `users/${user.uid}/coach_messages`), limit(50));
                    const snapshot = await getDocs(q);
                    const batch = writeBatch(db);
                    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
                    await batch.commit();
                    setMessages([]);
                }
            }
        ]);
    };

  // --- RENDERERS ---

  const PREVIEW_MESSAGES = [
    { id: 'p1', sender: 'user', text: "How should I train for a 10k in 6 weeks?" },
    { id: 'p2', sender: 'ai', text: "Great goal! Based on your current fitness, I'd structure it as:\n\n**Week 1–2:** Base building — 3 easy runs (5km each)\n**Week 3–4:** Add one tempo run, push to 7km long run\n**Week 5:** Peak week — 8km long run + intervals\n**Week 6:** Taper — light runs, rest before race day 🏁" },
    { id: 'p3', sender: 'user', text: "What pace should I aim for?" },
    { id: 'p4', sender: 'ai', text: "Based on your recent runs, target **6:30/km** for race day. Start the first 2km at 6:45 to conserve energy, then push from the halfway mark. You've got this! 💪" },
  ];

  const renderZeroState = () => (
    <Animated.View style={[styles.zeroStateContainer, { opacity: fadeAnim }]}>
      <View style={styles.zeroHeader}>
        <View style={styles.largeAvatar}>
          <MaterialCommunityIcons name="robot" size={40} color="#000" />
        </View>
        <Text style={styles.zeroTitle}>Hello, {userData.name?.split(' ')[0] || 'Athlete'}!</Text>
        <Text style={styles.zeroSubtitle}>I'm ready to analyze your stats and build your plan.</Text>
      </View>

      {/* PREVIEW for free users */}
      {!userData.isPro && (
        <View style={styles.previewWrapper} pointerEvents="none">
          {PREVIEW_MESSAGES.map(msg => {
            const isAi = msg.sender === 'ai';
            return (
              <View key={msg.id} style={[styles.msgRow, isAi ? styles.msgRowLeft : styles.msgRowRight]}>
                {isAi && (
                  <View style={styles.avatarContainer}>
                    <LinearGradient colors={[COLORS.accent, '#AADD00']} style={styles.avatarImage}>
                      <MaterialCommunityIcons name="robot" size={16} color="#000" />
                    </LinearGradient>
                  </View>
                )}
                <View style={[styles.bubble, isAi ? styles.bubbleLeft : styles.bubbleRight]}>
                  <Text style={[styles.msgText, !isAi && styles.textRight]}>{msg.text}</Text>
                </View>
              </View>
            );
          })}
          <View style={styles.previewOverlay}>
            <View style={styles.previewLockBadge}>
              <Ionicons name="lock-closed" size={16} color="#000" />
              <Text style={styles.previewLockText}>Unlock with Pro</Text>
            </View>
          </View>
        </View>
      )}

      {/* WEEKLY INSIGHT */}
      {latestInsight && (
        <View style={styles.insightCard}>
          <Text style={styles.insightLabel}>✨ WEEKLY INSIGHT</Text>
          <Text style={styles.insightText}>{latestInsight.text}</Text>
          <Text style={styles.insightMeta}>
            {latestInsight.runsThisWeek} run{latestInsight.runsThisWeek !== 1 ? 's' : ''} · {latestInsight.kmThisWeek?.toFixed(1)}km this week
          </Text>
        </View>
      )}

      {/* MEMORY CHIPS */}
      {coachMemories.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>WHAT I REMEMBER</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.memoryScroll}
            contentContainerStyle={styles.memoryScrollContent}
          >
            {coachMemories.map(m => (
              <View key={m.id} style={styles.memoryChip}>
                <Text style={styles.memoryChipIcon}>{MEMORY_ICONS[m.type] || '🧠'}</Text>
                <Text style={styles.memoryChipText}>{m.subject}</Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
      <View style={styles.gridContainer}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.actionCard}
            onPress={() => handleSend(action.prompt)}
            activeOpacity={0.7}
          >
            <Ionicons name={action.icon} size={24} color={COLORS.accent} style={{ marginBottom: 10 }} />
            <Text style={styles.actionTitle}>{action.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderMessage = useCallback(({ item }) => {
    const isAi = item.sender === 'ai';

    return (
      <View style={[styles.msgRow, isAi ? styles.msgRowLeft : styles.msgRowRight]}>
        {isAi && (
          <View style={styles.avatarContainer}>
            <LinearGradient colors={[COLORS.accent, '#AADD00']} style={styles.avatarImage}>
              <MaterialCommunityIcons name="robot" size={16} color="#000" />
            </LinearGradient>
          </View>
        )}
        <View style={[
          styles.bubble,
          isAi ? styles.bubbleLeft : styles.bubbleRight
        ]}>
          {isAi ? (
            <SimpleMarkdown style={{}}>{item.text}</SimpleMarkdown>
          ) : (
            <Text style={[styles.msgText, styles.textRight]}>
              {item.text}
            </Text>
          )}
        </View>
      </View>
    );
  }, []); // ✅ Empty array tells React to cache this function forever

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <BlurView intensity={80} tint="dark" style={styles.header}>
        <TouchableOpacity onPress={() => { lightTap(); navigation.goBack(); }} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI COACH</Text>
        <View style={styles.headerRight}>
          {coachMemories.length > 0 && !showMenu && (
            <View style={styles.memoryBadge}>
              <Text style={styles.memoryBadgeText}>🧠 {coachMemories.length}</Text>
            </View>
          )}
          {showMenu && (
            <TouchableOpacity style={styles.menuInlineItem} onPress={handleClearChat}>
              <Text style={styles.menuTextDestructive}>Clear Chat</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={() => { lightTap(); setShowMenu(!showMenu); }}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </BlurView>

      {/* CONTENT */}
      {messages.length === 0 ? renderZeroState() : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.chatContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={isTyping && (
            <View style={{ flexDirection: 'row', marginLeft: 10, marginTop: 10 }}>
              <Text style={{ color: '#666', fontSize: 12 }}>AI is thinking...</Text>
            </View>
          )}
        />
      )}

      {/* INPUT */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
        <View style={styles.inputBar}>
          {!userData.isPro ? (
            <View style={styles.proInputDisabled}>
              <Ionicons name="lock-closed" size={16} color="#666" />
              <Text style={styles.proInputText}>Custom messages are Pro only</Text>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask your coach..."
                placeholderTextColor="#666"
                returnKeyType="send"
                onSubmitEditing={() => handleSend()}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={() => handleSend()}>
                <Ionicons name="arrow-up" size={20} color="#000" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 5 },
  menuInlineItem: { marginRight: 10, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#333' },
  menuTextDestructive: { color: '#FF4444', fontFamily: 'Poppins_500Medium', fontSize: 12 },

  // Chat
  chatContainer: { padding: 15, paddingBottom: 20 },
  msgRow: { flexDirection: 'row', marginBottom: 20 },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },
  avatarContainer: { marginRight: 8, marginTop: 10 },
  avatarImage: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

  bubble: { maxWidth: width * 0.8, padding: 16, borderRadius: 20 },
  bubbleLeft: { backgroundColor: COLORS.aiBubble, borderTopLeftRadius: 4 },
  bubbleRight: { backgroundColor: COLORS.userBubble, borderBottomRightRadius: 4 },

  msgText: { fontSize: 15, lineHeight: 22, fontFamily: 'Poppins_400Regular' },
  textLeft: { color: COLORS.text },
  textRight: { color: '#000' },

  // Rich Cards inside Bubble
  richCard: { marginTop: 15, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 12 },
  richHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 6 },
  richTitle: { color: COLORS.accent, fontSize: 12, fontFamily: 'Poppins_700Bold', textTransform: 'uppercase' },
  richBody: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold', marginBottom: 10 },
  richBtn: { backgroundColor: COLORS.accent, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  richBtnText: { color: '#000', fontSize: 12, fontFamily: 'Poppins_700Bold' },

  // Zero State
  zeroStateContainer: { flex: 1, padding: 20 },
  previewWrapper: { opacity: 0.25, marginBottom: 10, position: 'relative' },
  previewOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  previewLockBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  previewLockText: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 13 },
  zeroHeader: { alignItems: 'center', marginBottom: 40 },
  largeAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 10 },
  zeroTitle: { color: '#FFF', fontSize: 28, fontFamily: 'Poppins_800ExtraBold', marginBottom: 10, textAlign: 'center' },
  zeroSubtitle: { color: COLORS.subText, fontSize: 16, textAlign: 'center', lineHeight: 24, fontFamily: 'Poppins_500Medium' },

  sectionLabel: { color: '#444', fontSize: 12, fontFamily: 'Poppins_700Bold', letterSpacing: 2, marginBottom: 15, marginLeft: 5, textTransform: 'uppercase' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: { 
    width: (width - 52) / 2, 
    backgroundColor: COLORS.card, 
    padding: 20, 
    borderRadius: 24, // More rounded like Glimmer (36dp)
    alignItems: 'center', 
    borderWidth: 1.5, 
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  actionTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold', textAlign: 'center' },

// Input
    inputBar: { flexDirection: 'row', padding: 15, borderTopWidth: 1, borderTopColor: '#1A1A1A', backgroundColor: '#000', alignItems: 'center' },
    input: { flex: 1, backgroundColor: '#111', height: 50, borderRadius: 25, paddingHorizontal: 20, color: '#FFF', fontFamily: 'Poppins_500Medium', marginRight: 10, borderWidth: 1, borderColor: '#222' },
    sendBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 },
    proInputDisabled: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', height: 50, borderRadius: 25, paddingHorizontal: 20, borderWidth: 1, borderColor: '#222' },
    proInputText: { color: '#444', fontFamily: 'Poppins_600SemiBold', fontSize: 14, marginLeft: 8 },

    // Memory badge in header
    memoryBadge: { backgroundColor: '#1C1C1E', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, marginRight: 6, borderWidth: 1, borderColor: '#2C2C2E' },
    memoryBadgeText: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: '#AAA' },

    // Weekly insight card
    insightCard: { backgroundColor: '#0F1A00', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#CCFF0030' },
    insightLabel: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: COLORS.accent, letterSpacing: 0.08, marginBottom: 6 },
    insightText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: '#DDD', lineHeight: 22 },
    insightMeta: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: '#666', marginTop: 8 },

    // Memory chips row
    memoryScroll: { marginBottom: 16 },
    memoryScrollContent: { gap: 8, paddingRight: 4 },
    memoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1C1C1E', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#2C2C2E' },
    memoryChipIcon: { fontSize: 14 },
    memoryChipText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: '#CCC' },
});
