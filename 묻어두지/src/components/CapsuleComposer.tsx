import React, { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { DraftPhoto } from '../lib/photos';
import type { DraftAudio, DraftVideo } from '../lib/media';
import { colors as C } from '../theme';
import CapsuleArt from './CapsuleArt';
import AudioRecorder from './AudioRecorder';
import MediaPlayback from './MediaPlayback';

type Kind = 'photo' | 'audio' | 'video' | 'letter';
const choices: { kind: Kind; label: string; hint: string; color: string }[] = [
  { kind: 'photo', label: '사진', hint: '그날의 한 장', color: '#EAF3F7' },
  { kind: 'audio', label: '음성', hint: '녹음하거나 파일로', color: '#FBEDE6' },
  { kind: 'video', label: '영상', hint: '움직이는 추억', color: '#EFF0F8' },
  { kind: 'letter', label: '편지', hint: '나중에 읽을 한마디', color: '#FBF5DF' },
];

function ContentIcon({ kind, size = 26 }: { kind: Kind; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {kind === 'photo' && <><Rect x="3" y="4" width="18" height="16" rx="3"/><Circle cx="8" cy="9" r="1.5"/><Path d="m4 18 5-5 3 3 4-6 5 7"/></>}
    {kind === 'audio' && <><Rect x="9" y="3" width="6" height="12" rx="3"/><Path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3m-3 0h6"/></>}
    {kind === 'video' && <><Rect x="3" y="5" width="18" height="14" rx="3"/><Path d="m10 9 5 3-5 3Z"/></>}
    {kind === 'letter' && <><Rect x="3" y="5" width="18" height="14" rx="3"/><Path d="m4 7 8 6 8-6"/></>}
  </Svg>;
}

type Props = {
  letter: string; photo: DraftPhoto | null; audio: DraftAudio | null; video: DraftVideo | null;
  busy: boolean; recordingBusy: boolean; error: string | null;
  onLetterChange: (value: string) => void;
  onChoosePhoto: () => void; onChooseAudio: () => void; onChooseVideo: () => void;
  onRemovePhoto: () => void; onRemoveAudio: () => void; onRemoveVideo: () => void;
  onRecorded: (uri: string) => Promise<void>; onRecordingBusy: (value: boolean) => void;
  onError: (message: string | null) => void; onEditorExit: () => void;
};

/** Draft content only. No upload or sealing happens in this component. */
export default function CapsuleComposer(props: Props) {
  const [panel, setPanel] = useState<Kind | 'menu' | null>(null);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const present = { photo: !!props.photo, audio: !!props.audio, video: !!props.video, letter: !!props.letter.trim() };
  const packed = choices.filter(item => present[item.kind]);
  const current = choices.find(item => item.kind === panel);
  const close = () => {
    if (props.busy) return;
    props.onEditorExit(); setPanel(null); props.onError(null);
  };
  const show = (next: Kind | 'menu') => {
    if (props.busy) return;
    if (panel && panel !== 'menu') props.onEditorExit();
    props.onError(null); setPanel(next);
  };
  const action = (label: string, onPress: () => void, secondary = false, disabled = false) => (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || props.busy }} disabled={disabled || props.busy} onPress={onPress}
      style={({ pressed }) => [s.action, secondary && s.secondary, (disabled || props.busy) && s.disabled, pressed && s.pressed]}>
      {props.busy ? <ActivityIndicator color={secondary ? C.primary : '#fff'}/> : <Text style={[s.actionText, secondary && { color: C.primary }]}>{label}</Text>}
    </Pressable>
  );
  return <>
    <View style={s.composer}>
      <Pressable accessibilityRole="button" accessibilityLabel="캡슐에 내용 넣기" accessibilityHint="사진, 음성, 영상, 편지 중 담을 내용을 골라요" disabled={props.busy}
        onPress={() => show('menu')} style={({ pressed }) => [s.capsuleButton, pressed && s.capsulePressed]}>
        <View style={s.art}><CapsuleArt size={244}/><View style={s.plus}><Text style={s.plusText}>＋</Text></View></View>
        <Text style={s.tapLabel}>{packed.length ? '조금 더 담아볼까요?' : '캡슐을 톡, 눌러보세요'}</Text>
        <Text style={s.tapHint}>{packed.length ? `${packed.length}가지 기억이 담겨 있어요` : '사진도, 목소리도, 못다 한 말도.'}</Text>
      </Pressable>
      {packed.length > 0 && <View style={s.packed}>
        {packed.map(item => <Pressable key={item.kind} accessibilityRole="button" accessibilityLabel={`담은 ${item.label} 수정하기`} onPress={() => show(item.kind)} disabled={props.busy}
          style={({ pressed }) => [s.chip, { backgroundColor: item.color }, pressed && s.pressed]}>
          <ContentIcon kind={item.kind} size={17}/><Text style={s.chipText}>{item.label}{item.kind === 'letter' ? ` ${props.letter.trim().length}자` : ' 1개'}</Text><Text style={s.check}>✓</Text>
        </Pressable>)}
      </View>}
    </View>

    <Modal visible={panel !== null} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="내용 담기 창 닫기" onPress={close}/>
        <View accessibilityViewIsModal accessibilityLabel={panel === 'menu' ? '담을 내용 선택' : `${current?.label ?? ''} 넣기`} style={[s.sheet, { maxHeight: height - insets.top - 24, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={s.handle}/>
          <View style={s.heading}>
            {panel !== 'menu' && <Pressable accessibilityRole="button" accessibilityLabel="다른 내용 고르기" onPress={() => show('menu')} disabled={props.busy} style={s.iconButton}><Text style={s.back}>←</Text></Pressable>}
            <View style={s.headingCopy}><Text style={s.sheetTitle}>{panel === 'menu' ? '무엇을 넣을까요?' : `${current?.label ?? ''} 넣기`}</Text><Text style={s.sheetHint}>{panel === 'menu' ? '기억 하나씩, 캡슐에 쏙.' : '봉인 전까지는 언제든 바꿀 수 있어요.'}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="내용 담기 닫기" disabled={props.busy} onPress={close} style={s.iconButton}><Text style={s.close}>×</Text></Pressable>
          </View>
          <ScrollView key={panel} keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetContent} style={s.sheetScroll}>
            {props.error && <View accessibilityRole="alert" style={s.error}><Text style={s.errorText}>{props.error}</Text></View>}
            {panel === 'menu' && <>
              <View style={s.grid}>{choices.map(item => <Pressable key={item.kind} accessibilityRole="button" accessibilityLabel={`${item.label} 넣기`} onPress={() => show(item.kind)}
                style={({ pressed }) => [s.choice, { backgroundColor: item.color }, pressed && s.pressed]}>
                <View style={s.choiceTop}><ContentIcon kind={item.kind}/>{present[item.kind] && <Text style={s.check}>✓</Text>}</View>
                <Text style={s.choiceTitle}>{item.label} 넣기</Text><Text style={s.choiceHint}>{present[item.kind] ? '담겨 있어요 · 수정하기' : item.hint}</Text>
              </Pressable>)}</View>
              <Text style={s.footnote}>원하는 것만 골라 담아도 괜찮아요.</Text>
            </>}

            {panel === 'letter' && <>
              <View style={s.paper}>
                <Text style={s.paperTo}>나중에 이 캡슐을 열 우리에게,</Text>
                <TextInput accessibilityLabel="편지 내용" autoFocus multiline textAlignVertical="top" maxLength={10000} value={props.letter} onChangeText={props.onLetterChange}
                  placeholder="별거 아닌 얘기도 좋아요.\n오늘 무슨 일이 있었나요?" placeholderTextColor={C.muted} style={s.letter}/>
                <Text style={s.counter}>{props.letter.length.toLocaleString()} / 10,000</Text>
              </View>
              {!!props.letter && <Pressable accessibilityRole="button" onPress={() => props.onLetterChange('')} style={s.remove}><Text style={s.removeText}>편지 빼기</Text></Pressable>}
            </>}

            {panel === 'photo' && <>
              {props.photo ? <Image accessibilityLabel="담은 사진 미리보기" source={{ uri: props.photo.previewUri }} style={s.photo} resizeMode="contain"/>
                : <View style={[s.empty, { backgroundColor: choices[0].color }]}><ContentIcon kind="photo" size={42}/><Text style={s.emptyTitle}>한 장이면 충분해요.</Text><Text style={s.emptyHint}>나중에 보면 웃음 나는 사진 한 장.</Text></View>}
              {action(props.photo ? '다른 사진 고르기' : '사진 고르기', props.onChoosePhoto, !!props.photo)}
              <Text style={s.hint}>사진 1장 · 최대 4MB로 준비해요</Text>
              {props.photo && <Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onRemovePhoto} style={s.remove}><Text style={s.removeText}>사진 빼기</Text></Pressable>}
            </>}

            {panel === 'audio' && <>
              {!props.recordingBusy && props.audio && <MediaPlayback key={props.audio.previewUri} kind="audio" uri={props.audio.previewUri} label={props.audio.fileName}/>}
              <AudioRecorder disabled={props.busy} onRecorded={props.onRecorded} onBusyChange={props.onRecordingBusy} onError={props.onError}/>
              {action(props.audio ? '다른 음성 파일 고르기' : '음성 파일 고르기', props.onChooseAudio, true, props.recordingBusy)}
              <Text style={s.hint}>직접 녹음은 최대 60초 · 파일은 M4A / MP3 / WAV, 10MB 이하</Text>
              {props.audio && <Pressable accessibilityRole="button" disabled={props.busy || props.recordingBusy} onPress={props.onRemoveAudio} style={s.remove}><Text style={s.removeText}>음성 빼기</Text></Pressable>}
            </>}

            {panel === 'video' && <>
              {props.video ? <MediaPlayback key={props.video.previewUri} kind="video" uri={props.video.previewUri} label={props.video.fileName}/>
                : <View style={[s.empty, { backgroundColor: choices[2].color }]}><ContentIcon kind="video" size={42}/><Text style={s.emptyTitle}>그 순간을 그대로.</Text><Text style={s.emptyHint}>짧은 영상 하나를 골라 주세요.</Text></View>}
              {action(props.video ? '다른 영상 고르기' : '영상 고르기', props.onChooseVideo, !!props.video)}
              <Text style={s.hint}>영상 1개 · MP4 / MOV, 25MB 이하</Text>
              {props.video && <Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onRemoveVideo} style={s.remove}><Text style={s.removeText}>영상 빼기</Text></Pressable>}
            </>}
          </ScrollView>
          {panel !== 'menu' && <View style={s.done}>
            {action('완료', close, false, props.recordingBusy)}
            <Text style={s.footnote}>{props.recordingBusy ? '녹음을 마치거나, 닫아서 취소할 수 있어요.' : '입력·선택한 내용은 작성 중인 캡슐에 담겨요.'}</Text>
          </View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  composer: { paddingTop: 10, paddingBottom: 24, borderBottomWidth: 1, borderColor: C.line },
  capsuleButton: { alignItems: 'center', paddingBottom: 10, borderRadius: 24 },
  capsulePressed: { transform: [{ scale: .97 }], opacity: .85 },
  art: { position: 'relative', width: 244 },
  plus: { position: 'absolute', right: 23, bottom: 20, width: 38, height: 38, borderRadius: 19, borderWidth: 4, borderColor: C.background, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  plusText: { color: '#fff', fontSize: 22, lineHeight: 27 },
  tapLabel: { color: C.primary, fontSize: 15, fontWeight: '700', marginTop: 1 },
  tapHint: { color: C.muted, fontSize: 12, marginTop: 8 },
  packed: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 12, minHeight: 44 },
  chipText: { color: C.ink, fontSize: 12 }, check: { color: C.primary, fontSize: 14, fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(32, 56, 66, .32)' },
  sheet: { width: '100%', maxWidth: 520, backgroundColor: C.background, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden', flexShrink: 1 },
  handle: { width: 34, height: 4, borderRadius: 2, backgroundColor: '#C6D7DE', alignSelf: 'center', marginTop: 11 },
  heading: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 20, gap: 7 },
  headingCopy: { flex: 1 }, sheetTitle: { color: C.ink, fontSize: 21, fontWeight: '700', letterSpacing: -.6 },
  sheetHint: { color: C.muted, fontSize: 12, lineHeight: 19, marginTop: 6 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, back: { fontSize: 25, color: C.primary }, close: { fontSize: 29, color: C.muted },
  sheetScroll: { flexShrink: 1 }, sheetContent: { paddingHorizontal: 22, paddingBottom: 12, gap: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choice: { flexBasis: '46%', flexGrow: 1, borderRadius: 17, padding: 18, minHeight: 132 },
  choiceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  choiceTitle: { color: C.ink, fontWeight: '700', fontSize: 15 }, choiceHint: { color: C.muted, fontSize: 11, lineHeight: 18, marginTop: 6 },
  paper: { backgroundColor: '#FFFDF1', borderRadius: 14, borderWidth: 1, borderColor: '#EAE3CA', padding: 18 },
  paperTo: { fontSize: 12, color: C.accent, marginBottom: 15 },
  letter: { fontSize: 16, lineHeight: 28, color: C.ink, minHeight: 190, padding: 0 },
  counter: { fontSize: 11, color: C.muted, textAlign: 'right', marginTop: 12 },
  photo: { width: '100%', height: 220, backgroundColor: C.pale, borderRadius: 14 },
  empty: { minHeight: 176, alignItems: 'center', justifyContent: 'center', borderRadius: 16, padding: 18, gap: 10 },
  emptyTitle: { color: C.ink, fontSize: 16, fontWeight: '600' }, emptyHint: { color: C.muted, fontSize: 12, textAlign: 'center', lineHeight: 20 },
  action: { minHeight: 50, borderRadius: 12, padding: 14, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '600' }, secondary: { backgroundColor: C.pale }, disabled: { opacity: .48 }, pressed: { opacity: .72 },
  hint: { color: C.muted, fontSize: 11, lineHeight: 19, textAlign: 'center' },
  remove: { minHeight: 44, justifyContent: 'center', alignItems: 'center' }, removeText: { color: C.accent, fontSize: 13 },
  done: { paddingHorizontal: 22, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  footnote: { color: C.muted, fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: 12 },
  error: { backgroundColor: C.errorBackground, borderRadius: 10, padding: 12 }, errorText: { color: C.error, fontSize: 13, lineHeight: 20 },
});
