import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/**
 * Redirect URL for Supabase OAuth. On native, use `scheme://auth/callback` (authority + path).
 * Bare `scheme://` or URLs that drop `//` can break PKCE / code parsing on iOS.
 */
export function getOAuthRedirectUrl(): string {
  if (Platform.OS === 'web') {
    return Linking.createURL('/auth/callback');
  }
  const scheme =
    typeof Constants.expoConfig?.scheme === 'string' && Constants.expoConfig.scheme.length > 0
      ? Constants.expoConfig.scheme
      : 'sidekix';
  return `${scheme}://auth/callback`;
}
