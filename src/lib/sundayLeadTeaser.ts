import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@sidekix/sunday_lead_teaser_v1';

type Stored = { weekKey: string };

export async function hasShownSundayLeadTeaser(weekMondayKey: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw) as Partial<Stored>;
    return p.weekKey === weekMondayKey;
  } catch {
    return false;
  }
}

export async function markSundayLeadTeaserShown(weekMondayKey: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ weekKey: weekMondayKey } satisfies Stored));
  } catch {
    /* ignore */
  }
}
