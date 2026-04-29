import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import {
  clearChallengeDropDismissed,
  requestChallengeDropForceReveal,
} from './challengeDropStorage';
import {
  NOTIF_FRIEND_TITLE,
  NOTIF_REACTION_TITLE,
  NOTIF_SIDEQUEST_BODY,
  NOTIF_SIDEQUEST_TITLE,
  notifFriendAcceptedBody,
  notifFriendRequestBody,
  notifLeaderboardRankBody,
  notifReactionMilestoneBody,
  notifWeeklyPlacementBody,
  notifWeeklyWinBody,
  notifWeeklyWinTitle,
} from './notificationMessages';
import { tryGetSupabase } from './supabase';
import { hapticLight, hapticSidequestDropAlarm } from './haptics';

const ANDROID_CHANNEL = 'sidekix-default';

/** @deprecated Legacy daily id — cancelled when scheduling Mon/Fri drops. */
export const SIDEQUEST_10AM_ID = 'sidekix-sidequest-10am';

export const SIDEQUEST_WEEKDAY_10AM_ID = 'sidekix-sidequest-weekday-10am';
export const SIDEQUEST_WEEKEND_10AM_ID = 'sidekix-sidequest-weekend-10am';

export const SIDEQUEST_NOTIFICATION_DATA = { kind: 'sidequest_drop' as const };

export type FriendNotificationKind = 'friend_request' | 'friend_accept';

export async function initNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: 'Sidekix',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 180, 80, 180],
    });
  }
}

/** Expo: weekday 1 = Sunday … Monday = 2, Friday = 6, Saturday = 7. */
function weeklyTenAmTrigger(weekday: number): Notifications.WeeklyTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday,
    hour: 10,
    minute: 0,
    channelId: Platform.OS === 'android' ? ANDROID_CHANNEL : undefined,
  };
}

async function openFeedTab() {
  try {
    router.replace('/(tabs)/home');
  } catch {
    /* router may not be ready */
  }
}

async function openTodayForSidequestDrop() {
  await clearChallengeDropDismissed();
  await requestChallengeDropForceReveal();
  try {
    router.replace('/today');
  } catch {
    /* router may not be ready */
  }
}

async function openLeadTab() {
  try {
    router.replace('/lead');
  } catch {
    /* router may not be ready */
  }
}

function isSidequestNotification(request: Notifications.NotificationRequest): boolean {
  const d = request.content.data as { kind?: string } | undefined;
  if (d?.kind === 'sidequest_drop') return true;
  const id = request.identifier;
  return (
    id === SIDEQUEST_10AM_ID || id === SIDEQUEST_WEEKDAY_10AM_ID || id === SIDEQUEST_WEEKEND_10AM_ID
  );
}

/**
 * Call once after initNotificationHandler. Returns cleanup.
 * Customize sidequest drop copy in `src/lib/notificationMessages.ts`.
 */
export function attachSidequestNotificationHandlers(): () => void {
  if (Platform.OS === 'web') return () => {};

  const received = Notifications.addNotificationReceivedListener((event) => {
    if (isSidequestNotification(event.request)) {
      void hapticSidequestDropAlarm();
    }
  });

  const response = Notifications.addNotificationResponseReceivedListener((res) => {
    const req = res.notification.request;
    if (isSidequestNotification(req)) {
      void openTodayForSidequestDrop();
      return;
    }
    const d = req.content.data as { kind?: string } | undefined;
    if (d?.kind === 'friend_request' || d?.kind === 'friend_accept') {
      void openFeedTab();
      return;
    }
    if (d?.kind === 'leaderboard_rank') {
      void openLeadTab();
      return;
    }
    if (d?.kind === 'weekly_win' || d?.kind === 'weekly_placement') {
      void openLeadTab();
      return;
    }
  });

  return () => {
    received.remove();
    response.remove();
  };
}

/** If the app was cold-opened from a notification, handle sidequest drop or friend social once. */
export async function consumeInitialSidequestNotificationIfAny(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const last = await Notifications.getLastNotificationResponseAsync();
    if (!last) return;
    const req = last.notification.request;
    if (isSidequestNotification(req)) {
      await openTodayForSidequestDrop();
      return;
    }
    const d = req.content.data as { kind?: string } | undefined;
    if (d?.kind === 'friend_request' || d?.kind === 'friend_accept') {
      await openFeedTab();
      return;
    }
    if (d?.kind === 'leaderboard_rank') {
      await openLeadTab();
      return;
    }
    if (d?.kind === 'weekly_win' || d?.kind === 'weekly_placement') {
      await openLeadTab();
      return;
    }
  } catch {
    /* ignore */
  }
}

/** Schedules the repeating 10:00 local notification; replaces any previous schedule. */
export async function scheduleSidequestDropReminder() {
  if (Platform.OS === 'web') return;

  const { status } = await Notifications.getPermissionsAsync();
  let final = status;
  if (final !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    final = req.status;
  }
  if (final !== 'granted') return;

  await Notifications.cancelScheduledNotificationAsync(SIDEQUEST_10AM_ID).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(SIDEQUEST_WEEKDAY_10AM_ID).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(SIDEQUEST_WEEKEND_10AM_ID).catch(() => {});

  const content = {
    title: NOTIF_SIDEQUEST_TITLE,
    body: NOTIF_SIDEQUEST_BODY,
    sound: Platform.OS === 'ios' ? 'default' : undefined,
    data: { ...SIDEQUEST_NOTIFICATION_DATA },
  };

  await Notifications.scheduleNotificationAsync({
    identifier: SIDEQUEST_WEEKDAY_10AM_ID,
    content,
    trigger: weeklyTenAmTrigger(2),
  });
  await Notifications.scheduleNotificationAsync({
    identifier: SIDEQUEST_WEEKEND_10AM_ID,
    content,
    trigger: weeklyTenAmTrigger(6),
  });
}

