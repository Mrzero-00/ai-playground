import { colors as C } from '../theme';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CapsuleARProps } from './CapsuleAR.types';

export default function CapsuleAR({ onClose }: CapsuleARProps) {
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>실제 장소에서 만나는 캡슐</Text>
          <Text style={styles.title}>AR은 휴대폰에서 확인해요</Text>
          <Text style={styles.body}>
            AR은 iPhone/Android 개발 빌드에서 확인할 수 있어요. 웹에서는 카메라로 바닥을 인식하거나 캡슐을 봉인·개봉할 수 없어요.
          </Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.button}>
            <Text style={styles.buttonText}>돌아가기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(25, 34, 28, 0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, padding: 28, borderRadius: 28, backgroundColor: C.background, gap: 14 },
  eyebrow: { color: C.primary, fontSize: 12, fontWeight: '700' },
  title: { color: C.ink, fontSize: 23, fontWeight: '700' },
  body: { color: C.muted, fontSize: 15, lineHeight: 24 },
  button: { padding: 17, borderRadius: 16, marginTop: 8, backgroundColor: C.primary, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
