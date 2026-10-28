import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { Body, Button, Content, NavBar, Page, Tag, Title } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke, offsetShadow } from '@/constants/theme';
import { ITEM_KIND_LABEL, LETTER_MAX_CHARS, VIDEO_MAX_MS, VOICE_MAX_MS, isLetterValid, letterLength, me, type ItemKind } from '@/domain/capsule';
import { describeError, useCapsuleStore } from '@/state/capsule-store';

const KINDS: ItemKind[] = ['letter', 'photo', 'voice', 'video'];

export default function AddItemScreen() {
  const params = useLocalSearchParams<{ id: string; kind: string; itemId?: string }>();
  const { getCapsule, addItem, updateItem, removeItem } = useCapsuleStore();
  const capsule = params.id ? getCapsule(params.id) : null;
  const kind = (KINDS.includes(params.kind as ItemKind) ? params.kind : 'letter') as ItemKind;
  const existing = capsule ? (me(capsule)?.items.find((item) => item.id === params.itemId) ?? null) : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!capsule) return null;

  // 링크로 바로 들어온 경우엔 돌아갈 곳이 없으니 캡슐 화면으로 간다.
  function leave() {
    if (router.canGoBack()) router.back();
    else if (capsule) router.replace({ pathname: '/capsule/[id]', params: { id: capsule.id } });
  }

  async function save(input: { text?: string; uri?: string; durationMs?: number }) {
    if (!capsule || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (existing) await updateItem(capsule.id, existing.id, { kind, ...input });
      else await addItem(capsule.id, { kind, ...input });
      leave();
    } catch (cause) {
      setError(describeError(cause));
      setBusy(false);
    }
  }

  async function remove() {
    if (!capsule || !existing || busy) return;
    setBusy(true);
    try {
      await removeItem(capsule.id, existing.id);
      leave();
    } catch (cause) {
      setError(describeError(cause));
      setBusy(false);
    }
  }

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <NavBar left="close" title={`${ITEM_KIND_LABEL[kind]} ${existing ? '고치기' : '넣기'}`} />
        {(error || busy) && (
          <Content>
            <Text style={error ? styles.saveError : styles.saveBusy}>{error ?? '캡슐에 넣는 중…'}</Text>
          </Content>
        )}
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {kind === 'letter' && <LetterEditor initial={existing?.text ?? ''} onSave={(text) => void save({ text })} onRemove={existing ? () => void remove() : undefined} />}
          {kind === 'photo' && <PhotoEditor initial={existing?.uri ?? null} onSave={(uri) => void save({ uri })} onRemove={existing ? () => void remove() : undefined} />}
          {kind === 'voice' && <VoiceEditor initial={existing ?? null} onSave={(uri, durationMs) => void save({ uri, durationMs })} onRemove={existing ? () => void remove() : undefined} />}
          {kind === 'video' && <VideoEditor initial={existing ?? null} onSave={(uri, durationMs) => void save({ uri, durationMs })} onRemove={existing ? () => void remove() : undefined} />}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Page>
  );
}

function Footer({ primary, onPrimary, disabled, onRemove }: { primary: string; onPrimary: () => void; disabled?: boolean; onRemove?: () => void }) {
  return (
    <Content style={styles.footer}>
      <Button label={primary} onPress={onPrimary} disabled={disabled} />
      {onRemove ? <Button label="캡슐에서 꺼내기" tone="ghost" onPress={onRemove} /> : <Body size={12} center>마감 전까지는 꺼내서 고칠 수 있어요. 닫힌 뒤에는 나도 볼 수 없어요.</Body>}
    </Content>
  );
}

function LetterEditor({ initial, onSave, onRemove }: { initial: string; onSave: (text: string) => void; onRemove?: () => void }) {
  const [text, setText] = useState(initial);
  const valid = isLetterValid(text);
  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Content style={styles.content}>
          <Tag tone="sky" icon="letter" label="미래의 우리에게" />
          <Title size={24}>그때의 우리에게 한마디</Title>
          <TextInput
            value={text}
            onChangeText={setText}
            maxLength={LETTER_MAX_CHARS}
            multiline
            autoFocus
            placeholder="열어볼 때 웃을 수 있는 말이면 충분해요"
            placeholderTextColor={Colors.faint}
            style={[styles.letterInput, offsetShadow(4)]}
          />
          <Text style={styles.counter}>
            {letterLength(text)} / {LETTER_MAX_CHARS} · 공백 제외
          </Text>
        </Content>
      </ScrollView>
      <Footer primary="캡슐에 넣기" onPrimary={() => onSave(text.trim())} disabled={!valid} onRemove={onRemove} />
    </>
  );
}

