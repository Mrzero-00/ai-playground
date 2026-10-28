import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { BODY_TEXTURE, GRIP_TEXTURE, Lcd, Plate, engraved } from '@/components/device';
import { Icon, type IconName } from '@/components/icons';
import { Colors, DEVICE, Fonts, Radius, Screen, Spacing, Stroke, offsetShadow } from '@/constants/theme';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  tone?: 'primary' | 'secondary' | 'ghost' | 'yellow';
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

/**
 * A안: 스티커 알약 버튼. B안(기기): primary 는 오렌지 셔터, secondary 는 베이지 키캡, yellow 는 황동 키캡, ghost 는 각인 글자.
 */
export function Button({ label, onPress, tone = 'primary', icon, disabled, style, compact }: ButtonProps) {
  if (DEVICE && tone !== 'ghost') {
    const kind = tone === 'primary' ? 'shutter' : tone === 'yellow' ? 'brass' : 'keycap';
    const labelColor = tone === 'primary' ? '#3A1608' : Colors.ink;
    return (
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[disabled && styles.buttonDisabled, style]}>
        {({ pressed }) => (
          <Plate kind={kind} pressed={pressed} radius={Radius.md} style={[styles.plateButton, compact && styles.plateButtonCompact]}>
            <View style={[styles.plateButtonInner, compact && styles.plateButtonInnerCompact]}>
              {icon && <Icon name={icon} size={compact ? 16 : 20} color={labelColor} />}
              <Text style={[styles.buttonLabel, compact && styles.buttonLabelCompact, { color: labelColor }, tone !== 'primary' && engraved]}>{label}</Text>
            </View>
          </Plate>
        )}
      </Pressable>
    );
  }
  const background =
    tone === 'primary' ? (DEVICE ? Colors.coral : Colors.sky) : tone === 'yellow' ? Colors.yellow : tone === 'secondary' ? Colors.white : 'transparent';
  const labelColor = tone === 'ghost' ? Colors.muted : DEVICE && tone === 'primary' ? '#2A1208' : Colors.ink;
  const shadow = tone === 'ghost' ? null : offsetShadow(compact ? 3 : 5);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        tone === 'ghost' && styles.buttonGhost,
        { backgroundColor: background },
        shadow,
        pressed && tone !== 'ghost' && styles.buttonPressed,
        disabled && styles.buttonDisabled,
        style,
      ]}>
      {icon && <Icon name={icon} size={compact ? 16 : 20} color={labelColor} />}
      <Text style={[styles.buttonLabel, compact && styles.buttonLabelCompact, tone === 'ghost' && styles.buttonLabelGhost, { color: labelColor }, DEVICE && tone !== 'primary' && engraved]}>{label}</Text>
    </Pressable>
  );
}

type ChipProps = { label: string; selected?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle> };

/** 고르는 칩. B안에서는 안 고른 것은 키캡, 고른 것은 눌려서 LCD 처럼 켜진다. */
export function Chip({ label, selected, onPress, style }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [!DEVICE && styles.chip, !DEVICE && selected && [styles.chipSelected, offsetShadow(3)], !DEVICE && pressed && styles.buttonPressed, style]}>
      {({ pressed }) =>
        DEVICE ? (
          <Plate kind={selected ? 'lcd' : 'keycap'} pressed={pressed} radius={Radius.sm} style={styles.chipPlate}>
            <View style={styles.chipPlateInner}>
              <Text style={[styles.chipLabel, selected ? styles.chipLabelLcd : engraved]}>{label}</Text>
            </View>
          </Plate>
        ) : (
          <Text style={styles.chipLabel}>{label}</Text>
        )
      }
    </Pressable>
  );
}

type TagProps = { label: string; tone?: 'yellow' | 'white' | 'sky' | 'mint' | 'coral' | 'dashed'; icon?: IconName };

