import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { PlacePicker } from '@/components/place-picker';
import { defaultOpenAt, OpenAtPicker, openAtToDate, type OpenAtValue } from '@/components/open-at-picker';
import { Body, Button, Card, Chip, Content, NavBar, Page, Tag, Title } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke, offsetShadow } from '@/constants/theme';
import { DEADLINE_DAY_OPTIONS, MAX_ITEMS_PER_MEMBER, MAX_MEMBERS, MIN_MEMBERS, addDays, formatKoreanDate, generateInviteCode, isValidOpenAtForCreate, type CapsuleMode, type PlantedLocation } from '@/domain/capsule';
import { currentLocation } from '@/lib/location';
import { useCapsuleStore } from '@/state/capsule-store';

type LocationChoice = { status: 'none' } | { status: 'loading' } | { status: 'ready'; location: PlantedLocation; source: 'here' | 'map' } | { status: 'error'; message: string };

export default function CreateCapsuleScreen() {
  const { createCapsule } = useCapsuleStore();
  const now = useMemo(() => new Date(), []);
  const [title, setTitle] = useState('');
  const [deadlineDays, setDeadlineDays] = useState<(typeof DEADLINE_DAY_OPTIONS)[number]>(7);
  const [openAt, setOpenAt] = useState<OpenAtValue>(() => defaultOpenAt(now));
  const [inviteCode] = useState(() => generateInviteCode());
  const [mode, setMode] = useState<CapsuleMode>('group');
  const [place, setPlace] = useState<LocationChoice>({ status: 'none' });
  const [picking, setPicking] = useState(false);
  const [placeLabel, setPlaceLabel] = useState('');
  const [shareNote, setShareNote] = useState<string | null>(null);

  const deadline = addDays(now.toISOString(), deadlineDays);
  const openAtDate = openAtToDate(openAt);
  const openAtValid = isValidOpenAtForCreate(now.toISOString(), deadline, openAtDate.toISOString());
  const canCreate = title.trim().length > 0 && openAtValid;

  function create() {
    const location = place.status === 'ready' ? { ...place.location, label: placeLabel.trim() || place.location.label } : null;
    const capsule = createCapsule({ title, deadlineDays, openAt: openAtDate.toISOString(), mode, location });
    if (!capsule) return;
    router.replace({ pathname: '/capsule/[id]', params: { id: capsule.id } });
  }

  async function useHere() {
    setPlace({ status: 'loading' });
    try {
      const fix = await currentLocation();
      setPlace({ status: 'ready', source: 'here', location: { latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy, label: placeLabel.trim() || '지금 있는 곳', plantedAt: new Date().toISOString() } });
    } catch (cause) {
      setPlace({ status: 'error', message: cause instanceof Error ? cause.message : '현재 위치를 찾지 못했어요.' });
    }
  }

  async function shareCode() {
    setShareNote(null);
    const message = `묻어두지 초대 코드 ${inviteCode} · 앱에서 코드를 넣으면 같이 묻을 수 있어요.`;
    try {
      await Share.share({ message });
    } catch {
      if (Platform.OS === 'web' && globalThis.navigator?.clipboard) {
        try {
          await globalThis.navigator.clipboard.writeText(inviteCode);
          setShareNote('초대 코드를 복사했어요.');
          return;
        } catch {
          // 아래 안내로 대체
        }
      }
      setShareNote('공유창을 열지 못했어요. 코드를 직접 알려 주세요.');
    }
  }

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <NavBar left="close" title="새 캡슐" />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Content style={styles.content}>
            <View style={styles.intro}>
              <Image source={require('../../assets/capsule/egg-closed.png')} style={styles.egg} contentFit="contain" accessibilityLabel="타임캡슐" />
              <View style={styles.introCopy}>
                <Title>무엇을 묻어둘까요?</Title>
                <Body>이름, 넣는 기간, 여는 날, 혼자인지 함께인지, 자리를 정해요.</Body>
              </View>
            </View>

            <Section number="1" title="캡슐 이름">
              <TextInput value={title} onChangeText={setTitle} maxLength={30} placeholder="제주 여행 떠나기 전에" placeholderTextColor={Colors.faint} style={[styles.input, offsetShadow(4)]} />
              <Text style={styles.counter}>{title.length} / 30</Text>
            </Section>

            <Section number="2" title="언제까지 넣을 수 있게 할까요?" hint={mode === 'solo' ? '마감이 지나거나 5개를 다 넣으면 저절로 닫혀요. 언제든 먼저 닫아도 돼요.' : '마감이 지나거나 모두 5개씩 다 넣으면 저절로 닫혀요. 방장은 언제든 먼저 닫을 수 있어요.'}>
              <View style={styles.chips}>
                {DEADLINE_DAY_OPTIONS.map((days) => (
                  <Chip key={days} label={`${days}일`} selected={deadlineDays === days} onPress={() => setDeadlineDays(days)} style={styles.chip} />
                ))}
              </View>
              <Text style={styles.note}>
                <Text style={styles.noteStrong}>{formatKoreanDate(deadline, true)}</Text>까지 넣을 수 있어요
              </Text>
            </Section>

            <Section number="3" title="언제 다시 열까요?" hint="오늘부터 30일에서 180일 사이. 넣기 마감보다 뒤여야 하고, 만든 뒤엔 바꿀 수 없어요.">
              <OpenAtPicker base={now} notBefore={new Date(deadline)} value={openAt} onChange={setOpenAt} />
              <Text style={[styles.note, !openAtValid && styles.noteError]}>
                <Text style={styles.noteStrong}>{formatKoreanDate(openAtDate.toISOString(), true)}</Text>
                {openAtValid ? '에 열려요' : ' · 넣기 마감보다 뒤로 골라 주세요'}
              </Text>
            </Section>

            <Section number="4" title="누구와 묻을까요?" hint={mode === 'solo' ? '나 혼자 넣고, 나 혼자 열어요. 미래의 나에게 보내는 캡슐.' : `초대 코드로 ${MAX_MEMBERS - 1}명까지 들어올 수 있어요. 나 포함 ${MIN_MEMBERS}명 이상 넣어야 닫혀요.`}>
              <View style={styles.chips}>
                <Chip label="혼자 묻기" selected={mode === 'solo'} onPress={() => setMode('solo')} style={styles.chip} />
                <Chip label="친구와 함께" selected={mode === 'group'} onPress={() => setMode('group')} style={styles.chip} />
              </View>
              {mode === 'group' && (
                <View style={[styles.codeBox, offsetShadow(4)]}>
                  <View style={styles.codeCopy}>
                    <Text style={styles.codeLabel}>초대 코드</Text>
                    <Text style={styles.code}>{inviteCode}</Text>
                  </View>
                  <Button compact tone="yellow" icon="share" label="보내기" onPress={shareCode} />
                </View>
              )}
              {mode === 'group' && shareNote && <Body size={12}>{shareNote}</Body>}
            </Section>

            <Section number="5" title="어디에 심을까요?" hint="지금 있는 곳을 바로 저장하거나, 지도에서 원하는 자리를 골라요. 해외도 돼요. 나중에 캡슐 화면에서 정해도 돼요.">
              {place.status === 'ready' ? (
                <Card shadow={false} style={styles.placeCard}>
                  <View style={styles.placeRow}>
                    {place.source === 'here' ? (
                      <Tag tone="mint" icon="locate" label={`지금 있는 곳 · 오차 약 ${Math.round(place.location.accuracy ?? 0)}m`} />
                    ) : (
                      <Tag tone="sky" icon="map" label={`지도에서 고름 · ${place.location.latitude.toFixed(3)}, ${place.location.longitude.toFixed(3)}`} />
                    )}
                    <View style={styles.placeActions}>
                      {place.source === 'map' && <Button compact tone="ghost" label="옮기기" onPress={() => setPicking(true)} />}
                      <Button compact tone="ghost" label="지우기" onPress={() => setPlace({ status: 'none' })} />
                    </View>
                  </View>
                  <TextInput value={placeLabel} onChangeText={setPlaceLabel} maxLength={30} placeholder="이 자리 이름 (예: 광안리 해변 입구)" placeholderTextColor={Colors.faint} style={styles.placeInput} />
                </Card>
              ) : (
                <View style={styles.placeChoices}>
                  <Button compact tone="secondary" icon="locate" label={place.status === 'loading' ? '위치 찾는 중…' : '지금 있는 곳'} onPress={useHere} disabled={place.status === 'loading'} style={styles.grow} />
                  <Button compact tone="secondary" icon="map" label="지도에서 고르기" onPress={() => setPicking(true)} style={styles.grow} />
                </View>
              )}
              {place.status !== 'ready' && <Button compact tone="ghost" label="나중에 정할게요" onPress={() => setPlace({ status: 'none' })} />}
              {place.status === 'error' && <Text style={styles.noteError}>{place.message}</Text>}
            </Section>

            <Card shadow={false} style={styles.rules}>
              <Rule icon="letter" tone={Colors.sky} text={`편지 · 사진 · 음성 · 동영상, 한 사람당 ${MAX_ITEMS_PER_MEMBER}개까지`} />
              <Rule icon="lock" tone={Colors.yellow} text="닫힌 뒤에는 나도 안을 다시 볼 수 없어요" />
            </Card>
          </Content>
        </ScrollView>
        <Content style={styles.footer}>
          <Button label="캡슐 만들기" onPress={create} disabled={!canCreate} />
          <Body size={12} center>만든 뒤 이름·마감·여는 날은 바꿀 수 없어요. 닫기 전까지 취소만 돼요.</Body>
        </Content>
      </SafeAreaView>
      <PlacePicker
        visible={picking}
        initial={place.status === 'ready' && place.source === 'map' ? place.location : null}
        initialLabel={placeLabel}
        onClose={() => setPicking(false)}
        onConfirm={(location) => {
          setPicking(false);
          setPlaceLabel(location.label === '지도에서 고른 자리' ? placeLabel : location.label);
          setPlace({ status: 'ready', source: 'map', location });
        }}
      />
    </Page>
  );
}

