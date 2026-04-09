import { useCallback, useEffect, useState } from 'react';
import { tryGetSupabase } from '../lib/supabase';

export function usePostCount(challengeId: string | null) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!sb || !challengeId) {
      setCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { count: c, error } = await sb
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('challenge_id', challengeId);
    if (!error && c !== null) setCount(c);
    else setCount(0);
    setLoading(false);
  }, [challengeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { count, loading, refresh };
}
