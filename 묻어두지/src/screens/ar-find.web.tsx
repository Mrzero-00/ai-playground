import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule as CapsuleArt } from '@/components/capsule';
import { Body, Button, Content, NavBar, Page, Tag, Title } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke } from '@/constants/theme';
import type { Capsule } from '@/domain/capsule';
import { useCheckIn } from '@/screens/use-check-in';

/** 웹에는 AR이 없다. GPS 판정만으로 체크인하는 대체 경로(AR은 연출이지 잠금 조건이 아니다). */
export function ArFindScreen({ capsule }: { capsule: Capsule }) {
  const { state, measure, attempts } = useCheckIn(capsule.location ?? null);
  const inside = state.status === 'inside';

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <NavBar left="close" title="캡슐 찾기" right={<Tag tone="yellow" label="2차 · 실험" />} />
        <Content style={styles.content}>
          <View style={styles.hero}>
            <CapsuleArt state={inside ? 'closed' : 'buried'} size={200} />
            <Title size={24}>{inside ? '심은 자리 안이에요' : state.status === 'outside' ? '아직 자리 밖이에요' : state.status === 'uncertain' ? '아직 판정하지 않았어요' : state.status === 'error' ? '위치를 못 잡았어요' : '위치를 재는 중'}</Title>
            <Body center>
              {state.status === 'inside' || state.status === 'outside'
                ? `거리 약 ${Math.round(state.distance)}m · 오차 ${Math.round(state.accuracy)}m`
                : state.status === 'uncertain'
                  ? `GPS 오차가 ${state.accuracy === null ? '측정 불가' : `${Math.round(state.accuracy)}m`}라 보류했어요.`
                  : state.status === 'error'
                    ? state.message
                    : '브라우저 위치 권한을 허용해 주세요.'}
            </Body>
            {capsule.location && <Text style={styles.label}>심은 자리 · {capsule.location.label}</Text>}
          </View>
          <Body size={12} center>웹에서는 카메라 AR 없이 GPS 판정만 해요. 앱에서는 카메라로 캡슐이 보여요.</Body>
        </Content>
        <Content style={styles.footer}>
          {inside ? (
            <Button label="여기서 체크인" onPress={() => router.replace({ pathname: '/capsule/[id]', params: { id: capsule.id } })} />
          ) : (
            <Button label={state.status === 'loading' ? '위치 재는 중…' : state.status === 'uncertain' ? `다시 재기 (${attempts}/3)` : '다시 재기'} tone="secondary" onPress={measure} disabled={state.status === 'loading'} />
          )}
        </Content>
      </SafeAreaView>
    </Page>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flex: 1, gap: Spacing.xl, paddingTop: Spacing.lg, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: Spacing.sm },
  label: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: Stroke.thin, borderColor: Colors.ink, backgroundColor: Colors.white },
  footer: { paddingTop: Spacing.md, paddingBottom: Spacing.md },
});
