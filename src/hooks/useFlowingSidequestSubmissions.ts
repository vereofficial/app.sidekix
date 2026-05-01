import { useCallback, useEffect, useState } from 'react';
import { tryGetSupabase } from '../lib/supabase';
import { queryInChunks } from '../lib/supabaseInChunks';
import type { ChallengeRow, PostRow, ProfileRow, SidequestPostRow, SidequestRow } from '../types/database';

export type FlowingSubmissionRow = SidequestPostRow & {
  username: string;
  sidequest_title: string;
  sidequest_categories: string[];
  sidequest_completion_count: number;
  sidequest_people: string[];
  source: 'sidequest' | 'legacy';
  /** Who posted this idea/challenge prompt (shown on submission cards). */
  idea_creator_username: string;
  /** Reactions on legacy `posts`; sidequest submissions stay 0 until votes reference those ids. */
  vote_count: number;
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

    let sqResolved: SidequestRow[] = [];
    let countResolved: { sidequest_id: string }[] = [];
    if (sidequestIds.length > 0) {
      try {
        [sqResolved, countResolved] = await Promise.all([
          queryInChunks<SidequestRow>(sb, 'sidequests', 'id', sidequestIds, '*'),
          queryInChunks<{ sidequest_id: string }>(
            sb,
            'sidequest_posts',
            'sidequest_id',
            sidequestIds,
            'sidequest_id',
          ),
        ]);
      } catch {
        sqResolved = [];
        countResolved = [];
      }
    }

    const sqMap = new Map<string, SidequestRow>();
    sqResolved.forEach((s) => sqMap.set(s.id, s));
    const usernameMap = new Map<string, string>();
    const completionCounts = new Map<string, number>();
    countResolved.forEach((c) => {
      completionCounts.set(c.sidequest_id, (completionCounts.get(c.sidequest_id) ?? 0) + 1);
    });
    const postsBySidequest = new Map<string, SidequestPostRow[]>();
    posts.forEach((p) => {
      const cur = postsBySidequest.get(p.sidequest_id) ?? [];
      cur.push(p);
      postsBySidequest.set(p.sidequest_id, cur);
    });

    const { data: legacyPostData } = await sb
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    const legacyPosts = (legacyPostData ?? []) as PostRow[];
    const legacyChallengeIds = [...new Set(legacyPosts.map((p) => p.challenge_id))];
    let legacyChallenges: ChallengeRow[] = [];
    if (legacyChallengeIds.length > 0) {
      try {
        legacyChallenges = await queryInChunks<ChallengeRow>(sb, 'challenges', 'id', legacyChallengeIds, '*');
      } catch {
        legacyChallenges = [];
      }
    }
    const allUserIds = [...new Set([...posts.map((p) => p.user_id), ...legacyPosts.map((p) => p.user_id)])];
    if (allUserIds.length > 0) {
      const { data: profData } = await sb.from('profiles').select('id, username').in('id', allUserIds);
      ((profData ?? []) as Pick<ProfileRow, 'id' | 'username'>[]).forEach((p) => usernameMap.set(p.id, p.username));
    }

    const creatorIds = [...new Set([...sqMap.values()].map((s) => s.creator_id).filter(Boolean))];
    if (creatorIds.length > 0) {
      const missingCreators = creatorIds.filter((id) => !usernameMap.has(id));
      if (missingCreators.length > 0) {
        const { data: creatorProf } = await sb.from('profiles').select('id, username').in('id', missingCreators);
        ((creatorProf ?? []) as Pick<ProfileRow, 'id' | 'username'>[]).forEach((p) => usernameMap.set(p.id, p.username));
      }
    }

    const sidequestRows = posts
      .map((p) => {
        const sq = sqMap.get(p.sidequest_id);
        if (!sq || sq.approval_status !== 'approved') return null;
        const cats = sq.categories ?? [];
        if (activeCategories.length > 0 && !activeCategories.some((c) => cats.includes(c))) return null;
        const sidequestPeople = (postsBySidequest.get(sq.id) ?? [])
          .map((sp) => (sp.is_anonymous ? 'anonymous' : usernameMap.get(sp.user_id) ?? 'user'))
          .filter((name, idx, arr) => arr.indexOf(name) === idx)
          .slice(0, 3);
        const ideaCreator = sq.is_anonymous ? 'anonymous' : usernameMap.get(sq.creator_id) ?? 'user';
        return {
          ...p,
          username: p.is_anonymous ? 'anonymous' : usernameMap.get(p.user_id) ?? 'user',
          sidequest_title: sq.title,
          sidequest_categories: cats,
          sidequest_completion_count: completionCounts.get(sq.id) ?? 0,
          sidequest_people: sidequestPeople,
          source: 'sidequest',
          idea_creator_username: ideaCreator,
          vote_count: 0,
        } as FlowingSubmissionRow;
      })
      .filter((row): row is FlowingSubmissionRow => Boolean(row));

    const legacyChallengeMap = new Map<string, ChallengeRow>();
    legacyChallenges.forEach((c) => legacyChallengeMap.set(c.id, c));

    const legacyCounts = new Map<string, number>();
    const legacyPostsByChallenge = new Map<string, PostRow[]>();
    legacyPosts.forEach((p) => {
      legacyCounts.set(p.challenge_id, (legacyCounts.get(p.challenge_id) ?? 0) + 1);
      const cur = legacyPostsByChallenge.get(p.challenge_id) ?? [];
      cur.push(p);
      legacyPostsByChallenge.set(p.challenge_id, cur);
    });
    const legacyRowsRaw: FlowingSubmissionRow[] = legacyPosts
      .map((p) => {
        const c = legacyChallengeMap.get(p.challenge_id);
        if (!c) return null;
        const legacyCategories = c.categories ?? ['legacy'];
        if (activeCategories.length > 0 && !activeCategories.some((cat) => legacyCategories.includes(cat))) return null;
        const username = p.is_anonymous
          ? 'anonymous'
          : usernameMap.get(p.user_id) ?? legacyAuthorForDay(c.day);
        const legacyPeople = (legacyPostsByChallenge.get(p.challenge_id) ?? [])
          .map((lp) => (lp.is_anonymous ? 'anonymous' : usernameMap.get(lp.user_id) ?? legacyAuthorForDay(c.day)))
          .filter((name, idx, arr) => arr.indexOf(name) === idx)
          .slice(0, 3);
        const promptAuthor = legacyAuthorForDay(c.day);
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
          sidequest_categories: legacyCategories,
          sidequest_completion_count: legacyCounts.get(p.challenge_id) ?? 0,
          sidequest_people: legacyPeople,
          source: 'legacy',
          idea_creator_username: promptAuthor,
          vote_count: 0,
        };
      })
      .filter((row): row is FlowingSubmissionRow => Boolean(row));

    const legacyPostIds = legacyRowsRaw.map((r) => r.id);
    const voteTotals = new Map<string, number>();
    if (legacyPostIds.length > 0) {
      const { data: voteRows } = await sb.from('votes').select('post_id').in('post_id', legacyPostIds);
      (voteRows ?? []).forEach((v: { post_id: string }) => {
        voteTotals.set(v.post_id, (voteTotals.get(v.post_id) ?? 0) + 1);
      });
    }
    const legacyRows = legacyRowsRaw.map((r) => ({
      ...r,
      vote_count: voteTotals.get(r.id) ?? 0,
    }));

    const combined = [...sidequestRows, ...legacyRows].sort((a, b) => b.created_at.localeCompare(a.created_at));
    setRows(combined);
    setLoading(false);
  }, [categoriesKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, loading, refresh };
}
