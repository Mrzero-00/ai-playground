import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Body, Button, Content, NavBar, Page, Title } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke, offsetShadow } from '@/constants/theme';
import { AVATAR_TONE_OPTIONS, NAME_MAX_CHARS, type AvatarTone } from '@/lib/profile';
import { describeError, useCapsuleStore } from '@/state/capsule-store';

const TONE_LABEL: Record<AvatarTone, string> = { yellow: '노랑', sky: '하늘', mint: '민트', coral: '코랄' };
const TONE_COLOR: Record<AvatarTone, string> = { yellow: Colors.yellow, sky: Colors.sky, mint: Colors.mint, coral: Colors.coral };

/** 내 프로필: 캡슐에 보일 이름과 아바타 색. 기기에 저장하고, 서버가 있으면 세션 이름도 바꾼다. */
export default function ProfileScreen() {
  const { profile, saveProfile, source, capsules } = useCapsuleStore();
  const [name, setName] = useState(profile.name);
  const [tone, setTone] = useState<AvatarTone>(profile.tone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [seen, setSeen] = useState(profile);

  // 저장된 프로필이 뒤늦게 불러와지면(링크로 바로 열었을 때) 아직 손대지 않은 입력칸에 반영한다.
  if (seen !== profile) {
    setSeen(profile);
    if (!touched) {
      setName(profile.name);
      setTone(profile.tone);
    }
  }

  const trimmed = name.trim();
  const changed = trimmed !== profile.name || tone !== profile.tone;
  const canSave = trimmed.length > 0 && changed && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfile({ name: trimmed, tone });
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (cause) {
      setError(describeError(cause));
      setSaving(false);
    }
  }

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <NavBar left="close" title="내 프로필" />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Content style={styles.content}>
            <View style={styles.hero}>
              <View style={[styles.avatarRing, offsetShadow(5)]}>
                <Avatar name={trimmed || '?'} tone={tone} size={96} />
              </View>
              <Title size={24}>{trimmed ? `${trimmed}님` : '누구세요?'}</Title>
              <Body center>친구들 캡슐에 이 이름과 색으로 보여요. 언제든 바꿀 수 있어요.</Body>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>이름</Text>
              <TextInput
                value={name}
                onChangeText={(text) => { setName(text); setTouched(true); }}
                maxLength={NAME_MAX_CHARS}
                placeholder="친구들이 부르는 이름"
                placeholderTextColor={Colors.faint}
                autoCorrect={false}
                style={[styles.input, offsetShadow(4)]}
                returnKeyType="done"
                onSubmitEditing={() => void save()}
              />
              <Text style={styles.counter}>
                {trimmed.length} / {NAME_MAX_CHARS}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>아바타 색</Text>
              <View style={styles.tones}>
                {AVATAR_TONE_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityLabel={`${TONE_LABEL[option]} 색`}
                    accessibilityState={{ selected: tone === option }}
                    onPress={() => { setTone(option); setTouched(true); }}
                    style={[styles.tone, { backgroundColor: TONE_COLOR[option] }, tone === option && styles.toneSelected]}>
                    {tone === option && <Text style={styles.toneCheck}>✓</Text>}
                  </Pressable>
                ))}
              </View>
            </View>

            <Body size={12}>
              {source === 'remote' ? `이름은 내가 들어 있는 캡슐 ${capsules.length}개에 바로 반영돼요.` : '아직 계정은 없어요. 이 기기에만 저장돼요.'}
            </Body>
            {error && <Text style={styles.error}>{error}</Text>}
          </Content>
        </ScrollView>
        <Content style={styles.footer}>
          <Button label={saving ? '저장하는 중…' : '저장'} icon="check" onPress={() => void save()} disabled={!canSave} />
        </Content>
      </SafeAreaView>
    </Page>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { gap: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.lg },
  hero: { alignItems: 'center', gap: Spacing.sm },
  avatarRing: { padding: 6, borderRadius: 60, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink, marginBottom: 4 },
  section: { gap: Spacing.sm },
  label: { fontFamily: Fonts.display, fontSize: 16, color: Colors.ink },
  input: { minHeight: 56, borderRadius: Radius.md, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink, paddingHorizontal: Spacing.lg, fontFamily: Fonts.display, fontSize: 18, color: Colors.ink },
  counter: { fontFamily: Fonts.body, fontSize: 11, color: Colors.muted, textAlign: 'right' },
  tones: { flexDirection: 'row', gap: Spacing.md },
  tone: { width: 52, height: 52, borderRadius: 26, borderWidth: Stroke.regular, borderColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  toneSelected: { transform: [{ scale: 1.12 }], borderWidth: 3 },
  toneCheck: { fontFamily: Fonts.display, fontSize: 20, color: Colors.ink },
  error: { fontFamily: Fonts.body, fontSize: 13, color: Colors.coral },
  footer: { paddingTop: Spacing.md, paddingBottom: Spacing.md },
});
