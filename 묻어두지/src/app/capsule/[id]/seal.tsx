import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule } from '@/components/capsule';
import { Avatar, AVATAR_TONES, Body, Button, Card, Content, NavBar, Page, Tag, Title } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke } from '@/constants/theme';
import { MAX_ITEMS_PER_MEMBER, canSeal, contributingMembers, formatKoreanDate, totalItems } from '@/domain/capsule';
import { useCapsuleStore } from '@/state/capsule-store';

/** 방장이 직접 닫는 확인 화면. 여는 날은 만들 때 정했으니 보여주기만 한다. */
export default function SealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCapsule, sealCapsule } = useCapsuleStore();
  const capsule = id ? getCapsule(id) : null;

  if (!capsule) return null;
  const sealable = canSeal(capsule);
  const contributors = contributingMembers(capsule).length;
  const idle = capsule.members.filter((member) => member.items.length === 0);

  function seal() {
    if (!capsule || !sealCapsule(capsule.id)) return;
    router.replace({ pathname: '/capsule/[id]', params: { id: capsule.id } });
  }

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <NavBar title="캡슐 닫기" />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Content style={styles.content}>
            <View style={styles.hero}>
              <Capsule state="closed" size={190} />
              <Title size={24}>지금 닫을까요?</Title>
              <Body center>닫히면 나를 포함해 아무도 안을 볼 수 없고, 더 넣을 수도 없어요.</Body>
            </View>

            <Card shadow={false} style={styles.facts}>
              <View style={[styles.fact, styles.factDivider]}>
                <Text style={styles.factLabel}>여는 날</Text>
                <Text style={styles.factValue}>{capsule.openAt ? formatKoreanDate(capsule.openAt, true) : '—'}</Text>
              </View>
              <View style={[styles.fact, styles.factDivider]}>
                <Text style={styles.factLabel}>안에 든 것</Text>
                <Text style={styles.factValue}>
                  {contributors}명 · {totalItems(capsule)}개
                </Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>원래 마감</Text>
                <Text style={styles.factValue}>{formatKoreanDate(capsule.deadlineAt, true)}</Text>
              </View>
            </Card>

            <View style={styles.members}>
              {capsule.members.map((member, index) => (
                <View key={member.id} style={styles.memberRow}>
                  <Avatar name={member.name} tone={AVATAR_TONES[index % AVATAR_TONES.length]} size={30} />
                  <Text style={styles.memberName}>
                    {member.name}
                    {member.isMe && <Text style={styles.memberMe}> · 나</Text>}
                  </Text>
                  <Tag tone={member.items.length === 0 ? 'dashed' : member.items.length >= MAX_ITEMS_PER_MEMBER ? 'mint' : 'white'} label={`${member.items.length} / ${MAX_ITEMS_PER_MEMBER}`} />
                </View>
              ))}
            </View>

            {idle.length > 0 && sealable && <Body size={12}>{idle.map((member) => member.name).join(', ')}은(는) 아직 아무것도 안 넣었어요. 지금 닫으면 빈손으로 열게 돼요.</Body>}
            {!sealable && <Body size={12}>{capsule.mode === 'solo' ? '아직 아무것도 안 넣었어요. 하나라도 넣어야 닫을 수 있어요.' : `물건을 넣은 사람이 ${contributors}명뿐이에요. 2명 이상 넣어야 닫을 수 있어요.`}</Body>}
          </Content>
        </ScrollView>
        <Content style={styles.footer}>
          <Button label="닫고 묻어두기" icon="lock" onPress={seal} disabled={!sealable} />
          <Button label="조금 더 기다릴게요" tone="ghost" onPress={() => router.back()} />
        </Content>
      </SafeAreaView>
    </Page>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { gap: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
  hero: { alignItems: 'center', gap: Spacing.sm },
  facts: { padding: 0, overflow: 'hidden', borderRadius: Radius.lg },
  fact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: Spacing.lg },
  factDivider: { borderBottomWidth: Stroke.thin, borderBottomColor: Colors.ink },
  factLabel: { fontFamily: Fonts.body, fontSize: 13, color: Colors.muted },
  factValue: { fontFamily: Fonts.display, fontSize: 15, color: Colors.ink },
  members: { gap: Spacing.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 4 },
  memberName: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.ink },
  memberMe: { fontSize: 12, color: Colors.muted },
  footer: { gap: 4, paddingTop: Spacing.md, paddingBottom: Spacing.md },
});
