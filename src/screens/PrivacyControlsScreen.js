import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';

export default function PrivacyControlsScreen({ navigation }) {
  const { theme } = useTheme();
  const { userData, updatePrivacySettings, unblockUser, unmuteUser } = useUser(); // ✅ Added unmuteUser

  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);
  const [showFollowPicker, setShowFollowPicker] = useState(false);
  const [showCommentPicker, setShowCommentPicker] = useState(false);
  const [showClubsPicker, setShowClubsPicker] = useState(false);

  // Fetch display names + avatars for blocked/muted user IDs
  const [userCache, setUserCache] = useState({});
  const fetchedRef = useRef(new Set());
  useEffect(() => {
    const allIds = [...(userData.blocked || []), ...(userData.mutedUsers || [])];
    const toFetch = allIds.filter(id => !fetchedRef.current.has(id));
    if (toFetch.length === 0) return;
    toFetch.forEach(id => fetchedRef.current.add(id));
    Promise.all(toFetch.map(async id => {
      try {
        const snap = await getDoc(doc(db, 'users', id));
        if (snap.exists()) return [id, { name: snap.data().name || 'Unknown', avatar: snap.data().avatar || null }];
      } catch { }
      return [id, { name: 'Unknown', avatar: null }];
    })).then(results => {
      const updates = {};
      results.forEach(([id, data]) => { updates[id] = data; });
      setUserCache(prev => ({ ...prev, ...updates }));
    });
  }, [userData.blocked, userData.mutedUsers]);

  // Get current settings with defaults
  const settings = userData.privacySettings || {
    profileVisibility: 'public',
    showActivityOnFeed: true,
    showLocationOnMap: true,
    showStatsToOthers: true,
    whoCanFollow: 'everyone',
    whoCanComment: 'everyone',
    whoCanSeeClubs: 'everyone'
  };

  const blockedUsers = userData.blocked || [];
  const mutedUsers = userData.mutedUsers || []; // ✅ Extract muted users

  // Helper to update specific setting
  const toggleSetting = (key, value) => {
    updatePrivacySettings({ [key]: value });
  };

  const handleUnblock = (userId) => {
    Alert.alert(
      'Unblock User',
      'Are you sure you want to unblock this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unblock', style: 'destructive', onPress: () => unblockUser(userId) }
      ]
    );
  };

  const handleUnmute = (userId) => {
    Alert.alert(
      'Unmute User',
      'Are you sure you want to unmute this user? Their posts will reappear on your feed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unmute', style: 'default', onPress: () => unmuteUser(userId) }
      ]
    );
  };

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
        thumbColor="#FFF"
      />
    </View>
  );

  const SelectRow = ({ label, desc, value, options, onSelect, showPicker, setShowPicker }) => (
    <>
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: theme.colors.border }]}
        onPress={() => setShowPicker(!showPicker)}
      >
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
          <Text style={[styles.desc, { color: theme.colors.subText }]}>{desc}</Text>
        </View>
        <View style={styles.selectValue}>
          <Text style={[styles.valueText, { color: theme.colors.accent }]}>
            {value === 'public' ? 'Public' : value === 'friends' ? 'Friends Only' : value === 'private' ? 'Private' : value === 'everyone' ? 'Everyone' : value === 'nobody' ? 'Nobody' : value.charAt(0).toUpperCase() + value.slice(1)}
          </Text>
          <Ionicons name={showPicker ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
        </View>
      </TouchableOpacity>

      {showPicker && (
        <View style={[styles.pickerContainer, { backgroundColor: theme.colors.card }]}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.pickerOption}
              onPress={() => {
                onSelect(option.value);
                setShowPicker(false);
              }}
            >
              <Text style={[styles.pickerText, { color: theme.colors.text }]}>{option.label}</Text>
              {value === option.value && <Ionicons name="checkmark" size={20} color={theme.colors.accent} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
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
          {/* PROFILE VISIBILITY */}
          <Text style={[styles.sectionTitle, { color: theme.colors.accent }]}>PROFILE VISIBILITY</Text>
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <SelectRow
              label="Who can see my profile"
              desc="Control who can view your profile and achievements."
              value={settings.profileVisibility || 'public'}
              options={[
                { label: 'Public', value: 'public' },
                { label: 'Friends Only', value: 'friends' },
                { label: 'Private', value: 'private' }
              ]}
              onSelect={(val) => toggleSetting('profileVisibility', val)}
              showPicker={showVisibilityPicker}
              setShowPicker={setShowVisibilityPicker}
            />
          </View>

          {/* ACTIVITY SETTINGS */}
          <Text style={[styles.sectionTitle, { color: theme.colors.accent }]}>ACTIVITY SETTINGS</Text>
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <OptionRow
              label="Show Activity on Feed"
              desc="Allow your runs to appear on the community feed."
              value={settings.showActivityOnFeed !== false}
              onValueChange={(val) => toggleSetting('showActivityOnFeed', val)}
            />
            <OptionRow
              label="Show Location on Map"
              desc="Display your GPS route on public feeds."
              value={settings.showLocationOnMap !== false}
              onValueChange={(val) => toggleSetting('showLocationOnMap', val)}
            />
            <OptionRow
              label="Show Stats to Others"
              desc="Allow others to see your detailed statistics."
              value={settings.showStatsToOthers !== false}
              onValueChange={(val) => toggleSetting('showStatsToOthers', val)}
            />
          </View>

          {/* SOCIAL PERMISSIONS */}
          <Text style={[styles.sectionTitle, { color: theme.colors.accent }]}>SOCIAL PERMISSIONS</Text>
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <SelectRow
              label="Who can follow me"
              desc="Control who can follow your profile."
              value={settings.whoCanFollow || 'everyone'}
              options={[
                { label: 'Everyone', value: 'everyone' },
                { label: 'Friends Only', value: 'friends' },
                { label: 'Nobody', value: 'nobody' }
              ]}
              onSelect={(val) => toggleSetting('whoCanFollow', val)}
              showPicker={showFollowPicker}
              setShowPicker={setShowFollowPicker}
            />
            <SelectRow
              label="Who can comment"
              desc="Control who can comment on your runs."
              value={settings.whoCanComment || 'everyone'}
              options={[
                { label: 'Everyone', value: 'everyone' },
                { label: 'Friends Only', value: 'friends' },
                { label: 'Nobody', value: 'nobody' }
              ]}
              onSelect={(val) => toggleSetting('whoCanComment', val)}
              showPicker={showCommentPicker}
              setShowPicker={setShowCommentPicker}
            />
            <SelectRow
              label="Who can see my clubs"
              desc="Control who can see which clubs you've joined."
              value={settings.whoCanSeeClubs || 'everyone'}
              options={[
                { label: 'Everyone', value: 'everyone' },
                { label: 'Friends Only', value: 'friends' }
              ]}
              onSelect={(val) => toggleSetting('whoCanSeeClubs', val)}
              showPicker={showClubsPicker}
              setShowPicker={setShowClubsPicker}
            />
          </View>

          {/* BLOCKED USERS */}
          <Text style={[styles.sectionTitle, { color: theme.colors.accent }]}>BLOCKED USERS</Text>
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            {blockedUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="shield-checkmark-outline" size={40} color="#666" />
                <Text style={[styles.emptyText, { color: theme.colors.subText }]}>No blocked users</Text>
              </View>
            ) : (
              blockedUsers.map((userId, index) => {
                const info = userCache[userId];
                return (
                  <View
                    key={userId}
                    style={[
                      styles.blockedUserRow,
                      { borderBottomColor: theme.colors.border },
                      index === blockedUsers.length - 1 && { borderBottomWidth: 0 }
                    ]}
                  >
                    <View style={styles.blockedUserInfo}>
                      {info?.avatar ? (
                        <Image source={{ uri: info.avatar }} style={styles.blockedAvatar} />
                      ) : (
                        <View style={[styles.blockedAvatar, { justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="person" size={20} color="#666" />
                        </View>
                      )}
                      <Text style={[styles.blockedUserName, { color: theme.colors.text }]}>
                        {info ? info.name : `User ${userId.slice(0, 8)}`}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.unblockBtn} onPress={() => handleUnblock(userId)}>
                      <Text style={styles.unblockText}>Unblock</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>

          <Text style={[styles.helperText, { color: theme.colors.subText }]}>
            Blocked users cannot see your profile, follow you, or interact with your content.
          </Text>

          {/* MUTED USERS (PHASE 19) */}
          <Text style={[styles.sectionTitle, { color: theme.colors.accent, marginTop: 30 }]}>MUTED USERS</Text>
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            {mutedUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="volume-medium-outline" size={40} color="#666" />
                <Text style={[styles.emptyText, { color: theme.colors.subText }]}>No muted users</Text>
              </View>
            ) : (
              mutedUsers.map((userId, index) => {
                const info = userCache[userId];
                return (
                  <View
                    key={userId}
                    style={[
                      styles.blockedUserRow,
                      { borderBottomColor: theme.colors.border },
                      index === mutedUsers.length - 1 && { borderBottomWidth: 0 }
                    ]}
                  >
                    <View style={styles.blockedUserInfo}>
                      {info?.avatar ? (
                        <Image source={{ uri: info.avatar }} style={styles.blockedAvatar} />
                      ) : (
                        <View style={[styles.blockedAvatar, { justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="person" size={20} color="#666" />
                        </View>
                      )}
                      <Text style={[styles.blockedUserName, { color: theme.colors.text }]}>
                        {info ? info.name : `User ${userId.slice(0, 8)}`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.unblockBtn, { backgroundColor: theme.colors.border }]}
                      onPress={() => handleUnmute(userId)}
                    >
                      <Text style={[styles.unblockText, { color: theme.colors.text }]}>Unmute</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>

          <Text style={[styles.helperText, { color: theme.colors.subText }]}>
            Muted users will not appear on your feed, but they can still see your profile and interact with you.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 18, fontFamily: 'Poppins_700Bold' },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 12, fontFamily: 'Poppins_700Bold', marginBottom: 10, marginTop: 10, letterSpacing: 1 },
  card: { borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  label: { fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
  desc: { fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 4, lineHeight: 16 },
  selectValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  valueText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  pickerContainer: { paddingVertical: 8 },
  pickerOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  pickerText: { fontSize: 15, fontFamily: 'Poppins_500Medium' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, fontFamily: 'Poppins_400Regular', marginTop: 10 },
  blockedUserRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  blockedUserInfo: { flexDirection: 'row', alignItems: 'center' },
  blockedAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', marginRight: 12, overflow: 'hidden' },
  blockedUserName: { fontSize: 15, fontFamily: 'Poppins_600SemiBold' },
  unblockBtn: { backgroundColor: '#FF3B30', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 6 },
  unblockText: { color: '#FFF', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  helperText: { fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 5, lineHeight: 18, paddingHorizontal: 5 }
});