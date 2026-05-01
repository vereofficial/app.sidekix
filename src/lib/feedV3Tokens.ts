import type { ColorSchemeName } from 'react-native';

/** Warm neutral tag chips (readable on white / dark shells). Accent greens come from theme where needed. */
export const feedV3 = {
  tagBgLight: '#f9f5ef',
  tagBorderLight: '#e2d9cc',
  tagInkLight: '#6b5f52',
  tagBgDark: '#1f1c18',
  tagBorderDark: 'rgba(226,217,204,0.22)',
  tagInkDark: '#bdae9f',
} as const;

export function feedV3TagSkin(scheme: ColorSchemeName) {
  return scheme === 'light'
    ? { backgroundColor: feedV3.tagBgLight, borderColor: feedV3.tagBorderLight, color: feedV3.tagInkLight }
    : { backgroundColor: feedV3.tagBgDark, borderColor: feedV3.tagBorderDark, color: feedV3.tagInkDark };
}

/** Selected browse / picker chip — uses app green (light) / lime (dark). */
export function feedV3BrowseFilterActiveSkin(scheme: ColorSchemeName) {
  return scheme === 'light'
    ? {
        backgroundColor: 'rgba(90,122,0,0.10)',
        borderColor: 'rgba(90,122,0,0.32)',
        color: '#5A7A00',
      }
    : {
        backgroundColor: 'rgba(212,255,63,0.12)',
        borderColor: 'rgba(212,255,63,0.35)',
        color: '#D4FF3F',
      };
}