export async function notifyReactionMilestone(total: number, milestone: number) {
  if (Platform.OS === 'web') return;
  if (total < milestone) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: NOTIF_REACTION_TITLE,
      body: notifReactionMilestoneBody(milestone),
    },
    trigger: null,
  });
}

export async function presentLeaderboardRankNotification(userId: string, place: 1 | 2 | 3): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await socialNotificationsEnabled(userId))) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  void hapticLight();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: NOTIF_REACTION_TITLE,
      body: notifLeaderboardRankBody(place),
      sound: Platform.OS === 'ios' ? 'default' : undefined,
      data: { kind: 'leaderboard_rank', place },
      ...(Platform.OS === 'android' ? { android: { channelId: ANDROID_CHANNEL } } : {}),
    },
    trigger: null,
  });
}

export type WeeklyWinNotifVariant = 'prize' | 'first_no_pool' | 'first_need_reactions';

export async function presentWeeklyWinNotification(userId: string, variant: WeeklyWinNotifVariant): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await socialNotificationsEnabled(userId))) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  void hapticLight();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: notifWeeklyWinTitle,
      body: notifWeeklyWinBody(variant),
      sound: Platform.OS === 'ios' ? 'default' : undefined,
      data: { kind: 'weekly_win', variant },
      ...(Platform.OS === 'android' ? { android: { channelId: ANDROID_CHANNEL } } : {}),
    },
    trigger: null,
  });
}

export async function presentWeeklyPlacementNotification(userId: string, rank: number): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await socialNotificationsEnabled(userId))) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  void hapticLight();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: notifWeeklyWinTitle,
      body: notifWeeklyPlacementBody(rank),
      sound: Platform.OS === 'ios' ? 'default' : undefined,
      data: { kind: 'weekly_placement', rank },
      ...(Platform.OS === 'android' ? { android: { channelId: ANDROID_CHANNEL } } : {}),
    },
    trigger: null,
  });
}

async function socialNotificationsEnabled(userId: string): Promise<boolean> {
  const sb = tryGetSupabase();
  if (!sb) return true;
  const { data } = await sb.from('notification_preferences').select('social').eq('user_id', userId).maybeSingle();
  const row = data as { social?: boolean } | null;
  if (!row) return true;
  return row.social !== false;
}

async function presentLocalFriendNotification(
  kind: FriendNotificationKind,
  username: string,
  requestId: string,
): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const body =
    kind === 'friend_request' ? notifFriendRequestBody(username) : notifFriendAcceptedBody(username);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: NOTIF_FRIEND_TITLE,
      body,
      sound: Platform.OS === 'ios' ? 'default' : undefined,
      data: { kind, request_id: requestId },
      ...(Platform.OS === 'android' ? { android: { channelId: ANDROID_CHANNEL } } : {}),
    },
    trigger: null,
  });
}

/**
 * Registers the Expo push token for server-side delivery (notification_outbox worker / future Edge Function).
 */
export async function registerExpoPushTokenForUser(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) return;

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenRes.data;
    const sb = tryGetSupabase();
    if (!sb) return;

    await sb.from('user_push_tokens').upsert(
      {
        user_id: userId,
        expo_push_token: token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,expo_push_token' },
    );
  } catch {
    /* simulator / no projectId / network */
  }
}

/**
 * Subscribes to friend_requests so we show local notifications when someone requests you or accepts yours.
 * Requires migration `017_friend_requests_realtime.sql` (replica identity + supabase_realtime).
 */
export function attachFriendRequestRealtime(userId: string): () => void {
  if (Platform.OS === 'web') return () => {};
  if (userId.startsWith('dev-')) return () => {};

  const sb = tryGetSupabase();
  if (!sb) return () => {};

  const seen = new Set<string>();

  const channel = sb
    .channel(`friend-req:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: `addressee_id=eq.${userId}` },
      async (payload) => {
        const row = payload.new as { id: string; requester_id: string; status: string };
        if (row.status !== 'pending') return;
        const dedupe = `in:${row.id}`;
        if (seen.has(dedupe)) return;
        seen.add(dedupe);
        if (!(await socialNotificationsEnabled(userId))) return;

        const { data: prof } = await sb.from('profiles').select('username').eq('id', row.requester_id).maybeSingle();
        const username = (prof as { username?: string } | null)?.username ?? 'someone';
        void hapticLight();
        await presentLocalFriendNotification('friend_request', username, row.id);
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'friend_requests', filter: `requester_id=eq.${userId}` },
      async (payload) => {
        const oldRow = payload.old as { status?: string } | undefined;
        const row = payload.new as { id: string; addressee_id: string; status: string };
        if (oldRow?.status !== 'pending' || row.status !== 'accepted') return;
        const dedupe = `acc:${row.id}`;
        if (seen.has(dedupe)) return;
        seen.add(dedupe);
        if (!(await socialNotificationsEnabled(userId))) return;

        const { data: prof } = await sb.from('profiles').select('username').eq('id', row.addressee_id).maybeSingle();
        const username = (prof as { username?: string } | null)?.username ?? 'someone';
        void hapticLight();
        await presentLocalFriendNotification('friend_accept', username, row.id);
      },
    )
    .subscribe();

  return () => {
    void sb.removeChannel(channel);
  };
}
