import { useCallback, useEffect, useState } from 'react';
import { tryGetSupabase } from '../lib/supabase';
import type { ProfileRow, SidequestPostRow } from '../types/database';

export function useSidequestPosts(sidequestId: string | null | undefined) {
  const [posts, setPosts] = useState<SidequestPostRow[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!sb || !sidequestId) {
      setPosts([]);
      setUsernames({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await sb
      .from('sidequest_posts')
      .select('*')
      .eq('sidequest_id', sidequestId)
      .order('created_at', { ascending: false });
    const list = (data ?? []) as SidequestPostRow[];
    setPosts(list);
    const userIds = [...new Set(list.map((p) => p.user_id))];
    if (userIds.length === 0) {
      setUsernames({});
      setLoading(false);
      return;
    }
    const { data: profData } = await sb.from('profiles').select('id, username').in('id', userIds);
    const map: Record<string, string> = {};
    ((profData ?? []) as Pick<ProfileRow, 'id' | 'username'>[]).forEach((p) => {
      map[p.id] = p.username;
    });
    setUsernames(map);
    setLoading(false);
  }, [sidequestId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { posts, usernames, loading, refresh };
}
