import { readAppExtra } from './supabaseConfig';

/**
 * When true, uploads use the `r2-media-presign` Edge Function + direct PUT to R2 (see supabase/functions).
 * Set EXPO_PUBLIC_USE_R2_MEDIA=1, EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL, and deploy the function with R2_* secrets.
 * Uses the same merged `extra` + manifest + `process.env` resolution as `getSupabasePublicConfig()`.
 */
export function useR2MediaUpload(): boolean {
  return readAppExtra().useR2Media;
}

/** Public base for objects stored as `r2/<key>` (e.g. https://pub-xxxxx.r2.dev). No trailing slash. */
export function getR2PublicMediaBase(): string | null {
  const raw = readAppExtra().r2PublicMediaUrl?.trim() ?? '';
  if (!raw) return null;
  const stripped = raw.replace(/\/$/, '');
  if (!/^https:\/\//i.test(stripped)) return null;
  const lower = stripped.toLowerCase();
  if (lower === 'undefined' || lower === 'null') return null;
  if (lower.includes('cloudflarestorage.com')) return null;
  return stripped;
}

export function isR2ObjectPath(path: string | null | undefined): boolean {
  return Boolean(path?.trim() && path.trim().toLowerCase().startsWith('r2/'));
}
