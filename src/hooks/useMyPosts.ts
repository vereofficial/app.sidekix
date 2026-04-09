import { useCallback, useEffect, useState } from 'react';
import type { PostRow } from '../types/database';
import { tryGetSupabase } from '../lib/supabase';

export function useMyPosts(userId: string | undefined) {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!userId) {
      setPosts([]);
      setLoading(true);
      return;
    }
    if (!sb) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await sb.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(60);
    setPosts((data ?? []) as PostRow[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { posts, loading, refresh };
}
