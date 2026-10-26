import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule } from '@/components/capsule';
import { Avatar, AVATAR_TONES, Body, Button, Card, Content, Display, NavBar, Page, Tag } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke } from '@/constants/theme';
import { OPENED_RETENTION_DAYS, addDays, daysUntil, formatKoreanDate, type Capsule as CapsuleModel } from '@/domain/capsule';

export function WaitingScreen({ capsule, now }: { capsule: CapsuleModel; now: Date }) {
  const openAt = capsule.openAt ?? now.toISOString();
  const reminders = [
    { date: addDays(openAt, -7), label: '7일 전 알림' },
    { date: addDays(openAt, -1), label: '하루 전' },
    { date: openAt, label: '당일 아침' },
  ];

  return (
    <Page tone="cyan">
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <NavBar onLeft={() => router.replace('/')} title={<Tag tone="white" icon="lock" label="닫힘" />} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Content style={styles.content}>
            <View style={styles.hero}>
              <Capsule state="buried" size={210} />
              <Text style={styles.title}>{capsule.title}</Text>
              <Display>D-{daysUntil(openAt, now)}</Display>
              <Text style={styles.openAt}>{formatKoreanDate(openAt, true)}에 열려요</Text>
              <Text style={styles.note}>
                {capsule.sealedAt ? `${formatKoreanDate(capsule.sealedAt)}에 닫았어요 · ` : ''}열린 뒤 {OPENED_RETENTION_DAYS}일 동안 볼 수 있어요
              </Text>
            </View>

            <Card style={styles.members}>
              {capsule.members.map((member, index) => (
                <View key={member.id} style={[styles.memberRow, index < capsule.members.length - 1 && styles.memberDivider]}>
                  <Avatar name={member.name} tone={AVATAR_TONES[index % AVATAR_TONES.length]} size={30} />
                  <Text style={styles.memberName}>
                    {member.name}
                    {member.isMe && <Text style={styles.memberMe}> · 나</Text>}
                  </Text>
                  <Text style={styles.memberCount}>{member.items.length}개</Text>
                </View>
              ))}
            </Card>

            <View style={styles.reminders}>
              {reminders.map((reminder) => (
                <Card key={reminder.label} shadow={false} style={styles.reminder}>
                  <Text style={styles.reminderDate}>{formatKoreanDate(reminder.date).replace(/ [일월화수목금토]$/, '')}</Text>
                  <Body size={11}>{reminder.label}</Body>
                </Card>
              ))}
            </View>
          </Content>
        </ScrollView>
        <Content style={styles.footer}>
          <Button label="캘린더에 넣기" icon="calendar" tone="secondary" />
          <Text style={styles.footerNote}>여는 날이 되면 이 자리에 ‘열기’ 버튼이 생겨요</Text>
        </Content>
      </SafeAreaView>
    </Page>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { gap: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
  hero: { alignItems: 'center', gap: 4 },
  title: { fontFamily: Fonts.display, fontSize: 22, color: Colors.ink, textAlign: 'center' },
  openAt: { fontFamily: Fonts.body, fontSize: 14, color: Colors.ink },
  note: { fontFamily: Fonts.body, fontSize: 12, color: Colors.cyanInk, textAlign: 'center' },
  members: { padding: 0, borderRadius: Radius.lg, overflow: 'hidden' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10, paddingHorizontal: Spacing.lg },
  memberDivider: { borderBottomWidth: Stroke.thin, borderBottomColor: Colors.ink },
  memberName: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.ink },
  memberMe: { fontSize: 12, color: Colors.muted },
  memberCount: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted },
  reminders: { flexDirection: 'row', gap: Spacing.sm },
  reminder: { flex: 1, padding: 10, paddingHorizontal: 12, borderRadius: 16, gap: 2 },
  reminderDate: { fontFamily: Fonts.display, fontSize: 14, color: Colors.ink },
  footer: { gap: 6, paddingTop: Spacing.md, paddingBottom: Spacing.md },
  footerNote: { fontFamily: Fonts.body, fontSize: 12, color: Colors.cyanInk, textAlign: 'center' },
});
