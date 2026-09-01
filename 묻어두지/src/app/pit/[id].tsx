import * as Location from 'expo-location';
import * as ExpoLinking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DugiMark } from '@/components/dugi-mark';
import { Pill } from '@/components/pill';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { classifyRevealRadius, distanceInMeters } from '@/domain/pit';
import { usePitStore } from '@/state/pit-store';

const MANGWON_PARK = { latitude: 37.5556, longitude: 126.8998 };

type CheckInState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; distance: number; accuracy: number }
  | { status: 'far'; distance: number; accuracy: number }
  | { status: 'uncertain'; distance: number; accuracy: number | null }
  | { status: 'error'; message: string; canOpenSettings?: boolean };

export default function PitWaitingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pit, contributions } = usePitStore();
  const [checkIn, setCheckIn] = useState<CheckInState>({ status: 'idle' });
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const pitId = id ?? 'first-prophecy';
  const contribution = contributions[pitId] ?? null;
  const isCreatedPit = Boolean(pit && pit.id === pitId);
  const targetLocation = isCreatedPit && pit ? pit.location : MANGWON_PARK;
  const pitTitle = isCreatedPit && pit ? pit.title : '한 달 뒤 우리 예언';
  const waitDays = isCreatedPit && pit ? pit.waitDays : 32;
  const revealDate = isCreatedPit && pit
    ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(pit.revealAt))
    : '2026년 10월 3일';
  const participantCount = isCreatedPit ? (contribution ? 1 : 0) : (contribution ? 4 : 3);
  const members = isCreatedPit
    ? [contribution ? '나 · 넣었어요' : '나 · 아직 빈손', '친구를 초대해주세요', '친구를 초대해주세요', '친구를 초대해주세요']
    : ['상길 · 넣었어요', '민지 · 넣었어요', '유진 · 넣었어요', contribution ? '나 · 넣었어요' : '도윤 · 아직 빈손'];

  async function checkCurrentLocation() {
    setCheckIn({ status: 'loading' });
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setCheckIn({ status: 'error', message: '위치 권한이 꺼져 있어요. 설정에서 허용한 뒤 다시 확인해주세요.', canOpenSettings: true });
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const distance = distanceInMeters(current.coords, targetLocation);
      const accuracy = current.coords.accuracy;
      const decision = classifyRevealRadius(distance, accuracy);
      if (decision === 'uncertain') {
        setCheckIn({ status: 'uncertain', distance, accuracy });
        return;
      }
      setCheckIn({
        status: decision === 'inside' ? 'success' : 'far',
        distance,
        accuracy: accuracy as number,
      });
    } catch {
      setCheckIn({ status: 'error', message: '위치를 확인하지 못했어요. 야외에서 한 번 더 시도해주세요.' });
    }
  }

  async function shareInvite() {
    const inviteUrl = ExpoLinking.createURL(`/pit/${pitId}`);
    setShareFeedback(null);
    try {
      await Share.share({
        title: `${pitTitle} 초대`,
        message: `묻어두지에서 함께 미래를 묻어볼래요? ${inviteUrl}`,
        url: inviteUrl,
      });
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
            <Pill label={isCreatedPit ? '방금 만든 구덩이' : '두지가 보관 중'} tone="leaf" />
            <Text style={styles.identifier}>#{pitId}</Text>
          </View>

          <View style={styles.hero}>
            <View style={styles.ground} />
            <DugiMark size={132} mood="sleeping" />
          </View>
          <Text style={styles.title}>{pitTitle}</Text>
          <Text style={styles.subtitle}>두지가 지하 2층에서 잘 지내고 있습니다.</Text>

          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>공개까지</Text>
            <Text style={styles.timerValue}>D–{waitDays}</Text>
            <Text style={styles.timerDate}>{revealDate} · {isCreatedPit ? '내가 등록한 장소' : '망원한강공원'}</Text>
            {isCreatedPit && pit && <Text style={styles.timerRule}>{pit.attendanceRule}가 모이면 열려요</Text>}
          </View>

          <View style={styles.progressCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>친구들의 삽질 현황</Text>
              <Text style={styles.cardCount}>{participantCount}/4</Text>
            </View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${participantCount * 25}%` }]} /></View>
            {members.map((member, index) => {
              const completed = index < participantCount;
              return (
              <View key={`${member}-${index}`} style={styles.memberRow}>
                <View style={[styles.statusDot, !completed && styles.emptyDot]} />
                <Text style={[styles.memberName, !completed && styles.emptyMember]}>{member}</Text>
              </View>
            );})}
          </View>

          <View style={styles.checkInCard}>
            <Text style={styles.cardTitle}>현장 위치 확인</Text>
            <Text style={styles.checkInBody}>공개일에는 약속 장소 반경 150m 안에서 현재 위치를 확인합니다. 백그라운드 추적은 하지 않아요.</Text>
            <Pressable
              onPress={checkCurrentLocation}
              disabled={checkIn.status === 'loading'}
              style={({ pressed }) => [styles.checkInButton, pressed && styles.pressed]}>
              {checkIn.status === 'loading' ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.checkInButtonText}>현재 위치로 미리 확인</Text>}
            </Pressable>
            <CheckInResult state={checkIn} />
          </View>

          <Pressable
            onPress={() => router.push({ pathname: '/camera', params: { pitId } })}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>{contribution ? '내 내용 다시 확인하기' : '내 내용 넣기'}</Text>
          </Pressable>
          <Pressable onPress={shareInvite} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
            <Text style={styles.shareButtonText}>초대 링크 공유하기</Text>
          </Pressable>
          {shareFeedback && <Text selectable style={styles.shareFeedback}>{shareFeedback}</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CheckInResult({ state }: { state: CheckInState }) {
  if (state.status === 'idle' || state.status === 'loading') return null;
  if (state.status === 'error') {
    return (
      <View style={styles.resultBlock}>
        <Text style={styles.errorText}>{state.message}</Text>
        {state.canOpenSettings && (
          <Pressable onPress={Linking.openSettings} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>설정 열기</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const roundedDistance = state.distance < 1000 ? `${Math.round(state.distance)}m` : `${(state.distance / 1000).toFixed(1)}km`;
  if (state.status === 'uncertain') {
    const accuracyLabel = state.accuracy === null ? '측정 불가' : `약 ${Math.round(state.accuracy)}m`;
    return <Text style={styles.errorText}>GPS 오차가 {accuracyLabel}라 아직 판정하지 않았어요. 하늘이 보이는 곳에서 다시 측정해주세요.</Text>;
  }
  if (state.status === 'success') {
    return <Text style={styles.successText}>약속 장소 안이에요. 거리 {roundedDistance} · GPS 오차 약 {Math.round(state.accuracy)}m</Text>;
  }
  return <Text style={styles.errorText}>아직 약속 장소에서 {roundedDistance} 떨어져 있어요. 공개일에는 현장에서 다시 확인해주세요.</Text>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.canvas },
  scrollContent: { alignItems: 'center' },
  page: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.lg, gap: Spacing.md },
  stateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identifier: { color: Colors.muted, fontSize: 11, fontWeight: '700' },
  hero: { height: 170, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  ground: { position: 'absolute', bottom: 12, width: '100%', height: 46, borderRadius: 50, backgroundColor: '#E6CFAD' },
  title: { color: Colors.ink, fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.8 },
  subtitle: { color: Colors.muted, fontSize: 13, textAlign: 'center', marginBottom: Spacing.sm },
  timerCard: { backgroundColor: Colors.earthDark, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center' },
  timerLabel: { color: '#D9CABD', fontSize: 12, fontWeight: '800' },
  timerValue: { color: Colors.yellow, fontSize: 46, fontWeight: '900', letterSpacing: -1.5, marginVertical: 4 },
  timerDate: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  timerRule: { color: '#D9CABD', fontSize: 11, fontWeight: '700', marginTop: Spacing.sm },
  progressCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.line, gap: Spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: Colors.ink, fontSize: 16, fontWeight: '900' },
  cardCount: { color: Colors.leaf, fontSize: 14, fontWeight: '900' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.line, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: Colors.leaf },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.leaf },
  emptyDot: { backgroundColor: Colors.line },
  memberName: { color: Colors.ink, fontSize: 13, fontWeight: '700' },
  emptyMember: { color: Colors.muted },
  checkInCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.line, gap: Spacing.md },
  checkInBody: { color: Colors.muted, fontSize: 12, lineHeight: 19 },
  checkInButton: { minHeight: 48, borderRadius: Radius.sm, backgroundColor: Colors.leaf, alignItems: 'center', justifyContent: 'center' },
  checkInButtonText: { color: Colors.white, fontSize: 13, fontWeight: '900' },
  successText: { color: Colors.leaf, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  errorText: { color: Colors.warning, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  resultBlock: { gap: Spacing.sm, alignItems: 'flex-start' },
  retryButton: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.warning, paddingHorizontal: 12, paddingVertical: 7 },
  retryButtonText: { color: Colors.warning, fontSize: 11, fontWeight: '900' },
  primaryButton: { minHeight: 56, borderRadius: Radius.md, backgroundColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  primaryButtonText: { color: Colors.white, fontSize: 15, fontWeight: '900' },
  shareButton: { minHeight: 52, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center' },
  shareButtonText: { color: Colors.earthDark, fontSize: 14, fontWeight: '900' },
  shareFeedback: { color: Colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
