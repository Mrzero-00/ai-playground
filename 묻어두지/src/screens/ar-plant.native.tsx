import { ViroAmbientLight, ViroARPlaneSelector, ViroARScene, ViroARSceneNavigator, ViroImage, ViroNode, ViroTrackingStateConstants } from '@reactvision/react-viro';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, IconButton, Tag } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke, offsetShadow } from '@/constants/theme';
import type { Capsule } from '@/domain/capsule';
import { useCapsuleStore } from '@/state/capsule-store';

type SceneProps = { sceneNavigator: { viroAppProps: { onPlaced: () => void; onTracking: (ok: boolean) => void } } };

/** Viro는 씬에 sceneNavigator를 넘기지만 타입은 인자 없는 함수로 선언돼 있어 선택 인자로 받는다. */
function PlantScene(props?: SceneProps) {
  const { onPlaced, onTracking } = props?.sceneNavigator.viroAppProps ?? { onPlaced: () => {}, onTracking: () => {} };
  return (
    <ViroARScene
      onTrackingUpdated={(state) => onTracking(state === ViroTrackingStateConstants.TRACKING_NORMAL)}>
      <ViroAmbientLight color="#FFFFFF" intensity={900} />
      <ViroARPlaneSelector alignment="Horizontal" minWidth={0.3} minHeight={0.3} onPlaneSelected={() => onPlaced()}>
        <ViroNode position={[0, 0.18, 0]} transformBehaviors={['billboardY']}>
          <ViroImage source={require('../../assets/capsule/capsule-closed.png')} width={0.42} height={0.42} />
        </ViroNode>
      </ViroARPlaneSelector>
    </ViroARScene>
  );
}

type GpsState = { status: 'idle' | 'loading' | 'ready' | 'error'; latitude?: number; longitude?: number; accuracy?: number | null; message?: string };

export function ArPlantScreen({ capsule }: { capsule: Capsule }) {
  const { plantCapsule } = useCapsuleStore();
  const [tracking, setTracking] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [label, setLabel] = useState(capsule.location?.label ?? '');
  const [gps, setGps] = useState<GpsState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setGps({ status: 'loading' });
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        if (!cancelled) setGps({ status: 'error', message: '위치 권한이 꺼져 있어요. 설정에서 허용해 주세요.' });
        return;
      }
      try {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!cancelled) setGps({ status: 'ready', latitude: current.coords.latitude, longitude: current.coords.longitude, accuracy: current.coords.accuracy });
      } catch {
        if (!cancelled) setGps({ status: 'error', message: '현재 위치를 찾지 못했어요. 하늘이 보이는 곳에서 다시 시도해 주세요.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canPlant = placed && gps.status === 'ready' && label.trim().length > 0;

  function plant() {
    if (!canPlant || gps.latitude === undefined || gps.longitude === undefined) return;
    void plantCapsule(capsule.id, { latitude: gps.latitude, longitude: gps.longitude, accuracy: gps.accuracy ?? null, label: label.trim(), plantedAt: new Date().toISOString() });
    router.back();
  }

  return (
    <View style={styles.root}>
      <ViroARSceneNavigator
        autofocus
        initialScene={{ scene: PlantScene }}
        viroAppProps={{ onPlaced: () => setPlaced(true), onTracking: setTracking }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.top} pointerEvents="box-none">
          <IconButton name="close" label="닫기" onPress={() => router.back()} />
          <Tag tone={gps.status === 'ready' ? 'mint' : 'white'} label={gps.status === 'ready' ? `오차 ${Math.round(gps.accuracy ?? 0)}m` : gps.status === 'loading' ? '위치 찾는 중' : '위치 없음'} />
          <Tag tone="yellow" label="2차 · 실험" />
        </View>
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>{!tracking ? '바닥이 보이게 천천히 움직여 주세요' : placed ? '여기에 캡슐을 둘게요' : '바닥을 찾았어요 · 탭해서 자리를 정해요'}</Text>
        </View>
        <View style={styles.sheet}>
          <Text style={styles.label}>이 자리 이름</Text>
          <TextInput value={label} onChangeText={setLabel} placeholder="사계리 해안도로 주차장 입구" placeholderTextColor={Colors.faint} style={styles.input} />
          <Body size={12}>친구들이 보는 이름이에요. 정확한 위치는 참여한 친구에게만 보여요.</Body>
          {gps.status === 'error' && (
            <View style={styles.error}>
              <Text style={styles.errorText}>{gps.message}</Text>
              <Button compact tone="secondary" label="설정 열기" onPress={() => Linking.openSettings()} />
            </View>
          )}
          <Button label="여기에 심기" icon="arrow" onPress={plant} disabled={!canPlant} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.ink },
  overlay: { flex: 1, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: Spacing.sm },
  hint: { alignItems: 'center' },
  hintText: { fontFamily: Fonts.display, fontSize: 16, color: Colors.ink, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink, borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 10, overflow: 'hidden' },
  sheet: { backgroundColor: Colors.cream, borderTopWidth: Stroke.regular, borderTopColor: Colors.ink, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.sm },
  label: { fontFamily: Fonts.display, fontSize: 15, color: Colors.ink },
  input: { minHeight: 52, borderRadius: Radius.md, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink, paddingHorizontal: Spacing.lg, fontFamily: Fonts.body, fontSize: 15, color: Colors.ink, ...offsetShadow(3) },
  error: { gap: Spacing.sm, alignItems: 'flex-start', padding: Spacing.md, borderRadius: Radius.sm, backgroundColor: Colors.white, borderWidth: Stroke.thin, borderColor: Colors.coral },
  errorText: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 20, color: Colors.ink },
});
