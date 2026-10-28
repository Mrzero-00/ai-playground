import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Colors, Fonts, Radius } from '@/constants/theme';

/** 기기 몸체 사진 텍스처(세로)와 아래쪽 고무 그립. */
export const BODY_TEXTURE = require('../../assets/texture/body.png');
export const GRIP_TEXTURE = require('../../assets/texture/grip.png');

export type PlateKind = 'shutter' | 'keycap' | 'brass' | 'panel' | 'lcd' | 'led';

type Spec = { colors: readonly [string, string, ...string[]]; locations?: readonly [number, number, ...number[]]; border: { top: string; left: string; bottom: string; right: string }; raised: boolean; highlight?: number; shadow?: number };

/** 재질별 그라데이션과 테두리. raised 는 튀어나온 것(키캡·셔터), 아니면 파인 것(패널·LCD). */
const SPEC: Record<PlateKind, Spec> = {
  shutter: { colors: ['#F7A676', '#E0652E', '#B4461A'], locations: [0, 0.5, 1], border: { top: '#F6C39F', left: '#E2865A', bottom: '#6F2D10', right: '#8E3E1C' }, raised: true, highlight: 0.5, shadow: 0.38 },
  keycap: { colors: ['#F8F2E3', '#E6DDC7', '#CBC0A6'], locations: [0, 0.55, 1], border: { top: '#FFFBF0', left: '#EFE7D3', bottom: '#7D745F', right: '#9E9480' }, raised: true, highlight: 0.45, shadow: 0.3 },
  brass: { colors: ['#E9D28C', '#C9A24A', '#95762A'], locations: [0, 0.5, 1], border: { top: '#F5E4AE', left: '#D9B96A', bottom: '#5E4A14', right: '#7A6020' }, raised: true, highlight: 0.5, shadow: 0.32 },
  panel: { colors: ['#C7BCA3', '#D9CFB8', '#DDD4BE'], locations: [0, 0.35, 1], border: { top: '#8F8571', left: '#A89D86', bottom: '#F3EDDC', right: '#EDE5D2' }, raised: false },
  lcd: { colors: ['#7D8A68', '#6A775C', '#5F6B52'], locations: [0, 0.4, 1], border: { top: '#2F3626', left: '#3F4733', bottom: '#8A9574', right: '#7F8A6C' }, raised: false },
  led: { colors: ['#1A1F16', '#232A1E'], border: { top: '#0E120C', left: '#171C13', bottom: '#4A5340', right: '#3C4435' }, raised: false },
};

type PlateProps = { kind: PlateKind; children?: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; pressed?: boolean };

/**
 * 플라스틱 기기의 한 조각. 그라데이션 + 명암 테두리 + (튀어나온 것은) 윗면 하이라이트와 바닥 그림자,
 * (파인 것은) 윗부분 안쪽 그림자. 버튼·키캡·패널·LCD 가 전부 이걸로 만들어진다.
 */
export function Plate({ kind, children, style, radius = Radius.md, pressed }: PlateProps) {
  const spec = SPEC[kind];
  return (
    <View
      style={[
        { borderRadius: radius, borderWidth: 1, borderTopColor: spec.border.top, borderLeftColor: spec.border.left, borderBottomColor: spec.border.bottom, borderRightColor: spec.border.right, overflow: 'hidden' },
        spec.raised && !pressed && { shadowColor: '#2A1F10', shadowOpacity: spec.shadow ?? 0.3, shadowRadius: 2, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
        spec.raised && pressed && { shadowOpacity: 0, transform: [{ translateY: 2 }] },
        style,
      ]}>
      <LinearGradient colors={spec.colors} locations={spec.locations} style={StyleSheet.absoluteFill} />
      {spec.raised ? (
        <LinearGradient colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} style={[styles.highlight, { height: `${Math.round((spec.highlight ?? 0.5) * 100)}%` }]} pointerEvents="none" />
      ) : (
        <LinearGradient colors={['rgba(20,14,6,0.28)', 'rgba(20,14,6,0)']} style={styles.innerShadow} pointerEvents="none" />
      )}
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

/** 플라스틱에 각인한 글자: 아래쪽에 밝은 그림자 한 줄. */
export const engraved: TextStyle = { textShadowColor: 'rgba(255,255,255,0.65)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 };

type LcdProps = { children: ReactNode; size?: number; align?: 'left' | 'center' | 'right'; style?: StyleProp<ViewStyle>; dim?: boolean; lines?: number };

/** 올리브색 LCD 창. 글자는 픽셀 한글(갈무리). */
export function Lcd({ children, size = 14, align = 'center', style, dim, lines }: LcdProps) {
  return (
    <Plate kind="lcd" radius={Radius.sm} style={style}>
      <Text numberOfLines={lines} style={[styles.lcdText, { fontSize: size, lineHeight: Math.round(size * 1.35), textAlign: align, paddingHorizontal: 12, paddingVertical: 8 }, dim && styles.lcdDim]}>
        {children}
      </Text>
    </Plate>
  );
}

/** 사진 인화물의 오렌지 LED 날짜 도장. */
export function DateStamp({ date, style }: { date: Date; style?: StyleProp<TextStyle> }) {
  const text = `'${String(date.getFullYear()).slice(2)} ${String(date.getMonth() + 1).padStart(2, '0')} ${String(date.getDate()).padStart(2, '0')}`;
  return <Text style={[styles.stamp, style]}>{text}</Text>;
}

/** 작은 LED 점. on 이면 켜진 색. */
export function Led({ on, color = Colors.mint, size = 8 }: { on: boolean; color?: string; size?: number }) {
  return <View style={[styles.led, { width: size, height: size, borderRadius: size / 2 }, on ? { backgroundColor: color, shadowColor: color, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } } : styles.ledOff]} />;
}

const styles = StyleSheet.create({
  highlight: { position: 'absolute', left: 0, right: 0, top: 0 },
  innerShadow: { position: 'absolute', left: 0, right: 0, top: 0, height: 12 },
  inner: { position: 'relative' },
  lcdText: { fontFamily: Fonts.lcd, color: Colors.cyanInk, letterSpacing: 0.5 },
  lcdDim: { opacity: 0.55 },
  stamp: { fontFamily: Fonts.lcd, fontSize: 13, color: '#F2A33A', letterSpacing: 1, textShadowColor: 'rgba(242,163,58,0.85)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  led: { borderWidth: 1, borderColor: '#7D745F' },
  ledOff: { backgroundColor: '#5A5247' },
});
