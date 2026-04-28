import { tryGetSupabase } from './supabase';

/**
 * Public URL for a `post-media` object (works when the bucket is public).
 */
export function getPublicPostMediaUrl(path: string | null | undefined): string | null {
  const trimmed = path?.trim();
  if (!trimmed) return null;
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
