import * as ExpoLinking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CapsuleArt } from '@/components/capsule-art';
import { DugiMark } from '@/components/dugi-mark';
import { Pill } from '@/components/pill';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { capsuleCountdown, capsuleState, dDayLabel, revealDateLabel } from '@/lib/capsule-countdown';
import { useCapsuleStore } from '@/state/capsule-store';

/** What the owner sees while waiting. Content is never here: only the promise. */
export default function PitWaitingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { capsules, now, refresh, loading } = useCapsuleStore();
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const capsule = capsules.find((item) => item.id === id) ?? null;

  if (!capsule) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={[styles.page, styles.center]}>
          <DugiMark size={96} mood="sleeping" />
          <Text style={styles.title}>구덩이를 찾을 수 없어요</Text>
          <Text style={styles.subtitle}>목록을 새로고침하거나 뒤로 돌아가 주세요.</Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh()} disabled={loading} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
            <Text style={styles.shareButtonText}>{loading ? '불러오는 중…' : '새로고침'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const state = capsuleState(capsule, now);
  const countdown = capsuleCountdown(capsule, now);
  const group = capsule.participantCount && capsule.participantCount > 1;

  async function shareInvite() {
    const inviteUrl = ExpoLinking.createURL(`/pit/${capsule!.id}`);
    setShareFeedback(null);
    try {
      await Share.share({ title: `${capsule!.title} 초대`, message: `묻어두지에서 함께 미래를 묻어볼래요? ${inviteUrl}`, url: inviteUrl });
    } catch {
      if (Platform.OS === 'web' && globalThis.navigator?.clipboard) {
        try {
          await globalThis.navigator.clipboard.writeText(inviteUrl);
          setShareFeedback('공유창을 열 수 없어 초대 링크를 복사했어요.');
          return;
        } catch {
          // The selectable URL below remains available when clipboard access is denied.
        }
      }
      setShareFeedback(`공유를 열지 못했어요. 아래 링크를 복사해주세요.\n${inviteUrl}`);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.page}>
          <View style={styles.stateRow}>
            <Pill label={state === 'ready' ? '열어볼 시간!' : state === 'opened' ? '열어본 캡슐' : '두지가 보관 중'} tone={state === 'ready' ? 'yellow' : 'leaf'} />
            <Text style={styles.identifier}>{capsule.placeName}</Text>
          </View>

          <View style={styles.hero}>
            <View style={styles.ground} />
            {state === 'waiting' ? <DugiMark size={132} mood="sleeping" /> : <CapsuleArt size={190} />}
          </View>
          <Text style={styles.title}>{capsule.title}</Text>
          <Text style={styles.subtitle}>{state === 'waiting' ? '두지가 지하 2층에서 잘 지내고 있습니다.' : state === 'ready' ? '그 자리로 가면 두지가 캡슐을 꺼내줘요.' : '한 번 꺼내 봤어요. 그 자리에서 다시 꺼낼 수 있어요.'}</Text>

          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>{state === 'waiting' ? '공개까지' : '공개 시각'}</Text>
            <Text style={styles.timerValue}>{state === 'waiting' ? dDayLabel(capsule, now) : countdown.text}</Text>
            <Text style={styles.timerDate}>{revealDateLabel(capsule.opensAt, now)} · {capsule.placeName}</Text>
            {state === 'waiting' && <Text style={styles.timerRule}>{countdown.text}</Text>}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>꺼내는 방법</Text>
            <Text style={styles.cardBody}>공개 시각이 지나면 지도에서 이 캡슐을 눌러요. 반경 {capsule.radiusMeters}m 안에서 카메라로 바닥을 비추면 캡슐이 나타나고, 그때 열 수 있어요. 백그라운드 위치 추적은 하지 않아요.</Text>
            {group && <Text style={styles.cardBody}>함께 묻은 캡슐이라 {capsule.participantCount}명 전원이 그 자리에 모여야 열려요.</Text>}
          </View>

          <Pressable accessibilityRole="button"
            onPress={() => router.push({ pathname: state === 'ready' || state === 'opened' ? '/open/[id]' : '/map', params: { id: capsule.id } })}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>{state === 'waiting' ? '지도에서 자리 보기' : state === 'ready' ? '현장에서 AR로 꺼내기' : '다시 꺼내보기'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void shareInvite()} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
            <Text style={styles.shareButtonText}>초대 링크 공유하기</Text>
          </Pressable>
          {shareFeedback && <Text selectable style={styles.shareFeedback}>{shareFeedback}</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.canvas },
  scrollContent: { alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  page: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.lg, gap: Spacing.md },
  stateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  identifier: { color: Colors.muted, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  hero: { height: 170, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  ground: { position: 'absolute', bottom: 12, width: '100%', height: 46, borderRadius: 50, backgroundColor: '#E6CFAD' },
  title: { color: Colors.ink, fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.8 },
  subtitle: { color: Colors.muted, fontSize: 13, textAlign: 'center', marginBottom: Spacing.sm, lineHeight: 20 },
  timerCard: { backgroundColor: Colors.earthDark, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center' },
  timerLabel: { color: '#D9CABD', fontSize: 12, fontWeight: '800' },
  timerValue: { color: Colors.yellow, fontSize: 40, fontWeight: '900', letterSpacing: -1.5, marginVertical: 4, textAlign: 'center' },
  timerDate: { color: Colors.white, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  timerRule: { color: '#D9CABD', fontSize: 11, fontWeight: '700', marginTop: Spacing.sm, fontVariant: ['tabular-nums'] },
  infoCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.line, gap: Spacing.sm },
  cardTitle: { color: Colors.ink, fontSize: 16, fontWeight: '900' },
  cardBody: { color: Colors.muted, fontSize: 12, lineHeight: 19 },
  primaryButton: { minHeight: 56, borderRadius: Radius.md, backgroundColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  primaryButtonText: { color: Colors.white, fontSize: 15, fontWeight: '900' },
  shareButton: { minHeight: 52, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center' },
  shareButtonText: { color: Colors.earthDark, fontSize: 14, fontWeight: '900' },
  shareFeedback: { color: Colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
