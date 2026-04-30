import { useCallback, useEffect, useMemo, useState } from 'react';
import { tryGetSupabase } from '../lib/supabase';
import type { SidequestRow } from '../types/database';

export type SavedSidequestPreview = {
  save_id: string;
  saved_at: string;
  sidequest: SidequestRow;
};

export function useSavedSidequests(userId?: string | null) {
  const [saved, setSaved] = useState<SavedSidequestPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSaved([]);
      setError(null);
      return;
    }
    const sb = tryGetSupabase();
    if (!sb) {
      setSaved([]);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await sb
      .from('sidequest_saves')
      .select('id, created_at, sidequests(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (qErr) {
      setSaved([]);
      setError(qErr.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as {
      id: string;
      created_at: string;
      sidequests: SidequestRow | SidequestRow[] | null;
    }[];

    setSaved(
      rows
        .map((r) => ({
          ...r,
          sidequests: Array.isArray(r.sidequests) ? (r.sidequests[0] ?? null) : r.sidequests,
        }))
        .filter((r) => Boolean(r.sidequests))
        .map((r) => ({
          save_id: r.id,
          saved_at: r.created_at,
          sidequest: r.sidequests as SidequestRow,
        })),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const savedIds = useMemo(() => new Set(saved.map((s) => s.sidequest.id)), [saved]);

  const toggleSaved = useCallback(
    async (sidequestId: string) => {
      if (!userId) return { ok: false as const, error: 'Sign in required.' };
      const sb = tryGetSupabase();
      if (!sb) return { ok: false as const, error: 'Supabase not configured.' };

      if (savedIds.has(sidequestId)) {
        const { error: delErr } = await sb
          .from('sidequest_saves')
          .delete()
          .eq('user_id', userId)
          .eq('sidequest_id', sidequestId);
        if (delErr) return { ok: false as const, error: delErr.message };
      } else {
        const { error: insErr } = await sb.from('sidequest_saves').insert({
          user_id: userId,
          sidequest_id: sidequestId,
        });
        if (insErr) return { ok: false as const, error: insErr.message };
      }

      await refresh();
      return { ok: true as const };
    },
    [refresh, savedIds, userId],
  );

  return { saved, savedIds, loading, error, refresh, toggleSaved };
}
