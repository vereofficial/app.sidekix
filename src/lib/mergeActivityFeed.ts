import type { FlowingSubmissionRow } from '../hooks/useFlowingSidequestSubmissions';
import type { LegacyChallengeIdeaRow } from '../hooks/useLegacyChallengeIdeas';
import type { SidequestFeedRow } from '../hooks/useSidequestFeed';

export type ActivityFeedItem =
  | { kind: 'adventure'; sortAt: string; row: FlowingSubmissionRow }
  | { kind: 'idea_sidequest'; sortAt: string; sq: SidequestFeedRow }
  | { kind: 'idea_legacy'; sortAt: string; idea: LegacyChallengeIdeaRow };

function legacyDaySortIso(day: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(day.trim())) return `${day.trim()}T12:00:00.000Z`;
  const t = Date.parse(day);
  if (!Number.isNaN(t)) return new Date(t).toISOString();
  return day;
}

/** Sorted activity stream: submissions interleaved with idea cards (includes zero-completion prompts from Supabase). */
export function mergeActivityFeed(
  flowing: FlowingSubmissionRow[],
  sidequests: SidequestFeedRow[],
  legacyIdeas: LegacyChallengeIdeaRow[],
  maxItems = 120,
): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = [
    ...flowing.map(
      (row): ActivityFeedItem => ({ kind: 'adventure', sortAt: row.created_at, row }),
    ),
    ...sidequests.map(
      (sq): ActivityFeedItem => ({ kind: 'idea_sidequest', sortAt: sq.created_at, sq }),
    ),
    ...legacyIdeas.map(
      (idea): ActivityFeedItem => ({
        kind: 'idea_legacy',
        sortAt: legacyDaySortIso(idea.day),
        idea,
      }),
    ),
  ];
  items.sort((a, b) => b.sortAt.localeCompare(a.sortAt));
  return items.slice(0, Math.max(0, maxItems));
}
