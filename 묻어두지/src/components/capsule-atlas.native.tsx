import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import type { CapsuleAtlasProps } from '@/components/capsule-atlas.types';
import { FLOATING_CAPSULE_SIZE, FloatingCapsule } from '@/components/floating-capsule.native';
import { googleMapStyle } from '@/constants/map-style';
import { Colors } from '@/constants/theme';
import { capsuleCountdown } from '@/lib/capsule-countdown';
import { mapOrientation } from '@/lib/map-presentation';

// Google is the agreed provider (AGENTS.md). Without a key, iOS falls back to the
// muted Apple map so the screen still works; Android cannot draw a map at all.
const hasGoogleKey = Platform.OS === 'ios' ? !!process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY : !!process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY;

export function CapsuleAtlas({ capsules, fix, center, recenterKey, bottomInset, active, now, perspective, onSelect, pin, onPick }: CapsuleAtlasProps) {
  const map = useRef<MapView>(null);
  const [bob] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let disposed = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (!disposed) setReduceMotion(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const app = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
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
    // The camera only follows explicit re-centers, never every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.latitude, center.longitude, recenterKey, hasCapsules, perspective, reduceMotion]);

  if (Platform.OS === 'android' && !hasGoogleKey) {
    return (
      <View style={[s.fallback, { paddingBottom: bottomInset + 20 }]}>
        <Text style={s.title}>지도를 연결할 준비 중이에요</Text>
        <Text style={s.hint}>Android 지도 키가 필요해요. 아래 목록과 AR 기능은 그대로 사용할 수 있어요.</Text>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`geo:${center.latitude},${center.longitude}?q=${center.latitude},${center.longitude}`)}>
          <Text style={s.link}>지도 앱에서 보기 ↗</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      provider={hasGoogleKey ? PROVIDER_GOOGLE : undefined}
      customMapStyle={hasGoogleKey ? googleMapStyle : undefined}
      initialCamera={camera}
      onMapReady={() => map.current?.setCamera(camera)}
      mapType={hasGoogleKey ? 'standard' : 'mutedStandard'}
      showsBuildings
      mapPadding={{ top: 94, bottom: bottomInset + 10, left: 15, right: 15 }}
      showsUserLocation={false} showsMyLocationButton={false} showsCompass={false}
      showsPointsOfInterests={false} toolbarEnabled={false} rotateEnabled={false}
      pitchEnabled={active} scrollEnabled={active} zoomEnabled={active}
      onPress={onPick ? (event) => onPick(event.nativeEvent.coordinate) : undefined}>
      {fix && (
        <>
          <Circle center={fix} radius={Math.min(fix.accuracy, 500)} fillColor="rgba(90,115,78,.12)" strokeColor="rgba(90,115,78,.3)" />
          <Marker coordinate={fix} title="마지막으로 확인한 내 위치"><View style={s.myLocation} /></Marker>
        </>
      )}
      {pin && (
        <>
          <Circle center={pin} radius={150} fillColor="rgba(244,201,93,.18)" strokeColor={Colors.earthDark} strokeWidth={1.5} />
          <Marker coordinate={pin} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <View style={s.pinWrap}><View style={s.pinHead}><Text style={s.pinText}>여기</Text></View><View style={s.pinLeg} /></View>
          </Marker>
        </>
      )}
      {capsules.map((capsule) => {
        const countdown = capsuleCountdown(capsule, now);
        return (
          <Marker key={capsule.id} coordinate={capsule} title={capsule.title}
            anchor={{ x: 0.5, y: FLOATING_CAPSULE_SIZE.groundY / FLOATING_CAPSULE_SIZE.height }} centerOffset={{ x: 0, y: -76 }}
            flat={false} tracksViewChanges={active && foreground} tracksInfoWindowChanges={false}
            tappable={!onPick} accessibilityRole="button" accessibilityLabel={`${capsule.title}, ${countdown.text}, 지도에서 캡슐 보기`} onPress={onPick ? undefined : () => onSelect(capsule)}>
            <FloatingCapsule capsule={capsule} countdown={countdown} bob={bob} />
          </Marker>
        );
      })}
    </MapView>
  );
}

const s = StyleSheet.create({
  myLocation: { width: 19, height: 19, borderRadius: 10, borderWidth: 3, borderColor: Colors.white, backgroundColor: Colors.leaf },
  pinWrap: { alignItems: 'center' },
  pinHead: { backgroundColor: Colors.earthDark, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  pinText: { color: Colors.yellow, fontSize: 12, fontWeight: '900' },
  pinLeg: { width: 3, height: 16, backgroundColor: Colors.earthDark, borderRadius: 2 },
  fallback: { flex: 1, backgroundColor: Colors.canvas, justifyContent: 'center', paddingHorizontal: 30, gap: 10 },
  title: { color: Colors.ink, fontWeight: '900', fontSize: 17 },
  hint: { color: Colors.muted, fontSize: 13, lineHeight: 22 },
  link: { color: Colors.earth, fontWeight: '800', paddingVertical: 12 },
});
