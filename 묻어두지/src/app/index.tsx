import { router } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DugiMark } from '@/components/dugi-mark';
import { Pill } from '@/components/pill';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { capsuleState, dDayLabel, revealDateLabel, sortNewestFirst } from '@/lib/capsule-countdown';
import { useCapsuleStore } from '@/state/capsule-store';

export default function HomeScreen() {
  const { capsules, loading, serverOk, error, now, refresh } = useCapsuleStore();
  const ordered = sortNewestFirst(capsules);
  const featured = ordered.find((capsule) => capsuleState(capsule, now) === 'ready') ?? ordered[0] ?? null;
  const featuredState = featured ? capsuleState(featured, now) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={Colors.earth} />}>
        <View style={styles.page}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>지금 묻고, 그때 만나서 열자.</Text>
              <Text style={styles.brand}>묻어두지</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="동네 지도 열기" onPress={() => router.push('/map')} style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}>
              <Text style={styles.mapButtonIcon}>⌖</Text>
              <Text style={styles.mapButtonText}>지도</Text>
            </Pressable>
          </View>

          {featured ? (
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <Pill label={featuredState === 'ready' ? '열어볼 시간!' : featuredState === 'opened' ? '열어본 캡슐' : '두지가 보관 중'} tone={featuredState === 'ready' ? 'yellow' : 'leaf'} />
                <Text style={styles.heroDay}>{dDayLabel(featured, now)}</Text>
              </View>
              <View style={styles.dugiWrap}>
                <View style={styles.groundLine} />
                <DugiMark size={116} mood={featuredState === 'ready' ? 'awake' : 'sleeping'} />
              </View>
              <Text style={styles.heroTitle}>{featured.title}</Text>
              <Text style={styles.heroMeta}>{featured.placeName} · {revealDateLabel(featured.opensAt, now)}</Text>
              <Pressable accessibilityRole="button"
                onPress={() => router.push({ pathname: featuredState === 'ready' ? '/open/[id]' : '/pit/[id]', params: { id: featured.id } })}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>{featuredState === 'ready' ? '현장에서 AR로 꺼내기' : '구덩이 들여다보기'}</Text>
                <Text style={styles.primaryButtonIcon}>→</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.heroCard}>
              <View style={styles.dugiWrap}>
                <View style={styles.groundLine} />
                <DugiMark size={116} mood="sleeping" />
              </View>
              <Text style={styles.heroTitle}>{serverOk ? '아직은 깨끗한 땅이에요' : '두지가 서버를 찾는 중'}</Text>
              <Text style={styles.heroMeta}>{serverOk ? '첫 구덩이를 파고 미래의 우리에게 남겨요.' : error ?? '같은 Wi-Fi의 개발 서버에 연결해요.'}</Text>
              {!serverOk && (
                <Pressable accessibilityRole="button" onPress={() => void refresh()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                  {loading ? <ActivityIndicator color={Colors.earthDark} /> : <Text style={styles.secondaryButtonText}>다시 연결하기</Text>}
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>나의 구덩이</Text>
            <Text style={styles.sectionCaption}>{capsules.length}개</Text>
          </View>

          {ordered.map((capsule) => {
            const state = capsuleState(capsule, now);
            return (
              <Pressable accessibilityRole="button" key={capsule.id} onPress={() => router.push({ pathname: '/pit/[id]', params: { id: capsule.id } })} style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}>
                <View style={[styles.listIcon, state === 'ready' && styles.openIcon, state === 'opened' && styles.openedIcon]}>
                  <Text style={styles.listIconText}>{state === 'ready' ? '☀' : state === 'opened' ? '✓' : '✦'}</Text>
                </View>
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle} numberOfLines={1}>{capsule.title}</Text>
                  <Text style={styles.listMeta} numberOfLines={1}>
                    {state === 'ready' ? '열어볼 수 있어요' : state === 'opened' ? '열어본 캡슐' : `${capsule.participantCount && capsule.participantCount > 1 ? `${capsule.participantCount}명이 기다리는 중` : '기다리는 중'}`} · {capsule.placeName}
                  </Text>
                </View>
                {state === 'ready' ? <Pill label="공개 가능" tone="yellow" /> : <Text style={styles.listDay}>{dDayLabel(capsule, now)}</Text>}
              </Pressable>
            );
          })}

          <Pressable accessibilityRole="button" onPress={() => router.push('/create')} style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}>
            <Text style={styles.createButtonPlus}>＋</Text>
            <Text style={styles.createButtonText}>새 구덩이 파기</Text>
          </Pressable>

          <Text style={styles.footerNote}>앱을 닫고, 친구를 만나러 가게 만드는 중.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.canvas },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  page: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.lg, gap: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  eyebrow: { color: Colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 3 },
  brand: { color: Colors.earthDark, fontSize: 30, fontWeight: '900', letterSpacing: -1.3 },
  mapButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: Radius.pill, backgroundColor: Colors.leafSoft, borderWidth: 2, borderColor: Colors.leaf, flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapButtonIcon: { color: Colors.leaf, fontSize: 18, fontWeight: '900' },
  mapButtonText: { color: Colors.leaf, fontSize: 13, fontWeight: '900' },
  heroCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.line, shadowColor: Colors.earthDark, shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroDay: { color: Colors.earthDark, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  dugiWrap: { height: 148, justifyContent: 'flex-end', alignItems: 'center', overflow: 'hidden', marginTop: Spacing.sm },
  groundLine: { position: 'absolute', bottom: 13, width: '100%', height: 35, borderRadius: 50, backgroundColor: '#E8D4B7' },
  heroTitle: { color: Colors.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.7, textAlign: 'center', marginTop: Spacing.sm },
  heroMeta: { color: Colors.muted, fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  primaryButton: { marginTop: Spacing.lg, borderRadius: Radius.md, minHeight: 56, paddingHorizontal: Spacing.md, backgroundColor: Colors.earthDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  primaryButtonIcon: { color: Colors.yellow, fontSize: 22, fontWeight: '700' },
  secondaryButton: { marginTop: Spacing.md, minHeight: 48, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: Colors.earthDark, fontSize: 14, fontWeight: '900' },
  sectionHeader: { marginTop: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { color: Colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  sectionCaption: { color: Colors.muted, fontSize: 13, fontWeight: '700' },
  listCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.line, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  listIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: Colors.leafSoft, alignItems: 'center', justifyContent: 'center' },
  openIcon: { backgroundColor: '#F9E8B5' },
  openedIcon: { backgroundColor: Colors.line },
  listIconText: { color: Colors.earth, fontSize: 19, fontWeight: '800' },
  listCopy: { flex: 1, gap: 4 },
  listTitle: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  listMeta: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  listDay: { color: Colors.earthDark, fontSize: 15, fontWeight: '900' },
  createButton: { borderRadius: Radius.md, minHeight: 58, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.soil, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  createButtonPlus: { color: Colors.earth, fontSize: 24, fontWeight: '500' },
  createButtonText: { color: Colors.earthDark, fontSize: 15, fontWeight: '800' },
  footerNote: { color: Colors.muted, fontSize: 11, fontWeight: '600', textAlign: 'center', marginVertical: Spacing.lg },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