function PhotoEditor({ initial, onSave, onRemove }: { initial: string | null; onSave: (uri: string) => void; onRemove?: () => void }) {
  const [uri, setUri] = useState<string | null>(initial);
  const [error, setError] = useState<string | null>(null);

  async function pick(source: 'camera' | 'library') {
    setError(null);
    const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(source === 'camera' ? '카메라 권한이 꺼져 있어요. 설정에서 허용해 주세요.' : '사진 보관함 권한이 꺼져 있어요. 설정에서 허용해 주세요.');
      return;
    }
    const options = { mediaTypes: ['images'] as ImagePicker.MediaType[], quality: 0.8, allowsEditing: false };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets?.[0]?.uri) setUri(result.assets[0].uri);
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Content style={styles.content}>
          <Tag tone="yellow" icon="photo" label="사진 한 장" />
          <Title size={24}>그때 보면 웃을 장면</Title>
          {uri ? (
            <Image source={{ uri }} style={[styles.preview, offsetShadow(4)]} contentFit="cover" accessibilityLabel="고른 사진" />
          ) : (
            <View style={[styles.preview, styles.previewEmpty]}>
              <Icon name="photo" size={32} />
              <Body size={12}>아직 고른 사진이 없어요</Body>
            </View>
          )}
          <View style={styles.row}>
            <Button style={styles.grow} compact tone="secondary" icon="photo" label="카메라로 찍기" onPress={() => pick('camera')} />
            <Button style={styles.grow} compact tone="secondary" label="앨범에서 고르기" onPress={() => pick('library')} />
          </View>
          {error && <ErrorRow message={error} />}
        </Content>
      </ScrollView>
      <Footer primary="캡슐에 넣기" onPrimary={() => uri && onSave(uri)} disabled={!uri} onRemove={onRemove} />
    </>
  );
}

function VoiceEditor({ initial, onSave, onRemove }: { initial: { uri?: string; durationMs?: number } | null; onSave: (uri: string, durationMs: number) => void; onRemove?: () => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [uri, setUri] = useState<string | null>(initial?.uri ?? null);
  const [durationMs, setDurationMs] = useState<number>(initial?.durationMs ?? 0);
  const [error, setError] = useState<string | null>(null);
  const player = useAudioPlayer(uri ? { uri } : null);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    if (recorderState.isRecording && recorderState.durationMillis >= VOICE_MAX_MS) {
      void stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorderState.isRecording, recorderState.durationMillis]);

  async function startRecording() {
    setError(null);
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('마이크 권한이 꺼져 있어요. 설정에서 허용해 주세요.');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setError('녹음을 시작하지 못했어요. 다른 앱이 마이크를 쓰고 있는지 확인해 주세요.');
    }
  }

  async function stopRecording() {
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (recorder.uri) {
        setUri(recorder.uri);
        setDurationMs(Math.min(VOICE_MAX_MS, recorderState.durationMillis));
      }
    } catch {
      setError('녹음을 저장하지 못했어요. 한 번 더 시도해 주세요.');
    }
  }

  const liveSeconds = Math.floor((recorderState.isRecording ? recorderState.durationMillis : durationMs) / 1000);

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Content style={[styles.content, styles.center]}>
          <Tag tone="mint" icon="voice" label={`목소리 · ${VOICE_MAX_MS / 1000}초까지`} />
          <Title size={24}>그때 들으면 반가울 목소리</Title>
          <Text style={styles.timer}>
            0:{String(liveSeconds % 60).padStart(2, '0')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recorderState.isRecording ? '녹음 멈추기' : '녹음 시작'}
            onPress={() => (recorderState.isRecording ? stopRecording() : startRecording())}
            style={[styles.recordButton, recorderState.isRecording && styles.recordButtonActive, offsetShadow(5)]}>
            <Icon name={recorderState.isRecording ? 'stop' : 'mic'} size={36} color={recorderState.isRecording ? Colors.white : Colors.ink} />
          </Pressable>
          <Body size={12} center>
            {recorderState.isRecording ? '녹음 중이에요. 다 하면 눌러서 멈춰요.' : uri ? '다시 녹음하면 이전 녹음은 지워져요.' : '버튼을 누르면 바로 녹음이 시작돼요.'}
          </Body>
          {uri && !recorderState.isRecording && (
            <Button compact tone="secondary" icon={playerStatus.playing ? 'stop' : 'play'} label={playerStatus.playing ? '멈추기' : '들어보기'} onPress={() => (playerStatus.playing ? player.pause() : player.play())} />
          )}
          {error && <ErrorRow message={error} />}
        </Content>
      </ScrollView>
      <Footer primary="캡슐에 넣기" onPrimary={() => uri && onSave(uri, durationMs)} disabled={!uri || recorderState.isRecording} onRemove={onRemove} />
    </>
  );
}

