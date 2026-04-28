import type { ThemeColors } from '../theme';

/** Campus feed strip — mockup.html feed-prompt-strip */
export const MOCK_FEED_PROMPT = {
  quote: 'find your ick in the wild on campus',
  count: '847',
} as const;

export type MockFeedCard = {
  id: string;
  gradientIndex: number;
  votes: number;
  user: string;
  anon?: boolean;
  tall?: boolean;
};

/** Same order/spirit as `#campus-feed` in mockup.html */
export const MOCK_FEED_CARDS: MockFeedCard[] = [
  { id: '1', gradientIndex: 3, votes: 214, user: 'maya', tall: true },
  { id: '2', gradientIndex: 6, votes: 97, user: '', anon: true },
  { id: '3', gradientIndex: 0, votes: 63, user: 'priya' },
  { id: '4', gradientIndex: 2, votes: 44, user: 'nico' },
  { id: '5', gradientIndex: 8, votes: 38, user: '', anon: true },
  { id: '6', gradientIndex: 5, votes: 22, user: 'seb' },
  { id: '7', gradientIndex: 1, votes: 19, user: 'lex' },
];

export type MockProfileTile = { id: string; gradientIndex: number; badge?: string };

export const MOCK_PROFILE = {
  emoji: '🌵',
  username: 'wandering_cactus42',
  handleHint: 'tap avatar or name to edit',
  stats: { sidequests: '31', reactions: '1,240', won: '2×' },
  streak: '12',
  streakSub: 'post today to keep it going',
} as const;

export const MOCK_PROFILE_GRID: MockProfileTile[] = [
  { id: 'g1', gradientIndex: 2, badge: '▲ 312' },
  { id: 'g2', gradientIndex: 4, badge: '▲ 189' },
  { id: 'g3', gradientIndex: 7, badge: '🏆 won' },
  { id: 'g4', gradientIndex: 0 },
  { id: 'g5', gradientIndex: 3 },
  { id: 'g6', gradientIndex: 5 },
  { id: 'g7', gradientIndex: 1 },
  { id: 'g8', gradientIndex: 6 },
  { id: 'g9', gradientIndex: 8 },
];

export function mockUserLabel(c: MockFeedCard, colors: ThemeColors): string {
  if (c.anon) return 'anon';
  return `@${c.user}`;
}
