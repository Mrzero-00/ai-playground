import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

type PillProps = {
  label: string;
  tone?: 'leaf' | 'yellow' | 'earth';
};

const tones = {
  leaf: { backgroundColor: Colors.leafSoft, color: Colors.leaf },
  yellow: { backgroundColor: '#F9E8B5', color: Colors.earthDark },
  earth: { backgroundColor: '#EAD8C6', color: Colors.earthDark },
};

export function Pill({ label, tone = 'earth' }: PillProps) {
  const palette = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.label, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: 11, paddingVertical: 7 },
  label: { fontSize: 11, fontWeight: '800' },
});
