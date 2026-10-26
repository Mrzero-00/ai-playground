import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

import { Colors } from '@/constants/theme';

export type CapsuleState = 'closed' | 'open' | 'buried';

type CapsuleProps = {
  state?: CapsuleState;
  size?: number;
};

/** 스티커 스타일 타임캡슐. design/capsule/*.svg 와 같은 패스를 쓴다. */
export function Capsule({ state = 'closed', size = 200 }: CapsuleProps) {
  const clipId = `capsule-clip-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (state === 'open') return <OpenCapsule size={size} clipId={clipId} />;
  if (state === 'buried') return <BuriedCapsule size={size} clipId={clipId} />;
  return <ClosedCapsule size={size} clipId={clipId} />;
}

function Tube({ clipId, withEmblem }: { clipId: string; withEmblem: boolean }) {
  return (
    <>
      <Defs>
        <ClipPath id={clipId}>
          <Rect x={20} y={80} width={200} height={80} rx={40} />
        </ClipPath>
      </Defs>
      <Rect x={20} y={80} width={200} height={80} rx={40} fill={Colors.sky} />
      <Rect x={20} y={126} width={200} height={34} fill={Colors.cyan} clipPath={`url(#${clipId})`} />
      <G clipPath={`url(#${clipId})`}>
        <Rect x={54} y={74} width={24} height={92} fill={Colors.yellow} stroke={Colors.ink} strokeWidth={5} />
        <Rect x={162} y={74} width={24} height={92} fill={Colors.yellow} stroke={Colors.ink} strokeWidth={5} />
      </G>
      <Rect x={20} y={80} width={200} height={80} rx={40} fill="none" stroke={Colors.ink} strokeWidth={5} />
      <Path d="M36 112c2-10 8-17 16-21" fill="none" stroke={Colors.white} strokeWidth={5} strokeLinecap="round" />
      {withEmblem && (
        <>
          <Circle cx={120} cy={120} r={25} fill="#F2FBFF" stroke={Colors.ink} strokeWidth={5} />
          <Path d="M110 110A14 14 0 1 1 106 126" fill="none" stroke={Colors.ink} strokeWidth={4} strokeLinecap="round" />
          <Path d="M110 110l-8 1m8-1l-1 8" fill="none" stroke={Colors.ink} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M120 112v8h6" fill="none" stroke={Colors.ink} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </>
  );
}

function ClosedCapsule({ size, clipId }: { size: number; clipId: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" accessibilityLabel="닫힌 타임캡슐">
      <G rotation={-35} origin="120, 120">
        <Tube clipId={clipId} withEmblem />
      </G>
    </Svg>
  );
}

function BuriedCapsule({ size, clipId }: { size: number; clipId: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" accessibilityLabel="땅에 묻힌 타임캡슐">
      <G x={-2} y={10}>
        <G rotation={-50} origin="120, 120">
          <Tube clipId={clipId} withEmblem={false} />
        </G>
      </G>
      <Path
        d="M8 198C30 152 72 150 102 160C134 142 176 150 232 198L240 240L0 240Z"
        fill={Colors.soil}
        stroke={Colors.ink}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <Circle cx={64} cy={182} r={4} fill={Colors.soilDeep} />
      <Circle cx={150} cy={186} r={5} fill={Colors.soilDeep} />
      <Circle cx={196} cy={188} r={3} fill={Colors.soilDeep} />
      <Path d="M28 162c-12-6-10-20 2-18 6 1 8 8 4 16" fill={Colors.mint} stroke={Colors.ink} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M198 150c12-6 10-20-2-18-6 1-8 8-4 16" fill={Colors.mint} stroke={Colors.ink} strokeWidth={3} strokeLinejoin="round" />
    </Svg>
  );
}

function OpenCapsule({ size, clipId }: { size: number; clipId: string }) {
  const body = 'M54 90H150V170H54A40 40 0 0 1 54 90Z';
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" accessibilityLabel="열린 타임캡슐">
      <Defs>
        <ClipPath id={clipId}>
          <Path d={body} />
        </ClipPath>
      </Defs>
      <G rotation={-12} origin="120, 130">
        <Path d={body} fill={Colors.sky} />
        <Rect x={10} y={136} width={150} height={34} fill={Colors.cyan} clipPath={`url(#${clipId})`} />
        <G clipPath={`url(#${clipId})`}>
          <Rect x={50} y={84} width={24} height={92} fill={Colors.yellow} stroke={Colors.ink} strokeWidth={5} />
        </G>
        <Path d={body} fill="none" stroke={Colors.ink} strokeWidth={5} />
        <Ellipse cx={150} cy={130} rx={11} ry={40} fill="#0A8FB5" stroke={Colors.ink} strokeWidth={5} />
        <Path d="M30 122c2-10 8-17 16-21" fill="none" stroke={Colors.white} strokeWidth={5} strokeLinecap="round" />
        <G x={-70} y={-84}>
          <G rotation={-30} origin="186, 130">
            <Path d="M176 90H186A40 40 0 0 1 186 170H176Z" fill={Colors.yellow} stroke={Colors.ink} strokeWidth={5} />
            <Ellipse cx={176} cy={130} rx={9} ry={40} fill={Colors.yellowDeep} stroke={Colors.ink} strokeWidth={5} />
          </G>
        </G>
      </G>
      <G x={146} y={34}>
        <G rotation={-10}>
          <Rect x={0} y={0} width={40} height={28} rx={4} fill={Colors.white} stroke={Colors.ink} strokeWidth={4} />
          <Path d="M0 3l20 14 20-14" fill="none" stroke={Colors.ink} strokeWidth={4} strokeLinejoin="round" />
          <Circle cx={20} cy={21} r={3} fill={Colors.coral} />
        </G>
      </G>
      <G x={194} y={70}>
        <G rotation={12}>
          <Rect width={34} height={40} rx={3} fill={Colors.white} stroke={Colors.ink} strokeWidth={4} />
          <Rect x={5} y={5} width={24} height={22} fill={Colors.sky} stroke={Colors.ink} strokeWidth={3} />
          <Circle cx={12} cy={12} r={3} fill={Colors.yellow} />
        </G>
      </G>
      <G x={164} y={108}>
        <G rotation={-6}>
          <Rect width={42} height={26} rx={4} fill={Colors.ink} />
          <Rect x={6} y={7} width={30} height={12} rx={6} fill={Colors.white} />
          <Circle cx={13} cy={13} r={3} fill={Colors.ink} />
          <Circle cx={29} cy={13} r={3} fill={Colors.ink} />
        </G>
      </G>
      <Rect x={150} y={14} width={8} height={14} rx={2} fill={Colors.yellow} stroke={Colors.ink} strokeWidth={3} rotation={20} origin="154, 21" />
      <Rect x={226} y={40} width={8} height={12} rx={2} fill={Colors.coral} stroke={Colors.ink} strokeWidth={3} rotation={-25} origin="230, 46" />
      <Circle cx={214} cy={140} r={5} fill={Colors.mint} stroke={Colors.ink} strokeWidth={3} />
    </Svg>
  );
}
