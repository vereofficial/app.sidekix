import { useCallback, useEffect, useMemo, useState } from 'react';
import { tryGetSupabase } from '../lib/supabase';
import { queryInChunks } from '../lib/supabaseInChunks';
import type { ProfileRow, SidequestPostRow, SidequestRow } from '../types/database';

export type SidequestFeedRow = SidequestRow & {
  creator_username: string;
  completion_count: number;
  preview_posts: SidequestPostRow[];
};

export function useSidequestFeed(activeCategories: string[] = [], includePending = false) {
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
    setError(null);
    let q = sb.from('sidequests').select('*');
    if (activeCategories.length > 0) {
      q = q.overlaps('categories', activeCategories);
    }
    const { data, error: sqErr } = await q.order('created_at', { ascending: false }).limit(150);
    if (sqErr) {
      setError(sqErr.message);
      setRows([]);
      setLoading(false);
      return;
    }
    const sidequests = ((data ?? []) as SidequestRow[]).filter((s) => {
      const status = s.approval_status ?? 'approved';
      if (!includePending && status !== 'approved') return false;
      return true;
    });
    if (sidequests.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    const ids = sidequests.map((s) => s.id);
    const creatorIds = [...new Set(sidequests.map((s) => s.creator_id))];

    const { data: profData } = await sb.from('profiles').select('id, username').in('id', creatorIds);
    let allPosts: SidequestPostRow[] = [];
    try {
      allPosts = await queryInChunks<SidequestPostRow>(sb, 'sidequest_posts', 'sidequest_id', ids, '*');
    } catch {
      allPosts = [];
    }
    allPosts.sort((a, b) => b.created_at.localeCompare(a.created_at));

    const profileById = new Map<string, string>();
    ((profData ?? []) as Pick<ProfileRow, 'id' | 'username'>[]).forEach((p) => profileById.set(p.id, p.username));

    const postsBySidequest = new Map<string, SidequestPostRow[]>();
    allPosts.forEach((p) => {
      const cur = postsBySidequest.get(p.sidequest_id) ?? [];
      cur.push(p);
      postsBySidequest.set(p.sidequest_id, cur);
    });

    setRows(
      sidequests
      .map((s) => {
        const all = postsBySidequest.get(s.id) ?? [];
        return {
          ...s,
          creator_username: s.is_anonymous ? 'anonymous' : profileById.get(s.creator_id) ?? 'user',
          completion_count: all.length,
          preview_posts: all
            .filter((p) =>
              Boolean(p.image_path?.trim() || p.video_path?.trim() || (p.body ?? '').trim()),
            )
            .slice(0, 9),
        };
      })
      .sort((a, b) => {
        if (b.completion_count !== a.completion_count) return b.completion_count - a.completion_count;
        return b.created_at.localeCompare(a.created_at);
      }),
    );
    setLoading(false);
  }, [activeCategories, includePending]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasFilters = useMemo(() => activeCategories.length > 0, [activeCategories.length]);

  return { rows, loading, error, refresh, hasFilters };
}
