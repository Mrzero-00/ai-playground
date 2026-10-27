import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OpeningCapsule } from '@/components/opening-capsule';
import { Button, Content, IconButton, Page } from '@/components/ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { MAX_ITEMS_PER_MEMBER, deriveStatus, me } from '@/domain/capsule';
import { useCapsuleStore } from '@/state/capsule-store';

/** 홈: 캡슐 하나와 ‘타임캡슐 심기’. 누르면 뚜껑이 열리며 설정 화면으로 간다. */
export default function HomeScreen() {
  const { capsules } = useCapsuleStore();
  const [opening, setOpening] = useState(false);
  const todo = capsules.filter((capsule) => {
    const status = deriveStatus(capsule, new Date());
    return status === 'unlockable' || (status === 'collecting' && (me(capsule)?.items.length ?? 0) < MAX_ITEMS_PER_MEMBER);
  }).length;

  useFocusEffect(
    useCallback(() => {
      setOpening(false);
    }, []),
  );

  const goCreate = useCallback(() => {
    router.push('/create');
  }, []);

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View>
            <IconButton name="inbox" label="초대받은 캡슐 목록" onPress={() => router.push('/capsules')} />
            {todo > 0 && (
              <View style={styles.badge} pointerEvents="none">
                <Text style={styles.badgeLabel}>{todo}</Text>
              </View>
            )}
          </View>
          <Text style={styles.brand}>묻어두지</Text>
          <IconButton name="map" label="우리 동네 지도" onPress={() => router.push('/map')} />
        </View>

        <Content style={styles.body}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="타임캡슐 열고 만들기"
            disabled={opening}
            onPress={() => setOpening(true)}
            style={({ pressed }) => [styles.capsule, pressed && styles.capsulePressed]}>
            <OpeningCapsule size={300} open={opening} onOpened={goCreate} />
          </Pressable>
          <Text style={styles.caption}>{opening ? '뚜껑을 여는 중…' : '지금 묻고, 그때 같이 열자.'}</Text>
        </Content>

        <Content style={styles.footer}>
          <Button label="타임캡슐 심기" icon="plus" disabled={opening} onPress={() => setOpening(true)} />
        </Content>
      </SafeAreaView>
    </Page>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: Spacing.sm },
  brand: { fontFamily: Fonts.display, fontSize: 22, color: Colors.ink },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: Colors.coral, borderWidth: 2, borderColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  badgeLabel: { fontFamily: Fonts.display, fontSize: 11, color: Colors.white },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  capsule: { alignItems: 'center', justifyContent: 'center' },
  capsulePressed: { transform: [{ scale: 0.98 }] },
  caption: { fontFamily: Fonts.display, fontSize: 18, color: Colors.muted },
  footer: { paddingTop: Spacing.md, paddingBottom: Spacing.md },
});
