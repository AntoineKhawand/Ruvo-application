import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, writeBatch } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { sanitizeInput } from '../utils/sanitize';

// Define colors locally to avoid dependency errors
const COLORS = {
    accent: "#CCFF00",
    primary: "#000000",
    secondary: "#1C1C1E",
    danger: "#FF3B30",
    text: "#FFFFFF"
};

export default function ChatScreen({ route, navigation }) {
    // Safety check for params
    const { userId } = route.params || {};

    const { userData, user: authUser, setUserData, sendMessage, blockUser, detectLocation } = useUser();
    const [inputText, setInputText] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const [messages, setMessages] = useState([]);
    const flatListRef = useRef();

    const currentUid = authUser?.uid || userData?.uid;
    const chatId = currentUid && userId ? [currentUid, userId].sort().join('_') : null;

    const [chatPartner, setChatPartner] = useState(null);

    // 1. Fetch Chat Partner Details
    useEffect(() => {
        const fetchPartner = async () => {
            if (!userId) return;
            try {
                const docRef = doc(db, "users", userId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setChatPartner(docSnap.data());
                } else {
                    setChatPartner({ name: 'Unknown User', avatar: null });
                }
            } catch (error) {
                console.error("Failed to fetch chat partner:", error);
                setChatPartner({ name: 'Unknown User', avatar: null });
            }
        };

        fetchPartner();
    }, [userId]);

    // Fallback if user isn't found yet
    const user = chatPartner || { name: 'Loading...', avatar: null };

    // 2. Real-time Chat Sync
    useEffect(() => {
        if (!chatId) return;

        const messagesRef = collection(db, "chats", chatId, "messages");
        const q = query(messagesRef, orderBy("timestamp", "asc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(fetchedMessages);
        });

        return () => unsubscribe();
    }, [chatId]);

    // Scroll to bottom on new message
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages]);

    const handleSend = () => {
        if (inputText.trim().length === 0) return;
        // Call Context Function
        sendMessage(userId, sanitizeInput(inputText));
        setInputText('');
    };

    const handleAttachment = () => {
        Alert.alert("Add Attachment", "Choose an option:", [
            {
                text: "Camera",
                onPress: async () => {
                    const { status } = await ImagePicker.requestCameraPermissionsAsync();
                    if (status !== 'granted') return Alert.alert("Permission Denied");
                    const result = await ImagePicker.launchCameraAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        allowsEditing: true, quality: 0.7,
                    });
                    if (!result.canceled && result.assets) {
                        sendMessage(userId, "Sent a photo", result.assets[0].uri);
                    }
                }
            },
            {
                text: "Gallery",
                onPress: async () => {
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== 'granted') return Alert.alert("Permission Denied");
                    const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        allowsEditing: true, quality: 0.7,
                    });
                    if (!result.canceled && result.assets) {
                        sendMessage(userId, "Sent a photo", result.assets[0].uri);
                    }
                }
            },
            {
                text: "Location", onPress: async () => {
                    const detectedAddress = await detectLocation();
                    if (detectedAddress) {
                        sendMessage(userId, `📍 My location: ${detectedAddress}`);
                    }
                }
            },
            { text: "Cancel", style: "cancel" }
        ]);
    };

    const handleMenuOption = (action) => {
        setShowMenu(false);
        if (action === 'Clear') {
            if (!chatId) return;
            Alert.alert("Clear Chat?", "This removes your messages. Continue?", [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear", style: 'destructive', onPress: async () => {
                        try {
                            const messagesRef = collection(db, "chats", chatId, "messages");
                            const snapshot = await getDocs(messagesRef);
                            const batch = writeBatch(db);
                            snapshot.docs.forEach((d) => batch.delete(d.ref));
                            await batch.commit();

                            // Update Local State directly for clearing legacy chats as fallback
                            setUserData(prev => {
                                if (!prev.chats || !prev.chats[userId]) return prev;
                                const newChats = { ...prev.chats };
                                delete newChats[userId];
                                return { ...prev, chats: newChats };
                            });
                        } catch (e) {
                            console.error("Clear chat error:", e);
                        }
                    }
                }
            ]);
        } else if (action === 'Block') {
            Alert.alert("Block User?", "You won't receive messages from them.", [
                { text: "Cancel", style: "cancel" },
                { text: "Block", style: 'destructive', onPress: () => { blockUser(userId); navigation.goBack(); } }
            ]);
        }
    };

    const renderMessage = ({ item }) => {
        const isMe = item.senderId === currentUid || item.senderId === 'currentUser';
        return (
            <View style={[styles.msgContainer, isMe ? styles.msgRight : styles.msgLeft]}>
                {!isMe && <Image source={user.avatar ? { uri: user.avatar } : require('../../assets/icon.png')} style={styles.msgAvatar} />}
                <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
                    {item.image && (
                        <Image source={{ uri: item.image }} style={{ width: 200, height: 150, borderRadius: 10, marginBottom: 5 }} resizeMode="cover" />
                    )}
                    <Text style={[styles.msgText, { color: isMe ? '#000' : '#FFF' }]}>{item.text}</Text>
                    <Text style={[styles.timeText, { color: isMe ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)' }]}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 10 }}>
                    <Image source={user.avatar ? { uri: user.avatar } : require('../../assets/icon.png')} style={styles.headerAvatar} />
                    <View style={{ marginLeft: 10 }}>
                        <Text style={styles.headerName}>{user.name}</Text>
                        <Text style={styles.headerStatus}>Online</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => setShowMenu(true)} style={{ padding: 5 }}>
                    <Ionicons name="ellipsis-vertical" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.listContent}
                style={{ flex: 1 }}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 50, opacity: 0.5 }}>
                        <Ionicons name="chatbubbles-outline" size={50} color="#666" />
                        <Text style={{ color: '#666', marginTop: 10 }}>No messages yet.</Text>
                        <Text style={{ color: '#444', fontSize: 12 }}>Say hello to start the conversation!</Text>
                    </View>
                }
            />

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={10}>
                <View style={styles.inputBar}>
                    <TouchableOpacity style={styles.iconBtn} onPress={handleAttachment}>
                        <Ionicons name="add" size={28} color={COLORS.accent} />
                    </TouchableOpacity>
                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type a message..."
                        placeholderTextColor="#666"
                    />
                    <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
                        <Ionicons name="send" size={20} color="#000" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
                    <View style={styles.menuSheet}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuOption('Clear')}>
                            <Ionicons name="trash-outline" size={20} color="#FFF" style={{ marginRight: 10 }} />
                            <Text style={styles.menuText}>Clear Chat</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuOption('Block')}>
                            <Ionicons name="ban-outline" size={20} color="#FF3B30" style={{ marginRight: 10 }} />
                            <Text style={[styles.menuText, { color: '#FF3B30' }]}>Block User</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
    headerAvatar: { width: 36, height: 36, borderRadius: 18 },
    headerName: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    headerStatus: { color: COLORS.accent, fontSize: 12, fontFamily: 'Poppins_400Regular' },
    listContent: { padding: 15, paddingBottom: 20 },
    msgContainer: { flexDirection: 'row', marginBottom: 15, alignItems: 'flex-end' },
    msgLeft: { alignSelf: 'flex-start' },
    msgRight: { alignSelf: 'flex-end' },
    msgAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
    bubble: { maxWidth: '75%', padding: 12, borderRadius: 20, paddingHorizontal: 16 },
    bubbleLeft: { backgroundColor: '#1C1C1E', borderBottomLeftRadius: 4 },
    bubbleRight: { backgroundColor: COLORS.accent, borderBottomRightRadius: 4 },
    msgText: { fontSize: 15, fontFamily: 'Poppins_400Regular' },
    timeText: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end', fontFamily: 'Poppins_400Regular' },
    inputBar: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#000' },
    input: { flex: 1, backgroundColor: '#1C1C1E', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, color: '#FFF', marginHorizontal: 10, fontSize: 15, fontFamily: 'Poppins_400Regular' },
    iconBtn: { padding: 5 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'flex-end', padding: 10, paddingTop: 60 },
    menuSheet: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 5, width: 180, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#2A2A2C' },
    menuText: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_500Medium' },
});