import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

function keyFor(userId: string): string {
  return `sidekix_onboarding_done_v1:${userId}`;
}

/**
 * Onboarding is complete if marked locally, or if the user already has any sidequest as creator
 * (e.g. finished "before you start" on another device — avoids sending them through onboarding on every fresh install).
 */
export async function hasCompletedOnboarding(
  userId: string | null | undefined,
  sb?: SupabaseClient | null,
): Promise<boolean> {
  if (!userId) return false;
  try {
    if ((await AsyncStorage.getItem(keyFor(userId))) === '1') return true;
  } catch {
    // continue — try server
  }

  if (!sb) return false;

  try {
    const { count, error } = await sb
      .from('sidequests')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', userId);
    if (error || count == null || count < 1) return false;
    await AsyncStorage.setItem(keyFor(userId), '1');
    return true;
  } catch {
    return false;
  }
}

export async function markOnboardingCompleted(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(keyFor(userId), '1');
  } catch {
    // ignore
  }
}
