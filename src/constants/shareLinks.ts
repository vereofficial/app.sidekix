/**
 * Public web origin for OG / iMessage link previews (must serve `/p/[postId]` with meta tags).
 * Change here only if the marketing domain changes.
 */
export const PUBLIC_SHARE_ORIGIN = 'https://share.joinsidekix.com';

/** Marketing / download landing (e.g. “post yours” on shared post pages). */
export const MARKETING_SITE_URL = 'https://joinsidekix.com';

export function postShareUrl(postId: string): string {
  const id = postId.trim();
  return `${PUBLIC_SHARE_ORIGIN}/p/${encodeURIComponent(id)}`;
}
