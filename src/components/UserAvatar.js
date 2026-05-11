import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const ACCENT = '#CCFF00';

// Deterministic colour from a name/uid string so every user gets a consistent hue
const PALETTE = [
  '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB',
  '#1DD1A1', '#54A0FF', '#5F27CD', '#C8D6E5',
];
function colorFor(str) {
  if (!str) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initial(name) {
  if (!name) return '?';
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase();
}

/**
 * UserAvatar
 *
 * Props:
 *   uri      – avatar URL (null/undefined shows initials)
 *   name     – display name (used for initial + colour seed)
 *   size     – diameter in px (default 40)
 *   style    – extra container style
 *   borderColor – border colour (default none)
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
  const showImage = !!uri && !failed;
  const bg = colorFor(name);
  const radius = size / 2;
  const fontSize = size * 0.4;

  const containerStyle = [
    styles.base,
    {
      width: size,
      height: size,
      borderRadius: radius,
      backgroundColor: showImage ? 'transparent' : bg,
      borderColor: borderColor || 'transparent',
      borderWidth,
    },
    style,
  ];

  return (
    <View style={containerStyle}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: radius }}
          contentFit="cover"
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
          transition={200}
        />
      ) : (
        <Text style={[styles.letter, { fontSize, lineHeight: size }]}>
          {initial(name)}
        </Text>
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
});
