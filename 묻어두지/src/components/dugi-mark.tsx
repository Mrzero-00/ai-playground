import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

type DugiMarkProps = {
  size?: number;
  mood?: 'awake' | 'sleeping';
};

export function DugiMark({ size = 96, mood = 'awake' }: DugiMarkProps) {
  const faceSize = size * 0.72;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View style={[styles.ear, styles.leftEar, { width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15 }]} />
      <View style={[styles.ear, styles.rightEar, { width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15 }]} />
      <View style={[styles.face, { width: faceSize, height: faceSize, borderRadius: faceSize / 2 }]}>
        <View style={styles.eyes}>
          <View style={[styles.eye, mood === 'sleeping' && styles.sleepingEye]} />
          <View style={[styles.eye, mood === 'sleeping' && styles.sleepingEye]} />
        </View>
        <View style={[styles.snout, { width: size * 0.36, height: size * 0.24, borderRadius: size * 0.18 }]}>
          <View style={[styles.nose, { width: size * 0.12, height: size * 0.08, borderRadius: size * 0.06 }]} />
        </View>
      </View>
      {mood === 'sleeping' && <Text style={[styles.sleep, { fontSize: size * 0.2 }]}>z</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-end' },
  ear: { position: 'absolute', top: '18%', backgroundColor: '#AC7960', borderWidth: 4, borderColor: Colors.earthDark },
  leftEar: { left: '7%' },
  rightEar: { right: '7%' },
  face: { backgroundColor: Colors.earth, borderWidth: 5, borderColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center' },
  eyes: { flexDirection: 'row', gap: 20, marginTop: 8 },
  eye: { width: 7, height: 9, borderRadius: 4, backgroundColor: Colors.ink },
  sleepingEye: { height: 3, width: 12, marginTop: 4 },
  snout: { backgroundColor: '#D1A58C', marginTop: 7, alignItems: 'center', justifyContent: 'center' },
  nose: { backgroundColor: Colors.ink },
  sleep: { position: 'absolute', right: 0, top: 0, color: Colors.leaf, fontWeight: '900' },
});
