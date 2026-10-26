import { useCameraPermissions } from 'expo-camera';
import React, { Component, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, NativeModules, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ViroARPlaneSelector } from '@reactvision/react-viro';

import type { CapsuleARProps } from '@/components/capsule-ar.types';
import { Colors, Radius, Spacing } from '@/constants/theme';

type ViroModule = typeof import('@reactvision/react-viro');
type ARStatus = { tracking: boolean; selected: boolean; detected: boolean };
const INITIAL_STATUS: ARStatus = { tracking: false, selected: false, detected: false };

/** Load Viro only after checking native linkage; Expo Go must remain usable. */
async function loadSupportedAR(): Promise<ViroModule> {
  if (!NativeModules.VRTARSceneNavigatorModule || (Platform.OS === 'ios' && !NativeModules.VRTARUtils)) {
    throw new Error('AR 기능이 포함된 개발 빌드가 필요해요. Expo Go에서는 AR을 실행할 수 없어요.');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the native check so Expo Go still boots
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
      doojiCapsuleBody: { lightingModel: 'Blinn', diffuseColor: '#FFFDF8', shininess: 0.4 },
      doojiCapsuleLid: { lightingModel: 'Blinn', diffuseColor: '#F4C95D', shininess: 0.35 },
      doojiCapsuleBand: { lightingModel: 'Blinn', diffuseColor: '#4D3428', shininess: 0.2 },
      doojiGround: { lightingModel: 'Constant', diffuseColor: 'rgba(244, 201, 93, 0.45)', blendMode: 'Alpha', cullMode: 'None', writesToDepthBuffer: false },
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
        onAnchorRemoved={(anchor) => { if (anchor) selector.current?.handleAnchorRemoved(anchor); }}>
        <ViroAmbientLight color="#FFFFFF" intensity={650} />
        <ViroDirectionalLight color="#FFF0D4" direction={[0, -1, -0.5]} intensity={550} />
        <ViroARPlaneSelector
          ref={selector}
          alignment="Horizontal"
          minWidth={0.25}
          minHeight={0.25}
          hideOverlayOnSelection
          useActualShape
          material="doojiGround"
          onPlaneDetected={() => { report({ detected: true }); return true; }}
          onPlaneSelected={(anchor) => { selectedAnchor.current = anchor.anchorId; report({ selected: true }); }}
          onPlaneRemoved={(anchorId) => {
            if (selectedAnchor.current === anchorId) { selectedAnchor.current = null; report({ selected: false }); }
          }}>
          {/* The jar from capsule-art, as blocks: cream body, dark band, yellow lid. */}
          <ViroNode position={[0, 0.13, 0]}>
            <ViroSphere radius={0.17} scale={[1.35, 0.75, 0.8]} materials={['doojiCapsuleBody']} />
            <ViroBox width={0.055} height={0.24} length={0.25} materials={['doojiCapsuleBand']} />
            <ViroSphere radius={0.09} position={[0, 0.1, 0]} scale={[1.3, 0.45, 0.8]} materials={['doojiCapsuleLid']} />
          </ViroNode>
        </ViroARPlaneSelector>
      </ViroARScene>
    );
  };
}

