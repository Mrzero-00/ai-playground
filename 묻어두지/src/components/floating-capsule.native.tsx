import { Animated, StyleSheet, Text, View } from 'react-native';

import { CapsuleArt } from '@/components/capsule-art';
import { Colors } from '@/constants/theme';
import type { CapsuleCountdown } from '@/lib/capsule-countdown';
import type { CapsuleSummary } from '@/shared/contracts';

/** Only the drawing floats. The parent marker stays on the saved coordinate. */
export function FloatingCapsule({ capsule, countdown, bob }: {
  capsule: CapsuleSummary; countdown: CapsuleCountdown; bob: Animated.Value;
}) {
  const ready = countdown.state === 'ready';
  const opened = countdown.state === 'opened';
  const tint = ready ? s.ready : opened ? s.opened : null;
  return (
    <View style={s.root} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[s.float, { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }]}>
        <View style={[s.clock, tint]}>
          <Text style={s.title} numberOfLines={1}>{capsule.title}</Text>
          <Text style={[s.countdown, ready && s.readyText, opened && s.openedText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{countdown.text}</Text>
          <View style={[s.tail, tint]} />
        </View>
        <View style={[s.figure, opened && { opacity: 0.7 }]}><CapsuleArt size={68} small compact /></View>
      </Animated.View>
      <View style={[s.ground, ready && s.readyGround]}>
        <Animated.View style={[s.shadow, { opacity: bob.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0.45] }), transform: [{ scale: bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.75] }) }] }]} />
        <View style={s.point} />
      </View>
    </View>
  );
}

export const FLOATING_CAPSULE_SIZE = { width: 194, height: 174, groundY: 163 } as const;

const s = StyleSheet.create({
  root: { width: 194, height: 174 },
  float: { position: 'absolute', top: 8, left: 0, width: 194, alignItems: 'center' },
  clock: { minWidth: 170, maxWidth: 194, borderWidth: 2, borderColor: Colors.earthDark, borderRadius: 13, backgroundColor: Colors.surface, paddingHorizontal: 10, paddingTop: 7, paddingBottom: 8 },
  title: { maxWidth: 170, fontSize: 9, lineHeight: 13, fontWeight: '700', color: Colors.muted, marginBottom: 2, textAlign: 'center' },
  countdown: { fontSize: 12, lineHeight: 17, fontWeight: '900', fontVariant: ['tabular-nums'], color: Colors.earthDark, textAlign: 'center', letterSpacing: -0.25 },
  tail: { position: 'absolute', left: '50%', bottom: -6, width: 9, height: 9, marginLeft: -4.5, transform: [{ rotate: '45deg' }], borderRightWidth: 2, borderBottomWidth: 2, borderColor: Colors.earthDark, backgroundColor: Colors.surface },
  figure: { marginTop: 8, height: 82 },
  ground: { position: 'absolute', top: 153, left: 68.5, width: 57, height: 19, borderRadius: 30, borderWidth: 1.5, borderColor: '#FFFDF8BF', backgroundColor: '#4D342822' },
  shadow: { position: 'absolute', left: 8, top: 4, width: 38, height: 9, borderRadius: 20, backgroundColor: '#4D342840' },
  point: { position: 'absolute', left: 25, top: 6, width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.surface },
  ready: { backgroundColor: '#FFF1C2', borderColor: Colors.earthDark },
  readyText: { color: Colors.earth },
  readyGround: { borderColor: '#FFF2BA', backgroundColor: '#F4C95D55' },
  opened: { backgroundColor: Colors.leafSoft, borderColor: Colors.leaf },
  openedText: { color: Colors.leaf },
});
