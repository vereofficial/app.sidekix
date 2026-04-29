import { useCallback, useEffect, useState } from 'react';
import { tryGetSupabase } from '../lib/supabase';
import type { ChallengeRow, PostRow, ProfileRow, SidequestPostRow, SidequestRow } from '../types/database';

export type FlowingSubmissionRow = SidequestPostRow & {
  username: string;
  sidequest_title: string;
  sidequest_categories: string[];
  sidequest_completion_count: number;
  source: 'sidequest' | 'legacy';
};

function legacyAuthorForDay(day: string): 'chinaza' | 'marina' {
  const n = day.split('-').join('').split('').reduce((acc, ch) => acc + Number(ch || 0), 0);
  return n % 2 === 0 ? 'chinaza' : 'marina';
}

export function useFlowingSidequestSubmissions(activeCategories: string[] = []) {
  const [rows, setRows] = useState<FlowingSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const categoriesKey = activeCategories.join('|');
  const refresh = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!sb) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: postsData, error } = await sb
      .from('sidequest_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      setRows([]);
      setLoading(false);
      return;
    }
    const posts = (postsData ?? []) as SidequestPostRow[];

    const sidequestIds = [...new Set(posts.map((p) => p.sidequest_id))];

    const [{ data: sqData }, { data: countData }] = await Promise.all([
      sidequestIds.length > 0 ? sb.from('sidequests').select('*').in('id', sidequestIds) : Promise.resolve({ data: [] }),
      sidequestIds.length > 0 ? sb.from('sidequest_posts').select('sidequest_id').in('sidequest_id', sidequestIds) : Promise.resolve({ data: [] }),
    ]);

    const sqMap = new Map<string, SidequestRow>();
    ((sqData ?? []) as SidequestRow[]).forEach((s) => sqMap.set(s.id, s));
    const usernameMap = new Map<string, string>();
    const completionCounts = new Map<string, number>();
    ((countData ?? []) as { sidequest_id: string }[]).forEach((c) => {
      completionCounts.set(c.sidequest_id, (completionCounts.get(c.sidequest_id) ?? 0) + 1);
    });

    const sidequestRows = posts
      .map((p) => {
        const sq = sqMap.get(p.sidequest_id);
        if (!sq || sq.approval_status !== 'approved') return null;
        const cats = sq.categories ?? [];
        if (activeCategories.length > 0 && !activeCategories.some((c) => cats.includes(c))) return null;
        return {
          ...p,
          username: p.is_anonymous ? 'anonymous' : usernameMap.get(p.user_id) ?? 'user',
          sidequest_title: sq.title,
          sidequest_categories: cats,
          sidequest_completion_count: completionCounts.get(sq.id) ?? 0,
          source: 'sidequest',
        } as FlowingSubmissionRow;
      })
      .filter((row): row is FlowingSubmissionRow => Boolean(row));

    const { data: legacyPostData } = await sb
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    const legacyPosts = (legacyPostData ?? []) as PostRow[];
    const legacyChallengeIds = [...new Set(legacyPosts.map((p) => p.challenge_id))];
    const { data: legacyChallengeData } = await sb.from('challenges').select('*').in('id', legacyChallengeIds);
    const legacyChallenges = (legacyChallengeData ?? []) as ChallengeRow[];
    const allUserIds = [...new Set([...posts.map((p) => p.user_id), ...legacyPosts.map((p) => p.user_id)])];
    if (allUserIds.length > 0) {
      const { data: profData } = await sb.from('profiles').select('id, username').in('id', allUserIds);
      ((profData ?? []) as Pick<ProfileRow, 'id' | 'username'>[]).forEach((p) => usernameMap.set(p.id, p.username));
    }

    const legacyChallengeMap = new Map<string, ChallengeRow>();
    legacyChallenges.forEach((c) => legacyChallengeMap.set(c.id, c));

    const legacyCounts = new Map<string, number>();
    legacyPosts.forEach((p) => {
      legacyCounts.set(p.challenge_id, (legacyCounts.get(p.challenge_id) ?? 0) + 1);
    });
    const legacyRows: FlowingSubmissionRow[] = legacyPosts
      .map((p) => {
        const c = legacyChallengeMap.get(p.challenge_id);
        if (!c) return null;
        const username = p.is_anonymous
          ? 'anonymous'
          : usernameMap.get(p.user_id) ?? legacyAuthorForDay(c.day);
        return {
          id: p.id,
          sidequest_id: p.challenge_id,
          user_id: p.user_id,
          body: p.body ?? p.caption,
          image_path: p.image_path,
          video_path: p.video_path,
          is_anonymous: p.is_anonymous,
          created_at: p.created_at,
          username,
          sidequest_title: c.title,
          sidequest_categories: ['legacy'],
          sidequest_completion_count: legacyCounts.get(p.challenge_id) ?? 0,
          source: 'legacy',
        };
      })
      .filter((row): row is FlowingSubmissionRow => Boolean(row));

    const combined = [...sidequestRows, ...legacyRows].sort((a, b) => b.created_at.localeCompare(a.created_at));
    setRows(combined);
    setLoading(false);
  }, [categoriesKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, loading, refresh };
}
