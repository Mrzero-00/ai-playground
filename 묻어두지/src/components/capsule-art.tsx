import { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';

/** The buried jar in the brand palette: cream body, earth outline, yellow lid. */
export function CapsuleArt({ size = 250, small = false, compact = false }: { size?: number; small?: boolean; compact?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const bodyId = `capsule-body-${id}`;
  const lidId = `capsule-lid-${id}`;
  return (
    <Svg width={size} height={size * (compact ? 1.2 : 0.78)} viewBox={compact ? '71 18 150 180' : '0 0 300 234'} accessibilityLabel="미래에 열어볼 타임캡슐">
      <Defs>
        <LinearGradient id={bodyId} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFFDF8" /><Stop offset="1" stopColor="#EADFCB" /></LinearGradient>
        <LinearGradient id={lidId} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#F9DC86" /><Stop offset="1" stopColor={Colors.yellow} /></LinearGradient>
      </Defs>
      {!small && (
        <G>
          <Ellipse cx="155" cy="189" rx="81" ry="13" fill="#E8D4B7" />
          <Circle cx="43" cy="101" r="3" fill={Colors.soil} />
          <Circle cx="245" cy="80" r="4" fill={Colors.yellow} />
          <Path d="M239 149h12m-6-6v12M74 42h9m-4.5-4.5v9" stroke={Colors.soil} strokeWidth="2" />
          <Path d="M43 159q-13-7-4-20q10 7 4 20m0 0q13-2 15-13q-15-3-15 13" fill={Colors.leaf} />
        </G>
      )}
      <G transform="translate(66 22) rotate(23 85 88)">
        <Rect x="32" y="52" width="114" height="124" rx="48" fill={`url(#${bodyId})`} stroke={Colors.earthDark} strokeWidth="5" />
        <Path d="M47 94v35q0 30 25 32" fill="none" stroke="#FFFFFF" strokeWidth="3" opacity=".7" />
        <Path d="M32 73V62a57 49 0 0 1 114 0v11z" fill={`url(#${lidId})`} stroke={Colors.earthDark} strokeWidth="5" />
        <Ellipse cx="89" cy="66" rx="57" ry="15" fill="#E2B44A" />
        <Ellipse cx="89" cy="62" rx="57" ry="13" fill="#F9DC86" stroke={Colors.earthDark} strokeWidth="3" />
        <Line x1="42" y1="82" x2="136" y2="82" stroke={Colors.earthDark} strokeWidth="3" opacity=".35" />
        <Rect x="66" y="101" width="46" height="40" rx="5" fill={Colors.surface} stroke={Colors.earthDark} strokeWidth="3" />
        <Path d="M77 117h24m-24 7h15" stroke={Colors.earth} strokeWidth="2.5" strokeLinecap="round" />
        <Path d="M85 54q-8-10 0-19q8 9 0 19m0 0q3-12 14-10q-1 10-14 10" fill={Colors.leaf} />
      </G>
    </Svg>
  );
}
