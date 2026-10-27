import { useCallback, useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CapsuleAtlas } from '@/components/capsule-atlas';
import { Body, Button, IconButton, Tag } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke } from '@/constants/theme';
import type { PlantedLocation } from '@/domain/capsule';
import { currentLocation } from '@/lib/location';
import type { Coordinates, LocationFix } from '@/shared/contracts';

/** 내 위치를 못 잡았을 때 처음 보여 줄 자리. 지도는 전 세계를 덮으니 어디로든 끌고 갈 수 있다. */
const FALLBACK_CENTER: Coordinates = { latitude: 37.5665, longitude: 126.978 };
const SHEET_HEIGHT = 230;

type Props = {
  visible: boolean;
  /** 이미 골라 둔 자리가 있으면 거기서 시작한다. */
  initial?: Coordinates | null;
  initialLabel?: string;
  onClose: () => void;
  onConfirm: (location: PlantedLocation) => void;
};

/** 지도를 눌러 심을 자리를 고르는 전체 화면. 국내든 해외든 지도가 있는 곳이면 어디든 찍을 수 있다. */
export function PlacePicker({ visible, initial, initialLabel, onClose, onConfirm }: Props) {
  const [fix, setFix] = useState<LocationFix | null>(null);
  const [pin, setPin] = useState<Coordinates | null>(initial ?? null);
  const [label, setLabel] = useState(initialLabel ?? '');
  const [center, setCenter] = useState<Coordinates>(initial ?? FALLBACK_CENTER);
  const [recenterKey, setRecenterKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // 캡슐 없이 핀만 찍는 지도라 카운트다운이 없다. 열릴 때의 시각 하나면 충분하다.
  const [openedAt] = useState(() => Date.now());

  const locate = useCallback(async () => {
    setLocating(true);
    setNotice(null);
    try {
      const next = await currentLocation();
      setFix(next);
      setCenter({ latitude: next.latitude, longitude: next.longitude });
      setRecenterKey((value) => value + 1);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : '현재 위치를 확인하지 못했어요.');
    } finally {
      setLocating(false);
    }
  }, []);

  // 열릴 때 한 번: 고른 자리가 없으면 내 위치로 간다.
  useEffect(() => {
    if (!visible || initial) return;
    const timer = setTimeout(() => {
      void locate();
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, initial, locate]);

  function confirm() {
    if (!pin) return;
    onConfirm({ latitude: pin.latitude, longitude: pin.longitude, accuracy: null, label: label.trim() || '지도에서 고른 자리', plantedAt: new Date().toISOString() });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        <CapsuleAtlas capsules={[]} fix={fix} center={center} recenterKey={recenterKey} bottomInset={SHEET_HEIGHT} active={visible} now={openedAt} perspective="flat" onSelect={() => {}} pin={pin} onPick={setPin} />
        <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
          <View style={styles.top} pointerEvents="box-none">
            <IconButton name="close" label="고르기 취소" onPress={onClose} />
            <Tag tone="white" icon="map" label="지도를 눌러 자리를 찍어요" />
            <IconButton name="locate" label={locating ? '내 위치 찾는 중' : '내 위치로'} onPress={() => { if (!locating) void locate(); }} />
          </View>

          <View style={[styles.sheet, { minHeight: SHEET_HEIGHT }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{pin ? '이 자리에 심을까요?' : '어디에 심을까요?'}</Text>
            <Body size={12}>{notice ?? (pin ? `위도 ${pin.latitude.toFixed(4)} · 경도 ${pin.longitude.toFixed(4)} · 다시 누르면 옮겨요` : '지도를 끌어서 옮기고, 원하는 곳을 한 번 누르면 핀이 꽂혀요. 해외도 돼요.')}</Body>
            <TextInput
              value={label}
              onChangeText={setLabel}
              maxLength={30}
              placeholder="이 자리 이름 (예: 광안리 해변 입구)"
              placeholderTextColor={Colors.faint}
              style={styles.input}
              returnKeyType="done"
            />
            <View style={styles.actions}>
              <Button label="이 자리로 정하기" icon="check" onPress={confirm} disabled={!pin} style={styles.grow} />
              <Button label="취소" tone="ghost" compact onPress={onClose} />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream, ...(Platform.OS === 'web' ? { minHeight: '100%' as unknown as number } : null) },
  overlay: { flex: 1, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: Spacing.sm },
  sheet: { backgroundColor: Colors.cream, borderTopWidth: Stroke.regular, borderTopColor: Colors.ink, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingHorizontal: Spacing.xl, paddingTop: 10, paddingBottom: Spacing.md, gap: Spacing.sm },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: Colors.ink, alignSelf: 'center', opacity: 0.35 },
  sheetTitle: { fontFamily: Fonts.display, fontSize: 18, color: Colors.ink },
  input: { minHeight: 48, borderRadius: Radius.sm, backgroundColor: Colors.white, borderWidth: Stroke.thin, borderColor: Colors.ink, paddingHorizontal: Spacing.md, fontFamily: Fonts.body, fontSize: 15, color: Colors.ink },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  grow: { flex: 1 },
});
