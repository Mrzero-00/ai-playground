import * as ExpoLinking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule } from '@/components/capsule';
import { Avatar, AVATAR_TONES, Body, Button, Card, Content, NavBar, Page, Title } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke, offsetShadow } from '@/constants/theme';
import { MAX_MEMBERS, canSeal, formatKoreanDate } from '@/domain/capsule';
import { useCapsuleStore } from '@/state/capsule-store';

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCapsule } = useCapsuleStore();
  const capsule = id ? getCapsule(id) : null;
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!capsule) return null;
  const seatsLeft = MAX_MEMBERS - capsule.members.length;
  const host = capsule.members.find((member) => member.isHost);
  const isHost = host?.isMe ?? false;

  async function share() {
    if (!capsule) return;
    const url = ExpoLinking.createURL(`/i/${capsule.id}`);
    setFeedback(null);
    try {
      await Share.share({ title: `${capsule.title} 초대`, message: `묻어두지에서 같이 캡슐 묻을래? 초대 코드 ${capsule.inviteCode} · ${url}`, url });
    } catch {
      if (Platform.OS === 'web' && globalThis.navigator?.clipboard) {
        try {
          await globalThis.navigator.clipboard.writeText(url);
          setFeedback('공유창을 열 수 없어 초대 링크를 복사했어요.');
          return;
        } catch {
          // fall through
        }
      }
      setFeedback(`공유를 열지 못했어요. 아래 링크를 복사해 주세요.\n${url}`);
    }
  }

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <NavBar title="친구 초대" right={<Button compact tone="ghost" label="나중에" onPress={() => router.back()} />} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Content style={styles.content}>
            <View style={styles.intro}>
              <Title>같이 묻을 친구를 불러요</Title>
              <Body>링크를 받은 친구는 앱 없이도 바로 넣을 수 있어요. 받는 사람에게는 아래 카드만 보여요.</Body>
            </View>

            <View style={[styles.codeBox, offsetShadow(4)]}>
              <View style={styles.codeCopy}>
                <Text style={styles.codeLabel}>초대 코드 · 앱에서 넣으면 바로 들어와요</Text>
                <Text style={styles.code}>{capsule.inviteCode}</Text>
              </View>
            </View>

            <Card tone="sky" style={[styles.invite, offsetShadow(6)]}>
              <View style={styles.inviteHeader}>
                <Text style={styles.inviteBrand}>묻어두지 초대</Text>
                <Text style={styles.inviteFrom}>{host ? `${host.name.slice(0, 1)}○ 님이` : ''}</Text>
              </View>
              <View style={styles.inviteBody}>
                <Capsule state="closed" size={84} />
                <Text style={styles.inviteTitle}>{capsule.title}</Text>
              </View>
              <View style={styles.inviteFacts}>
                <View>
                  <Text style={styles.factLabel}>넣기 마감</Text>
                  <Text style={styles.factValue}>{formatKoreanDate(capsule.deadlineAt)}</Text>
                </View>
                <View>
                  <Text style={styles.factLabel}>지금</Text>
                  <Text style={styles.factValue}>
                    {capsule.members.length}명 · {seatsLeft}자리 남음
                  </Text>
                </View>
              </View>
            </Card>

            <View style={styles.members}>
              <Text style={styles.sectionTitle}>지금 함께하는 친구</Text>
              <Card shadow={false} style={styles.memberCard}>
                {capsule.members.map((member, index) => (
                  <View key={member.id} style={[styles.memberRow, index < capsule.members.length - 1 && styles.memberDivider]}>
                    <Avatar name={member.name} tone={AVATAR_TONES[index % AVATAR_TONES.length]} />
                    <Text style={styles.memberName}>
                      {member.name}
                      {(member.isMe || member.isHost) && (
                        <Text style={styles.memberMeta}>
                          {member.isMe ? ' · 나' : ''}
                          {member.isHost ? ' · 방장' : ''}
                        </Text>
                      )}
                    </Text>
                    <Text style={styles.memberCount}>{member.items.length}개 넣음</Text>
                  </View>
                ))}
              </Card>
            </View>
            {feedback && (
              <Text selectable style={styles.feedback}>
                {feedback}
              </Text>
            )}
          </Content>
        </ScrollView>
        <Content style={styles.footer}>
          <Button label="초대 링크 보내기" icon="share" onPress={share} />
          {isHost && canSeal(capsule) ? (
            <Button label="지금 닫기" tone="ghost" onPress={() => router.push({ pathname: '/capsule/[id]/seal', params: { id: capsule.id } })} />
          ) : (
            <Body size={12} center>물건을 넣은 사람이 2명 이상이면 방장이 닫을 수 있어요.</Body>
          )}
        </Content>
      </SafeAreaView>
    </Page>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { gap: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.lg },
  intro: { gap: 6 },
  codeBox: { padding: 14, paddingLeft: 18, borderRadius: Radius.lg, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink },
  codeCopy: { gap: 2 },
  codeLabel: { fontFamily: Fonts.body, fontSize: 11, color: Colors.muted },
  code: { fontFamily: Fonts.display, fontSize: 30, letterSpacing: 4, color: Colors.ink },
  invite: { gap: Spacing.md, borderRadius: Radius.xl, padding: 18 },
  inviteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inviteBrand: { fontFamily: Fonts.display, fontSize: 14, color: Colors.ink },
  inviteFrom: { fontFamily: Fonts.body, fontSize: 12, color: Colors.ink },
  inviteBody: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inviteTitle: { flex: 1, fontFamily: Fonts.display, fontSize: 22, lineHeight: 27, color: Colors.ink },
  inviteFacts: { flexDirection: 'row', gap: Spacing.lg, padding: 12, borderRadius: Radius.sm, backgroundColor: Colors.white, borderWidth: Stroke.thin, borderColor: Colors.ink },
  factLabel: { fontFamily: Fonts.body, fontSize: 11, color: Colors.muted },
  factValue: { fontFamily: Fonts.display, fontSize: 14, color: Colors.ink },
  members: { gap: Spacing.sm },
  sectionTitle: { fontFamily: Fonts.display, fontSize: 16, color: Colors.ink },
  memberCard: { padding: 0, overflow: 'hidden', borderRadius: Radius.lg },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 12, paddingHorizontal: Spacing.lg },
  memberDivider: { borderBottomWidth: Stroke.thin, borderBottomColor: Colors.ink },
  memberName: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.ink },
  memberMeta: { fontSize: 12, color: Colors.muted },
  memberCount: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted },
  feedback: { fontFamily: Fonts.body, fontSize: 12, lineHeight: 18, color: Colors.muted, textAlign: 'center' },
  footer: { gap: 4, paddingTop: Spacing.md, paddingBottom: Spacing.md },
});
