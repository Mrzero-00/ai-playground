import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import { Colors, Fonts, Radius, Screen, Spacing, Stroke, offsetShadow } from '@/constants/theme';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  tone?: 'primary' | 'secondary' | 'ghost' | 'yellow';
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

export function Button({ label, onPress, tone = 'primary', icon, disabled, style, compact }: ButtonProps) {
  const background =
    tone === 'primary' ? Colors.sky : tone === 'yellow' ? Colors.yellow : tone === 'secondary' ? Colors.white : 'transparent';
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
      {icon && <Icon name={icon} size={compact ? 16 : 20} color={tone === 'ghost' ? Colors.muted : Colors.ink} />}
      <Text style={[styles.buttonLabel, compact && styles.buttonLabelCompact, tone === 'ghost' && styles.buttonLabelGhost]}>{label}</Text>
    </Pressable>
  );
}

type ChipProps = { label: string; selected?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle> };

export function Chip({ label, selected, onPress, style }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, selected && offsetShadow(3), pressed && styles.buttonPressed, style]}>
      <Text style={styles.chipLabel}>{label}</Text>
    </Pressable>
  );
}

type TagProps = { label: string; tone?: 'yellow' | 'white' | 'sky' | 'mint' | 'coral' | 'dashed'; icon?: IconName };

export function Tag({ label, tone = 'white', icon }: TagProps) {
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

export function Card({ children, style, tone = 'white', shadow = true, onPress }: CardProps) {
  const background = tone === 'sky' ? Colors.sky : tone === 'yellow' ? Colors.yellow : tone === 'cream' ? Colors.cream : Colors.white;
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

export function IconButton({ name, label, onPress }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, offsetShadow(3), pressed && styles.buttonPressed]}>
      <Icon name={name} size={22} />
    </Pressable>
  );
}

type NavBarProps = { title?: ReactNode; left?: 'back' | 'close' | 'none'; right?: ReactNode; onLeft?: () => void };

export function NavBar({ title, left = 'back', right, onLeft }: NavBarProps) {
  const goBack = onLeft ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={styles.navBar}>
      {left === 'none' ? <View style={styles.navSpacer} /> : <IconButton name={left} label={left === 'back' ? '뒤로' : '닫기'} onPress={goBack} />}
      <View style={styles.navTitle}>{typeof title === 'string' ? <Text style={styles.navTitleText}>{title}</Text> : title}</View>
      {right ?? <View style={styles.navSpacer} />}
    </View>
  );
}

export function Page({ children, tone = 'cream', style }: { children: ReactNode; tone?: 'cream' | 'cyan' | 'yellow'; style?: StyleProp<ViewStyle> }) {
  const background = tone === 'cyan' ? Colors.cyan : tone === 'yellow' ? Colors.yellow : Colors.cream;
  return <View style={[styles.page, { backgroundColor: background }, style]}>{children}</View>;
}

export function Content({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.content, style]}>{children}</View>;
}

export function Title({ children, size = 26 }: { children: ReactNode; size?: number }) {
  return <Text style={[styles.title, { fontSize: size, lineHeight: size * 1.2 }]}>{children}</Text>;
}

export function Body({ children, muted = true, center = false, size = 13 }: { children: ReactNode; muted?: boolean; center?: boolean; size?: number }) {
  return <Text style={[styles.body, { fontSize: size, lineHeight: size * 1.6 }, muted && { color: Colors.muted }, center && { textAlign: 'center' }]}>{children}</Text>;
}

export function Display({ children, color = Colors.ink }: { children: ReactNode; color?: string }) {
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
  buttonPressed: { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOffset: { width: 2, height: 2 } },
  buttonDisabled: { opacity: 0.45 },
  buttonLabel: { fontFamily: Fonts.display, fontSize: 19, color: Colors.ink },
  buttonLabelCompact: { fontSize: 15 },
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
  chipLabel: { fontFamily: Fonts.display, fontSize: 15, color: Colors.ink },
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
});
