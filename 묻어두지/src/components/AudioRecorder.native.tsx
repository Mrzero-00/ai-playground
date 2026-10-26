import { colors as C } from '../theme';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, type AudioRecorder as NativeRecorder } from 'expo-audio';
import { deleteAsync } from 'expo-file-system/legacy';
import { MAX_RECORDING_SECONDS } from '../shared/contracts';
import type { AudioRecorderProps } from './AudioRecorder.types';

type Phase = 'idle' | 'preparing' | 'recording' | 'stopping';
type Session = {
  recorder: NativeRecorder;
  prepare: Promise<void>;
  finishing: Promise<void> | null;
  subscription: { remove: () => void } | null;
  poll: ReturnType<typeof setInterval> | null;
  limit: ReturnType<typeof setTimeout> | null;
  uris: Set<string>;
  discard: boolean;
  failed: boolean;
  released: boolean;
};

const MAX_SECONDS = MAX_RECORDING_SECONDS;
const PLAYBACK_MODE = { allowsRecording: false, allowsBackgroundRecording: false, shouldPlayInBackground: false };

function timeLabel(milliseconds: number) {
  const seconds = Math.min(MAX_SECONDS, Math.max(0, Math.floor(milliseconds / 1000)));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

async function removeTemporaryRecording(uri: string) {
  if (!uri.startsWith('file://')) return;
  try { await deleteAsync(uri, { idempotent: true }); }
  catch { console.warn('임시 음성 파일을 정리하지 못했습니다.'); }
}

// A permission alert briefly makes iOS inactive. Wait for its dismissal before recording.
async function waitForForeground() {
  if (AppState.currentState === 'active') return;
  await new Promise<void>((resolve) => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') finish();
    });
    const timer = setTimeout(finish, 1500);
    function finish() { clearTimeout(timer); subscription.remove(); resolve(); }
  });
}

