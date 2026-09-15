import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, Image, KeyboardAvoidingView, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import CapsuleArt from './src/components/CapsuleArt';
import CapsuleMap from './src/components/CapsuleMap';
import CapsuleAR from './src/components/CapsuleAR';
import AudioRecorder from './src/components/AudioRecorder';
import MediaPlayback from './src/components/MediaPlayback';
import OpenedMedia from './src/components/OpenedMedia';
import { api, API_URL, ApiError } from './src/lib/api';
import { currentLocation } from './src/lib/location';
import { discardPhoto, pickPhoto, type DraftPhoto } from './src/lib/photos';
import { clearStalePlaybackFiles, createRecordedAudio, discardMedia, mediaPayload, pickAudio, pickVideo, type DraftAudio, type DraftVideo } from './src/lib/media';
import { MAX_LOCATION_ACCURACY_METERS, type CapsuleCreateResponse, type CapsuleOpenResponse, type CapsuleSummary, type CreateCapsuleInput, type Eligibility, type LocationFix } from './src/shared/contracts';

const C = { background: '#f7f6ef', paper: '#fffef9', ink: '#2c392c', muted: '#848a7d', green: '#4e6946', pale: '#e8eddc', line: '#e2e4d8', orange: '#b77349' };
type Screen = 'home' | 'compose' | 'detail' | 'opened' | 'lab' | 'sealing';
const durations = [{ label: '15초', value: 15 }, { label: '1분', value: 60 }, { label: '5분', value: 300 }, { label: '하루', value: 86400 }, { label: '한 달', value: 2592000 }];
const errorText = (error: unknown) => error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.';
const dateLabel = (date: string) => new Date(date).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
function remainingLabel(opensAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(opensAt) - now) / 1000));
  if (seconds === 0) return '만날 시간이 됐어요';
  if (seconds < 60) return `${seconds}초 뒤에 만나요`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}분 뒤에 만나요`;
  if (seconds < 86400) return `${Math.ceil(seconds / 3600)}시간 뒤에 만나요`;
  return `${Math.ceil(seconds / 86400)}일 뒤에 만나요`;
}
function gateMessage(gate: Eligibility) {
  switch (gate.code) {
    case 'READY': return '개봉 시간과 장소를 확인했어요. 이제 AR로 캡슐을 찾아요.';
    case 'TOO_EARLY': return `아직 기다리는 중이에요. ${gate.remainingSeconds}초 뒤에 다시 만나요.`;
    case 'TOO_FAR': return `묻은 곳에서 ${Math.round(gate.distanceMeters)}m 떨어져 있어요. 반경 ${gate.radiusMeters}m 안으로 돌아와 주세요.`;
    case 'INACCURATE_LOCATION': return '현재 위치의 오차가 커요. 정확한 위치를 켜고, 하늘이 보이는 곳에서 다시 확인해 주세요.';
    case 'STALE_LOCATION': return '방금 측정한 위치가 필요해요. 휴대폰의 날짜와 시간을 자동으로 설정하고 다시 확인해 주세요.';
    case 'MOCKED_LOCATION': return '실제 장소에서 측정한 위치로만 열 수 있어요.';
  }
}

function Button({ children, onPress, loading = false, disabled = false, secondary = false }: { children: React.ReactNode; onPress: () => void; loading?: boolean; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || loading, busy: loading }} disabled={disabled || loading} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, (disabled || loading) && styles.disabled, pressed && styles.pressed]}>
    {loading ? <ActivityIndicator color={secondary ? C.green : '#fff'} /> : <Text style={[styles.buttonText, secondary && { color: C.green }]}>{children}</Text>}
  </Pressable>;
}
function SectionLabel({ children }: { children: React.ReactNode }) { return <Text style={styles.sectionLabel}>{children}</Text>; }

export default function App() {
  return <SafeAreaProvider><Mudeoduji /></SafeAreaProvider>;
}

function Mudeoduji() {
  const [screen, setScreen] = useState<Screen>('home');
  const [capsules, setCapsules] = useState<CapsuleSummary[]>([]);
  const [selected, setSelected] = useState<CapsuleSummary | null>(null);
  const [opened, setOpened] = useState<CapsuleOpenResponse | null>(null);
  const [arMode, setArMode] = useState<'bury' | 'open' | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverOk, setServerOk] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [tick, setTick] = useState(Date.now());
  const [title, setTitle] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [letter, setLetter] = useState('');
  const [photo, setPhoto] = useState<DraftPhoto | null>(null);
  const [audio, setAudio] = useState<DraftAudio | null>(null);
  const [video, setVideo] = useState<DraftVideo | null>(null);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [duration, setDuration] = useState(60);
  const [lastFix, setLastFix] = useState<LocationFix | null>(null);
  const [gate, setGate] = useState<Eligibility | null>(null);
  const [labMessage, setLabMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const operation = useRef(false);
  const generation = useRef(0);
  const active = useRef(AppState.currentState === 'active');
  const pendingSeal = useRef<{ key: string; input: CreateCapsuleInput } | null>(null);
  const photoRef = useRef(photo);
  const audioRef = useRef(audio);
  const videoRef = useRef(video);
  photoRef.current = photo;
  audioRef.current = audio;
  videoRef.current = video;
  const now = tick + clockOffset;

  const syncClock = useCallback((serverNow: string) => setClockOffset(Date.parse(serverNow) - Date.now()), []);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.list();
      setCapsules(data.capsules);
      syncClock(data.serverNow);
      setServerOk(true);
      setError(null);
    } catch (cause) { setServerOk(false); setError(errorText(cause)); }
    finally { setLoading(false); }
  }, [syncClock]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const timer = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    void clearStalePlaybackFiles();
    const subscription = AppState.addEventListener('change', state => {
      active.current = state === 'active';
      if (state !== 'active') {
        setOpened(null);
        setScreen(previous => previous === 'opened' ? 'detail' : previous);
        setGate(null);
      }
      // iOS permission sheets temporarily make the app inactive. Keep the AR
      // modal mounted through that prompt; abandon work only on real backgrounding.
      if (state === 'background') {
        generation.current += 1;
        setArMode(null);
      }
    });
    return () => {
      subscription.remove();
      void discardPhoto(photoRef.current);
      void discardMedia(audioRef.current);
      void discardMedia(videoRef.current);
    };
  }, []);

  function navigate(next: Screen) {
    generation.current += 1;
    setRecordingBusy(false);
    setScreen(next === 'compose' && pendingSeal.current ? 'sealing' : next);
    setError(null); setGate(null); setNotice(null); setOpened(null);
  }
  async function act(task: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError(null);
    try { await task(); } catch (cause) { setError(errorText(cause)); }
    finally { operation.current = false; setBusy(false); }
  }
  const choosePhoto = () => void act(async () => {
    const next = await pickPhoto();
    if (next) { await discardPhoto(photo); setPhoto(next); }
  });
  const chooseAudio = () => void act(async () => {
    const next = await pickAudio();
    if (next) { const previous = audioRef.current; setAudio(next); await discardMedia(previous); }
  });
  const chooseVideo = () => void act(async () => {
    const next = await pickVideo();
    if (next) { const previous = videoRef.current; setVideo(next); await discardMedia(previous); }
  });
  const saveRecording = async (uri: string) => {
    const intent = generation.current;
    const next = await createRecordedAudio(uri);
    if (intent !== generation.current || !active.current) { await discardMedia(next); return; }
    const previous = audioRef.current;
    setAudio(next);
    if (previous?.previewUri !== next.previewUri) await discardMedia(previous);
  };
  const startBury = () => void act(async () => {
    const intent = generation.current;
    if (!title.trim()) throw new Error('캡슐에 이름을 붙여 주세요.');
    if (recordingBusy) throw new Error('녹음을 끝낸 뒤 봉인해 주세요.');
    if (!letter.trim() && !photo && !audio && !video) throw new Error('편지, 사진, 음성, 영상 중 하나 이상 담아 주세요.');
    if (Platform.OS === 'web') { setArMode('bury'); return; }
    const fix = await currentLocation();
    setLastFix(fix);
    if (fix.accuracy > MAX_LOCATION_ACCURACY_METERS) throw new Error(`위치 오차가 약 ${Math.round(fix.accuracy)}m예요. ${MAX_LOCATION_ACCURACY_METERS}m 이하로 확인될 때 묻을 수 있어요. 실외에서 다시 시도해 주세요.`);
    if (intent === generation.current && active.current) setArMode('bury');
  });
  const checkOpen = () => void act(async () => {
    const intent = generation.current;
    if (!selected) return;
    const fix = await currentLocation(); setLastFix(fix);
    if (intent !== generation.current || !active.current) return;
    const result = await api.eligibility(selected.id, fix);
    syncClock(result.serverNow);
    if (intent !== generation.current || !active.current) return;
    setGate(result);
    if (result.eligible) setArMode('open');
  });

  async function finishSeal(result: CapsuleCreateResponse, intent: number) {
    const consumedPhoto = photoRef.current;
    const consumedAudio = audioRef.current;
    const consumedVideo = videoRef.current;
    pendingSeal.current = null;
    setPhoto(null); setLetter(''); setTitle(''); setPlaceName('');
    setAudio(null); setVideo(null);
    syncClock(result.serverNow);
    setCapsules(previous => [result.capsule, ...previous.filter(item => item.id !== result.capsule.id)]);
    if (intent === generation.current && active.current) {
      setSelected(result.capsule);
      setNotice('잘 묻어두었어요. 약속한 날, 이곳에서 다시 만나요.');
      setArMode(null); setScreen('detail'); setGate(null);
    }
    await Promise.all([discardPhoto(consumedPhoto), discardMedia(consumedAudio), discardMedia(consumedVideo)]);
  }

  const recoverSeal = () => void act(async () => {
    const pending = pendingSeal.current;
    if (!pending) { navigate('home'); return; }
    const intent = generation.current;
    try { await finishSeal(await api.recover(pending.key), intent); return; }
    catch (cause) { if (!(cause instanceof ApiError) || cause.status !== 404) throw cause; }
    // An absent record may still be in flight; retry with the same key, never a new capsule.
    const fix = await currentLocation();
    if (intent !== generation.current || !active.current) return;
    await finishSeal(await api.create({ ...pending.input, location: fix }, pending.key), intent);
  });

  // Called only by a supported native AR scene after selecting a tracked plane.
  const performARAction = async () => {
    if (operation.current) return;
    operation.current = true; setBusy(true);
    const intent = generation.current;
    const mode = arMode;
    try {
      const fix = await currentLocation(); setLastFix(fix);
      if (intent !== generation.current || !active.current) return;
      if (mode === 'bury') {
        const input = pendingSeal.current?.input ?? {
          title: title.trim(), placeName: placeName.trim() || '우리가 머문 곳', unlockAfterSeconds: duration, location: fix,
          content: {
            letter: letter.trim(),
            photo: photo ? { base64: photo.base64, mimeType: photo.mimeType } : null,
            audio: mediaPayload(audio),
            video: mediaPayload(video),
          },
        };
        // This is a uniqueness key, not an authentication secret.
        const key = pendingSeal.current?.key ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
        pendingSeal.current = { key, input };
        // Hide the editable content as soon as the seal request can reach the server.
        setScreen('sealing');
        try { await finishSeal(await api.create({ ...input, location: fix }, key), intent); }
        catch (cause) {
          if (cause instanceof ApiError && cause.status === 400) {
            pendingSeal.current = null; setScreen('compose');
          }
          throw cause;
        }
      } else if (mode === 'open' && selected) {
        const result = await api.open(selected.id, fix);
        if (intent !== generation.current || !active.current) return;
        syncClock(result.serverNow); setOpened(result); setSelected(result.capsule);
        setCapsules(previous => previous.map(item => item.id === result.capsule.id ? result.capsule : item));
        setArMode(null); setScreen('opened');
      }
    } finally { operation.current = false; setBusy(false); }
  };

  const back = () => navigate(screen === 'opened' ? 'detail' : 'home');
  return <SafeAreaView style={styles.safe}>
    <StatusBar style="dark" />
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.shell}>
        <View style={styles.header}>
          {screen === 'home'
            ? <View style={styles.brand}><View style={styles.brandDot}/><Text style={styles.brandText}>묻어두지</Text></View>
            : <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={back} hitSlop={14}><Text style={styles.back}>←</Text></Pressable>}
          <Text style={styles.headerCaption}>{screen === 'home' ? '오늘을 미래에 심어요' : screen === 'compose' ? '새로운 타임캡슐' : screen === 'lab' ? '기능 검증실' : '나의 타임캡슐'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="기능 검증실" onPress={() => navigate('lab')} style={styles.labBadge}><Text style={styles.labBadgeText}>LAB</Text></Pressable>
        </View>

        <ScrollView style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={screen === 'home' ? <RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={C.green}/> : undefined}>
          {error && <View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.errorText}>{error}</Text>{!serverOk && <Pressable onPress={() => void refresh()} accessibilityRole="button"><Text style={styles.retry}>다시 연결하기 ↗</Text></Pressable>}</View>}

          {screen === 'home' && <>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>A LITTLE MEMORY, A LITTLE LATER</Text>
              <Text style={styles.heroTitle}>오늘의 마음을,{ '\n' }다음의 우리에게.</Text>
              <Text style={styles.heroDescription}>추억 하나를 이곳에 묻어두고,{ '\n' }약속한 날 다시 만나러 와요.</Text>
              <View style={styles.heroArt}><CapsuleArt size={250}/><Text style={styles.artCaption}>시간이 지나야 열리는 작은 약속</Text></View>
              <Button onPress={() => navigate('compose')}>＋  새로운 캡슐 묻기</Button>
            </View>
            <View style={styles.listHeader}><SectionLabel>내가 묻어둔 추억</SectionLabel><Text style={styles.count}>{capsules.length}</Text></View>
            {capsules.length === 0 ? <View style={styles.empty}>
              <Text style={styles.emptyIcon}>⌁</Text><Text style={styles.emptyTitle}>첫 번째 추억을 기다리는 중</Text>
              <Text style={styles.emptyText}>사진, 편지, 목소리, 영상으로 오늘을 남겨요.</Text>
            </View> : capsules.map(capsule => <Pressable key={capsule.id} accessibilityRole="button" onPress={() => { setSelected(capsule); navigate('detail'); }} style={({ pressed }) => [styles.capsuleRow, pressed && styles.pressed]}>
              <View style={styles.miniArt}><CapsuleArt size={68} small/></View>
              <View style={styles.rowMain}><Text numberOfLines={1} style={styles.rowTitle}>{capsule.title}</Text><Text style={styles.rowCaption}>{capsule.placeName}</Text><Text style={styles.rowTime}>{remainingLabel(capsule.opensAt, now)}</Text></View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>)}
            <View style={styles.how}><Text style={styles.howNumber}>01  담고</Text><Text style={styles.howDot}>·</Text><Text style={styles.howNumber}>02  묻고</Text><Text style={styles.howDot}>·</Text><Text style={styles.howNumber}>03  다시 만나고</Text></View>
            <Text style={styles.footer}>묻어두지 · 첫 번째 실험</Text>
          </>}

          {screen === 'sealing' && <>
            <Text style={styles.pageEyebrow}>봉인 확인</Text><Text style={styles.pageTitle}>추억을 보내고 있어요.</Text>
            <View style={styles.sealedArt}><CapsuleArt size={205}/></View>
            <Text style={styles.description}>연결이 잠시 끊겼을 수 있어요. 봉인이 끝났는지 확인하는 동안 내용은 보여주지 않아요.</Text>
            <View style={styles.note}><Text style={styles.noteText}>다시 확인해도 캡슐이 중복으로 만들어지지 않아요. 이 화면에서 연결을 복구해 주세요.</Text></View>
            <Button onPress={recoverSeal} loading={busy}>봉인 상태 다시 확인하기</Button>
          </>}

          {screen === 'compose' && <>
            <Text style={styles.pageEyebrow}>새로운 기억</Text><Text style={styles.pageTitle}>무엇을 묻어둘까요?</Text>
            <Text style={styles.description}>봉인하기 전까지는 마음껏 고쳐도 돼요.{ '\n' }묻고 나면 약속한 날까지 열 수 없어요.</Text>
            <SectionLabel>캡슐 이름</SectionLabel><TextInput accessibilityLabel="캡슐 이름" style={styles.input} placeholder="예: 오늘, 한강에서" placeholderTextColor={C.muted} maxLength={80} value={title} onChangeText={setTitle}/>
            <SectionLabel>미래에 전할 편지</SectionLabel><TextInput accessibilityLabel="미래에 전할 편지" style={[styles.input, styles.letterInput]} multiline textAlignVertical="top" placeholder="이걸 열어볼 때의 나는 어떤 모습일까?" placeholderTextColor={C.muted} maxLength={10000} value={letter} onChangeText={setLetter}/>
            <View style={styles.listHeader}><SectionLabel>함께 담을 사진</SectionLabel><Text style={styles.optional}>선택 · 1장</Text></View>
            {photo ? <View style={styles.photoFrame}><Image source={{ uri: photo.previewUri }} style={styles.photoPreview}/><Pressable accessibilityRole="button" accessibilityLabel="사진 빼기" style={styles.removePhoto} onPress={() => { void discardPhoto(photo); setPhoto(null); }}><Text style={styles.removePhotoText}>✕</Text></Pressable></View>
              : <Pressable accessibilityRole="button" onPress={choosePhoto} style={styles.photoPicker} disabled={busy || recordingBusy}><Text style={styles.photoPlus}>＋</Text><Text style={styles.photoLabel}>사진 한 장 담기</Text></Pressable>}
            <View style={styles.listHeader}><SectionLabel>미래에 전할 목소리</SectionLabel><Text style={styles.optional}>선택 · 1개 · 10MB 이하</Text></View>
            {!arMode && !recordingBusy && audio && <View style={styles.mediaPanel}>
              <MediaPlayback key={audio.previewUri} kind="audio" uri={audio.previewUri} label={audio.fileName}/>
              <View style={styles.mediaMeta}><Text style={styles.fieldHint}>{(audio.sizeBytes / 1024 / 1024).toFixed(1)}MB · 봉인 전 미리듣기</Text><Pressable accessibilityRole="button" accessibilityLabel="음성 빼기" disabled={busy} onPress={() => { const removed = audio; setAudio(null); void discardMedia(removed); }}><Text style={styles.removeMedia}>음성 빼기</Text></Pressable></View>
            </View>}
            {!arMode && <AudioRecorder disabled={busy} onRecorded={saveRecording} onBusyChange={setRecordingBusy} onError={setError}/>}
            <Button onPress={chooseAudio} secondary disabled={busy || recordingBusy}>{audio ? '다른 음성 파일 선택' : '음성 파일 선택하기'}</Button>
            <Text style={styles.fieldHint}>M4A · MP3 · WAV / 직접 녹음은 최대 60초</Text>
            <View style={styles.listHeader}><SectionLabel>움직이는 순간</SectionLabel><Text style={styles.optional}>선택 · 1개 · 25MB 이하</Text></View>
            {!arMode && !recordingBusy && video && <View style={styles.mediaPanel}>
              <MediaPlayback key={video.previewUri} kind="video" uri={video.previewUri} label={video.fileName}/>
              <View style={styles.mediaMeta}><Text style={styles.fieldHint}>{(video.sizeBytes / 1024 / 1024).toFixed(1)}MB · 봉인 전 미리보기</Text><Pressable accessibilityRole="button" accessibilityLabel="영상 빼기" disabled={busy} onPress={() => { const removed = video; setVideo(null); void discardMedia(removed); }}><Text style={styles.removeMedia}>영상 빼기</Text></Pressable></View>
            </View>}
            <Button onPress={chooseVideo} secondary disabled={busy || recordingBusy}>{video ? '다른 영상 선택' : '영상 한 개 담기'}</Button>
            <Text style={styles.fieldHint}>MP4 · MOV / 재생 가능한 코덱은 기기에 따라 달라요.</Text>
            <SectionLabel>이 장소를 부를 이름</SectionLabel><TextInput accessibilityLabel="장소 이름" style={styles.input} placeholder="예: 우리의 단골 벤치" placeholderTextColor={C.muted} maxLength={80} value={placeName} onChangeText={setPlaceName}/>
            <Text style={styles.fieldHint}>실제 위치는 봉인하는 순간 기록해요.</Text>
            <View style={styles.listHeader}><SectionLabel>얼마 뒤에 열까요?</SectionLabel><Text style={styles.testTag}>테스트 시간 포함</Text></View>
            <View style={styles.durationRow}>{durations.map(item => <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: duration === item.value }} onPress={() => setDuration(item.value)} style={[styles.duration, duration === item.value && styles.durationSelected]}><Text style={[styles.durationText, duration === item.value && styles.durationTextSelected]}>{item.label}</Text></Pressable>)}</View>
            <View style={styles.note}><Text style={styles.noteText}>봉인한 순간부터 시간을 세어요. 개봉 시간이 지나면 이곳의 반경 50m 안에서 AR로 열 수 있어요.</Text></View>
            {lastFix && <Text style={styles.fieldHint}>마지막 위치 정확도 · 약 {Math.round(lastFix.accuracy)}m</Text>}
            <Button onPress={startBury} loading={busy} disabled={recordingBusy || !title.trim() || (!letter.trim() && !photo && !audio && !video)}>현재 장소에서 AR로 묻기  ↗</Button>
            {Platform.OS === 'web' && <Text style={styles.webNote}>화면 미리보기예요. 실제 AR 봉인은 아이폰·안드로이드 개발 빌드에서 진행해요.</Text>}
          </>}

          {screen === 'detail' && selected && <>
            <Text style={styles.pageEyebrow}>이곳에서 다시 만날 약속</Text><Text style={styles.pageTitle}>{selected.title}</Text>
            <Text style={styles.description}>{selected.placeName}에 조용히 묻어두었어요.</Text>
            {notice && <View style={styles.success}><Text style={styles.successText}>{notice}</Text></View>}
            <View style={styles.sealedArt}><CapsuleArt size={205}/><Text style={styles.sealedBadge}>{remainingLabel(selected.opensAt, now)}</Text></View>
            <View style={styles.details}><View style={styles.detailLine}><Text style={styles.detailKey}>다시 만날 날</Text><Text style={styles.detailValue}>{dateLabel(selected.opensAt)}</Text></View><View style={styles.detailLine}><Text style={styles.detailKey}>묻은 날</Text><Text style={styles.detailValue}>{dateLabel(selected.createdAt)}</Text></View><View style={styles.detailLine}><Text style={styles.detailKey}>열 수 있는 곳</Text><Text style={styles.detailValue}>묻은 위치에서 {selected.radiusMeters}m 이내</Text></View></View>
            <SectionLabel>추억이 기다리는 장소</SectionLabel><CapsuleMap latitude={selected.latitude} longitude={selected.longitude} radius={selected.radiusMeters} title={selected.placeName}/>
            <View style={styles.note}><Text style={styles.noteText}>내용은 개봉 조건을 확인한 뒤에만 불러와요. 봉인한 편지·사진·음성·영상은 지금 볼 수 없어요.</Text></View>
            {gate && <View accessibilityLiveRegion="polite" style={gate.eligible ? styles.success : styles.note}><Text style={styles.noteText}>{gateMessage(gate)}</Text></View>}
            <Button onPress={checkOpen} loading={busy}>{Date.parse(selected.opensAt) > now ? '개봉 조건 확인하기' : '이곳에서 AR로 꺼내기  ↗'}</Button>
            <Text style={styles.webNote}>현재 위치와 개봉 시간은 서버에서 다시 확인해요.</Text>
          </>}

          {screen === 'opened' && opened && <>
            <Text style={styles.pageEyebrow}>기다림 끝에 도착한 마음</Text><Text style={styles.pageTitle}>다시 만나서 반가워.</Text>
            <Text style={styles.description}>{dateLabel(opened.capsule.createdAt)}의 내가 남겼어요.</Text>
            {opened.content.photo && <Image source={{ uri: `data:${opened.content.photo.mimeType};base64,${opened.content.photo.base64}` }} style={styles.openedPhoto} resizeMode="contain"/>}
            {opened.content.audio && <OpenedMedia key={`${opened.capsule.id}-audio`} kind="audio" attachment={opened.content.audio}/>}
            {opened.content.video && <OpenedMedia key={`${opened.capsule.id}-video`} kind="video" attachment={opened.content.video}/>}
            <View style={styles.letterPaper}><Text style={styles.letterTitle}>{opened.capsule.title}</Text><Text style={styles.letterBody}>{opened.content.letter || '그날 담아둔 순간을 천천히 만나보세요.'}</Text><Text style={styles.letterSignature}>그날의 나로부터</Text></View>
            <Text style={styles.webNote}>열어본 내용을 앱에 따로 저장하지 않아요.{ '\n' }다시 보려면 이 장소에서 개봉 조건을 확인해요.</Text>
            <Button onPress={() => navigate('detail')} secondary>캡슐 닫기</Button>
          </>}

          {screen === 'lab' && <>
            <Text style={styles.pageEyebrow}>PROTOTYPE / 01</Text><Text style={styles.pageTitle}>작은 실험실</Text>
            <Text style={styles.description}>실제 위치와 AR이 잘 연결되는지 확인해요.{ '\n' }개인 사진 대신 테스트 자료를 담아 주세요.</Text>
            <View style={styles.labPanel}><Text style={styles.labTitle}>서버 연결</Text><Text style={styles.labValue}>{serverOk ? '연결되어 있어요' : '연결을 확인해 주세요'}</Text><Text selectable style={styles.endpoint}>{API_URL}</Text><Button secondary loading={busy} onPress={() => void act(async () => { const result = await api.health(); syncClock(result.serverNow); setServerOk(result.ok); setLabMessage(`서버 응답 확인 · ${dateLabel(result.serverNow)}`); })}>연결 확인</Button></View>
            <View style={styles.labPanel}><Text style={styles.labTitle}>현재 위치</Text><Text style={styles.labValue}>{lastFix ? `오차 약 ${Math.round(lastFix.accuracy)}m` : '아직 확인하지 않았어요'}</Text>{lastFix && <Text selectable style={styles.endpoint}>{lastFix.latitude.toFixed(6)}, {lastFix.longitude.toFixed(6)}</Text>}<Button secondary loading={busy} onPress={() => void act(async () => { const fix = await currentLocation(); setLastFix(fix); setLabMessage(`위치를 확인했어요. 오차 ${MAX_LOCATION_ACCURACY_METERS}m 이하에서 봉인할 수 있어요.`); })}>실제 위치 확인</Button></View>
            {labMessage && <View style={styles.success}><Text style={styles.successText}>{labMessage}</Text></View>}
            <View style={styles.labPanel}><Text style={styles.labTitle}>이번 실험의 범위</Text><Text style={styles.labBody}>• 나 혼자 쓰는 캡슐{ '\n' }• 편지와 사진·음성·영상 각 1개{ '\n' }• 음성 파일 선택 또는 60초 녹음{ '\n' }• 봉인 후 서버가 모든 내용 접근 차단{ '\n' }• 개봉 시간 + 반경 50m 확인{ '\n' }• 현장 바닥에 AR 캡슐 배치</Text><Text style={styles.fieldHint}>AR·녹음·미디어 재생은 휴대폰 개발 빌드에서 확인해야 해요. 예전에 놓았던 바닥의 정확한 한 점을 복원하지는 않아요.</Text></View>
            <Text style={styles.webNote}>이 버전은 같은 Wi-Fi의 로컬 개발 서버에 저장해요. 정식 계정·공동 캡슐·푸시 알림은 다음 단계예요.</Text>
            <Button onPress={() => { setDuration(15); navigate('compose'); }}>15초 캡슐부터 만들어보기</Button>
          </>}
        </ScrollView>
        {screen === 'home' && <View style={styles.bottomBar}><View style={styles.bottomItem}><Text style={styles.bottomIcon}>⌂</Text><Text style={styles.bottomLabel}>나의 캡슐</Text></View><View style={styles.bottomDivider}/><Pressable accessibilityRole="button" onPress={() => navigate('lab')} style={styles.bottomItem}><Text style={[styles.bottomIcon, { color: C.muted }]}>⌘</Text><Text style={styles.bottomMuted}>기능 검증</Text></Pressable></View>}
      </View>
    </KeyboardAvoidingView>
    {arMode && <CapsuleAR mode={arMode} title={arMode === 'bury' ? title : selected?.title || '타임캡슐'} busy={busy} onClose={() => { if (!busy) setArMode(null); }} onAction={performARAction}/>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, safe: { flex: 1, backgroundColor: '#eceee4' }, shell: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: C.background },
  header: { height: 78, paddingHorizontal: 26, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomColor: C.line, borderBottomWidth: StyleSheet.hairlineWidth }, brand: { flexDirection: 'row', alignItems: 'center', gap: 7 }, brandDot: { width: 10, height: 15, backgroundColor: C.green, borderRadius: 6, transform: [{ rotate: '25deg' }] }, brandText: { fontSize: 22, letterSpacing: -1, color: C.ink, fontWeight: '800' }, headerCaption: { flex: 1, color: C.muted, fontSize: 10, textAlign: 'right' }, labBadge: { borderWidth: 1, borderColor: '#d7ddca', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5 }, labBadgeText: { fontSize: 9, fontWeight: '600', letterSpacing: 1, color: C.green }, back: { fontSize: 27, color: C.ink },
  content: { paddingHorizontal: 26, paddingBottom: 28 }, hero: { paddingTop: 34, paddingBottom: 26 }, eyebrow: { fontSize: 9, letterSpacing: 1.9, color: C.orange, fontWeight: '600', marginBottom: 16 }, heroTitle: { fontSize: 33, lineHeight: 45, fontWeight: '700', letterSpacing: -1.8, color: C.ink }, heroDescription: { fontSize: 13, lineHeight: 22, color: '#7c8475', marginTop: 14 }, heroArt: { alignItems: 'center', marginTop: 2, marginBottom: 25 }, artCaption: { fontSize: 10, letterSpacing: .2, color: '#8b927e', marginTop: -1 },
  button: { backgroundColor: C.green, borderRadius: 15, minHeight: 54, paddingVertical: 16, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' }, buttonText: { fontSize: 14, color: '#fffdf2', fontWeight: '600', letterSpacing: .1 }, buttonSecondary: { backgroundColor: C.pale }, disabled: { opacity: .48 }, pressed: { opacity: .78 }, sectionLabel: { fontSize: 13, fontWeight: '700', color: C.ink, marginTop: 23, marginBottom: 12 }, listHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8 }, count: { fontSize: 12, color: C.orange },
  empty: { borderColor: C.line, borderWidth: 1, borderStyle: 'dashed', borderRadius: 18, alignItems: 'center', paddingVertical: 25, marginTop: 2 }, emptyIcon: { fontSize: 30, lineHeight: 34, color: '#98a38b', marginBottom: 7 }, emptyTitle: { color: '#6a755f', fontSize: 12, fontWeight: '500' }, emptyText: { color: '#9a9e90', fontSize: 10, marginTop: 8 }, how: { marginTop: 29, flexDirection: 'row', justifyContent: 'center', gap: 12 }, howNumber: { fontSize: 9, color: '#8b9282' }, howDot: { fontSize: 9, color: '#b9bdad' }, footer: { textAlign: 'center', color: '#a8ad9c', fontSize: 9, marginTop: 20 },
  bottomBar: { height: 68, flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.paper }, bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }, bottomIcon: { fontSize: 21, color: C.green, lineHeight: 25 }, bottomLabel: { fontSize: 9, color: C.green, fontWeight: '600' }, bottomMuted: { fontSize: 9, color: C.muted }, bottomDivider: { height: 22, borderLeftWidth: 1, borderLeftColor: C.line, alignSelf: 'center' },
  capsuleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 15 }, miniArt: { width: 65, height: 66, alignItems: 'center', justifyContent: 'center', backgroundColor: C.pale, borderRadius: 17 }, rowMain: { flex: 1, gap: 5, paddingLeft: 5 }, rowTitle: { fontSize: 14, fontWeight: '600', color: C.ink }, rowCaption: { fontSize: 10, color: C.muted }, rowTime: { fontSize: 10, color: C.green }, chevron: { color: C.muted, fontSize: 22 },
  pageEyebrow: { fontSize: 10, color: C.orange, letterSpacing: 1, marginTop: 30, marginBottom: 12 }, pageTitle: { fontSize: 28, lineHeight: 38, letterSpacing: -1.2, color: C.ink, fontWeight: '700' }, description: { color: '#828878', fontSize: 12, lineHeight: 21, marginTop: 12, marginBottom: 6 }, input: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 16, color: C.ink, fontSize: 13, minHeight: 50 }, letterInput: { height: 135, lineHeight: 23 }, optional: { marginLeft: 'auto', fontSize: 10, color: C.muted }, photoPicker: { borderWidth: 1, borderColor: C.line, borderStyle: 'dashed', borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 }, photoPlus: { fontSize: 26, color: '#8a987c' }, photoLabel: { fontSize: 12, color: '#7d8871' }, photoFrame: { borderRadius: 16, overflow: 'hidden' }, photoPreview: { width: '100%', height: 190 }, removePhoto: { position: 'absolute', right: 10, top: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: '#fffefa', alignItems: 'center', justifyContent: 'center' }, removePhotoText: { color: C.ink }, fieldHint: { color: C.muted, fontSize: 10, lineHeight: 18, marginTop: 9, marginBottom: 3 }, testTag: { marginLeft: 'auto', color: C.orange, fontSize: 9 }, durationRow: { flexDirection: 'row', gap: 7 }, duration: { flex: 1, alignItems: 'center', paddingVertical: 12, borderWidth: 1, borderColor: C.line, borderRadius: 10 }, durationSelected: { backgroundColor: C.green, borderColor: C.green }, durationText: { color: C.muted, fontSize: 11 }, durationTextSelected: { color: '#fff', fontWeight: '600' },
  note: { backgroundColor: '#edeedf', borderRadius: 13, padding: 16, marginVertical: 18 }, noteText: { fontSize: 11, lineHeight: 20, color: '#6c775f' }, webNote: { color: '#909685', fontSize: 10, textAlign: 'center', lineHeight: 18, marginTop: 14, marginBottom: 10 }, errorBox: { marginTop: 16, backgroundColor: '#f5e5d9', padding: 16, borderRadius: 13 }, errorText: { fontSize: 12, color: '#8a5035', lineHeight: 20 }, retry: { color: '#8a5035', fontSize: 12, textDecorationLine: 'underline', marginTop: 8 }, success: { backgroundColor: C.pale, borderRadius: 13, padding: 16, marginVertical: 16 }, successText: { color: C.green, fontSize: 12, lineHeight: 20 },
  sealedArt: { alignItems: 'center', paddingVertical: 14 }, sealedBadge: { fontSize: 11, color: C.green, backgroundColor: C.pale, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20 }, details: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line, paddingVertical: 17, gap: 15 }, detailLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, detailKey: { fontSize: 11, color: C.muted }, detailValue: { fontSize: 11, color: C.ink, flexShrink: 1 }, openedPhoto: { width: '100%', height: 280, borderRadius: 16, marginTop: 22, backgroundColor: C.pale }, letterPaper: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 3, marginTop: 22, padding: 24 }, letterTitle: { fontSize: 16, fontWeight: '600', color: C.ink, marginBottom: 22 }, letterBody: { fontSize: 14, lineHeight: 29, color: '#606956' }, letterSignature: { color: C.orange, fontSize: 11, marginTop: 30, textAlign: 'right' },
  labPanel: { borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 22, gap: 12 }, labTitle: { fontSize: 12, fontWeight: '700', color: C.green }, labValue: { fontSize: 18, color: C.ink, letterSpacing: -.5 }, endpoint: { fontSize: 11, color: C.muted }, labBody: { fontSize: 12, color: '#77816b', lineHeight: 26 },
  mediaPanel: { marginBottom: 12, gap: 4 }, mediaMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, removeMedia: { color: C.orange, fontSize: 11, paddingVertical: 10 },
});
