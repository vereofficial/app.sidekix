import { useCallback, useEffect, useState } from 'react';
import type { ChallengeRow, PostRow } from '../types/database';
import { tryGetSupabase } from '../lib/supabase';

export type LegacyChallengeIdeaRow = {
  challenge_id: string;
  title: string;
  creator_username: 'chinaza' | 'marina';
  completion_count: number;
  preview_posts: PostRow[];
  day: string;
};

function legacyAuthorForDay(day: string): 'chinaza' | 'marina' {
  const n = day.split('-').join('').split('').reduce((acc, ch) => acc + Number(ch || 0), 0);
  return n % 2 === 0 ? 'chinaza' : 'marina';
}

export function useLegacyChallengeIdeas() {
  const [rows, setRows] = useState<LegacyChallengeIdeaRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!sb) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: chData } = await sb.from('challenges').select('*').order('day', { ascending: false }).limit(120);
    const challenges = (chData ?? []) as ChallengeRow[];
    if (challenges.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    const challengeIds = challenges.map((c) => c.id);
    const { data: postData } = await sb
      .from('posts')
      .select('*')
      .in('challenge_id', challengeIds)
      .order('created_at', { ascending: false });
    const posts = (postData ?? []) as PostRow[];
    const grouped = new Map<string, PostRow[]>();
    posts.forEach((p) => {
      const cur = grouped.get(p.challenge_id) ?? [];
      cur.push(p);
      grouped.set(p.challenge_id, cur);
    });

    const nextRows: LegacyChallengeIdeaRow[] = challenges.map((c) => {
      const all = grouped.get(c.id) ?? [];
      return {
        challenge_id: c.id,
        title: c.title,
        creator_username: legacyAuthorForDay(c.day),
        completion_count: all.length,
        preview_posts: all.filter((p) => Boolean(p.image_path?.trim() || p.video_path?.trim())).slice(0, 3),
        day: c.day,
      };
    });
    setRows(nextRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, loading, refresh };
}
