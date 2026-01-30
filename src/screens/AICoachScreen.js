import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
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
import { useUser } from '../context/UserContext';
import { getTodayWorkout } from '../services/aiCoach'; // Importing your existing logic

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

const QUICK_PROMPTS = [
  { id: '1', text: "📊 Analyze my week", icon: "google-analytics" },
  { id: '2', text: "🩹 My knee hurts", icon: "bandage" },
  { id: '3', text: "📅 What's the plan?", icon: "calendar-clock" },
  { id: '4', text: "🔥 Am I overtraining?", icon: "fire" },
];

export default function AICoachScreen({ navigation }) {
  const { userData } = useUser();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // --- 1. INITIALIZE CONTEXT AWARENESS ---
  useEffect(() => {
    // Fade in intro
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();

    // Generate Contextual Greeting
    const lastRun = userData?.runHistory?.[0]; // Assuming index 0 is newest
    let greeting = "Hi there! I'm ready to help optimize your training.";

    if (lastRun) {
      greeting = `Welcome back! I analyzed your ${lastRun.distance}km run. Your pace was ${lastRun.pace}. How are your legs feeling today?`;
    } else {
      greeting = "Welcome to Ruvo! I'm your AI Coach. I'll build your plan once you log your first run. How can I help you get started?";
    }

    setMessages([
      { id: '0', text: greeting, sender: 'ai', timestamp: new Date() }
    ]);
  }, []);

  // --- 2. THE "BRAIN" (SIMULATED AI LOGIC) ---
  const simulateAIResponse = (userQuery) => {
    const lowerQuery = userQuery.toLowerCase();
    let responseText = "";

    // A. Injury Logic
    if (lowerQuery.includes('knee') || lowerQuery.includes('pain') || lowerQuery.includes('hurt')) {
      responseText = "I'm sorry to hear that. 🛑 Let's prioritize recovery. I recommend switching tomorrow's run to a low-impact activity like Swimming or Yoga. Would you like me to adjust your schedule?";
    } 
    // B. Schedule Logic (Uses your aiCoach.js)
    else if (lowerQuery.includes('plan') || lowerQuery.includes('schedule') || lowerQuery.includes('today')) {
      const todayWorkout = getTodayWorkout(userData);
      if (todayWorkout.isRest) {
        responseText = "Today is a programmed Rest Day. 🛌 Focus on sleep and hydration. Your body gets stronger while you rest, not just while you run.";
      } else {
        responseText = `Today's Plan: ${todayWorkout.title} (${todayWorkout.dist}). \n\n🎯 Goal: ${todayWorkout.desc}\n\nIntensity: ${todayWorkout.intensity}. You got this!`;
      }
    }
    // C. Analysis Logic
    else if (lowerQuery.includes('week') || lowerQuery.includes('analyze')) {
      const totalDist = userData?.runHistory?.reduce((acc, curr) => acc + (curr.distance || 0), 0) || 0;
      responseText = `You've covered ${totalDist.toFixed(1)}km total. Your consistency is looking good. Based on your RPE ratings, you are managing fatigue well. Keep holding steady.`;
    }
    // D. Overtraining
    else if (lowerQuery.includes('tired') || lowerQuery.includes('overtraining')) {
      responseText = "Your Heart Rate Variability (simulated) is slightly lower today. If you're feeling drained, do an 'Easy Run' at Zone 2 pace instead of intervals. Listen to your body.";
    }
    // E. Default
    else {
      responseText = "I'm focused on your running performance. Could you ask specifically about your training plan, recent runs, or recovery?";
    }

    return responseText;
  };

  const handleSend = (text = inputText) => {
    if (!text.trim()) return;

    // 1. Add User Message
    const userMsg = { id: Date.now().toString(), text: text, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    Keyboard.dismiss();

    // 2. Simulate Thinking
    setIsTyping(true);

    // 3. AI Reply Delay
    setTimeout(() => {
      const aiText = simulateAIResponse(text);
      const aiMsg = { id: (Date.now() + 1).toString(), text: aiText, sender: 'ai', timestamp: new Date() };
      
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500); // 1.5s delay for realism
  };

  const renderItem = ({ item }) => {
    const isAi = item.sender === 'ai';
    return (
      <View style={[styles.msgRow, isAi ? styles.msgRowLeft : styles.msgRowRight]}>
        {isAi && (
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="robot" size={16} color={COLORS.bg} />
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>RUVO COACH</Text>
          <Text style={styles.headerSubtitle}>
            {isTyping ? "Typing..." : "Online • Context Active"}
          </Text>
        </View>
        <TouchableOpacity style={styles.menuBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

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
          contentContainerStyle={{paddingHorizontal: 15}}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.promptChip} 
              onPress={() => handleSend(item.text)}
            >
              <MaterialCommunityIcons name={item.icon} size={14} color={COLORS.accent} />
              <Text style={styles.promptText}>{item.text}</Text>
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
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 20 },
  headerTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold', textAlign: 'center', letterSpacing: 1 },
  headerSubtitle: { color: COLORS.accent, fontSize: 10, fontFamily: 'Poppins_400Regular', textAlign: 'center' },
  menuBtn: { width: 40, alignItems: 'flex-end' },

  // Chat
  chatContainer: { paddingHorizontal: 16, paddingVertical: 20 },
  msgRow: { flexDirection: 'row', marginBottom: 20, maxWidth: '85%' },
  msgRowLeft: { alignSelf: 'flex-start' },
  msgRowRight: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginRight: 8, marginTop: 2 },
  
  bubble: { padding: 14, borderRadius: 18, maxWidth: '100%' },
  bubbleLeft: { backgroundColor: COLORS.aiBubble, borderTopLeftRadius: 4 },
  bubbleRight: { backgroundColor: COLORS.userBubble, borderBottomRightRadius: 4 },
  
  msgText: { fontSize: 15, lineHeight: 22, fontFamily: 'Poppins_400Regular' },
  textLeft: { color: '#EEE' },
  textRight: { color: '#000', fontFamily: 'Poppins_500Medium' },

  typingContainer: { flexDirection: 'row', marginBottom: 20, marginLeft: 0 },
  typingDots: { color: '#888', fontSize: 20, letterSpacing: 2 },

  // Prompts
  promptsList: { maxHeight: 50, marginBottom: 10, marginTop: 5 },
  promptChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#333' },
  promptText: { color: '#CCC', fontSize: 12, fontFamily: 'Poppins_500Medium', marginLeft: 6 },

  // Input
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#000' },
  input: { flex: 1, backgroundColor: '#1C1C1E', height: 50, borderRadius: 25, paddingHorizontal: 20, color: '#FFF', fontSize: 16, fontFamily: 'Poppins_400Regular' },
  sendBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
});
