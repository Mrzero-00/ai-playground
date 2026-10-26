import { colors as C } from '../theme';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { latitude: number; longitude: number; radius?: number; title?: string };

export default function CapsuleMap({ latitude, longitude, radius = 50, title = '캡슐을 묻은 곳' }: Props) {
  return <View style={styles.frame}><View style={styles.dot}/><Text style={styles.title}>{title}</Text>
    <Text style={styles.coordinates}>{latitude.toFixed(5)} N / {longitude.toFixed(5)} E</Text>
    <Text style={styles.caption}>위치 요약 · 이 좌표에서 반경 {radius}m</Text>
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`)}><Text style={styles.link}>지도에서 위치 보기 ↗</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({ frame: { padding: 24, alignItems: 'center', borderRadius: 22, backgroundColor: C.pale, gap: 8 }, dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.primary, marginBottom: 4 }, title: { fontSize: 15, color: C.ink, fontWeight: '700' }, coordinates: { color: C.muted, fontSize: 12 }, caption: { color: C.muted, fontSize: 11 }, link: { color: C.primary, fontSize: 12, marginTop: 10, textDecorationLine: 'underline' } });
