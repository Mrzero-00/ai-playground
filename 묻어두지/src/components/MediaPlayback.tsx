import { colors as C } from '../theme';
import React, { Component, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEvent } from 'expo';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';

export interface MediaPlaybackProps {
  kind: 'audio' | 'video';
  uri: string;
  label?: string;
}

function clock(seconds: number) {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function AudioPlayback({ uri, label }: Omit<MediaPlaybackProps, 'kind'>) {
  const player = useAudioPlayer({ uri }, { updateInterval: 250, downloadFirst: false, keepAudioSessionActive: false });
  const status = useAudioPlayerStatus(player);
  const [problem, setProblem] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const mounted = useRef(false);
  const actionPending = useRef(false);

  useLayoutEffect(() => {
    mounted.current = true;
    player.loop = false;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') player.pause();
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      // Layout cleanup precedes the Expo hook's automatic SharedObject release.
      try { player.pause(); } catch { /* Native media services may already have reset. */ }
    };
  }, [player]);

  useEffect(() => {
    if (status.playing && AppState.currentState !== 'active') player.pause();
  }, [player, status.playing]);

  useEffect(() => {
    if (status.playbackState === 'failed' || status.playbackState === 'error') {
      setProblem('이 음성을 재생할 수 없어요. 파일 형식을 확인해 주세요.');
    }
  }, [status.playbackState]);

  useEffect(() => {
    if (status.isLoaded) return;
    // Android does not expose every decoder error in AudioStatus.
    const timer = setTimeout(() => {
      if (mounted.current && !player.isLoaded) setProblem('음성을 불러오지 못했어요. 다시 시도해 주세요.');
    }, 15_000);
    return () => clearTimeout(timer);
  }, [player, status.isLoaded, loadAttempt]);

  async function play(restart = false) {
    if (actionPending.current || !status.isLoaded || AppState.currentState !== 'active') return;
    actionPending.current = true;
    try {
      if (!restart && player.playing) {
        player.pause();
        return;
      }
      await setAudioModeAsync({
        allowsRecording: false, allowsBackgroundRecording: false,
        shouldPlayInBackground: false, playsInSilentMode: true, interruptionMode: 'doNotMix',
      });
      if (!mounted.current || AppState.currentState !== 'active') return;
      if (restart || status.didJustFinish || (player.duration > 0 && player.currentTime >= player.duration - 0.05)) {
        await player.seekTo(0);
      }
      if (mounted.current && AppState.currentState === 'active') {
        setProblem(null);
        player.play();
      }
    } catch {
      if (mounted.current) setProblem('음성을 재생하지 못했어요. 다시 시도해 주세요.');
    } finally {
      actionPending.current = false;
    }
  }

  const loading = !status.isLoaded || status.isBuffering;
  const progress = status.duration > 0 ? Math.min(1, Math.max(0, status.currentTime / status.duration)) : 0;
  return (
    <View style={styles.audioCard}>
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={2}>{label || '그날의 목소리'}</Text>
        <Text style={styles.time}>{clock(status.currentTime)} / {clock(status.duration)}</Text>
      </View>
      <View accessibilityRole="progressbar" accessibilityLabel="음성 재생 위치" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={styles.track}>
        <View style={[styles.progress, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.controls}>
        <Pressable accessibilityRole="button" disabled={!status.isLoaded || !!problem} onPress={() => void play()} style={[styles.playButton, (!status.isLoaded || !!problem) && styles.disabled]}>
          <Text style={styles.playText}>{status.playing ? '일시정지' : '음성 재생'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!status.isLoaded || !!problem} onPress={() => void play(true)} style={styles.replayButton}>
          <Text style={[styles.replayText, (!status.isLoaded || !!problem) && styles.disabled]}>처음부터</Text>
        </Pressable>
        {loading && !problem && <ActivityIndicator color={C.primary} accessibilityLabel="음성 준비 중" />}
      </View>
      {problem && (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" style={styles.error}>{problem}</Text>
          <Pressable accessibilityRole="button" onPress={() => {
            try { player.pause(); player.replace({ uri }); setProblem(null); setLoadAttempt((value) => value + 1); }
            catch { setProblem('음성을 불러오지 못했어요.'); }
          }}><Text style={styles.replayText}>다시 불러오기</Text></Pressable>
        </View>
      )}
    </View>
  );
}

function VideoPlayback({ uri, label }: Omit<MediaPlaybackProps, 'kind'>) {
  const player = useVideoPlayer({ uri, useCaching: false }, (instance) => {
    instance.loop = false;
    if (Platform.OS === 'ios' || Platform.OS === 'web') instance.allowsExternalPlayback = false;
    instance.staysActiveInBackground = false;
    instance.showNowPlayingNotification = false;
    instance.pause();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const mounted = useRef(false);

  useLayoutEffect(() => {
    mounted.current = true;
    const appSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') player.pause();
    });
    const playbackSubscription = player.addListener('playingChange', ({ isPlaying }) => {
      if (mounted.current && isPlaying && AppState.currentState !== 'active') player.pause();
    });
    return () => {
      mounted.current = false;
      appSubscription.remove();
      playbackSubscription.remove();
      try { player.pause(); } catch { /* The hook owns release, so do not release twice. */ }
    };
  }, [player]);

  useEffect(() => {
    if (status === 'readyToPlay') { setLoadTimedOut(false); return; }
    if (status === 'error') return;
    const timer = setTimeout(() => { if (mounted.current) setLoadTimedOut(true); }, 15_000);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <View style={styles.videoCard}>
      {label && <Text style={styles.videoTitle}>{label}</Text>}
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit="contain"
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture={false}
        startsPictureInPictureAutomatically={false}
        allowsVideoFrameAnalysis={false}
        playsInline
      />
      {(status === 'loading' || status === 'idle') && !loadTimedOut && <View style={styles.videoNotice}><ActivityIndicator color={C.primary} /><Text style={styles.caption}>영상을 준비하고 있어요</Text></View>}
      {(status === 'error' || loadTimedOut) && <Text accessibilityRole="alert" style={styles.videoError}>영상을 재생할 수 없어요. 파일 형식을 확인하거나 화면을 다시 열어주세요.</Text>}
    </View>
  );
}

class PlaybackBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <Text accessibilityRole="alert" style={styles.videoError}>미디어를 재생할 수 없어요. 앱을 다시 열어주세요.</Text> : this.props.children;
  }
}

