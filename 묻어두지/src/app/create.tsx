import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DugiMark } from '@/components/dugi-mark';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { currentLocation } from '@/lib/location';
import { CAPSULE_RADIUS_METERS, type CreateCapsuleInput } from '@/shared/contracts';
import { useCapsuleStore } from '@/state/capsule-store';

// PRD PIT-02 asks for 30~180 days. The short options exist to test the whole
// loop in one sitting and are labelled as such.
const waitOptions = [
  { label: '한 달', seconds: 30 * 86400 }, { label: '100일', seconds: 100 * 86400 }, { label: '180일', seconds: 180 * 86400 },
  { label: '15초 · 테스트', seconds: 15 }, { label: '5분 · 테스트', seconds: 300 },
] as const;

export default function CreatePitScreen() {
  const { draft, updateDraft, clearDraft, now, setLastFix, syncClock, upsert } = useCapsuleStore();
  const [title, setTitle] = useState('한 달 뒤 우리 예언');
  const [letter, setLetter] = useState('');
  const [wait, setWait] = useState<(typeof waitOptions)[number]['seconds']>(30 * 86400);
  const [sealing, setSealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sealing is immutable, so a retry after a dropped response must reuse the same key.
  const requestKey = useRef<string | null>(null);
  useEffect(() => {
    requestKey.current ??= `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    return () => clearDraft();
  }, [clearDraft]);

  const revealDate = useMemo(() => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(now + wait * 1000)), [now, wait]);
  const blocker = !title.trim() ? '구덩이 이름을 적어 주세요.'
    : !draft.pin ? '묻을 자리를 지도에서 골라 주세요.'
      : !letter.trim() && !draft.photo ? '한마디나 사진 중 하나는 넣어 주세요.'
        : null;

  async function seal() {
    if (blocker || sealing || !draft.pin) return;
    setSealing(true); setError(null);
    try {
      // The creator's own position is a liveness check only: the pin can be anywhere.
      const fix = await currentLocation();
      setLastFix(fix);
      const input: CreateCapsuleInput = {
        title: title.trim(),
        placeName: draft.placeName || '우리가 정한 자리',
        unlockAfterSeconds: wait,
        location: draft.pin,
        fix,
        content: { letter: letter.trim(), photo: draft.photo ? { base64: draft.photo.base64, mimeType: draft.photo.mimeType } : null },
      };
      const result = await api.create(input, requestKey.current ?? (requestKey.current = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`));
      syncClock(result.serverNow);
      upsert(result.capsule);
      clearDraft();
      router.replace({ pathname: '/pit/[id]', params: { id: result.capsule.id } });
    } catch (cause) {
      setError(cause instanceof ApiError || cause instanceof Error ? cause.message : '봉인하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSealing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.page}>
          <View style={styles.intro}>
            <DugiMark size={72} />
            <View style={styles.speechBubble}>
              <Text style={styles.speechTitle}>어디에, 언제 다시 만날까요?</Text>
              <Text style={styles.speechBody}>자리는 지도에서 고르면 돼요. 지금 거기 없어도 괜찮아요.</Text>
            </View>
          </View>

          <Section number="1" title="구덩이 이름">
            <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={30} placeholder="친구들이 알아볼 이름" placeholderTextColor={Colors.muted} />
          </Section>

          <Section number="2" title="어디에 묻을까요?">
            <Pressable accessibilityRole="button" onPress={() => router.push('/pick-spot')} style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}>
              <View style={styles.locationPin}><Text style={styles.locationPinText}>●</Text></View>
              <View style={styles.locationCopy}>
                <Text style={styles.locationTitle}>{draft.pin ? (draft.placeName || '지도에서 고른 자리') : '지도에서 자리 고르기'}</Text>
                <Text style={styles.locationDescription}>{draft.pin ? `공개할 때는 이 자리 반경 ${CAPSULE_RADIUS_METERS}m 안에서 열어요.` : '현재 위치든 멀리 있는 곳이든 지도에서 핀을 찍어요.'}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </Section>

          <Section number="3" title="무엇을 묻을까요?">
            <Pressable accessibilityRole="button" onPress={() => router.push('/camera')} style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
              {draft.photo ? (
                <Image source={{ uri: draft.photo.uri }} style={styles.photoPreview} resizeMode="cover" />
              ) : (
                <View style={styles.photoEmpty}><Text style={styles.photoEmptyIcon}>▣</Text><Text style={styles.photoEmptyText}>증거 사진 한 장 찍기</Text></View>
              )}
            </Pressable>
            {draft.photo && (
              <View style={styles.photoActions}>
                <Pressable accessibilityRole="button" onPress={() => router.push('/camera')}><Text style={styles.link}>다시 찍기</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => updateDraft({ photo: null })}><Text style={styles.link}>빼기</Text></Pressable>
              </View>
            )}
            <TextInput
              value={letter} onChangeText={setLetter} maxLength={180} multiline
              style={styles.messageInput} placeholder="미래의 우리에게 남길 한마디" placeholderTextColor={Colors.muted}
            />
            <Text style={styles.characterCount}>{letter.length}/180</Text>
          </Section>

          <Section number="4" title="얼마나 기다릴까요?">
            <View style={styles.chipRow}>
              {waitOptions.map((option) => (
                <ChoiceChip key={option.seconds} label={option.label} selected={wait === option.seconds} onPress={() => setWait(option.seconds)} />
              ))}
            </View>
            <View style={styles.datePreview}>
              <Text style={styles.dateLabel}>공개 예정</Text>
              <Text style={styles.dateValue}>{revealDate}</Text>
            </View>
          </Section>

          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable accessibilityRole="button" disabled={!!blocker || sealing} onPress={() => void seal()} style={({ pressed }) => [styles.primaryButton, (blocker || sealing) && styles.disabledButton, pressed && styles.pressed]}>
            {sealing ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryButtonText}>{blocker ?? '이대로 묻기'}</Text>}
          </Pressable>
          <Text style={styles.privacyNote}>
            봉인하면 작성자도 내용을 다시 볼 수 없어요. 봉인할 때 현재 위치를 한 번 확인하지만 저장하지는 않아요.
            {Platform.OS === 'web' ? ' 브라우저에서는 봉인까지만 되고, 꺼내는 AR은 휴대폰에서 해요.' : ''}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>{number}</Text></View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.chip, selected && styles.selectedChip, pressed && styles.pressed]}>
      <Text style={[styles.chipText, selected && styles.selectedChipText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.canvas },
  scrollContent: { alignItems: 'center' },
  page: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.lg, gap: Spacing.xl },
  intro: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  speechBubble: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.line },
  speechTitle: { color: Colors.ink, fontSize: 15, fontWeight: '900' },
  speechBody: { color: Colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  section: { gap: Spacing.md },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center' },
  sectionNumberText: { color: Colors.white, fontSize: 11, fontWeight: '900' },
  sectionTitle: { color: Colors.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  input: { minHeight: 56, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.line, paddingHorizontal: Spacing.md, color: Colors.ink, fontSize: 16, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  chip: { minHeight: 44, paddingHorizontal: Spacing.md, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.line, justifyContent: 'center' },
  selectedChip: { backgroundColor: Colors.earthDark, borderColor: Colors.earthDark },
  chipText: { color: Colors.muted, fontSize: 13, fontWeight: '800' },
  selectedChipText: { color: Colors.white },
  datePreview: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.md, borderRadius: Radius.sm, backgroundColor: '#EDE3D2', gap: Spacing.sm },
  dateLabel: { color: Colors.muted, fontSize: 12, fontWeight: '700' },
  dateValue: { color: Colors.earthDark, fontSize: 13, fontWeight: '900', flexShrink: 1, textAlign: 'right' },
  locationButton: { minHeight: 72, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.line, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  locationPin: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0DCC7', alignItems: 'center', justifyContent: 'center' },
  locationPinText: { color: Colors.warning, fontSize: 16 },
  locationCopy: { flex: 1, gap: 4 },
  locationTitle: { color: Colors.ink, fontSize: 14, fontWeight: '800' },
  locationDescription: { color: Colors.muted, fontSize: 11, lineHeight: 16 },
  chevron: { color: Colors.soil, fontSize: 28 },
  photoButton: { borderRadius: Radius.md, overflow: 'hidden', borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.surface },
  photoPreview: { width: '100%', aspectRatio: 4 / 3 },
  photoEmpty: { minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoEmptyIcon: { color: Colors.earthDark, fontSize: 26, fontWeight: '800' },
  photoEmptyText: { color: Colors.earthDark, fontSize: 13, fontWeight: '800' },
  photoActions: { flexDirection: 'row', gap: Spacing.lg, justifyContent: 'flex-end' },
  link: { color: Colors.earth, fontSize: 12, fontWeight: '900', paddingVertical: 6 },
  messageInput: { minHeight: 104, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.surface, color: Colors.ink, fontSize: 15, lineHeight: 22, textAlignVertical: 'top' },
  characterCount: { color: Colors.muted, fontSize: 11, textAlign: 'right', marginTop: -Spacing.sm },
  error: { color: Colors.warning, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  primaryButton: { minHeight: 58, borderRadius: Radius.md, backgroundColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  disabledButton: { backgroundColor: '#B9AB9C' },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '900' },
  privacyNote: { color: Colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: -Spacing.md },
  pressed: { opacity: 0.7 },
});
