import { colors as C } from '../theme';
import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  NativeModules,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import type { ViroARPlaneSelector } from '@reactvision/react-viro';
import type { CapsuleARProps } from './CapsuleAR.types';

type ViroModule = typeof import('@reactvision/react-viro');
type ARStatus = { tracking: boolean; selected: boolean; detected: boolean };
const INITIAL_STATUS: ARStatus = { tracking: false, selected: false, detected: false };

/** Load Viro only after checking native linkage; Expo Go must remain usable. */
async function loadSupportedAR(): Promise<ViroModule> {
  if (!NativeModules.VRTARSceneNavigatorModule || (Platform.OS === 'ios' && !NativeModules.VRTARUtils)) {
    throw new Error('AR 기능이 포함된 개발 빌드가 필요해요. Expo Go에서는 AR을 실행할 수 없어요.');
  }
  const viro: ViroModule = require('@reactvision/react-viro');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const support = await Promise.race([
      viro.isARSupportedOnDevice(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('AR 지원 여부 확인이 늦어지고 있어요. 화면을 닫고 다시 시도해 주세요.')), 10_000);
      }),
    ]);
    if (!support.isARSupported) {
      throw new Error('이 기기에서는 AR을 지원하지 않아요. AR을 지원하는 iPhone 또는 Android 실기기가 필요해요.');
    }
    viro.ViroMaterials.createMaterials({
      mudCapsuleBody: { lightingModel: 'Blinn', diffuseColor: '#B4D6E4', shininess: 0.45 },
      mudCapsuleBand: { lightingModel: 'Blinn', diffuseColor: '#316C85', shininess: 0.25 },
      mudCapsuleSeal: { lightingModel: 'Blinn', diffuseColor: '#F3DEC6', shininess: 0.3 },
      mudCapsulePlane: { lightingModel: 'Constant', diffuseColor: 'rgba(151, 203, 224, 0.4)', blendMode: 'Alpha', cullMode: 'None', writesToDepthBuffer: false },
    });
    return viro;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function makeCapsuleScene(viro: ViroModule, report: (update: Partial<ARStatus>) => void) {
  const { ViroARScene, ViroARPlaneSelector, ViroAmbientLight, ViroDirectionalLight, ViroSphere, ViroBox, ViroNode } = viro;

  return function CapsuleScene() {
    const selector = useRef<ViroARPlaneSelector>(null);
    const selectedAnchor = useRef<string | null>(null);

    return (
      <ViroARScene
        anchorDetectionTypes={['PlanesHorizontal']}
        onTrackingUpdated={(state) => report({ tracking: state === viro.ViroTrackingStateConstants.TRACKING_NORMAL })}
        onAnchorFound={(anchor) => selector.current?.handleAnchorFound(anchor)}
        onAnchorUpdated={(anchor) => selector.current?.handleAnchorUpdated(anchor)}
        onAnchorRemoved={(anchor) => {
          if (anchor) selector.current?.handleAnchorRemoved(anchor);
        }}
      >
        <ViroAmbientLight color="#FFFFFF" intensity={650} />
        <ViroDirectionalLight color="#FFF0D4" direction={[0, -1, -0.5]} intensity={550} />
        <ViroARPlaneSelector
          ref={selector}
          alignment="Horizontal"
          minWidth={0.25}
          minHeight={0.25}
          hideOverlayOnSelection
          useActualShape
          material="mudCapsulePlane"
          onPlaneDetected={() => {
            report({ detected: true });
            return true;
          }}
          onPlaneSelected={(anchor) => {
            selectedAnchor.current = anchor.anchorId;
            report({ selected: true });
          }}
          onPlaneRemoved={(anchorId) => {
            if (selectedAnchor.current === anchorId) {
              selectedAnchor.current = null;
              report({ selected: false });
            }
          }}
        >
          <ViroNode position={[0, 0.13, 0]}>
            <ViroSphere radius={0.17} scale={[1.35, 0.75, 0.8]} materials={['mudCapsuleBody']} />
            <ViroBox width={0.055} height={0.24} length={0.25} materials={['mudCapsuleBand']} />
            <ViroSphere radius={0.043} position={[0, 0.04, 0.13]} scale={[1, 1, 0.3]} materials={['mudCapsuleSeal']} />
          </ViroNode>
        </ViroARPlaneSelector>
      </ViroARScene>
    );
  };
}

