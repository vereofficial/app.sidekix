import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const ANDROID_CHANNEL = 'sidekix-default';

/** Daily local reminder: sidequest is in the app at midnight; we nudge at 10:00 user timezone. */
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
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

const SIDEQUEST_10AM_ID = 'sidekix-sidequest-10am';

function dailyTenAmTrigger(): Notifications.DailyTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: 10,
    minute: 0,
    channelId: Platform.OS === 'android' ? ANDROID_CHANNEL : undefined,
  };
}

/** Schedules the repeating 10:00 local notification; replaces any previous “sidequest drop” schedule. */
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

  await Notifications.scheduleNotificationAsync({
    identifier: SIDEQUEST_10AM_ID,
    content: {
      title: 'Sidequest',
      body: 'Today’s prompt is ready — open Sidekix.',
    },
    trigger: dailyTenAmTrigger(),
  });
}

/** Fire a one-off local notification when crossing a reaction-count threshold (call from app after refresh). */
export async function notifyReactionMilestone(total: number, milestone: number) {
  if (Platform.OS === 'web') return;
  if (total < milestone) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Reactions',
      body: `Your post hit ${milestone} reactions.`,
    },
    trigger: null,
  });
}
