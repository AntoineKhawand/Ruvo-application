import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { addDoc, collection, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
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
// import { getTodayWorkout } from '../services/aiCoach'; // Removed as logic moved to aiServicew');

const { width } = Dimensions.get('window');

const COLORS = {
  accent: "#CCFF00",
  bg: "#000000",
  card: "#1C1C1E",
  userBubble: "#CCFF00",
  aiBubble: "#2C2C2E",
  text: "#FFFFFF",
  subText: "#888888"
};

// QUICK_PROMPTS moved inside component for better access logic or deleted if duplicate

export default function AICoachScreen({ navigation }) {
  const { userData, user } = useUser();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false); // For 3-dots menu

  const flatListRef = useRef(null);

  // --- 1. LOAD HISTORY & INIT ---
  useEffect(() => {
    if (!user) return;

    // Load from Firestore
    const q = query(
      collection(db, `users/${user.uid}/coach_messages`),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (msgs.length > 0) {
        setMessages(msgs);
      } else {
        // Initial Greeting if empty
        const name = userData?.name ? userData.name.split(' ')[0] : 'Runner';
        const lastRun = userData?.runHistory?.[0];

        let greeting = `Hi ${name}! 👋 I'm your Ruvo AI Coach. I'm connected to your stats and ready to help!`;

        if (lastRun) {
          greeting = `Hi ${name}! 👋 I noticed you ran ${lastRun.distance}km recently. Great job! How are your legs feeling? I can help with recovery tips or your next plan.`;
        }
        saveMessageToFirestore({ text: greeting, sender: 'ai', timestamp: serverTimestamp() });
      }
    }, (error) => {
      // --- ERROR HANDLING ---
      if (error.code === 'permission-denied') {
        console.warn("⚠️ Firestore Permission Denied: Chat history won't be saved until rules are updated.");
        // We can optionally set a state here to warn the user, but for now we just suppress the crash.
      } else {
        console.error("Snapshot Error:", error);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // --- HELPER: SAVE TO FIRESTORE ---
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
    // 1. Check if empty
    if (!text.trim()) return;

    // 2. CHECK PRO STATUS (The "Professional" Lock)
    const isFreePrompt = text === "📅 What's the plan?";
    if (!userData.isPro && !isFreePrompt) {
      Alert.alert(
        "Pro Feature Locked",
        "Custom AI coaching is available for Pro members only.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "View Plans", onPress: () => navigation.navigate("Paywall") }
        ]
      );
      return;
    }

    // 3. Add User Message (Optimistic UI + Save)
    const userMsg = { text: text, sender: 'user', timestamp: serverTimestamp() };
    setInputText("");
    Keyboard.dismiss();
    saveMessageToFirestore(userMsg);

    // 4. AI Response
    setIsTyping(true);
    try {
      const aiResponseText = await sendMessageToAI(text, userData);
      saveMessageToFirestore({ text: aiResponseText, sender: 'ai', timestamp: serverTimestamp() });
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = async () => {
    if (!user) return;
    Alert.alert("Clear Chat", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear", style: 'destructive', onPress: async () => {
          // In a real app, use a batch delete. For now, we'll just hide them locally or warn user.
          // A proper implementation would require a cloud function or batch loop.
          // For simplicity: We will just NOT implement delete for now, or use a batch of 50.
          const q = query(collection(db, `users/${user.uid}/coach_messages`), limit(50));
          const snapshot = await getDocs(q);
          const batch = writeBatch(db);
          snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          setMessages([]); // Clear local
          setShowMenu(false);
        }
      }
    ]);
  };

  const renderItem = ({ item }) => {
    const isAi = item.sender === 'ai';
    return (
      <View style={[styles.msgRow, isAi ? styles.msgRowLeft : styles.msgRowRight]}>
        {isAi && (
          <View style={styles.avatarContainer}>
            <View style={[styles.avatarImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.accent }]}>
              <MaterialCommunityIcons name="robot" size={18} color="#000" />
            </View>
          </View>
        )}
        <View style={[
          styles.bubble,
          isAi ? styles.bubbleLeft : styles.bubbleRight
        ]}>
          <Text style={[styles.msgText, isAi ? styles.textLeft : styles.textRight]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };


  // --- LOCKED PROMPTS ---
  const QUICK_PROMPTS = [
    { id: '3', text: "📅 What's the plan?", icon: "calendar-clock", locked: false },
    { id: '1', text: "📊 Analyze my week", icon: "google-analytics", locked: true },
    { id: '4', text: "🔥 Am I overtraining?", icon: "fire", locked: true },
    { id: '2', text: "🩹 My knee hurts", icon: "bandage", locked: true },
  ];

  // Fix: Handle Prompt Press
  const handlePromptPress = (item) => {
    if (item.locked && !userData.isPro) {
      Alert.alert(
        "Pro Feature Locked",
        "This AI analysis requires a Pro subscription.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "View Plans", onPress: () => navigation.navigate("Paywall") }
        ]
      );
      return;
    }
    handleSend(item.text);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>

        {/* AVATAR + TITLE */}
        <View style={styles.headerContent}>
          <View style={[styles.headerAvatar, { justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.accent }]}>
            <MaterialCommunityIcons name="robot" size={20} color="#000" />
          </View>
          <View>
            <Text style={styles.headerTitle}>RUVO COACH</Text>
            <Text style={styles.headerSubtitle}>
              {isTyping ? "Typing..." : "Online • Context Active"}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(prev => !prev)}>
          <Ionicons name="ellipsis-vertical" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* MENU MODAL (Simple overlay for now) */}
      {showMenu && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity style={styles.menuItem} onPress={handleClearChat}>
            <Ionicons name="trash-outline" size={18} color="#FF4444" />
            <Text style={[styles.menuText, { color: '#FF4444' }]}>Clear Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
            <Ionicons name="close-circle-outline" size={18} color="#FFF" />
            <Text style={styles.menuText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CHAT LIST */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.chatContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={isTyping && (
          <View style={styles.typingContainer}>
            <View style={styles.avatar}>
              <MaterialCommunityIcons name="robot" size={16} color={COLORS.bg} />
            </View>
            <View style={styles.bubbleLeft}>
              <Text style={styles.typingDots}>•••</Text>
            </View>
          </View>
        )}
      />



      {/* QUICK PROMPTS */}
      <View>
        <FlatList
          data={QUICK_PROMPTS}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.promptsList}
          contentContainerStyle={{ paddingHorizontal: 15 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.promptChip, item.locked && !userData.isPro && { borderColor: '#333', opacity: 0.7 }]}
              onPress={() => handlePromptPress(item)}
            >
              {/* Only show LOCK icon if locked. Otherwise, relying on Emoji in text for clean look. */}
              {(item.locked && !userData.isPro) && (
                <MaterialCommunityIcons name="lock" size={14} color="#666" style={{ marginRight: 6 }} />
              )}
              <Text style={[styles.promptText, item.locked && !userData.isPro && { color: '#666', marginLeft: 0 }]}>{item.text}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.id}
        />
      </View>

      {/* INPUT AREA */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={10}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about your training..."
            placeholderTextColor="#666"
            returnKeyType="send"
            onSubmitEditing={() => handleSend()}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={() => handleSend()}>
            <Ionicons name="arrow-up" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}



const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  headerContent: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#333' },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  headerSubtitle: { color: COLORS.subText, fontSize: 12, fontWeight: '500' },
  backBtn: { padding: 5 },
  menuBtn: { padding: 5 },

  chatContainer: { padding: 20, paddingBottom: 100 },
  typingContainer: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 15, marginLeft: 10 },
  typingDots: { color: '#AAA', fontSize: 18, letterSpacing: 2 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },

  menuOverlay: {
    position: 'absolute',
    top: 100, // Moved down further as requested
    right: 15,
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 5,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
    minWidth: 150
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#444'
  },
  menuText: {
    color: COLORS.text,
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '500'
  },
  avatarContainer: { marginRight: 10, marginBottom: 5 },
  avatarImage: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#333' },

  bubble: { maxWidth: width * 0.75, padding: 15, borderRadius: 20 },
  bubbleLeft: { backgroundColor: COLORS.aiBubble, borderTopLeftRadius: 5 },
  bubbleRight: { backgroundColor: COLORS.userBubble, borderBottomRightRadius: 5 },

  msgText: { fontSize: 15, lineHeight: 22 },
  textLeft: { color: COLORS.text },
  textRight: { color: '#000' },

  promptsList: { flexGrow: 0, marginBottom: 10, height: 50 },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 30,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#333'
  },
  promptText: { color: COLORS.text, fontSize: 13, marginLeft: 6, fontWeight: '500' },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: COLORS.bg
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 15,
    marginRight: 10
  },
  sendBtn: {
    backgroundColor: COLORS.accent,
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