/** 상태 표시. B안에서는 yellow/sky = LCD 창, mint/coral = LED 표시창, white = 각인 라벨, dashed = 빈 패널. */
export function Tag({ label, tone = 'white', icon }: TagProps) {
  if (DEVICE) {
    if (tone === 'yellow' || tone === 'sky') {
      return (
        <Plate kind="lcd" radius={Radius.sm} style={styles.tagPlate}>
          <View style={styles.tagPlateInner}>
            {icon && <Icon name={icon} size={12} color={Colors.cyanInk} />}
            <Text style={styles.tagLcdLabel}>{label}</Text>
          </View>
        </Plate>
      );
    }
    if (tone === 'mint' || tone === 'coral') {
      const color = tone === 'mint' ? Colors.mint : Colors.coral;
      return (
        <Plate kind="led" radius={Radius.sm} style={styles.tagPlate}>
          <View style={styles.tagPlateInner}>
            <View style={[styles.tagLedDot, { backgroundColor: color, shadowColor: color }]} />
            <Text style={[styles.tagLedLabel, { color }]}>{label}</Text>
          </View>
        </Plate>
      );
    }
    return (
      <View style={[styles.tagEngraved, tone === 'dashed' && styles.tagRecessed]}>
        {icon && <Icon name={icon} size={13} color={Colors.muted} />}
        <Text style={[styles.tagEngravedLabel, engraved]}>{label}</Text>
      </View>
    );
  }
  const background =
    tone === 'yellow' ? Colors.yellow : tone === 'sky' ? Colors.sky : tone === 'mint' ? Colors.mint : tone === 'coral' ? Colors.coral : tone === 'dashed' ? Colors.cream : Colors.white;
  const textColor = tone === 'coral' ? Colors.white : tone === 'dashed' ? Colors.muted : Colors.ink;
  return (
    <View style={[styles.tag, { backgroundColor: background }, tone === 'dashed' && styles.tagDashed]}>
      {icon && <Icon name={icon} size={13} color={textColor} />}
      <Text style={[styles.tagLabel, { color: textColor }]}>{label}</Text>
    </View>
  );
}

type CardProps = { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'white' | 'sky' | 'yellow' | 'cream'; shadow?: boolean; onPress?: () => void };

/** 카드. B안에서는 몸체에 파인 패널이고, tone 은 패널 면의 옅은 색조로만 남는다. */
export function Card({ children, style, tone = 'white', shadow = true, onPress }: CardProps) {
  const background = DEVICE
    ? tone === 'sky' ? 'rgba(120,150,140,0.22)' : tone === 'yellow' ? 'rgba(201,162,74,0.22)' : 'transparent'
    : tone === 'sky' ? Colors.sky : tone === 'yellow' ? Colors.yellow : tone === 'cream' ? Colors.cream : Colors.white;
  if (DEVICE) {
    // 바깥 Plate 는 크기(flex·width·margin)만, 안쪽 View 가 패딩·가로 배치 등 나머지 스타일을 받는다.
    const flat = StyleSheet.flatten(style) ?? {};
    const { flex, width, minWidth, maxWidth, margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical, alignSelf, ...inner } = flat as Record<string, unknown>;
    const outer = { flex, width, minWidth, maxWidth, margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical, alignSelf } as ViewStyle;
    const body = (pressed?: boolean) => (
      <Plate kind="panel" radius={Radius.lg} pressed={pressed} style={outer}>
        <View style={[styles.cardInner, tone !== 'white' && { backgroundColor: background }, inner as ViewStyle]}>{children}</View>
      </Plate>
    );
    if (onPress) {
      return (
        <Pressable accessibilityRole="button" onPress={onPress}>
          {({ pressed }) => body(pressed)}
        </Pressable>
      );
    }
    return body();
  }
  const base = [styles.card, { backgroundColor: background }, shadow && offsetShadow(4), style];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed && styles.buttonPressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

type AvatarProps = { name: string; tone?: 'yellow' | 'sky' | 'mint' | 'coral' | 'empty'; size?: number };

export function Avatar({ name, tone = 'yellow', size = 32 }: AvatarProps) {
  const background = tone === 'sky' ? Colors.sky : tone === 'mint' ? Colors.mint : tone === 'coral' ? Colors.coral : tone === 'empty' ? 'transparent' : Colors.yellow;
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
        tone === 'empty' && styles.avatarEmpty,
      ]}>
      <Text style={[styles.avatarLabel, { fontSize: size * 0.4 }, tone === 'empty' && { color: Colors.muted }]}>{name.slice(0, 1)}</Text>
    </View>
  );
}