function Section({ number, title, hint, children }: { number: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionNumber}>
          <Text style={styles.sectionNumberLabel}>{number}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {hint && <Body size={12}>{hint}</Body>}
      {children}
    </View>
  );
}

function Rule({ icon, tone, text }: { icon: 'letter' | 'lock'; tone: string; text: string }) {
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
  content: { gap: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  intro: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  egg: { width: 110, height: 130, marginLeft: -8 },
  introCopy: { flex: 1, gap: 6 },
  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.yellow, borderWidth: Stroke.thin, borderColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  sectionNumberLabel: { fontFamily: Fonts.display, fontSize: 13, color: Colors.ink },
  sectionTitle: { flex: 1, fontFamily: Fonts.display, fontSize: 17, color: Colors.ink },
  input: { minHeight: 56, borderRadius: Radius.md, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink, paddingHorizontal: Spacing.lg, fontFamily: Fonts.display, fontSize: 17, color: Colors.ink },
  counter: { fontFamily: Fonts.body, fontSize: 11, color: Colors.muted, textAlign: 'right' },
  chips: { flexDirection: 'row', gap: Spacing.sm },
  chip: { flex: 1 },
  note: { fontFamily: Fonts.body, fontSize: 13, color: Colors.muted },
  noteStrong: { fontFamily: Fonts.display, color: Colors.ink },
  noteError: { fontFamily: Fonts.body, fontSize: 13, color: Colors.coral },
  codeBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: 14, paddingLeft: 18, borderRadius: Radius.lg, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink },
  codeCopy: { flex: 1, gap: 2 },
  codeLabel: { fontFamily: Fonts.body, fontSize: 11, color: Colors.muted },
  code: { fontFamily: Fonts.display, fontSize: 28, letterSpacing: 4, color: Colors.ink },
  placeCard: { gap: Spacing.sm, padding: 12, borderRadius: Radius.lg },
  placeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  placeActions: { flexDirection: 'row', alignItems: 'center' },
  placeInput: { minHeight: 48, borderRadius: Radius.sm, backgroundColor: Colors.cream, borderWidth: Stroke.thin, borderColor: Colors.ink, paddingHorizontal: Spacing.md, fontFamily: Fonts.body, fontSize: 15, color: Colors.ink },
  placeChoices: { flexDirection: 'row', alignItems: 'stretch', gap: Spacing.sm },
  grow: { flex: 1 },
  rules: { gap: Spacing.md, borderRadius: Radius.lg },
  rule: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  ruleIcon: { width: 30, height: 30, borderRadius: 15, borderWidth: Stroke.thin, borderColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  ruleText: { flex: 1, fontFamily: Fonts.body, fontSize: 13, color: Colors.ink },
  footer: { gap: Spacing.sm, paddingTop: Spacing.md, paddingBottom: Spacing.md },
});