export default function AudioRecorder({ disabled = false, ...callbacks }: AudioRecorderProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const mounted = useRef(true);
  const phaseRef = useRef<Phase>('idle');
  const sessionRef = useRef<Session | null>(null);
  const cancelled = useRef(false);
  const callbackRef = useRef(callbacks);
  callbackRef.current = callbacks;

  function publishPhase(next: Phase) {
    phaseRef.current = next;
    if (!mounted.current) return;
    setPhase(next);
    callbackRef.current.onBusyChange?.(next !== 'idle');
  }

  function reportError(message: string) {
    if (!mounted.current) return;
    setError(message);
    callbackRef.current.onError?.(message);
  }

  function rememberURI(session: Session) {
    if (session.released) return null;
    const uri = session.recorder.uri;
    if (uri) session.uris.add(uri);
    return uri;
  }

  function finishRecording(session: Session, save: boolean, alreadyStopped = false): Promise<void> {
    if (!save) session.discard = true;
    if (session.finishing) return session.finishing;
    publishPhase('stopping');
    if (session.poll) clearInterval(session.poll);
    if (session.limit) clearTimeout(session.limit);

    session.finishing = (async () => {
      try {
        await session.prepare;
        rememberURI(session);
        if (!alreadyStopped) await session.recorder.stop();
        const uri = rememberURI(session);
        session.subscription?.remove();
        session.recorder.release();
        session.released = true;
        await setAudioModeAsync(PLAYBACK_MODE);

        if (save && !session.discard && !session.failed && mounted.current && AppState.currentState === 'active') {
          if (!uri) throw new Error('녹음 파일이 만들어지지 않았어요. 다시 녹음해 주세요.');
          // The parent reads the file here; do not unlink it while that read is in flight.
          await callbackRef.current.onRecorded(uri);
          if (mounted.current) setNotice('목소리를 담았어요.');
        }
      } catch (cause) {
        if (!session.discard) reportError(cause instanceof Error ? cause.message : '녹음을 담지 못했어요. 다시 시도해 주세요.');
      } finally {
        session.subscription?.remove();
        if (!session.released) {
          try { rememberURI(session); } catch { /* A failed native preparation can have no URI. */ }
          try { await session.recorder.stop(); } catch { /* Release also stops an unfinished recorder. */ }
          try { session.recorder.release(); } catch { /* The native media service may have reset. */ }
          session.released = true;
        }
        await setAudioModeAsync(PLAYBACK_MODE).catch(() => undefined);
        for (const uri of session.uris) await removeTemporaryRecording(uri);
        if (sessionRef.current === session) {
          sessionRef.current = null;
          publishPhase('idle');
        }
      }
    })();
    return session.finishing;
  }

  const finishRef = useRef(finishRecording);
  finishRef.current = finishRecording;

  async function startRecording() {
    if (disabled || phaseRef.current !== 'idle' || AppState.currentState !== 'active') return;
    cancelled.current = false;
    setError(null);
    setNotice(null);
    setElapsed(0);
    publishPhase('preparing');
    let session: Session | null = null;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!mounted.current || cancelled.current) return;
      if (!permission.granted) {
        setPermissionBlocked(!permission.canAskAgain);
        throw new Error('목소리를 담으려면 마이크 접근을 허용해 주세요.');
      }
      setPermissionBlocked(false);
      await waitForForeground();
      if (!mounted.current || cancelled.current || AppState.currentState !== 'active') return;
      await setAudioModeAsync({
        allowsRecording: true, allowsBackgroundRecording: false,
        shouldPlayInBackground: false, playsInSilentMode: true, interruptionMode: 'doNotMix',
      });
      if (!mounted.current || cancelled.current || AppState.currentState !== 'active') return;

      const preset = RecordingPresets.HIGH_QUALITY;
      // Expo's native constructor takes platform options flattened into the common preset.
      // Own this short-lived recorder so prepare can finish before stop/release on unmount.
      const recorder = new AudioModule.AudioRecorder({ ...preset, ...(Platform.OS === 'ios' ? preset.ios : preset.android) });
      session = {
        recorder, prepare: Promise.resolve(), finishing: null, subscription: null,
        poll: null, limit: null, uris: new Set(), discard: false, failed: false, released: false,
      };
      const current = session;
      sessionRef.current = current;
      rememberURI(current);
      current.subscription = recorder.addListener('recordingStatusUpdate', (status) => {
        if (status.url) current.uris.add(status.url);
        if (status.hasError || status.mediaServicesDidReset) {
          current.failed = true;
          if (mounted.current && !current.discard) reportError('녹음이 중단되었어요. 다시 녹음해 주세요.');
          void finishRef.current(current, false, status.isFinished);
        } else if (status.isFinished && phaseRef.current === 'recording') {
          void finishRef.current(current, AppState.currentState === 'active', true);
        }
      });
      current.prepare = recorder.prepareToRecordAsync();
      await current.prepare;
      rememberURI(current);
      if (!mounted.current || cancelled.current || current.discard || AppState.currentState !== 'active') {
        await finishRef.current(current, false);
        return;
      }
      recorder.record({ forDuration: MAX_SECONDS });
      publishPhase('recording');
      current.poll = setInterval(() => {
        if (!mounted.current || current.finishing || current.released) return;
        try { setElapsed(recorder.getStatus().durationMillis); }
        catch { void finishRef.current(current, false); }
      }, 200);
      current.limit = setTimeout(() => void finishRef.current(current, true), MAX_SECONDS * 1000);
    } catch (cause) {
      if (!cancelled.current) reportError(cause instanceof Error ? cause.message : '녹음을 시작하지 못했어요. 마이크 권한을 확인해 주세요.');
      if (session) await finishRef.current(session, false);
    } finally {
      if (!session) {
        await setAudioModeAsync(PLAYBACK_MODE).catch(() => undefined);
        publishPhase('idle');
      }
    }
  }

  function cancelRecording() {
    cancelled.current = true;
    if (mounted.current) setNotice('녹음을 취소했어요.');
    if (sessionRef.current) void finishRef.current(sessionRef.current, false);
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (phaseRef.current === 'recording' && state !== 'active') cancelRecording();
      else if (phaseRef.current === 'preparing' && state === 'background') cancelRecording();
    });
    return () => subscription.remove();
  }, []);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelled.current = true;
      if (sessionRef.current) void finishRef.current(sessionRef.current, false);
    };
  }, []);

  const working = phase === 'preparing' || phase === 'stopping';
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.headingText}>
          <Text style={styles.title}>목소리 남기기</Text>
          <Text style={styles.hint}>최대 1분 · 시간이 되면 자동으로 담아요</Text>
        </View>
        <Text style={[styles.timer, phase === 'recording' && styles.recording]}>● {timeLabel(elapsed)}</Text>
      </View>
      {phase === 'recording' ? (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={elapsed < 500} onPress={() => { if (sessionRef.current) void finishRef.current(sessionRef.current, true); }} style={[styles.primary, styles.grow, elapsed < 500 && styles.disabled]}>
            <Text style={styles.primaryText}>정지하고 담기</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={cancelRecording} style={styles.cancel}><Text style={styles.cancelText}>취소</Text></Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={disabled || working} onPress={() => void startRecording()} style={[styles.primary, styles.grow, (disabled || working) && styles.disabled]}>
            {working ? <View style={styles.loading}><ActivityIndicator color="#FFFFFF" /><Text style={styles.primaryText}>{phase === 'preparing' ? '녹음 준비 중' : '목소리를 담는 중'}</Text></View> : <Text style={styles.primaryText}>음성 녹음하기</Text>}
          </Pressable>
          {phase === 'preparing' && <Pressable accessibilityRole="button" onPress={cancelRecording} style={styles.cancel}><Text style={styles.cancelText}>취소</Text></Pressable>}
        </View>
      )}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {notice && !error && <Text accessibilityLiveRegion="polite" style={styles.hint}>{notice}</Text>}
      {permissionBlocked && <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings().catch(() => reportError('설정에서 마이크 접근을 허용해 주세요.'))}><Text style={styles.settings}>마이크 설정 열기</Text></Pressable>}
      <Text style={styles.footnote}>앱을 벗어나거나 화면을 닫으면 진행 중인 녹음은 취소돼요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.pale, borderRadius: 18, padding: 17, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headingText: { flex: 1, gap: 5 },
  title: { color: C.primary, fontSize: 15, fontWeight: '700' },
  hint: { color: C.muted, fontSize: 12, lineHeight: 18 },
  timer: { color: C.muted, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  recording: { color: '#A44939' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grow: { flex: 1 },
  primary: { minHeight: 46, padding: 13, borderRadius: 13, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  cancel: { paddingHorizontal: 10, paddingVertical: 14 },
  cancelText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  error: { color: C.error, fontSize: 13, lineHeight: 20 },
  settings: { color: C.primary, fontWeight: '700', textDecorationLine: 'underline', fontSize: 13 },
  footnote: { color: C.muted, fontSize: 11, lineHeight: 16 },
});
