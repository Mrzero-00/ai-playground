import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Text, TextInput, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import CapsuleArt from './src/components/CapsuleArt';
import CapsuleHome from './src/components/CapsuleHome';
import { colors as C } from './src/theme';
import { styles } from './src/styles';
import CapsuleMap from './src/components/CapsuleMap';
import CapsuleAR from './src/components/CapsuleAR';
import CapsuleComposer from './src/components/CapsuleComposer';
import OpenedMedia from './src/components/OpenedMedia';
import GroupLobby from './src/components/GroupLobby';
import { useAttendance } from './src/lib/useAttendance';
import { api, API_URL, ApiError } from './src/lib/api';
import { currentLocation } from './src/lib/location';
import { discardPhoto, pickPhoto, type DraftPhoto } from './src/lib/photos';
import { clearStalePlaybackFiles, createRecordedAudio, discardMedia, mediaPayload, pickAudio, pickVideo, type DraftAudio, type DraftVideo } from './src/lib/media';
import { MAX_LOCATION_ACCURACY_METERS, type CapsuleGroup, type CapsuleCreateResponse, type CapsuleOpenResponse, type CapsuleSummary, type CreateCapsuleInput, type Eligibility, type LocationFix } from './src/shared/contracts';

type Screen = 'home' | 'compose' | 'detail' | 'opened' | 'lab' | 'sealing' | 'groups';
const durations = [{ label: '15초', value: 15 }, { label: '1분', value: 60 }, { label: '5분', value: 300 }, { label: '하루', value: 86400 }, { label: '30일', value: 2592000 }];
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
    case 'WAITING_PARTICIPANTS': return `${gate.attendance?.presentCount ?? 0} / ${gate.attendance?.requiredCount ?? 0}명 도착했어요. 전원이 이 장소에서 함께 열기에 참여하면 열 수 있어요.`;
  }
}

