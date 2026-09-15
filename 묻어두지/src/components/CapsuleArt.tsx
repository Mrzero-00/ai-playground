import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export default function CapsuleArt({ size = 250, small = false }: { size?: number; small?: boolean }) {
  return <Svg width={size} height={size * 0.78} viewBox="0 0 300 234" accessibilityLabel="미래에 열어볼 초록색 타임캡슐">
    <Defs>
      <LinearGradient id="body" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#91a583"/><Stop offset="1" stopColor="#526b4b"/></LinearGradient>
      <LinearGradient id="lid" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#e2a370"/><Stop offset="1" stopColor="#be7950"/></LinearGradient>
    </Defs>
    {!small && <G><Ellipse cx="155" cy="189" rx="81" ry="13" fill="#e1dfd0"/><Circle cx="43" cy="101" r="3" fill="#bdc9b0"/><Circle cx="245" cy="80" r="4" fill="#d5b998"/><Path d="M239 149h12m-6-6v12M74 42h9m-4.5-4.5v9" stroke="#91a583" strokeWidth="2"/><Path d="M43 159q-13-7-4-20q10 7 4 20m0 0q13-2 15-13q-15-3-15 13" fill="#8d9d7e"/></G>}
    <G transform="translate(66 22) rotate(23 85 88)">
      <Rect x="32" y="52" width="114" height="124" rx="48" fill="url(#body)"/>
      <Path d="M47 94v35q0 30 25 32" fill="none" stroke="#b4c3a6" strokeWidth="3" opacity=".45"/>
      <Path d="M32 73V62a57 49 0 0 1 114 0v11z" fill="url(#lid)"/>
      <Ellipse cx="89" cy="68" rx="57" ry="16" fill="#bc794e"/>
      <Ellipse cx="89" cy="63" rx="57" ry="14" fill="#da9b68"/>
      <Line x1="42" y1="80" x2="136" y2="80" stroke="#314d36" strokeWidth="3" opacity=".3"/>
      <Rect x="66" y="101" width="46" height="40" rx="5" fill="#f3ecd9"/>
      <Path d="M77 117h24m-24 7h15" stroke="#919b82" strokeWidth="2"/>
      <Path d="M85 54q-8-10 0-19q8 9 0 19m0 0q3-12 14-10q-1 10-14 10" fill="#426047"/>
    </G>
  </Svg>;
}
