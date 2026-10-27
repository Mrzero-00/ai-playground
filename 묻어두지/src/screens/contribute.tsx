import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule } from '@/components/capsule';
import { Icon } from '@/components/icons';
import { Avatar, AVATAR_TONES, Body, Button, Card, Content, IconButton, NavBar, Page, Tag } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke, offsetShadow } from '@/constants/theme';
import {
  ITEM_KIND_LABEL,
  LETTER_MAX_CHARS,
  MAX_ITEMS_PER_MEMBER,
  VIDEO_MAX_MS,
  VOICE_MAX_MS,
  canSeal,
  contributingMembers,
  formatKoreanDate,
  me,
  remainingSlots,
  type Capsule as CapsuleModel,
  type ItemKind,
} from '@/domain/capsule';

const KIND_ORDER: ItemKind[] = ['letter', 'photo', 'voice', 'video'];
const KIND_TONE: Record<ItemKind, string> = { letter: Colors.sky, photo: Colors.yellow, voice: Colors.mint, video: Colors.coral };
const KIND_LIMIT: Record<ItemKind, string> = {
  letter: `${LETTER_MAX_CHARS}자`,
  photo: '1장',
  voice: `${VOICE_MAX_MS / 1000}초`,
  video: `${VIDEO_MAX_MS / 1000}초`,
};

