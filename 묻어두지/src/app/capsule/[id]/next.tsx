import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule } from '@/components/capsule';
import { Icon } from '@/components/icons';
import { Avatar, AVATAR_TONES, Body, Button, Card, Chip, Content, NavBar, Page, Title } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke } from '@/constants/theme';
import { OPEN_DAY_OPTIONS, addDays, formatKoreanDate, totalItems } from '@/domain/capsule';
import { useCapsuleStore } from '@/state/capsule-store';

export default function NextCapsuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCapsule } = useCapsuleStore();
  const capsule = id ? getCapsule(id) : null;
  const [quick, setQuick] = useState<number>(60);
  const [sameFriends, setSameFriends] = useState(true);

  if (!capsule) return null;

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <NavBar left="none" right={<Button compact tone="ghost" label="이번엔 건너뛰기" onPress={() => router.replace('/')} />} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Content style={styles.content}>
            <View style={styles.intro}>
              <Capsule state="closed" size={120} />
              <View style={styles.introCopy}>
                <View style={styles.avatars}>
                  {capsule.members.map((member, index) => (
                    <View key={member.id} style={index > 0 && styles.avatarOverlap}>
                      <Avatar name={member.name} tone={AVATAR_TONES[index % AVATAR_TONES.length]} size={28} />
                    </View>
                  ))}
                  <Text style={styles.avatarCaption}>{totalItems(capsule)}개를 다 꺼냈어요</Text>
                </View>
                <Title>이 친구들과 한 번 더 묻을까요?</Title>
              </View>
            </View>
            <Body>열어본 바로 지금이 다음 약속을 잡기 가장 쉬운 때예요. 날짜만 먼저 정해요.</Body>

            <View style={styles.field}>
              <Text style={styles.label}>다음엔 언제 열까요</Text>
              <View style={styles.chips}>
                {OPEN_DAY_OPTIONS.map((days) => (
                  <Chip key={days} label={`${days}일`} selected={quick === days} onPress={() => setQuick(days)} style={styles.chip} />
                ))}
              </View>
              <Text style={styles.when}>
                <Text style={styles.whenStrong}>{formatKoreanDate(addDays(new Date().toISOString(), quick))}</Text>쯤 · 닫을 때 정확히 정해요
              </Text>
            </View>

            <Card shadow={false} style={styles.options}>
              <View style={[styles.option, styles.optionDivider]}>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>같은 친구들 {capsule.members.length}명</Text>
                  <Body size={12}>초대 링크를 바로 보내요</Body>
                </View>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: sameFriends }}
                  accessibilityLabel="같은 친구들 복사"
                  onPress={() => setSameFriends((value) => !value)}
                  style={[styles.toggle, sameFriends && styles.toggleOn]}>
                  <View style={[styles.knob, sameFriends && styles.knobOn]} />
                </Pressable>
              </View>
              <View style={styles.option}>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>이번 물건은 가져가지 않아요</Text>
                  <Body size={12}>편지·사진은 새로 넣어요</Body>
                </View>
                <Icon name="check" color={Colors.mint} strokeWidth={3} />
              </View>
            </Card>
          </Content>
        </ScrollView>
        <Content style={styles.footer}>
          <Button label="새 캡슐 만들기" icon="arrow" onPress={() => router.replace('/create')} />
          <Button label="꺼낸 물건 다시 보기" tone="ghost" onPress={() => router.back()} />
        </Content>
      </SafeAreaView>
    </Page>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { gap: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
  intro: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  introCopy: { flex: 1, gap: 6 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarOverlap: { marginLeft: -8 },
  avatarCaption: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted, marginLeft: 8 },
  field: { gap: Spacing.sm },
  label: { fontFamily: Fonts.display, fontSize: 15, color: Colors.ink },
  chips: { flexDirection: 'row', gap: Spacing.sm },
  chip: { flex: 1 },
  when: { fontFamily: Fonts.body, fontSize: 13, color: Colors.muted },
  whenStrong: { fontFamily: Fonts.display, color: Colors.ink },
  options: { padding: 0, overflow: 'hidden', borderRadius: Radius.lg },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, padding: 14, paddingHorizontal: Spacing.lg },
  optionDivider: { borderBottomWidth: Stroke.thin, borderBottomColor: Colors.ink },
  optionCopy: { flex: 1, gap: 2 },
  optionTitle: { fontFamily: Fonts.display, fontSize: 15, color: Colors.ink },
  toggle: { width: 52, height: 30, borderRadius: 15, borderWidth: Stroke.regular, borderColor: Colors.ink, backgroundColor: Colors.white, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: Colors.sky },
  knob: { width: 21, height: 21, borderRadius: 11, backgroundColor: Colors.white, borderWidth: Stroke.thin, borderColor: Colors.ink },
  knobOn: { alignSelf: 'flex-end' },
  footer: { gap: 4, paddingTop: Spacing.md, paddingBottom: Spacing.md },
});
