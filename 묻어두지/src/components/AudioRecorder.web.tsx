import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AudioRecorderProps } from './AudioRecorder.types';

export default function AudioRecorder(_props: AudioRecorderProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>목소리 남기기</Text>
      <Text style={styles.body}>음성 녹음은 휴대폰 개발 빌드에서 확인할 수 있어요. 웹에서는 준비한 음성 파일을 담아주세요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#F1F2E8', borderRadius: 18, padding: 17, gap: 7 },
  title: { color: '#315B41', fontSize: 15, fontWeight: '700' },
  body: { color: '#647262', fontSize: 13, lineHeight: 20 },
});
