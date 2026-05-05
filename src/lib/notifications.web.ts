/** Web / SSR: no local notifications. */

export async function initNotificationHandler() {}

export function attachNotificationHandlers(): () => void {
  return () => {};
}

/** @deprecated Use attachNotificationHandlers */
export const attachSidequestNotificationHandlers = attachNotificationHandlers;

export async function consumeInitialNotificationIfAny() {}

/** @deprecated Use consumeInitialNotificationIfAny */
export const consumeInitialSidequestNotificationIfAny = consumeInitialNotificationIfAny;

export async function scheduleLocalEngagementReminders(_userId: string | null) {}

/** @deprecated No-op on web */
export async function scheduleSidequestDropReminder() {}

export async function notifyReactionMilestone(_total: number, _milestone: number, _postId?: string) {}

export async function registerExpoPushTokenForUser(_userId: string) {}

export function attachFriendRequestRealtime(_userId: string): () => void {
  return () => {};
}
