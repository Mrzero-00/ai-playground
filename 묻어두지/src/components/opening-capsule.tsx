import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { Colors } from '@/constants/theme';

export const OPEN_DURATION_MS = 1000;

/** 계란형 캡슐 이미지에서 노란 이음새가 있는 세로 위치(0~1). 뚜껑/몸통 분할선. */
const SEAM = 0.5625;

type Props = {
  size?: number;
  /** false = 닫힘, true = 열림. 바뀌면 뚜껑이 천천히 들린다. */
  open: boolean;
  onOpened?: () => void;
};

const EGG = require('../../assets/capsule/egg-closed.png');

/**
 * 계란형 타임캡슐. 한 장의 이미지를 이음새에서 위·아래로 나눠, 뚜껑(위)만 들어 올리고
 * 그 뒤로 편지·사진·테이프가 튀어나온다. 바탕이 크림색이라 잘린 테두리가 보이지 않는다.
 */
export function OpeningCapsule({ size = 260, open, onOpened }: Props) {
  const [progress] = useState(() => new Animated.Value(open ? 1 : 0));
  const lidHeight = Math.round(size * SEAM);

  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: open ? 1 : 0, duration: OPEN_DURATION_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
    animation.start(({ finished }) => {
      if (finished && open) onOpened?.();
    });
    return () => animation.stop();
  }, [open, progress, onOpened]);

  const lidStyle = {
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.34] }) },
      { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, size * 0.12] }) },
      { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '28deg'] }) },
    ],
  };
  const itemsStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }),
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [size * 0.18, size * 0.18, 0] }) },
      { scale: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.5, 1] }) },
    ],
  };

  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.half, { top: lidHeight, height: size - lidHeight, width: size }]}>
        <Image source={EGG} style={{ width: size, height: size, marginTop: -lidHeight }} contentFit="contain" accessibilityLabel="타임캡슐" />
      </View>

      <Animated.View style={[StyleSheet.absoluteFill, itemsStyle]} pointerEvents="none">
        <Svg width={size} height={size} viewBox="0 0 240 240">
          <G x={64} y={48}>
            <G rotation={-14}>
              <Rect x={0} y={0} width={44} height={30} rx={4} fill={Colors.white} stroke={Colors.ink} strokeWidth={4} />
              <Path d="M0 3l22 15 22-15" fill="none" stroke={Colors.ink} strokeWidth={4} strokeLinejoin="round" />
              <Circle cx={22} cy={22} r={3} fill={Colors.coral} />
            </G>
          </G>
          <G x={132} y={30}>
            <G rotation={10}>
              <Rect width={36} height={42} rx={3} fill={Colors.white} stroke={Colors.ink} strokeWidth={4} />
              <Rect x={5} y={5} width={26} height={24} fill={Colors.sky} stroke={Colors.ink} strokeWidth={3} />
              <Circle cx={12} cy={12} r={3} fill={Colors.yellow} />
            </G>
          </G>
          <G x={98} y={88}>
            <G rotation={-4}>
              <Rect width={44} height={28} rx={4} fill={Colors.ink} />
              <Rect x={6} y={8} width={32} height={12} rx={6} fill={Colors.white} />
              <Circle cx={13} cy={14} r={3} fill={Colors.ink} />
              <Circle cx={31} cy={14} r={3} fill={Colors.ink} />
            </G>
          </G>
          <Rect x={52} y={20} width={8} height={14} rx={2} fill={Colors.yellow} stroke={Colors.ink} strokeWidth={3} rotation={20} origin="56, 27" />
          <Rect x={190} y={60} width={8} height={12} rx={2} fill={Colors.coral} stroke={Colors.ink} strokeWidth={3} rotation={-25} origin="194, 66" />
          <Circle cx={52} cy={96} r={5} fill={Colors.mint} stroke={Colors.ink} strokeWidth={3} />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.half, { top: 0, height: lidHeight, width: size }, lidStyle]} pointerEvents="none">
        <Image source={EGG} style={{ width: size, height: size }} contentFit="contain" accessibilityLabel="" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  half: { position: 'absolute', left: 0, overflow: 'hidden' },
});
