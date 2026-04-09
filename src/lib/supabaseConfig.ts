import Constants from 'expo-constants';

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

function readExtra(): Extra {
  const e = Constants.expoConfig?.extra as Extra | undefined;
  return e ?? {};
}

export function isSupabaseConfigured(): boolean {
  const { supabaseUrl, supabaseAnonKey } = readExtra();
  return Boolean(
    supabaseUrl && supabaseAnonKey && supabaseUrl.length > 0 && supabaseAnonKey.length > 0,
  );
}

export function getSupabasePublicConfig(): { url: string; anonKey: string } {
  const { supabaseUrl, supabaseAnonKey } = readExtra();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your shell or EAS env before starting the app.',
    );
  }
  return { url: supabaseUrl, anonKey: supabaseAnonKey };
}
