import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule as CapsuleArt } from '@/components/capsule';
import { Body, Button, Content, NavBar, Page, Tag, Title } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke, offsetShadow } from '@/constants/theme';
import type { Capsule } from '@/domain/capsule';
import { useCapsuleStore } from '@/state/capsule-store';

/** 웹에는 AR이 없다. 현재 위치만으로 심는 대체 경로. */
export function ArPlantScreen({ capsule }: { capsule: Capsule }) {
  const { plantCapsule } = useCapsuleStore();
  const [label, setLabel] = useState(capsule.location?.label ?? '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function plantHere() {
    setStatus('loading');
    setMessage(null);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setStatus('error');
      setMessage('브라우저 위치 권한이 꺼져 있어요. 주소창의 자물쇠 아이콘에서 허용해 주세요.');
      return;
    }
    try {
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      void plantCapsule(capsule.id, { latitude: current.coords.latitude, longitude: current.coords.longitude, accuracy: current.coords.accuracy, label: label.trim(), plantedAt: new Date().toISOString() });
      router.back();
    } catch {
      setStatus('error');
      setMessage('현재 위치를 찾지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <NavBar left="close" title="캡슐 심기" right={<Tag tone="yellow" label="2차 · 실험" />} />
        <Content style={styles.content}>
          <View style={styles.hero}>
            <CapsuleArt state="buried" size={180} />
            <Title size={24}>웹에서는 카메라 AR이 없어요</Title>
            <Body center>앱에서는 바닥을 비추고 탭해서 심어요. 여기서는 현재 위치만 저장해요.</Body>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>이 자리 이름</Text>
            <TextInput value={label} onChangeText={setLabel} placeholder="사계리 해안도로 주차장 입구" placeholderTextColor={Colors.faint} style={[styles.input, offsetShadow(3)]} />
          </View>
          {message && <Text style={styles.error}>{message}</Text>}
        </Content>
        <Content style={styles.footer}>
          <Button label={status === 'loading' ? '위치 찾는 중…' : '현재 위치로 심기'} icon="arrow" onPress={plantHere} disabled={label.trim().length === 0 || status === 'loading'} />
        </Content>
      </SafeAreaView>
    </Page>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flex: 1, gap: Spacing.xl, paddingTop: Spacing.lg },
  hero: { alignItems: 'center', gap: Spacing.sm },
  field: { gap: Spacing.sm },
  label: { fontFamily: Fonts.display, fontSize: 15, color: Colors.ink },
  input: { minHeight: 52, borderRadius: Radius.md, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink, paddingHorizontal: Spacing.lg, fontFamily: Fonts.body, fontSize: 15, color: Colors.ink },
  error: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 20, color: Colors.coral },
  footer: { paddingTop: Spacing.md, paddingBottom: Spacing.md },
});
