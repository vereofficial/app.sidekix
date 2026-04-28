import { useCallback, useEffect, useState } from 'react';
import { weekLocalYmdsContaining } from '../lib/week';
import { tryGetSupabase } from '../lib/supabase';

const POST_ID_CHUNK = 250;

/**
 * How many **distinct other people's posts** this user has reacted to during
 * the current local Mon–Sun week (any challenge day in that window).
 */
export function useWeeklyReactionsGiven(userId: string | undefined) {
  const [distinctPostsReacted, setDistinctPostsReacted] = useState(0);
  const [loading, setLoading] = useState(Boolean(userId));

  const refresh = useCallback(async () => {
    if (!userId) {
      setDistinctPostsReacted(0);
      setLoading(false);
      return;
    }
    const sb = tryGetSupabase();
    if (!sb) {
      setDistinctPostsReacted(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const weekDays = weekLocalYmdsContaining();
    const { data: chRows, error: chErr } = await sb.from('challenges').select('id').in('day', weekDays);
    if (chErr || !chRows?.length) {
      setDistinctPostsReacted(0);
      setLoading(false);
      return;
    }
    const challengeIds = [...new Set((chRows as { id: string }[]).map((r) => r.id))];
    const { data: postRows, error: pErr } = await sb
      .from('posts')
      .select('id,user_id')
      .in('challenge_id', challengeIds);
    if (pErr || !postRows?.length) {
      setDistinctPostsReacted(0);
      setLoading(false);
      return;
    }
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
    setDistinctPostsReacted(distinct.size);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { distinctPostsReacted, loading, refresh };
}
