import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const ACCENT = '#CCFF00';

const PALETTE = [
  '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB',
  '#1DD1A1', '#54A0FF', '#5F27CD', '#C8D6E5',
];

export const PRESET_AVATARS = [
  { id: 1,  gradient: ['#CCFF00', '#88BB00'], emoji: '🏃',  label: 'Runner'  },
  { id: 2,  gradient: ['#FF6B35', '#CC2200'], emoji: '🔥',  label: 'Blazer'  },
  { id: 3,  gradient: ['#00D4FF', '#0088BB'], emoji: '🌊',  label: 'Flow'    },
  { id: 4,  gradient: ['#FFD700', '#FF8C00'], emoji: '⚡',  label: 'Spark'   },
  { id: 5,  gradient: ['#00E6B4', '#00AA77'], emoji: '💪',  label: 'Power'   },
  { id: 6,  gradient: ['#9B59B6', '#5A0080'], emoji: '🌟',  label: 'Nova'    },
  { id: 7,  gradient: ['#FF3FA4', '#BB0066'], emoji: '💖',  label: 'Core'    },
  { id: 8,  gradient: ['#FFD700', '#BB8800'], emoji: '🏆',  label: 'Champ'   },
  { id: 9,  gradient: ['#5DADE2', '#1A5276'], emoji: '🦅',  label: 'Eagle'   },
  { id: 10, gradient: ['#A8B2D8', '#4A5790'], emoji: '🌙',  label: 'Lunar'   },
  { id: 11, gradient: ['#E74C3C', '#8B0000'], emoji: '🦁',  label: 'Lion'    },
  { id: 12, gradient: ['#27AE60', '#145A32'], emoji: '🐺',  label: 'Wolf'    },
  { id: 13, gradient: ['#8E44AD', '#4A235A'], emoji: '💎',  label: 'Gem'     },
  { id: 14, gradient: ['#95A5A6', '#2C3E50'], emoji: '🚀',  label: 'Orbit'   },
  { id: 15, gradient: ['#F39C12', '#784212'], emoji: '🦊',  label: 'Fox'     },
  { id: 16, gradient: ['#1ABC9C', '#0E6655'], emoji: '🐯',  label: 'Tiger'   },
];

function colorFor(str) {
  if (!str || str === 'Unknown' || str === 'Runner') return '#333';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initial(name) {
  if (!name || name === 'Unknown' || name === 'Runner') return null;
  return name.trim().charAt(0).toUpperCase();
}

/**
 * UserAvatar
 *
 * Props:
 *   uri         – avatar URL, ruvo-avatar-[id] preset, or null (shows initials)
 *   name        – display name (used for initial + colour seed)
 *   size        – diameter in px (default 40)
 *   style       – extra container style
 *   borderColor – border colour
 *   borderWidth – border width (default 0)
 */
export default function UserAvatar({
  uri,
  name,
  size = 40,
  style,
  borderColor,
  borderWidth = 0,
}) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const radius = size / 2;
  const fontSize = size * 0.4;

  const borderStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    borderColor: borderColor || 'transparent',
    borderWidth,
  };

  // Preset avatar (ruvo-avatar-N)
  if (uri && uri.startsWith('ruvo-avatar-')) {
    const avatarId = parseInt(uri.replace('ruvo-avatar-', ''), 10);
    const preset = PRESET_AVATARS.find(a => a.id === avatarId) || PRESET_AVATARS[0];
    return (
      <LinearGradient
        colors={preset.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.base, borderStyle, style]}
      >
        <Text style={{ fontSize: size * 0.52, lineHeight: size * 0.65, textAlign: 'center' }}>
          {preset.emoji}
        </Text>
      </LinearGradient>
    );
  }

  const showImage = !!uri && !failed;
  const bg = colorFor(name);
  const initials = initial(name);

  return (
    <View style={[styles.base, { ...borderStyle, backgroundColor: bg }, style]}>
      {showImage ? (
        <>
          <Image
            source={{ uri }}
            style={{ width: size, height: size, borderRadius: radius }}
            contentFit="cover"
            cachePolicy="memory-disk"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setFailed(true); setLoading(false); }}
            transition={200}
          />
          {loading && (
            <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
              <ActivityIndicator size="small" color={ACCENT} />
            </View>
          )}
        </>
      ) : initials ? (
        <Text style={[styles.letter, { fontSize, lineHeight: size }]}>
          {initials}
        </Text>
      ) : (
        <Ionicons name="person" size={size * 0.6} color="#666" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  letter: {
    color: '#000',
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
  },
  loadingOverlay: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
