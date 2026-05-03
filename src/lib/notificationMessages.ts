/**
 * Central place to edit local notification copy (sidequest drops + milestones).
 * Changes here ship with the next app build.
 *
 * Push `data` kinds handled for deep links — see `routeNotificationData` in `notifications.native.ts`:
 * `sidequest_activity`, `sidequest_trending`, `idea_done_milestone` (needs `sidequest_id`),
 * `adventure_reaction_milestone` (needs `post_id` — challenge `posts` row),
 * `re_engagement` (`variant`: `saved_prompt` → saved tab, else feed).
 *
 * Scheduling / tap behavior: `src/lib/notifications.native.ts` (search `NOTIF_SIDEQUEST_*`).
 * iOS custom alert sounds require bundling a `.caf`/`.wav` in the app and setting `sound` on the notification.
 */
export const NOTIF_SIDEQUEST_TITLE = 'Sidekix';
export const NOTIF_SIDEQUEST_BODY = "new sidequest just dropped. don't be last. 🔥";

export const NOTIF_REACTION_TITLE = 'Sidekix';

export const NOTIF_FRIEND_TITLE = 'Sidekix';

export const notifFriendRequestBody = (username: string) =>
  `@${username} wants to be friends`;

export const notifFriendAcceptedBody = (username: string) =>
  `@${username} accepted your friend request`;

export const notifLeaderboardRankBody = (place: 1 | 2 | 3) => {
  if (place === 1) return "You're 1st on the leaderboard this week!";
  if (place === 2) return "You're 2nd on the leaderboard this week!";
  return "You're 3rd on the leaderboard this week!";
};

export const notifWeeklyWinTitle = 'Sidekix';

export function notifWeeklyWinBody(variant: 'prize' | 'first_no_pool' | 'first_need_reactions'): string {
  if (variant === 'prize') {
    return 'You won last week on the leaderboard! Open the app for your recap — DM @sidekix.app to claim.';
  }
  if (variant === 'first_no_pool') {
    return 'You finished #1 last week! Open the app for your week in review.';
  }
  return 'You topped last week’s leaderboard! Open the app for details — you may need a few more reactions to qualify for the prize.';
}

export function notifWeeklyPlacementBody(rank: number): string {
  return `You finished #${rank} on last week's leaderboard. Open the app for a quick recap.`;
}

// --- Push payload helpers (copy must match server / Edge Functions that schedule notifications) ---

export type SidequestActivityVariant = 'named' | 'anonymous' | 'saved';

/** SIDEQUEST ACTIVITY — include `sidequest_id` in notification data for deep links. */
export function notifSidequestActivityBody(variant: SidequestActivityVariant, actorName?: string): string {
  if (variant === 'anonymous') return 'someone just did your idea in real life 👀';
  if (variant === 'saved') return 'someone saved your sidequest for later';
  const name = (actorName ?? 'Someone').trim();
  return `${name} just went on your sidequest 🎯`;
}

/** Your idea is trending — include `sidequest_id`. */
export function notifSidequestTrendingBody(): string {
  return 'your sidequest is taking off 🔥';
}

export type ReEngagementVariant = 'gentle' | 'saved_prompt';

/** Re-engagement — gentle; use `saved_prompt` + `saved_count` for the saved-queue nudge. */
export function notifReEngagementBody(variant: ReEngagementVariant, savedCount?: number): string {
  if (variant === 'saved_prompt' && typeof savedCount === 'number' && savedCount > 0) {
    return `you've got ${savedCount} saved sidequests. done any of them?`;
  }
  return "haven't seen you in a bit. anything good happen lately?";
}

const IDEA_DONE_COPY: Record<5 | 10 | 25 | 50 | 100, string> = {
  5: '5 real people went and did your idea 🎯',
  10: 'your idea has sent 10 people out into the world',
  25: '25 adventures started because of your idea',
  50: "50 people have done your sidequest. it's officially a thing.",
  100: "your idea has been done 100 times. that's real impact.",
};

export function notifIdeaDoneMilestoneBody(milestone: 5 | 10 | 25 | 50 | 100): string {
  return IDEA_DONE_COPY[milestone];
}

const REACTION_ADVENTURE_COPY: Record<10 | 25 | 50 | 100 | 250 | 500, string> = {
  10: '10 people loved your adventure🔥',
  25: "your adventure hit 25 reactions. this one's getting around 👀",
  50: 'you got 50 reactions to your post! this adventure hit.',
  100: "100 people reacted to your adventure. that's impressive.",
  250: '250 reactions! your adventure is one of the best on the app',
  500: '500 reactions to your post! this is the one.',
};

/** Body for an adventure (challenge) post reaction milestone — include `post_id` in data. */
export function notifAdventureReactionMilestoneBody(milestone: number): string {
  const tier = milestone as keyof typeof REACTION_ADVENTURE_COPY;
  if (tier in REACTION_ADVENTURE_COPY) return REACTION_ADVENTURE_COPY[tier];
  return `your post hit ${milestone} reactions.`;
}
