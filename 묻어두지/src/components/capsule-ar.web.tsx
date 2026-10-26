import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CapsuleARProps } from '@/components/capsule-ar.types';
import { Colors, Radius, Spacing } from '@/constants/theme';

export function CapsuleAR({ onClose }: CapsuleARProps) {
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>현장에서 만나는 캡슐</Text>
          <Text style={styles.title}>AR은 휴대폰에서 꺼내요</Text>
          <Text style={styles.body}>iPhone·Android 개발 빌드에서 카메라로 바닥을 비추면 캡슐이 나타나요. 브라우저에서는 열 수 없어요.</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>돌아가기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(39,36,31,0.7)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  card: { width: '100%', maxWidth: 420, padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.earthDark, gap: Spacing.sm },
  eyebrow: { color: Colors.leaf, fontSize: 12, fontWeight: '900' },
  title: { color: Colors.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  body: { color: Colors.muted, fontSize: 14, lineHeight: 22 },
  button: { minHeight: 54, borderRadius: Radius.md, marginTop: Spacing.sm, backgroundColor: Colors.earthDark, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: Colors.white, fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
