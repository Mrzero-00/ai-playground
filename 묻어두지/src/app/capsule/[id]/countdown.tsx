import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OpeningCapsule } from '@/components/opening-capsule';
import { Content, Page, Tag } from '@/components/ui';
import { Colors, Fonts, Spacing, Stroke } from '@/constants/theme';
import { COUNTDOWN_MS } from '@/domain/capsule';
import { useCapsuleStore } from '@/state/capsule-store';

const CONFETTI = [
  { left: 36, top: 150, width: 12, height: 22, color: Colors.yellow, rotate: '18deg' },
  { left: 320, top: 190, width: 14, height: 14, color: Colors.coral, rotate: '0deg' },
  { left: 56, top: 620, width: 14, height: 14, color: Colors.yellow, rotate: '0deg' },
  { left: 300, top: 600, width: 12, height: 22, color: Colors.mint, rotate: '-24deg' },
  { left: 190, top: 110, width: 10, height: 18, color: Colors.white, rotate: '-30deg' },
];

export default function CountdownScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCapsule, openCapsule } = useCapsuleStore();
  const capsule = id ? getCapsule(id) : null;
  const startedAt = useRef<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(COUNTDOWN_MS);
  // 0초가 되면 닫혀 있던 캡슐이 홈과 같은 모션으로 열리고, 다 열린 뒤에 열린 화면으로 간다.
  const [opening, setOpening] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    startedAt.current ??= Date.now();
    const timer = setInterval(() => {
      const left = Math.max(0, COUNTDOWN_MS - (Date.now() - (startedAt.current ?? Date.now())));
      setRemainingMs(left);
      if (left === 0) {
        clearInterval(timer);
        setOpening(true);
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const reveal = useCallback(() => {
    if (finished.current || !capsule) return;
    finished.current = true;
    // 서버가 거절해도(아직 시각 전 등) 캡슐 화면이 실제 상태를 보여 준다.
    void openCapsule(capsule.id).finally(() => router.replace({ pathname: '/capsule/[id]', params: { id: capsule.id } }));
  }, [capsule, openCapsule]);

  if (!capsule) return null;
  const seconds = Math.ceil(remainingMs / 1000);
  const elapsedSteps = Math.round((COUNTDOWN_MS - remainingMs) / 1000);
  const names = capsule.members.map((member) => member.name).join(' · ');

  return (
    <Page tone="cyan">
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {CONFETTI.map((piece, index) => (
          <View
            key={index}
            pointerEvents="none"
            style={[
              styles.confetti,
              { left: piece.left, top: piece.top, width: piece.width, height: piece.height, backgroundColor: piece.color, transform: [{ rotate: piece.rotate }] },
            ]}
          />
        ))}
        <View style={styles.top}>
          <Tag tone="white" label={`${names} 함께 열고 있어요`} />
        </View>
        <View style={styles.center}>
          <OpeningCapsule width={230} open={opening} onOpened={reveal} />
          {opening ? (
            <Text style={styles.captionOpening}>열리는 중…</Text>
          ) : (
            <>
              <Text style={styles.number}>{seconds}</Text>
              <Text style={styles.caption}>초 뒤에 열려요</Text>
            </>
          )}
          <View style={styles.dots}>
            {Array.from({ length: COUNTDOWN_MS / 1000 }).map((_, index) => (
              <View key={index} style={[styles.dot, index < elapsedSteps ? styles.dotDone : styles.dotPending]} />
            ))}
          </View>
        </View>
        <Content style={styles.bottom}>
          <Text style={styles.title}>{capsule.title}</Text>
          <Text style={styles.note}>한 번 열면 되돌릴 수 없어요</Text>
        </Content>
      </SafeAreaView>
    </Page>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  confetti: { position: 'absolute', borderRadius: 4, borderWidth: Stroke.regular, borderColor: Colors.ink },
  top: { alignItems: 'center', paddingTop: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  number: { fontFamily: Fonts.display, fontSize: 150, lineHeight: 160, color: Colors.white, textShadowColor: Colors.ink, textShadowOffset: { width: 5, height: 5 }, textShadowRadius: 0 },
  caption: { fontFamily: Fonts.display, fontSize: 18, color: Colors.ink },
  captionOpening: { fontFamily: Fonts.display, fontSize: 28, lineHeight: 160, color: Colors.white, textShadowColor: Colors.ink, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 6 },
  dot: { width: 22, height: 8, borderRadius: 4, borderWidth: Stroke.thin, borderColor: Colors.ink },
  dotDone: { backgroundColor: Colors.yellow },
  dotPending: { backgroundColor: Colors.white },
  bottom: { alignItems: 'center', gap: 4, paddingBottom: Spacing.xl },
  title: { fontFamily: Fonts.display, fontSize: 18, color: Colors.ink },
  note: { fontFamily: Fonts.body, fontSize: 12, color: Colors.cyanInk },
});
