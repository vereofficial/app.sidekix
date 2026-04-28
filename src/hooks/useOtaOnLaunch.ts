import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * In release native builds, checks EAS Update once after the shell is ready; if a newer
 * bundle exists, downloads it and reloads so users pick up JS/asset changes without a store release.
 * No-ops on web, in Metro (__DEV__), or when updates are disabled.
 */
export function useOtaOnLaunch(shellReady: boolean) {
  useEffect(() => {
    if (!shellReady || Platform.OS === 'web' || __DEV__) return;
    let cancelled = false;
    void (async () => {
      try {
        if (!Updates.isEnabled) return;
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (cancelled || !isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        await Updates.reloadAsync();
      } catch {
        /* network / misconfiguration — keep running embedded bundle */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shellReady]);
}
