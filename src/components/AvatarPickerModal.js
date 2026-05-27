import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';
import { PRESET_AVATARS } from './UserAvatar';

const { width: SCREEN_W } = Dimensions.get('window');
const COLS = 4;
const GAP = 12;
const H_PAD = 24;
const AVATAR_SIZE = (SCREEN_W - H_PAD * 2 - GAP * (COLS - 1)) / COLS;
const ACCENT = '#CCFF00';

export default function AvatarPickerModal({ visible, currentUri, onSelect, onClose }) {
    const initialId = currentUri?.startsWith('ruvo-avatar-')
        ? parseInt(currentUri.replace('ruvo-avatar-', ''), 10)
        : null;

    const [selected, setSelected] = useState(initialId);
    const [saving, setSaving] = useState(false);

    // Sync selection whenever the modal opens or the avatar changes externally
    useEffect(() => {
        if (visible) {
            const id = currentUri?.startsWith('ruvo-avatar-')
                ? parseInt(currentUri.replace('ruvo-avatar-', ''), 10)
                : null;
            setSelected(id);
            setSaving(false);
        }
    }, [visible, currentUri]);

    const handleSave = async () => {
        if (selected === null) { onClose(); return; }
        lightTap();
        setSaving(true);
        try {
            await onSelect(`ruvo-avatar-${selected}`);
            successFeedback();
            onClose();
        } catch {
            errorFeedback();
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

                <View style={styles.sheet}>
                    <View style={styles.handle} />

                    <Text style={styles.title}>Choose Your Avatar</Text>
                    <Text style={styles.subtitle}>Pick your runner identity</Text>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.grid}
                    >
                        {PRESET_AVATARS.map(avatar => {
                            const isSelected = selected === avatar.id;
                            return (
                                <TouchableOpacity
                                    key={avatar.id}
                                    activeOpacity={0.75}
                                    style={styles.avatarCell}
                                    onPress={() => { lightTap(); setSelected(avatar.id); }}
                                >
                                    {/* Glow ring when selected */}
                                    {isSelected && <View style={[styles.glowRing, { width: AVATAR_SIZE + 8, height: AVATAR_SIZE + 8, borderRadius: (AVATAR_SIZE + 8) / 2 }]} />}

                                    <LinearGradient
                                        colors={avatar.gradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={[
                                            styles.avatarCircle,
                                            { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
                                            isSelected && styles.avatarCircleSelected,
                                        ]}
                                    >
                                        <Ionicons
                                            name={avatar.icon}
                                            size={AVATAR_SIZE * 0.42}
                                            color="rgba(0,0,0,0.65)"
                                        />
                                    </LinearGradient>

                                    {isSelected && (
                                        <View style={styles.checkBadge}>
                                            <Ionicons name="checkmark" size={9} color="#000" />
                                        </View>
                                    )}

                                    <Text style={[styles.avatarLabel, isSelected && styles.avatarLabelActive]}>
                                        {avatar.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={[styles.saveBtn, (!selected || saving) && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={!selected || saving}
                    >
                        {saving
                            ? <ActivityIndicator color="#000" />
                            : (
                                <>
                                    <Ionicons name="checkmark-circle" size={18} color="#000" style={{ marginRight: 6 }} />
                                    <Text style={styles.saveBtnText}>Apply Avatar</Text>
                                </>
                            )
                        }
                    </TouchableOpacity>

                    <TouchableOpacity activeOpacity={0.7} style={styles.cancelBtn} onPress={onClose}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.75)',
    },
    backdrop: { flex: 1 },
    sheet: {
        backgroundColor: '#0E0E0E',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: H_PAD,
        paddingTop: 16,
        paddingBottom: 44,
        borderTopWidth: 1,
        borderColor: '#1E1E1E',
        maxHeight: '88%',
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#333',
        alignSelf: 'center',
        marginBottom: 22,
    },
    title: {
        color: '#FFF',
        fontSize: 20,
        fontFamily: 'Poppins_700Bold',
        textAlign: 'center',
    },
    subtitle: {
        color: '#555',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 4,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: GAP,
        paddingVertical: 20,
    },
    avatarCell: {
        alignItems: 'center',
        width: AVATAR_SIZE,
        position: 'relative',
    },
    glowRing: {
        position: 'absolute',
        top: -4,
        left: -4,
        borderWidth: 2,
        borderColor: ACCENT,
        opacity: 0.5,
    },
    avatarCircle: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarCircleSelected: {
        borderWidth: 2.5,
        borderColor: ACCENT,
    },
    checkBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: ACCENT,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#0E0E0E',
    },
    avatarLabel: {
        color: '#444',
        fontSize: 10,
        fontFamily: 'Poppins_500Medium',
        marginTop: 7,
    },
    avatarLabelActive: { color: ACCENT },
    saveBtn: {
        backgroundColor: ACCENT,
        paddingVertical: 15,
        borderRadius: 30,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 4,
    },
    saveBtnDisabled: { opacity: 0.45 },
    saveBtnText: {
        color: '#000',
        fontSize: 15,
        fontFamily: 'Poppins_700Bold',
    },
    cancelBtn: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    cancelText: {
        color: '#555',
        fontSize: 14,
        fontFamily: 'Poppins_500Medium',
    },
});
