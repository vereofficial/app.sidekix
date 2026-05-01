import type { ColorSchemeName } from 'react-native';

export type ThemeColors = {
  accent: string;
  accentMuted: string;
  bg: string;
  bg2: string;
  bg3: string;
  card: string;
  border: string;
  border2: string;
  text1: string;
  text2: string;
  text3: string;
  navBg: string;
  navBorder: string;
  pillBg: string;
  lightAccent: string;
  lightAccentBg: string;
  lightAccentBorder: string;
};

export const darkColors: ThemeColors = {
  /** Primary accent — lime (Expo / Sidekix original) */
  accent: '#D4FF3F',
  accentMuted: 'rgba(212,255,63,0.18)',
  bg: '#0A0A0A',
  bg2: '#111111',
  bg3: '#161616',
  card: '#141414',
  border: 'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.12)',
  text1: '#F0EDE6',
  text2: '#8A8680',
  /** Tertiary; must stay readable on #0A0A0A (e.g. 10px uppercase challenge tags). */
  text3: '#5A5755',
  navBg: '#0E0E0E',
  navBorder: 'rgba(255,255,255,0.08)',
  pillBg: '#1A1A1A',
  /** Secondary — blue (ideas / links) */
  lightAccent: '#2563A8',
  lightAccentBg: 'rgba(37,99,168,0.10)',
  lightAccentBorder: 'rgba(37,99,168,0.25)',
};

export const lightColors: ThemeColors = {
  /** Primary accent — olive green (light mode original) */
  accent: '#5A7A00',
  accentMuted: 'rgba(90,122,0,0.12)',
  /** Warm paper shell (matches earlier v3-style light treatment). Cards stay slightly cleaner. */
  bg: '#f5f0e8',
  bg2: '#efe9df',
  bg3: '#ebe4d8',
  card: '#fffcf7',
  border: '#e2d9cc',
  border2: '#d8cec2',
  text1: '#1A1A1A',
  text2: '#666666',
  text3: '#999999',
  navBg: '#f9f6f0',
  navBorder: '#e2d9cc',
  pillBg: '#f3eee6',
  lightAccent: '#2563A8',
  lightAccentBg: 'rgba(37,99,168,0.08)',
  lightAccentBorder: 'rgba(37,99,168,0.20)',
};

export function getColors(scheme: ColorSchemeName): ThemeColors {
  return scheme === 'light' ? lightColors : darkColors;
}

export const font = {
  /** Real Syne for brand wordmark; UI “syne” labels still use DM Sans for tab density. */
  wordmark: 'Syne_800ExtraBold',
  syne: 'DMSans_700Bold',
  syneExtra: 'DMSans_700Bold',
  syneSemi: 'DMSans_500Medium',
  syneReg: 'DMSans_400Regular',
  dm: 'DMSans_400Regular',
  dmMedium: 'DMSans_500Medium',
  dmBold: 'DMSans_700Bold',
  dmLight: 'DMSans_300Light',
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
};

/** Gradient pairs matching mock `.img-1` … `.img-9` */
export const gradientPresets: [string, string][] = [
  ['#f6d365', '#fda085'],
  ['#a18cd1', '#fbc2eb'],
  ['#84fab0', '#8fd3f4'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#a1c4fd', '#c2e9fb'],
  ['#ffecd2', '#fcb69f'],
];