export function ContributeScreen({ capsule, now }: { capsule: CapsuleModel; now: Date }) {
  const mine = me(capsule);
  const items = mine?.items ?? [];
  const others = capsule.members.filter((member) => !member.isMe);
  const slotsLeft = mine ? remainingSlots(mine) : 0;
  const sealable = canSeal(capsule);
  const isHost = mine?.isHost ?? false;
  const [picking, setPicking] = useState(false);

  function add(kind: ItemKind) {
    setPicking(false);
    router.push({ pathname: '/capsule/[id]/add/[kind]', params: { id: capsule.id, kind } });
  }

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <NavBar
          title={capsule.title}
          onLeft={() => router.replace('/')}
          right={<IconButton name="share" label="친구 초대" onPress={() => router.push({ pathname: '/capsule/[id]/invite', params: { id: capsule.id } })} />}
        />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Content style={styles.content}>
            <View style={styles.statusRow}>
              <Tag tone="yellow" label={`채우는 중 · ${formatKoreanDate(capsule.deadlineAt)}까지`} />
              <Text style={styles.statusCount}>
                <Text style={styles.statusStrong}>
                  {contributingMembers(capsule).length}/{capsule.members.length}
                </Text>
                명이 넣었어요
              </Text>
            </View>

            <View style={styles.capsuleRow}>
              <Capsule state="open" size={190} />
              <Card shadow={false} style={styles.othersCard}>
                <Text style={styles.othersTitle}>친구들이 넣은 것</Text>
                {others.length === 0 && <Body size={12}>아직 아무도 안 왔어요</Body>}
                {others.map((member, index) => (
                  <View key={member.id} style={styles.otherRow}>
                    <Avatar name={member.name} tone={AVATAR_TONES[(index + 1) % AVATAR_TONES.length]} size={22} />
                    <Text style={styles.otherText}>
                      {member.name} {member.items.length}개
                    </Text>
                  </View>
                ))}
                <Body size={11}>뭔지는 열 때!</Body>
              </Card>
            </View>

            <View style={styles.mineHeader}>
              <Text style={styles.sectionTitle}>내 자리</Text>
              <Tag tone="sky" label={`${items.length} / ${MAX_ITEMS_PER_MEMBER}`} />
            </View>
            <View style={styles.slots}>
              {Array.from({ length: MAX_ITEMS_PER_MEMBER }).map((_, index) => {
                const item = items[index];
                if (!item) {
                  return (
                    <Pressable
                      key={`empty-${index}`}
                      accessibilityRole="button"
                      accessibilityLabel={`빈 칸 ${index + 1} · 넣을 것 고르기`}
                      onPress={() => setPicking(true)}
                      style={[styles.slot, styles.slotEmpty]}>
                      <Icon name="plus" size={20} />
                    </Pressable>
                  );
                }
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${ITEM_KIND_LABEL[item.kind]} 고치기`}
                    onPress={() => router.push({ pathname: '/capsule/[id]/add/[kind]', params: { id: capsule.id, kind: item.kind, itemId: item.id } })}
                    style={[styles.slot, { backgroundColor: KIND_TONE[item.kind] }, offsetShadow(3)]}>
                    <Icon name={item.kind} size={22} />
                  </Pressable>
                );
              })}
            </View>
            <Body size={12}>종류 상관없이 {MAX_ITEMS_PER_MEMBER}개까지. 사진만 5장도 돼요. 마감 전엔 꺼내서 고칠 수 있어요.</Body>

          </Content>
        </ScrollView>
        <Content style={styles.footer}>
          {isHost && (
            <Button
              compact
              tone={capsule.location ? 'secondary' : 'yellow'}
              icon="photo"
              label={capsule.location ? `심은 자리 · ${capsule.location.label}` : 'AR로 이 자리에 심기 (실험)'}
              onPress={() => router.push({ pathname: '/capsule/[id]/plant', params: { id: capsule.id } })}
            />
          )}
          {isHost ? (
            <Button
              label={sealable ? '지금 닫기' : '친구가 더 넣으면 닫을 수 있어요'}
              icon={sealable ? 'lock' : undefined}
              disabled={!sealable}
              onPress={() => router.push({ pathname: '/capsule/[id]/seal', params: { id: capsule.id } })}
            />
          ) : (
            <Button label="친구 부르기" icon="share" tone="secondary" onPress={() => router.push({ pathname: '/capsule/[id]/invite', params: { id: capsule.id } })} />
          )}
          <Body size={12} center>
            {`${formatKoreanDate(capsule.deadlineAt, true)}에, 또는 모두 ${MAX_ITEMS_PER_MEMBER}개씩 다 넣으면 저절로 닫혀요`}
            {capsule.openAt ? ` · ${formatKoreanDate(capsule.openAt, true)}에 열려요` : ''}
          </Body>
        </Content>
      </SafeAreaView>

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={() => setPicking(false)} style={styles.scrim}>
          <Pressable onPress={() => {}} style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>무엇을 넣을까요?</Text>
            <Body size={12}>
              남은 칸 {slotsLeft}개 · 같은 종류를 여러 개 넣어도 돼요
            </Body>
            <View style={styles.pickerGrid}>
              {KIND_ORDER.map((kind) => (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  onPress={() => add(kind)}
                  style={({ pressed }) => [styles.pickerOption, offsetShadow(4), pressed && styles.pressed]}>
                  <View style={[styles.pickerIcon, { backgroundColor: KIND_TONE[kind] }]}>
                    <Icon name={kind} size={22} />
                  </View>
                  <Text style={styles.pickerLabel}>{ITEM_KIND_LABEL[kind]}</Text>
                  <Text style={styles.pickerLimit}>{KIND_LIMIT[kind]}</Text>
                </Pressable>
              ))}
            </View>
            <Button label="다음에 넣을게요" tone="ghost" onPress={() => setPicking(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Page>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(17,17,17,0.45)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: Colors.cream, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderTopWidth: Stroke.regular, borderTopColor: Colors.ink, padding: Spacing.xl, paddingBottom: 34, gap: Spacing.sm },
  pickerHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: Colors.ink, opacity: 0.35, alignSelf: 'center', marginBottom: 4 },
  pickerTitle: { fontFamily: Fonts.display, fontSize: 22, color: Colors.ink },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: Spacing.sm, marginBottom: 4 },
  pickerOption: { width: '48%', flexGrow: 1, alignItems: 'center', gap: 6, paddingVertical: 16, borderRadius: Radius.lg, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink },
  pickerIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: Stroke.thin, borderColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  pickerLabel: { fontFamily: Fonts.display, fontSize: 17, color: Colors.ink },
  pickerLimit: { fontFamily: Fonts.body, fontSize: 11, color: Colors.muted },
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { gap: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusCount: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted },
  statusStrong: { fontFamily: Fonts.display, color: Colors.ink },
  capsuleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  othersCard: { gap: 8, padding: 12, borderRadius: Radius.md, maxWidth: 150 },
  othersTitle: { fontFamily: Fonts.display, fontSize: 14, color: Colors.ink },
  otherRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  otherText: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted },
  mineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
  sectionTitle: { fontFamily: Fonts.display, fontSize: 19, color: Colors.ink },
  slots: { flexDirection: 'row', justifyContent: 'space-between' },
  slot: { width: 58, height: 58, borderRadius: 29, borderWidth: Stroke.regular, borderColor: Colors.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  slotEmpty: { borderStyle: 'dashed' },
  kind: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
  },
  pressed: { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOffset: { width: 2, height: 2 } },
  disabled: { opacity: 0.45 },
  footer: { gap: Spacing.sm, paddingTop: Spacing.md, paddingBottom: Spacing.md },
});
