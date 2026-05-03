/** Web / SSR: no local notifications. */

export async function initNotificationHandler() {}

export function attachSidequestNotificationHandlers(): () => void {
  return () => {};
}

export async function consumeInitialSidequestNotificationIfAny() {}

export async function scheduleSidequestDropReminder() {}

export async function notifyReactionMilestone(_total: number, _milestone: number, _postId?: string) {}

export async function registerExpoPushTokenForUser(_userId: string) {}

export function attachFriendRequestRealtime(_userId: string): () => void {
  return () => {};
}

export async function presentLeaderboardRankNotification(_userId: string, _place: 1 | 2 | 3): Promise<void> {}

export async function presentWeeklyWinNotification(
  _userId: string,
  _variant: 'prize' | 'first_no_pool' | 'first_need_reactions',
): Promise<void> {}

export async function presentWeeklyPlacementNotification(_userId: string, _rank: number): Promise<void> {}
