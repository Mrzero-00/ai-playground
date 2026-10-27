import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule } from '@/components/capsule';
import { Avatar, AVATAR_TONES, Body, Button, Card, Content, NavBar, Page, Tag } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { formatKoreanDate, type Capsule as CapsuleModel } from '@/domain/capsule';
import { useCapsuleStore } from '@/state/capsule-store';

export function UnlockScreen({ capsule }: { capsule: CapsuleModel }) {
  const { profile } = useCapsuleStore();
  const online = capsule.members.slice(0, Math.max(1, capsule.members.length - 1));
  const offline = capsule.members.slice(online.length);
  const sealedDays = capsule.sealedAt && capsule.openAt ? Math.round((new Date(capsule.openAt).getTime() - new Date(capsule.sealedAt).getTime()) / 86_400_000) : null;

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.yellow} />
        <NavBar onLeft={() => router.replace('/')} title={<Tag tone="sky" label="오늘 열 수 있어요!" />} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Content style={styles.content}>
            <View style={styles.hero}>
              <Capsule state="closed" size={230} />
              <Text style={styles.kicker}>D-0 · {capsule.openAt ? formatKoreanDate(capsule.openAt, true).slice(-5) : ''} 지남</Text>
              <Text style={styles.title}>{sealedDays ? `${sealedDays}일이 지났어요.\n이제 열어볼까요?` : '이제 열어볼까요?'}</Text>
            </View>
            <Body size={13} center>
              {capsule.title}
              {capsule.sealedAt ? ` · ${formatKoreanDate(capsule.sealedAt)}에 닫음` : ''}
            </Body>

            <Card style={styles.presence}>
              <View style={styles.presenceHeader}>
                <Text style={styles.presenceTitle}>지금 함께 보고 있어요</Text>
                <Text style={styles.presenceCount}>
                  {online.length} / {capsule.members.length}
                </Text>
              </View>
              <View style={styles.avatars}>
                {online.map((member, index) => (
                  <Avatar key={member.id} name={member.name} tone={member.isMe ? profile.tone : AVATAR_TONES[index % AVATAR_TONES.length]} size={36} />
                ))}
                {offline.map((member) => (
                  <Avatar key={member.id} name={member.name} tone="empty" size={36} />
                ))}
                <View style={styles.spacer} />
                {offline[0] && <Button compact tone="secondary" label={`${offline[0].name} 부르기`} />}
              </View>
              <Body size={12}>누가 열면 지금 보고 있는 모두에게 같은 10초가 시작돼요. 늦게 온 친구는 열린 캡슐을 바로 봐요.</Body>
            </Card>
          </Content>
        </ScrollView>
        <Content style={styles.footer}>
          {capsule.location && (
            <Button compact tone="yellow" icon="photo" label={`카메라로 찾기 · ${capsule.location.label}`} onPress={() => router.push({ pathname: '/capsule/[id]/find', params: { id: capsule.id } })} />
          )}
          <Button label="지금 함께 열기" icon="lock" onPress={() => router.push({ pathname: '/capsule/[id]/countdown', params: { id: capsule.id } })} />
          <Button label="조금만 더 기다릴게요" tone="ghost" onPress={() => router.replace('/')} />
        </Content>
      </SafeAreaView>
    </Page>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  yellow: { position: 'absolute', left: 0, right: 0, top: 0, height: 440, backgroundColor: Colors.yellow, borderBottomWidth: 2.5, borderBottomColor: Colors.ink },
  scroll: { flexGrow: 1 },
  content: { gap: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
  hero: { alignItems: 'center', gap: 4 },
  kicker: { fontFamily: Fonts.display, fontSize: 14, color: Colors.ink },
  title: { fontFamily: Fonts.display, fontSize: 28, lineHeight: 34, color: Colors.ink, textAlign: 'center', marginTop: 4 },
  presence: { gap: Spacing.md, borderRadius: Radius.lg, padding: 18 },
  presenceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  presenceTitle: { fontFamily: Fonts.display, fontSize: 15, color: Colors.ink },
  presenceCount: { fontFamily: Fonts.display, fontSize: 15, color: Colors.cyan },
  avatars: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spacer: { flex: 1 },
  footer: { gap: 4, paddingTop: Spacing.md, paddingBottom: Spacing.md },
});
