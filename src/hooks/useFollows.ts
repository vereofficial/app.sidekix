import { useCallback, useEffect, useState } from 'react';
import { tryGetSupabase } from '../lib/supabase';

export function useFollows() {
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (myId?: string) => {
    const sb = tryGetSupabase();
    if (!sb || !myId) {
      setFollowingIds([]);
      setFollowerIds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [outRes, inRes] = await Promise.all([
      sb.from('follows').select('following_id').eq('follower_id', myId),
      sb.from('follows').select('follower_id').eq('following_id', myId),
    ]);
    setFollowingIds((outRes.data ?? []).map((r: { following_id: string }) => r.following_id));
    setFollowerIds((inRes.data ?? []).map((r: { follower_id: string }) => r.follower_id));
    setLoading(false);
  }, []);

  return { followingIds, followerIds, loading, refresh };
}
