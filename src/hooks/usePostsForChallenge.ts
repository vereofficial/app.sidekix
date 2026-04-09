import { useCallback, useEffect, useState } from 'react';
import type { PostRow } from '../types/database';
import { tryGetSupabase } from '../lib/supabase';

export type PostWithVotes = PostRow & { vote_count: number };

export function usePostsForChallenge(
  challengeId: string | null,
  limit?: number,
  voterId?: string | null,
  challengeReady = true,
) {
  const [posts, setPosts] = useState<PostWithVotes[]>([]);
  const [myVoteIds, setMyVoteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!challengeReady) {
      setPosts([]);
      setMyVoteIds(new Set());
      setLoading(true);
      return;
    }
    if (!sb || !challengeId) {
      setPosts([]);
      setMyVoteIds(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let q = sb.from('posts').select('*').eq('challenge_id', challengeId).order('created_at', { ascending: false });
    if (limit) q = q.limit(limit);
    const { data: postRows, error: pErr } = await q;
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
    const ids = list.map((p) => p.id);
    const { data: voteRows } = await sb.from('votes').select('post_id, voter_id').in('post_id', ids);
    const counts = new Map<string, number>();
    (voteRows ?? []).forEach((v: { post_id: string }) => {
      counts.set(v.post_id, (counts.get(v.post_id) ?? 0) + 1);
    });
    const mine = new Set<string>();
    if (voterId) {
      (voteRows ?? []).forEach((v: { post_id: string; voter_id: string }) => {
        if (v.voter_id === voterId) mine.add(v.post_id);
      });
    }
    setMyVoteIds(mine);
    setPosts(
      list.map((p) => ({
        ...p,
        vote_count: counts.get(p.id) ?? 0,
      })),
    );
    setLoading(false);
  }, [challengeId, limit, voterId, challengeReady]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { posts, myVoteIds, loading, error, refresh };
}
