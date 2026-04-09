import * as Clipboard from 'expo-clipboard';
import { Alert, Platform, Share } from 'react-native';
import { postShareUrl } from '../constants/shareLinks';
import { hapticLight } from './haptics';

/** Opens the system share sheet with the public post URL. */
export async function sharePostLink(postId: string): Promise<void> {
  const url = postShareUrl(postId);
  try {
    hapticLight();
    await Share.share(Platform.OS === 'ios' ? { url } : { message: url, title: 'Sidekix' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not share';
    Alert.alert('Share', msg);
  }
}

export async function copyPostLink(postId: string): Promise<void> {
  const url = postShareUrl(postId);
  try {
    hapticLight();
    await Clipboard.setStringAsync(url);
    Alert.alert('Copied', 'Link copied to clipboard.');
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not copy';
    Alert.alert('Copy', msg);
  }
}
