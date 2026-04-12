import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'sidekix_theme_pref';

async function getRaw(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(KEY);
  }
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

async function setRaw(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, value);
    return;
  }
  await SecureStore.setItemAsync(KEY, value);
}

export async function loadThemePreference(): Promise<ThemePreference> {
  const v = await getRaw();
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'dark';
}

export async function saveThemePreference(pref: ThemePreference): Promise<void> {
  await setRaw(pref);
}
