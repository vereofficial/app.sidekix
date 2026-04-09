import { useCallback, useEffect, useState } from 'react';
import { startOfWeekIso } from '../lib/week';
import { tryGetSupabase } from '../lib/supabase';
import type { ChallengeRow, PostRow } from '../types/database';

export type UserWeekPost = PostRow & {
  vote_count: number;
  challenge_title: string;
  challenge_day: string;
  is_today_challenge: boolean;
};

export function useUserWeekPosts(
  targetUserId: string | null,
  todayChallengeId: string | null,
  voterId: string | null,
) {
  const [posts, setPosts] = useState<UserWeekPost[]>([]);
  const [myVoteIds, setMyVoteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!sb || !targetUserId) {
      setPosts([]);
      setMyVoteIds(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const since = startOfWeekIso();
    const { data: postRows, error: pErr } = await sb
      .from('posts')
      .select('*')
      .eq('user_id', targetUserId)
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    if (pErr) {
      setError(pErr.message);
      setPosts([]);
      setMyVoteIds(new Set());
      setLoading(false);
      return;
    }
    const list = (postRows ?? []) as PostRow[];
    if (list.length === 0) {
      setPosts([]);
      setMyVoteIds(new Set());
      setLoading(false);
      return;
    }
    const chIds = [...new Set(list.map((p) => p.challenge_id))];
    const { data: chRows } = await sb.from('challenges').select('*').in('id', chIds);
    const chMap = new Map<string, ChallengeRow>();
    (chRows as ChallengeRow[] | null)?.forEach((c) => chMap.set(c.id, c));
    const postIds = list.map((p) => p.id);
    const { data: voteRows } = await sb.from('votes').select('post_id, voter_id').in('post_id', postIds);
    const counts = new Map<string, number>();
    const mine = new Set<string>();
    (voteRows ?? []).forEach((v: { post_id: string; voter_id: string }) => {
      counts.set(v.post_id, (counts.get(v.post_id) ?? 0) + 1);
      if (voterId && v.voter_id === voterId) mine.add(v.post_id);
    });
    const merged: UserWeekPost[] = list.map((p) => {
      const ch = chMap.get(p.challenge_id);
      const isToday = Boolean(todayChallengeId && p.challenge_id === todayChallengeId);
      return {
        ...p,
        vote_count: counts.get(p.id) ?? 0,
        challenge_title: ch?.title ?? 'Sidequest',
        challenge_day: ch?.day ?? '',
        is_today_challenge: isToday,
      };
    });
    setPosts(merged);
    setMyVoteIds(mine);
    setLoading(false);
  }, [targetUserId, todayChallengeId, voterId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { posts, myVoteIds, loading, error, refresh };
}
