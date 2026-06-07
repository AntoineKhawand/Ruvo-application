import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert, Animated, Dimensions, FlatList, Keyboard, KeyboardAvoidingView,
    Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput,
    TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import SkeletonCard from '../components/SkeletonCard';
import { useUser } from '../context/UserContext';
import useStaggerAnimation from '../hooks/useStaggerAnimation';
import { detectShoeDistance } from '../utils/helpers';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const ACCENT = '#CCFF00';
const COLORS = {
    accent: ACCENT,
    primary: '#000000',
    secondary: '#1C1C1E',
    danger: '#FF3B30',
    warning: '#FFCC00',
};

const POPULAR_SHOES = [
    'Nike Air Zoom Pegasus 40', 'Nike Vaporfly 3', 'Nike Alphafly 3', 'Nike Invincible 3', 'Nike Vomero 17',
    'Hoka Clifton 9', 'Hoka Bondi 8', 'Hoka Speedgoat 5', 'Hoka Mach 6',
    'Saucony Endorphin Speed 4', 'Saucony Ride 17', 'Brooks Ghost 15',
    'Asics Novablast 4', 'Asics Gel-Kayano 30', 'Adidas Boston 12',
    'New Balance 1080v13', 'On Cloudmonster 2', 'Reebok Floatride Energy 5',
];

// ── Circular progress ring around the shoe icon ──────────────────────────────
const RingIcon = ({ progress, isDefault, isRetired, size = 56 }) => {
    const strokeWidth = 3.5;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - Math.min(progress, 1) * circumference;
    const ringColor = isRetired ? COLORS.danger : progress > 0.8 ? COLORS.warning : ACCENT;

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth} fill="transparent" />
                <Circle
                    cx={size / 2} cy={size / 2} r={radius}
                    stroke={ringColor} strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                />
            </Svg>
            <View style={[
                styles.iconBox,
                isDefault && styles.activeIconBox,
                isRetired && { backgroundColor: '#1A1A1A' },
            ]}>
                <MaterialCommunityIcons
                    name={isRetired ? 'alert-circle' : 'shoe-sneaker'}
                    size={22}
                    color={isDefault ? '#000' : isRetired ? COLORS.danger : '#FFF'}
                />
            </View>
        </View>
    );
};

// ── Gradient progress bar ─────────────────────────────────────────────────────
const GradientBar = ({ progress, color }) => (
    <View style={styles.progressTrack}>
        <LinearGradient
            colors={progress > 0.8 ? ['#FFCC00', '#FF3B30'] : [ACCENT, '#80FF00']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]}
        />
    </View>
);

