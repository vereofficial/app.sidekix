/**
 * Central copy for **local** notifications and parity docs for **push** payloads.
 *
 * ---
 * Inventory (where strings live — update all relevant layers when copy changes)
 *
 * **A. Scheduled locally (client `notifications.native.ts`)**
 * - `re_engagement` — several weekdays (gentle local copy) — NOTIF_ENGAGEMENT_TITLE + `notifEngagementLocalBody`
 *
 * **B. Local from device (client)**
 * - `adventure_reaction_milestone` — immediate when crossing a tier — NOTIF_REACTION_TITLE + `notifAdventureReactionMilestoneBody`
 *
 * **C. Push via Supabase `notification_outbox` → deliver-notification-outbox**
 * Trigger / enqueue bodies must match app deep-link handlers in `routeNotificationData`:
 * - SQL triggers (`024_sidequest_ratings_and_notification_triggers.sql`, `027_sidequest_approved_notify.sql`):
 *   `sidequest_activity`, `idea_done_milestone`, `adventure_reaction_milestone`, `sidequest_approved`
 *   — strings are **in the migration**, not here.
 * - `enqueue-scheduled-notifications`: `sidequest_trending`, `re_engagement` (gentle + saved_prompt) — strings **in that Edge Function**.
 * - Legacy resolver (`deliver-notification-outbox`): `friend_request`, `friend_accept`, `upvote_milestone` → maps to `adventure_reaction_milestone`.
 *
 * **D. Push payload `kind` values the client handles** (`notifications.native.ts`)
 * `sidequest_activity`, `sidequest_trending`, `idea_done_milestone`, `sidequest_approved`, `adventure_reaction_milestone`,
 * `upvote_milestone` (alias), `re_engagement`
 * (Friend / leaderboard pushes are not routed in-app; milestone reaction push still routes.)
 *
 * **E. Manual broadcast** (`broadcast-expo-push`): arbitrary title/body; data `{ kind: 'broadcast' }`.
 *
 * Changing server/trigger copy requires a DB migration or Edge Function redeploy — OTA does not update those.
 */
export const NOTIF_ENGAGEMENT_TITLE = 'Sidekix';

export const NOTIF_REACTION_TITLE = 'Sidekix';

/** Rotating bodies for weekly **local** engagement reminders (paired with `scheduleLocalEngagementReminders`). */
export function notifEngagementLocalBody(slotIndex: number): string {
  const bodies = [
    notifReEngagementBody('gentle'),
    'see anything worth posting today?',
    'peek the feed — something might spark a post.',
    'got a saved sidequest? today could be the day.',
    'new ideas land all week. worth a quick scroll?',
  ];
  return bodies[((slotIndex % bodies.length) + bodies.length) % bodies.length];
}

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
