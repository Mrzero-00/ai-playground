import React from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

/** A small mole peeking out. Decorative: surrounding text carries the meaning. */
export default function Dooji({ size = 48 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 80 80" aria-hidden={true}>
    <Ellipse cx="40" cy="66" rx="32" ry="8" fill="#D2E3E9" />
    <Path d="M16 59V39C16 21 27 12 40 12s24 9 24 27v20" fill="#B88E76" />
    <Ellipse cx="40" cy="47" rx="19" ry="21" fill="#F5DFCA" />
    <Circle cx="31" cy="40" r="2.2" fill="#354A52" />
    <Circle cx="49" cy="40" r="2.2" fill="#354A52" />
    <Ellipse cx="40" cy="48" rx="4" ry="3" fill="#765C51" />
    <Path d="M35 54q5 5 10 0" fill="none" stroke="#765C51" strokeWidth="1.8" strokeLinecap="round" />
    <Ellipse cx="24" cy="49" rx="4" ry="2.5" fill="#E8AC9F" />
    <Ellipse cx="56" cy="49" rx="4" ry="2.5" fill="#E8AC9F" />
    <Ellipse cx="20" cy="63" rx="9" ry="5" fill="#B88E76" />
    <Ellipse cx="60" cy="63" rx="9" ry="5" fill="#B88E76" />
  </Svg>;
}
