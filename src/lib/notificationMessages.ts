/**
 * Central place to edit local notification copy (sidequest drops + milestones).
 * Changes here ship with the next app build.
 *
 * Scheduling / tap behavior: `src/lib/notifications.native.ts` (search `NOTIF_SIDEQUEST_*`).
 * iOS custom alert sounds require bundling a `.caf`/`.wav` in the app and setting `sound` on the notification.
 */
export const NOTIF_SIDEQUEST_TITLE = 'Sidekix';
export const NOTIF_SIDEQUEST_BODY = "new sidequest just dropped. don't be last. 🔥";

export const notifReactionMilestoneBody = (milestone: number) =>
  `your post hit ${milestone} reactions.`;

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
