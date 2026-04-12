import * as SecureStore from 'expo-secure-store';

/** Set when user dismisses the challenge drop; cleared on `SIGNED_IN` / `SIGNED_OUT` so the full animation runs again next login. */
const KEY = 'sidekix_challenge_drop_dismissed';
const FORCE_KEY = 'sidekix_challenge_drop_force_next';

export async function markChallengeDropDismissed(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, '1');
  } catch {
    /* ignore */
  }
}

export async function isChallengeDropDismissed(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    return v === '1';
  } catch {
    return false;
  }
}

/** Called on sign-in / sign-out so the drop plays again after the next authentication. */
export async function clearChallengeDropDismissed(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* ignore */
  }
}

/** After opening the 10am notification: show the drop animation on next Today evaluate. Consumed once. */
export async function requestChallengeDropForceReveal(): Promise<void> {
  try {
    await SecureStore.setItemAsync(FORCE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export async function consumeChallengeDropForceReveal(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(FORCE_KEY);
    if (v === '1') {
      await SecureStore.deleteItemAsync(FORCE_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
