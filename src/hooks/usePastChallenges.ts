import { useCallback, useEffect, useState } from 'react';
import type { ChallengeRow } from '../types/database';
import { localCalendarYmd } from '../lib/calendarDate';
import { tryGetSupabase } from '../lib/supabase';

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
    const day = localCalendarYmd();
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
