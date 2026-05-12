import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import {
  NOTIF_ENGAGEMENT_TITLE,
  NOTIF_REACTION_TITLE,
  notifAdventureReactionMilestoneBody,
  notifEngagementLocalBody,
} from './notificationMessages';
import { tryGetSupabase } from './supabase';

const ANDROID_CHANNEL = 'sidekix-default';

/** Legacy sidequest-drop identifiers — cancelled when scheduling engagement reminders. */
const LEGACY_SIDEQUEST_DROP_IDS = [
  'sidekix-sidequest-10am',
  'sidekix-sidequest-weekday-10am',
  'sidekix-sidequest-weekend-10am',
];

/** Expo weekday 1 = Sunday … Monday = 2 … Saturday = 7. Spread reminders across the week. */
const ENGAGEMENT_SLOTS: { id: string; weekday: number; hour: number; minute: number; bodyIndex: number }[] = [
  { id: 'sidekix-engage-local-0', weekday: 2, hour: 10, minute: 0, bodyIndex: 0 },
  { id: 'sidekix-engage-local-1', weekday: 4, hour: 14, minute: 30, bodyIndex: 1 },
  { id: 'sidekix-engage-local-2', weekday: 6, hour: 18, minute: 0, bodyIndex: 2 },
  { id: 'sidekix-engage-local-3', weekday: 1, hour: 11, minute: 0, bodyIndex: 3 },
  { id: 'sidekix-engage-local-4', weekday: 5, hour: 12, minute: 30, bodyIndex: 4 },
];

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

function weeklyTrigger(weekday: number, hour: number, minute: number): Notifications.WeeklyTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday,
    hour,
    minute,
    channelId: Platform.OS === 'android' ? ANDROID_CHANNEL : undefined,
  };
}

async function openFeedTab() {
  try {
    router.replace('/(tabs)/feed');
  } catch {
    /* router may not be ready */
  }
}

async function openSidequestDetail(sidequestId: string) {
  try {
    router.replace(`/sidequest/${sidequestId}`);
  } catch {
    /* router may not be ready */
  }
}

async function openSubmissionDetail(postId: string) {
  try {
    router.replace(`/submission/${postId}`);
  } catch {
    /* router may not be ready */
  }
}

async function openSavedQuests() {
  try {
    router.replace('/saved-quests');
  } catch {
    /* router may not be ready */
  }
}

type PushData = {
  kind?: string;
  variant?: string;
  sidequest_id?: string;
  post_id?: string;
  milestone?: number | string;
  saved_count?: number | string;
  /** Present when the post is a sidequest adventure (`sidequest_posts`), not legacy `posts`. */
  submission_source?: string;
};

/**
 * Deep links from push `content.data`. Extend server payloads to match these `kind` values.
 */
export async function routeNotificationData(data: PushData | undefined): Promise<void> {
  if (!data?.kind) return;
  const k = data.kind;

  if (k === 'sidequest_activity') {
    if (data.sidequest_id) await openSidequestDetail(data.sidequest_id);
    return;
  }
  if (k === 'sidequest_trending') {
    if (data.sidequest_id) await openSidequestDetail(data.sidequest_id);
    return;
  }
  if (k === 'idea_done_milestone') {
    if (data.sidequest_id) await openSidequestDetail(data.sidequest_id);
    return;
  }
  if (k === 'sidequest_approved') {
    if (data.sidequest_id) await openSidequestDetail(data.sidequest_id);
    else await openFeedTab();
    return;
  }
  if (k === 'adventure_reaction_milestone' || k === 'upvote_milestone') {
    if (String(data.submission_source ?? '') === 'sidequest' && data.sidequest_id) {
      await openSidequestDetail(String(data.sidequest_id));
      return;
    }
    const pid = data.post_id != null ? String(data.post_id) : '';
    if (pid) await openSubmissionDetail(pid);
    return;
  }
  if (k === 're_engagement') {
    if (String(data.variant ?? '') === 'saved_prompt') await openSavedQuests();
    else await openFeedTab();
    return;
  }
}

function isRoutableKind(d: PushData | undefined): boolean {
  if (!d?.kind) return false;
  return (
    d.kind === 'sidequest_activity' ||
    d.kind === 'sidequest_trending' ||
    d.kind === 'idea_done_milestone' ||
    d.kind === 'sidequest_approved' ||
    d.kind === 'adventure_reaction_milestone' ||
    d.kind === 'upvote_milestone' ||
    d.kind === 're_engagement'
  );
}

