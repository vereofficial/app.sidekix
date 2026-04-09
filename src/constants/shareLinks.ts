/**
 * Public web origin for share URLs. OG / iMessage previews are served by Vercel `api/share-html`
 * (see vercel.json rewrite for `/p/:postId`).
 */
export const PUBLIC_SHARE_ORIGIN = 'https://share.joinsidekix.com';

/** Marketing / download landing (e.g. “post yours” on shared post pages). */
export const MARKETING_SITE_URL = 'https://joinsidekix.com';

export function postShareUrl(postId: string): string {
  const id = postId.trim();
  return `${PUBLIC_SHARE_ORIGIN}/p/${encodeURIComponent(id)}`;
}
