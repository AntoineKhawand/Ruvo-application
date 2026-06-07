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
  card: "#121212",
  userBubble: "#CCFF00",
  aiBubble: "#1A1A1A",
  text: "#FFFFFF",
  subText: "#A0A0A0",
  border: "#262626"
};

// --- Lightweight Markdown Renderer ---
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

  const bodyStyle = { color: '#FFF', fontSize: 15, lineHeight: 23, fontFamily: 'Poppins_400Regular', ...style };

  return (
    <View>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <View key={i} style={{ height: 8 }} />;

        if (trimmed.startsWith('### '))
          return <Text key={i} style={[bodyStyle, { fontFamily: 'Poppins_600SemiBold', marginTop: 8, marginBottom: 4 }]}>{renderInline(trimmed.slice(4), bodyStyle)}</Text>;
        if (trimmed.startsWith('## '))
          return <Text key={i} style={[bodyStyle, { color: COLORS.accent, fontSize: 17, fontFamily: 'Poppins_700Bold', marginTop: 10, marginBottom: 6 }]}>{renderInline(trimmed.slice(3), { ...bodyStyle, color: COLORS.accent })}</Text>;
        if (trimmed.startsWith('# '))
          return <Text key={i} style={[bodyStyle, { color: COLORS.accent, fontSize: 20, fontFamily: 'Poppins_800ExtraBold', marginTop: 12, marginBottom: 8 }]}>{renderInline(trimmed.slice(2), { ...bodyStyle, color: COLORS.accent })}</Text>;

        if (trimmed.startsWith('- ') || trimmed.startsWith('• '))
          return <View key={i} style={{ flexDirection: 'row', paddingLeft: 8, marginBottom: 4 }}>
            <Text style={{ color: COLORS.accent, fontSize: 15 }}>• </Text>
            <Text style={[bodyStyle, { flex: 1 }]}>{renderInline(trimmed.slice(2), bodyStyle)}</Text>
          </View>;

        const numMatch = trimmed.match(/^(\d+)\.\s/);
        if (numMatch)
          return <View key={i} style={{ flexDirection: 'row', paddingLeft: 8, marginBottom: 4 }}>
            <Text style={{ color: COLORS.accent, fontFamily: 'Poppins_700Bold', fontSize: 15 }}>{numMatch[1]}. </Text>
            <Text style={[bodyStyle, { flex: 1 }]}>{renderInline(trimmed.slice(numMatch[0].length), bodyStyle)}</Text>
          </View>;

        return <Text key={i} style={[bodyStyle, { marginBottom: 5 }]}>{renderInline(trimmed, bodyStyle)}</Text>;
      })}
    </View>
  );
};

