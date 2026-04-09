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
  accent: '#D4FF3F',
  accentMuted: '#D4FF3F22',
  bg: '#0A0A0A',
  bg2: '#111111',
  bg3: '#161616',
  card: '#141414',
  border: '#1e1e1e',
  border2: '#2a2a2a',
  text1: '#ffffff',
  text2: '#888888',
  text3: '#444444',
  navBg: '#0e0e0e',
  navBorder: '#1a1a1a',
  pillBg: '#1a1a1a',
  lightAccent: '#D4FF3F',
  lightAccentBg: '#D4FF3F08',
  lightAccentBorder: '#D4FF3F30',
};

export const lightColors: ThemeColors = {
  accent: '#5a7a00',
  accentMuted: '#5a7a0022',
  bg: '#F2F1EC',
  bg2: '#ECEAE3',
  bg3: '#E5E3DC',
  card: '#ffffff',
  border: '#E0DDD4',
  border2: '#D0CEC5',
  text1: '#1a1a1a',
  text2: '#666666',
  text3: '#999999',
  navBg: '#ffffff',
  navBorder: '#E8E6DF',
  pillBg: '#E8E6DF',
  lightAccent: '#5a7a00',
  lightAccentBg: '#5a7a0008',
  lightAccentBorder: '#5a7a0030',
};

export function getColors(scheme: ColorSchemeName): ThemeColors {
  return scheme === 'light' ? lightColors : darkColors;
}

export const font = {
  syne: 'Syne_700Bold',
  syneExtra: 'Syne_800ExtraBold',
  syneSemi: 'Syne_600SemiBold',
  syneReg: 'Syne_400Regular',
  dm: 'DMSans_400Regular',
  dmMedium: 'DMSans_500Medium',
  dmLight: 'DMSans_300Light',
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
