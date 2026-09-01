import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DugiMark } from '@/components/dugi-mark';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { usePitStore } from '@/state/pit-store';

type LocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; latitude: number; longitude: number; accuracy: number | null }
  | { status: 'error'; message: string };

const dayOptions = [30, 100, 180] as const;
const attendanceOptions = ['2명 이상', '과반수', '전원'] as const;

export default function CreatePitScreen() {
  const { savePit } = usePitStore();
  const [title, setTitle] = useState('한 달 뒤 우리 예언');
  const [days, setDays] = useState<(typeof dayOptions)[number]>(30);
  const [attendance, setAttendance] = useState<(typeof attendanceOptions)[number]>('과반수');
  const [location, setLocation] = useState<LocationState>({ status: 'idle' });

  const revealDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
  }, [days]);

  async function useCurrentLocation() {
    setLocation({ status: 'loading' });
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocation({ status: 'error', message: '위치 권한이 필요해요. 설정에서 허용한 뒤 다시 시도해주세요.' });
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({
        status: 'ready',
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        accuracy: current.coords.accuracy,
      });
    } catch {
      setLocation({ status: 'error', message: '현재 위치를 찾지 못했어요. 잠시 후 다시 확인해주세요.' });
    }
  }

  const canCreate = title.trim().length > 0 && location.status === 'ready';

  function createPit() {
    if (location.status !== 'ready') return;
    const revealAt = new Date();
    revealAt.setDate(revealAt.getDate() + days);
    const pitId = `pit-${Date.now().toString(36)}`;
    savePit({
      id: pitId,
      title: title.trim(),
      waitDays: days,
      revealAt: revealAt.toISOString(),
      attendanceRule: attendance,
      location: { latitude: location.latitude, longitude: location.longitude },
      locationAccuracy: location.accuracy,
    });
    router.replace({ pathname: '/pit/[id]', params: { id: pitId } });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.page}>
          <View style={styles.intro}>
            <DugiMark size={72} />
            <View style={styles.speechBubble}>
              <Text style={styles.speechTitle}>누구와, 언제 다시 만날까요?</Text>
              <Text style={styles.speechBody}>설정은 제가 챙길게요. 약속만 정해주세요.</Text>
            </View>
          </View>

          <Section number="1" title="구덩이 이름">
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              maxLength={30}
              placeholder="친구들이 알아볼 이름"
              placeholderTextColor={Colors.muted}
            />
          </Section>

          <Section number="2" title="어떤 놀이를 할까요?">
            <View style={styles.optionCard}>
              <View style={styles.optionIcon}><Text style={styles.optionIconText}>✦</Text></View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>한 달 뒤 우리 예언</Text>
                <Text style={styles.optionDescription}>미래의 우리를 각자 몰래 예측해요.</Text>
              </View>
              <View style={styles.check}><Text style={styles.checkText}>✓</Text></View>
            </View>
            <Text style={styles.helper}>첫 MVP에서는 한 가지 놀이에만 집중합니다.</Text>
          </Section>

          <Section number="3" title="얼마나 기다릴까요?">
            <View style={styles.chipRow}>
              {dayOptions.map((option) => (
                <ChoiceChip
                  key={option}
                  label={option === 30 ? '한 달' : `${option}일`}
                  selected={days === option}
                  onPress={() => setDays(option)}
                />
              ))}
            </View>
            <View style={styles.datePreview}>
              <Text style={styles.dateLabel}>공개 예정일</Text>
              <Text style={styles.dateValue}>{revealDate}</Text>
            </View>
          </Section>

          <Section number="4" title="어디서 열까요?">
            <Pressable
              onPress={useCurrentLocation}
              disabled={location.status === 'loading'}
              style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}>
              <View style={styles.locationPin}><Text style={styles.locationPinText}>●</Text></View>
              <View style={styles.locationCopy}>
                <Text style={styles.locationTitle}>
                  {location.status === 'ready' ? '현재 위치를 약속 장소로 등록했어요' : '현재 위치로 장소 등록'}
                </Text>
                <Text style={styles.locationDescription}>
                  {location.status === 'ready'
                    ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)} · 반경 150m`
                    : '앱을 사용하는 동안에만 위치를 확인해요.'}
                </Text>
              </View>
              {location.status === 'loading' ? <ActivityIndicator color={Colors.earth} /> : <Text style={styles.chevron}>›</Text>}
            </Pressable>
            {location.status === 'error' && (
              <View style={styles.errorRow}>
                <Text style={styles.error}>{location.message}</Text>
                <Pressable onPress={Linking.openSettings} style={styles.settingsButton}>
                  <Text style={styles.settingsButtonText}>설정 열기</Text>
                </Pressable>
              </View>
            )}
          </Section>

          <Section number="5" title="몇 명이 와야 열릴까요?">
            <View style={styles.chipRow}>
              {attendanceOptions.map((option) => (
                <ChoiceChip key={option} label={option} selected={attendance === option} onPress={() => setAttendance(option)} />
              ))}
            </View>
          </Section>

          <Pressable
            disabled={!canCreate}
            onPress={createPit}
            style={({ pressed }) => [styles.primaryButton, !canCreate && styles.disabledButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>{canCreate ? '이대로 구덩이 파기' : '약속 장소를 먼저 등록해주세요'}</Text>
          </Pressable>
          <Text style={styles.privacyNote}>이 프로토타입은 약속 장소를 기기 메모리에만 보관하고, 실시간 위치를 추적하지 않습니다.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>{number}</Text></View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, selected && styles.selectedChip, pressed && styles.pressed]}>
      <Text style={[styles.chipText, selected && styles.selectedChipText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.canvas },
  scrollContent: { alignItems: 'center' },
  page: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.lg, gap: Spacing.xl },
  intro: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  speechBubble: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.line },
  speechTitle: { color: Colors.ink, fontSize: 15, fontWeight: '900' },
  speechBody: { color: Colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  section: { gap: Spacing.md },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center' },
  sectionNumberText: { color: Colors.white, fontSize: 11, fontWeight: '900' },
  sectionTitle: { color: Colors.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  input: { minHeight: 56, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.line, paddingHorizontal: Spacing.md, color: Colors.ink, fontSize: 16, fontWeight: '700' },
  optionCard: { backgroundColor: Colors.leafSoft, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.leaf, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  optionIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  optionIconText: { color: Colors.earth, fontSize: 19 },
  optionCopy: { flex: 1, gap: 3 },
  optionTitle: { color: Colors.ink, fontSize: 15, fontWeight: '900' },
  optionDescription: { color: Colors.muted, fontSize: 12 },
  check: { width: 25, height: 25, borderRadius: 13, backgroundColor: Colors.leaf, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: Colors.white, fontSize: 13, fontWeight: '900' },
  helper: { color: Colors.muted, fontSize: 11, marginLeft: Spacing.xs },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  chip: { minHeight: 44, paddingHorizontal: Spacing.md, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.line, justifyContent: 'center' },
  selectedChip: { backgroundColor: Colors.earthDark, borderColor: Colors.earthDark },
  chipText: { color: Colors.muted, fontSize: 13, fontWeight: '800' },
  selectedChipText: { color: Colors.white },
  datePreview: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.md, borderRadius: Radius.sm, backgroundColor: '#EDE3D2' },
  dateLabel: { color: Colors.muted, fontSize: 12, fontWeight: '700' },
  dateValue: { color: Colors.earthDark, fontSize: 13, fontWeight: '900' },
  locationButton: { minHeight: 72, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.line, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  locationPin: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0DCC7', alignItems: 'center', justifyContent: 'center' },
  locationPinText: { color: Colors.warning, fontSize: 16 },
  locationCopy: { flex: 1, gap: 4 },
  locationTitle: { color: Colors.ink, fontSize: 14, fontWeight: '800' },
  locationDescription: { color: Colors.muted, fontSize: 11, lineHeight: 16 },
  chevron: { color: Colors.soil, fontSize: 28 },
  error: { color: Colors.warning, fontSize: 12, lineHeight: 18 },
  errorRow: { gap: Spacing.sm, alignItems: 'flex-start' },
  settingsButton: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.warning, paddingHorizontal: 12, paddingVertical: 7 },
  settingsButtonText: { color: Colors.warning, fontSize: 11, fontWeight: '900' },
  primaryButton: { minHeight: 58, borderRadius: Radius.md, backgroundColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  disabledButton: { backgroundColor: '#B9AB9C' },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '900' },
  privacyNote: { color: Colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: -Spacing.md },
  pressed: { opacity: 0.7 },
});
