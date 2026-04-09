import { useCallback, useEffect, useState } from 'react';
import type { ChallengeRow } from '../types/database';
import { tryGetSupabase } from '../lib/supabase';

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function usePastChallenges() {
  const [rows, setRows] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!sb) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const day = utcToday();
    const { data } = await sb
      .from('challenges')
      .select('*')
      .lt('day', day)
      .order('day', { ascending: false })
      .limit(12);
    setRows((data ?? []) as ChallengeRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { pastChallenges: rows, loading, refresh };
}
