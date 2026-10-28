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
  cream: '#EDE6D3',
  white: '#F7F3E8',
  sky: '#8FC6D2',
  cyan: '#3F8C8C',
  cyanInk: '#103F43',
  yellow: '#F0C75E',
  yellowDeep: '#D9A441',
  ink: '#2B2B33',
  muted: '#6B6478',
  faint: '#C9C1B2',
  coral: '#E8703A',
  mint: '#7DB58A',
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

export const Radius = {
  sm: 14,
  md: 18,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const Stroke = {
  thin: 2,
  regular: 2.5,
} as const;

export const Fonts = {
  display: 'Jua_400Regular',
  body: 'GowunDodum_400Regular',
} as const;

export const Screen = {
  maxContentWidth: 560,
  horizontal: 22,
} as const;

export function offsetShadow(size: 4 | 3 | 5 | 6 = 4) {
  return {
    shadowColor: Colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: size, height: size },
    elevation: 0,
  } as const;
}
