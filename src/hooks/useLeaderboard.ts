import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { maybeNotifyWeeklyLeaderboardRank } from '../lib/leaderboardRankNotification';
import { weekLocalYmdsContaining } from '../lib/week';
import { tryGetSupabase } from '../lib/supabase';
import type { PostRow, ProfileRow } from '../types/database';

export type LeaderRow = {
  user_id: string;
  username: string;
  avatar_path: string | null;
  vote_total: number;
  top_post: PostRow;
};

/** Top N rows shown for both weekly and all-time boards. */
const LEADERBOARD_TOP_N = 10;

export function useLeaderboard(scope: 'week' | 'all' = 'week', userId?: string | null) {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  /** Your 1-based rank in the full sorted list for this scope, or null if you have no posts in the window. */
  const [myRank, setMyRank] = useState<number | null>(null);
  /** Full competitor count for the week (before capping display at 10). Used for prize-pool gating. */
  const [weekCompetitorCount, setWeekCompetitorCount] = useState(0);
  /** Current user’s row from the full sorted list (any rank), if they have a post in the window. */
  const [selfLeaderRow, setSelfLeaderRow] = useState<LeaderRow | null>(null);
  /** Total posts on the weekly board this week; used for prize reaction-gate copy. */
  const [weekPostCount, setWeekPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!sb) {
      setRows([]);
      setMyRank(null);
      setWeekCompetitorCount(0);
      setWeekPostCount(0);
      setSelfLeaderRow(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let postsQuery = sb.from('posts').select('*').order('created_at', { ascending: false });
    if (scope === 'week') {
      const weekDays = weekLocalYmdsContaining();
      const { data: chRows, error: chErr } = await sb.from('challenges').select('id').in('day', weekDays);
      if (chErr) {
        setError(chErr.message);
        setRows([]);
        setMyRank(null);
        setWeekCompetitorCount(0);
        setWeekPostCount(0);
        setSelfLeaderRow(null);
        setLoading(false);
        return;
      }
      const challengeIds = [...new Set((chRows ?? []).map((r: { id: string }) => r.id))];
      if (challengeIds.length === 0) {
        setRows([]);
        setMyRank(null);
        setWeekCompetitorCount(0);
        setWeekPostCount(0);
        setSelfLeaderRow(null);
        setLoading(false);
        return;
      }
      postsQuery = postsQuery.in('challenge_id', challengeIds);
    }
    const { data: posts, error: pErr } = await postsQuery;
    if (pErr) {
      setError(pErr.message);
      setRows([]);
      setMyRank(null);
      setWeekCompetitorCount(0);
      setWeekPostCount(0);
      setSelfLeaderRow(null);
      setLoading(false);
      return;
    }
    const list = (posts ?? []) as PostRow[];
    if (scope === 'week') setWeekPostCount(list.length);
    else setWeekPostCount(0);
    if (list.length === 0) {
      setRows([]);
      setMyRank(null);
      setWeekCompetitorCount(0);
      setSelfLeaderRow(null);
      setLoading(false);
      return;
    }
    const ids = list.map((p) => p.id);
    const { data: voteRows } = await sb.from('votes').select('post_id').in('post_id', ids);
    const perPost = new Map<string, number>();
    (voteRows ?? []).forEach((v: { post_id: string }) => {
      perPost.set(v.post_id, (perPost.get(v.post_id) ?? 0) + 1);
    });
    /** Posts are newest-first; first row per user = their latest post in the window — use that for share/rank preview art. */
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
      .map(([user_id, v]) => {
        const pr = profMap.get(user_id);
        return {
          user_id,
          username: pr?.username ?? user_id.slice(0, 6),
          avatar_path: pr?.avatar_path ?? null,
          vote_total: v.votes,
          top_post: v.topPost,
        };
      })
      .sort((a, b) => b.vote_total - a.vote_total);

    let rank: number | null = null;
    if (userId) {
      const idx = sorted.findIndex((r) => r.user_id === userId);
      rank = idx >= 0 ? idx + 1 : null;
    }
    setMyRank(rank);

    const selfRow = userId ? sorted.find((r) => r.user_id === userId) ?? null : null;
    setSelfLeaderRow(selfRow);

    if (scope === 'week') {
      setWeekCompetitorCount(sorted.length);
    } else {
      setWeekCompetitorCount(0);
    }

    const display = sorted.slice(0, LEADERBOARD_TOP_N);
    setRows(display);
    setLoading(false);
  }, [scope, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (Platform.OS === 'web' || scope !== 'week' || loading) return;
    void maybeNotifyWeeklyLeaderboardRank(userId ?? null, myRank);
  }, [scope, loading, userId, myRank]);

  return { rows, loading, error, refresh, myRank, weekCompetitorCount, weekPostCount, selfLeaderRow };
}
