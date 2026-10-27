import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import type { ItemKind } from '@/domain/capsule';

export type IconName =
  | ItemKind
  | 'plus'
  | 'back'
  | 'close'
  | 'dots'
  | 'share'
  | 'lock'
  | 'calendar'
  | 'chevron'
  | 'play'
  | 'heart'
  | 'check'
  | 'arrow'
  | 'people'
  | 'mic'
  | 'stop'
  | 'map'
  | 'inbox'
  | 'locate';

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 20, color = Colors.ink, strokeWidth = 2.5 }: IconProps) {
  const common = { fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'letter' && (
        <>
          <Rect x={4} y={5} width={16} height={14} rx={2} {...common} />
          <Path d="M4 9l8 5 8-5" {...common} />
        </>
      )}
      {name === 'photo' && (
        <>
          <Rect x={3} y={7} width={18} height={13} rx={2} {...common} />
          <Path d="M8 7l1.5-3h5L16 7" {...common} />
          <Circle cx={12} cy={13.5} r={3.5} {...common} />
        </>
      )}
      {(name === 'voice' || name === 'mic') && (
        <>
          <Rect x={9} y={3} width={6} height={11} rx={3} {...common} />
          <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" {...common} />
        </>
      )}
      {name === 'video' && (
        <>
          <Rect x={3} y={6} width={13} height={12} rx={2} {...common} />
          <Path d="M16 10l5-3v10l-5-3" {...common} />
        </>
      )}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...common} />}
      {name === 'back' && <Path d="M15 6l-6 6 6 6" {...common} />}
      {name === 'chevron' && <Path d="M9 6l6 6-6 6" {...common} />}
      {name === 'close' && <Path d="M6 6l12 12M18 6L6 18" {...common} />}
      {name === 'arrow' && <Path d="M5 12h14M13 6l6 6-6 6" {...common} />}
      {name === 'check' && <Path d="M5 12l5 5 9-10" {...common} />}
      {name === 'dots' && (
        <>
          <Circle cx={12} cy={5} r={1.4} fill={color} />
          <Circle cx={12} cy={12} r={1.4} fill={color} />
          <Circle cx={12} cy={19} r={1.4} fill={color} />
        </>
      )}
      {name === 'share' && <Path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M8 7l4-4 4 4" {...common} />}
      {name === 'lock' && (
        <>
          <Rect x={5} y={11} width={14} height={9} rx={2} {...common} />
          <Path d="M8 11V8a4 4 0 0 1 8 0v3" {...common} />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Rect x={3} y={5} width={18} height={16} rx={2} {...common} />
          <Path d="M3 10h18M8 3v4M16 3v4" {...common} />
        </>
      )}
      {name === 'play' && <Path d="M8 5v14l11-7z" fill={color} />}
      {name === 'stop' && <Rect x={6} y={6} width={12} height={12} rx={2} fill={color} />}
      {name === 'heart' && <Path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" {...common} />}
      {name === 'map' && <Path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" {...common} />}
      {name === 'locate' && (
        <>
          <Circle cx={12} cy={12} r={7} {...common} />
          <Circle cx={12} cy={12} r={2} fill={color} />
          <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" {...common} />
        </>
      )}
      {name === 'inbox' && <Path d="M4 13l2-7h12l2 7v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5zM4 13h5l1 2h4l1-2h5" {...common} />}
      {name === 'people' && (
        <>
          <Circle cx={9} cy={8} r={3} {...common} />
          <Circle cx={17} cy={9} r={2.5} {...common} />
          <Path d="M3 19c0-3 3-5 6-5s6 2 6 5M14 18c0-2 2-3.5 4-3.5s3 1.5 3 3.5" {...common} />
        </>
      )}
    </Svg>
  );
}
