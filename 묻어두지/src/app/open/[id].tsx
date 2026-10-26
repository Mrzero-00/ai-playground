import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CapsuleAR } from '@/components/capsule-ar';
import { DugiMark } from '@/components/dugi-mark';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { revealDateLabel } from '@/lib/capsule-countdown';
import { gateMessage } from '@/lib/gate-message';
import { currentLocation } from '@/lib/location';
import { useAttendance } from '@/lib/use-attendance';
import type { CapsuleOpenResponse, Eligibility } from '@/shared/contracts';
import { useCapsuleStore } from '@/state/capsule-store';

type Phase =
  | { status: 'checking' }
  | { status: 'ar'; gate: Eligibility }
  | { status: 'opened'; result: CapsuleOpenResponse }
  | { status: 'error'; message: string };

/** The encounter: tapping a capsule on the map lands here. The server decides, the camera shows. */
export default function OpenCapsuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { capsules, now, setLastFix, syncClock, upsert } = useCapsuleStore();
  const capsule = capsules.find((item) => item.id === id) ?? null;
  const [phase, setPhase] = useState<Phase>({ status: 'checking' });
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const attendance = useAttendance(capsule?.groupId ? capsule.id : null, phase.status !== 'opened',
    (gate) => { syncClock(gate.serverNow); setPhase((previous) => (previous.status === 'ar' ? { status: 'ar', gate } : previous)); },
    (message) => setPhase({ status: 'error', message }));

  useEffect(() => {
    if (!capsule) return;
    const intent = ++generation.current;
    (async () => {
      try {
        if (Platform.OS === 'web') {
          // The browser cannot run AR. Show the gate result and the web notice.
          setPhase({ status: 'ar', gate: { eligible: false, code: 'TOO_EARLY', distanceMeters: 0, radiusMeters: capsule.radiusMeters, remainingSeconds: 0, serverNow: new Date(now).toISOString() } });
          return;
        }
        const fix = await currentLocation();
        setLastFix(fix);
        if (intent !== generation.current) return;
        const gate = capsule.groupId ? await attendance.begin(fix) : await api.eligibility(capsule.id, fix);
        if (intent !== generation.current || !gate) return;
        syncClock(gate.serverNow);
        setPhase({ status: 'ar', gate });
      } catch (cause) {
        if (intent !== generation.current) return;
        setPhase({ status: 'error', message: cause instanceof Error ? cause.message : '현재 위치를 확인하지 못했어요.' });
      }
    })();
    return () => { generation.current += 1; };
    // Runs once per capsule; the attendance hook keeps the gate fresh afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capsule?.id]);

  async function openInAR() {
    if (!capsule || busy) return;
    setBusy(true);
    const intent = generation.current;
    try {
      const fix = await currentLocation();
      setLastFix(fix);
      if (intent !== generation.current) return;
      const token = attendance.token();
      if (capsule.groupId && !token) throw new Error('함께 열기 참여를 다시 시작해 주세요.');
      const result = await api.open(capsule.id, fix, token);
      if (intent !== generation.current) return;
      syncClock(result.serverNow);
      upsert(result.capsule);
      attendance.stop();
      setPhase({ status: 'opened', result });
    } catch (cause) {
      if (cause instanceof ApiError && cause.eligibility) {
        setPhase({ status: 'ar', gate: cause.eligibility });
      }
      throw cause;
    } finally {
      setBusy(false);
    }
  }

  function close() { generation.current += 1; attendance.stop(); router.back(); }

  if (!capsule) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={[styles.page, styles.center]}>
          <DugiMark size={88} mood="sleeping" />
          <Text style={styles.title}>구덩이를 찾을 수 없어요</Text>
          <Text style={styles.subtitle}>목록을 새로고침한 뒤 다시 열어 주세요.</Text>
          <Pressable accessibilityRole="button" onPress={close} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>돌아가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase.status === 'opened') {
    const { content, capsule: opened } = phase.result;
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.page}>
            <View style={styles.hero}><DugiMark size={96} mood="awake" /></View>
            <Text style={styles.eyebrow}>드디어 꺼냈다</Text>
            <Text style={styles.title}>{opened.title}</Text>
            <Text style={styles.subtitle}>{revealDateLabel(opened.createdAt, now)}에 묻은 캡슐이에요.</Text>
            {content.photo && <Image source={{ uri: `data:${content.photo.mimeType};base64,${content.photo.base64}` }} style={styles.photo} resizeMode="cover" />}
            <View style={styles.letter}>
              <Text style={styles.letterBody}>{content.letter || '그날의 우리는 말 대신 사진을 남겼네요.'}</Text>
              <Text style={styles.letterSign}>— {opened.placeName}에서</Text>
            </View>
            <Text style={styles.note}>꺼낸 내용은 앱에 따로 저장하지 않아요. 다시 보려면 이 자리에서 다시 꺼내요.</Text>
            <Pressable accessibilityRole="button" onPress={close} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>지도로 돌아가기</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase.status === 'error') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={[styles.page, styles.center]}>
          <DugiMark size={88} mood="sleeping" />
          <Text style={styles.title}>지금은 열 수 없어요</Text>
          <Text style={styles.subtitle}>{phase.message}</Text>
          <Pressable accessibilityRole="button" onPress={close} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>돌아가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase.status === 'checking') {
    return (
      <View style={[styles.safeArea, styles.center]}>
        <ActivityIndicator size="large" color={Colors.yellow} />
        <Text style={styles.checking}>두지가 시간과 장소를 확인하는 중…</Text>
      </View>
    );
  }

  return (
    <CapsuleAR
      title={capsule.title}
      busy={busy}
      actionAllowed={phase.gate.eligible}
      gateHint={phase.gate.eligible ? undefined : gateMessage(phase.gate)}
      onClose={close}
      onAction={openInAR}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.canvas },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, flex: 1 },
  checking: { color: Colors.muted, fontSize: 13, fontWeight: '700' },
  scrollContent: { alignItems: 'center' },
  page: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.lg, gap: Spacing.md },
  hero: { alignItems: 'center' },
  eyebrow: { color: Colors.leaf, fontSize: 12, fontWeight: '900', textAlign: 'center' },
  title: { color: Colors.ink, fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.8 },
  subtitle: { color: Colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.earthDark, backgroundColor: Colors.line },
  letter: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 2, borderColor: Colors.earthDark, padding: Spacing.lg, gap: Spacing.md },
  letterBody: { color: Colors.ink, fontSize: 16, lineHeight: 26, fontWeight: '600' },
  letterSign: { color: Colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  note: { color: Colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  primary: { minHeight: 56, borderRadius: Radius.md, backgroundColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  primaryText: { color: Colors.white, fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
