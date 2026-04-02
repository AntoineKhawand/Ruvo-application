import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Animated, FlatList, Keyboard, Modal, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { detectShoeDistance } from '../utils/helpers';
import useStaggerAnimation from '../hooks/useStaggerAnimation';

const COLORS = {
    accent: "#CCFF00", 
    primary: "#000000",
    secondary: "#1C1C1E",
    danger: "#FF3B30",
    warning: "#FFCC00"
};

const POPULAR_SHOES = [
    "Nike Air Zoom Pegasus 40", "Nike Vaporfly 3", "Nike Alphafly 3", "Nike Invincible 3", "Nike Vomero 17",
    "Hoka Clifton 9", "Hoka Bondi 8", "Hoka Speedgoat 5", "Hoka Mach 6",
    "Saucony Endorphin Speed 4", "Saucony Ride 17", "Brooks Ghost 15",
    "Asics Novablast 4", "Asics Gel-Kayano 30", "Adidas Boston 12",
    "New Balance 1080v13", "On Cloudmonster 2", "Reebok Floatride Energy 5"
];

export default function GearScreen({ navigation }) {
  // 1. GET FUNCTIONS FROM CONTEXT
  const { userData, addGear, selectDefaultGear, deleteGear, updateGear } = useUser(); 
  
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

  // 2. SORT & ALERT LOGIC
  useEffect(() => {
    if (userData?.gearList) {
      const sorted = [...userData.gearList].sort((a, b) => (a.distance >= a.limit ? 1 : -1));
      setDisplayList(sorted);

      // Check for mileage warnings
      userData.gearList.forEach(shoe => {
          if (shoe.distance >= shoe.limit && !shoe.alertShown) {
              Alert.alert(
                  "🚨 Equipment Warning",
                  `Your ${shoe.name} has reached its mileage limit (${shoe.limit}km). Consider retiring them.`,
                  [{ text: "I Understand", style: "destructive" }]
              );
              // In a real app, you'd mark 'alertShown' in DB to prevent repeat alerts
          }
      });
    }
  }, [userData?.gearList]);

  useEffect(() => {
      if (!isEditing && newShoeName.length > 0) {
          const matches = POPULAR_SHOES.filter(shoe => shoe.toLowerCase().includes(newShoeName.toLowerCase()));
          setFilteredShoes(matches);
      } else {
          setFilteredShoes(POPULAR_SHOES);
      }
      
      if (!isEditing) {
          const detectedLimit = detectShoeDistance(newShoeName);
          if (detectedLimit) {
              setNewShoeLimit(detectedLimit.toString());
              setAutoDetected(true);
          } else {
              setAutoDetected(false);
          }
      }
  }, [newShoeName]);

  const handleSelectShoe = (shoeName) => {
      setNewShoeName(shoeName);
      setShowDropdown(false);
      Keyboard.dismiss();
  };

  const openAddModal = () => {
      setIsEditing(false);
      setNewShoeName('');
      setNewShoeLimit('800');
      setCurrentDistanceInput('0');
      setModalVisible(true);
  };

  const openEditModal = (shoe) => {
      setIsEditing(true);
      setEditingId(shoe.id);
      setNewShoeName(shoe.name);
      setNewShoeLimit(shoe.limit.toString());
      const cleanDistance = parseFloat(shoe.distance.toFixed(2)).toString();
      setCurrentDistanceInput(cleanDistance);
      setModalVisible(true);
  };

  // 3. SAVE TO FIREBASE VIA CONTEXT
  const handleSave = async () => {
    if (!newShoeName.trim()) return;

    try {
        if (isEditing) {
            const updatedShoe = {
                name: newShoeName,
                limit: parseFloat(newShoeLimit),
                distance: parseFloat(currentDistanceInput)
            };
            // Update via Context
            if(updateGear) await updateGear(editingId, updatedShoe);
        } else {
            // Add via Context
            await addGear(newShoeName, newShoeLimit);
        }

        setModalVisible(false);
        setNewShoeName('');
        setNewShoeLimit('800');
        setAutoDetected(false);
    } catch (error) {
        Alert.alert("Error Saving Gear", "Could not save your equipment changes. Please check your connection and try again.");
    }
  };

  const renderShoeItem = ({ item }) => {
    useEffect(() => {
      if (!item) return;
    }, [item]);

    const shoeRuns = userData.runHistory?.filter(run => run.gearId === item.id) || [];
    let fastestPaceSec = Infinity;
    let fastestPaceStr = "--:--";

    shoeRuns.forEach(run => {
        if (run.pace && run.pace !== "--:--") {
            const [min, sec] = run.pace.split(':').map(Number);
            const totalSec = (min * 60) + sec;
            if (totalSec < fastestPaceSec) {
                fastestPaceSec = totalSec;
                fastestPaceStr = run.pace;
            }
        }
    });

    const isRetired = item.distance >= item.limit;
    const progress = Math.min(item.distance / item.limit, 1);
    let progressColor = isRetired ? COLORS.danger : progress > 0.8 ? COLORS.warning : COLORS.accent;

    return (
      <TouchableOpacity 
        style={[styles.card, item.isDefault && styles.activeCard, isRetired && styles.retiredCard]}
        activeOpacity={0.7}
        onLongPress={() => openEditModal(item)}
      >
        <View style={styles.cardHeader}>
            <View style={[styles.iconBox, item.isDefault && styles.activeIconBox, isRetired && {backgroundColor: '#222'}]}>
                <MaterialCommunityIcons name={isRetired ? "alert-circle" : "shoe-sneaker"} size={24} color={item.isDefault ? '#000' : isRetired ? COLORS.danger : '#FFF'} />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={[styles.shoeName, isRetired && styles.retiredText]}>{item.name}</Text>
                <Text style={styles.shoeStats}>{item.distance.toFixed(1)} / {item.limit} km</Text>
            </View>
            
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <TouchableOpacity onPress={() => openEditModal(item)} style={{marginRight: 12}}>
                    <MaterialCommunityIcons name="cog-outline" size={22} color="#888" />
                </TouchableOpacity>

                {isRetired ? (
                    <View style={styles.retiredBadge}><Text style={styles.retiredBadgeText}>RETIRED</Text></View>
                ) : item.isDefault ? (
                    <View style={styles.defaultBadge}><Text style={styles.defaultText}>Active</Text></View>
                ) : (
                    <TouchableOpacity onPress={() => selectDefaultGear(item.id)}><MaterialCommunityIcons name="radiobox-blank" size={24} color="#666" /></TouchableOpacity>
                )}
            </View>
        </View>

        {shoeRuns.length > 0 && (
            <View style={styles.performanceRow}>
                <View style={styles.perfItem}>
                    <Ionicons name="flash" size={12} color={COLORS.accent} />
                    <Text style={styles.perfText}> BEST PACE: <Text style={{color: '#FFF'}}>{fastestPaceStr}</Text></Text>
                </View>
                <View style={styles.perfItem}>
                    <Ionicons name="stats-chart" size={12} color="#888" />
                    <Text style={styles.perfText}> RUNS: <Text style={{color: '#FFF'}}>{shoeRuns.length}</Text></Text>
                </View>
            </View>
        )}

        <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: progressColor }]} />
        </View>

        <View style={styles.cardFooter}>
            <Text style={[styles.statusText, { color: progressColor }]}>{isRetired ? "LIMIT REACHED" : `${Math.round((1 - progress) * 100)}% remaining`}</Text>
            <TouchableOpacity onPress={() => {
                Alert.alert(
                    "Delete Shoe",
                    `Are you sure you want to remove ${item.name} from your gear tracker?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { 
                            text: "Delete", 
                            style: "destructive",
                            onPress: async () => {
                                try {
                                    await deleteGear(item.id);
                                } catch (error) {
                                    Alert.alert("Error", "Could not delete this shoe. Please try again.");
                                }
                            }
                        }
                    ]
                );
            }}>
                <Ionicons name="trash-outline" size={18} color="#666" />
            </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const { animatedRenderItem } = useStaggerAnimation(renderShoeItem);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
            <Text style={styles.headerTitle}>MY GEAR TRACKER</Text>
            <View style={{ width: 24 }} /> 
        </View>

        <Animated.FlatList 
            data={displayList}
            renderItem={animatedRenderItem}
            keyExtractor={item => item.id.toString()}
            extraData={displayList}
            contentContainerStyle={{ padding: 20 }}
            ListHeaderComponent={
                <View style={styles.listHeader}>
                    <Text style={styles.totalShoes}>{displayList.length} Shoes</Text>
                    <Text style={styles.totalDist}>Total Mileage: {displayList.reduce((acc, curr) => acc + curr.distance, 0).toFixed(0)} km</Text>
                </View>
            }
        />

        <TouchableOpacity style={styles.fab} onPress={openAddModal}>
            <LinearGradient colors={[COLORS.accent, '#B2FF59']} style={styles.fabGradient}><Ionicons name="add" size={30} color="#000" /></LinearGradient>
        </TouchableOpacity>

        {/* --- ADD / EDIT MODAL --- */}
        <Modal visible={modalVisible} transparent animationType="fade">
            <TouchableWithoutFeedback onPress={() => { setShowDropdown(false); Keyboard.dismiss(); }}>
                <View style={styles.modalOverlay}>
                    <TouchableWithoutFeedback onPress={() => {}}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>{isEditing ? "Edit Shoe Details" : "Add New Shoe"}</Text>
                            
                            <Text style={styles.inputLabel}>Shoe Model</Text>
                            <View style={{ zIndex: 2000 }}> 
                                <View style={styles.inputWrapper}>
                                    <TextInput style={styles.input} placeholder="Search model..." placeholderTextColor="#666" value={newShoeName} onChangeText={(t) => {setNewShoeName(t); if(!isEditing) setShowDropdown(true);}} />
                                    {!isEditing && <TouchableOpacity onPress={() => setShowDropdown(!showDropdown)} style={styles.iconBtn}><Ionicons name={showDropdown ? "chevron-up" : "search"} size={20} color={COLORS.accent} /></TouchableOpacity>}
                                </View>
                                {showDropdown && (
                                    <View style={styles.floatingDropdown}>
                                        <FlatList data={filteredShoes} keyExtractor={(item, index) => index.toString()} renderItem={({ item }) => (
                                            <TouchableOpacity style={styles.dropdownItem} onPress={() => handleSelectShoe(item)}><Text style={styles.dropdownText}>{item}</Text></TouchableOpacity>
                                        )} />
                                    </View>
                                )}
                            </View>

                            {isEditing && (
                                <View style={{ marginTop: 20 }}>
                                    <Text style={styles.inputLabel}>Current Distance (km)</Text>
                                    <View style={styles.limitInputWrapper}>
                                        <TextInput style={styles.limitInput} keyboardType="numeric" value={currentDistanceInput} onChangeText={setCurrentDistanceInput} />
                                        <View style={styles.autoBadge}><MaterialCommunityIcons name="pencil" size={12} color="#000" /><Text style={styles.autoBadgeText}>ADJUST</Text></View>
                                    </View>
                                    <Text style={styles.helperText}>Update manually if you missed logging a run.</Text>
                                </View>
                            )}

                            <View style={{ marginTop: 20 }}>
                                <Text style={styles.inputLabel}>Max Distance Limit (km)</Text>
                                <View style={[styles.limitInputWrapper, autoDetected && { borderColor: COLORS.accent }]}>
                                    <TextInput style={styles.limitInput} keyboardType="numeric" value={newShoeLimit} onChangeText={setNewShoeLimit} />
                                    {autoDetected && <View style={styles.autoBadge}><Ionicons name="sparkles" size={12} color="#000" /><Text style={styles.autoBadgeText}>AI SET</Text></View>}
                                </View>
                            </View>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                    <Text style={styles.saveText}>{isEditing ? "Save" : "Add Shoe"}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  headerTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },
  listHeader: { marginBottom: 20 },
  totalShoes: { color: '#FFF', fontSize: 32, fontFamily: 'Poppins_700Bold' },
  totalDist: { color: '#888', fontSize: 14, fontFamily: 'Poppins_400Regular' },
  card: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  activeCard: { borderColor: COLORS.accent, backgroundColor: 'rgba(204, 255, 0, 0.05)' },
  retiredCard: { opacity: 0.5, borderColor: '#222' },
  retiredText: { textDecorationLine: 'line-through', color: '#666' },
  retiredBadge: { backgroundColor: '#333', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  retiredBadgeText: { color: COLORS.danger, fontSize: 10, fontFamily: 'Poppins_700Bold' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  iconBox: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  activeIconBox: { backgroundColor: COLORS.accent },
  shoeName: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
  shoeStats: { color: '#AAA', fontSize: 13 },
  defaultBadge: { backgroundColor: COLORS.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  defaultText: { color: '#000', fontSize: 10, fontFamily: 'Poppins_700Bold' },
  performanceRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8, marginBottom: 12, justifyContent: 'space-around' },
  perfItem: { flexDirection: 'row', alignItems: 'center' },
  perfText: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#888', letterSpacing: 0.5 },
  progressContainer: { height: 6, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  progressBar: { height: '100%', borderRadius: 3 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusText: { fontSize: 12, fontFamily: 'Poppins_500Medium' },
  fab: { position: 'absolute', bottom: 30, right: 20 },
  fabGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: '#1C1C1E', borderRadius: 24, padding: 25, borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#FFF', fontSize: 22, fontFamily: 'Poppins_700Bold', marginBottom: 25, textAlign: 'center' },
  inputLabel: { color: '#AAA', fontSize: 13, marginBottom: 8, marginLeft: 4, fontFamily: 'Poppins_600SemiBold' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: '#333', height: 55 },
  input: { flex: 1, color: '#FFF', paddingHorizontal: 16, fontSize: 16, fontFamily: 'Poppins_400Regular', height: '100%' },
  iconBtn: { padding: 15 },
  floatingDropdown: { position: 'absolute', top: 60, left: 0, right: 0, backgroundColor: '#252525', borderRadius: 12, borderWidth: 1, borderColor: '#444', zIndex: 5000, maxHeight: 150 },
  dropdownItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  dropdownText: { color: '#EEE', fontSize: 14, fontFamily: 'Poppins_500Medium' },
  limitInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: '#333', height: 55 },
  limitInput: { flex: 1, color: '#FFF', paddingHorizontal: 16, fontSize: 16, fontFamily: 'Poppins_400Regular', height: '100%' }, 
  autoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, marginRight: 10 },
  autoBadgeText: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#000', marginLeft: 4 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 },
  cancelBtn: { padding: 15, flex: 1, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#333', marginRight: 10, backgroundColor: '#111' },
  cancelText: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 15 },
  saveBtn: { backgroundColor: COLORS.accent, padding: 15, borderRadius: 16, flex: 1, alignItems: 'center', marginLeft: 10 },
  saveText: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 15 },
  helperText: { color: '#666', fontSize: 11, marginTop: 5, marginLeft: 5 },
});