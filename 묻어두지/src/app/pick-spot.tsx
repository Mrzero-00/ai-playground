import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CapsuleAtlas } from '@/components/capsule-atlas';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { currentLocation } from '@/lib/location';
import { mapCenter } from '@/lib/map-presentation';
import { CAPSULE_RADIUS_METERS, type Coordinates } from '@/shared/contracts';
import { useCapsuleStore } from '@/state/capsule-store';

/** PRD PIT-03: the spot is a map pin or the current position. Anywhere is fine. */
export default function PickSpotScreen() {
  const { capsules, now, lastFix, setLastFix, draft, updateDraft } = useCapsuleStore();
  const [pin, setPin] = useState<Coordinates | null>(draft.pin);
  const [placeName, setPlaceName] = useState(draft.placeName);
  const [recenterKey, setRecenterKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const center = pin ?? mapCenter(capsules, lastFix);

  async function locateHere() {
    if (locating) return;
    setLocating(true); setNotice(null);
    try {
      const fix = await currentLocation();
      setLastFix(fix);
      setPin({ latitude: fix.latitude, longitude: fix.longitude });
      setRecenterKey((value) => value + 1);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : '현재 위치를 확인하지 못했어요.');
    } finally {
      setLocating(false);
    }
  }

  function confirm() {
    if (!pin) return;
    updateDraft({ pin, placeName: placeName.trim() });
    router.back();
  }

  return (
    <View style={styles.root}>
      <CapsuleAtlas
        capsules={capsules} fix={lastFix} center={center} recenterKey={recenterKey} bottomInset={236}
        active now={now} perspective="quarter" pin={pin}
        onSelect={() => undefined}
        onPick={(coordinates) => { setPin(coordinates); setNotice(null); }}
      />
      <SafeAreaView pointerEvents="box-none" style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={() => router.back()} style={({ pressed }) => [styles.round, pressed && styles.pressed]}>
            <Text style={styles.roundText}>×</Text>
          </Pressable>
          <View style={styles.titleCard}>
            <Text style={styles.title}>어디에 묻을까요?</Text>
            <Text style={styles.caption}>지도를 눌러 자리를 정해요. 멀리 있는 곳도 괜찮아요.</Text>
          </View>
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none">
          <View style={styles.sheet}>
            <View style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.sheetTitle}>{pin ? '여기에 묻을게요' : '아직 자리를 안 골랐어요'}</Text>
                <Text style={styles.sheetBody}>{pin ? `공개할 때는 이 자리 반경 ${CAPSULE_RADIUS_METERS}m 안에 있어야 해요.` : '지도를 한 번 누르거나, 현재 위치를 써요.'}</Text>
              </View>
              <Pressable accessibilityRole="button" disabled={locating} onPress={() => void locateHere()} style={({ pressed }) => [styles.hereButton, pressed && styles.pressed]}>
                {locating ? <ActivityIndicator color={Colors.earthDark} /> : <Text style={styles.hereText}>현재 위치</Text>}
              </Pressable>
            </View>
            <TextInput
              accessibilityLabel="장소 이름"
              value={placeName} onChangeText={setPlaceName} maxLength={40}
              placeholder="장소를 부를 이름 (예: 망원한강공원 벤치)" placeholderTextColor={Colors.muted}
              style={styles.input}
            />
            {notice && <Text style={styles.notice}>{notice}</Text>}
            <Pressable accessibilityRole="button" disabled={!pin} onPress={confirm} style={({ pressed }) => [styles.primary, !pin && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{pin ? '이 자리로 정하기' : '지도에서 자리를 눌러주세요'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D9E7C8' },
  overlay: { ...{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  titleCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 2, borderColor: Colors.earthDark, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  title: { color: Colors.ink, fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  caption: { color: Colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center' },
  roundText: { color: Colors.earthDark, fontSize: 26, fontWeight: '800', lineHeight: 30 },
  sheet: { margin: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.earthDark, padding: Spacing.md, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  copy: { flex: 1, gap: 3 },
  sheetTitle: { color: Colors.ink, fontSize: 15, fontWeight: '900' },
  sheetBody: { color: Colors.muted, fontSize: 12, lineHeight: 17 },
  hereButton: { minHeight: 44, paddingHorizontal: Spacing.md, borderRadius: Radius.pill, borderWidth: 2, borderColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.leafSoft },
  hereText: { color: Colors.earthDark, fontSize: 12, fontWeight: '900' },
  input: { minHeight: 48, borderRadius: Radius.sm, backgroundColor: Colors.canvas, borderWidth: 1, borderColor: Colors.line, paddingHorizontal: Spacing.md, color: Colors.ink, fontSize: 14, fontWeight: '700' },
  notice: { color: Colors.warning, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  primary: { minHeight: 54, borderRadius: Radius.md, backgroundColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center' },
  disabled: { backgroundColor: '#B9AB9C' },
  primaryText: { color: Colors.white, fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.75 },
});
