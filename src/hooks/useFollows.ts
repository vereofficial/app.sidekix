import { useCallback, useEffect, useState } from 'react';
import { tryGetSupabase } from '../lib/supabase';

export function useFollows() {
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (myId?: string) => {
    const sb = tryGetSupabase();
    if (!sb || !myId) {
      setIds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await sb.from('follows').select('following_id').eq('follower_id', myId);
    setIds((data ?? []).map((r: { following_id: string }) => r.following_id));
    setLoading(false);
  }, []);

  return { followingIds: ids, loading, refresh };
}
