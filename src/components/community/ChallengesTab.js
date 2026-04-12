import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/legacy-theme.js';

export default function ChallengesTab({
    challenges,
    toggleChallengeJoin,
    handleChallengePress,
    showChallengeModal,
    setShowChallengeModal,
    selectedChallenge,
    calculateChallengeProgress
}) {
    const insets = useSafeAreaInsets();
    const featured = challenges.find(c => c.type === 'Featured');
    const upcoming = challenges.filter(c => c.type !== 'Featured');

    const featuredProgress = featured ? calculateChallengeProgress(featured) : { percent: 0, current: 0, target: 100 };

    return (
        <View style={{ marginBottom: 20 }}>
            {featured && (
                <TouchableOpacity style={styles.challengeCardFeatured} activeOpacity={0.9} onPress={() => handleChallengePress(featured)}>
                    <Image source={{ uri: featured.image }} style={styles.challengeBg} resizeMode="cover" />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.95)']} style={styles.challengeOverlay}>
                        <View style={styles.featuredBadge}><Text style={styles.featuredBadgeText}>FEATURED</Text></View>
                        <Text style={styles.challengeTitleBig}>{featured.title}</Text>
                        <View style={styles.challengeMetaContainer}>
                            <View style={styles.metaRow}><Ionicons name="flag-outline" size={14} color={COLORS.accent} /><Text style={styles.challengeMetaText}>{featured.goal}</Text></View>
                            <View style={styles.metaRow}><Ionicons name="calendar-outline" size={14} color="#CCC" /><Text style={styles.challengeMetaText}>{featured.dates}</Text></View>
                            <View style={styles.metaRow}><Ionicons name="people-outline" size={14} color="#CCC" /><Text style={styles.challengeMetaText}>{featured.participants.toLocaleString()} Runners</Text></View>
                        </View>

                        {/* PROGRESS BAR FOR FEATURED */}
                        {featured.isJoined && (
                            <View style={{ marginTop: 10, marginBottom: 20 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <Text style={{ color: COLORS.accent, fontSize: 12, fontWeight: 'bold' }}>Progress</Text>
                                    <Text style={{ color: '#FFF', fontSize: 12 }}>{featuredProgress.current} / {featuredProgress.target}</Text>
                                </View>
                                <View style={{ height: 6, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden' }}>
                                    <View style={{ height: '100%', width: `${featuredProgress.percent * 100}%`, backgroundColor: COLORS.accent }} />
                                </View>
                            </View>
                        )}

                        {!featured.isJoined && (
                            <View style={[styles.rewardContainerGlass, { marginBottom: 20 }]}>
                                <Text style={styles.rewardLabel}>REWARD</Text>
                                <View style={styles.rewardRow}>
                                    <View style={styles.rewardItem}><Ionicons name="star" size={18} color="#FFD700" /><Text style={styles.rewardValue}>+{featured.xp.toLocaleString()}</Text><Text style={styles.rewardUnit}>XP</Text></View>
                                    <View style={styles.verticalDivider} />
                                    <View style={styles.rewardItem}><View style={styles.coinIcon}><Text style={styles.coinText}>C</Text></View><Text style={styles.rewardValue}>{featured.coins}</Text><Text style={styles.rewardUnit}>Coins</Text></View>
                                </View>
                            </View>
                        )}

                        <TouchableOpacity style={[styles.joinChallengeBtn, featured.isJoined && styles.joinedChallengeBtn, { borderRadius: 30 }]} onPress={() => toggleChallengeJoin(featured.id)} activeOpacity={0.8}><Text style={[styles.joinChallengeText, featured.isJoined && { color: COLORS.accent }]}>{featured.isJoined ? 'JOINED' : 'JOIN CHALLENGE'}</Text></TouchableOpacity>
                    </LinearGradient>
                </TouchableOpacity>
            )}

            <Text style={styles.sectionTitle}>Upcoming Challenges</Text>
            {upcoming.map(item => {
                const progress = item.isJoined ? calculateChallengeProgress(item) : null;
                return (
                    <TouchableOpacity key={item.id} style={styles.challengeItemEnhanced} activeOpacity={0.9} onPress={() => handleChallengePress(item)}>
                        <Image source={{ uri: item.image }} style={styles.challengeItemImage} />
                        <View style={styles.challengeItemContent}>
                            <Text style={styles.challengeItemTitle} numberOfLines={1}>{item.title}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}><Ionicons name="calendar-clear-outline" size={12} color="#888" /><Text style={styles.challengeItemDates}>{item.dates}</Text></View>

                            {item.isJoined ? (
                                <View style={{ marginTop: 6, width: 100 }}>
                                    <View style={{ height: 4, backgroundColor: '#333', borderRadius: 2 }}>
                                        <View style={{ height: '100%', width: `${progress.percent * 100}%`, backgroundColor: COLORS.accent }} />
                                    </View>
                                    <Text style={{ color: COLORS.accent, fontSize: 10, marginTop: 2 }}>{progress.current} {item.goal.includes('Elevation') ? 'm' : 'km'}</Text>
                                </View>
                            ) : (
                                <View style={styles.miniRewardTag}><Ionicons name="star" size={10} color="#FFD700" /><Text style={styles.miniRewardText}>+{item.xp} XP</Text></View>
                            )}
                        </View>
                        <TouchableOpacity style={[styles.smallJoinBtn, item.isJoined && { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.accent }]} onPress={() => toggleChallengeJoin(item.id)}><Text style={[styles.smallJoinText, item.isJoined && { color: COLORS.accent }]}>{item.isJoined ? 'Joined' : 'Join'}</Text></TouchableOpacity>
                    </TouchableOpacity>
                );
            })}

            {/* FULL SCREEN CHALLENGE DETAILS MODAL */}
            <Modal animationType="slide" transparent={true} visible={showChallengeModal} onRequestClose={() => setShowChallengeModal(false)}>
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    {selectedChallenge && (
                        <>
                            <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                                {/* HEADER IMAGE */}
                                <View style={{ height: 400, width: '100%' }}>
                                    <Image source={{ uri: selectedChallenge.image }} style={styles.challengeModalImage} resizeMode="cover" />
                                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)', '#000']} style={styles.challengeModalGradient} />

                                    <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowChallengeModal(false)}>
                                        <Ionicons name="close" size={24} color="#FFF" />
                                    </TouchableOpacity>

                                    {/* TOP LEFT TAG */}
                                    <View style={{ position: 'absolute', top: 50, left: 20, backgroundColor: COLORS.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, zIndex: 10 }}>
                                        <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 }}>{selectedChallenge.type === 'Featured' ? 'FEATURED' : 'CHALLENGE'}</Text>
                                    </View>

                                    <View style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
                                        <Text style={styles.modalChallengeTitle}>{selectedChallenge.title}</Text>
                                    </View>
                                </View>

                                <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
                                    {/* STATUS BAR */}
                                    {selectedChallenge.isJoined ? (
                                        <View style={styles.statusCard}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                                <Text style={{ color: COLORS.accent, fontWeight: 'bold' }}>ACTIVE</Text>
                                                <Text style={{ color: '#FFF' }}>{calculateChallengeProgress(selectedChallenge).current} / {calculateChallengeProgress(selectedChallenge).target} {selectedChallenge.goal.includes('Elevation') ? 'm' : 'km'}</Text>
                                            </View>
                                            <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: `${calculateChallengeProgress(selectedChallenge).percent * 100}%` }]} /></View>
                                            <Text style={{ color: '#888', fontSize: 11, marginTop: 5 }}>Keep pushing! You are doing great.</Text>
                                        </View>
                                    ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                                            <Ionicons name="time-outline" size={16} color="#888" />
                                            <Text style={{ color: '#BBB', marginLeft: 5, fontSize: 13 }}>Ends {selectedChallenge.dates.split('-')[1]}</Text>
                                            <View style={{ width: 1, height: 12, backgroundColor: '#333', marginHorizontal: 10 }} />
                                            <Ionicons name="people-outline" size={16} color="#888" />
                                            <Text style={{ color: '#BBB', marginLeft: 5, fontSize: 13 }}>{selectedChallenge.participants.toLocaleString()} Runners</Text>
                                        </View>
                                    )}

                                    <Text style={styles.detailSectionTitle}>About this Challenge</Text>
                                    <Text style={styles.modalChallengeDesc}>{selectedChallenge.description || selectedChallenge.goal}</Text>

                                    {/* GOAL CARD */}
                                    <View style={styles.infoCard}>
                                        <View style={styles.infoRow}>
                                            <View style={styles.iconBox}><MaterialCommunityIcons name="target" size={24} color={COLORS.accent} /></View>
                                            <View>
                                                <Text style={styles.infoLabel}>GOAL</Text>
                                                <Text style={styles.infoValue}>{selectedChallenge.goal}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* REWARDS CARD */}
                                    <Text style={styles.detailSectionTitle}>Rewards</Text>
                                    <View style={styles.rewardCardPremium}>
                                        <View style={styles.rewardCol}>
                                            <Ionicons name="star" size={28} color="#FFD700" />
                                            <Text style={styles.rewardValueLarge}>+{selectedChallenge.xp}</Text>
                                            <Text style={styles.rewardLabelSmall}>XP POINTS</Text>
                                        </View>
                                        <View style={styles.verticalDividerLarge} />
                                        <View style={styles.rewardCol}>
                                            <MaterialCommunityIcons name="bitcoin" size={28} color={COLORS.accent} />
                                            <Text style={[styles.rewardValueLarge, { color: COLORS.accent }]}>{selectedChallenge.coins}</Text>
                                            <Text style={styles.rewardLabelSmall}>COINS</Text>
                                        </View>
                                    </View>
                                </View>
                            </ScrollView>

                            {/* STICKY FOOTER */}
                            <View style={[styles.modalStickyFooter, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
                                <TouchableOpacity
                                    style={[styles.joinChallengeBtn, selectedChallenge.isJoined && styles.joinedChallengeBtn, { width: '100%', borderRadius: 15, paddingVertical: 16 }]}
                                    onPress={() => toggleChallengeJoin(selectedChallenge.id)}
                                >
                                    <Text style={[styles.joinChallengeText, selectedChallenge.isJoined && { color: COLORS.accent }]}>
                                        {selectedChallenge.isJoined ? 'LEAVE CHALLENGE' : 'JOIN CHALLENGE'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    sectionTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold', marginBottom: 15 },
    challengeCardFeatured: { borderRadius: 16, overflow: 'hidden', height: 420, marginBottom: 30, backgroundColor: '#1C1C1E' },
    challengeBg: { width: '100%', height: '100%', position: 'absolute' },
    challengeOverlay: { flex: 1, padding: 20, justifyContent: 'flex-end' },
    featuredBadge: { position: 'absolute', top: 20, left: 20, backgroundColor: COLORS.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
    featuredBadgeText: { color: '#000', fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },
    challengeTitleBig: { color: '#FFF', fontSize: 26, fontFamily: 'Poppins_700Bold', marginBottom: 10, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
    challengeMetaContainer: { marginBottom: 15 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    challengeMetaText: { color: '#EEE', fontSize: 14, fontFamily: 'Poppins_400Regular', marginLeft: 8 },
    rewardContainerGlass: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 15, backgroundColor: 'rgba(0,0,0,0.4)', marginBottom: 20 },
    rewardLabel: { color: '#AAA', fontSize: 10, fontFamily: 'Poppins_700Bold', marginBottom: 8, letterSpacing: 1 },
    rewardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
    rewardItem: { alignItems: 'center' },
    rewardValue: { color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold', marginTop: 4 },
    rewardUnit: { color: '#BBB', fontSize: 11, fontFamily: 'Poppins_400Regular' },
    verticalDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
    coinIcon: { width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center' },
    coinText: { color: '#000', fontSize: 10, fontWeight: 'bold' },
    joinChallengeBtn: { backgroundColor: COLORS.accent, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 30, alignItems: 'center' },
    joinedChallengeBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.accent, borderRadius: 30 },
    joinChallengeText: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: '#000', textTransform: 'uppercase' },
    challengeItemEnhanced: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 16, padding: 12, marginBottom: 15 },
    challengeItemImage: { width: 60, height: 60, borderRadius: 12, marginRight: 15 },
    challengeItemContent: { flex: 1, justifyContent: 'center' },
    challengeItemTitle: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
    challengeItemDates: { color: '#888', fontFamily: 'Poppins_400Regular', fontSize: 11, marginLeft: 5 },
    smallJoinBtn: { backgroundColor: COLORS.accent, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, alignSelf: 'center' },
    smallJoinText: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 11, textTransform: 'uppercase' },
    miniRewardTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginTop: 4 },
    miniRewardText: { color: '#FFD700', fontSize: 10, fontFamily: 'Poppins_700Bold', marginLeft: 4 },
    challengeModalImage: { width: '100%', height: '100%' },
    challengeModalGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 150 },
    modalCloseBtn: { position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    modalStickyFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#000', padding: 20, borderTopWidth: 1, borderTopColor: '#333' },
    statusCard: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
    progressBarBg: { height: 6, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: COLORS.accent },
    infoCard: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 15, marginBottom: 20, flexDirection: 'row', alignItems: 'center' },
    infoRow: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(204, 255, 0, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    infoLabel: { color: '#888', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
    infoValue: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    rewardCardPremium: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 16, padding: 20, justifyContent: 'space-around', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    rewardCol: { alignItems: 'center' },
    rewardValueLarge: { color: '#FFF', fontSize: 24, fontWeight: '800', marginTop: 5 },
    rewardLabelSmall: { color: '#666', fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginTop: 2 },
    verticalDividerLarge: { width: 1, height: 40, backgroundColor: '#333' },
    detailSectionTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold', marginBottom: 15, marginTop: 10 },
    modalChallengeTitle: { color: '#FFF', fontSize: 32, fontFamily: 'Poppins_800ExtraBold', lineHeight: 36, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
    modalChallengeDesc: { color: '#CCC', fontSize: 14, lineHeight: 22, marginBottom: 20, fontFamily: 'Poppins_400Regular' }
});