function ARSession({ title, busy = false, actionAllowed = true, gateHint, onAction }: CapsuleARProps) {
  const [permission, requestPermission, refreshPermission] = useCameraPermissions();
  // The scene factory closes over refs, so it is built where the module loads, not during render.
  const [viro, setViro] = useState<{ module: ViroModule; Scene: () => React.JSX.Element } | null>(null);
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
  const rescan = useCallback(() => { report(INITIAL_STATUS); setSession((value) => value + 1); }, [report]);

  useEffect(() => {
    mounted.current = true;
    loadSupportedAR()
      .then((module) => { if (mounted.current) setViro({ module, Scene: makeCapsuleScene(module, report) }); })
      .catch((cause: unknown) => {
        if (mounted.current) setError(cause instanceof Error ? cause.message : '이 기기에서 AR을 시작할 수 없어요. 지원 기기와 카메라 권한을 확인한 뒤 다시 시도해 주세요.');
      });
    return () => { mounted.current = false; };
  }, [report]);

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
  if (!viro || !permission) return <Notice title="두지가 땅을 살피는 중" body="이 기기의 AR 지원 여부와 카메라 권한을 확인해요." loading />;
  if (!permission.granted) {
    return (
      <Notice title="카메라로 캡슐을 찾아요" body="바닥을 인식하고 캡슐을 놓으려면 카메라 접근이 필요해요. AR 화면은 저장하거나 서버로 보내지 않아요.">
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          onPress={() => {
            const request = permission.canAskAgain ? requestPermission() : Linking.openSettings();
            void request.catch(() => setError('카메라 권한을 요청할 수 없어요. 설정에서 카메라 접근을 허용해 주세요.'));
          }}>
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
      ? actionAllowed ? '찾았다! 캡슐이 여기 있어요' : '캡슐이 보이지만 아직 열 수 없어요'
      : status.detected ? '노란 바닥을 눌러주세요' : '평평한 바닥을 찾고 있어요';

  return (
    <View style={styles.fill}>
      {active && (
        <viro.module.ViroARSceneNavigator key={session} initialScene={{ scene: viro.Scene }} style={styles.fill} autofocus worldAlignment="Gravity" />
      )}
      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View pointerEvents="none" style={styles.topCard}>
          <Text style={styles.eyebrow}>캡슐을 찾는 중</Text>
          <Text style={styles.capsuleTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.smallText}>바닥 인식 {status.detected ? '●' : '○'}  ·  자리 선택 {status.selected ? '●' : '○'}</Text>
        </View>
        <View style={styles.bottomCard}>
          <Text accessibilityLiveRegion="polite" style={styles.prompt}>{prompt}</Text>
          {gateHint && <Text accessibilityLiveRegion="polite" style={styles.help}>{gateHint}</Text>}
          {!gateHint && (
            <Text style={styles.help}>
              {status.selected
                ? '선택한 바닥 위에 캡슐이 나타나요. 묻었던 그 자리가 아니라 지금 보이는 바닥에 다시 놓아요.'
                : '밝은 곳에서 휴대폰을 천천히 움직여주세요. 무늬가 있는 바닥이나 테이블이 인식하기 쉬워요.'}
            </Text>
          )}
          {actionError && <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text>}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready, busy: working }} disabled={!ready} onPress={() => void performAction()} style={({ pressed }) => [styles.primary, !ready && styles.disabled, pressed && styles.pressed]}>
            {working ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryText}>캡슐 열기</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" disabled={working} onPress={rescan} style={styles.secondary}>
            <Text style={styles.secondaryText}>바닥 다시 찾기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Notice({ title, body, loading, children }: { title: string; body: string; loading?: boolean; children?: ReactNode }) {
  return (
    <View style={styles.notice}>
      {loading && <ActivityIndicator size="large" color={Colors.yellow} />}
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeBody}>{body}</Text>
      {children}
    </View>
  );
}

class ARErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <Notice title="AR 화면을 불러오지 못했어요" body="화면을 닫고 다시 시도해 주세요. AR은 지원하는 실기기의 개발 빌드에서 확인할 수 있어요." />
      : this.props.children;
  }
}

export function CapsuleAR(props: CapsuleARProps) {
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
  container: { flex: 1, backgroundColor: Colors.earthDark },
  fill: { flex: 1 },
  overlay: { ...{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, justifyContent: 'space-between' },
  topCard: { marginTop: 62, marginHorizontal: 20, alignSelf: 'flex-start', maxWidth: '85%', borderRadius: Radius.md, padding: Spacing.md, gap: 6, backgroundColor: 'rgba(39,36,31,0.86)' },
  eyebrow: { color: Colors.yellow, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  capsuleTitle: { color: Colors.white, fontSize: 20, fontWeight: '900' },
  smallText: { color: '#EDE8DF', fontSize: 12, fontWeight: '700' },
  bottomCard: { margin: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.earthDark, padding: Spacing.lg, gap: 13 },
  prompt: { fontSize: 22, fontWeight: '900', color: Colors.ink, letterSpacing: -0.5 },
  help: { fontSize: 14, lineHeight: 21, color: Colors.muted },
  primary: { minHeight: 54, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: Colors.white, fontSize: 16, fontWeight: '900' },
  disabled: { backgroundColor: '#B9AB9C' },
  pressed: { opacity: 0.72 },
  secondary: { alignItems: 'center', padding: Spacing.sm },
  secondaryText: { color: Colors.earth, fontSize: 13, fontWeight: '800' },
  error: { color: Colors.warning, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  notice: { flex: 1, justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  noticeTitle: { color: Colors.white, fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  noticeBody: { color: '#E8D4B7', fontSize: 16, lineHeight: 26 },
  closeLayer: { ...{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, alignItems: 'flex-end' },
  close: { marginTop: 10, marginRight: 20, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, backgroundColor: 'rgba(39,36,31,0.9)' },
  closeText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
});
