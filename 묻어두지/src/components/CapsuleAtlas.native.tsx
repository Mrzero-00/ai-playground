import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import type { CapsuleAtlasProps } from './CapsuleAtlas.types';
import FloatingCapsule from './FloatingCapsule.native';
import { capsuleCountdown } from '../lib/capsuleCountdown';
import { mapOrientation } from '../lib/mapPresentation';
import { colors as C } from '../theme';

export default function CapsuleAtlas({ capsules, fix, center, recenterKey, bottomInset, active, now, perspective, onSelect }: CapsuleAtlasProps) {
  const map = useRef<MapView>(null);
  const bob = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let disposed = false;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (!disposed) setReduceMotion(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => { disposed = true; motion.remove(); app.remove(); };
  }, []);
  const hasCapsules = capsules.length > 0;
  const orientation = mapOrientation(perspective);
  const camera = { center, pitch: orientation.pitch, heading: (orientation.bearing + 360) % 360, altitude: hasCapsules ? 650 : 1100, zoom: hasCapsules ? 17.4 : 16.7 };
  useEffect(() => {
    if (!active || !foreground || reduceMotion || !hasCapsules) { bob.setValue(0); return; }
    // One shared animation, not one timer per marker. Stop it behind other screens.
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => { animation.stop(); bob.setValue(0); };
  }, [active, foreground, reduceMotion, hasCapsules, bob]);
  useEffect(() => {
    map.current?.animateCamera(camera, { duration: reduceMotion ? 0 : 400 });
  }, [center.latitude, center.longitude, recenterKey, hasCapsules, perspective, reduceMotion]);
  if (Platform.OS === 'android' && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return <View style={[s.fallback, { paddingBottom: bottomInset + 20 }]}>
      <Text style={s.title}>지도를 연결할 준비 중이에요</Text>
      <Text style={s.hint}>Android 지도 키가 필요해요. 아래 목록과 AR 기능은 그대로 사용할 수 있어요.</Text>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`geo:${center.latitude},${center.longitude}?q=${center.latitude},${center.longitude}`)}><Text style={s.link}>지도 앱에서 보기 ↗</Text></Pressable>
    </View>;
  }
  return <MapView ref={map} style={StyleSheet.absoluteFill} initialCamera={camera}
    onMapReady={() => map.current?.setCamera(camera)} mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'} showsBuildings={false}
    mapPadding={{ top: 94, bottom: bottomInset + 10, left: 15, right: 15 }} showsUserLocation={false} showsMyLocationButton={false}
    showsCompass={false} showsPointsOfInterests={false} toolbarEnabled={false} rotateEnabled={false} pitchEnabled={active}
    scrollEnabled={active} zoomEnabled={active}>
    {fix && <><Circle center={fix} radius={Math.min(fix.accuracy, 500)} fillColor="rgba(49,108,133,.1)" strokeColor="rgba(49,108,133,.25)"/>
      <Marker coordinate={fix} title="마지막으로 확인한 내 위치"><View style={s.myLocation}/></Marker></>}
    {capsules.map(capsule => {
      const countdown = capsuleCountdown(capsule, now);
      return <Marker key={capsule.id} coordinate={capsule} title={capsule.title}
        anchor={{ x: .5, y: 163 / 174 }} centerOffset={{ x: 0, y: -76 }}
        flat={false}
        tracksViewChanges={active && foreground} tracksInfoWindowChanges={false}
        accessibilityRole="button" accessibilityLabel={`${capsule.title}, ${countdown.text}, 지도에서 캡슐 보기`} onPress={() => onSelect(capsule)}>
        <FloatingCapsule capsule={capsule} countdown={countdown} bob={bob}/>
      </Marker>;
    })}
  </MapView>;
}
const s = StyleSheet.create({
  myLocation: { width: 19, height: 19, borderRadius: 10, borderWidth: 3, borderColor: '#fff', backgroundColor: C.primary },
  fallback: { flex: 1, backgroundColor: C.sky, justifyContent: 'center', paddingHorizontal: 30, gap: 10 },
  title: { color: C.ink, fontWeight: '700', fontSize: 17 }, hint: { color: C.muted, fontSize: 13, lineHeight: 22 }, link: { color: C.primary, paddingVertical: 12 },
});
