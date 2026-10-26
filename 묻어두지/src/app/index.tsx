import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule } from '@/components/capsule';
import { Icon } from '@/components/icons';
import { Button, Card, Content, Page, Tag } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke, offsetShadow } from '@/constants/theme';
import {
  MAX_ITEMS_PER_MEMBER,
  contributingMembers,
  daysUntil,
  deletionDate,
  deriveStatus,
  formatKoreanDate,
  me,
  type Capsule as CapsuleModel,
  type DerivedStatus,
} from '@/domain/capsule';
import { useCapsuleStore } from '@/state/capsule-store';

export default function HomeScreen() {
  const { capsules } = useCapsuleStore();
  const now = new Date();
  const withStatus = capsules.map((capsule) => ({ capsule, status: deriveStatus(capsule, now) }));
  const hero =
    withStatus.find(({ capsule, status }) => status === 'collecting' && (me(capsule)?.items.length ?? 0) < MAX_ITEMS_PER_MEMBER) ??
    withStatus.find(({ status }) => status === 'unlockable') ??
    withStatus[0];
  const rest = withStatus.filter((entry) => entry !== hero);

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Content style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.brand}>묻어두지</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="내 계정" style={[styles.account, offsetShadow(3)]}>
                <Text style={styles.accountLabel}>상</Text>
              </Pressable>
            </View>

            {hero && <HeroCard capsule={hero.capsule} status={hero.status} now={now} />}

            {rest.length > 0 && (
              <View style={styles.list}>
                <Text style={styles.sectionTitle}>내 캡슐들</Text>
                {rest.map(({ capsule, status }) => (
                  <ListRow key={capsule.id} capsule={capsule} status={status} now={now} />
                ))}
              </View>
            )}

            {capsules.length === 0 && (
              <View style={styles.empty}>
                <Capsule state="closed" size={180} />
                <Text style={styles.emptyTitle}>첫 캡슐을 묻어볼까요?</Text>
              </View>
            )}
          </Content>
        </ScrollView>
        <Content style={styles.footer}>
          <Button label="새 캡슐 묻기" icon="plus" onPress={() => router.push('/create')} />
        </Content>
      </SafeAreaView>
    </Page>
  );
}

function HeroCard({ capsule, status, now }: { capsule: CapsuleModel; status: DerivedStatus; now: Date }) {
  const mine = me(capsule);
  const mineCount = mine?.items.length ?? 0;
  const filled = contributingMembers(capsule).length;
  const openable = status === 'unlockable';
  return (
    <Card onPress={() => router.push({ pathname: '/capsule/[id]', params: { id: capsule.id } })} style={[styles.hero, offsetShadow(6)]}>
      <View style={styles.rowBetween}>
        {status === 'collecting' && <Tag tone="yellow" label={`채우는 중 · 마감 D-${daysUntil(capsule.deadlineAt, now)}`} />}
        {openable && <Tag tone="sky" label="오늘 열 수 있어요!" />}
        {status === 'sealed' && <Tag tone="white" icon="lock" label="닫힘" />}
        {status === 'opened' && <Tag tone="mint" label="열렸어요" />}
        {status === 'collecting' && (
          <Text style={styles.heroCount}>
            {filled}/{capsule.members.length}명 넣음
          </Text>
        )}
      </View>
      <View style={styles.heroBody}>
        <Capsule state={status === 'opened' ? 'open' : status === 'sealed' ? 'buried' : 'closed'} size={124} />
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>{capsule.title}</Text>
          <Text style={styles.heroMeta}>
            {status === 'collecting' && `${formatKoreanDate(capsule.deadlineAt)}까지 넣을 수 있어요`}
            {status === 'sealed' && capsule.openAt && `${formatKoreanDate(capsule.openAt, true)}에 열려요`}
            {openable && '친구들이 기다리고 있어요'}
            {status === 'opened' && capsule.openedAt && `${formatKoreanDate(deletionDate(capsule.openedAt))}에 사라져요`}
          </Text>
        </View>
      </View>
      {status === 'collecting' && (
        <View style={styles.slotRow}>
          <View style={styles.slots}>
            {Array.from({ length: MAX_ITEMS_PER_MEMBER }).map((_, index) => (
              <View key={index} style={[styles.slot, index < mineCount ? (index % 2 === 0 ? styles.slotSky : styles.slotYellow) : styles.slotEmpty]} />
            ))}
          </View>
          <Text style={styles.slotLabel}>
            내 자리 {mineCount}/{MAX_ITEMS_PER_MEMBER} · 더 넣기 →
          </Text>
        </View>
      )}
    </Card>
  );
}