function Button({ children, onPress, loading = false, disabled = false, secondary = false }: { children: React.ReactNode; onPress: () => void; loading?: boolean; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || loading, busy: loading }} disabled={disabled || loading} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, (disabled || loading) && styles.disabled, pressed && styles.pressed]}>
    {loading ? <ActivityIndicator color={secondary ? C.primary : '#fff'} /> : <Text style={[styles.buttonText, secondary && { color: C.primary }]}>{children}</Text>}
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
  const [duration, setDuration] = useState(2592000);
  const [groupMode, setGroupMode] = useState(false);
  const [draftGroup, setDraftGroup] = useState<CapsuleGroup | null>(null);
  const scroll = useRef<ScrollView>(null);
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
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [screen]);

  const syncClock = useCallback((serverNow: string) => setClockOffset(Date.parse(serverNow) - Date.now()), []);
  const attendance = useAttendance(selected?.groupId ? selected.id : null, screen === 'detail' || screen === 'opened',
    value => {
      setGate(value); syncClock(value.serverNow);
      // A slow media response must not reveal content after attendance was lost.
      if (!value.eligible) generation.current += 1;
      if (screen === 'opened' && !value.eligible) { setOpened(null); setScreen('detail'); setNotice(gateMessage(value)); }
    },
    message => { generation.current += 1; setError(message); setGate(null); setOpened(null); setScreen(previous => previous === 'opened' ? 'detail' : previous); });
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
      if (state === 'active') setTick(Date.now());
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
    attendance.stop();
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
    if (groupMode && (!draftGroup || !draftGroup.isHost || draftGroup.capsuleId || draftGroup.members.length !== draftGroup.expectedCount)) {
      throw new Error('함께 묻기에서 전원이 참여한 모임을 선택해 주세요.');
    }
    if (Platform.OS === 'web') { setArMode('bury'); return; }
    const fix = await currentLocation();
    setLastFix(fix);
    if (fix.accuracy > MAX_LOCATION_ACCURACY_METERS) throw new Error(`위치 오차가 약 ${Math.round(fix.accuracy)}m예요. ${MAX_LOCATION_ACCURACY_METERS}m 이하로 확인될 때 묻을 수 있어요. 실외에서 다시 시도해 주세요.`);
    if (intent === generation.current && active.current) setArMode('bury');
  });
  const checkOpen = () => void act(async () => {
    const intent = generation.current;
    if (!selected) return;
    if (Platform.OS === 'web') { setArMode('open'); return; }
    const fix = await currentLocation(); setLastFix(fix);
    if (intent !== generation.current || !active.current) return;
    const result = selected.groupId ? await attendance.begin(fix) : await api.eligibility(selected.id, fix);
    if (!result) return;
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
    setGroupMode(false); setDraftGroup(null);
    syncClock(result.serverNow);
    setCapsules(previous => [result.capsule, ...previous.filter(item => item.id !== result.capsule.id)]);
    if (intent === generation.current && active.current) {
      setSelected(result.capsule);
      setNotice('잘 묻었어요. 삽은 잠깐 치워둘게요.');
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
          ...(groupMode && draftGroup ? { groupId: draftGroup.id } : {}),
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
          if (cause instanceof ApiError && (cause.status === 400 || ['HOST_REQUIRED', 'GROUP_INCOMPLETE', 'GROUP_SEALED'].includes(cause.code))) {
            pendingSeal.current = null; setScreen('compose');
          }
          throw cause;
        }
      } else if (mode === 'open' && selected) {
        const token = attendance.token();
        if (selected.groupId && !token) throw new Error('함께 열기 참여를 다시 시작해 주세요.');
        const result = await api.open(selected.id, fix, token);
        if (intent !== generation.current || !active.current) return;
        if (selected.groupId && attendance.token() !== token) return;
        syncClock(result.serverNow); setOpened(result); setSelected(result.capsule);
        setCapsules(previous => previous.map(item => item.id === result.capsule.id ? result.capsule : item));
        setArMode(null); setScreen('opened');
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.eligibility) setGate(cause.eligibility);
      throw cause;
    } finally { operation.current = false; setBusy(false); }
  };

  const back = () => navigate(screen === 'opened' ? 'detail' : 'home');
  return <SafeAreaView style={styles.safe}>
    <StatusBar style="dark" />
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.shell}>
        <CapsuleHome active={screen === 'home'} capsules={capsules} fix={lastFix} now={now} loading={loading} serverOk={serverOk} error={error}
          onCompose={() => navigate('compose')} onGroups={() => navigate('groups')} onLab={() => navigate('lab')}
          onSelect={capsule => { setSelected(capsule); navigate('detail'); }} onRefresh={refresh}
          onLocate={async () => { const intent = generation.current; const fix = await currentLocation(); if (intent === generation.current && active.current) setLastFix(fix); }}/>
        {screen !== 'home' && <View style={styles.screenDrawer}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={back} style={styles.backButton}><Text style={styles.back}>←</Text></Pressable>
          <Text style={styles.headerTitle}>{screen === 'compose' ? '캡슐 묻기' : screen === 'groups' ? '함께 묻기' : screen === 'lab' ? '두지의 실험실' : screen === 'opened' ? '꺼내본 마음' : '묻어둔 약속'}</Text>
          <Text style={styles.labBadge}>AR 실험판</Text>
        </View>
        <ScrollView ref={scroll} style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error && <View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.errorText}>{error}</Text>{!serverOk && <Pressable onPress={() => void refresh()} accessibilityRole="button"><Text style={styles.retry}>다시 연결하기 ↗</Text></Pressable>}</View>}


          {screen === 'groups' && <GroupLobby onChoose={group => {
            setDraftGroup(group); setGroupMode(true); navigate('compose');
          }} onOpen={id => void act(async () => {
            const result = await api.list();
            setCapsules(result.capsules); syncClock(result.serverNow);
            const capsule = result.capsules.find(item => item.id === id);
            if (!capsule) throw new Error('캡슐을 찾을 수 없어요. 모임을 새로고침해 주세요.');
            setSelected(capsule); navigate('detail');
          })}/>}

          {screen === 'sealing' && <>
            <Text style={styles.pageEyebrow}>봉인 확인</Text><Text style={styles.pageTitle}>두지가 봉인을 확인 중이에요.</Text>
            <View style={styles.sealedArt}><CapsuleArt size={205}/></View>
            <Text style={styles.description}>연결이 잠시 끊겼을 수 있어요. 봉인이 끝났는지 확인하는 동안 내용은 보여주지 않아요.</Text>
            <View style={styles.note}><Text style={styles.noteText}>다시 확인해도 캡슐이 중복으로 만들어지지 않아요. 이 화면에서 연결을 복구해 주세요.</Text></View>
            <Button onPress={recoverSeal} loading={busy}>봉인 상태 다시 확인하기</Button>
          </>}

          {screen === 'compose' && <>
            <Text style={styles.pageEyebrow}>오늘의 기억을, 미래로</Text><Text style={styles.pageTitle}>무엇을 묻어둘까요?</Text>
            {!arMode && <CapsuleComposer letter={letter} photo={photo} audio={audio} video={video} busy={busy} recordingBusy={recordingBusy} error={error}
              onLetterChange={setLetter} onChoosePhoto={choosePhoto} onChooseAudio={chooseAudio} onChooseVideo={chooseVideo}
              onRemovePhoto={() => { const removed = photo; setPhoto(null); void discardPhoto(removed); }}
              onRemoveAudio={() => { const removed = audio; setAudio(null); void discardMedia(removed); }}
              onRemoveVideo={() => { const removed = video; setVideo(null); void discardMedia(removed); }}
              onRecorded={saveRecording} onRecordingBusy={setRecordingBusy} onError={setError}
              onEditorExit={() => { generation.current += 1; setRecordingBusy(false); }}/>
            }
            <SectionLabel>누구와 열까요?</SectionLabel>
            <View style={styles.durationRow}>{[{ value: false, label: '나 혼자' }, { value: true, label: '모두 함께' }].map(item => <Pressable key={item.label} accessibilityRole="radio" aria-checked={groupMode === item.value} accessibilityState={{ checked: groupMode === item.value }} onPress={() => setGroupMode(item.value)} style={[styles.duration, groupMode === item.value && styles.durationSelected]}><Text style={[styles.durationText, groupMode === item.value && styles.durationTextSelected]}>{item.label}</Text></Pressable>)}</View>
            {groupMode && <View style={styles.labPanel}>
              <Text style={styles.labTitle}>{draftGroup ? draftGroup.title : '함께 열 모임을 골라 주세요'}</Text>
              {draftGroup && <Text style={styles.labBody}>{draftGroup.members.map(m => m.name).join(' · ')}{ '\n' }{draftGroup.expectedCount}명 전원이 모여야 열려요.</Text>}
              <Button secondary onPress={() => navigate('groups')}>{draftGroup ? '모임 다시 선택하기' : '모임 만들기 · 초대받아 참여하기'}</Button>
              <Text style={styles.fieldHint}>모임을 만든 사람이 내용을 담아요. 봉인 후 인원과 명단은 바꿀 수 없어요.</Text>
            </View>}
            <SectionLabel>캡슐 이름</SectionLabel><TextInput accessibilityLabel="캡슐 이름" style={styles.input} placeholder="예: 오늘의 나, 꽤 괜찮았음" placeholderTextColor={C.muted} maxLength={80} value={title} onChangeText={setTitle}/>
            <SectionLabel>이 장소를 부를 이름</SectionLabel><TextInput accessibilityLabel="장소 이름" style={styles.input} placeholder="예: 집 앞 붕어빵 기다리는 자리" placeholderTextColor={C.muted} maxLength={80} value={placeName} onChangeText={setPlaceName}/>
            <Text style={styles.fieldHint}>실제 위치는 봉인하는 순간 기록해요.</Text>
            <View style={styles.listHeader}><SectionLabel>얼마 뒤에 열까요?</SectionLabel><Text style={styles.testTag}>개발용 단축 시간 포함</Text></View>
            <View style={styles.durationRow}>{durations.map(item => <Pressable key={item.value} accessibilityRole="radio" aria-checked={duration === item.value} accessibilityState={{ checked: duration === item.value }} onPress={() => setDuration(item.value)} style={[styles.duration, duration === item.value && styles.durationSelected]}><Text style={[styles.durationText, duration === item.value && styles.durationTextSelected]}>{item.label}</Text></Pressable>)}</View>
            <View style={styles.note}><Text style={styles.noteText}>봉인한 순간부터 시간을 세어요. 개봉 시간이 지나면 이곳의 반경 50m 안에서 AR로 열 수 있어요.</Text></View>
            {lastFix && <Text style={styles.fieldHint}>마지막 위치 정확도 · 약 {Math.round(lastFix.accuracy)}m</Text>}
            <Button onPress={startBury} loading={busy} disabled={recordingBusy || !title.trim() || (!letter.trim() && !photo && !audio && !video) || (groupMode && (!draftGroup || draftGroup.members.length !== draftGroup.expectedCount))}>현재 장소에서 AR로 묻기  ↗</Button>
            {Platform.OS === 'web' && <Text style={styles.webNote}>화면 미리보기예요. 실제 AR 봉인은 아이폰·안드로이드 개발 빌드에서 진행해요.</Text>}
          </>}

          {screen === 'detail' && selected && <>
            <Text style={styles.pageEyebrow}>두지가 지키는 중</Text><Text style={styles.pageTitle}>{selected.title}</Text>
            <Text style={styles.description}>{selected.placeName}에 묻었어요. 두지도 내용은 몰라요.</Text>
            {selected.groupId && <View style={styles.labPanel}>
              <Text style={styles.labTitle}>우리 {selected.participantCount}명, 모두 모이면</Text>
              <Text style={styles.labBody}>각자 이 캡슐을 열고 ‘함께 열기 참여’를 눌러 주세요. 반경 {selected.radiusMeters}m 안에 전원이 있어야 꺼낼 수 있어요.</Text>
              {gate?.attendance && <>
                <Text accessibilityLiveRegion="polite" style={styles.labValue}>{gate.attendance.presentCount} / {gate.attendance.requiredCount}명 참석 확인</Text>
                {gate.attendance.members.map(member => <Text key={member.id} style={styles.labBody}>{member.present ? '●' : '○'} {member.name}{member.isMe ? ' (나)' : ''} · {member.present ? '이곳에 있어요' : '기다리는 중'}</Text>)}
              </>}
              <Text style={styles.fieldHint}>{attendance.participating ? '이 화면을 켜 두면 약 5초마다 위치를 확인해요. 화면을 나가거나 앱을 닫으면 참석 확인을 끝내요.' : '참석 확인은 참여 버튼을 누른 뒤에만 시작해요.'}</Text>
              {attendance.participating && <Button secondary onPress={() => { attendance.stop(); setGate(null); }}>참석 확인 그만하기</Button>}
            </View>}
            {notice && <View style={styles.success}><Text style={styles.successText}>{notice}</Text></View>}
            <View style={styles.sealedArt}><CapsuleArt size={205}/><Text style={styles.sealedBadge}>{remainingLabel(selected.opensAt, now)}</Text></View>
            <View style={styles.details}><View style={styles.detailLine}><Text style={styles.detailKey}>다시 만날 날</Text><Text style={styles.detailValue}>{dateLabel(selected.opensAt)}</Text></View><View style={styles.detailLine}><Text style={styles.detailKey}>묻은 날</Text><Text style={styles.detailValue}>{dateLabel(selected.createdAt)}</Text></View><View style={styles.detailLine}><Text style={styles.detailKey}>열 수 있는 곳</Text><Text style={styles.detailValue}>묻은 위치에서 {selected.radiusMeters}m 이내</Text></View></View>
            <SectionLabel>다시 찾아올 장소</SectionLabel><CapsuleMap latitude={selected.latitude} longitude={selected.longitude} radius={selected.radiusMeters} title={selected.placeName}/>
            <View style={styles.note}><Text style={styles.noteText}>내용은 개봉 조건을 확인한 뒤에만 불러와요. 봉인한 편지·사진·음성·영상은 지금 볼 수 없어요.</Text></View>
            {gate && <View accessibilityLiveRegion="polite" style={gate.eligible ? styles.success : styles.note}><Text style={styles.noteText}>{gateMessage(gate)}</Text></View>}
            <Button onPress={checkOpen} loading={busy}>{selected.groupId ? attendance.participating ? gate?.eligible ? '모두 모였어요 · AR로 꺼내기  ↗' : '참석 상태 다시 확인' : '함께 열기 참여' : Date.parse(selected.opensAt) > now ? '개봉 조건 확인하기' : '이곳에서 AR로 꺼내기  ↗'}</Button>
            <Text style={styles.webNote}>현재 위치와 개봉 시간은 서버에서 다시 확인해요.</Text>
          </>}

          {screen === 'opened' && opened && <>
            <Text style={styles.pageEyebrow}>드디어 꺼내봤지</Text><Text style={styles.pageTitle}>이걸 내가 썼다고요?</Text>
            <Text style={styles.description}>{dateLabel(opened.capsule.createdAt)}의 내가 남겼어요.</Text>
            {opened.content.photo && <Image source={{ uri: `data:${opened.content.photo.mimeType};base64,${opened.content.photo.base64}` }} style={styles.openedPhoto} resizeMode="contain"/>}
            {opened.content.audio && <OpenedMedia key={`${opened.capsule.id}-audio`} kind="audio" attachment={opened.content.audio}/>}
            {opened.content.video && <OpenedMedia key={`${opened.capsule.id}-video`} kind="video" attachment={opened.content.video}/>}
            <View style={styles.letterPaper}><Text style={styles.letterTitle}>{opened.capsule.title}</Text><Text style={styles.letterBody}>{opened.content.letter || '그날의 나는 말 대신 이걸 담았네요.'}</Text><Text style={styles.letterSignature}>그날의 나로부터</Text></View>
            <Text style={styles.webNote}>열어본 내용을 앱에 따로 저장하지 않아요.{ '\n' }다시 보려면 이 장소에서 개봉 조건을 확인해요.{opened.capsule.groupId ? '\n공동 캡슐은 전원의 참석도 다시 확인해요. 누군가 떠나면 다음 확인 때 내용을 닫아요.' : ''}</Text>
            <Button onPress={() => navigate('detail')} secondary>캡슐 닫기</Button>
          </>}

          {screen === 'lab' && <>
            <Text style={styles.pageEyebrow}>작은 삽부터 시험 중</Text><Text style={styles.pageTitle}>두지의 실험실</Text>
            <Text style={styles.description}>실제 위치와 AR이 잘 연결되는지 확인해요.{ '\n' }개인 사진 대신 테스트 자료를 담아 주세요.</Text>
            <View style={styles.labPanel}><Text style={styles.labTitle}>서버 연결</Text><Text style={styles.labValue}>{serverOk ? '연결되어 있어요' : '연결을 확인해 주세요'}</Text><Text selectable style={styles.endpoint}>{API_URL}</Text><Button secondary loading={busy} onPress={() => void act(async () => { const result = await api.health(); syncClock(result.serverNow); setServerOk(result.ok); setLabMessage(`서버 응답 확인 · ${dateLabel(result.serverNow)}`); })}>연결 확인</Button></View>
            <View style={styles.labPanel}><Text style={styles.labTitle}>현재 위치</Text><Text style={styles.labValue}>{lastFix ? `오차 약 ${Math.round(lastFix.accuracy)}m` : '아직 확인하지 않았어요'}</Text>{lastFix && <Text selectable style={styles.endpoint}>{lastFix.latitude.toFixed(6)}, {lastFix.longitude.toFixed(6)}</Text>}<Button secondary loading={busy} onPress={() => void act(async () => { const fix = await currentLocation(); setLastFix(fix); setLabMessage(`위치를 확인했어요. 오차 ${MAX_LOCATION_ACCURACY_METERS}m 이하에서 봉인할 수 있어요.`); })}>실제 위치 확인</Button></View>
            {labMessage && <View style={styles.success}><Text style={styles.successText}>{labMessage}</Text></View>}
            <View style={styles.labPanel}><Text style={styles.labTitle}>이번 실험의 범위</Text><Text style={styles.labBody}>• 개인 캡슐 또는 2~20명 공동 캡슐{ '\n' }• 편지와 사진·음성·영상 각 1개{ '\n' }• 초대 코드 참여와 봉인 후 명단 고정{ '\n' }• 공동 개봉 시 전원 참석 재검사{ '\n' }• 개봉 시간 + 반경 50m 확인{ '\n' }• 현장 바닥에 AR 캡슐 배치</Text><Text style={styles.fieldHint}>AR·녹음·미디어 재생은 휴대폰 개발 빌드에서 확인해야 해요. 예전에 놓았던 바닥의 정확한 한 점을 복원하지는 않아요.</Text></View>
            <Text style={styles.webNote}>이 버전은 같은 Wi-Fi의 로컬 개발 서버에 저장해요. 정식 계정·기기 분실 복구·푸시 알림은 다음 단계예요. 참석은 각 기기의 최근 GPS 신고이며 위치 위조 방지를 보장하지 않아요.</Text>
            <Button onPress={() => { setDuration(15); navigate('compose'); }}>15초 캡슐부터 만들어보기</Button>
          </>}
        </ScrollView>
        </View>}
      </View>
    </KeyboardAvoidingView>
    {arMode && <CapsuleAR mode={arMode} title={arMode === 'bury' ? title : selected?.title || '타임캡슐'} busy={busy}
      actionAllowed={arMode !== 'open' || !selected?.groupId || (attendance.participating && !!gate?.eligible)}
      participationHint={arMode === 'open' && selected?.groupId ? gate ? gateMessage(gate) : '참석 확인이 필요해요. 화면을 닫고 함께 열기에 다시 참여해 주세요.' : undefined}
      onClose={() => { if (!busy) setArMode(null); }} onAction={performARAction}/>}
  </SafeAreaView>;
}
