import { getR2PublicMediaBase, isR2ObjectPath } from './r2MediaConfig';
import { tryGetSupabase } from './supabase';

let didWarnR2MissingPublicBase = false;

function r2PublicObjectUrl(trimmed: string): string | null {
  const base = getR2PublicMediaBase();
  if (!base) return null;
  const key = trimmed.replace(/^r2\//i, '');
  if (!key) return null;
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * Public URL for a `post-media` object (works when the bucket is public),
 * or for `r2/...` keys when EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL is set.
 */
export function getPublicPostMediaUrl(path: string | null | undefined): string | null {
  const trimmed = path?.trim();
  if (!trimmed) return null;
  if (isR2ObjectPath(trimmed)) {
    return r2PublicObjectUrl(trimmed);
  }
  const sb = tryGetSupabase();
  if (!sb) return null;
  return sb.storage.from('post-media').getPublicUrl(trimmed).data.publicUrl ?? null;
}

/**
 * Readable URL for `post-media`: prefers signed URL when a session exists (private buckets),
 * then falls back to the public URL.
 *
 * Supabase checklist if media still fails:
 * - Storage → `post-media` bucket exists; name matches code exactly.
 * - Bucket can be **public** (simplest): toggle public, or keep private and add Storage policies.
 * - Policies on `storage.objects` for bucket `post-media`: allow `select` for `authenticated`
 *   (and/or `anon` if you rely on public URLs only). Upload policies need `insert` for
 *   `authenticated` under `auth.uid()/...` paths.
 * - Table `posts.image_path` / `video_path` store the **object path** (e.g. `userId/file.jpg`), not a full URL.
 */
export async function getReadablePostMediaUrl(path: string): Promise<string | null> {
  const trimmed = path?.trim();
  if (!trimmed) return null;

  if (isR2ObjectPath(trimmed)) {
    const url = r2PublicObjectUrl(trimmed);
    if (!url && !didWarnR2MissingPublicBase) {
      didWarnR2MissingPublicBase = true;
      console.warn(
        '[Sidekix media] Database paths use R2 (r2/…) but no public read URL is configured. ' +
          'Set EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL to your bucket’s public HTTPS origin (see supabase/functions/README.md). ' +
          'For EAS builds, set it in app env / Expo dashboard and rebuild so app.config.js can embed extra.r2PublicMediaUrl.',
      );
    }
    return url;
  }

  const sb = tryGetSupabase();
  if (!sb) return null;

  const publicUrl = getPublicPostMediaUrl(trimmed);

  const {
    data: { session },
  } = await sb.auth.getSession();
  if (session) {
    /** Longer TTL avoids mid-session playback failures and URI churn in Video remounts. */
    const signed = await sb.storage.from('post-media').createSignedUrl(trimmed, 60 * 60 * 24);
    if (!signed.error && signed.data?.signedUrl) {
      return signed.data.signedUrl;
    }
  }

  return publicUrl;
}
