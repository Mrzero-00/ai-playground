import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Card, PrimaryButton, ScreenTitle } from '../ui/components';
import { colors, radii } from '../ui/theme';

interface RunConsentScreenProps {
  onCancel: () => void;
  onContinue: () => void;
}

export function RunConsentScreen({ onCancel, onContinue }: RunConsentScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenTitle eyebrow="BEFORE YOUR RUN" title="러닝 기록 준비" />

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroEmoji}>⌖</Text>
          </View>
          <Text style={styles.heroTitle}>달린 거리와 경로를 기록할게요</Text>
          <Text style={styles.heroCaption}>
            러닝을 시작한 동안에만 위치를 사용하며, 완료하면 위치 추적을 즉시 멈춰요.
          </Text>
        </View>

        <Card style={styles.permissionCard}>
          <PermissionRow
            caption="거리·속도·페이스와 이동 경로를 계산해요."
            icon="◎"
            title="위치 정보 사용"
          />
          <View style={styles.divider} />
          <PermissionRow
            caption="원본 GPS 좌표 대신 기기 안에 상대 경로만 저장해요."
            icon="◇"
            title="기기 내 안전한 저장"
          />
          <View style={styles.divider} />
          <PermissionRow
            caption="지역별 누적 거리를 계산해 숨은 업적을 열어요."
            icon="✦"
            title="지역 업적 기록"
          />
        </Card>

        <View style={styles.notice}>
          <Text style={styles.noticeIcon}>i</Text>
          <Text style={styles.noticeText}>
            위치 권한을 허용하지 않아도 홈·퀘스트·스타일·친구 기능은 계속 사용할 수 있어요. 권한은 기기
            설정에서 언제든 변경할 수 있습니다.
          </Text>
        </View>

        <PrimaryButton icon="▶" label="위치 사용에 동의하고 시작" onPress={onContinue} tone="brand" />
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>나중에 달리기</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function PermissionRow({ caption, icon, title }: { caption: string; icon: string; title: string }) {
  return (
    <View style={styles.permissionRow}>
      <View style={styles.permissionIcon}>
        <Text style={styles.permissionEmoji}>{icon}</Text>
      </View>
      <View style={styles.permissionCopy}>
        <Text style={styles.permissionTitle}>{title}</Text>
        <Text style={styles.permissionCaption}>{caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    paddingBottom: 34,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  hero: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 30,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 24,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  heroEmoji: {
    color: colors.yellow,
    fontSize: 36,
    fontWeight: '900',
  },
  heroTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 18,
    textAlign: 'center',
  },
  heroCaption: {
    color: '#CFE5E1',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 9,
    textAlign: 'center',
  },
  permissionCard: {
    marginTop: 14,
  },
  permissionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 8,
  },
  permissionIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 16,
    height: 45,
    justifyContent: 'center',
    marginRight: 12,
    width: 45,
  },
  permissionEmoji: {
    color: colors.brandDark,
    fontSize: 20,
    fontWeight: '900',
  },
  permissionCopy: {
    flex: 1,
  },
  permissionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  permissionCaption: {
    color: colors.inkMuted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
  },
  divider: {
    backgroundColor: colors.line,
    height: 1,
    marginVertical: 5,
  },
  notice: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.large,
    flexDirection: 'row',
    marginBottom: 18,
    marginTop: 14,
    padding: 14,
  },
  noticeIcon: {
    backgroundColor: colors.inkMuted,
    borderRadius: 10,
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    height: 20,
    lineHeight: 20,
    marginRight: 9,
    textAlign: 'center',
    width: 20,
  },
  noticeText: {
    color: colors.inkMuted,
    flex: 1,
    fontSize: 10,
    lineHeight: 16,
  },
  cancelButton: {
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 11,
  },
  cancelText: {
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: '800',
  },
});
