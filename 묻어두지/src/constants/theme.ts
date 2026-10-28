/**
 * 디자인 시안. 빌드 시 EXPO_PUBLIC_THEME 으로 고른다.
 * - sticker  (A안): 스티커 계란, 형광 하늘·노랑, 검정 외곽선 — 기본
 * - analog90 (B안): 같은 레이아웃을 90년대 일회용 카메라 같은 '기기'로 — 베이지 플라스틱 몸체, 올리브 LCD, 각인 라벨, 오렌지 셔터, 은색 캡슐
 */
export type ThemeName = 'sticker' | 'analog90';
export const THEME: ThemeName = process.env.EXPO_PUBLIC_THEME === 'analog90' ? 'analog90' : 'sticker';
/** B안은 화면을 기기처럼 그린다: 플라스틱 몸체, LCD, 키캡, 각인. */
export const DEVICE = THEME === 'analog90';

type Palette = {
  cream: string; white: string; sky: string; cyan: string; cyanInk: string; yellow: string; yellowDeep: string;
  ink: string; muted: string; faint: string; coral: string; mint: string; soil: string; soilDeep: string;
};

const STICKER: Palette = {
  cream: '#FFF6E5',
  white: '#FFFFFF',
  sky: '#5FDCFF',
  cyan: '#00C2F5',
  cyanInk: '#0A4F63',
  yellow: '#FFE07A',
  yellowDeep: '#F2C94C',
  ink: '#111111',
  muted: '#5B5670',
  faint: '#C9C3B6',
  coral: '#FF6A4D',
  mint: '#2FD3B0',
  soil: '#B98A5B',
  soilDeep: '#9A6F45',
};

/** 기기 팔레트: cream=플라스틱 몸체, white=패널 면, cyan=LCD 올리브, cyanInk=LCD 글자, coral=오렌지 셔터, yellow=황동, mint=녹색 LED. */
const ANALOG90: Palette = {
  cream: '#D9CFB8',
  white: '#E8E0CB',
  sky: '#A7B8B1',
  cyan: '#6E7A5A',
  cyanInk: '#1E2418',
  yellow: '#C9A24A',
  yellowDeep: '#A8842F',
  ink: '#2A2622',
  muted: '#6B6356',
  faint: '#B5AB97',
  coral: '#E0652E',
  mint: '#7FBF6A',
  soil: '#8A6A3F',
  soilDeep: '#5E452A',
};

export const Colors: Palette = THEME === 'analog90' ? ANALOG90 : STICKER;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 32,
} as const;

/** A안은 스티커처럼 둥글고 두껍게, B안은 인쇄물·라벨처럼 모서리를 세우고 선을 얇게. */
export const Radius =
  THEME === 'analog90'
    ? ({ sm: 8, md: 10, lg: 12, xl: 16, pill: 10 } as const)
    : ({ sm: 14, md: 18, lg: 22, xl: 28, pill: 999 } as const);

export const Stroke = THEME === 'analog90' ? ({ thin: 1, regular: 1 } as const) : ({ thin: 2, regular: 2.5 } as const);

/** B안 글꼴: 각인 라벨은 고딕 굵게, LCD 는 픽셀 한글(갈무리). */
export const Fonts =
  THEME === 'analog90'
    ? ({ display: 'NanumGothic_700Bold', body: 'NanumGothic_400Regular', lcd: 'Galmuri11' } as const)
    : ({ display: 'Jua_400Regular', body: 'GowunDodum_400Regular', lcd: 'Jua_400Regular' } as const);

/** 기기 몸체의 명암: 키캡은 위·왼쪽이 밝고 아래·오른쪽이 어둡다. 패널(오목)은 반대. */
export const Bevel = {
  light: '#F3EDDC',
  dark: '#9E9480',
  deep: '#7D745F',
  lcdLight: '#8A9574',
  lcdDark: '#3F4733',
} as const;

export const Screen = {
  maxContentWidth: 560,
  horizontal: 22,
} as const;

/** A안: 스티커의 딱딱한 오프셋 그림자. B안: 종이가 살짝 뜬 듯한 부드러운 그림자. */
export function offsetShadow(size: 4 | 3 | 5 | 6 = 4) {
  if (THEME === 'analog90') {
    return {
      shadowColor: Colors.ink,
      shadowOpacity: 0.16,
      shadowRadius: size * 1.5,
      shadowOffset: { width: 0, height: Math.round(size * 0.6) },
      elevation: 2,
    } as const;
  }
  return {
    shadowColor: Colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: size, height: size },
    elevation: 0,
  } as const;
}
