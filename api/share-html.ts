/**
 * Server-rendered share page + Open Graph for https://share.joinsidekix.com/p/[postId]
 *
 * Requires `SUPABASE_SERVICE_ROLE_KEY` on Vercel — resolves both `posts` (weekly challenges)
 * and `sidequest_posts` (community ideas) the same way, bypasses RLS, and signs `post-media`
 * URLs so video/image work when the bucket is private.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const IOS_APP_STORE_LISTING_URL = 'https://apps.apple.com/app/id6742329686';

/** Bumped when share SSR changes. Live site: inspect `<html>` for this attribute. */
const SHARE_SSR_REVISION = '20260607b';

/** Web fonts: DM Sans + DM Mono (matches `src/theme.ts` roles for UI). */
const SHARE_GOOGLE_FONTS =
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700&display=swap';

/** CSS using `darkColors` from `src/theme.ts` — no Syne; titles use DM Sans bold like in-app. */
function sharePageCss(): string {
  return `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-weight: 400;
      background: #0A0A0A;
      color: #F0EDE6;
      -webkit-font-smoothing: antialiased;
    }
    .shell { max-width: 440px; margin: 0 auto; padding: 28px 20px 56px; }
    .pill {
      display: inline-block;
      font-family: 'DM Mono', ui-monospace, monospace;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #D4FF3F;
      border: 1px solid rgba(212, 255, 63, 0.28);
      border-radius: 999px;
      padding: 7px 14px;
      margin-bottom: 18px;
      background: rgba(212, 255, 63, 0.12);
    }
    h1 {
      font-family: 'DM Sans', system-ui, sans-serif;
      font-weight: 700;
      font-size: 1.125rem;
      line-height: 1.35;
      letter-spacing: -0.02em;
      margin: 0 0 10px;
      color: #F0EDE6;
    }
    h1 .em { color: #D4FF3F; font-weight: 700; }
    .by {
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 400;
      color: #8A8680;
      margin-bottom: 22px;
    }
    .card {
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.12);
      background: #141414;
      box-shadow: 0 16px 40px rgba(0,0,0,0.4);
      aspect-ratio: 3 / 4;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .card img, .card video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .card .textfill {
      padding: 22px 20px;
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: 1rem;
      font-weight: 400;
      line-height: 1.45;
      color: #F0EDE6;
      text-align: left;
      align-self: stretch;
      overflow: auto;
    }
    .vid-fallback {
      text-align: center;
      padding: 28px 20px;
      color: #8A8680;
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.5;
    }
    .vid-fallback .play {
      width: 64px; height: 64px; margin: 0 auto 14px;
      border-radius: 50%;
      border: 2px solid rgba(212,255,63,0.45);
      color: #D4FF3F;
      font-size: 28px;
      line-height: 60px;
      font-weight: 700;
      font-family: 'DM Sans', sans-serif;
    }
    .cap {
      margin-top: 18px;
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: 15px;
      font-weight: 400;
      line-height: 1.5;
      color: #8A8680;
      white-space: pre-wrap;
    }
    .cta {
      display: block;
      margin-top: 28px;
      text-align: center;
      padding: 16px 22px;
      border-radius: 999px;
      background: #D4FF3F;
      color: #0a0a0a !important;
      font-family: 'DM Sans', system-ui, sans-serif;
      font-weight: 700;
      font-size: 15px;
      text-decoration: none;
      border: none;
      box-shadow: 0 8px 24px rgba(212, 255, 63, 0.18);
    }
    .err {
      font-family: 'DM Sans', system-ui, sans-serif;
      color: #5A5755;
      font-size: 15px;
      line-height: 1.55;
      margin-top: 8px;
    }
    .code {
      font-family: 'DM Mono', ui-monospace, monospace;
      font-size: 11px;
      color: #5A5755;
      margin-top: 16px;
      word-break: break-all;
    }
  `;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function splitTitle(title: string, emphasis: string): { before: string; after: string } {
  const i = title.indexOf(emphasis);
  if (i < 0) return { before: title, after: '' };
  return { before: title.slice(0, i), after: title.slice(i + emphasis.length) };
}

function r2PublicObjectUrl(trimmed: string): string | null {
  const base = (process.env.EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL ?? process.env.R2_PUBLIC_MEDIA_URL ?? '').replace(/\/$/, '');
  if (!base) return null;
  const key = trimmed.replace(/^r2\//, '');
  if (!key) return null;
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function htmlShell(docTitle: string, inner: string): string {
  return `<!DOCTYPE html>
<html lang="en" data-sidekix-share="${SHARE_SSR_REVISION}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0A0A0A" />
  <title>${esc(docTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${SHARE_GOOGLE_FONTS}" rel="stylesheet" />
  <style>${sharePageCss()}</style>
</head>
<body>
  <div class="shell">
    ${inner}
  </div>
</body>
</html>`;
}

function errorPage(title: string, message: string, hint?: string): string {
  return htmlShell(
    title,
    `
    <div class="pill">sidekix</div>
    <h1>${esc(title)}</h1>
    <p class="err">${esc(message)}</p>
    ${hint ? `<p class="code">${esc(hint)}</p>` : ''}
    <a class="cta" href="${esc(IOS_APP_STORE_LISTING_URL)}">get the app →</a>
  `,
  );
}

type LegacyPost = {
  id: string;
  challenge_id: string;
  user_id: string;
  image_path: string | null;
  video_path: string | null;
  body: string | null;
  caption: string | null;
  is_anonymous: boolean;
};

type SqPost = {
  id: string;
  sidequest_id: string;
  user_id: string;
  image_path: string | null;
  video_path: string | null;
  body: string | null;
  is_anonymous: boolean;
};

async function resolveStorageUrl(
  supabase: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  const p = path?.trim();
  if (!p) return null;
  if (p.startsWith('r2/')) return r2PublicObjectUrl(p);
  const { data, error } = await supabase.storage.from('post-media').createSignedUrl(p, 60 * 60 * 12);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).setHeader('Allow', 'GET').end('Method Not Allowed');
    return;
  }

  const rawId = typeof req.query.postId === 'string' ? req.query.postId : Array.isArray(req.query.postId) ? req.query.postId[0] : '';
  const postId = (rawId ?? '').trim();
  if (!postId || !UUID_RE.test(postId)) {
    res
      .status(400)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .end(errorPage('Invalid link', 'This URL is not a valid post id.', postId));
    return;
  }

  const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    res
      .status(503)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .end(
        errorPage(
          'Share unavailable',
          'This server is missing SUPABASE_SERVICE_ROLE_KEY (and URL). Add them in Vercel project env, redeploy, and open the link again.',
          'Required: EXPO_PUBLIC_SUPABASE_URL or SUPABASE_URL, plus SUPABASE_SERVICE_ROLE_KEY.',
        ),
      );
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: legacy, error: e1 }, { data: adventure, error: e2 }] = await Promise.all([
    supabase.from('posts').select('*').eq('id', postId).maybeSingle(),
    supabase.from('sidequest_posts').select('*').eq('id', postId).maybeSingle(),
  ]);

  if (e1 || e2) {
    res
      .status(502)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .end(errorPage('Could not load', e1?.message ?? e2?.message ?? 'Database error.'));
    return;
  }

  const lp = legacy as LegacyPost | null;
  const sp = adventure as SqPost | null;

  if (!lp && !sp) {
    res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').end(errorPage('Not found', 'No post exists for this link.'));
    return;
  }

  let imagePath: string | null = null;
  let videoPath: string | null = null;
  let caption: string;
  let isAnon: boolean;
  let userId: string;
  let titleHtml: string;
  let titlePlain: string;

  if (lp) {
    userId = lp.user_id;
    isAnon = lp.is_anonymous;
    imagePath = lp.image_path?.trim() || null;
    videoPath = lp.video_path?.trim() || null;
    caption = (lp.body ?? lp.caption ?? '').trim();
    const { data: ch } = await supabase.from('challenges').select('title, emphasis').eq('id', lp.challenge_id).maybeSingle();
    if (ch && typeof (ch as { title?: string }).title === 'string') {
      const row = ch as { title: string; emphasis: string };
      const { before, after } = splitTitle(row.title, row.emphasis ?? '');
      titleHtml = `${esc(before)}<span class="em">${esc(row.emphasis ?? '')}</span>${esc(after)}`;
      titlePlain = `${before}${row.emphasis ?? ''}${after}`.replace(/\s+/g, ' ').trim();
    } else {
      titleHtml = esc('Campus challenge');
      titlePlain = 'Campus challenge';
    }
  } else {
    const s = sp!;
    userId = s.user_id;
    isAnon = s.is_anonymous;
    imagePath = s.image_path?.trim() || null;
    videoPath = s.video_path?.trim() || null;
    caption = (s.body ?? '').trim();
    const { data: sq } = await supabase.from('sidequests').select('title').eq('id', s.sidequest_id).maybeSingle();
    const t = (sq as { title?: string } | null)?.title?.trim();
    titlePlain = t ?? 'Sidequest';
    titleHtml = esc(titlePlain);
  }

  let username: string | null = null;
  if (!isAnon) {
    const { data: prof } = await supabase.from('profiles').select('username').eq('id', userId).maybeSingle();
    username = (prof as { username?: string } | null)?.username?.trim() ?? null;
  }

  const byline = isAnon ? 'anonymous' : username ? `@${esc(username)}` : 'campus';

  const ogTitle = isAnon ? 'A campus take · Sidekix' : username ? `@${username} · Sidekix` : 'Campus take · Sidekix';
  const ogDesc =
    caption.length > 0 ? (caption.length > 200 ? `${caption.slice(0, 197)}…` : caption) : titlePlain || 'Sidekix';

  const [imageUrl, videoUrl] = await Promise.all([resolveStorageUrl(supabase, imagePath), resolveStorageUrl(supabase, videoPath)]);

  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'share.joinsidekix.com';
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const origin = `${proto}://${host}`;
  const canonical = `${origin}/p/${postId}`;

  let ogImage = imageUrl;
  if (!ogImage && !videoPath) ogImage = `${origin}/favicon.ico`;
  else if (!ogImage) ogImage = `${origin}/favicon.ico`;

  const showCapBelow = caption.length > 0 && (Boolean(imageUrl) || Boolean(videoUrl));

  let mediaInner: string;
  if (imageUrl) {
    mediaInner = `<img src="${esc(imageUrl)}" alt="" width="720" height="960" />`;
  } else if (videoUrl) {
    mediaInner = `<video src="${esc(videoUrl)}" controls playsinline preload="metadata" poster=""></video>`;
  } else if (videoPath && !videoUrl) {
    const r2 = videoPath.startsWith('r2/');
    const msg = r2
      ? 'This clip uses app-only storage. Open the post in Sidekix to watch.'
      : 'Preview link could not be generated. Open the post in Sidekix to watch.';
    mediaInner = `<div class="vid-fallback"><div class="play">▶</div>${esc(msg)}</div>`;
  } else if (caption) {
    mediaInner = `<div class="textfill">${esc(caption)}</div>`;
  } else {
    mediaInner = `<div class="vid-fallback">No preview for this post.</div>`;
  }

  const body = `
    <div class="pill">sidekix · share</div>
    <h1>${titleHtml}</h1>
    <div class="by">${byline}</div>
    <div class="card">${mediaInner}</div>
    ${showCapBelow ? `<p class="cap">${esc(caption)}</p>` : ''}
    <a class="cta" href="${esc(IOS_APP_STORE_LISTING_URL)}">post yours in Sidekix →</a>
  `;

  const page = `<!DOCTYPE html>
<html lang="en" data-sidekix-share="${SHARE_SSR_REVISION}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0A0A0A" />
  <title>${esc(ogTitle)}</title>
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:title" content="${esc(ogTitle)}" />
  <meta property="og:description" content="${esc(ogDesc)}" />
  <meta property="og:image" content="${esc(ogImage ?? `${origin}/favicon.ico`)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Sidekix" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(ogDesc)}" />
  <meta name="twitter:image" content="${esc(ogImage ?? `${origin}/favicon.ico`)}" />
  <meta name="description" content="${esc(ogDesc)}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${SHARE_GOOGLE_FONTS}" rel="stylesheet" />
  <style>${sharePageCss()}</style>
</head>
<body>
  <div class="shell">
    ${body}
  </div>
</body>
</html>`;

  res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600').end(page);
}
