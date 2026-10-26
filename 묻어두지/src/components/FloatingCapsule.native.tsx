import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { CapsuleSummary } from '../shared/contracts';
import type { CapsuleCountdown } from '../lib/capsuleCountdown';
import CapsuleArt from './CapsuleArt';

/** Only the drawing floats. The parent marker remains on the saved GPS coordinate. */
export default function FloatingCapsule({ capsule, countdown, bob }: {
  capsule: CapsuleSummary; countdown: CapsuleCountdown; bob: Animated.Value;
}) {
  const ready = countdown.state === 'ready', opened = countdown.state === 'opened';
  const tint = ready ? s.ready : opened ? s.opened : null;
  return <View style={s.root} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Animated.View style={[s.float, { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }]}>
      <View style={[s.clock, tint]}>
        <Text style={s.title} numberOfLines={1}>{capsule.title}</Text>
        <Text style={[s.countdown, ready && s.readyText, opened && s.openedText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.8}>{countdown.text}</Text>
        <View style={[s.tail, tint]}/>
      </View>
      <View style={[s.figure, opened && { opacity: .7 }]}><CapsuleArt size={68} small compact/></View>
    </Animated.View>
    <View style={[s.ground, ready && s.readyGround]}>
      <Animated.View style={[s.shadow, { opacity: bob.interpolate({ inputRange: [0, 1], outputRange: [.8, .45] }), transform: [{ scale: bob.interpolate({ inputRange: [0, 1], outputRange: [1, .75] }) }] }]}/>
      <View style={s.point}/>
    </View>
  </View>;
}

const s = StyleSheet.create({
  root: { width: 194, height: 174 },
  float: { position: 'absolute', top: 8, left: 0, width: 194, alignItems: 'center' },
  clock: { minWidth: 170, maxWidth: 194, borderWidth: 1, borderColor: '#C7DBE2', borderRadius: 13, backgroundColor: '#FFFEFA', paddingHorizontal: 10, paddingTop: 7, paddingBottom: 8 },
  title: { maxWidth: 170, fontSize: 9, lineHeight: 13, fontWeight: '500', color: '#657B84', marginBottom: 2, textAlign: 'center' },
  countdown: { fontSize: 12, lineHeight: 17, fontWeight: '700', fontVariant: ['tabular-nums'], color: '#316C85', textAlign: 'center', letterSpacing: -.25 },
  tail: { position: 'absolute', left: '50%', bottom: -5, width: 8, height: 8, marginLeft: -4, transform: [{ rotate: '45deg' }], borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#C7DBE2', backgroundColor: '#FFFEFA' },
  figure: { marginTop: 7, height: 82 },
  ground: { position: 'absolute', top: 153, left: 68.5, width: 57, height: 19, borderRadius: 30, borderWidth: 1.5, borderColor: '#FFFEFABF', backgroundColor: '#C7DBE22E' },
  shadow: { position: 'absolute', left: 8, top: 4, width: 38, height: 9, borderRadius: 20, backgroundColor: '#354A5233' },
  point: { position: 'absolute', left: 25, top: 6, width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFFEFA' },
  ready: { backgroundColor: '#FFF5D9', borderColor: '#D6B77A' }, readyText: { color: '#806024' }, readyGround: { borderColor: '#FFF2BA', backgroundColor: '#EACA7740' },
  opened: { backgroundColor: '#EDF1ED', borderColor: '#CEDBD3' }, openedText: { color: '#5B7768' },
});
