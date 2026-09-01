import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DugiMark } from '@/components/dugi-mark';
import { Pill } from '@/components/pill';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>지금 묻고, 그때 만나서 열자.</Text>
              <Text style={styles.brand}>묻어두지</Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>나</Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <Pill label="두지가 보관 중" tone="leaf" />
              <Text style={styles.more}>•••</Text>
            </View>
            <View style={styles.dugiWrap}>
              <View style={styles.groundLine} />
              <DugiMark size={116} mood="sleeping" />
            </View>
            <Text style={styles.heroTitle}>한 달 뒤 우리 예언</Text>
            <Text style={styles.heroMeta}>망원한강공원 · 2026년 10월 3일</Text>

            <View style={styles.countdown}>
              <View>
                <Text style={styles.countdownLabel}>다시 만날 때까지</Text>
                <Text style={styles.countdownValue}>D–32</Text>
              </View>
              <View style={styles.memberBlock}>
                <View style={styles.memberDots}>
                  {['상', '민', '유', '+1'].map((name, index) => (
                    <View key={name} style={[styles.memberDot, { marginLeft: index === 0 ? 0 : -8 }]}>
                      <Text style={styles.memberText}>{name}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.memberCaption}>3/4명 넣었어요</Text>
              </View>
            </View>

            <Pressable onPress={() => router.push('/camera')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>내 예언 몰래 넣기</Text>
              <Text style={styles.primaryButtonIcon}>→</Text>
            </Pressable>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>나의 구덩이</Text>
            <Text style={styles.sectionCaption}>2개</Text>
          </View>

          <Pressable onPress={() => router.push('/pit/first-prophecy')} style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}>
            <View style={styles.listIcon}>
              <Text style={styles.listIconText}>✦</Text>
            </View>
            <View style={styles.listCopy}>
              <Text style={styles.listTitle}>한 달 뒤 우리 예언</Text>
              <Text style={styles.listMeta}>3명이 기다리는 중 · D–32</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <View style={styles.listCard}>
            <View style={[styles.listIcon, styles.openIcon]}>
              <Text style={styles.listIconText}>☀</Text>
            </View>
            <View style={styles.listCopy}>
              <Text style={styles.listTitle}>부산 여행 구덩이</Text>
              <Text style={styles.listMeta}>열어볼 수 있어요 · 4명 필요</Text>
            </View>
            <Pill label="공개 가능" tone="yellow" />
          </View>

          <Pressable onPress={() => router.push('/create')} style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}>
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
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.leaf, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.white, fontSize: 13, fontWeight: '800' },
  heroCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.line, shadowColor: Colors.earthDark, shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  more: { color: Colors.muted, fontSize: 18, letterSpacing: 2 },
  dugiWrap: { height: 148, justifyContent: 'flex-end', alignItems: 'center', overflow: 'hidden', marginTop: Spacing.sm },
  groundLine: { position: 'absolute', bottom: 13, width: '100%', height: 35, borderRadius: 50, backgroundColor: '#E8D4B7' },
  heroTitle: { color: Colors.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.7, textAlign: 'center', marginTop: Spacing.sm },
  heroMeta: { color: Colors.muted, fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 6 },
  countdown: { marginTop: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: Spacing.md },
  countdownLabel: { color: Colors.muted, fontSize: 12, fontWeight: '700' },
  countdownValue: { color: Colors.earthDark, fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  memberBlock: { alignItems: 'flex-end', gap: 5 },
  memberDots: { flexDirection: 'row' },
  memberDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.leafSoft, borderWidth: 2, borderColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  memberText: { color: Colors.leaf, fontSize: 10, fontWeight: '900' },
  memberCaption: { color: Colors.muted, fontSize: 11, fontWeight: '600' },
  primaryButton: { marginTop: Spacing.lg, borderRadius: Radius.md, minHeight: 56, paddingHorizontal: Spacing.md, backgroundColor: Colors.earthDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  primaryButtonIcon: { color: Colors.yellow, fontSize: 22, fontWeight: '700' },
  sectionHeader: { marginTop: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { color: Colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  sectionCaption: { color: Colors.muted, fontSize: 13, fontWeight: '700' },
  listCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.line, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  listIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: Colors.leafSoft, alignItems: 'center', justifyContent: 'center' },
  openIcon: { backgroundColor: '#F9E8B5' },
  listIconText: { color: Colors.earth, fontSize: 19, fontWeight: '800' },
  listCopy: { flex: 1, gap: 4 },
  listTitle: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  listMeta: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  chevron: { color: Colors.soil, fontSize: 28, fontWeight: '300' },
  createButton: { borderRadius: Radius.md, minHeight: 58, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.soil, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  createButtonPlus: { color: Colors.earth, fontSize: 24, fontWeight: '500' },
  createButtonText: { color: Colors.earthDark, fontSize: 15, fontWeight: '800' },
  footerNote: { color: Colors.muted, fontSize: 11, fontWeight: '600', textAlign: 'center', marginVertical: Spacing.lg },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
