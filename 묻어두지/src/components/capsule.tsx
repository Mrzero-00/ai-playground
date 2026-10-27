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
  const width = Math.round(size / CAPSULE_ASPECT);
  return (
    <View style={[styles.slot, { width: size, height: size }]} accessibilityLabel={LABEL[state]} accessibilityRole="image">
      <View style={{ width, height: size }}>
        <OpeningCapsule width={width} open={state === 'open'} />
        {state === 'buried' && (
          <Svg width={width} height={size} viewBox="0 0 240 340" style={StyleSheet.absoluteFill} pointerEvents="none">
            <Path d="M-12 232C36 178 92 184 122 196C154 178 206 182 252 232L252 352L-12 352Z" fill={Colors.soil} stroke={Colors.ink} strokeWidth={6} strokeLinejoin="round" />
            <Circle cx={60} cy={270} r={5} fill={Colors.soilDeep} />
            <Circle cx={150} cy={286} r={6} fill={Colors.soilDeep} />
            <Circle cx={200} cy={262} r={4} fill={Colors.soilDeep} />
            <Path d="M30 206c-14-7-11-24 2-21 7 1 9 9 5 19" fill={Colors.mint} stroke={Colors.ink} strokeWidth={4} strokeLinejoin="round" />
            <Path d="M214 198c14-7 11-24-2-21-7 1-9 9-5 19" fill={Colors.mint} stroke={Colors.ink} strokeWidth={4} strokeLinejoin="round" />
          </Svg>
        )}
      </View>
    </View>
  );
}

const LABEL: Record<CapsuleState, string> = { closed: '닫힌 타임캡슐', open: '열린 타임캡슐', buried: '땅에 묻힌 타임캡슐' };

const styles = StyleSheet.create({
  slot: { alignItems: 'center', justifyContent: 'center' },
});
