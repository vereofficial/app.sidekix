import * as SecureStore from 'expo-secure-store';

/** Set when user dismisses the challenge drop; cleared on `SIGNED_IN` / `SIGNED_OUT` so the full animation runs again next login. */
const KEY = 'sidekix_challenge_drop_dismissed';

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
