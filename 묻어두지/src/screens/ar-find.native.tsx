import { ViroAmbientLight, ViroARScene, ViroARSceneNavigator, ViroImage, ViroNode, ViroTrackingStateConstants } from '@reactvision/react-viro';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, IconButton, Tag } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke } from '@/constants/theme';
import type { Capsule } from '@/domain/capsule';
import { useCheckIn, type CheckInState } from '@/screens/use-check-in';

type SceneProps = { sceneNavigator: { viroAppProps: { visible: boolean; onTracking: (ok: boolean) => void } } };

function FindScene(props?: SceneProps) {
  const { visible, onTracking } = props?.sceneNavigator.viroAppProps ?? { visible: false, onTracking: () => {} };
  return (
    <ViroARScene onTrackingUpdated={(state) => onTracking(state === ViroTrackingStateConstants.TRACKING_NORMAL)}>
      <ViroAmbientLight color="#FFFFFF" intensity={900} />
      {visible && (
        <ViroNode position={[0, -0.35, -1.6]} transformBehaviors={['billboardY']}>
          <ViroImage source={require('../../assets/capsule/capsule-buried.png')} width={0.6} height={0.6} />
        </ViroNode>
      )}
    </ViroARScene>
  );
}

export function ArFindScreen({ capsule }: { capsule: Capsule }) {
  const [tracking, setTracking] = useState(false);
  const { state, measure, attempts } = useCheckIn(capsule.location ?? null);
  const visible = state.status === 'inside' || state.status === 'uncertain';

  return (
    <View style={styles.root}>
      <ViroARSceneNavigator autofocus initialScene={{ scene: FindScene }} viroAppProps={{ visible, onTracking: setTracking }} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.top} pointerEvents="box-none">
          <IconButton name="close" label="닫기" onPress={() => router.back()} />
          <Tag tone="white" label={capsule.title} />
          <Tag tone="yellow" label="2차 · 실험" />
        </View>
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>{!tracking ? '주변이 보이게 천천히 움직여 주세요' : visible ? '여기 어딘가에 묻혀 있어요' : '아직 자리 밖이에요'}</Text>
        </View>
        <View style={styles.sheet}>
          <StatusRow state={state} label={capsule.location?.label ?? ''} />
          {state.status === 'inside' && <Button label="여기서 체크인" onPress={() => router.replace({ pathname: '/capsule/[id]', params: { id: capsule.id } })} />}
          {state.status === 'uncertain' && <Button label={`다시 재기 (${attempts}/3)`} tone="yellow" onPress={measure} disabled={state.status === 'uncertain' && attempts >= 3} />}
          {(state.status === 'outside' || state.status === 'idle' || state.status === 'error') && <Button label="다시 재기" tone="secondary" onPress={measure} />}
          {state.status === 'loading' && <Button label="위치 재는 중…" tone="secondary" disabled />}
        </View>
      </SafeAreaView>
    </View>
  );
}

function StatusRow({ state, label }: { state: CheckInState; label: string }) {
  const dot = state.status === 'inside' ? Colors.mint : state.status === 'uncertain' ? Colors.yellow : state.status === 'outside' ? Colors.coral : Colors.white;
  const title =
    state.status === 'inside' ? '심은 자리 안이에요' : state.status === 'uncertain' ? '아직 판정하지 않았어요' : state.status === 'outside' ? '아직 자리 밖이에요' : state.status === 'error' ? '위치를 못 잡았어요' : '위치를 재는 중';
  const sub =
    state.status === 'inside' || state.status === 'outside'
      ? `거리 약 ${Math.round(state.distance)}m · 오차 ${Math.round(state.accuracy)}m · ${label}`
      : state.status === 'uncertain'
        ? `GPS 오차가 ${state.accuracy === null ? '측정 불가' : `${Math.round(state.accuracy)}m`}라 보류했어요. 하늘이 보이는 곳에서 다시 재 주세요.`
        : state.status === 'error'
          ? state.message
          : label;
  return (
    <View style={styles.statusRow}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <View style={styles.statusCopy}>
        <Text style={styles.statusTitle}>{title}</Text>
        <Text style={styles.statusSub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.ink },
  overlay: { flex: 1, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: Spacing.sm },
  hint: { alignItems: 'center' },
  hintText: { fontFamily: Fonts.display, fontSize: 16, color: Colors.ink, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink, borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 10, overflow: 'hidden' },
  sheet: { backgroundColor: Colors.cream, borderTopWidth: Stroke.regular, borderTopColor: Colors.ink, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: Stroke.thin, borderColor: Colors.ink },
  statusCopy: { flex: 1, gap: 2 },
  statusTitle: { fontFamily: Fonts.display, fontSize: 15, color: Colors.ink },
  statusSub: { fontFamily: Fonts.body, fontSize: 12, lineHeight: 18, color: Colors.muted },
});