// --- Animated typing dots ---
const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(600 - delay),
      ])
    );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 150);
    const a3 = anim(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const dotStyle = (dot) => ({
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#555', marginHorizontal: 3,
    opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
  });

  return (
    <View style={styles.typingRow}>
      <LinearGradient colors={[COLORS.accent, '#AADD00']} style={styles.typingAvatar}>
        <MaterialCommunityIcons name="robot" size={12} color="#000" />
      </LinearGradient>
      <View style={styles.typingBubble}>
        <Animated.View style={dotStyle(dot1)} />
        <Animated.View style={dotStyle(dot2)} />
        <Animated.View style={dotStyle(dot3)} />
      </View>
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
  { id: 'analyze', title: 'Analyze Last Run', desc: 'Get insights from your recent session', icon: 'analytics-outline', color: '#4ADE80', prompt: "📊 Analyze my last run and give me 3 tips." },
  { id: 'plan', title: 'Generate Plan', desc: 'Build a personalized training week', icon: 'calendar-outline', color: '#60A5FA', prompt: "📅 Create a training plan for next week." },
  { id: 'recover', title: 'Recovery Check', desc: 'Tailored advice for sore muscles', icon: 'medical-outline', color: '#F87171', prompt: "🩹 My legs are sore. What should I do?" },
  { id: 'nutrition', title: 'Fueling Tips', desc: 'Pre-race and run nutrition guidance', icon: 'nutrition-outline', color: '#FBBF24', prompt: "🍎 What should I eat before my 10k?" },
];

export default function AICoachScreen({ navigation, route }) {
  const { userData, user, refreshUser, healthData, whoopData, ouraData } = useUser();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [coachMemories, setCoachMemories] = useState([]);
  const [latestInsight, setLatestInsight] = useState(null);

  useEffect(() => {
    if (route.params?.initialPrompt) {
      handleSend(route.params.initialPrompt);
    }
  }, [route.params]);

  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

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
      const contextWithUid = { ...userData, uid: user.uid, healthData, whoopData, ouraData };
      const response = await sendMessageToAI(text, contextWithUid);
      const aiText = response.text || response;
      if (response.actionTaken && refreshUser) refreshUser();
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

  // --- PREVIEW ---
  const PREVIEW_MESSAGES = [
    { id: 'p1', sender: 'user', text: "How should I train for a 10k in 6 weeks?" },
    { id: 'p2', sender: 'ai', text: "Great goal! Based on your current fitness, I'd structure it as:\n\n**Week 1–2:** Base building — 3 easy runs (5km each)\n**Week 3–4:** Add one tempo run, push to 7km long run\n**Week 5:** Peak week — 8km long run + intervals\n**Week 6:** Taper — light runs, rest before race day 🏁" },
    { id: 'p3', sender: 'user', text: "What pace should I aim for?" },
    { id: 'p4', sender: 'ai', text: "Based on your recent runs, target **6:30/km** for race day. Start the first 2km at 6:45 to conserve energy, then push from the halfway mark. You've got this! 💪" },
  ];

  const renderZeroState = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.zeroStateContainer}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={[styles.zeroHeader, { opacity: fadeAnim }]}>
        {/* Pulsing ring + avatar */}
        <View style={styles.avatarRingWrapper}>
          <Animated.View style={[styles.avatarRingOuter, { transform: [{ scale: pulseAnim }] }]} />
          <LinearGradient colors={[COLORS.accent, '#AADD00']} style={styles.largeAvatar}>
            <MaterialCommunityIcons name="robot" size={38} color="#000" />
          </LinearGradient>
        </View>

        {/* Title + subtitle */}
        <Text style={styles.zeroTitle}>Hello, {userData.name?.split(' ')[0] || 'Athlete'}!</Text>
        <Text style={styles.zeroSubtitle}>{"I'm your personal AI coach — trained on your stats, runs, and goals."}</Text>

        {/* Gemini badge */}
        <View style={styles.poweredBadge}>
          <MaterialCommunityIcons name="star-four-points" size={11} color={COLORS.accent} />
          <Text style={styles.poweredBadgeText}>Powered by Gemini AI</Text>
        </View>
      </Animated.View>

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
                      <MaterialCommunityIcons name="robot" size={14} color="#000" />
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
              <Ionicons name="lock-closed" size={14} color="#000" />
              <Text style={styles.previewLockText}>Unlock with Pro</Text>
            </View>
          </View>
        </View>
      )}

      {/* WEEKLY INSIGHT */}
      {latestInsight && (
        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <View style={styles.insightIconCircle}>
              <MaterialCommunityIcons name="lightbulb-outline" size={14} color={COLORS.accent} />
            </View>
            <Text style={styles.insightLabel}>WEEKLY INSIGHT</Text>
          </View>
          <Text style={styles.insightText}>{latestInsight.text}</Text>
          <View style={styles.insightFooter}>
            <Ionicons name="walk-outline" size={12} color="#555" />
            <Text style={styles.insightMeta}>
              {latestInsight.runsThisWeek} run{latestInsight.runsThisWeek !== 1 ? 's' : ''} · {latestInsight.kmThisWeek?.toFixed(1)}km this week
            </Text>
          </View>
        </View>
      )}

      {/* MEMORY CHIPS */}
      {coachMemories.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>WHAT I REMEMBER</Text>
            <View style={styles.memCountBadge}>
              <Text style={styles.memCountText}>{coachMemories.length}</Text>
            </View>
          </View>
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

      {/* QUICK ACTIONS */}
      <Text style={[styles.sectionLabel, { marginBottom: 14 }]}>QUICK ACTIONS</Text>
      <View style={styles.gridContainer}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.actionCard}
            onPress={() => { lightTap(); handleSend(action.prompt); }}
            activeOpacity={0.75}
          >
            {/* Colored accent top bar */}
            <View style={[styles.actionCardAccent, { backgroundColor: action.color }]} />
            <View style={styles.actionCardInner}>
              <View style={[styles.actionIconCircle, { backgroundColor: action.color + '20', borderColor: action.color + '40' }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionDesc}>{action.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pro CTA for free users */}
      {!userData.isPro && (
        <TouchableOpacity
          style={styles.upgradeCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Paywall')}
        >
          <LinearGradient
            colors={['#0D1A00', '#1A3300']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.upgradeCardGradient}
          >
            <View style={styles.upgradeLeft}>
              <View style={styles.upgradeIconCircle}>
                <Ionicons name="flash" size={18} color="#000" />
              </View>
              <View>
                <Text style={styles.upgradeTitle}>Unlock Full Coaching</Text>
                <Text style={styles.upgradeSub}>Send unlimited custom messages</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.accent} />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  const renderMessage = useCallback(({ item }) => {
    const isAi = item.sender === 'ai';

    return (
      <View style={[styles.msgRow, isAi ? styles.msgRowLeft : styles.msgRowRight]}>
        {isAi && (
          <View style={styles.avatarContainer}>
            <LinearGradient colors={[COLORS.accent, '#AADD00']} style={styles.avatarImage}>
              <MaterialCommunityIcons name="robot" size={14} color="#000" />
            </LinearGradient>
          </View>
        )}
        <View style={[styles.bubble, isAi ? styles.bubbleLeft : styles.bubbleRight]}>
          {isAi ? (
            <SimpleMarkdown style={{}}>{item.text}</SimpleMarkdown>
          ) : (
            <Text style={[styles.msgText, styles.textRight]}>{item.text}</Text>
          )}
        </View>
      </View>
    );
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <BlurView intensity={80} tint="dark" style={styles.header}>
        <TouchableOpacity onPress={() => { lightTap(); navigation.goBack(); }} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>AI COACH</Text>
          <View style={styles.headerStatusDot} />
        </View>

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
          ListFooterComponent={isTyping ? <TypingIndicator /> : null}
        />
      )}

      {/* INPUT */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
        <View style={styles.inputBar}>
          {!userData.isPro ? (
            <TouchableOpacity
              style={styles.proInputDisabled}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Paywall')}
            >
              <View style={styles.proLockCircle}>
                <Ionicons name="lock-closed" size={12} color={COLORS.accent} />
              </View>
              <Text style={styles.proInputText}>Pro only — tap to upgrade</Text>
              <Ionicons name="chevron-forward" size={14} color="#444" />
            </TouchableOpacity>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask your coach..."
                placeholderTextColor="#444"
                returnKeyType="send"
                onSubmitEditing={() => handleSend()}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                onPress={() => handleSend()}
                disabled={!inputText.trim()}
              >
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_700Bold', letterSpacing: 1.5 },
  headerStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.accent },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 5 },
  menuInlineItem: { marginRight: 10, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333' },
  menuTextDestructive: { color: '#FF4444', fontFamily: 'Poppins_600SemiBold', fontSize: 12 },

  // Chat
  chatContainer: { padding: 16, paddingBottom: 20 },
  msgRow: { flexDirection: 'row', marginBottom: 16 },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },
  avatarContainer: { marginRight: 8, marginTop: 6 },
  avatarImage: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },

  bubble: { maxWidth: width * 0.78, padding: 14, borderRadius: 20 },
  bubbleLeft: { backgroundColor: '#141414', borderTopLeftRadius: 4, borderWidth: 1, borderColor: '#242424' },
  bubbleRight: { backgroundColor: COLORS.userBubble, borderBottomRightRadius: 4 },

  msgText: { fontSize: 15, lineHeight: 22, fontFamily: 'Poppins_400Regular', color: COLORS.text },
  textRight: { color: '#000', fontFamily: 'Poppins_500Medium' },

  // Typing indicator
  typingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: 4 },
  typingAvatar: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414', borderRadius: 20, borderTopLeftRadius: 4, borderWidth: 1, borderColor: '#242424', paddingHorizontal: 14, paddingVertical: 12 },

  // Zero State
  zeroStateContainer: { padding: 20, paddingBottom: 40 },

  zeroHeader: { alignItems: 'center', marginBottom: 32 },
  avatarRingWrapper: { width: 100, height: 100, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  avatarRingOuter: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: COLORS.accent + '40',
  },
  largeAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  zeroTitle: { color: '#FFF', fontSize: 26, fontFamily: 'Poppins_800ExtraBold', marginBottom: 8, textAlign: 'center' },
  zeroSubtitle: { color: COLORS.subText, fontSize: 14, textAlign: 'center', lineHeight: 22, fontFamily: 'Poppins_400Regular', paddingHorizontal: 20, marginBottom: 14 },
  poweredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.accent + '15',
    borderWidth: 1,
    borderColor: COLORS.accent + '30',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  poweredBadgeText: { color: COLORS.accent, fontSize: 11, fontFamily: 'Poppins_600SemiBold' },

  // Preview
  previewWrapper: { opacity: 0.2, marginBottom: 12, position: 'relative' },
  previewOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  previewLockBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  previewLockText: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 13 },

  // Section header row
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginLeft: 2 },
  sectionLabel: { color: '#444', fontSize: 11, fontFamily: 'Poppins_700Bold', letterSpacing: 1.5, textTransform: 'uppercase' },
  memCountBadge: { backgroundColor: '#222', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  memCountText: { color: '#888', fontSize: 11, fontFamily: 'Poppins_700Bold' },

  // Insight card
  insightCard: {
    backgroundColor: '#0A1200',
    borderRadius: 18,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.accent + '25',
  },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  insightIconCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.accent + '20',
    borderWidth: 1, borderColor: COLORS.accent + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  insightLabel: { fontSize: 11, fontFamily: 'Poppins_700Bold', color: COLORS.accent, letterSpacing: 1.5, textTransform: 'uppercase' },
  insightText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: '#DDD', lineHeight: 22, marginBottom: 10 },
  insightFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  insightMeta: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: '#555' },

  // Memory chips
  memoryScroll: { marginBottom: 24 },
  memoryScrollContent: { gap: 8, paddingRight: 4 },
  memoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#161616', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  memoryChipIcon: { fontSize: 14 },
  memoryChipText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: '#CCC' },

  // Quick action cards
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  actionCard: {
    width: (width - 52) / 2,
    backgroundColor: '#0E0E0E',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  actionCardAccent: { height: 3, width: '100%' },
  actionCardInner: { padding: 16, alignItems: 'flex-start' },
  actionIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, marginBottom: 12,
  },
  actionTitle: { color: '#FFF', fontSize: 13, fontFamily: 'Poppins_600SemiBold', marginBottom: 4 },
  actionDesc: { color: '#666', fontSize: 11, fontFamily: 'Poppins_400Regular', lineHeight: 16 },

  // Pro upgrade card
  upgradeCard: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.accent + '30' },
  upgradeCardGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  upgradeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  upgradeIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  upgradeTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_700Bold' },
  upgradeSub: { color: '#888', fontSize: 12, fontFamily: 'Poppins_400Regular' },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#141414',
    backgroundColor: '#000',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#111',
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 23,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    color: '#FFF',
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#222',
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  sendBtnDisabled: { backgroundColor: '#222', shadowOpacity: 0 },
  proInputDisabled: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0E0E0E',
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    gap: 8,
  },
  proLockCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.accent + '20',
    borderWidth: 1, borderColor: COLORS.accent + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  proInputText: { color: '#555', fontFamily: 'Poppins_500Medium', fontSize: 13, flex: 1 },

  // Memory badge in header
  memoryBadge: {
    backgroundColor: '#141414',
    borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4,
    marginRight: 6,
    borderWidth: 1, borderColor: '#242424',
  },
  memoryBadgeText: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: '#AAA' },
});
