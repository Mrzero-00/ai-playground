import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule } from '@/components/capsule';
import { Icon } from '@/components/icons';
import { Body, Button, Card, Content, NavBar, Page, Tag } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { MAX_ITEMS_PER_MEMBER, contributingMembers, daysUntil, deletionDate, deriveStatus, formatKoreanDate, me, type Capsule as CapsuleModel, type DerivedStatus } from '@/domain/capsule';
import { useCapsuleStore } from '@/state/capsule-store';

/** 초대받은 캡슐 목록: 내가 들어 있는 캡슐 전부, 할 일이 있는 것부터. */
export default function CapsuleListScreen() {
  const { capsules } = useCapsuleStore();
  const now = new Date();
  const rank: Record<DerivedStatus, number> = { unlockable: 0, collecting: 1, sealed: 2, opened: 3 };
  const rows = capsules
    .map((capsule) => ({ capsule, status: deriveStatus(capsule, now) }))
    .sort((a, b) => rank[a.status] - rank[b.status]);

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <NavBar title="내 캡슐" onLeft={() => router.replace('/')} right={<Button compact tone="yellow" label="코드 입력" onPress={() => router.push('/join')} />} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Content style={styles.content}>
            {rows.length === 0 && (
              <View style={styles.empty}>
                <Capsule state="closed" size={160} />
                <Text style={styles.emptyTitle}>아직 캡슐이 없어요</Text>
                <Body center>직접 만들거나 친구의 초대 코드로 들어오면 여기에 나타나요.</Body>
              </View>
            )}
            {rows.map(({ capsule, status }) => (
              <Row key={capsule.id} capsule={capsule} status={status} now={now} />
            ))}
          </Content>
        </ScrollView>
      </SafeAreaView>
    </Page>
  );
}

function Row({ capsule, status, now }: { capsule: CapsuleModel; status: DerivedStatus; now: Date }) {
  const mine = me(capsule);
  const mineCount = mine?.items.length ?? 0;
  const openable = status === 'unlockable';
  const needsMine = status === 'collecting' && mineCount < MAX_ITEMS_PER_MEMBER;
  return (
    <Card tone={openable ? 'sky' : needsMine ? 'yellow' : 'white'} onPress={() => router.push({ pathname: '/capsule/[id]', params: { id: capsule.id } })} style={styles.row}>
      <Capsule state={status === 'opened' ? 'open' : status === 'sealed' ? 'buried' : 'closed'} size={56} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {capsule.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {status === 'collecting' && `채우는 중 · ${contributingMembers(capsule).length}/${capsule.members.length}명 넣음 · 내 자리 ${mineCount}/${MAX_ITEMS_PER_MEMBER}`}
          {status === 'sealed' && capsule.openAt && `닫힘 · ${formatKoreanDate(capsule.openAt, true)}에 열려요`}
          {openable && '오늘 열 수 있어요!'}
          {status === 'opened' && capsule.openedAt && `열렸어요 · ${daysUntil(deletionDate(capsule.openedAt), now)}일 뒤 사라져요`}
        </Text>
        <View style={styles.tags}>
          {status === 'collecting' && <Tag tone="white" label={`마감 D-${daysUntil(capsule.deadlineAt, now)}`} />}
          {status === 'sealed' && capsule.openAt && <Tag tone="white" icon="lock" label={`D-${daysUntil(capsule.openAt, now)}`} />}
          {openable && <Tag tone="yellow" label="D-0" />}
          {status === 'opened' && <Tag tone="mint" label="열림" />}
          {capsule.mode === 'solo' && <Tag tone="white" label="혼자" />}
          {capsule.location && <Tag tone="white" icon="map" label={capsule.location.label} />}
        </View>
      </View>
      <Icon name="chevron" />
    </Card>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { gap: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.xl },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl },
  emptyTitle: { fontFamily: Fonts.display, fontSize: 20, color: Colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: 12, paddingRight: 16, borderRadius: Radius.lg },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { fontFamily: Fonts.display, fontSize: 18, color: Colors.ink },
  rowMeta: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
});
