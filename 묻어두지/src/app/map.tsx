import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule as CapsuleArt } from '@/components/capsule';
import { CapsuleAtlas } from '@/components/capsule-atlas';
import { Icon } from '@/components/icons';
import { Body, IconButton, Tag } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke, offsetShadow } from '@/constants/theme';
import { deriveStatus, formatKoreanDate, type Capsule, type DerivedStatus } from '@/domain/capsule';
import { currentLocation } from '@/lib/location';
import { plantedSummaries } from '@/lib/map-adapter';
import { mapCenter, type MapPerspective } from '@/lib/map-presentation';
import type { Coordinates, LocationFix } from '@/shared/contracts';
import { useCapsuleStore } from '@/state/capsule-store';

const SHEET_HEIGHT = 300;
const STATUS_LABEL: Record<DerivedStatus, string> = { collecting: '채우는 중', sealed: '닫힘', unlockable: '열 수 있어요!', opened: '열렸어요' };
const STATUS_TONE: Record<DerivedStatus, 'yellow' | 'white' | 'sky' | 'mint'> = { collecting: 'yellow', sealed: 'white', unlockable: 'sky', opened: 'mint' };

/** 동네 지도: 심은 캡슐이 떠 있고, 아래 목록에서 고르면 그 캡슐 자리로 이동한다. */
export default function MapScreen() {
  const { capsules } = useCapsuleStore();
  const summaries = useMemo(() => plantedSummaries(capsules), [capsules]);
  const [now, setNow] = useState(() => Date.now());
  const [fix, setFix] = useState<LocationFix | null>(null);
  const [focus, setFocus] = useState<Coordinates | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [perspective, setPerspective] = useState<MapPerspective>('quarter');
  const [recenterKey, setRecenterKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const center = focus ?? mapCenter(summaries, fix);
  const rows = useMemo(() => {
    const rank: Record<DerivedStatus, number> = { unlockable: 0, collecting: 1, sealed: 2, opened: 3 };
    const current = new Date(now);
    return capsules.map((capsule) => ({ capsule, status: deriveStatus(capsule, current) })).sort((a, b) => rank[a.status] - rank[b.status]);
  }, [capsules, now]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const locate = useCallback(async () => {
    setLocating(true);
    setNotice(null);
    try {
      setFix(await currentLocation());
      setFocus(null);
      setSelectedId(null);
      setRecenterKey((value) => value + 1);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : '현재 위치를 확인하지 못했어요.');
    } finally {
      setLocating(false);
    }
  }, []);

  // 지도를 열면 바로 내 위치를 한 번 찾는다. 앱을 쓰는 동안에만, 추적은 하지 않는다(CHK-01).
  useEffect(() => {
    const timer = setTimeout(() => {
      void locate();
    }, 0);
    return () => clearTimeout(timer);
  }, [locate]);

  function openCapsule(capsule: Capsule, status: DerivedStatus) {
    router.push(status === 'unlockable' && capsule.location ? { pathname: '/capsule/[id]/find', params: { id: capsule.id } } : { pathname: '/capsule/[id]', params: { id: capsule.id } });
  }

  function show(capsule: Capsule) {
    setSelectedId(capsule.id);
    if (capsule.location) {
      setFocus({ latitude: capsule.location.latitude, longitude: capsule.location.longitude });
      setRecenterKey((value) => value + 1);
      setNotice(null);
    } else {
      setNotice(`‘${capsule.title}’은(는) 아직 자리를 안 정했어요. 캡슐 화면에서 심을 수 있어요.`);
    }
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
        onSelect={(summary) => {
          const capsule = capsules.find((item) => item.id === summary.id);
          if (capsule) openCapsule(capsule, deriveStatus(capsule, new Date(now)));
        }}
      />
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.top} pointerEvents="box-none">
          <IconButton name="back" label="뒤로" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <Tag tone="white" label={`우리 동네 · 심은 캡슐 ${summaries.length}개`} />
          <View style={styles.topRight}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={perspective === 'quarter' ? '평면으로 보기' : '입체로 보기'}
              onPress={() => setPerspective((value) => (value === 'quarter' ? 'flat' : 'quarter'))}
              style={[styles.perspective, offsetShadow(3)]}>
              <Text style={styles.perspectiveLabel}>{perspective === 'quarter' ? '2D' : '3D'}</Text>
            </Pressable>
            <IconButton name="locate" label={locating ? '내 위치 찾는 중' : '내 위치로'} onPress={() => { if (!locating) void locate(); }} />
          </View>
        </View>

        <View style={[styles.sheet, { height: SHEET_HEIGHT }]}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>내 캡슐 {capsules.length}개</Text>
            <Body size={12}>{notice ?? (fix ? `내 위치 · 오차 약 ${Math.round(fix.accuracy)}m` : locating ? '내 위치를 찾는 중…' : '목록을 누르면 그 자리로 가요')}</Body>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {rows.map(({ capsule, status }) => {
              const selected = capsule.id === selectedId;
              return (
                <View key={capsule.id} style={[styles.row, selected && styles.rowSelected]}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${capsule.title} 지도에서 보기`} onPress={() => show(capsule)} style={styles.rowMain}>
                    <CapsuleArt state={status === 'opened' ? 'open' : status === 'sealed' || status === 'unlockable' ? 'buried' : 'closed'} size={44} />
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {capsule.title}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {capsule.location ? capsule.location.label : '아직 자리 없음'}
                        {capsule.openAt ? ` · ${formatKoreanDate(capsule.openAt)}` : ''}
                      </Text>
                    </View>
                    <Tag tone={STATUS_TONE[status]} label={STATUS_LABEL[status]} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${capsule.title} 열어보기`} onPress={() => openCapsule(capsule, status)} style={styles.rowGo}>
                    <Icon name="chevron" />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
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
  sheetHeader: { gap: 2 },
  sheetTitle: { fontFamily: Fonts.display, fontSize: 16, color: Colors.ink },
  list: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'stretch', borderRadius: Radius.md, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink, overflow: 'hidden' },
  rowSelected: { backgroundColor: Colors.sky },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: 8, paddingLeft: 10 },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: Fonts.display, fontSize: 15, color: Colors.ink },
  rowMeta: { fontFamily: Fonts.body, fontSize: 11, color: Colors.muted },
  rowGo: { width: 44, alignItems: 'center', justifyContent: 'center', borderLeftWidth: Stroke.thin, borderLeftColor: Colors.ink },
});
