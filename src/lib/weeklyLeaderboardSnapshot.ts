import type { SupabaseClient } from '@supabase/supabase-js';
import type { PostRow, ProfileRow } from '../types/database';
import { MIN_DISTINCT_REACTIONS_FOR_PRIZE, MIN_LEADERBOARD_USERS_FOR_PRIZE_POOL } from '../constants/weeklyPrize';

const VOTE_CHUNK = 250;
const POST_ID_CHUNK = 250;

export type WeeklyPlacementRow = {
  user_id: string;
  username: string;
  avatar_path: string | null;
  vote_total: number;
  top_post: PostRow;
};

export type WeeklyPlacementSnapshot = {
  weekKey: string;
  sorted: WeeklyPlacementRow[];
  myRank: number | null;
  selfRow: WeeklyPlacementRow | null;
  weekCompetitorCount: number;
  daysPosted: number;
  maxPostsOnAnyChallengeDay: number;
  distinctReactionsGiven: number;
};

/**
 * Full weekly leaderboard aggregation for an arbitrary Mon–Sun window (`weekDays` from `weekLocalYmdsContaining` / `previousWeekLocalYmds`).
 */
export async function fetchWeeklyPlacementSnapshot(
  sb: SupabaseClient,
  weekDays: string[],
  userId: string,
): Promise<WeeklyPlacementSnapshot | null> {
  if (weekDays.length === 0) return null;
  const weekKey = weekDays[0];

  const { data: chRows, error: chErr } = await sb.from('challenges').select('id, day').in('day', weekDays);
  if (chErr || !chRows?.length) {
    return {
      weekKey,
      sorted: [],
      myRank: null,
      selfRow: null,
      weekCompetitorCount: 0,
      daysPosted: 0,
      maxPostsOnAnyChallengeDay: 0,
      distinctReactionsGiven: 0,
    };
  }

  const challenges = chRows as { id: string; day: string }[];
  const challengeIds = [...new Set(challenges.map((r) => r.id))];
  const challengeDayById = new Map(challenges.map((c) => [c.id, c.day] as const));

  const { data: posts, error: pErr } = await sb
    .from('posts')
    .select('*')
    .in('challenge_id', challengeIds)
    .order('created_at', { ascending: false });
  if (pErr) return null;

  const list = (posts ?? []) as PostRow[];
  const postsByChallenge = new Map<string, PostRow[]>();
  for (const p of list) {
    const arr = postsByChallenge.get(p.challenge_id) ?? [];
    arr.push(p);
    postsByChallenge.set(p.challenge_id, arr);
  }
  let maxPostsOnAnyChallengeDay = 0;
  for (const ch of challenges) {
    const n = postsByChallenge.get(ch.id)?.length ?? 0;
    if (n > maxPostsOnAnyChallengeDay) maxPostsOnAnyChallengeDay = n;
  }

  if (list.length === 0) {
    return {
      weekKey,
      sorted: [],
      myRank: null,
      selfRow: null,
      weekCompetitorCount: 0,
      daysPosted: 0,
      maxPostsOnAnyChallengeDay: 0,
      distinctReactionsGiven: 0,
    };
  }

  const ids = list.map((p) => p.id);
  const perPost = new Map<string, number>();
  for (let i = 0; i < ids.length; i += VOTE_CHUNK) {
    const slice = ids.slice(i, i + VOTE_CHUNK);
    const { data: voteRows } = await sb.from('votes').select('post_id').in('post_id', slice);
    (voteRows ?? []).forEach((v: { post_id: string }) => {
      perPost.set(v.post_id, (perPost.get(v.post_id) ?? 0) + 1);
    });
  }

  const byUser = new Map<string, { votes: number; topPost: PostRow }>();
  for (const p of list) {
    const vc = perPost.get(p.id) ?? 0;
    const cur = byUser.get(p.user_id);
    if (!cur) {
      byUser.set(p.user_id, { votes: vc, topPost: p });
    } else {
      cur.votes += vc;
      byUser.set(p.user_id, cur);
    }
  }

  const userIds = [...byUser.keys()];
  const { data: profs } = await sb.from('profiles').select('id, username, avatar_path').in('id', userIds);
  const profMap = new Map<string, { username: string; avatar_path: string | null }>();
  (profs as ProfileRow[] | null)?.forEach((p) =>
    profMap.set(p.id, { username: p.username, avatar_path: p.avatar_path ?? null }),
  );

  const sorted = [...byUser.entries()]
    .map(([uid, v]) => {
      const pr = profMap.get(uid);
      return {
        user_id: uid,
        username: pr?.username ?? uid.slice(0, 6),
        avatar_path: pr?.avatar_path ?? null,
        vote_total: v.votes,
        top_post: v.topPost,
      };
    })
    .sort((a, b) => b.vote_total - a.vote_total);

  const idx = sorted.findIndex((r) => r.user_id === userId);
  const myRank = idx >= 0 ? idx + 1 : null;
  const selfRow = idx >= 0 ? sorted[idx] : null;

  const userPosts = list.filter((p) => p.user_id === userId);
  const daysWithPost = new Set<string>();
  for (const p of userPosts) {
    const day = challengeDayById.get(p.challenge_id);
    if (day) daysWithPost.add(day);
  }
  const daysPosted = daysWithPost.size;

  const distinctReactionsGiven = await countDistinctReactionsGivenForWeekDays(sb, challengeIds, userId);

  return {
    weekKey,
    sorted,
    myRank,
    selfRow,
    weekCompetitorCount: sorted.length,
    daysPosted,
    maxPostsOnAnyChallengeDay,
    distinctReactionsGiven,
  };
}

async function countDistinctReactionsGivenForWeekDays(
  sb: SupabaseClient,
  challengeIds: string[],
  userId: string,
): Promise<number> {
  if (challengeIds.length === 0) return 0;
  const { data: postRows, error: pErr } = await sb
    .from('posts')
    .select('id,user_id')
    .in('challenge_id', challengeIds);
  if (pErr || !postRows?.length) return 0;
  const postList = postRows as { id: string; user_id: string }[];
  const selfPostIds = new Set(postList.filter((r) => r.user_id === userId).map((r) => r.id));
  const postIds = postList.map((r) => r.id);
  const distinct = new Set<string>();
  for (let i = 0; i < postIds.length; i += POST_ID_CHUNK) {
    const slice = postIds.slice(i, i + POST_ID_CHUNK);
    const { data: votes } = await sb.from('votes').select('post_id').eq('voter_id', userId).in('post_id', slice);
    (votes as { post_id: string }[] | null)?.forEach((v) => {
      if (!selfPostIds.has(v.post_id)) {
        distinct.add(v.post_id);
      }
    });
  }
  return distinct.size;
}

export function prizeEligibleForPastWeek(snapshot: WeeklyPlacementSnapshot): boolean {
  const poolOpen = snapshot.weekCompetitorCount >= MIN_LEADERBOARD_USERS_FOR_PRIZE_POOL;
  if (!poolOpen) return false;
  const reactionsRuleApplies = snapshot.maxPostsOnAnyChallengeDay > 3;
  if (!reactionsRuleApplies) return true;
  return snapshot.distinctReactionsGiven >= MIN_DISTINCT_REACTIONS_FOR_PRIZE;
}
