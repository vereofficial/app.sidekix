import { useCallback, useEffect, useState } from 'react';
import type { PostRow, SidequestPostRow } from '../types/database';
import { tryGetSupabase } from '../lib/supabase';

/** Legacy challenge post or a sidequest adventure mapped for `PostMediaTile` / journal. */
export type JournalPost = PostRow & { journalSource?: 'legacy' | 'sidequest' };

function mapSidequestPostToJournal(row: SidequestPostRow & { sidequests?: { title: string } | null }): JournalPost {
  const title = row.sidequests?.title ?? 'sidequest';
  return {
    id: row.id,
    challenge_id: row.sidequest_id,
    user_id: row.user_id,
    image_path: row.image_path,
    video_path: row.video_path,
    body: row.body,
    is_anonymous: row.is_anonymous,
    created_at: row.created_at,
    caption: title,
    journalSource: 'sidequest',
  };
}

export function useMyPosts(userId: string | undefined) {
  const [posts, setPosts] = useState<JournalPost[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!userId) {
      setPosts([]);
      setLoading(true);
      return;
    }
    if (!sb) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [legacyRes, sqRes] = await Promise.all([
      sb.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(60),
      sb
        .from('sidequest_posts')
        .select('*, sidequests(title)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(60),
    ]);

    const legacy = (legacyRes.data ?? []) as PostRow[];
    const sqRows = (sqRes.data ?? []) as (SidequestPostRow & { sidequests?: { title: string } | null })[];

    const mappedLegacy: JournalPost[] = legacy.map((p) => ({ ...p, journalSource: 'legacy' as const }));
    const mappedSq: JournalPost[] = sqRows.map(mapSidequestPostToJournal);

    const merged = [...mappedLegacy, ...mappedSq].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 80);
    setPosts(merged);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { posts, loading, refresh };
}
