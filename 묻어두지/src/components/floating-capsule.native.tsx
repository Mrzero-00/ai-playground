import { Animated, StyleSheet, Text, View } from 'react-native';

import { Capsule } from '@/components/capsule';
import { Colors, Fonts, Stroke } from '@/constants/theme';
import type { CapsuleCountdown } from '@/lib/capsule-countdown';
import type { CapsuleSummary } from '@/shared/contracts';

/** Only the drawing floats. The parent marker stays on the saved coordinate. */
export function FloatingCapsule({ capsule, countdown, bob }: { capsule: CapsuleSummary; countdown: CapsuleCountdown; bob: Animated.Value }) {
  const ready = countdown.state === 'ready';
  const opened = countdown.state === 'opened';
  const tint = ready ? s.ready : opened ? s.opened : null;
  return (
    <View style={s.root} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[s.float, { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }]}>
        <View style={[s.clock, tint]}>
          <Text style={s.title} numberOfLines={1}>
            {capsule.title}
          </Text>
          <Text style={s.countdown} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {countdown.text}
          </Text>
          <View style={[s.tail, tint]} />
        </View>
        <View style={[s.figure, opened && { opacity: 0.7 }]}>
          <Capsule state={opened ? 'open' : 'closed'} size={82} />
        </View>
      </Animated.View>
      <View style={[s.ground, ready && s.readyGround]}>
        <Animated.View
          style={[s.shadow, { opacity: bob.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0.45] }), transform: [{ scale: bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.75] }) }] }]}
        />
        <View style={s.point} />
      </View>
    </View>
  );
}

export const FLOATING_CAPSULE_SIZE = { width: 194, height: 174, groundY: 163 } as const;

const s = StyleSheet.create({
  root: { width: 194, height: 174 },
  float: { position: 'absolute', top: 8, left: 0, width: 194, alignItems: 'center' },
  clock: { minWidth: 170, maxWidth: 194, borderWidth: Stroke.regular, borderColor: Colors.ink, borderRadius: 14, backgroundColor: Colors.white, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 7, shadowColor: Colors.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 3, height: 3 } },
  title: { maxWidth: 170, fontFamily: Fonts.body, fontSize: 10, lineHeight: 13, color: Colors.muted, marginBottom: 1, textAlign: 'center' },
  countdown: { fontFamily: Fonts.display, fontSize: 13, lineHeight: 17, fontVariant: ['tabular-nums'], color: Colors.ink, textAlign: 'center' },
  tail: { position: 'absolute', left: '50%', bottom: -6.5, width: 9, height: 9, marginLeft: -4.5, transform: [{ rotate: '45deg' }], borderRightWidth: Stroke.regular, borderBottomWidth: Stroke.regular, borderColor: Colors.ink, backgroundColor: Colors.white },
  figure: { marginTop: 4, height: 82 },
  ground: { position: 'absolute', top: 153, left: 68.5, width: 57, height: 19, borderRadius: 30, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)', backgroundColor: 'rgba(17,17,17,0.14)' },
  shadow: { position: 'absolute', left: 8, top: 4, width: 38, height: 9, borderRadius: 20, backgroundColor: 'rgba(17,17,17,0.28)' },
  point: { position: 'absolute', left: 25, top: 6, width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.white },
  ready: { backgroundColor: Colors.yellow },
  readyGround: { borderColor: Colors.yellow, backgroundColor: 'rgba(255,224,122,0.4)' },
  opened: { backgroundColor: Colors.mint },
});
