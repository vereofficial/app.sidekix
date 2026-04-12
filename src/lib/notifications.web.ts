/** Web / SSR: no local notifications. */

export async function initNotificationHandler() {}

export function attachSidequestNotificationHandlers(): () => void {
  return () => {};
}

export async function consumeInitialSidequestNotificationIfAny() {}

export async function scheduleSidequestDropReminder() {}

export async function notifyReactionMilestone(_total: number, _milestone: number) {}

export async function registerExpoPushTokenForUser(_userId: string) {}

export function attachFriendRequestRealtime(_userId: string): () => void {
  return () => {};
}
