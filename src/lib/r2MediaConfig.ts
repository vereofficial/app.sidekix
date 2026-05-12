import Constants from 'expo-constants';

/**
 * When true, uploads use the `r2-media-presign` Edge Function + direct PUT to R2 (see supabase/functions).
 * Set EXPO_PUBLIC_USE_R2_MEDIA=1 and deploy the function with R2_* secrets.
 */
export function useR2MediaUpload(): boolean {
  const extra = (Constants.expoConfig?.extra ?? {}) as { useR2Media?: boolean };
  if (extra.useR2Media === true) return true;
  return process.env.EXPO_PUBLIC_USE_R2_MEDIA === '1' || process.env.EXPO_PUBLIC_USE_R2_MEDIA === 'true';
}

/** Public base for objects stored as `r2/<key>` (e.g. https://media.example.com or R2 dev URL). No trailing slash. */
export function getR2PublicMediaBase(): string | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as { r2PublicMediaUrl?: string };
  const fromExtra = typeof extra.r2PublicMediaUrl === 'string' ? extra.r2PublicMediaUrl.trim() : '';
  const fromEnv = (process.env.EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL ?? '').trim();
  const raw = fromExtra || fromEnv;
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

export function isR2ObjectPath(path: string | null | undefined): boolean {
  return Boolean(path?.trim().startsWith('r2/'));
}