function ListRow({ capsule, status, now }: { capsule: CapsuleModel; status: DerivedStatus; now: Date }) {
  const openable = status === 'unlockable';
  return (
    <Card tone={openable ? 'sky' : 'white'} onPress={() => router.push({ pathname: '/capsule/[id]', params: { id: capsule.id } })} style={styles.row}>
      <Capsule state={status === 'opened' ? 'open' : status === 'sealed' ? 'buried' : 'closed'} size={52} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{capsule.title}</Text>
        <Text style={[styles.rowMeta, openable && { color: Colors.ink }]}>
          {status === 'collecting' && `채우는 중 · ${formatKoreanDate(capsule.deadlineAt)}까지`}
          {status === 'sealed' && capsule.openAt && `닫힘 · ${formatKoreanDate(capsule.openAt)} 저녁에 열려요`}
          {openable && capsule.openAt && `오늘 ${formatKoreanDate(capsule.openAt, true).slice(-5)}부터 열 수 있어요!`}
          {status === 'opened' && capsule.openedAt && `열렸어요 · ${daysUntil(deletionDate(capsule.openedAt), now)}일 뒤 사라져요`}
        </Text>
      </View>
      {status === 'sealed' && capsule.openAt && <Text style={[styles.rowDay, { color: Colors.muted }]}>D-{daysUntil(capsule.openAt, now)}</Text>}
      {openable && <Text style={styles.rowDay}>D-0</Text>}
      {status === 'collecting' && capsule.deadlineAt && <Text style={styles.rowDay}>D-{daysUntil(capsule.deadlineAt, now)}</Text>}
      {status === 'opened' && <Icon name="chevron" />}
    </Card>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { gap: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: Fonts.display, fontSize: 28, color: Colors.ink },
  account: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.yellow, borderWidth: Stroke.regular, borderColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  accountLabel: { fontFamily: Fonts.display, fontSize: 15, color: Colors.ink },
  hero: { borderRadius: Radius.xl, padding: 18, gap: Spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroCount: { fontFamily: Fonts.display, fontSize: 14, color: Colors.cyan },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  heroCopy: { flex: 1, gap: 6 },
  heroTitle: { fontFamily: Fonts.display, fontSize: 25, lineHeight: 29, color: Colors.ink },
  heroMeta: { fontFamily: Fonts.body, fontSize: 13, color: Colors.muted },
  slotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 16, backgroundColor: Colors.cream, borderWidth: Stroke.thin, borderColor: Colors.ink },
  slots: { flexDirection: 'row', gap: 6 },
  slot: { width: 18, height: 18, borderRadius: 9, borderWidth: Stroke.thin, borderColor: Colors.ink },
  slotSky: { backgroundColor: Colors.sky },
  slotYellow: { backgroundColor: Colors.yellow },
  slotEmpty: { borderStyle: 'dashed' },
  slotLabel: { fontFamily: Fonts.display, fontSize: 14, color: Colors.ink },
  list: { gap: Spacing.md },
  sectionTitle: { fontFamily: Fonts.display, fontSize: 18, color: Colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: 12, paddingRight: 16, borderRadius: 20 },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: Fonts.display, fontSize: 18, color: Colors.ink },
  rowMeta: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted },
  rowDay: { fontFamily: Fonts.display, fontSize: 22, color: Colors.ink },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  emptyTitle: { fontFamily: Fonts.display, fontSize: 20, color: Colors.ink },
  footer: { paddingTop: Spacing.md, paddingBottom: Spacing.md },
});