function ARSession({ mode, title, busy = false, actionAllowed = true, participationHint, onAction }: CapsuleARProps) {
  const [permission, requestPermission, refreshPermission] = useCameraPermissions();
  const [viro, setViro] = useState<ViroModule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState(0);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const actionLock = useRef(false);
  const liveStatus = useRef(INITIAL_STATUS);
  const mounted = useRef(true);

  const report = useCallback((update: Partial<ARStatus>) => {
    liveStatus.current = { ...liveStatus.current, ...update };
    if (mounted.current) setStatus(liveStatus.current);
  }, []);
  const rescan = useCallback(() => {
    report(INITIAL_STATUS);
    setSession((value) => value + 1);
  }, [report]);

  useEffect(() => {
    mounted.current = true;
    loadSupportedAR()
      .then((module) => { if (mounted.current) setViro(module); })
      .catch((cause: unknown) => {
        if (mounted.current) setError(cause instanceof Error && cause.message.includes('요')
          ? cause.message
          : '이 기기에서 AR을 시작할 수 없어요. 지원 기기와 카메라 권한을 확인한 뒤 다시 시도해 주세요.');
      });
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const foreground = nextState === 'active';
      setActive(foreground);
      if (!foreground) {
        report({ tracking: false, selected: false });
      } else {
        void refreshPermission().catch(() => setError('카메라 권한을 확인할 수 없어요. 화면을 닫고 다시 시도해 주세요.'));
        rescan();
      }
    });
    return () => subscription.remove();
  }, [refreshPermission, report, rescan]);

  const Scene = useMemo(() => viro ? makeCapsuleScene(viro, report) : null, [viro, report]);
  const performAction = async () => {
    if (actionLock.current || busy || !actionAllowed || !active || !liveStatus.current.tracking || !liveStatus.current.selected) return;
    actionLock.current = true;
    setSubmitting(true);
    setActionError(null);
    try {
      await onAction();
    } catch (cause) {
      if (mounted.current) setActionError(cause instanceof Error ? cause.message : '요청을 완료하지 못했어요. 다시 시도해 주세요.');
    } finally {
      actionLock.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };

  if (error) return <Notice title="AR을 시작할 수 없어요" body={error} />;
  if (!viro || !permission) return <Notice title="AR을 준비하고 있어요" body="이 기기의 AR 지원 여부와 카메라 권한을 확인해요." loading />;
  if (!permission.granted) {
    return (
      <Notice title="카메라로 캡슐을 만나요" body="바닥을 인식하고 캡슐을 놓으려면 카메라 접근이 필요해요. AR 화면은 저장하거나 서버로 보내지 않아요.">
        <Pressable
          accessibilityRole="button"
          style={styles.primary}
          onPress={() => {
            const request = permission.canAskAgain ? requestPermission() : Linking.openSettings();
            void request.catch(() => setError('카메라 권한을 요청할 수 없어요. 설정에서 카메라 접근을 허용해 주세요.'));
          }}
        >
          <Text style={styles.primaryText}>{permission.canAskAgain ? '카메라 허용하기' : '설정 열기'}</Text>
        </Pressable>
      </Notice>
    );
  }
  const working = busy || submitting;
  const ready = status.tracking && status.selected && active && !working && actionAllowed;
  const prompt = !status.tracking
    ? '주변을 천천히 비춰주세요'
    : status.selected
      ? mode === 'bury' ? '좋아, 여기에 묻어둘까요?' : '기다리던 캡슐을 찾았어요'
      : status.detected ? '하늘색 바닥을 눌러주세요' : '평평한 바닥을 찾고 있어요';

  return (
    <View style={styles.fill}>
      {active && Scene && (
        <viro.ViroARSceneNavigator key={session} initialScene={{ scene: Scene }} style={styles.fill} autofocus worldAlignment="Gravity" provider="none" />
      )}
      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View pointerEvents="none" style={styles.topCard}>
          <Text style={styles.eyebrow}>{mode === 'bury' ? '추억을 묻는 중' : '추억을 찾는 중'}</Text>
          <Text style={styles.capsuleTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.smallText}>바닥 인식 {status.tracking ? '●' : '○'}  ·  장소 선택 {status.selected ? '●' : '○'}</Text>
        </View>
        <View style={styles.bottomCard}>
          <Text accessibilityLiveRegion="polite" style={styles.prompt}>{prompt}</Text>
          {participationHint && <Text accessibilityLiveRegion="polite" style={styles.help}>{participationHint}</Text>}
          <Text style={styles.help}>
            {status.selected
              ? '선택한 바닥 위에 캡슐이 나타나요. 이 테스트에서는 방문한 장소의 바닥에 새로 배치해요.'
              : '밝은 곳에서 휴대폰을 천천히 움직여주세요. 무늬가 있는 바닥이나 테이블이 인식하기 쉬워요.'}
          </Text>
          {actionError && <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text>}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready, busy: working }} disabled={!ready} onPress={() => void performAction()} style={[styles.primary, !ready && styles.disabled]}>
            {working ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{mode === 'bury' ? '여기에 봉인하기' : '캡슐 열기'}</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" disabled={working} onPress={rescan} style={styles.secondary}>
            <Text style={styles.secondaryText}>바닥 다시 찾기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Notice({ title, body, loading, children }: { title: string; body: string; loading?: boolean; children?: React.ReactNode }) {
  return (
    <View style={styles.notice}>
      {loading && <ActivityIndicator size="large" color="#DAB77E" />}
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeBody}>{body}</Text>
      {children}
    </View>
  );
}

class ARErrorBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <Notice title="AR 화면을 불러오지 못했어요" body="화면을 닫고 다시 시도해 주세요. AR은 지원하는 실기기의 개발 빌드에서 확인할 수 있어요." />
      : this.props.children;
  }
}

export default function CapsuleAR(props: CapsuleARProps) {
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!props.busy) props.onClose(); }}>
      <View style={styles.container}>
        <ARErrorBoundary><ARSession {...props} /></ARErrorBoundary>
        <SafeAreaView pointerEvents="box-none" style={styles.closeLayer}>
          <Pressable accessibilityRole="button" accessibilityLabel="AR 닫기" disabled={props.busy} onPress={props.onClose} style={styles.close}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#243B46' },
  fill: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  topCard: { marginTop: 62, marginHorizontal: 20, alignSelf: 'flex-start', maxWidth: '85%', borderRadius: 20, padding: 16, gap: 7, backgroundColor: 'rgba(21, 40, 31, 0.88)' },
  eyebrow: { color: '#DAB77E', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  capsuleTitle: { color: '#FFF9EC', fontSize: 20, fontWeight: '700' },
  smallText: { color: '#DDEEF5', fontSize: 12 },
  bottomCard: { margin: 16, backgroundColor: C.background, borderRadius: 26, padding: 22, gap: 13 },
  prompt: { fontSize: 22, fontWeight: '700', color: C.ink },
  help: { fontSize: 14, lineHeight: 21, color: C.muted },
  primary: { minHeight: 54, padding: 16, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabled: { backgroundColor: '#9BAFB7' },
  secondary: { alignItems: 'center', padding: 8 },
  secondaryText: { color: C.primary, fontSize: 13, fontWeight: '600' },
  error: { color: C.error, fontSize: 13, lineHeight: 20 },
  notice: { flex: 1, justifyContent: 'center', padding: 32, gap: 20 },
  noticeTitle: { color: '#FFF8EC', fontSize: 26, fontWeight: '700' },
  noticeBody: { color: '#D1DEC9', fontSize: 16, lineHeight: 26 },
  closeLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'flex-end' },
  close: { marginTop: 10, marginRight: 20, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, backgroundColor: 'rgba(21, 40, 31, 0.9)' },
  closeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
