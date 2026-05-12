import { useCallback, useEffect, useState } from 'react';
import type { PostRow, SidequestPostRow } from '../types/database';
import { tryGetSupabase } from '../lib/supabase';

export type JournalPostKind = 'legacy' | 'sidequest';

/** Calendar + thumbnails: legacy `posts` or `sidequest_posts` as a tile-shaped `PostRow`. */
export type JournalPost = {
  id: string;
  created_at: string;
  kind: JournalPostKind;
  /** Set when kind === 'sidequest' (for navigation). */
  sidequest_id: string | null;
  tile: PostRow;
};

function sidequestPostToTile(sp: SidequestPostRow): PostRow {
  return {
    id: sp.id,
    challenge_id: 'sidequest',
    user_id: sp.user_id,
    body: sp.body,
    image_path: sp.image_path,
    video_path: sp.video_path,
    is_anonymous: sp.is_anonymous,
    caption: sp.body,
    text_style: null,
    created_at: sp.created_at,
  };
}

export function useJournalPosts(userId: string | undefined) {
  const [entries, setEntries] = useState<JournalPost[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setEntries([]);
      setLoading(true);
      return;
    }
    const sb = tryGetSupabase();
    if (!sb) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [legacyRes, sqRes] = await Promise.all([
      sb.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(80),
      sb.from('sidequest_posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(80),
    ]);
    const legacy = (legacyRes.data ?? []) as PostRow[];
    const sq = (sqRes.data ?? []) as SidequestPostRow[];
    const merged: JournalPost[] = [
      ...legacy.map((p) => ({
        id: p.id,
        created_at: p.created_at,
        kind: 'legacy' as const,
        sidequest_id: null,
        tile: p,
      })),
      ...sq.map((p) => ({
        id: p.id,
        created_at: p.created_at,
        kind: 'sidequest' as const,
        sidequest_id: p.sidequest_id,
        tile: sidequestPostToTile(p),
      })),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at));
    setEntries(merged);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, loading, refresh };
}
