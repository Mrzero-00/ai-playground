import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CapsuleAtlas } from '@/components/capsule-atlas';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { currentLocation } from '@/lib/location';
import { mapCenter, type MapPerspective } from '@/lib/map-presentation';
import { useCapsuleStore } from '@/state/capsule-store';

/** The town: every capsule floats where it was buried. Tapping one starts the AR encounter. */
export default function MapScreen() {
  const { capsules, now, lastFix, setLastFix, serverOk, error, refresh } = useCapsuleStore();
  const [perspective, setPerspective] = useState<MapPerspective>('quarter');
  const [recenterKey, setRecenterKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const center = mapCenter(capsules, lastFix);

  async function locate() {
    if (locating) return;
    setLocating(true); setNotice(null);
    try {
      setLastFix(await currentLocation());
      setRecenterKey((value) => value + 1);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : '현재 위치를 확인하지 못했어요.');
    } finally {
      setLocating(false);
    }
  }

  return (
    <View style={styles.root}>
      <CapsuleAtlas
        capsules={capsules} fix={lastFix} center={center} recenterKey={recenterKey} bottomInset={108}
        active now={now} perspective={perspective}
        onSelect={(capsule) => router.push({ pathname: '/open/[id]', params: { id: capsule.id } })}
      />
      <SafeAreaView pointerEvents="box-none" style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => router.back()} style={({ pressed }) => [styles.round, pressed && styles.pressed]}>
            <Text style={styles.roundText}>←</Text>
          </Pressable>
          <View style={styles.titleCard}>
            <Text style={styles.title}>우리 동네 구덩이</Text>
            <Text style={styles.caption}>{capsules.length ? `${capsules.length}개가 묻혀 있어요 · 눌러서 꺼내기` : lastFix ? '마지막으로 확인한 내 위치' : '기본 지도 · 서울'}</Text>
          </View>
        </View>
        <View pointerEvents="box-none" style={styles.side}>
          <Pressable accessibilityRole="button" accessibilityLabel="현재 위치로 이동" disabled={locating} onPress={() => void locate()} style={({ pressed }) => [styles.round, pressed && styles.pressed]}>
            {locating ? <ActivityIndicator color={Colors.earthDark} /> : <Text style={styles.roundText}>⌖</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={perspective === 'quarter' ? '지도를 평면으로 보기' : '지도를 입체로 보기'} onPress={() => setPerspective((value) => (value === 'quarter' ? 'flat' : 'quarter'))} style={({ pressed }) => [styles.round, pressed && styles.pressed]}>
            <Text style={styles.roundLabel}>{perspective === 'quarter' ? '2D' : '3D'}</Text>
          </Pressable>
        </View>
        <View pointerEvents="box-none" style={styles.bottom}>
          {(notice || (!serverOk && error)) && (
            <View style={styles.notice} accessibilityRole="alert">
              <Text style={styles.noticeText}>{notice ?? error}</Text>
              {!serverOk && <Pressable onPress={() => void refresh()}><Text style={styles.noticeLink}>다시 불러오기</Text></Pressable>}
            </View>
          )}
          <Pressable accessibilityRole="button" onPress={() => router.push('/create')} style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}>
            <Text style={styles.createPlus}>＋</Text>
            <Text style={styles.createText}>새 구덩이 파기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D9E7C8' },
  overlay: { ...{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  titleCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 2, borderColor: Colors.earthDark, paddingHorizontal: Spacing.md, paddingVertical: 10, shadowColor: Colors.earthDark, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  title: { color: Colors.ink, fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  caption: { color: Colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  side: { position: 'absolute', right: Spacing.md, top: 110, gap: Spacing.sm },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.earthDark, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  roundText: { color: Colors.earthDark, fontSize: 24, fontWeight: '800', lineHeight: 28 },
  roundLabel: { color: Colors.earthDark, fontSize: 13, fontWeight: '900' },
  bottom: { padding: Spacing.md, gap: Spacing.sm },
  notice: { backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 2, borderColor: Colors.warning, padding: Spacing.md, gap: 6 },
  noticeText: { color: Colors.warning, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  noticeLink: { color: Colors.earthDark, fontSize: 12, fontWeight: '900' },
  createButton: { minHeight: 58, borderRadius: Radius.pill, backgroundColor: Colors.yellow, borderWidth: 2, borderColor: Colors.earthDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, shadowColor: Colors.earthDark, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  createPlus: { color: Colors.earthDark, fontSize: 22, fontWeight: '800' },
  createText: { color: Colors.earthDark, fontSize: 16, fontWeight: '900' },
  pressed: { opacity: 0.75, transform: [{ translateY: 2 }] },
});
