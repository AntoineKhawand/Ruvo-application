import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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

const { width } = Dimensions.get('window');

const COLORS = {
  accent: "#CCFF00",
  bg: "#000000",
  card: "#1C1C1E",
  userBubble: "#CCFF00",
  aiBubble: "#2C2C2E",
  text: "#FFFFFF",
  subText: "#888888",
  border: "#333"
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

  const bodyStyle = { color: '#FFF', fontSize: 15, lineHeight: 22, fontFamily: 'Poppins_400Regular', ...style };

  return (
    <View>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <View key={i} style={{ height: 6 }} />;

        if (trimmed.startsWith('### '))
          return <Text key={i} style={[bodyStyle, { fontFamily: 'Poppins_600SemiBold', marginTop: 4, marginBottom: 2 }]}>{renderInline(trimmed.slice(4), bodyStyle)}</Text>;
        if (trimmed.startsWith('## '))
          return <Text key={i} style={[bodyStyle, { color: COLORS.accent, fontSize: 16, fontFamily: 'Poppins_700Bold', marginTop: 6, marginBottom: 4 }]}>{renderInline(trimmed.slice(3), { ...bodyStyle, color: COLORS.accent })}</Text>;
        if (trimmed.startsWith('# '))
          return <Text key={i} style={[bodyStyle, { color: COLORS.accent, fontSize: 18, fontFamily: 'Poppins_700Bold', marginTop: 6, marginBottom: 4 }]}>{renderInline(trimmed.slice(2), { ...bodyStyle, color: COLORS.accent })}</Text>;

        if (trimmed.startsWith('- ') || trimmed.startsWith('• '))
          return <Text key={i} style={[bodyStyle, { paddingLeft: 8 }]}><Text style={{ color: COLORS.accent }}>•  </Text>{renderInline(trimmed.slice(2), bodyStyle)}</Text>;

        const numMatch = trimmed.match(/^(\d+)\.\s/);
        if (numMatch)
          return <Text key={i} style={[bodyStyle, { paddingLeft: 8 }]}><Text style={{ color: COLORS.accent, fontFamily: 'Poppins_600SemiBold' }}>{numMatch[1]}.  </Text>{renderInline(trimmed.slice(numMatch[0].length), bodyStyle)}</Text>;

        return <Text key={i} style={bodyStyle}>{renderInline(trimmed, bodyStyle)}</Text>;
      })}
    </View>
  );
};

const QUICK_ACTIONS = [
  { id: 'analyze', title: 'Analyze Last Run', icon: 'analytics-outline', prompt: "📊 Analyze my last run and give me 3 tips." },
  { id: 'plan', title: 'Generate Plan', icon: 'calendar-outline', prompt: "📅 Create a training plan for next week." },
  { id: 'recover', title: 'Recovery Check', icon: 'medical-outline', prompt: "🩹 My legs are sore. What should I do?" },
  { id: 'nutrition', title: 'Fueling Tips', icon: 'nutrition-outline', prompt: "🍎 What should I eat before my 10k?" },
];

export default function AICoachScreen({ navigation, route }) { // Added route for param access
  const { userData, user, refreshUser } = useUser();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Auto-send prompt if passed via params (e.g. from PlanScreen)
  useEffect(() => {
    if (route.params?.initialPrompt) {
      handleSend(route.params.initialPrompt);
    }
  }, [route.params]);

  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current; // For zero state fade-in

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

      // Animate in zero state if empty
      if (msgs.length === 0) {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true
        }).start();
      }
    }, (error) => {
      if (error.code !== 'permission-denied') console.error("Snapshot Error:", error);
    });

    return () => unsubscribe();
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

    // Pro Check — custom chat is Pro-only, Quick Actions are free
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
      const contextWithUid = { ...userData, uid: user.uid };
      const response = await sendMessageToAI(text, contextWithUid);

      const aiText = response.text || response;

      if (response.actionTaken) {
        if (refreshUser) refreshUser();
      }

      saveMessageToFirestore({ text: aiText, sender: 'ai', timestamp: serverTimestamp() });
    } catch (error) {
      console.error(error);
      saveMessageToFirestore({ text: "I'm having trouble connecting right now. Try again later.", sender: 'ai', timestamp: serverTimestamp() });
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = async () => {
    if (!user) return;
    Alert.alert("Clear History", "Delete all chat history?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: 'destructive', onPress: async () => {
          // In production: Cloud Function delete
          const q = query(collection(db, `users/${user.uid}/coach_messages`), limit(50));
          const snapshot = await getDocs(q);
          const batch = writeBatch(db);
          snapshot.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
          setMessages([]);
          setShowMenu(false);
        }
      }
    ]);
  };

  // --- RENDERERS ---

  const renderZeroState = () => (
    <Animated.View style={[styles.zeroStateContainer, { opacity: fadeAnim }]}>
      <View style={styles.zeroHeader}>
        <View style={styles.largeAvatar}>
          <MaterialCommunityIcons name="robot" size={40} color="#000" />
        </View>
        <Text style={styles.zeroTitle}>Hello, {userData.name?.split(' ')[0] || 'Athlete'}!</Text>
        <Text style={styles.zeroSubtitle}>I'm ready to analyze your stats and build your plan.</Text>
      </View>

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

  const renderMessage = ({ item }) => {
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
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI COACH</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowMenu(!showMenu)}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* MENU */}
      {showMenu && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity style={styles.menuItem} onPress={handleClearChat}>
            <Text style={styles.menuTextDestructive}>Clear Chat History</Text>
          </TouchableOpacity>
        </View>
      )}

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
  iconBtn: { padding: 5 },
  menuOverlay: { position: 'absolute', top: 60, right: 20, backgroundColor: '#222', padding: 10, borderRadius: 8, zIndex: 100, borderWidth: 1, borderColor: '#333' },
  menuItem: { padding: 10 },
  menuTextDestructive: { color: '#FF4444', fontFamily: 'Poppins_500Medium' },

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
  zeroStateContainer: { flex: 1, padding: 20, justifyContent: 'center' },
  zeroHeader: { alignItems: 'center', marginBottom: 40 },
  largeAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  zeroTitle: { color: '#FFF', fontSize: 24, fontFamily: 'Poppins_700Bold', marginBottom: 10 },
  zeroSubtitle: { color: '#888', fontSize: 16, textAlign: 'center', lineHeight: 24 },

  sectionLabel: { color: '#666', fontSize: 12, fontFamily: 'Poppins_700Bold', letterSpacing: 1, marginBottom: 15, marginLeft: 5 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: { width: (width - 50) / 2, backgroundColor: COLORS.card, padding: 20, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  actionTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold', textAlign: 'center' },

  // Input
  inputBar: { flexDirection: 'row', padding: 15, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#000', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#1C1C1E', height: 50, borderRadius: 25, paddingHorizontal: 20, color: '#FFF', fontFamily: 'Poppins_400Regular', marginRight: 10 },
  sendBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center' }
});
