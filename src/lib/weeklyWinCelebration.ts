import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { MIN_LEADERBOARD_USERS_FOR_PRIZE_POOL } from '../constants/weeklyPrize';
import { tryGetSupabase } from './supabase';
import { previousWeekLocalYmds } from './week';
import { fetchWeeklyPlacementSnapshot, prizeEligibleForPastWeek, type WeeklyPlacementSnapshot } from './weeklyLeaderboardSnapshot';
import { presentWeeklyPlacementNotification, presentWeeklyWinNotification } from './notifications';

/** Matches visible top-N on the weekly Lead tab. */
const WEEKLY_BOARD_TOP_N = 10;

const STORAGE_KEY = '@sidekix/weekly_week_end_moments_v1';

type Stored = {
  /** Weeks where the user had no rank or rank &gt; 10 — nothing to celebrate. */
  neutralWeekKeys: string[];
  dismissedWinWeekKeys: string[];
  dismissedPlacementWeekKeys: string[];
  notifSentWinWeekKeys: string[];
  notifSentPlacementWeekKeys: string[];
};

const emptyStored = (): Stored => ({
  neutralWeekKeys: [],
  dismissedWinWeekKeys: [],
  dismissedPlacementWeekKeys: [],
  notifSentWinWeekKeys: [],
  notifSentPlacementWeekKeys: [],
});

async function readStored(): Promise<Stored> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStored();
    const p = JSON.parse(raw) as Partial<Stored>;
    return {
      neutralWeekKeys: Array.isArray(p.neutralWeekKeys) ? p.neutralWeekKeys : [],
      dismissedWinWeekKeys: Array.isArray(p.dismissedWinWeekKeys) ? p.dismissedWinWeekKeys : [],
      dismissedPlacementWeekKeys: Array.isArray(p.dismissedPlacementWeekKeys) ? p.dismissedPlacementWeekKeys : [],
      notifSentWinWeekKeys: Array.isArray(p.notifSentWinWeekKeys) ? p.notifSentWinWeekKeys : [],
      notifSentPlacementWeekKeys: Array.isArray(p.notifSentPlacementWeekKeys) ? p.notifSentPlacementWeekKeys : [],
    };
  } catch {
    return emptyStored();
  }
}

async function writeStored(s: Stored): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export type WeeklyWinRecap = {
  reactionsReceived: number;
  daysPosted: number;
  competitorCount: number;
  reactionsGiven: number;
};

/** People who placed below you this week (`rank` is 1-based). Not "everyone but you" unless you're 1st. */
export function countRankedBelowYou(totalCompetitors: number, yourRank: number): number {
  if (totalCompetitors < 1 || yourRank < 1) return 0;
  return Math.max(0, totalCompetitors - yourRank);
}

export type WeeklyWinCelebrationPayload = {
  prevWeekKey: string;
  variant: 'prize' | 'first_no_pool' | 'first_need_reactions';
  recap: WeeklyWinRecap;
};

export type WeeklyPlacementCelebrationPayload = {
  prevWeekKey: string;
  rank: number;
  recap: WeeklyWinRecap;
};

export type WeeklyEndMoment =
  | { type: 'win'; payload: WeeklyWinCelebrationPayload }
  | { type: 'placement'; payload: WeeklyPlacementCelebrationPayload };

function buildWinPayload(snapshot: WeeklyPlacementSnapshot): WeeklyWinCelebrationPayload | null {
  if (snapshot.myRank !== 1 || !snapshot.selfRow) return null;
  const poolOpen = snapshot.weekCompetitorCount >= MIN_LEADERBOARD_USERS_FOR_PRIZE_POOL;
  const eligible = prizeEligibleForPastWeek(snapshot);
  let variant: WeeklyWinCelebrationPayload['variant'];
  if (poolOpen && eligible) {
    variant = 'prize';
  } else if (!poolOpen) {
    variant = 'first_no_pool';
  } else {
    variant = 'first_need_reactions';
  }
  return {
    prevWeekKey: snapshot.weekKey,
    variant,
    recap: {
      reactionsReceived: snapshot.selfRow.vote_total,
      daysPosted: snapshot.daysPosted,
      competitorCount: snapshot.weekCompetitorCount,
      reactionsGiven: snapshot.distinctReactionsGiven,
    },
  };
}

