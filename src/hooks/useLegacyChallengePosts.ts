import { useCallback, useEffect, useState } from 'react';
import { tryGetSupabase } from '../lib/supabase';
import type { PostRow, ProfileRow } from '../types/database';

export function useLegacyChallengePosts(challengeId: string | null | undefined) {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!sb || !challengeId) {
      setPosts([]);
      setUsernames({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: pData } = await sb.from('posts').select('*').eq('challenge_id', challengeId).order('created_at', { ascending: false });
    const list = (pData ?? []) as PostRow[];
    setPosts(list);
    const userIds = [...new Set(list.map((p) => p.user_id))];
    if (userIds.length === 0) {
      setUsernames({});
      setLoading(false);
      return;
    }
    const { data: profData } = await sb.from('profiles').select('id, username').in('id', userIds);
    const map: Record<string, string> = {};
    ((profData ?? []) as Pick<ProfileRow, 'id' | 'username'>[]).forEach((p) => (map[p.id] = p.username));
    setUsernames(map);
    setLoading(false);
  }, [challengeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { posts, usernames, loading, refresh };
}
