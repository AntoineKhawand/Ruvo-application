import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Color Logic
const getRatingColor = (r) => {
    if (r <= 3) return "#B2FF59"; // Green
    if (r <= 6) return "#FFEE58"; // Yellow
    if (r <= 8) return "#FFA726"; // Orange
    return "#FF5252"; // Red
};

// Label Logic
const getRatingLabel = (r) => {
    if (r === 0) return "Select intensity";
    if (r <= 2) return "Very Easy";
    if (r <= 4) return "Easy / Moderate";
    if (r <= 6) return "Somewhat Hard";
    if (r <= 8) return "Hard Effort";
    if (r === 9) return "Very Hard";
    return "Maximum Effort";
};

const CONTEXT_TAGS = ["Strong 💪", "Tired 😴", "Injured 🩹", "Hilly ⛰️", "Hot ☀️", "Windy 💨", "Rain 🌧️"];

export default function RateEffortScreen({ route, navigation }) {
  const { runData } = route.params || {};
  
  // Safe default data
  const safeRunData = runData || {
      time: '00:00',
      distance: 0.00,
      calories: 0,
  };

  const [rating, setRating] = useState(5); 
  const [selectedTags, setSelectedTags] = useState([]); 
  const [notes, setNotes] = useState(""); 
  
  const currentColor = useMemo(() => getRatingColor(rating), [rating]);
  
  const toggleTag = (tag) => {
      if (selectedTags.includes(tag)) {
          setSelectedTags(prev => prev.filter(t => t !== tag));
      } else {
          setSelectedTags(prev => [...prev, tag]);
      }
  };

  const handleContinue = () => {
    const updatedRunData = { 
        ...safeRunData, 
        effortRating: rating,
        tags: selectedTags, 
        notes: notes 
    };
    navigation.navigate('SaveActivity', { runData: updatedRunData });
  };
  
  const RPE_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={styles.safeArea}>
          
          {/* HEADER */}
          <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                  <Ionicons name="close" size={22} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>SESSION ANALYSIS</Text>
              <View style={styles.iconBtnPlaceholder} /> 
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex: 1}}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              
              {/* --- 1. HERO SECTION (Refined) --- */}
              <View style={styles.heroSection}>
                  <Text style={styles.heroQuestion}>How did that feel?</Text>
                  
                  {/* Glowing Number Display */}
                  <View style={styles.ratingCircleContainer}>
                      <View style={[styles.ratingGlow, { backgroundColor: currentColor, shadowColor: currentColor }]} />
                      <Text style={[styles.ratingNumber, { color: currentColor }]}>{rating}</Text>
                  </View>
                  
                  <Text style={[styles.ratingLabel, { color: currentColor }]}>{getRatingLabel(rating)}</Text>
                  
                  {/* RPE Selector Grid */}
                  <View style={styles.rpeGrid}>
                      {RPE_VALUES.map((value) => (
                          <TouchableOpacity 
                              key={value} 
                              activeOpacity={0.7}
                              style={[
                                  styles.rpeItem, 
                                  rating === value && { backgroundColor: currentColor, borderColor: currentColor, transform: [{scale: 1.1}] }
                              ]} 
                              onPress={() => setRating(value)}
                          >
                              <Text style={[
                                  styles.rpeItemText, 
                                  rating === value ? { color: '#000', fontWeight: '900' } : { color: '#444' }
                              ]}>{value}</Text>
                          </TouchableOpacity>
                      ))}
                  </View>
              </View>

              <View style={styles.sectionDivider} />

              {/* --- 2. QUICK STATS STRIP --- */}
              <View style={styles.statsStrip}>
                  <View style={styles.statBox}>
                      <Text style={styles.statLabel}>DURATION</Text>
                      <Text style={styles.statValue}>{safeRunData?.time || '00:00'}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                      <Text style={styles.statLabel}>DISTANCE</Text>
                      <Text style={styles.statValue}>{safeRunData?.distance?.toFixed(2) || '0.00'} <Text style={styles.unit}>km</Text></Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                      <Text style={styles.statLabel}>CALORIES</Text>
                      <Text style={styles.statValue}>{Math.floor(safeRunData?.calories || 0)}</Text>
                  </View>
              </View>

              {/* --- 3. CONTEXT TAGS --- */}
              <View style={styles.cardSection}>
                  <Text style={styles.sectionTitle}>Context & Conditions</Text>
                  <View style={styles.tagsRow}>
                      {CONTEXT_TAGS.map((tag) => {
                          const isActive = selectedTags.includes(tag);
                          return (
                              <TouchableOpacity 
                                  key={tag} 
                                  style={[
                                      styles.tag, 
                                      isActive ? { backgroundColor: currentColor, borderColor: currentColor } : { backgroundColor: '#111', borderColor: '#333' }
                                  ]} 
                                  onPress={() => toggleTag(tag)}
                              >
                                  <Text style={[styles.tagText, isActive ? { color: '#000', fontWeight: '700' } : { color: '#888' }]}>{tag}</Text>
                              </TouchableOpacity>
                          );
                      })}
                  </View>
              </View>

              {/* --- 4. NOTES --- */}
              <View style={styles.cardSection}>
                  <Text style={styles.sectionTitle}>Run Diary</Text>
                  <View style={styles.inputWrapper}>
                      <TextInput 
                          style={styles.notesInput} 
                          placeholder="Note any pain, thoughts, or highlights..." 
                          placeholderTextColor="#444" 
                          value={notes} 
                          onChangeText={setNotes} 
                          multiline 
                      />
                      <Ionicons name="create-outline" size={16} color="#444" style={styles.inputIcon} />
                  </View>
              </View>

          </ScrollView>
          </KeyboardAvoidingView>
          
          {/* Footer Button */}
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.continueBtn, { backgroundColor: currentColor }]} onPress={handleContinue}>
                <Text style={styles.continueText}>COMPLETE ACTIVITY</Text>
                <Ionicons name="checkmark-circle" size={20} color="#000" />
            </TouchableOpacity>
          </View>

        </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' }, // Pure Black Background
  safeArea: { flex: 1 }, 
  
  // HEADER
  header: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      paddingHorizontal: 20, 
      paddingVertical: 15 
  },
  headerTitle: { color: '#666', fontSize: 13, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  iconBtnPlaceholder: { width: 40 },

  scrollContent: { paddingBottom: 100 },

  // HERO SECTION
  heroSection: { alignItems: 'center', marginTop: 20 },
  heroQuestion: { color: '#FFF', fontSize: 22, fontFamily: 'Poppins_700Bold', marginBottom: 25 },
  
  ratingCircleContainer: { alignItems: 'center', justifyContent: 'center', width: 120, height: 120, marginBottom: 10 },
  ratingNumber: { fontSize: 100, fontFamily: 'Poppins_900Black', lineHeight: 110, zIndex: 2 },
  ratingGlow: { position: 'absolute', width: 80, height: 80, borderRadius: 40, opacity: 0.15, shadowOffset: {width:0, height:0}, shadowRadius: 40, shadowOpacity: 1, elevation: 10 },
  
  ratingLabel: { fontSize: 20, fontFamily: 'Poppins_700Bold', textTransform: 'uppercase', marginBottom: 30, letterSpacing: 1 },

  // RPE GRID
  rpeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 20, gap: 10 },
  rpeItem: { width: (width - 70) / 5, height: 50, borderRadius: 14, borderWidth: 1, borderColor: '#222', backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  rpeItemText: { fontSize: 16, fontFamily: 'Poppins_700Bold' },

  sectionDivider: { height: 1, backgroundColor: '#111', marginVertical: 30, marginHorizontal: 30 },

  // STATS STRIP
  statsStrip: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 30, marginBottom: 30 },
  statBox: { alignItems: 'center' },
  statLabel: { color: '#444', fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 0.5, marginBottom: 4 },
  statValue: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_600SemiBold' },
  unit: { fontSize: 12, color: '#666', fontFamily: 'Poppins_400Regular' },
  statDivider: { width: 1, height: '80%', backgroundColor: '#222', alignSelf: 'center' },

  // SECTIONS (TAGS & NOTES)
  cardSection: { paddingHorizontal: 20, marginBottom: 30 },
  sectionTitle: { color: '#888', fontSize: 13, fontFamily: 'Poppins_700Bold', marginBottom: 15, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tag: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 25, borderWidth: 1 },
  tagText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },

  inputWrapper: { position: 'relative' },
  notesInput: { backgroundColor: '#111', borderRadius: 16, padding: 15, paddingRight: 40, color: '#FFF', fontSize: 14, fontFamily: 'Poppins_400Regular', minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#222' },
  inputIcon: { position: 'absolute', top: 15, right: 15 },

  // FOOTER
  footer: { padding: 20, paddingBottom: 30, backgroundColor: 'transparent' },
  continueBtn: { height: 60, borderRadius: 30, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 5 },
  continueText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_800ExtraBold', letterSpacing: 0.5 }
});