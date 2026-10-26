export const Colors = {
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
} as const;

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
