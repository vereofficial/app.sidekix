import type { ColorValue } from 'react-native';

export const TEXT_POST_STYLE_COUNT = 5;

export type GlowOverlay = {
  colors: readonly [string, string];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

export type TextPostPreset = {
  id: number;
  label: string;
  /** Base gradient stops (light mode). */
  light: readonly [ColorValue, ColorValue, ColorValue];
  /** Base gradient stops (dark mode). */
  dark: readonly [ColorValue, ColorValue, ColorValue];
  /** Optional glow layer to approximate radial highlights (dark / light). */
  glowDark?: GlowOverlay | null;
  glowLight?: GlowOverlay | null;
  accentBorderLight: string;
  accentBorderDark: string;
  textLight: string;
  textDark: string;
};

/** VOID · ACID · DUSK · SOLAR · CHROME — matches in-app picker cards. */
export const TEXT_POST_PRESETS: readonly TextPostPreset[] = [
  {
    id: 0,
    label: 'VOID',
    light: ['#1a1a1a', '#0f0f0f', '#0a0a0a'],
    dark: ['#000000', '#000000', '#000000'],
    glowDark: null,
    glowLight: null,
    accentBorderLight: 'rgba(212,255,63,0.35)',
    accentBorderDark: 'rgba(212,255,63,0.55)',
    textLight: '#f0f2e8',
    textDark: '#eef0e6',
  },
  {
    id: 1,
    label: 'ACID',
    light: ['#eef6e8', '#dce8d0', '#c8dcc0'],
    dark: ['#050805', '#0a1008', '#071206'],
    glowDark: {
      colors: ['rgba(212,255,63,0)', 'rgba(120,220,90,0.42)'],
      start: { x: 0, y: 1 },
      end: { x: 0.85, y: 0.15 },
    },
    glowLight: {
      colors: ['rgba(90,122,0,0)', 'rgba(120,180,60,0.2)'],
      start: { x: 0, y: 1 },
      end: { x: 0.8, y: 0.2 },
    },
    accentBorderLight: 'rgba(90,122,0,0.45)',
    accentBorderDark: 'rgba(212,255,63,0.45)',
    textLight: '#142010',
    textDark: '#e8f5dc',
  },
  {
    id: 2,
    label: 'DUSK',
    light: ['#ece8f2', '#e0d8ec', '#d4cce6'],
    dark: ['#0a0610', '#100818', '#0d0614'],
    glowDark: {
      colors: ['rgba(160,100,255,0)', 'rgba(140,80,220,0.38)'],
      start: { x: 1, y: 0 },
      end: { x: 0.2, y: 0.85 },
    },
    glowLight: {
      colors: ['rgba(90,40,140,0)', 'rgba(120,80,180,0.22)'],
      start: { x: 1, y: 0 },
      end: { x: 0.25, y: 0.9 },
    },
    accentBorderLight: 'rgba(100,60,160,0.4)',
    accentBorderDark: 'rgba(200,160,255,0.45)',
    textLight: '#1a1024',
    textDark: '#f2e8ff',
  },
  {
    id: 3,
    label: 'SOLAR',
    light: ['#faf4e8', '#f2e8d4', '#ead8bc'],
    dark: ['#120c06', '#1a1208', '#140e06'],
    glowDark: {
      colors: ['rgba(255,200,80,0)', 'rgba(255,160,40,0.42)'],
      start: { x: 1, y: 1 },
      end: { x: 0.15, y: 0.2 },
    },
    glowLight: {
      colors: ['rgba(200,120,40,0)', 'rgba(220,160,60,0.28)'],
      start: { x: 1, y: 1 },
      end: { x: 0.2, y: 0.25 },
    },
    accentBorderLight: 'rgba(180,120,40,0.45)',
    accentBorderDark: 'rgba(255,200,100,0.5)',
    textLight: '#2a1810',
    textDark: '#fff6e8',
  },
  {
    id: 4,
    label: 'CHROME',
    light: ['#e8eaec', '#dce0e4', '#d0d4da'],
    dark: ['#06080c', '#0a0e14', '#080a10'],
    glowDark: {
      colors: ['rgba(120,160,200,0)', 'rgba(80,120,160,0.28)'],
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
    },
    glowLight: {
      colors: ['rgba(60,80,100,0)', 'rgba(100,120,140,0.2)'],
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
    },
    accentBorderLight: 'rgba(80,100,120,0.4)',
    accentBorderDark: 'rgba(180,200,220,0.35)',
    textLight: '#101418',
    textDark: '#e8eef4',
  },
] as const;

export function clampTextPostStyle(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const x = Math.floor(n);
  if (x < 0) return 0;
  if (x >= TEXT_POST_STYLE_COUNT) return TEXT_POST_STYLE_COUNT - 1;
  return x;
}

export function getTextPostPreset(style: number | null | undefined): TextPostPreset {
  return TEXT_POST_PRESETS[clampTextPostStyle(style ?? 0)] ?? TEXT_POST_PRESETS[0];
}
