import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { presentLeaderboardRankNotification } from './notifications';
import { weekLocalYmdsContaining } from './week';

const STORAGE_KEY = '@sidekix/weekly_leaderboard_rank_v1';

type Stored = { weekKey: string; rank: number | null };

/**
 * When weekly rank loads, persist rank and fire a local notification if the user
 * moved up into 1st, 2nd, or 3rd (rank number went down) vs the last stored snapshot.
 */
export async function maybeNotifyWeeklyLeaderboardRank(
  userId: string | null | undefined,
  myRank: number | null,
): Promise<void> {
  if (Platform.OS === 'web' || !userId) return;

  const weekKey = weekLocalYmdsContaining()[0];
  let prevRank: number | null | undefined;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      if (parsed.weekKey === weekKey) {
        prevRank = parsed.rank;
      }
    }
  } catch {
    /* ignore */
  }

  const nextRank = myRank;

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ weekKey, rank: nextRank } satisfies Stored));
  } catch {
    /* ignore */
  }

  if (prevRank === undefined) {
    return;
  }

  if (nextRank === null || prevRank === null) {
    return;
  }

  if (nextRank >= prevRank) {
    return;
  }

  if (nextRank < 1 || nextRank > 3) {
    return;
  }

  await presentLeaderboardRankNotification(userId, nextRank as 1 | 2 | 3);
}