function VideoEditor({ initial, onSave, onRemove }: { initial: { uri?: string; durationMs?: number } | null; onSave: (uri: string, durationMs: number) => void; onRemove?: () => void }) {
  const [uri, setUri] = useState<string | null>(initial?.uri ?? null);
  const [durationMs, setDurationMs] = useState<number>(initial?.durationMs ?? 0);
  const [error, setError] = useState<string | null>(null);
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });

  async function pick(source: 'camera' | 'library') {
    setError(null);
    const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(source === 'camera' ? '카메라 권한이 꺼져 있어요. 설정에서 허용해 주세요.' : '사진 보관함 권한이 꺼져 있어요. 설정에서 허용해 주세요.');
      return;
    }
    const options = { mediaTypes: ['videos'] as ImagePicker.MediaType[], videoMaxDuration: VIDEO_MAX_MS / 1000, allowsEditing: false };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset?.uri) return;
    const assetMs = asset.duration ?? 0;
    if (assetMs > VIDEO_MAX_MS + 500) {
      setError(`${VIDEO_MAX_MS / 1000}초보다 긴 영상이에요. 더 짧게 잘라서 다시 골라 주세요.`);
      return;
    }
    setUri(asset.uri);
    setDurationMs(assetMs);
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Content style={styles.content}>
          <Tag tone="coral" icon="video" label={`짧은 영상 · ${VIDEO_MAX_MS / 1000}초까지`} />
          <Title size={24}>그때 다시 보고 싶은 순간</Title>
          {uri ? (
            <VideoView player={player} style={[styles.preview, offsetShadow(4)]} contentFit="cover" nativeControls />
          ) : (
            <View style={[styles.preview, styles.previewEmpty]}>
              <Icon name="video" size={32} />
              <Body size={12}>아직 고른 영상이 없어요</Body>
            </View>
          )}
          <View style={styles.row}>
            <Button style={styles.grow} compact tone="secondary" icon="video" label="바로 찍기" onPress={() => pick('camera')} />
            <Button style={styles.grow} compact tone="secondary" label="앨범에서 고르기" onPress={() => pick('library')} />
          </View>
          {error && <ErrorRow message={error} />}
        </Content>
      </ScrollView>
      <Footer primary="캡슐에 넣기" onPrimary={() => uri && onSave(uri, durationMs)} disabled={!uri} onRemove={onRemove} />
    </>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <View style={styles.error}>
      <Text style={styles.errorText}>{message}</Text>
      <Button compact tone="secondary" label="설정 열기" onPress={() => Linking.openSettings()} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { gap: Spacing.md, paddingTop: Spacing.lg, paddingBottom: Spacing.lg },
  center: { alignItems: 'center' },
  letterInput: {
    minHeight: 200,
    borderRadius: Radius.lg,
    backgroundColor: Colors.white,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    padding: Spacing.lg,
    fontFamily: Fonts.body,
    fontSize: 17,
    lineHeight: 28,
    color: Colors.ink,
    textAlignVertical: 'top',
  },
  counter: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted, textAlign: 'right' },
  preview: { width: '100%', aspectRatio: 1, borderRadius: Radius.lg, borderWidth: Stroke.regular, borderColor: Colors.ink, backgroundColor: Colors.white, overflow: 'hidden' },
  previewEmpty: { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderStyle: 'dashed' },
  row: { flexDirection: 'row', gap: Spacing.sm },
  grow: { flex: 1 },
  timer: { fontFamily: Fonts.display, fontSize: 56, color: Colors.ink, marginTop: Spacing.lg },
  recordButton: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.yellow, borderWidth: Stroke.regular, borderColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  recordButtonActive: { backgroundColor: Colors.coral },
  error: { gap: Spacing.sm, alignItems: 'flex-start', padding: Spacing.md, borderRadius: Radius.sm, backgroundColor: Colors.white, borderWidth: Stroke.thin, borderColor: Colors.coral },
  errorText: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 20, color: Colors.ink },
  footer: { gap: 4, paddingTop: Spacing.md, paddingBottom: Spacing.md },
  saveError: { fontFamily: Fonts.body, fontSize: 13, color: Colors.coral, textAlign: 'center' },
  saveBusy: { fontFamily: Fonts.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
});