export const AVATAR_TONES = ['yellow', 'sky', 'mint', 'coral'] as const;

type IconButtonProps = { name: IconName; label: string; onPress?: () => void };

/** 둥근 아이콘 버튼. B안에서는 둥근 키캡. */
export function IconButton({ name, label, onPress }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [!DEVICE && styles.iconButton, !DEVICE && offsetShadow(3), !DEVICE && pressed && styles.buttonPressed]}>
      {({ pressed }) =>
        DEVICE ? (
          <Plate kind="keycap" pressed={pressed} radius={22} style={styles.keycapRound}>
            <View style={styles.keycapRoundInner}>
              <Icon name={name} size={20} />
            </View>
          </Plate>
        ) : (
          <Icon name={name} size={22} />
        )
      }
    </Pressable>
  );
}

type NavBarProps = { title?: ReactNode; left?: 'back' | 'close' | 'none'; right?: ReactNode; onLeft?: () => void };

export function NavBar({ title, left = 'back', right, onLeft }: NavBarProps) {
  const goBack = onLeft ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={styles.navBar}>
      {left === 'none' ? <View style={styles.navSpacer} /> : <IconButton name={left} label={left === 'back' ? '뒤로' : '닫기'} onPress={goBack} />}
      <View style={styles.navTitle}>{typeof title === 'string' ? <Text style={[styles.navTitleText, DEVICE && engraved]}>{title}</Text> : title}</View>
      {right ?? <View style={styles.navSpacer} />}
    </View>
  );
}

/** 화면 바탕. B안에서는 tone 과 상관없이 베이지 플라스틱 몸체(미세한 결 포함). */
export function Page({ children, tone = 'cream', style }: { children: ReactNode; tone?: 'cream' | 'cyan' | 'yellow'; style?: StyleProp<ViewStyle> }) {
  if (DEVICE) {
    return (
      <ImageBackground source={BODY_TEXTURE} resizeMode="cover" style={[styles.page, { backgroundColor: Colors.cream }, style]}>
        <View style={styles.pageAboveGrip}>{children}</View>
        <Image source={GRIP_TEXTURE} resizeMode="cover" style={styles.grip} />
      </ImageBackground>
    );
  }
  const background = tone === 'cyan' ? Colors.cyan : tone === 'yellow' ? Colors.yellow : Colors.cream;
  return <View style={[styles.page, { backgroundColor: background }, style]}>{children}</View>;
}

export function Content({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.content, style]}>{children}</View>;
}

export function Title({ children, size = 26 }: { children: ReactNode; size?: number }) {
  return <Text style={[styles.title, { fontSize: size, lineHeight: size * 1.2 }, DEVICE && engraved]}>{children}</Text>;
}

export function Body({ children, muted = true, center = false, size = 13 }: { children: ReactNode; muted?: boolean; center?: boolean; size?: number }) {
  return <Text style={[styles.body, { fontSize: size, lineHeight: size * 1.6 }, muted && { color: Colors.muted }, center && { textAlign: 'center' }]}>{children}</Text>;
}