/**
 * Call once after initNotificationHandler. Returns cleanup.
 */
export function attachNotificationHandlers(): () => void {
  if (Platform.OS === 'web') return () => {};

  const response = Notifications.addNotificationResponseReceivedListener((res) => {
    const d = res.notification.request.content.data as PushData | undefined;
    if (isRoutableKind(d)) {
      void routeNotificationData(d);
    }
  });

  return () => {
    response.remove();
  };
}

/** @deprecated Use attachNotificationHandlers */
export const attachSidequestNotificationHandlers = attachNotificationHandlers;

/** If the app was cold-opened from a notification, deep-link once. */
export async function consumeInitialNotificationIfAny(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const last = await Notifications.getLastNotificationResponseAsync();
    if (!last) return;
    const d = last.notification.request.content.data as PushData | undefined;
    if (isRoutableKind(d)) {
      await routeNotificationData(d);
    }
  } catch {
    /* ignore */
  }
}

/** @deprecated Use consumeInitialNotificationIfAny */
export const consumeInitialSidequestNotificationIfAny = consumeInitialNotificationIfAny;

async function cancelLegacySidequestDropNotifications(): Promise<void> {
  for (const id of LEGACY_SIDEQUEST_DROP_IDS) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}

async function cancelEngagementSlots(): Promise<void> {
  for (const s of ENGAGEMENT_SLOTS) {
    await Notifications.cancelScheduledNotificationAsync(s.id).catch(() => {});
  }
}

/** Same rule as `enqueue-scheduled-notifications` gentle/saved re-engagement (`social !== false`). */
async function reEngagementNotificationsEnabled(userId: string): Promise<boolean> {
  const sb = tryGetSupabase();
  if (!sb) return true;
  const { data } = await sb.from('notification_preferences').select('social').eq('user_id', userId).maybeSingle();
  const row = data as { social?: boolean } | null;
  if (!row) return true;
  return row.social !== false;
}

/**
 * Weekly local engagement reminders (distinct weekdays/times). Cancels legacy sidequest-drop schedules.
 * Pass `null` to cancel all engagement slots (e.g. signed out).
 */
export async function scheduleLocalEngagementReminders(userId: string | null) {
  if (Platform.OS === 'web') return;

  await cancelLegacySidequestDropNotifications();

  const { status } = await Notifications.getPermissionsAsync();
  let final = status;
  if (final !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    final = req.status;
  }
  if (final !== 'granted') {
    await cancelEngagementSlots();
    return;
  }

  if (!userId) {
    await cancelEngagementSlots();
    return;
  }

  if (!(await reEngagementNotificationsEnabled(userId))) {
    await cancelEngagementSlots();
    return;
  }

  for (const slot of ENGAGEMENT_SLOTS) {
    await Notifications.cancelScheduledNotificationAsync(slot.id).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: slot.id,
      content: {
        title: NOTIF_ENGAGEMENT_TITLE,
        body: notifEngagementLocalBody(slot.bodyIndex),
        sound: Platform.OS === 'ios' ? 'default' : undefined,
        data: {
          kind: 're_engagement',
          variant: 'gentle',
          local_slot: String(slot.bodyIndex),
        } as PushData,
        ...(Platform.OS === 'android' ? { android: { channelId: ANDROID_CHANNEL } } : {}),
      },
      trigger: weeklyTrigger(slot.weekday, slot.hour, slot.minute),
    });
  }
}

export async function notifyReactionMilestone(total: number, milestone: number, postId?: string) {
  if (Platform.OS === 'web') return;
  if (total < milestone) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: NOTIF_REACTION_TITLE,
      body: notifAdventureReactionMilestoneBody(milestone),
      data: {
        kind: 'adventure_reaction_milestone',
        post_id: postId,
        milestone,
      } as PushData,
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

/** No-op: friend notifications were removed from the client; push may still be sent server-side. */
export function attachFriendRequestRealtime(_userId: string): () => void {
  return () => {};
}

/** @deprecated No longer schedules sidequest drop reminders. */
export async function scheduleSidequestDropReminder() {
  if (Platform.OS === 'web') return;
  await cancelLegacySidequestDropNotifications();
}
