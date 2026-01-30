import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext'; // Import UserContext

export default function PrivacyControlsScreen({ navigation }) {
  const { theme } = useTheme();
  const { userData, updatePrivacySettings } = useUser(); // Access persistent settings

  // Helper to update specific setting
  const toggleSetting = (key, value) => {
      updatePrivacySettings({ [key]: value });
  };

  const settings = userData.privacySettings || { profileVisibility: true, hideMaps: false, dataUsage: true };

  const OptionRow = ({ label, desc, value, onValueChange }) => (
    <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
        <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
            <Text style={[styles.desc, { color: theme.colors.subText }]}>{desc}</Text>
        </View>
        <Switch 
            value={value} 
            onValueChange={onValueChange} 
            trackColor={{ true: theme.colors.accent, false: '#333' }} 
        />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.colors.text }]}>Privacy Controls</Text>
            <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.sectionTitle, { color: theme.colors.accent }]}>PROFILE & ACTIVITIES</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
                <OptionRow 
                    label="Public Profile" 
                    desc="Allow everyone to see your profile and achievements."
                    value={settings.profileVisibility}
                    onValueChange={(val) => toggleSetting('profileVisibility', val)}
                />
                <OptionRow 
                    label="Hide Activity Maps" 
                    desc="Hide your GPS route on public feeds."
                    value={settings.hideMaps}
                    onValueChange={(val) => toggleSetting('hideMaps', val)}
                />
            </View>

            <Text style={[styles.sectionTitle, { color: theme.colors.accent }]}>DATA</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
                <OptionRow 
                    label="Data Usage" 
                    desc="Allow Ruvo to use your data for analytics."
                    value={settings.dataUsage}
                    onValueChange={(val) => toggleSetting('dataUsage', val)}
                />
            </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 18, fontFamily: 'Poppins_700Bold' },
  content: { padding: 20 },
  sectionTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold', marginBottom: 10, marginTop: 10 },
  card: { borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  label: { fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
  desc: { fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 4 }
});