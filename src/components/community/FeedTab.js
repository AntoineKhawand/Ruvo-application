import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Dimensions, FlatList, Image, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from '../Map';
import { COLORS } from '../../constants/legacy-theme.js';
import SkeletonCard from '../../components/SkeletonCard';

// Compute a bounding region from GPS coordinates
const getRouteRegion = (routePath) => {
    if (!routePath || routePath.length === 0) return null;
    const lats = routePath.map(p => p.latitude);
    const lngs = routePath.map(p => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latDelta = Math.max((maxLat - minLat) * 1.6, 0.005);
    const lngDelta = Math.max((maxLng - minLng) * 1.6, 0.005);
    return { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2, latitudeDelta: latDelta, longitudeDelta: lngDelta };
};

const DARK_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#212121' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
];

const { height } = Dimensions.get('window');

const BADGE_ICONS = {
    'Newcomer': 'star', '5K Club': 'medal', '10K Finisher': 'trophy', '20k Club': 'ribbon', 'Night Owl': 'moon', 'Early Bird': 'sunny', '7 Day Streak': 'flame',
};

const MAP_PLACEHOLDERS = [
    'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?q=80&w=1000&auto=format&fit=crop',
];

const FeedCard = ({ item, onOpenOptions, onOpenComments, navigation, commentCount, isLiked, onCheer }) => {
    const likeCount = item.likes || 0;

    const openProfile = () => {
        if (item.isCurrentUser) navigation.navigate('Profile');
        else navigation.navigate('UserProfile', { userId: item.userId || item.id });
    };

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <TouchableOpacity onPress={openProfile}>
                    <Image source={item.avatar ? { uri: item.avatar } : require('../../../assets/icon.png')} style={styles.avatar} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <TouchableOpacity onPress={openProfile}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.userName}>{item.user}</Text>
                            {item.level && <View style={styles.levelBadge}><Text style={styles.levelText}>Lvl {item.level}</Text></View>}
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.timeText}>{item.time}</Text>
                </View>
                <TouchableOpacity style={styles.moreBtn} onPress={() => onOpenOptions(item)}>
                    <Ionicons name="ellipsis-horizontal" size={20} color="#888" />
                </TouchableOpacity>
            </View>
            <Text style={styles.activityTitle}>{item.title}</Text>
            {item.description ? (
                <Text style={{ color: '#CCC', fontFamily: 'Poppins_400Regular', fontSize: 13, marginBottom: 10 }} numberOfLines={2}>{item.description}</Text>
            ) : null}
            {(item.gear || item.activityTag) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    {item.activityTag && item.activityTag !== 'None' && (
                        <View style={{ backgroundColor: '#333', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginRight: 10 }}>
                            <Text style={{ color: '#BBB', fontSize: 10, fontFamily: 'Poppins_600SemiBold', textTransform: 'uppercase' }}>{item.activityTag}</Text>
                        </View>
                    )}
                    {item.gear && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="shoe-sneaker" size={14} color="#666" />
                            <Text style={{ color: '#888', fontSize: 11, marginLeft: 4, fontFamily: 'Poppins_400Regular' }}>{item.gear}</Text>
                        </View>
                    )}
                </View>
            )}
            {item.badge && (
                <View style={styles.badgeRow}>
                    <Ionicons name={BADGE_ICONS[typeof item.badge === 'string' ? item.badge : item.badge.name] || 'medal'} size={16} color="#000" style={{ marginRight: 6 }} />
                    <Text style={styles.badgeText}>{typeof item.badge === 'string' ? item.badge : item.badge.name}</Text>
                </View>
            )}
            <View style={styles.statsContainer}>
                <View style={styles.statCol}><Text style={styles.statValue}>{item.stats.km}</Text><Text style={styles.statLabel}>km</Text></View>
                <View style={styles.statCol}><Text style={styles.statValue}>{item.stats.time}</Text><Text style={styles.statLabel}>time</Text></View>
                <View style={styles.statCol}><Text style={styles.statValue}>{item.stats.pace}</Text><Text style={styles.statLabel}>avg pace</Text></View>
            </View>
            <View style={styles.mapContainer}>
                {item.hideMap ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#222' }}>
                        <Ionicons name="eye-off-outline" size={32} color="#555" />
                        <Text style={{ color: '#666', marginTop: 8, fontFamily: 'Poppins_500Medium' }}>Map Hidden by User</Text>
                    </View>
                ) : item.isCustomPhoto && item.image ? (
                    <Image source={{ uri: item.image }} style={styles.mapImage} resizeMode="cover" />
                ) : item.routePath && item.routePath.length > 1 ? (
                    <View style={{ flex: 1 }}>
                        <View style={StyleSheet.absoluteFill} pointerEvents="none">
                            <MapView
                                style={StyleSheet.absoluteFill}
                                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                                customMapStyle={DARK_MAP_STYLE}
                                initialRegion={getRouteRegion(item.routePath)}
                                scrollEnabled={false}
                                zoomEnabled={false}
                                rotateEnabled={false}
                                pitchEnabled={false}
                                liteMode={true}
                                moveOnMarkerPress={false}
                            >
                                <Polyline
                                    coordinates={item.routePath}
                                    strokeColor={COLORS.accent}
                                    strokeWidth={4}
                                    lineCap="round"
                                    lineJoin="round"
                                />
                            </MapView>
                        </View>
                        <View style={styles.mapOverlayIcon}>
                            <Ionicons name="navigate" size={12} color="#FFF" />
                            <Text style={{ color: '#FFF', fontSize: 10, marginLeft: 4, fontWeight: 'bold' }}>ROUTE</Text>
                        </View>
                    </View>
                ) : (
                    <View>
                        <Image source={{ uri: item.image || MAP_PLACEHOLDERS[2] }} style={styles.mapImage} resizeMode="cover" />
                        <View style={styles.mapOverlayIcon}>
                            <Ionicons name="map" size={12} color="#FFF" />
                            <Text style={{ color: '#FFF', fontSize: 10, marginLeft: 4, fontWeight: 'bold' }}>MAP</Text>
                        </View>
                    </View>
                )}
            </View>
            <View style={styles.cardFooter}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => onCheer(item)}>
                    <Ionicons name={isLiked ? "flame" : "flame-outline"} size={22} color={isLiked ? "#FF5722" : "#888"} />
                    <Text style={[styles.actionText, isLiked && { color: "#FF5722" }]}>
                        {likeCount > 0 ? likeCount : 'Cheer'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => onOpenComments(item)}>
                    <Ionicons name="chatbubble-outline" size={20} color="#888" />
                    <Text style={styles.actionText}>{commentCount > 0 ? commentCount : 'Comment'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default function FeedTab({
    feedData,
    feedScope,
    setFeedScope,
    navigation,
    onOpenOptions,
    onOpenComments,
    onCheer,
    showComments, setShowComments, realComments, commentText, setCommentText, replyTo, setReplyTo, handleSendComment,
    showOptions, setShowOptions, selectedPost, handleOptionSelect,
    user,
    userData,
    isLoading,
}) {
    const insets = useSafeAreaInsets();
    const currentUid = user?.uid || userData?.uid;
    return (
        <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', marginBottom: 20, marginTop: 0 }}>
                <TouchableOpacity
                    onPress={() => setFeedScope('Global')}
                    style={[styles.filterBtn, feedScope === 'Global' ? styles.filterBtnActive : styles.filterBtnInactive]}
                >
                    <Text style={[styles.filterText, feedScope === 'Global' ? styles.filterTextActive : styles.filterTextInactive]}>Global</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setFeedScope('Following')}
                    style={[styles.filterBtn, feedScope === 'Following' ? styles.filterBtnActive : styles.filterBtnInactive]}
                >
                    <Text style={[styles.filterText, feedScope === 'Following' ? styles.filterTextActive : styles.filterTextInactive]}>Following</Text>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View style={{ paddingBottom: 100 }}>
                    <SkeletonCard variant="post" count={3} />
                </View>
            ) : feedData.length === 0 && feedScope === 'Following' ? (
                <View style={{ alignItems: 'center', marginTop: 50 }}>
                    <Ionicons name="people-outline" size={40} color="#333" />
                    <Text style={{ color: '#666', marginTop: 10 }}>Follow people to see their runs here!</Text>
                    <TouchableOpacity
                        style={{ marginTop: 15, backgroundColor: '#333', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
                        onPress={() => setFeedScope('Global')}
                    >
                        <Text style={{ color: COLORS.accent, fontWeight: 'bold' }}>Find People</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={feedData}
                    keyExtractor={item => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    initialNumToRender={4} // ✅ Stop initial 100-post memory spike
                    maxToRenderPerBatch={4}
                    windowSize={5} // ✅ Drop off-screen posts strictly to preserve RAM
                    removeClippedSubviews={false}
                    updateCellsBatchingPeriod={50}
                    renderItem={({ item }) => (
                        <FeedCard
                            item={item}
                            navigation={navigation}
                            onOpenOptions={onOpenOptions}
                            onOpenComments={onOpenComments}
                            commentCount={item.comments || 0}
                            isLiked={item.likedBy?.includes(currentUid)}
                            onCheer={onCheer}
                        />
                    )}
                />
            )}

            {/* Comments Modal */}
            <Modal animationType="slide" transparent={true} visible={showComments} onRequestClose={() => setShowComments(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowComments(false)} />
                    <View style={[styles.commentsSheet, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
                        <View style={styles.notifHeader}>
                            <Text style={styles.notifHeaderTitle}>Comments</Text>
                            <TouchableOpacity onPress={() => setShowComments(false)}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={realComments}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.commentItem} onPress={() => setReplyTo(item.user)}>
                                    <Image source={item.avatar ? { uri: item.avatar } : require('../../../assets/icon.png')} style={styles.commentAvatar} />
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={styles.commentUser}>{item.user}</Text>
                                            <Text style={styles.commentTime}>{item.time}</Text>
                                        </View>
                                        <Text style={styles.commentText}>{item.text}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>No comments yet.</Text>}
                        />
                        {replyTo && (
                            <View style={styles.replyBar}>
                                <Text style={styles.replyText}>Replying to <Text style={{ fontWeight: 'bold' }}>{replyTo}</Text></Text>
                                <TouchableOpacity onPress={() => setReplyTo(null)}>
                                    <Ionicons name="close-circle" size={16} color="#888" />
                                </TouchableOpacity>
                            </View>
                        )}
                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.commentInput}
                                placeholder="Add a comment..."
                                placeholderTextColor="#666"
                                value={commentText}
                                onChangeText={setCommentText}
                                textContentType="none" autoComplete="off" importantForAutofill="no"
                            />
                            <TouchableOpacity onPress={handleSendComment}>
                                <Text style={[styles.sendText, { color: commentText ? COLORS.accent : '#444' }]}>Post</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Options Modal */}
            <Modal animationType="fade" transparent={true} visible={showOptions} onRequestClose={() => setShowOptions(false)}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowOptions(false)} />
                    <View style={[styles.optionsSheet, { paddingBottom: Math.max(40, insets.bottom + 20) }]}>
                        <View style={styles.optionsHeader}>
                            <Text style={styles.optionsTitle}>Options</Text>
                        </View>
                        <TouchableOpacity style={styles.optionItem} onPress={() => handleOptionSelect('Share')}>
                            <Ionicons name="share-social-outline" size={24} color="#FFF" />
                            <Text style={styles.optionText}>Share Activity</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.optionItem} onPress={() => handleOptionSelect('Mute')}>
                            <Ionicons name="volume-mute-outline" size={24} color="#FFF" />
                            <Text style={styles.optionText}>Mute {selectedPost?.user}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.optionItem} onPress={() => handleOptionSelect('Report')}>
                            <Ionicons name="flag-outline" size={24} color="#FF3B30" />
                            <Text style={[styles.optionText, { color: '#FF3B30' }]}>Report Activity</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelButton} onPress={() => setShowOptions(false)}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    filterBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, marginRight: 10, borderWidth: 1 },
    filterBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
    filterBtnInactive: { backgroundColor: '#333', borderColor: '#333' },
    filterText: { fontFamily: 'Poppins_700Bold', fontSize: 12 },
    filterTextActive: { color: '#000' },
    filterTextInactive: { color: '#AAA' },
    card: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 15, marginBottom: 20 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
    userName: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 14, marginRight: 8 },
    levelBadge: { backgroundColor: '#333', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    levelText: { color: COLORS.accent, fontSize: 10, fontFamily: 'Poppins_700Bold' },
    timeText: { color: '#888', fontFamily: 'Poppins_400Regular', fontSize: 12, marginTop: 2 },
    moreBtn: { marginLeft: 'auto', padding: 5 },
    activityTitle: { color: '#FFF', fontFamily: 'Poppins_500Medium', fontSize: 15, marginBottom: 8 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 12 },
    badgeText: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 11 },
    statsContainer: { flexDirection: 'row', backgroundColor: '#2C2C2E', borderRadius: 12, paddingVertical: 12, marginBottom: 15 },
    statCol: { flex: 1, alignItems: 'center' },
    statValue: { color: COLORS.accent, fontFamily: 'Poppins_700Bold', fontSize: 18 }, statLabel: { color: '#888', fontFamily: 'Poppins_400Regular', fontSize: 11 },
    mapContainer: { height: 180, borderRadius: 12, overflow: 'hidden', marginBottom: 15, backgroundColor: '#333' },
    mapImage: { width: '100%', height: '100%' },
    mapOverlayIcon: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
    cardFooter: { flexDirection: 'row', alignItems: 'center' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
    actionText: { color: '#888', fontFamily: 'Poppins_500Medium', fontSize: 13, marginLeft: 6 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalBackdrop: { flex: 1 },
    commentsSheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: height * 0.8, padding: 20 },
    notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    notifHeaderTitle: { color: '#FFF', fontSize: 22, fontFamily: 'Poppins_700Bold' },
    optionsSheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
    optionsHeader: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 15 },
    optionsTitle: { color: '#888', fontFamily: 'Poppins_600SemiBold', fontSize: 14, textAlign: 'center' },
    optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
    optionText: { color: '#FFF', fontFamily: 'Poppins_500Medium', fontSize: 16, marginLeft: 15 },
    cancelButton: { marginTop: 10, paddingVertical: 15, alignItems: 'center', backgroundColor: '#2C2C2E', borderRadius: 12 },
    cancelText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 16 },
    commentItem: { flexDirection: 'row', marginBottom: 20 },
    commentAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
    commentUser: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
    commentTime: { color: '#666', fontSize: 11 },
    commentText: { color: '#DDD', fontSize: 14, marginTop: 2 },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 15, marginTop: 10 },
    commentInput: { flex: 1, color: '#FFF', backgroundColor: '#2C2C2E', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, marginRight: 10 },
    sendText: { fontFamily: 'Poppins_700Bold', fontSize: 16 },
    replyBar: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#333', padding: 8, borderRadius: 8, marginBottom: 10 },
    replyText: { color: '#CCC', fontSize: 12 }
});
