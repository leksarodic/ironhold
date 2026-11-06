/**
 * Ironhold palette — a parchment-and-gold UI over an iron-stone world.
 * Values mirror tailwind.config.js so JS-driven drawing (SVG, canvas)
 * and NativeWind classes stay in sync.
 */
export const palette = {
  ink: '#2b1d10',
  inkSoft: '#4a3620',
  parchment: {
    50: '#f6ecd2',
    100: '#efe0bd',
    200: '#e2cda0',
    300: '#d2b688',
    400: '#bf9c6a',
    500: '#a88252',
    600: '#8b6740',
    700: '#6b4d2f',
  },
  gold: {
    200: '#f7e3a1',
    300: '#e8c66a',
    400: '#d4a942',
    500: '#b8862b',
    600: '#8f6416',
    700: '#5f420c',
  },
  stone: {
    900: '#0e0b08',
    800: '#14100c',
    700: '#1d1712',
    600: '#2a211a',
    500: '#3a2e23',
    400: '#4d3d2e',
  },
  ember: '#e05a2b',
  mana: '#2f6fd0',
  rage: '#c0392b',
  holy: '#f0c95a',
  hp: '#1e7a2e',
} as const;

export const qualityColor = {
  poor: '#9d9d9d',
  common: '#ffffff',
  uncommon: '#1eff00',
  rare: '#0070dd',
  epic: '#a335ee',
  legendary: '#ff8000',
} as const;

export type Quality = keyof typeof qualityColor;
