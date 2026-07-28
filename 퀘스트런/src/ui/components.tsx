import React, { type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { colors, radii } from './theme';

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ScreenTitle({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <View style={styles.screenTitleRow}>
      <View>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.screenTitle}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function SectionHeader({ title, caption, action }: { title: string; caption?: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function ProgressBar({
  value,
  color = colors.brand,
  trackColor = colors.surfaceMuted,
  height = 8,
}: {
  value: number;
  color?: string;
  trackColor?: string;
  height?: number;
}) {
  const percent = Math.min(100, Math.max(0, value * 100));

  return (
    <View style={[styles.progressTrack, { backgroundColor: trackColor, height }]}>
      <View
        style={[
          styles.progressFill,
          {
            backgroundColor: color,
            height,
            width: `${percent}%`,
          },
        ]}
      />
    </View>
  );
}

export function Pill({
  children,
  tone = 'brand',
  style,
  textStyle,
}: PropsWithChildren<{
  tone?: 'brand' | 'orange' | 'dark' | 'neutral' | 'purple';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}>) {
  const toneStyle = {
    brand: styles.pillBrand,
    orange: styles.pillOrange,
    dark: styles.pillDark,
    neutral: styles.pillNeutral,
    purple: styles.pillPurple,
  }[tone];
  const toneTextStyle = {
    brand: styles.pillTextBrand,
    orange: styles.pillTextOrange,
    dark: styles.pillTextDark,
    neutral: styles.pillTextNeutral,
    purple: styles.pillTextPurple,
  }[tone];

  return (
    <View style={[styles.pill, toneStyle, style]}>
      <Text style={[styles.pillText, toneTextStyle, textStyle]}>{children}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  tone = 'brand',
  disabled = false,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  tone?: 'brand' | 'dark' | 'orange';
  disabled?: boolean;
}) {
  const backgroundColor = {
    brand: colors.brand,
    dark: colors.navy,
    orange: colors.orange,
  }[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor,
          opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
        },
      ]}
    >
      {icon ? <Text style={styles.primaryButtonIcon}>{icon}</Text> : null}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Text style={styles.iconButtonText}>{icon}</Text>
    </Pressable>
  );
}

export function Metric({ value, label, accent = colors.ink }: { value: string; label: string; accent?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.large,
    padding: 18,
    shadowColor: '#0B3024',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  screenTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  eyebrow: {
    color: colors.brandDark,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  screenTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 26,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  sectionCaption: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  progressTrack: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    borderRadius: radii.pill,
  },
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 26,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillBrand: {
    backgroundColor: colors.brandSoft,
  },
  pillOrange: {
    backgroundColor: colors.orangeSoft,
  },
  pillDark: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  pillNeutral: {
    backgroundColor: colors.surfaceMuted,
  },
  pillPurple: {
    backgroundColor: '#EEEAFE',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  pillTextBrand: {
    color: colors.brandDark,
  },
  pillTextOrange: {
    color: '#B94E0B',
  },
  pillTextDark: {
    color: colors.white,
  },
  pillTextNeutral: {
    color: colors.inkMuted,
  },
  pillTextPurple: {
    color: '#5949C7',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: radii.medium,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 20,
  },
  primaryButtonIcon: {
    color: colors.white,
    fontSize: 18,
    marginRight: 9,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  iconButtonText: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 19,
    fontWeight: '900',
  },
  metricLabel: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 5,
  },
});
