import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tryGetSupabase } from '../lib/supabase';
import type { ChallengeRow, SidequestRow } from '../types/database';

/** Postgres unique violation — happens when save is tapped twice before refresh catches up. */
function isUniqueViolation(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === '23505') return true;
  const m = (err.message ?? '').toLowerCase();
  return m.includes('duplicate') || m.includes('unique constraint');
}

export type SavedSidequestPreview = {
  save_id: string;
  saved_at: string;
  sidequest: SidequestRow;
};

export type SavedChallengePreview = {
  save_id: string;
  saved_at: string;
  challenge: ChallengeRow;
};

export function useSavedSidequests(userId?: string | null) {
  const [saved, setSaved] = useState<SavedSidequestPreview[]>([]);
  const [savedChallenges, setSavedChallenges] = useState<SavedChallengePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const togglingSq = useRef(new Set<string>());
  const togglingCh = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    if (!userId) {
      setSaved([]);
      setSavedChallenges([]);
      setError(null);
      return;
    }
    const sb = tryGetSupabase();
    if (!sb) {
      setSaved([]);
      setSavedChallenges([]);
      return;
    }
    setLoading(true);
    setError(null);

    const [sqRes, chRes] = await Promise.all([
      sb.from('sidequest_saves').select('id, created_at, sidequests(*)').eq('user_id', userId).order('created_at', { ascending: false }),
      sb.from('challenge_saves').select('id, created_at, challenges(*)').eq('user_id', userId).order('created_at', { ascending: false }),
    ]);

    const qErr = sqRes.error ?? chRes.error;
    if (qErr) {
      setSaved([]);
      setSavedChallenges([]);
      setError(qErr.message);
      setLoading(false);
      return;
    }

    const sqRows = (sqRes.data ?? []) as unknown as {
      id: string;
      created_at: string;
      sidequests: SidequestRow | SidequestRow[] | null;
    }[];

    setSaved(
      sqRows
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

    const chRows = (chRes.data ?? []) as unknown as {
      id: string;
      created_at: string;
      challenges: ChallengeRow | ChallengeRow[] | null;
    }[];

    setSavedChallenges(
      chRows
        .map((r) => ({
          ...r,
          challenges: Array.isArray(r.challenges) ? (r.challenges[0] ?? null) : r.challenges,
        }))
        .filter((r) => Boolean(r.challenges))
        .map((r) => ({
          save_id: r.id,
          saved_at: r.created_at,
          challenge: r.challenges as ChallengeRow,
        })),
    );

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const savedIds = useMemo(() => new Set(saved.map((s) => s.sidequest.id)), [saved]);

  const savedChallengeIds = useMemo(() => new Set(savedChallenges.map((s) => s.challenge.id)), [savedChallenges]);

  const toggleSaved = useCallback(
    async (sidequestId: string) => {
      if (!userId) return { ok: false as const, error: 'Sign in required.' };
      const sb = tryGetSupabase();
      if (!sb) return { ok: false as const, error: 'Supabase not configured.' };
      if (togglingSq.current.has(sidequestId)) return { ok: true as const };
      togglingSq.current.add(sidequestId);

      try {
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
          if (insErr) {
            if (isUniqueViolation(insErr)) {
              await refresh();
              return { ok: true as const };
            }
            return { ok: false as const, error: insErr.message };
          }
        }

        await refresh();
        return { ok: true as const };
      } finally {
        togglingSq.current.delete(sidequestId);
      }
    },
    [refresh, savedIds, userId],
  );

  const toggleSavedChallenge = useCallback(
    async (challengeId: string) => {
      if (!userId) return { ok: false as const, error: 'Sign in required.' };
      const sb = tryGetSupabase();
      if (!sb) return { ok: false as const, error: 'Supabase not configured.' };
      if (togglingCh.current.has(challengeId)) return { ok: true as const };
      togglingCh.current.add(challengeId);

      try {
        if (savedChallengeIds.has(challengeId)) {
          const { error: delErr } = await sb
            .from('challenge_saves')
            .delete()
            .eq('user_id', userId)
            .eq('challenge_id', challengeId);
          if (delErr) return { ok: false as const, error: delErr.message };
        } else {
          const { error: insErr } = await sb.from('challenge_saves').insert({
            user_id: userId,
            challenge_id: challengeId,
          });
          if (insErr) {
            if (isUniqueViolation(insErr)) {
              await refresh();
              return { ok: true as const };
            }
            return { ok: false as const, error: insErr.message };
          }
        }

        await refresh();
        return { ok: true as const };
      } finally {
        togglingCh.current.delete(challengeId);
      }
    },
    [refresh, savedChallengeIds, userId],
  );

  return {
    saved,
    savedChallenges,
    savedIds,
    savedChallengeIds,
    loading,
    error,
    refresh,
    toggleSaved,
    toggleSavedChallenge,
  };
}
