import AsyncStorage from '@react-native-async-storage/async-storage';

export type HomeFeedMode = 'feed' | 'recent';

function keyFor(userId: string): string {
  return `sidekix_home_mode_v1:${userId}`;
}

export async function getHomeFeedMode(userId: string | null | undefined): Promise<HomeFeedMode> {
  if (!userId) return 'feed';
  try {
    const v = await AsyncStorage.getItem(keyFor(userId));
    return v === 'recent' ? 'recent' : 'feed';
  } catch {
    return 'feed';
  }
}

export async function setHomeFeedMode(userId: string | null | undefined, mode: HomeFeedMode): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(keyFor(userId), mode);
  } catch {
    // ignore
  }
}
