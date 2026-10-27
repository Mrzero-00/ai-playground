import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { Colors } from '@/constants/theme';

export const OPEN_DURATION_MS = 1000;

/** 생성 이미지(1024²) 안에서 계란이 차지하는 범위. 가로 209~812, 세로 74~949, 이음새 561~592. */
const EGG_LEFT = 209 / 1024;
const EGG_WIDTH = (812 - 209) / 1024;
const EGG_TOP = 74 / 1024;
const EGG_HEIGHT = (949 - 74) / 1024;
const SEAM = 576 / 1024;

/** 상자 가로 1에 대한 세로 비율. 계란 비율(1.45)보다 살짝 여유를 둔다. */
export const CAPSULE_ASPECT = 1.42;

type Props = {
  /** 상자 가로 폭. 세로는 CAPSULE_ASPECT 배. */
  width?: number;
  /** false = 닫힘, true = 열림. 바뀌면 뚜껑이 천천히 들린다. */
  open: boolean;
  onOpened?: () => void;
};

const EGG = require('../../assets/capsule/egg-closed.png');

/**
 * 계란형 타임캡슐. 한 장의 이미지를 이음새에서 위·아래로 나눠, 뚜껑(위)만 들어 올리고
 * 그 뒤로 편지·사진·테이프가 튀어나온다. 바탕이 크림색이라 잘린 테두리가 보이지 않는다.
 */
export function OpeningCapsule({ width = 300, open, onOpened }: Props) {
  const [progress] = useState(() => new Animated.Value(open ? 1 : 0));
  const height = Math.round(width * CAPSULE_ASPECT);
  // 계란 가로가 상자의 94%가 되도록 이미지를 키우고, 계란 중심을 상자 중심에 맞춘다.
  const img = Math.round((width * 0.94) / EGG_WIDTH);
  const offsetX = Math.round(EGG_LEFT * img - (width - EGG_WIDTH * img) / 2);
  const offsetY = Math.round((EGG_TOP + EGG_HEIGHT / 2) * img - height / 2);
  const lidHeight = Math.round(SEAM * img - offsetY);

  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: open ? 1 : 0, duration: OPEN_DURATION_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
    animation.start(({ finished }) => {
      if (finished && open) onOpened?.();
    });
    return () => animation.stop();
  }, [open, progress, onOpened]);

  const lidStyle = {
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.26] }) },
      { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, width * 0.14] }) },
      { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '28deg'] }) },
    ],
  };
  const itemsStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }),
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [height * 0.16, height * 0.16, 0] }) },
      { scale: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.5, 1] }) },
    ],
  };

  return (
    <View style={{ width, height }}>
      <View style={[styles.half, { top: lidHeight, height: height - lidHeight, width }]}>
        <Image source={EGG} style={{ width: img, height: img, marginTop: -(lidHeight + offsetY), marginLeft: -offsetX }} contentFit="contain" accessibilityLabel="타임캡슐" />
      </View>

      <Animated.View style={[StyleSheet.absoluteFill, itemsStyle]} pointerEvents="none">
        <Svg width={width} height={height} viewBox="0 0 240 340" preserveAspectRatio="xMidYMid meet">
          <G x={54} y={92}>
            <G rotation={-14}>
              <Rect x={0} y={0} width={48} height={32} rx={4} fill={Colors.white} stroke={Colors.ink} strokeWidth={4} />
              <Path d="M0 3l24 16 24-16" fill="none" stroke={Colors.ink} strokeWidth={4} strokeLinejoin="round" />
              <Circle cx={24} cy={24} r={3} fill={Colors.coral} />
            </G>
          </G>
          <G x={138} y={70}>
            <G rotation={10}>
              <Rect width={40} height={46} rx={3} fill={Colors.white} stroke={Colors.ink} strokeWidth={4} />
              <Rect x={5} y={5} width={30} height={27} fill={Colors.sky} stroke={Colors.ink} strokeWidth={3} />
              <Circle cx={13} cy={13} r={3} fill={Colors.yellow} />
            </G>
          </G>
          <G x={96} y={134}>
            <G rotation={-4}>
              <Rect width={48} height={30} rx={4} fill={Colors.ink} />
              <Rect x={7} y={9} width={34} height={12} rx={6} fill={Colors.white} />
              <Circle cx={15} cy={15} r={3} fill={Colors.ink} />
              <Circle cx={33} cy={15} r={3} fill={Colors.ink} />
            </G>
          </G>
          <Rect x={40} y={60} width={8} height={14} rx={2} fill={Colors.yellow} stroke={Colors.ink} strokeWidth={3} rotation={20} origin="44, 67" />
          <Rect x={196} y={100} width={8} height={12} rx={2} fill={Colors.coral} stroke={Colors.ink} strokeWidth={3} rotation={-25} origin="200, 106" />
          <Circle cx={44} cy={150} r={5} fill={Colors.mint} stroke={Colors.ink} strokeWidth={3} />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.half, { top: 0, height: lidHeight, width }, lidStyle]} pointerEvents="none">
        <Image source={EGG} style={{ width: img, height: img, marginTop: -offsetY, marginLeft: -offsetX }} contentFit="contain" accessibilityLabel="" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  half: { position: 'absolute', left: 0, overflow: 'hidden' },
});