export default function MediaPlayback({ kind, uri, label }: MediaPlaybackProps) {
  return (
    <PlaybackBoundary key={`${kind}:${uri}`}>
      {kind === 'audio' ? <AudioPlayback uri={uri} label={label} /> : <VideoPlayback uri={uri} label={label} />}
    </PlaybackBoundary>
  );
}

const styles = StyleSheet.create({
  audioCard: { backgroundColor: C.pale, borderRadius: 18, padding: 18, gap: 15 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, color: C.primary, fontSize: 15, fontWeight: '700' },
  time: { color: C.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  track: { height: 5, backgroundColor: C.line, borderRadius: 3, overflow: 'hidden' },
  progress: { height: '100%', backgroundColor: C.primary, borderRadius: 3 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playButton: { backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 13 },
  playText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  replayButton: { paddingVertical: 12, paddingHorizontal: 4 },
  replayText: { color: C.primary, fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  errorBox: { gap: 10 },
  error: { color: C.error, fontSize: 13, lineHeight: 20 },
  videoCard: { backgroundColor: C.pale, borderRadius: 18, overflow: 'hidden' },
  videoTitle: { color: C.primary, fontSize: 15, fontWeight: '700', marginHorizontal: 16, marginVertical: 14 },
  video: { width: '100%', aspectRatio: 16 / 10, backgroundColor: '#17251D' },
  videoNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 15 },
  caption: { color: C.muted, fontSize: 13 },
  videoError: { color: C.error, fontSize: 13, lineHeight: 20, padding: 16 },
});
