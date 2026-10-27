import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule } from '@/components/capsule';
import { Body, Button, Content, NavBar, Page, Title } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke, offsetShadow } from '@/constants/theme';
import { normalizeInviteCode } from '@/domain/capsule';
import { useCapsuleStore } from '@/state/capsule-store';

/** 친구가 알려 준 6자리 초대 코드로 캡슐에 들어간다 (INV-02). */
export default function JoinScreen() {
  const { joinCapsule } = useCapsuleStore();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const code = normalizeInviteCode(input);

  async function join() {
    if (joining || code.length !== 6) return;
    setJoining(true);
    const result = await joinCapsule(code);
    setJoining(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    router.replace({ pathname: '/capsule/[id]', params: { id: result.capsule.id } });
  }

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <NavBar left="close" title="초대 코드로 들어가기" />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Content style={styles.content}>
            <View style={styles.hero}>
              <Capsule state="closed" size={150} />
              <Title size={24}>친구 캡슐에 같이 묻어요</Title>
              <Body center>친구가 보낸 6자리 코드를 넣으면 바로 그 캡슐로 들어가요.</Body>
            </View>
            <TextInput
              value={input}
              onChangeText={(text) => { setInput(text.toUpperCase()); setError(null); }}
              maxLength={8}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="ABC123"
              placeholderTextColor={Colors.faint}
              style={[styles.input, offsetShadow(4)]}
              returnKeyType="go"
              onSubmitEditing={() => void join()}
            />
            <Text style={[styles.hint, error ? styles.hintError : null]}>{error ?? `${code.length} / 6`}</Text>
          </Content>
        </ScrollView>
        <Content style={styles.footer}>
          <Button label={joining ? '들어가는 중…' : '들어가기'} icon="arrow" onPress={() => void join()} disabled={code.length !== 6 || joining} />
        </Content>
      </SafeAreaView>
    </Page>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { gap: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.lg },
  hero: { alignItems: 'center', gap: Spacing.sm },
  input: { minHeight: 64, borderRadius: Radius.lg, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink, paddingHorizontal: Spacing.lg, fontFamily: Fonts.display, fontSize: 30, letterSpacing: 6, textAlign: 'center', color: Colors.ink },
  hint: { fontFamily: Fonts.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  hintError: { color: Colors.coral },
  footer: { paddingTop: Spacing.md, paddingBottom: Spacing.md },
});
