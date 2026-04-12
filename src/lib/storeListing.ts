import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Matches `ascAppId` in `eas.json` (submit.production.ios). */
const IOS_APP_STORE_NUMERIC_ID = '6742329686';

/**
 * iOS: opens the App Store page with the write-review action.
 * Android: Play Store listing (users leave reviews from the listing).
 */
export function getStoreListingReviewUrl(): string {
  if (Platform.OS === 'ios') {
    return `https://apps.apple.com/app/id${IOS_APP_STORE_NUMERIC_ID}?action=write-review`;
  }
  const pkg = Constants.expoConfig?.android?.package ?? 'com.vereofficial.vere';
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}`;
}
