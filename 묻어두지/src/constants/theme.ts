/**
 * 디자인 시안. 빌드 시 EXPO_PUBLIC_THEME 으로 고른다.
 * - sticker  (A안): 스티커 계란, 형광 하늘·노랑, 검정 외곽선 — 기본
 * - analog90 (B안): 같은 레이아웃에 90년대 아날로그 색감 — 아이보리 플라스틱, 틸·오렌지·머스터드, 은색 캡슐
 */
export type ThemeName = 'sticker' | 'analog90';
export const THEME: ThemeName = process.env.EXPO_PUBLIC_THEME === 'analog90' ? 'analog90' : 'sticker';

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

/** 90년대: 누렇게 바랜 아이보리 플라스틱 바탕, 틸 그린·오렌지·머스터드 포인트, 잉크는 검정 대신 짙은 먹색. */
const ANALOG90: Palette = {
  cream: '#E9E1CF',
  white: '#F4EFE3',
  sky: '#8EB3BB',
  cyan: '#3F7F80',
  cyanInk: '#12383A',
  yellow: '#D9B45B',
  yellowDeep: '#B9933E',
  ink: '#2A2622',
  muted: '#6E6358',
  faint: '#BDB4A3',
  coral: '#C96B3C',
  mint: '#8FA98E',
  soil: '#A3794B',
  soilDeep: '#7E5A33',
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
    ? ({ sm: 6, md: 8, lg: 10, xl: 14, pill: 8 } as const)
    : ({ sm: 14, md: 18, lg: 22, xl: 28, pill: 999 } as const);

export const Stroke = THEME === 'analog90' ? ({ thin: 1, regular: 1.5 } as const) : ({ thin: 2, regular: 2.5 } as const);

/** B안 글꼴: 제목은 명조(90년대 인쇄물), 본문은 고딕. */
export const Fonts =
  THEME === 'analog90'
    ? ({ display: 'NanumMyeongjo_800ExtraBold', body: 'NanumGothic_400Regular' } as const)
    : ({ display: 'Jua_400Regular', body: 'GowunDodum_400Regular' } as const);

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
