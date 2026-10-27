import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { CAPSULE_ASPECT, OpeningCapsule } from '@/components/opening-capsule';
import { Colors } from '@/constants/theme';

export type CapsuleState = 'closed' | 'open' | 'buried';

type CapsuleProps = {
  state?: CapsuleState;
  /** 정사각 슬롯 한 변. 계란은 이 높이에 맞춰 가운데 놓인다. */
  size?: number;
};

/**
 * 계란형 타임캡슐 아이콘. 홈의 OpeningCapsule과 같은 이미지를 쓴다.
 * closed = 닫힌 계란, open = 뚜껑이 들린 계란과 내용물, buried = 흙더미에 반쯤 묻힌 계란.
 */
export function Capsule({ state = 'closed', size = 200 }: CapsuleProps) {
  // 열린 상태는 뚜껑이 위로 26% 들리므로, 슬롯 밖으로 삐져나가지 않게 계란을 그만큼 줄여 아래에 붙인다.
  const open = state === 'open';
  const height = open ? Math.round(size / 1.3) : size;
  const width = Math.round(height / CAPSULE_ASPECT);
  return (
    <View style={[styles.slot, open && styles.slotOpen, { width: size, height: size }]} accessibilityLabel={LABEL[state]} accessibilityRole="image">
      <View style={{ width, height }}>
        <OpeningCapsule width={width} open={open} />
      </View>
      {state === 'buried' && (
        // 흙더미는 계란보다 넓어야 하므로 계란 상자가 아니라 슬롯 전체에 그린다.
        <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d="M6 72C18 54 36 58 50 61C64 58 82 54 94 72V86C94 92 88 96 80 96H20C12 96 6 92 6 86Z" fill={Colors.soil} stroke={Colors.ink} strokeWidth={2.6} strokeLinejoin="round" />
          <Circle cx={24} cy={82} r={2} fill={Colors.soilDeep} />
          <Circle cx={60} cy={88} r={2.4} fill={Colors.soilDeep} />
          <Circle cx={80} cy={80} r={1.8} fill={Colors.soilDeep} />
          <Path d="M14 62c-6-3-4-10 1-9 3 .5 4 4 2 8" fill={Colors.mint} stroke={Colors.ink} strokeWidth={1.8} strokeLinejoin="round" />
          <Path d="M88 60c6-3 4-10-1-9-3 .5-4 4-2 8" fill={Colors.mint} stroke={Colors.ink} strokeWidth={1.8} strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}

const LABEL: Record<CapsuleState, string> = { closed: '닫힌 타임캡슐', open: '열린 타임캡슐', buried: '땅에 묻힌 타임캡슐' };

const styles = StyleSheet.create({
  slot: { alignItems: 'center', justifyContent: 'center' },
  slotOpen: { justifyContent: 'flex-end' },
});
