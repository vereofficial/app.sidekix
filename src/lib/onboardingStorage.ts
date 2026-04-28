import AsyncStorage from '@react-native-async-storage/async-storage';

function keyFor(userId: string): string {
  return `sidekix_onboarding_done_v1:${userId}`;
}

export async function hasCompletedOnboarding(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    return (await AsyncStorage.getItem(keyFor(userId))) === '1';
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
