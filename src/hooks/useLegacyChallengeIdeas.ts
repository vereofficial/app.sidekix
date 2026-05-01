import { useCallback, useEffect, useState } from 'react';
import type { ChallengeRow, PostRow } from '../types/database';
import { tryGetSupabase } from '../lib/supabase';
import { queryInChunks } from '../lib/supabaseInChunks';

export type LegacyChallengeIdeaRow = {
  challenge_id: string;
  title: string;
  subtitle: string | null;
  categories: string[];
  creator_username: 'chinaza' | 'marina';
  completion_count: number;
  preview_posts: PostRow[];
  day: string;
};

function legacyAuthorForDay(day: string): 'chinaza' | 'marina' {
  const n = day.split('-').join('').split('').reduce((acc, ch) => acc + Number(ch || 0), 0);
  return n % 2 === 0 ? 'chinaza' : 'marina';
}

export function useLegacyChallengeIdeas(activeCategories: string[] = []) {
  const [rows, setRows] = useState<LegacyChallengeIdeaRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!sb) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data: chData } = await sb.from('challenges').select('*').order('day', { ascending: false }).limit(120);
    const challenges = (chData ?? []) as ChallengeRow[];
    if (challenges.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    const challengeIds = challenges.map((c) => c.id);
    let posts: PostRow[] = [];
    try {
      posts = await queryInChunks<PostRow>(sb, 'posts', 'challenge_id', challengeIds, '*');
    } catch {
      posts = [];
    }
    posts.sort((a, b) => b.created_at.localeCompare(a.created_at));
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
        subtitle: c.subtitle ?? null,
        categories: c.categories ?? ['legacy'],
        creator_username: legacyAuthorForDay(c.day),
        completion_count: all.length,
        preview_posts: all
          .filter((p) =>
            Boolean(
              p.image_path?.trim() ||
                p.video_path?.trim() ||
                (p.body ?? p.caption ?? '').trim(),
            ),
          )
          .slice(0, 9),
        day: c.day,
      };
    });
    const matched =
      activeCategories.length === 0
        ? nextRows
        : nextRows.filter((r) => activeCategories.some((c) => (r.categories ?? []).includes(c)));

    setRows(
      matched.sort((a, b) => {
        if (b.completion_count !== a.completion_count) return b.completion_count - a.completion_count;
        return b.day.localeCompare(a.day);
      }),
    );
    setLoading(false);
  }, [activeCategories]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, loading, refresh };
}
