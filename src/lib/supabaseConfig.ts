import Constants from 'expo-constants';

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  /** Same as EXPO_PUBLIC_USE_R2_MEDIA when baked into the manifest. */
  useR2Media?: boolean;
  /** Same as EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL when baked into the manifest. */
  r2PublicMediaUrl?: string;
};

function readExtra(): Extra {
  const fromExpo = (Constants.expoConfig?.extra ?? {}) as Extra;
  const manifest2 = Constants.manifest2 as { extra?: { expoClient?: { extra?: Extra } } } | null;
  const fromM2 = manifest2?.extra?.expoClient?.extra ?? {};
  const legacy = (Constants.manifest as { extra?: Extra } | null)?.extra ?? {};
  const merged = { ...legacy, ...fromM2, ...fromExpo };
  // Fallback: EXPO_PUBLIC_* is inlined into the JS bundle at Metro bundle time (EAS Build / EAS Update).
  // Store builds that missed `extra` in the embedded manifest can still get keys from an OTA update
  // when those env vars are set for the update job.
  const supabaseUrl = merged.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = merged.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return { supabaseUrl, supabaseAnonKey };
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
