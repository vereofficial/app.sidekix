import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabasePublicConfig, isSupabaseConfigured } from './supabaseConfig';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }
  if (!client) {
    const { url, anonKey } = getSupabasePublicConfig();
    client = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        /** Implicit grant: tokens in redirect fragment — avoids iOS PKCE “unable to exchange external code” with custom schemes. */
        flowType: 'implicit',
      },
    });
  }
  return client;
}

export function tryGetSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return getSupabase();
}
