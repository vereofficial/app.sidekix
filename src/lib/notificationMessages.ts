/**
 * Central copy for **local** notifications and parity docs for **push** payloads.
 *
 * Inventory (where strings live; update all relevant layers when copy changes)
 *
 * **A. Scheduled locally** (`notifications.native.ts` + this file)
 * - `re_engagement`: NOTIF_ENGAGEMENT_TITLE + `notifEngagementLocalBody`
 *
 * **B. Local immediate**
 * - `adventure_reaction_milestone`: NOTIF_REACTION_TITLE + `notifAdventureReactionMilestoneBody` (`notifyReactionMilestone`)
 *
 * **C. Push via `notification_outbox` → deliver-notification-outbox**
 * - SQL (migrations `024`, `027`, `028`, `029`): sidequest activity, idea milestones, saves, reaction milestones (legacy + sidequest), sidequest approved
 * - `enqueue-scheduled-notifications`: sidequest_trending, re_engagement
 * - Legacy resolver in `deliver-notification-outbox`: `friend_request`, `friend_accept`, `upvote_milestone` → maps to adventure_reaction_milestone body
 *
 * **D. Client routes** (`notifications.native.ts` `routeNotificationData`)
 *
 * **E. Broadcast** (`broadcast-expo-push`): arbitrary title/body
 *
 * Changing server/trigger copy requires a DB migration or Edge Function redeploy; OTA does not update those.
 */

export const NOTIF_ENGAGEMENT_TITLE = 'Sidekix';

export const NOTIF_REACTION_TITLE = 'Sidekix';

/** Rotating bodies for weekly **local** engagement reminders (paired with `scheduleLocalEngagementReminders`). */
export function notifEngagementLocalBody(slotIndex: number): string {
  const bodies = [
    notifReEngagementBody('gentle'),
    'see anything worth posting today?',
    'peek the feed. something might spark a post.',
    'got a saved sidequest? today could be the day.',
    'new ideas land all week. worth a quick scroll?',
  ];
  return bodies[((slotIndex % bodies.length) + bodies.length) % bodies.length];
}

export type SidequestActivityVariant = 'named' | 'anonymous' | 'saved';

/** Sidequest activity. Include `sidequest_id` in notification data for deep links. */
export function notifSidequestActivityBody(variant: SidequestActivityVariant, actorName?: string): string {
  if (variant === 'anonymous') return 'someone just did your idea in real life 👀';
  if (variant === 'saved') return 'someone saved your sidequest for later';
  const name = (actorName ?? 'Someone').trim();
  return `${name} just went on your sidequest 🎯`;
}

/** Trending sidequest. Include `sidequest_id`. */
export function notifSidequestTrendingBody(): string {
  return 'your sidequest is taking off 🔥';
}

export type ReEngagementVariant = 'gentle' | 'saved_prompt';

/** Re-engagement: gentle; use `saved_prompt` + `saved_count` for the saved-queue nudge. */
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

/** Body for adventure reaction milestones (legacy `posts` and sidequest `sidequest_posts`). Include `post_id` and optional `submission_source` / `sidequest_id` in push data. */
export function notifAdventureReactionMilestoneBody(milestone: number): string {
  const tier = milestone as keyof typeof REACTION_ADVENTURE_COPY;
  if (tier in REACTION_ADVENTURE_COPY) return REACTION_ADVENTURE_COPY[tier];
  return `your post hit ${milestone} reactions.`;
}

/*
 * --- All user-facing notification copy (single list) ---
 * Titles: "Sidekix" everywhere below unless noted.
 *
 * Local (scheduled engagement, notifEngagementLocalBody):
 *   - haven't seen you in a bit. anything good happen lately?
 *   - see anything worth posting today?
 *   - peek the feed. something might spark a post.
 *   - got a saved sidequest? today could be the day.
 *   - new ideas land all week. worth a quick scroll?
 *
 * Local (immediate reaction milestone, notifAdventureReactionMilestoneBody):
 *   - 10 people loved your adventure🔥
 *   - your adventure hit 25 reactions. this one's getting around 👀
 *   - you got 50 reactions to your post! this adventure hit.
 *   - 100 people reacted to your adventure. that's impressive.
 *   - 250 reactions! your adventure is one of the best on the app
 *   - 500 reactions to your post! this is the one.
 *   - (fallback) your post hit {n} reactions.
 *
 * Push / SQL (024 sidequest_posts trigger): activity to creator
 *   - someone just did your idea in real life 👀
 *   - {name} just went on your sidequest 🎯
 * Idea done milestones (same migration):
 *   - 5 real people went and did your idea 🎯
 *   - your idea has sent 10 people out into the world
 *   - 25 adventures started because of your idea
 *   - 50 people have done your sidequest. it's officially a thing.
 *   - your idea has been done 100 times. that's real impact.
 *
 * Push / SQL (024 sidequest_saves): someone saved your sidequest for later
 *
 * Push / SQL (027): your sidequest got approved and is now live 🎉
 *
 * Push / SQL (029) reaction milestones: same six lines as local reaction tier list above.
 *
 * Edge enqueue-scheduled-notifications:
 *   - your sidequest is taking off 🔥
 *   - haven't seen you in a bit. anything good happen lately?
 *   - you've got {n} saved sidequests. done any of them?
 *
 * Edge deliver-notification-outbox (friends; legacy upvote_milestone rows):
 *   - @{username} wants to be friends
 *   - @{username} accepted your friend request
 *   - reaction tiers: same six lines as local reaction list; fallback your post hit {m} reactions.
 */
