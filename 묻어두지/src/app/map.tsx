import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule as CapsuleArt } from '@/components/capsule';
import { CapsuleAtlas } from '@/components/capsule-atlas';
import { Icon } from '@/components/icons';
import { Body, IconButton, Tag } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke, offsetShadow } from '@/constants/theme';
import { deriveStatus, formatKoreanDate } from '@/domain/capsule';
import { capsuleCountdown } from '@/lib/capsule-countdown';
import { currentLocation } from '@/lib/location';
import { plantedSummaries } from '@/lib/map-adapter';
import { mapCenter, type MapPerspective } from '@/lib/map-presentation';
import type { LocationFix } from '@/shared/contracts';
import { useCapsuleStore } from '@/state/capsule-store';

const SHEET_HEIGHT = 236;

/** 동네 지도: 심은 캡슐이 떠 있고, 누르면 그 캡슐로 간다. 2차 범위. */
export default function MapScreen() {
  const { capsules } = useCapsuleStore();
  const summaries = useMemo(() => plantedSummaries(capsules), [capsules]);
  const [now, setNow] = useState(() => Date.now());
  const [fix, setFix] = useState<LocationFix | null>(null);
  const [perspective, setPerspective] = useState<MapPerspective>('quarter');
  const [recenterKey, setRecenterKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const center = mapCenter(summaries, fix);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function locate() {
    if (locating) return;
    setLocating(true);
    setNotice(null);
    try {
      setFix(await currentLocation());
      setRecenterKey((value) => value + 1);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : '현재 위치를 확인하지 못했어요.');
    } finally {
      setLocating(false);
    }
  }

  function open(id: string) {
    const capsule = capsules.find((item) => item.id === id);
    if (!capsule) return;
    const status = deriveStatus(capsule, new Date());
    router.push(status === 'unlockable' ? { pathname: '/capsule/[id]/find', params: { id } } : { pathname: '/capsule/[id]', params: { id } });
  }

  return (
    <View style={styles.root}>
      <CapsuleAtlas
        capsules={summaries}
        fix={fix}
        center={center}
        recenterKey={recenterKey}
        bottomInset={SHEET_HEIGHT}
        active
        now={now}
        perspective={perspective}
        onSelect={(capsule) => open(capsule.id)}
      />
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.top} pointerEvents="box-none">
          <IconButton name="back" label="뒤로" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <Tag tone="white" label={`우리 동네 · 캡슐 ${summaries.length}개`} />
          <View style={styles.topRight}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={perspective === 'quarter' ? '평면으로 보기' : '입체로 보기'}
              onPress={() => setPerspective((value) => (value === 'quarter' ? 'flat' : 'quarter'))}
              style={[styles.perspective, offsetShadow(3)]}>
              <Text style={styles.perspectiveLabel}>{perspective === 'quarter' ? '2D' : '3D'}</Text>
            </Pressable>
            <IconButton name="people" label="내 위치로" onPress={locate} />
          </View>
        </View>

        <View style={[styles.sheet, { height: SHEET_HEIGHT }]}>
          <View style={styles.handle} />
          {notice && <Body size={12}>{notice}</Body>}
          {summaries.length === 0 ? (
            <View style={styles.empty}>
              <CapsuleArt state="buried" size={84} />
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>아직 심은 캡슐이 없어요</Text>
                <Body size={12}>채우는 중인 캡슐에서 ‘AR로 이 자리에 심기’를 누르면 여기 떠요.</Body>
              </View>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
              {summaries.map((summary) => {
                const countdown = capsuleCountdown(summary, now);
                return (
                  <Pressable key={summary.id} accessibilityRole="button" onPress={() => open(summary.id)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                    <CapsuleArt state={countdown.state === 'opened' ? 'open' : 'buried'} size={46} />
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {summary.title}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {summary.placeName} · {countdown.state === 'ready' ? '열어볼 시간!' : countdown.state === 'opened' ? '열어봤어요' : `${formatKoreanDate(summary.opensAt, true)}에`}
                      </Text>
                    </View>
                    <Icon name="chevron" />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },
  overlay: { flex: 1, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: Spacing.sm },
  topRight: { flexDirection: 'row', gap: 8 },
  perspective: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  perspectiveLabel: { fontFamily: Fonts.display, fontSize: 13, color: Colors.ink },
  sheet: { backgroundColor: Colors.cream, borderTopWidth: Stroke.regular, borderTopColor: Colors.ink, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingHorizontal: Spacing.xl, paddingTop: 10, paddingBottom: Spacing.md, gap: Spacing.sm },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: Colors.ink, alignSelf: 'center', opacity: 0.35 },
  list: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: 10, paddingRight: 14, borderRadius: Radius.md, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: Fonts.display, fontSize: 16, color: Colors.ink },
  rowMeta: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted },
  pressed: { opacity: 0.7 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.sm },
  emptyCopy: { flex: 1, gap: 4 },
  emptyTitle: { fontFamily: Fonts.display, fontSize: 16, color: Colors.ink },
});
