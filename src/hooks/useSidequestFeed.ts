import { useCallback, useEffect, useMemo, useState } from 'react';
import { tryGetSupabase } from '../lib/supabase';
import type { ProfileRow, SidequestPostRow, SidequestRow } from '../types/database';

export type SidequestFeedRow = SidequestRow & {
  creator_username: string;
  completion_count: number;
  preview_posts: SidequestPostRow[];
};

export function useSidequestFeed(activeCategories: string[] = []) {
  const [rows, setRows] = useState<SidequestFeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!sb) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: sqErr } = await sb.from('sidequests').select('*').order('created_at', { ascending: false }).limit(80);
    if (sqErr) {
      setError(sqErr.message);
      setRows([]);
      setLoading(false);
      return;
    }
    const sidequests = ((data ?? []) as SidequestRow[]).filter((s) =>
      activeCategories.length === 0 ? true : activeCategories.some((c) => s.categories?.includes(c)),
    );
    if (sidequests.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    const ids = sidequests.map((s) => s.id);
    const creatorIds = [...new Set(sidequests.map((s) => s.creator_id))];

    const [{ data: profData }, { data: postData }] = await Promise.all([
      sb.from('profiles').select('id, username').in('id', creatorIds),
      sb.from('sidequest_posts').select('*').in('sidequest_id', ids).order('created_at', { ascending: false }),
    ]);

    const profileById = new Map<string, string>();
    ((profData ?? []) as Pick<ProfileRow, 'id' | 'username'>[]).forEach((p) => profileById.set(p.id, p.username));

    const postsBySidequest = new Map<string, SidequestPostRow[]>();
    ((postData ?? []) as SidequestPostRow[]).forEach((p) => {
      const cur = postsBySidequest.get(p.sidequest_id) ?? [];
      cur.push(p);
      postsBySidequest.set(p.sidequest_id, cur);
    });

    setRows(
      sidequests.map((s) => {
        const all = postsBySidequest.get(s.id) ?? [];
        return {
          ...s,
          creator_username: s.is_anonymous ? 'anonymous' : profileById.get(s.creator_id) ?? 'user',
          completion_count: all.length,
          preview_posts: all.filter((p) => Boolean(p.image_path?.trim() || p.video_path?.trim())).slice(0, 3),
        };
      }),
    );
    setLoading(false);
  }, [activeCategories]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasFilters = useMemo(() => activeCategories.length > 0, [activeCategories.length]);

  return { rows, loading, error, refresh, hasFilters };
}
