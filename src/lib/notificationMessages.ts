/**
 * Central place to edit local notification copy (10am drop + milestones).
 * Changes here ship with the next app build.
 *
 * Scheduling / tap behavior: `src/lib/notifications.native.ts` (search `NOTIF_SIDEQUEST_*`).
 * iOS custom alert sounds require bundling a `.caf`/`.wav` in the app and setting `sound` on the notification.
 */
export const NOTIF_SIDEQUEST_TITLE = 'Sidekix';
export const NOTIF_SIDEQUEST_BODY = "today's sidequest just dropped. don't be last. 🔥";

export const notifReactionMilestoneBody = (milestone: number) =>
  `your post hit ${milestone} reactions.`;

export const NOTIF_REACTION_TITLE = 'Sidekix';

export const NOTIF_FRIEND_TITLE = 'Sidekix';

export const notifFriendRequestBody = (username: string) =>
  `@${username} wants to be friends`;

export const notifFriendAcceptedBody = (username: string) =>
  `@${username} accepted your friend request`;