export default function GearScreen({ navigation }) {
    const { userData, isLoading, addGear, selectDefaultGear, deleteGear, updateGear } = useUser();

    const [modalVisible, setModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [newShoeName, setNewShoeName] = useState('');
    const [newShoeLimit, setNewShoeLimit] = useState('800');
    const [currentDistanceInput, setCurrentDistanceInput] = useState('0');
    const [autoDetected, setAutoDetected] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [filteredShoes, setFilteredShoes] = useState(POPULAR_SHOES);

    const [displayList, setDisplayList] = useState([]);

    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    const openSheet = () => {
        setModalVisible(true);
        Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 180,
        }).start();
    };

    const closeSheet = () => {
        Animated.timing(slideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 260,
            useNativeDriver: true,
        }).start(() => setModalVisible(false));
    };

    useEffect(() => {
        if (userData?.gearList) {
            const sorted = [...userData.gearList].sort((a, b) => (a.distance >= a.limit ? 1 : -1));
            setDisplayList(sorted);
            userData.gearList.forEach(shoe => {
                if (shoe.distance >= shoe.limit && !shoe.alertShown) {
                    Alert.alert(
                        '🚨 Equipment Warning',
                        `Your ${shoe.name} has reached its mileage limit (${shoe.limit}km). Consider retiring them.`,
                        [{ text: 'I Understand', style: 'destructive' }]
                    );
                }
            });
        }
    }, [userData?.gearList]);

    useEffect(() => {
        if (!isEditing && newShoeName.length > 0) {
            setFilteredShoes(POPULAR_SHOES.filter(s => s.toLowerCase().includes(newShoeName.toLowerCase())));
        } else {
            setFilteredShoes(POPULAR_SHOES);
        }
        if (!isEditing) {
            const detected = detectShoeDistance(newShoeName);
            if (detected) { setNewShoeLimit(detected.toString()); setAutoDetected(true); }
            else { setAutoDetected(false); }
        }
    }, [newShoeName]);

    const handleSelectShoe = useCallback((name) => {
        setNewShoeName(name);
        setShowDropdown(false);
        Keyboard.dismiss();
    }, []);

    const openAddModal = () => {
        setIsEditing(false);
        setNewShoeName('');
        setNewShoeLimit('800');
        setCurrentDistanceInput('0');
        openSheet();
    };

    const openEditModal = (shoe) => {
        setIsEditing(true);
        setEditingId(shoe.id);
        setNewShoeName(shoe.name);
        setNewShoeLimit(shoe.limit.toString());
        setCurrentDistanceInput(parseFloat(shoe.distance.toFixed(2)).toString());
        openSheet();
    };

    const handleSave = async () => {
        if (!newShoeName.trim()) return;
        try {
            if (isEditing) {
                await updateGear?.(editingId, {
                    name: newShoeName,
                    limit: parseFloat(newShoeLimit),
                    distance: parseFloat(currentDistanceInput),
                });
            } else {
                await addGear(newShoeName, newShoeLimit);
            }
            closeSheet();
            setNewShoeName('');
            setNewShoeLimit('800');
            setAutoDetected(false);
        } catch {
            Alert.alert('Error Saving Gear', 'Could not save your equipment changes. Please check your connection and try again.');
        }
    };

    // ── Summary numbers for the hero strip ──────────────────────────────────
    const totalKm = displayList.reduce((a, c) => a + c.distance, 0).toFixed(0);
    const activeName = displayList.find(s => s.isDefault)?.name?.split(' ').slice(-1)[0] || '—';
    const retiredCount = displayList.filter(s => s.distance >= s.limit).length;

    const renderShoeItem = ({ item }) => {
        const shoeRuns = userData.runHistory?.filter(r => r.gearId === item.id) || [];
        let fastestPaceStr = '--:--';
        let fastestPaceSec = Infinity;
        shoeRuns.forEach(run => {
            if (run.pace && run.pace !== '--:--') {
                const [m, s] = run.pace.split(':').map(Number);
                const total = m * 60 + s;
                if (total < fastestPaceSec) { fastestPaceSec = total; fastestPaceStr = run.pace; }
            }
        });

        const isRetired = item.distance >= item.limit;
        const progress = Math.min(item.distance / item.limit, 1);
        const progressColor = isRetired ? COLORS.danger : progress > 0.8 ? COLORS.warning : ACCENT;
        const kmLeft = Math.max(item.limit - item.distance, 0).toFixed(0);

        return (
            <TouchableOpacity
                style={[
                    styles.card,
                    item.isDefault && styles.activeCard,
                    isRetired && styles.retiredCard,
                ]}
                activeOpacity={0.75}
                onLongPress={() => openEditModal(item)}
            >
                {/* Active stripe */}
                {item.isDefault && <View style={styles.activeStripe} />}

                <View style={styles.cardHeader}>
                    <RingIcon progress={progress} isDefault={item.isDefault} isRetired={isRetired} />

                    <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={[styles.shoeName, isRetired && styles.retiredText]} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <Text style={styles.shoeStats}>
                            {item.distance.toFixed(1)} <Text style={{ color: '#666' }}>/ {item.limit} km</Text>
                        </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                        {isRetired ? (
                            <View style={styles.retiredBadge}>
                                <Text style={styles.retiredBadgeText}>RETIRED</Text>
                            </View>
                        ) : item.isDefault ? (
                            <View style={styles.defaultBadge}>
                                <Text style={styles.defaultText}>Active</Text>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={() => selectDefaultGear(item.id)}>
                                <MaterialCommunityIcons name="radiobox-blank" size={22} color="#555" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => openEditModal(item)}>
                            <MaterialCommunityIcons name="cog-outline" size={19} color="#555" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Performance row */}
                {shoeRuns.length > 0 && (
                    <View style={styles.performanceRow}>
                        <View style={styles.perfItem}>
                            <Ionicons name="flash" size={13} color={ACCENT} />
                            <View style={{ marginLeft: 6 }}>
                                <Text style={styles.perfLabel}>BEST PACE</Text>
                                <Text style={styles.perfValue}>{fastestPaceStr}</Text>
                            </View>
                        </View>
                        <View style={styles.perfDivider} />
                        <View style={styles.perfItem}>
                            <Ionicons name="stats-chart" size={13} color="#555" />
                            <View style={{ marginLeft: 6 }}>
                                <Text style={styles.perfLabel}>RUNS</Text>
                                <Text style={styles.perfValue}>{shoeRuns.length}</Text>
                            </View>
                        </View>
                        <View style={styles.perfDivider} />
                        <View style={styles.perfItem}>
                            <Ionicons name="footsteps" size={13} color="#555" />
                            <View style={{ marginLeft: 6 }}>
                                <Text style={styles.perfLabel}>AVG DIST</Text>
                                <Text style={styles.perfValue}>
                                    {shoeRuns.length > 0
                                        ? (shoeRuns.reduce((a, r) => a + (r.distance || 0), 0) / shoeRuns.length).toFixed(1)
                                        : '--'} km
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Gradient progress bar + remaining pill */}
                <View style={styles.progressSection}>
                    <GradientBar progress={progress} color={progressColor} />
                    <View style={styles.progressFooter}>
                        <Text style={[styles.statusText, { color: progressColor }]}>
                            {isRetired ? 'LIMIT REACHED' : `${Math.round((1 - progress) * 100)}% remaining`}
                        </Text>
                        {!isRetired && (
                            <View style={[styles.kmLeftPill, { borderColor: progressColor + '55' }]}>
                                <Text style={[styles.kmLeftText, { color: progressColor }]}>{kmLeft} km left</Text>
                            </View>
                        )}
                        <TouchableOpacity
                            onPress={() =>
                                Alert.alert(
                                    'Delete Shoe',
                                    `Are you sure you want to remove ${item.name} from your gear tracker?`,
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Delete', style: 'destructive',
                                            onPress: async () => {
                                                try { await deleteGear(item.id); }
                                                catch { Alert.alert('Error', 'Could not delete this shoe. Please try again.'); }
                                            },
                                        },
                                    ]
                                )
                            }
                        >
                            <Ionicons name="trash-outline" size={16} color="#444" />
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const { animatedRenderItem } = useStaggerAnimation(renderShoeItem);

    if (isLoading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
                <StatusBar barStyle="light-content" />
                <ScrollView showsVerticalScrollIndicator={false}>
                    <SkeletonCard variant="gear" />
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <SafeAreaView style={{ flex: 1 }}>

                {/* ── Header ── */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                        <Ionicons name="arrow-back" size={22} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>GEAR TRACKER</Text>
                    <TouchableOpacity style={styles.headerBtn} onPress={openAddModal}>
                        <Ionicons name="add" size={24} color={ACCENT} />
                    </TouchableOpacity>
                </View>

                {/* ── Summary hero strip ── */}
                <View style={styles.heroStrip}>
                    <View style={styles.heroStat}>
                        <Text style={styles.heroValue}>{displayList.length}</Text>
                        <Text style={styles.heroLabel}>Shoes</Text>
                    </View>
                    <View style={styles.heroDivider} />
                    <View style={styles.heroStat}>
                        <Text style={styles.heroValue}>{totalKm}</Text>
                        <Text style={styles.heroLabel}>Total km</Text>
                    </View>
                    <View style={styles.heroDivider} />
                    <View style={styles.heroStat}>
                        <Text style={[styles.heroValue, { color: ACCENT, fontSize: 13 }]} numberOfLines={1}>{activeName}</Text>
                        <Text style={styles.heroLabel}>Active shoe</Text>
                    </View>
                    {retiredCount > 0 && (
                        <>
                            <View style={styles.heroDivider} />
                            <View style={styles.heroStat}>
                                <Text style={[styles.heroValue, { color: COLORS.danger }]}>{retiredCount}</Text>
                                <Text style={styles.heroLabel}>Retired</Text>
                            </View>
                        </>
                    )}
                </View>

                <Animated.FlatList
                    data={displayList}
                    renderItem={animatedRenderItem}
                    keyExtractor={item => item.id.toString()}
                    extraData={displayList}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="shoe-sneaker" size={48} color="#2A2A2A" />
                            <Text style={styles.emptyTitle}>No shoes yet</Text>
                            <Text style={styles.emptyHint}>Tap the + button to add your first pair</Text>
                        </View>
                    }
                />

                {/* FAB hidden — add button is now in header. Keep FAB as secondary entry */}
                <TouchableOpacity style={styles.fab} onPress={openAddModal}>
                    <LinearGradient colors={[ACCENT, '#B2FF59']} style={styles.fabGradient}>
                        <Ionicons name="add" size={28} color="#000" />
                    </LinearGradient>
                </TouchableOpacity>

                {/* ── Bottom-sheet modal ── */}
                <Modal visible={modalVisible} transparent animationType="none">
                    <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); closeSheet(); }}>
                        <View style={styles.sheetOverlay} />
                    </TouchableWithoutFeedback>

                    <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                            <TouchableWithoutFeedback onPress={() => setShowDropdown(false)}>
                                <View>
                                    {/* Handle */}
                                    <View style={styles.sheetHandle} />

                                    <Text style={styles.sheetTitle}>
                                        {isEditing ? 'Edit Shoe' : 'Add New Shoe'}
                                    </Text>

                                    {/* Shoe model input */}
                                    <Text style={styles.inputLabel}>Shoe Model</Text>
                                    <View style={{ zIndex: 10 }}>
                                        <View style={styles.inputWrapper}>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Search model..."
                                                placeholderTextColor="#444"
                                                value={newShoeName}
                                                onChangeText={t => { setNewShoeName(t); if (!isEditing) setShowDropdown(true); }}
                                            />
                                            {!isEditing && (
                                                <TouchableOpacity
                                                    onPress={() => setShowDropdown(v => !v)}
                                                    style={styles.iconBtn}
                                                >
                                                    <Ionicons name={showDropdown ? 'chevron-up' : 'search'} size={18} color={ACCENT} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        {showDropdown && (
                                            <View style={styles.floatingDropdown}>
                                                <FlatList
                                                    data={filteredShoes}
                                                    keyExtractor={(_, i) => i.toString()}
                                                    nestedScrollEnabled
                                                    keyboardShouldPersistTaps="handled"
                                                    renderItem={({ item }) => (
                                                        <TouchableOpacity
                                                            style={styles.dropdownItem}
                                                            onPress={() => handleSelectShoe(item)}
                                                        >
                                                            <Text style={styles.dropdownText}>{item}</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                />
                                            </View>
                                        )}
                                    </View>

                                    {/* Current distance (edit only) */}
                                    {isEditing && (
                                        <View style={{ marginTop: 20 }}>
                                            <Text style={styles.inputLabel}>Current Distance (km)</Text>
                                            <View style={styles.limitInputWrapper}>
                                                <TextInput
                                                    style={styles.limitInput}
                                                    keyboardType="numeric"
                                                    value={currentDistanceInput}
                                                    onChangeText={setCurrentDistanceInput}
                                                />
                                                <View style={styles.autoBadge}>
                                                    <MaterialCommunityIcons name="pencil" size={11} color="#000" />
                                                    <Text style={styles.autoBadgeText}>ADJUST</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.helperText}>Update manually if you missed logging a run.</Text>
                                        </View>
                                    )}

                                    {/* Max limit */}
                                    <View style={{ marginTop: 20 }}>
                                        <Text style={styles.inputLabel}>Max Distance Limit (km)</Text>
                                        <View style={[styles.limitInputWrapper, autoDetected && { borderColor: ACCENT }]}>
                                            <TextInput
                                                style={styles.limitInput}
                                                keyboardType="numeric"
                                                value={newShoeLimit}
                                                onChangeText={setNewShoeLimit}
                                            />
                                            {autoDetected && (
                                                <View style={styles.autoBadge}>
                                                    <Ionicons name="sparkles" size={11} color="#000" />
                                                    <Text style={styles.autoBadgeText}>AI SET</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    {/* Buttons */}
                                    <View style={styles.modalButtons}>
                                        <TouchableOpacity style={styles.cancelBtn} onPress={closeSheet}>
                                            <Text style={styles.cancelText}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                            <Text style={styles.saveText}>{isEditing ? 'Save Changes' : 'Add Shoe'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </TouchableWithoutFeedback>
                        </KeyboardAvoidingView>
                    </Animated.View>
                </Modal>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },

    // ── Header ──
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 12,
    },
    headerBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_700Bold', letterSpacing: 1.5 },

    // ── Hero strip ──
    heroStrip: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 20, marginBottom: 20,
        backgroundColor: '#111', borderRadius: 16,
        borderWidth: 1, borderColor: '#1E1E1E',
        paddingVertical: 16,
    },
    heroStat: { flex: 1, alignItems: 'center' },
    heroValue: { color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold', lineHeight: 24 },
    heroLabel: { color: '#555', fontSize: 10, fontFamily: 'Poppins_500Medium', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
    heroDivider: { width: 1, height: 32, backgroundColor: '#222' },

    // ── List ──
    listContent: { paddingHorizontal: 20, paddingBottom: 120 },

    // ── Card ──
    card: {
        backgroundColor: '#111',
        borderRadius: 20,
        padding: 18,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#1E1E1E',
        overflow: 'hidden',
    },
    activeCard: {
        borderColor: ACCENT,
        backgroundColor: 'rgba(204,255,0,0.04)',
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 4,
    },
    activeStripe: {
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, backgroundColor: ACCENT, borderRadius: 2,
    },
    retiredCard: { opacity: 0.45, borderColor: '#1A1A1A' },
    retiredText: { textDecorationLine: 'line-through', color: '#555' },

    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },

    iconBox: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#222', justifyContent: 'center', alignItems: 'center',
    },
    activeIconBox: { backgroundColor: ACCENT },

    shoeName: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_600SemiBold', marginBottom: 2 },
    shoeStats: { color: '#AAA', fontSize: 13, fontFamily: 'Poppins_500Medium' },

    retiredBadge: { backgroundColor: 'rgba(255,59,48,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)' },
    retiredBadgeText: { color: COLORS.danger, fontSize: 9, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },
    defaultBadge: { backgroundColor: ACCENT, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    defaultText: { color: '#000', fontSize: 9, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },

    // ── Performance row ──
    performanceRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
        marginBottom: 14,
    },
    perfItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    perfDivider: { width: 1, height: 28, backgroundColor: '#222', marginHorizontal: 8 },
    perfLabel: { color: '#555', fontSize: 9, fontFamily: 'Poppins_600SemiBold', letterSpacing: 0.8, textTransform: 'uppercase' },
    perfValue: { color: '#FFF', fontSize: 13, fontFamily: 'Poppins_700Bold', marginTop: 1 },

    // ── Progress bar ──
    progressSection: { marginTop: 2 },
    progressTrack: {
        height: 8, backgroundColor: '#1E1E1E', borderRadius: 6,
        overflow: 'hidden', marginBottom: 8,
    },
    progressFill: { height: '100%', borderRadius: 6 },
    progressFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statusText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
    kmLeftPill: {
        borderWidth: 1, borderRadius: 8,
        paddingHorizontal: 8, paddingVertical: 3,
    },
    kmLeftText: { fontSize: 10, fontFamily: 'Poppins_700Bold' },

    // ── FAB ──
    fab: { position: 'absolute', bottom: 30, right: 20 },
    fabGradient: {
        width: 58, height: 58, borderRadius: 29,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    },

    // ── Empty state ──
    emptyState: { alignItems: 'center', marginTop: 80, gap: 10 },
    emptyTitle: { color: '#333', fontSize: 18, fontFamily: 'Poppins_700Bold' },
    emptyHint: { color: '#2A2A2A', fontSize: 13, fontFamily: 'Poppins_400Regular' },

    // ── Bottom sheet ──
    sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
    sheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#111',
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12,
        borderWidth: 1, borderColor: '#222',
        zIndex: 100,
    },
    sheetHandle: {
        width: 36, height: 4, backgroundColor: '#333',
        borderRadius: 2, alignSelf: 'center', marginBottom: 20,
    },
    sheetTitle: {
        color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold',
        marginBottom: 24, textAlign: 'center',
    },

    // ── Modal form ──
    inputLabel: { color: '#666', fontSize: 11, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginLeft: 2 },
    inputWrapper: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#0D0D0D', borderRadius: 14,
        borderWidth: 1, borderColor: '#2A2A2A', height: 52,
    },
    input: { flex: 1, color: '#FFF', paddingHorizontal: 16, fontSize: 15, fontFamily: 'Poppins_400Regular', height: '100%' },
    iconBtn: { padding: 14 },
    floatingDropdown: {
        position: 'absolute', top: 56, left: 0, right: 0,
        backgroundColor: '#181818', borderRadius: 14,
        borderWidth: 1, borderColor: '#2A2A2A',
        zIndex: 5000, maxHeight: 160,
    },
    dropdownItem: { paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
    dropdownText: { color: '#DDD', fontSize: 14, fontFamily: 'Poppins_500Medium' },

    limitInputWrapper: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#0D0D0D', borderRadius: 14,
        borderWidth: 1, borderColor: '#2A2A2A', height: 52,
    },
    limitInput: { flex: 1, color: '#FFF', paddingHorizontal: 16, fontSize: 15, fontFamily: 'Poppins_400Regular', height: '100%' },
    autoBadge: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: ACCENT, paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 10, marginRight: 10, gap: 4,
    },
    autoBadgeText: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#000' },

    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 28 },
    cancelBtn: {
        flex: 1, paddingVertical: 15, alignItems: 'center',
        borderRadius: 14, borderWidth: 1, borderColor: '#2A2A2A', backgroundColor: '#0D0D0D',
    },
    cancelText: { color: '#888', fontFamily: 'Poppins_600SemiBold', fontSize: 15 },
    saveBtn: { flex: 1, backgroundColor: ACCENT, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
    saveText: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 15 },
    helperText: { color: '#444', fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 6, marginLeft: 4 },
});
