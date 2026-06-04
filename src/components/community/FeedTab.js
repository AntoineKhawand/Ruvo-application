import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback } from 'react';
import {
    Dimensions, FlatList, Image, KeyboardAvoidingView,
    Modal, Platform, StyleSheet, Text, TextInput,
    TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from '../Map';
import { COLORS } from '../../constants/legacy-theme.js';
import SkeletonCard from '../../components/SkeletonCard';
import UserAvatar from '../../components/UserAvatar';

const ACCENT = COLORS.accent;

const getRouteRegion = (routePath) => {
    if (!routePath || routePath.length === 0) return null;
    const lats = routePath.map(p => p.latitude);
    const lngs = routePath.map(p => p.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.005),
        longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.005),
    };
};

const DARK_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#1A1A1A' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1A1A1A' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
];

const { height } = Dimensions.get('window');

const BADGE_ICONS = {
    'Newcomer': 'star', '5K Club': 'medal', '10K Finisher': 'trophy',
    '20k Club': 'ribbon', 'Night Owl': 'moon', 'Early Bird': 'sunny', '7 Day Streak': 'flame',
};

const MAP_PLACEHOLDERS = [
    'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?q=80&w=1000&auto=format&fit=crop',
];

// ─────────────────────────────────────────────────────────────────
// FEED CARD
// ─────────────────────────────────────────────────────────────────
const FeedCard = ({ item, onOpenOptions, onOpenComments, navigation, commentCount, isLiked, onCheer }) => {
    const likeCount = item.likes || 0;

    const openProfile = () => {
        if (item.isCurrentUser) navigation.navigate('Profile');
        else navigation.navigate('UserProfile', { userId: item.userId || item.id });
    };

    return (
        <View style={styles.card}>

            {/* ── HEADER: avatar + name + time + menu ── */}
            <View style={styles.cardHeader}>
                <TouchableOpacity activeOpacity={0.85} onPress={openProfile} style={styles.avatarBtn}>
                    <UserAvatar uri={item.avatar} name={item.user} size={42} />
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                    <TouchableOpacity activeOpacity={0.85} onPress={openProfile}>
                        <View style={styles.nameRow}>
                            <Text style={styles.userName} numberOfLines={1}>{item.user}</Text>
                            {item.level > 0 && (
                                <View style={styles.levelBadge}>
                                    <Text style={styles.levelText}>Lvl {item.level}</Text>
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.timeText}>{item.time}</Text>
                </View>

                <TouchableOpacity activeOpacity={0.7} style={styles.moreBtn} onPress={() => onOpenOptions(item)}>
                    <Ionicons name="ellipsis-horizontal" size={20} color="#555" />
                </TouchableOpacity>
            </View>

            {/* ── TITLE ── */}
            <Text style={styles.activityTitle}>{item.title}</Text>

            {/* ── DESCRIPTION ── */}
            {item.description ? (
                <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
            ) : null}

            {/* ── TAGS ── */}
            {(item.gear || item.activityTag) && (
                <View style={styles.tagsRow}>
                    {item.activityTag && item.activityTag !== 'None' && (
                        <View style={styles.activityTagChip}>
                            <Text style={styles.activityTagText}>{item.activityTag}</Text>
                        </View>
                    )}
                    {item.gear && (
                        <View style={styles.gearChip}>
                            <MaterialCommunityIcons name="shoe-sneaker" size={12} color="#888" />
                            <Text style={styles.gearText}>{item.gear}</Text>
                        </View>
                    )}
                </View>
            )}

            {/* ── BADGE ── */}
            {item.badge && (
                <View style={styles.badgeRow}>
                    <Ionicons
                        name={BADGE_ICONS[typeof item.badge === 'string' ? item.badge : item.badge.name] || 'medal'}
                        size={14}
                        color="#000"
                        style={{ marginRight: 5 }}
                    />
                    <Text style={styles.badgeText}>
                        {typeof item.badge === 'string' ? item.badge : item.badge.name}
                    </Text>
                </View>
            )}

            {/* ── STATS ── */}
            <View style={styles.statsContainer}>
                <View style={styles.statCol}>
                    <Text style={styles.statValue}>{item.stats.km}</Text>
                    <Text style={styles.statLabel}>KM</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCol}>
                    <Text style={styles.statValue}>{item.stats.time}</Text>
                    <Text style={styles.statLabel}>TIME</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCol}>
                    <Text style={styles.statValue}>{item.stats.pace}</Text>
                    <Text style={styles.statLabel}>AVG PACE</Text>
                </View>
            </View>

            {/* ── MAP / ROUTE ── */}
            <View style={styles.mapContainer}>
                {item.hideMap ? (
                    <View style={styles.mapHidden}>
                        <Ionicons name="eye-off-outline" size={28} color="#444" />
                        <Text style={styles.mapHiddenText}>Map Hidden</Text>
                    </View>
                ) : item.isCustomPhoto && item.image ? (
                    <Image source={{ uri: item.image }} style={styles.mapImage} resizeMode="cover" />
                ) : item.routePath && item.routePath.length > 0 ? (
                    <View style={{ flex: 1 }}>
                        <MapView
                            style={StyleSheet.absoluteFill}
                            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                            customMapStyle={DARK_MAP_STYLE}
                            initialRegion={getRouteRegion(item.routePath)}
                            scrollEnabled={false}
                            zoomEnabled={false}
                            rotateEnabled={false}
                            pitchEnabled={false}
                            moveOnMarkerPress={false}
                            pointerEvents="none"
                        >
                            {item.routePath.length > 1 && (
                                <Polyline
                                    coordinates={item.routePath}
                                    strokeColor={ACCENT}
                                    strokeWidth={4}
                                    lineCap="round"
                                    lineJoin="round"
                                />
                            )}
                        </MapView>
                        <View style={styles.mapBadge}>
                            <Ionicons name="navigate" size={10} color={ACCENT} />
                            <Text style={styles.mapBadgeText}>ROUTE</Text>
                        </View>
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        <Image
                            source={{ uri: item.image || MAP_PLACEHOLDERS[2] }}
                            style={styles.mapImage}
                            resizeMode="cover"
                        />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.5)']}
                            style={StyleSheet.absoluteFill}
                            pointerEvents="none"
                        />
                        <View style={styles.mapBadge}>
                            <Ionicons name="map" size={10} color={ACCENT} />
                            <Text style={styles.mapBadgeText}>MAP</Text>
                        </View>
                    </View>
                )}
            </View>

            {/* ── ACTIONS ── */}
            <View style={styles.cardFooter}>
                <TouchableOpacity
                    activeOpacity={0.75}
                    style={[styles.actionBtn, isLiked && styles.actionBtnActive]}
                    onPress={() => onCheer(item)}
                >
                    <Ionicons
                        name={isLiked ? 'flame' : 'flame-outline'}
                        size={20}
                        color={isLiked ? '#FF5722' : '#666'}
                    />
                    <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>
                        {likeCount > 0 ? likeCount : 'Cheer'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={0.75}
                    style={styles.actionBtn}
                    onPress={() => onOpenComments(item)}
                >
                    <Ionicons name="chatbubble-outline" size={18} color="#666" />
                    <Text style={styles.actionText}>
                        {commentCount > 0 ? commentCount : 'Comment'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ─────────────────────────────────────────────────────────────────
// FEED TAB
// ─────────────────────────────────────────────────────────────────
export default function FeedTab({
    feedData, feedScope, setFeedScope, navigation,
    onOpenOptions, onOpenComments, onCheer,
    showComments, setShowComments, realComments,
    commentText, setCommentText, replyTo, setReplyTo, handleSendComment,
    showOptions, setShowOptions, selectedPost, handleOptionSelect,
    user, userData, isLoading,
}) {
    const insets = useSafeAreaInsets();
    const currentUid = user?.uid || userData?.uid;

    const renderFeedItem = useCallback(({ item }) => (
        <FeedCard
            item={item}
            navigation={navigation}
            onOpenOptions={onOpenOptions}
            onOpenComments={onOpenComments}
            commentCount={item.comments || 0}
            isLiked={item.likedBy?.includes(currentUid)}
            onCheer={onCheer}
        />
    ), [navigation, onOpenOptions, onOpenComments, currentUid, onCheer]);

    const renderCommentItem = useCallback(({ item }) => (
        <TouchableOpacity activeOpacity={0.8} style={styles.commentItem} onPress={() => setReplyTo(item.user)}>
            <UserAvatar uri={item.avatar} name={item.user} size={32} />
            <View style={styles.commentContent}>
                <View style={styles.commentMeta}>
                    <Text style={styles.commentUser}>{item.user}</Text>
                    <Text style={styles.commentTime}>{item.time}</Text>
                </View>
                <Text style={styles.commentText}>{item.text}</Text>
            </View>
        </TouchableOpacity>
    ), [setReplyTo]);

    return (
        <View style={{ flex: 1 }}>

            {/* ── SCOPE FILTER TABS ── */}
            <View style={styles.scopeRow}>
                {['Global', 'Following'].map(scope => {
                    const active = feedScope === scope;
                    return (
                        <TouchableOpacity
                            key={scope}
                            activeOpacity={0.75}
                            onPress={() => setFeedScope(scope)}
                            style={[styles.scopeChip, active && styles.scopeChipActive]}
                        >
                            <Ionicons
                                name={scope === 'Global' ? 'globe-outline' : 'people-outline'}
                                size={13}
                                color={active ? '#000' : '#666'}
                                style={{ marginRight: 5 }}
                            />
                            <Text style={[styles.scopeText, active && styles.scopeTextActive]}>
                                {scope}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── FEED CONTENT ── */}
            {isLoading ? (
                <View style={{ paddingBottom: 100 }}>
                    <SkeletonCard variant="post" count={3} />
                </View>
            ) : feedData.length === 0 && feedScope === 'Following' ? (
                <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={44} color="#2A2A2A" />
                    <Text style={styles.emptyTitle}>No runs from people you follow</Text>
                    <Text style={styles.emptySubtitle}>Follow runners to see their activity here</Text>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.emptyAction}
                        onPress={() => setFeedScope('Global')}
                    >
                        <Text style={styles.emptyActionText}>Browse Global Feed</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={feedData}
                    keyExtractor={item => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    initialNumToRender={4}
                    maxToRenderPerBatch={4}
                    windowSize={5}
                    removeClippedSubviews={false}
                    updateCellsBatchingPeriod={50}
                    renderItem={renderFeedItem}
                />
            )}

            {/* ── COMMENTS MODAL ── */}
            <Modal
                animationType="slide"
                transparent
                visible={showComments}
                onRequestClose={() => setShowComments(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowComments(false)} />
                    <View style={[styles.commentsSheet, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Comments</Text>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => setShowComments(false)}>
                                <Ionicons name="close" size={22} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={realComments}
                            keyExtractor={item => item.id}
                            renderItem={renderCommentItem}
                            ListEmptyComponent={
                                <View style={styles.emptyComments}>
                                    <Ionicons name="chatbubbles-outline" size={32} color="#333" />
                                    <Text style={styles.emptyCommentsText}>No comments yet. Be the first!</Text>
                                </View>
                            }
                        />
                        {replyTo && (
                            <View style={styles.replyBar}>
                                <Text style={styles.replyText}>
                                    Replying to <Text style={{ color: ACCENT }}>{replyTo}</Text>
                                </Text>
                                <TouchableOpacity activeOpacity={0.7} onPress={() => setReplyTo(null)}>
                                    <Ionicons name="close-circle" size={16} color="#666" />
                                </TouchableOpacity>
                            </View>
                        )}
                        <View style={styles.commentInputRow}>
                            <TextInput
                                style={styles.commentInput}
                                placeholder="Add a comment…"
                                placeholderTextColor="#555"
                                value={commentText}
                                onChangeText={setCommentText}
                                textContentType="none"
                                autoComplete="off"
                                importantForAutofill="no"
                            />
                            <TouchableOpacity
                                activeOpacity={0.75}
                                onPress={handleSendComment}
                                style={[styles.sendBtn, { opacity: commentText ? 1 : 0.35 }]}
                                disabled={!commentText}
                            >
                                <Ionicons name="send" size={18} color="#000" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── OPTIONS MODAL ── */}
            <Modal
                animationType="fade"
                transparent
                visible={showOptions}
                onRequestClose={() => setShowOptions(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowOptions(false)} />
                    <View style={[styles.optionsSheet, { paddingBottom: Math.max(40, insets.bottom + 20) }]}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.optionsTitle}>Options</Text>
                        {[
                            { icon: 'share-social-outline', label: 'Share Activity', action: 'Share', color: '#FFF' },
                            { icon: 'volume-mute-outline', label: `Mute ${selectedPost?.user || 'User'}`, action: 'Mute', color: '#FFF' },
                            { icon: 'flag-outline', label: 'Report Activity', action: 'Report', color: '#FF3B30' },
                        ].map(opt => (
                            <TouchableOpacity
                                key={opt.action}
                                activeOpacity={0.75}
                                style={styles.optionItem}
                                onPress={() => handleOptionSelect(opt.action)}
                            >
                                <View style={[styles.optionIconBox, opt.color === '#FF3B30' && styles.optionIconBoxDanger]}>
                                    <Ionicons name={opt.icon} size={20} color={opt.color} />
                                </View>
                                <Text style={[styles.optionText, { color: opt.color }]}>{opt.label}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity activeOpacity={0.75} style={styles.cancelButton} onPress={() => setShowOptions(false)}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

    // ── Scope filter ──
    scopeRow: { flexDirection: 'row', marginBottom: 18, gap: 10 },
    scopeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        backgroundColor: '#0E0E0E',
    },
    scopeChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
    scopeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#666' },
    scopeTextActive: { color: '#000' },

    // ── Card ──
    card: {
        backgroundColor: '#0E0E0E',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#1E1E1E',
    },

    // ── Card header ──
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    avatarBtn: { marginRight: 12 },   // ← the space between avatar and name
    nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    userName: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
    levelBadge: {
        backgroundColor: 'rgba(204,255,0,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(204,255,0,0.22)',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8,
    },
    levelText: { color: ACCENT, fontSize: 10, fontFamily: 'Poppins_700Bold' },
    timeText: { color: '#555', fontFamily: 'Poppins_400Regular', fontSize: 11, marginTop: 3 },
    moreBtn: { marginLeft: 'auto', padding: 6 },

    // ── Body ──
    activityTitle: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 15, marginBottom: 6, lineHeight: 22 },
    description: { color: '#888', fontFamily: 'Poppins_400Regular', fontSize: 13, marginBottom: 10, lineHeight: 20 },

    // ── Tags ──
    tagsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
    activityTagChip: { backgroundColor: '#1A1A1A', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#2A2A2A' },
    activityTagText: { color: '#AAA', fontSize: 10, fontFamily: 'Poppins_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.4 },
    gearChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    gearText: { color: '#666', fontSize: 11, fontFamily: 'Poppins_400Regular' },

    // ── Badge ──
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: ACCENT,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    badgeText: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 11 },

    // ── Stats ──
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: '#141414',
        borderRadius: 14,
        paddingVertical: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#1E1E1E',
    },
    statCol: { flex: 1, alignItems: 'center' },
    statDivider: { width: 1, backgroundColor: '#2A2A2A', marginVertical: 4 },
    statValue: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 17, lineHeight: 22 },
    statLabel: { color: '#555', fontFamily: 'Poppins_600SemiBold', fontSize: 9, letterSpacing: 0.8, marginTop: 2 },

    // ── Map ──
    mapContainer: { height: 190, borderRadius: 14, overflow: 'hidden', marginBottom: 14, backgroundColor: '#1A1A1A' },
    mapImage: { width: '100%', height: '100%' },
    mapHidden: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
    mapHiddenText: { color: '#444', fontFamily: 'Poppins_500Medium', fontSize: 13 },
    mapBadge: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0,0,0,0.72)',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(204,255,0,0.25)',
    },
    mapBadgeText: { color: ACCENT, fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 0.5 },

    // ── Footer actions ──
    cardFooter: { flexDirection: 'row', alignItems: 'center', paddingTop: 4 },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: '#141414',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#222',
    },
    actionBtnActive: { backgroundColor: 'rgba(255,87,34,0.1)', borderColor: 'rgba(255,87,34,0.25)' },
    actionText: { color: '#666', fontFamily: 'Poppins_600SemiBold', fontSize: 12 },
    actionTextActive: { color: '#FF5722' },

    // ── Empty state ──
    emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
    emptyTitle: { color: '#555', fontFamily: 'Poppins_600SemiBold', fontSize: 15, marginTop: 14, textAlign: 'center' },
    emptySubtitle: { color: '#333', fontFamily: 'Poppins_400Regular', fontSize: 13, marginTop: 6, textAlign: 'center' },
    emptyAction: {
        marginTop: 20,
        backgroundColor: '#1A1A1A',
        paddingHorizontal: 22,
        paddingVertical: 11,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    emptyActionText: { color: ACCENT, fontFamily: 'Poppins_600SemiBold', fontSize: 13 },

    // ── Modals shared ──
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalBackdrop: { flex: 1 },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#333', alignSelf: 'center', marginBottom: 16 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
    sheetTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },

    // ── Comments sheet ──
    commentsSheet: {
        backgroundColor: '#0E0E0E',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        height: height * 0.8,
        padding: 20,
        borderTopWidth: 1,
        borderColor: '#1E1E1E',
    },
    commentItem: { flexDirection: 'row', marginBottom: 18 },
    commentContent: { flex: 1, marginLeft: 12 },
    commentMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    commentUser: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
    commentTime: { color: '#444', fontSize: 11, fontFamily: 'Poppins_400Regular' },
    commentText: { color: '#CCC', fontSize: 13, fontFamily: 'Poppins_400Regular', lineHeight: 20 },
    emptyComments: { alignItems: 'center', paddingTop: 40, gap: 10 },
    emptyCommentsText: { color: '#444', fontFamily: 'Poppins_500Medium', fontSize: 14 },
    replyBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#141414',
        padding: 10,
        borderRadius: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#222',
    },
    replyText: { color: '#888', fontSize: 12, fontFamily: 'Poppins_400Regular' },
    commentInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#1E1E1E',
        paddingTop: 14,
        marginTop: 8,
        gap: 10,
    },
    commentInput: {
        flex: 1,
        color: '#FFF',
        backgroundColor: '#141414',
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 11,
        fontFamily: 'Poppins_400Regular',
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: ACCENT,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── Options sheet ──
    optionsSheet: {
        backgroundColor: '#0E0E0E',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
        borderTopWidth: 1,
        borderColor: '#1E1E1E',
    },
    optionsTitle: { color: '#555', fontFamily: 'Poppins_600SemiBold', fontSize: 12, textAlign: 'center', marginBottom: 18, letterSpacing: 0.5, textTransform: 'uppercase' },
    optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
    optionIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A' },
    optionIconBoxDanger: { backgroundColor: 'rgba(255,59,48,0.1)', borderColor: 'rgba(255,59,48,0.2)' },
    optionText: { color: '#FFF', fontFamily: 'Poppins_500Medium', fontSize: 15 },
    cancelButton: { marginTop: 8, paddingVertical: 15, alignItems: 'center', backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#222' },
    cancelText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 15 },
});