function buildPlacementPayload(snapshot: WeeklyPlacementSnapshot): WeeklyPlacementCelebrationPayload | null {
  const r = snapshot.myRank;
  if (r === null || r < 2 || r > WEEKLY_BOARD_TOP_N || !snapshot.selfRow) return null;
  return {
    prevWeekKey: snapshot.weekKey,
    rank: r,
    recap: {
      reactionsReceived: snapshot.selfRow.vote_total,
      daysPosted: snapshot.daysPosted,
      competitorCount: snapshot.weekCompetitorCount,
      reactionsGiven: snapshot.distinctReactionsGiven,
    },
  };
}

const loadFlight = new Map<string, Promise<WeeklyEndMoment | null>>();

/**
 * After the previous Mon–Sun week ends: #1 gets a win moment; ranks 2–10 get a board-placement moment.
 */
export async function loadPendingWeeklyEndMoment(userId: string): Promise<WeeklyEndMoment | null> {
  if (Platform.OS === 'web') return null;
  const existing = loadFlight.get(userId);
  if (existing) return existing;
  const p = doLoadPendingWeeklyEndMoment(userId).finally(() => {
    loadFlight.delete(userId);
  });
  loadFlight.set(userId, p);
  return p;
}

async function doLoadPendingWeeklyEndMoment(userId: string): Promise<WeeklyEndMoment | null> {
  const sb = tryGetSupabase();
  if (!sb) return null;

  const prevDays = previousWeekLocalYmds();
  const prevWeekKey = prevDays[0];
  if (!prevWeekKey) return null;

  let stored = await readStored();

  if (stored.neutralWeekKeys.includes(prevWeekKey)) return null;
  if (stored.dismissedWinWeekKeys.includes(prevWeekKey)) return null;
  if (stored.dismissedPlacementWeekKeys.includes(prevWeekKey)) return null;

  const snapshot = await fetchWeeklyPlacementSnapshot(sb, prevDays, userId);
  if (!snapshot) return null;

  const r = snapshot.myRank;

  if (r === null || r > WEEKLY_BOARD_TOP_N) {
    await writeStored({
      ...stored,
      neutralWeekKeys: [...new Set([...stored.neutralWeekKeys, prevWeekKey])],
    });
    return null;
  }

  if (r === 1) {
    const payload = buildWinPayload(snapshot);
    if (!payload) return null;
    stored = await readStored();
    if (!stored.notifSentWinWeekKeys.includes(prevWeekKey)) {
      await presentWeeklyWinNotification(userId, payload.variant);
      await writeStored({
        ...stored,
        notifSentWinWeekKeys: [...new Set([...stored.notifSentWinWeekKeys, prevWeekKey])],
      });
    }
    return { type: 'win', payload };
  }

  if (r >= 2 && r <= WEEKLY_BOARD_TOP_N) {
    const payload = buildPlacementPayload(snapshot);
    if (!payload) return null;
    stored = await readStored();
    if (!stored.notifSentPlacementWeekKeys.includes(prevWeekKey)) {
      await presentWeeklyPlacementNotification(userId, r);
      await writeStored({
        ...stored,
        notifSentPlacementWeekKeys: [...new Set([...stored.notifSentPlacementWeekKeys, prevWeekKey])],
      });
    }
    return { type: 'placement', payload };
  }

  await writeStored({
    ...stored,
    neutralWeekKeys: [...new Set([...stored.neutralWeekKeys, prevWeekKey])],
  });
  return null;
}

export async function markWeeklyWinCelebrationDismissed(prevWeekKey: string): Promise<void> {
  const stored = await readStored();
  await writeStored({
    ...stored,
    dismissedWinWeekKeys: [...new Set([...stored.dismissedWinWeekKeys, prevWeekKey])],
  });
}

export async function markWeeklyPlacementCelebrationDismissed(prevWeekKey: string): Promise<void> {
  const stored = await readStored();
  await writeStored({
    ...stored,
    dismissedPlacementWeekKeys: [...new Set([...stored.dismissedPlacementWeekKeys, prevWeekKey])],
  });
}
