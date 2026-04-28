import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { getSupabasePublicConfig, isSupabaseConfigured } from './supabaseConfig';

let client: SupabaseClient | null = null;
let appStateSub: { remove: () => void } | null = null;

function handleAppStateChange(nextState: AppStateStatus) {
  if (!client) return;
  if (nextState === 'active') client.auth.startAutoRefresh();
  else client.auth.stopAutoRefresh();
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }
  if (!client) {
    const { url, anonKey } = getSupabasePublicConfig();
    client = createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        /** Implicit grant: tokens in redirect fragment — avoids iOS PKCE “unable to exchange external code” with custom schemes. */
        flowType: 'implicit',
      },
    });

    if (Platform.OS !== 'web' && !appStateSub) {
      client.auth.startAutoRefresh();
      appStateSub = AppState.addEventListener('change', handleAppStateChange);
    }
  }
  return client;
}

export function tryGetSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return getSupabase();
}
