import { colors as C } from '../theme';
import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

export type CapsuleMapProps = { latitude: number; longitude: number; radius?: number; title?: string };

export default function CapsuleMap({ latitude, longitude, radius = 50, title = '캡슐을 묻은 곳' }: CapsuleMapProps) {
  if (Platform.OS === 'android' && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return <Pressable style={styles.fallback} onPress={() => Linking.openURL(`geo:${latitude},${longitude}?q=${latitude},${longitude}`)}>
      <Text style={styles.title}>{title}</Text><Text>{latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>
      <Text style={styles.link}>지도 앱에서 보기 ↗</Text>
    </Pressable>;
  }
  return <View style={styles.frame}><MapView
    style={StyleSheet.absoluteFill}
    region={{ latitude, longitude, latitudeDelta: 0.003, longitudeDelta: 0.003 }}
    scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}
    showsCompass={false} showsUserLocation={false} toolbarEnabled={false}
  >
    <Circle center={{ latitude, longitude }} radius={radius} fillColor="rgba(49,108,133,.13)" strokeColor={C.primary} strokeWidth={1}/>
    <Marker coordinate={{ latitude, longitude }} title={title} pinColor={C.primary}/>
  </MapView><View style={styles.label}><Text style={styles.labelText}>{title} · 반경 {radius}m</Text></View></View>;
}
const styles = StyleSheet.create({ frame: { height: 190, borderRadius: 22, overflow: 'hidden', backgroundColor: C.pale }, label: { position: 'absolute', bottom: 12, alignSelf: 'center', backgroundColor: '#fffdf5', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14 }, labelText: { fontSize: 11, color: C.ink }, fallback: { borderRadius: 22, backgroundColor: C.pale, padding: 24, gap: 8 }, title: { color: C.ink, fontWeight: '700' }, link: { fontSize: 12, color: C.primary, marginTop: 10 } });
