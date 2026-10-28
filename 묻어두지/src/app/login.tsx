import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule } from '@/components/capsule';
import { Body, Button, Content, NavBar, Page, Title } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke, offsetShadow } from '@/constants/theme';
import { KAKAO_REST_KEY, googleClientId, signInWithApple, signInWithGoogle, signInWithKakao } from '@/lib/social-auth';
import type { AuthProvider, LoginInput } from '@/shared/capsule-api';
import { describeError, useCapsuleStore } from '@/state/capsule-store';

/** 간편 로그인. 서버가 켜 둔 제공자만 보여 주고, 키가 없는 제공자는 이유를 적는다. */
export default function LoginScreen() {
  const { providers, login, source } = useCapsuleStore();
  const [busy, setBusy] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devName, setDevName] = useState('');

  const has = (provider: AuthProvider) => providers.includes(provider);
  const googleReady = has('google') && !!googleClientId();
  const kakaoReady = has('kakao') && !!KAKAO_REST_KEY;
  const appleReady = has('apple') && Platform.OS === 'ios';

  async function run(provider: AuthProvider, obtain: () => Promise<LoginInput>) {
    if (busy) return;
    setBusy(provider);
    setError(null);
    try {
      await login(await obtain());
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (cause) {
      setError(describeError(cause));
      setBusy(null);
    }
  }

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <NavBar left="close" title="간편 로그인" />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Content style={styles.content}>
            <View style={styles.hero}>
              <Capsule state="closed" size={150} />
              <Title size={24}>어느 기기에서든 같은 캡슐</Title>
              <Body center>로그인하면 이 기기의 캡슐이 계정에 묶여요. 폰을 바꿔도, 웹에서 봐도 똑같이 보여요.</Body>
            </View>

            <View style={styles.buttons}>
              {has('kakao') && (
                <Button label={busy === 'kakao' ? '카카오로 들어가는 중…' : '카카오로 계속하기'} tone="yellow" onPress={() => void run('kakao', signInWithKakao)} disabled={!kakaoReady || !!busy} />
              )}
              {has('google') && (
                <Button label={busy === 'google' ? '구글로 들어가는 중…' : '구글로 계속하기'} tone="secondary" onPress={() => void run('google', signInWithGoogle)} disabled={!googleReady || !!busy} />
              )}
              {has('apple') && (
                <Button label={busy === 'apple' ? 'Apple 로 들어가는 중…' : 'Apple 로 계속하기'} tone="primary" onPress={() => void run('apple', signInWithApple)} disabled={!appleReady || !!busy} />
              )}
              {has('kakao') && !kakaoReady && <Body size={11}>카카오: 앱에 REST API 키(EXPO_PUBLIC_KAKAO_REST_KEY)가 아직 없어요.</Body>}
              {has('google') && !googleReady && <Body size={11}>구글: 이 기기용 클라이언트 ID 가 아직 없어요.</Body>}
              {has('apple') && !appleReady && <Body size={11}>Apple 로그인은 iPhone 앱에서만 보여요.</Body>}
              {providers.length === 0 && <Body center>서버에 로그인 제공자가 아직 설정되지 않았어요.</Body>}
            </View>

            {has('dev') && (
              <View style={[styles.dev, offsetShadow(4)]}>
                <Text style={styles.devTitle}>개발용 로그인</Text>
                <Body size={12}>{source === 'remote' ? '서버 DEV_LOGIN=1 일 때만 보여요. 이름만으로 계정이 만들어져요.' : '서버 없는 미리보기예요. 이 기기 안에서만 로그인한 척해요.'}</Body>
                <TextInput value={devName} onChangeText={setDevName} maxLength={12} placeholder="이름 (예: 민지)" placeholderTextColor={Colors.faint} autoCorrect={false} style={styles.devInput} returnKeyType="go" onSubmitEditing={() => void run('dev', async () => ({ provider: 'dev', name: devName }))} />
                <Button compact tone="secondary" label={busy === 'dev' ? '들어가는 중…' : '이 이름으로 들어가기'} onPress={() => void run('dev', async () => ({ provider: 'dev', name: devName }))} disabled={devName.trim().length === 0 || !!busy} />
              </View>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
            <Body size={11} center>로그인해도 캡슐 내용은 열리기 전까지 아무도 볼 수 없어요. 이름과 프로필 사진만 가져와요.</Body>
          </Content>
        </ScrollView>
      </SafeAreaView>
    </Page>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { gap: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.xl },
  hero: { alignItems: 'center', gap: Spacing.sm },
  buttons: { gap: Spacing.sm },
  dev: { gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink, borderStyle: 'dashed' },
  devTitle: { fontFamily: Fonts.display, fontSize: 16, color: Colors.ink },
  devInput: { minHeight: 48, borderRadius: Radius.sm, backgroundColor: Colors.cream, borderWidth: Stroke.thin, borderColor: Colors.ink, paddingHorizontal: Spacing.md, fontFamily: Fonts.body, fontSize: 15, color: Colors.ink },
  error: { fontFamily: Fonts.body, fontSize: 13, color: Colors.coral, textAlign: 'center' },
});
