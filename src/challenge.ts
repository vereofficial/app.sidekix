import type { ChallengeRow } from './types/database';
import { activeSidequestTag } from './lib/sidequestPeriod';

export function splitChallengeTitle(challenge: Pick<ChallengeRow, 'title' | 'emphasis'>): {
  before: string;
  after: string;
} {
  const em = challenge.emphasis;
  const i = challenge.title.indexOf(em);
  if (i < 0) return { before: challenge.title, after: '' };
  return {
    before: challenge.title.slice(0, i),
    after: challenge.title.slice(i + em.length),
  };
}

export function challengeTag(_challenge: ChallengeRow): string {
  return activeSidequestTag();
}
