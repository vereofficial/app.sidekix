import { Alert, Linking } from 'react-native';

const DM_URL = 'https://ig.me/m/sidekix.app';
const PROFILE_URL = 'instagram://user?username=sidekix.app';

/** Opens Instagram DM to @sidekix.app (falls back to profile or alert). */
export async function openSidekixInstagramDm(): Promise<void> {
  try {
    await Linking.openURL(DM_URL);
  } catch {
    try {
      const canOpenProfile = await Linking.canOpenURL(PROFILE_URL);
      if (canOpenProfile) {
        await Linking.openURL(PROFILE_URL);
        return;
      }
    } catch {
      /* fall through */
    }
    Alert.alert('Instagram', 'Could not open Instagram. DM @sidekix.app with proof if you place first.');
  }
}
