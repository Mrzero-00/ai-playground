import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule } from '@/components/capsule';
import { Icon } from '@/components/icons';
import { Body, Button, Card, Chip, Content, NavBar, Page, Title } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke, offsetShadow } from '@/constants/theme';
import { DEADLINE_DAY_OPTIONS, MAX_ITEMS_PER_MEMBER, MAX_MEMBERS, MIN_MEMBERS, addDays, formatKoreanDate } from '@/domain/capsule';
import { useCapsuleStore } from '@/state/capsule-store';

export default function CreateCapsuleScreen() {
  const { createCapsule } = useCapsuleStore();
  const [title, setTitle] = useState('');
  const [deadlineDays, setDeadlineDays] = useState<(typeof DEADLINE_DAY_OPTIONS)[number]>(7);
  const deadline = addDays(new Date().toISOString(), deadlineDays);
  const canCreate = title.trim().length > 0;

  function create() {
    const capsule = createCapsule({ title, deadlineDays });
    router.replace({ pathname: '/capsule/[id]', params: { id: capsule.id } });
  }

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <NavBar left="close" title="새 캡슐" />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Content style={styles.content}>
            <View style={styles.intro}>
              <Capsule state="closed" size={110} />
              <View style={styles.introCopy}>
                <Title>무엇을 묻어둘까요?</Title>
                <Body>친구들이 알아볼 이름이면 충분해요. 언제 열지는 닫을 때 같이 정해요.</Body>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>캡슐 이름</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                maxLength={30}
                placeholder="제주 여행 떠나기 전에"
                placeholderTextColor={Colors.faint}
                style={[styles.input, offsetShadow(4)]}
              />
              <Text style={styles.counter}>
                {title.length} / 30
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>언제까지 넣을 수 있게 할까요?</Text>
              <Body size={12}>마감이 지나면 캡슐을 닫는 단계로 넘어가요.</Body>
              <View style={styles.chips}>
                {DEADLINE_DAY_OPTIONS.map((days) => (
                  <Chip key={days} label={`${days}일`} selected={deadlineDays === days} onPress={() => setDeadlineDays(days)} style={styles.chip} />
                ))}
              </View>
              <Text style={styles.deadline}>
                <Text style={styles.deadlineStrong}>{formatKoreanDate(deadline, true)}</Text>까지 넣을 수 있어요
              </Text>
            </View>

            <Card shadow={false} style={styles.rules}>
              <Rule icon="letter" tone={Colors.sky} text={`편지 · 사진 · 음성 · 동영상, 한 사람당 ${MAX_ITEMS_PER_MEMBER}개까지`} />
              <Rule icon="lock" tone={Colors.yellow} text="닫힌 뒤에는 나도 안을 다시 볼 수 없어요" />
              <Rule icon="people" tone={Colors.mint} text={`나 포함 ${MIN_MEMBERS}명에서 ${MAX_MEMBERS}명까지`} />
            </Card>
          </Content>
        </ScrollView>
        <Content style={styles.footer}>
          <Button label="캡슐 만들기" onPress={create} disabled={!canCreate} />
          <Body size={12} center>만든 뒤 이름과 마감은 바꿀 수 없어요. 닫기 전까지 취소만 돼요.</Body>
        </Content>
      </SafeAreaView>
    </Page>
  );
}

function Rule({ icon, tone, text }: { icon: 'letter' | 'lock' | 'people'; tone: string; text: string }) {
  return (
    <View style={styles.rule}>
      <View style={[styles.ruleIcon, { backgroundColor: tone }]}>
        <Icon name={icon} size={16} />
      </View>
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { gap: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.lg },
  intro: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  introCopy: { flex: 1, gap: 6 },
  field: { gap: Spacing.sm },
  label: { fontFamily: Fonts.display, fontSize: 15, color: Colors.ink },
  input: {
    minHeight: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    paddingHorizontal: Spacing.lg,
    fontFamily: Fonts.display,
    fontSize: 17,
    color: Colors.ink,
  },
  counter: { fontFamily: Fonts.body, fontSize: 11, color: Colors.muted, textAlign: 'right' },
  chips: { flexDirection: 'row', gap: Spacing.sm },
  chip: { flex: 1 },
  deadline: { fontFamily: Fonts.body, fontSize: 13, color: Colors.muted },
  deadlineStrong: { fontFamily: Fonts.display, color: Colors.ink },
  rules: { gap: Spacing.md, borderRadius: Radius.lg },
  rule: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  ruleIcon: { width: 30, height: 30, borderRadius: 15, borderWidth: Stroke.thin, borderColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  ruleText: { flex: 1, fontFamily: Fonts.body, fontSize: 13, color: Colors.ink },
  footer: { gap: Spacing.sm, paddingTop: Spacing.md, paddingBottom: Spacing.md },
});
