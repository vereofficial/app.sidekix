import Constants from 'expo-constants';

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  /** Same as EXPO_PUBLIC_USE_R2_MEDIA when baked into the manifest. */
  useR2Media?: boolean;
  /** Same as EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL when baked into the manifest. */
  r2PublicMediaUrl?: string;
};

/** `expo-updates` running manifest (EAS Update) — can include `extra` not mirrored on `Constants.expoConfig` yet. */
function extraFromExpoUpdatesManifest(): Partial<Extra> {
  try {
    // Avoid static import so web/tests without native module don't break resolution.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require('expo-updates') as typeof import('expo-updates');
    const m = Updates.manifest;
    if (!m || typeof m !== 'object' || Object.keys(m).length === 0) return {};
    const extraRoot = (m as { extra?: unknown }).extra;
    if (!extraRoot || typeof extraRoot !== 'object') return {};
    const er = extraRoot as { expoClient?: { extra?: Extra } };
    if (er.expoClient?.extra && typeof er.expoClient.extra === 'object') {
      return er.expoClient.extra as Partial<Extra>;
    }
    return extraRoot as Partial<Extra>;
  } catch {
    return {};
  }
}

function readAppExtraInternal(): Extra & { useR2Media: boolean } {
  const fromExpo = (Constants.expoConfig?.extra ?? {}) as Extra;
  const manifest2 = Constants.manifest2 as { extra?: { expoClient?: { extra?: Extra } } } | null;
  const fromM2 = manifest2?.extra?.expoClient?.extra ?? {};
  const legacy = (Constants.manifest as { extra?: Extra } | null)?.extra ?? {};
  const fromUpdates = extraFromExpoUpdatesManifest();
  const merged = { ...legacy, ...fromM2, ...fromExpo, ...fromUpdates };
  // Fallback: EXPO_PUBLIC_* is inlined into the JS bundle at Metro bundle time (EAS Build / EAS Update).
  // Store builds that missed `extra` in the embedded manifest can still get keys from an OTA update
  // when those env vars are set for the update job.
  const supabaseUrl = merged.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = merged.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const r2FromMerged = typeof merged.r2PublicMediaUrl === 'string' ? merged.r2PublicMediaUrl.trim() : '';
  const r2PublicMediaUrl =
    r2FromMerged ||
    (process.env.EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL ?? '').trim() ||
    (process.env.R2_PUBLIC_MEDIA_URL ?? '').trim();

  const useR2Media =
    merged.useR2Media === true ||
    process.env.EXPO_PUBLIC_USE_R2_MEDIA === '1' ||
    String(process.env.EXPO_PUBLIC_USE_R2_MEDIA ?? '').toLowerCase() === 'true';

  return {
    supabaseUrl,
    supabaseAnonKey,
    r2PublicMediaUrl: r2PublicMediaUrl || undefined,
    useR2Media,
  };
}

/** Merged Expo `extra` + `manifest` / `manifest2` + `process.env` (same resolution as Supabase URL). */
export function readAppExtra(): Extra & { useR2Media: boolean } {
  return readAppExtraInternal();
}

export function isSupabaseConfigured(): boolean {
  const { supabaseUrl, supabaseAnonKey } = readAppExtraInternal();
  return Boolean(
    supabaseUrl && supabaseAnonKey && supabaseUrl.length > 0 && supabaseAnonKey.length > 0,
  );
}

export function getSupabasePublicConfig(): { url: string; anonKey: string } {
  const { supabaseUrl, supabaseAnonKey } = readAppExtraInternal();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your shell or EAS env before starting the app.',
    );
  }
  return { url: supabaseUrl, anonKey: supabaseAnonKey };
}
