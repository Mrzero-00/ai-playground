import React, { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export default function CapsuleArt({ size = 250, small = false, compact = false }: { size?: number; small?: boolean; compact?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const bodyId = `capsule-body-${id}`, lidId = `capsule-lid-${id}`;
  return <Svg width={size} height={size * (compact ? 1.2 : 0.78)} viewBox={compact ? '71 18 150 180' : '0 0 300 234'} accessibilityLabel="미래에 열어볼 하늘색 타임캡슐">
    <Defs>
      <LinearGradient id={bodyId} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#B4D6E4"/><Stop offset="1" stopColor="#779EAF"/></LinearGradient>
      <LinearGradient id={lidId} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#F3DEC6"/><Stop offset="1" stopColor="#D3AD89"/></LinearGradient>
    </Defs>
    {!small && <G><Ellipse cx="155" cy="189" rx="81" ry="13" fill="#DCE8EB"/><Circle cx="43" cy="101" r="3" fill="#C3DFEB"/><Circle cx="245" cy="80" r="4" fill="#F8DED2"/><Path d="M239 149h12m-6-6v12M74 42h9m-4.5-4.5v9" stroke="#B4D6E4" strokeWidth="2"/><Path d="M43 159q-13-7-4-20q10 7 4 20m0 0q13-2 15-13q-15-3-15 13" fill="#B1CFDA"/></G>}
    <G transform="translate(66 22) rotate(23 85 88)">
      <Rect x="32" y="52" width="114" height="124" rx="48" fill={`url(#${bodyId})`}/>
      <Path d="M47 94v35q0 30 25 32" fill="none" stroke="#D9EDF7" strokeWidth="3" opacity=".45"/>
      <Path d="M32 73V62a57 49 0 0 1 114 0v11z" fill={`url(#${lidId})`}/>
      <Ellipse cx="89" cy="68" rx="57" ry="16" fill="#C5A27F"/>
      <Ellipse cx="89" cy="63" rx="57" ry="14" fill="#E5C5A7"/>
      <Line x1="42" y1="80" x2="136" y2="80" stroke="#316C85" strokeWidth="3" opacity=".3"/>
      <Rect x="66" y="101" width="46" height="40" rx="5" fill="#FFFEFA"/>
      <Path d="M77 117h24m-24 7h15" stroke="#779EAF" strokeWidth="2"/>
      <Path d="M85 54q-8-10 0-19q8 9 0 19m0 0q3-12 14-10q-1 10-14 10" fill="#638D9D"/>
    </G>
  </Svg>;
}
