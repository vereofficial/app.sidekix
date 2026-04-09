import { useCallback, useEffect, useState } from 'react';
import type { ChallengeRow } from '../types/database';
import { localCalendarYmd } from '../lib/calendarDate';
import { tryGetSupabase } from '../lib/supabase';

export function useTodayChallenge() {
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!sb) {
      setChallenge(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const day = localCalendarYmd();
    const { data, error: qErr } = await sb
      .from('challenges')
      .select('*')
      .eq('day', day)
      .maybeSingle();
    if (qErr) {
      setError(qErr.message);
      setChallenge(null);
    } else {
      setChallenge(data as ChallengeRow | null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { challenge, loading, error, refresh };
}