/** 큰 숫자(D-day 등). B안에서는 LCD 창에 픽셀 글자로. */
export function Display({ children, color = Colors.ink }: { children: ReactNode; color?: string }) {
  if (DEVICE) {
    return (
      <Lcd size={56} style={styles.displayLcd}>
        {children}
      </Lcd>
    );
  }
  return <Text style={[styles.display, { color }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 58,
    borderRadius: Radius.pill,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  buttonCompact: { minHeight: 44, paddingHorizontal: Spacing.lg },
  buttonGhost: { borderWidth: 0, minHeight: 44 },
  buttonPressed: DEVICE ? { transform: [{ translateY: 1 }], shadowOpacity: 0.08 } : { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOffset: { width: 2, height: 2 } },
  buttonDisabled: { opacity: 0.45 },
  buttonLabel: { fontFamily: Fonts.display, fontSize: DEVICE ? 17 : 19, color: Colors.ink },
  buttonLabelCompact: { fontSize: DEVICE ? 14 : 15 },
  buttonLabelGhost: { fontFamily: Fonts.body, fontSize: 14, color: Colors.muted },
  chip: {
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: Colors.yellow },
  chipLcd: { backgroundColor: Colors.cyan },
  chipLabel: { fontFamily: Fonts.display, fontSize: 15, color: Colors.ink },
  chipLabelLcd: { fontFamily: Fonts.lcd, color: Colors.cyanInk },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: Stroke.thin,
    borderColor: Colors.ink,
  },
  tagDashed: { borderStyle: 'dashed' },
  tagLabel: { fontFamily: Fonts.display, fontSize: 13 },
  tagLcd: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.sm, backgroundColor: Colors.cyan, borderWidth: 1, borderTopColor: '#3F4733', borderLeftColor: '#3F4733', borderBottomColor: '#8A9574', borderRightColor: '#8A9574' },
  tagLcdLabel: { fontFamily: Fonts.lcd, fontSize: 13, color: Colors.cyanInk, letterSpacing: 0.5 },
  tagLed: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.sm, backgroundColor: '#1E2418', borderWidth: 1, borderColor: '#3F4733' },
  tagLedDot: { width: 8, height: 8, borderRadius: 4, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  tagLedLabel: { fontFamily: Fonts.lcd, fontSize: 13, letterSpacing: 0.5 },
  tagEngraved: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 2, paddingVertical: 4 },
  tagRecessed: { paddingHorizontal: 10, borderRadius: Radius.sm, backgroundColor: '#CFC4AC' },
  tagEngravedLabel: { fontFamily: Fonts.display, fontSize: 12, color: Colors.muted, letterSpacing: 0.3 },
  card: { borderRadius: Radius.lg, borderWidth: Stroke.regular, borderColor: Colors.ink, padding: Spacing.lg },
  avatar: { borderWidth: Stroke.thin, borderColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  avatarEmpty: { borderStyle: 'dashed' },
  avatarLabel: { fontFamily: Fonts.display, color: Colors.ink },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: Spacing.sm },
  navTitle: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.sm },
  navTitleText: { fontFamily: Fonts.display, fontSize: 18, color: Colors.ink },
  navSpacer: { width: 44, height: 44 },
  page: { flex: 1 },
  content: { width: '100%', maxWidth: Screen.maxContentWidth, alignSelf: 'center', paddingHorizontal: Screen.horizontal },
  title: { fontFamily: Fonts.display, color: Colors.ink },
  body: { fontFamily: Fonts.body, color: Colors.ink },
  display: { fontFamily: Fonts.display, fontSize: 72, lineHeight: 76 },
  displayLcd: { minWidth: 200 },
  plateButton: { minHeight: 58 },
  plateButtonCompact: { minHeight: 44 },
  plateButtonInner: { minHeight: 56, paddingHorizontal: Spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  plateButtonInnerCompact: { minHeight: 42, paddingHorizontal: Spacing.lg },
  chipPlate: { minHeight: 44 },
  chipPlateInner: { minHeight: 42, paddingHorizontal: Spacing.lg, alignItems: 'center', justifyContent: 'center' },
  tagPlate: { alignSelf: 'flex-start' },
  tagPlateInner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5 },
  cardInner: { padding: Spacing.lg, borderRadius: Radius.lg - 1 },
  keycapRound: { width: 44, height: 44 },
  keycapRoundInner: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  pageAboveGrip: { flex: 1, paddingBottom: 14 },
  grip: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 14, width: '100%', opacity: 0.85, pointerEvents: 'none' },
});
