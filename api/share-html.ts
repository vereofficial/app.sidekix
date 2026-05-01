/**
 * Server-rendered share page + Open Graph for https://share.joinsidekix.com/p/[postId]
 * Routed via vercel.json — crawlers and humans get real HTML (no JS required for meta).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

type PostRow = {
  id: string;
  challenge_id: string;
  user_id: string;
  image_path: string | null;
  video_path: string | null;
  body: string | null;
  caption: string | null;
  is_anonymous: boolean;
};

type ChallengeRow = {
  id: string;
  title: string;
  emphasis: string;
};

type ProfileRow = {
  username: string;
};

function publicStorageUrl(supabaseUrl: string, path: string | null | undefined): string | null {
  const p = path?.trim();
  if (!p) return null;
  if (p.startsWith('r2/')) {
    const base = (process.env.EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL ?? process.env.R2_PUBLIC_MEDIA_URL ?? '').replace(/\/$/, '');
    if (!base) return null;
    const key = p.replace(/^r2\//, '');
    const encoded = key
      .split('/')
      .filter(Boolean)
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    return `${base}/${encoded}`;
  }
  const encoded = p
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/post-media/${encoded}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).setHeader('Allow', 'GET').end('Method Not Allowed');
    return;
  }

  const rawId = typeof req.query.postId === 'string' ? req.query.postId : Array.isArray(req.query.postId) ? req.query.postId[0] : '';
  const postId = (rawId ?? '').trim();
  if (!postId || !UUID_RE.test(postId)) {
    res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!DOCTYPE html><html><head><title>Invalid link</title></head><body><p>Invalid link.</p></body></html>');
    return;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    res.status(503).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      '<!DOCTYPE html><html><head><title>Unavailable</title></head><body><p>Share preview is not configured.</p></body></html>',
    );
    return;
  }

  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'share.joinsidekix.com';
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const origin = `${proto}://${host}`;
  const canonical = `${origin}/p/${postId}`;

  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: 'application/json',
  };

  const postRes = await fetch(`${supabaseUrl}/rest/v1/posts?id=eq.${postId}&select=*`, { headers });
  if (!postRes.ok) {
    res.status(502).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!DOCTYPE html><html><head><title>Error</title></head><body><p>Could not load post.</p></body></html>');
    return;
  }
  const posts = (await postRes.json()) as PostRow[];
  const post = posts[0];
  if (!post) {
    res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      '<!DOCTYPE html><html><head><title>Not found</title></head><body><p>This post could not be found.</p></body></html>',
    );
    return;
  }

  const chRes = await fetch(
    `${supabaseUrl}/rest/v1/challenges?id=eq.${post.challenge_id}&select=id,title,emphasis`,
    { headers },
  );
  const challenges = chRes.ok ? ((await chRes.json()) as ChallengeRow[]) : [];
  const challenge = challenges[0];

  let username: string | null = null;
  if (!post.is_anonymous) {
    const prRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${post.user_id}&select=username`, { headers });
    const profs = prRes.ok ? ((await prRes.json()) as ProfileRow[]) : [];
    username = profs[0]?.username ?? null;
  }

  const cap = (post.body ?? post.caption ?? '').trim();
  let headline = 'Sidekix';
  if (challenge) {
    const { before, after } = splitTitle(challenge.title, challenge.emphasis);
    headline = `${before}${challenge.emphasis}${after}`.replace(/\s+/g, ' ').trim();
  }
  const ogTitle = post.is_anonymous ? `A campus take · Sidekix` : username ? `@${username} · Sidekix` : `Campus take · Sidekix`;

  const ogDesc =
    cap.length > 0
      ? cap.length > 200
        ? `${cap.slice(0, 197)}…`
        : cap
      : headline;

  const imgPath = post.image_path?.trim() ? post.image_path : null;
  const vidPath = post.video_path?.trim() ? post.video_path : null;
  let ogImage = publicStorageUrl(supabaseUrl, imgPath);
  if (!ogImage && !vidPath) {
    ogImage = `${origin}/favicon.ico`;
  } else if (!ogImage && vidPath) {
    ogImage = `${origin}/favicon.ico`;
  }
  const ogImageUrl = ogImage ?? `${origin}/favicon.ico`;

  const visibleTitle = esc(ogTitle);
  const visibleDesc = esc(ogDesc);
  const challengeHtml = challenge
    ? (() => {
        const { before, after } = splitTitle(challenge.title, challenge.emphasis);
        return `<span>${esc(before)}</span><span style="color:#D4FF3F">${esc(challenge.emphasis)}</span><span>${esc(after)}</span>`;
      })()
    : 'Sidequest';

  const byline = post.is_anonymous ? 'anonymous' : username ? `@${esc(username)}` : 'campus';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${visibleTitle}</title>
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:title" content="${visibleTitle}" />
  <meta property="og:description" content="${visibleDesc}" />
  <meta property="og:image" content="${esc(ogImageUrl)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Sidekix" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${visibleTitle}" />
  <meta name="twitter:description" content="${visibleDesc}" />
  <meta name="twitter:image" content="${esc(ogImageUrl)}" />
  <meta name="description" content="${visibleDesc}" />
  <style>
    body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:#0a0a0a; color:#eee; }
    .wrap { max-width: 480px; margin: 0 auto; padding: 24px 18px 48px; }
    .brand { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color:#888; margin-bottom: 8px; }
    h1 { font-size: 22px; line-height: 1.25; margin: 0 0 8px; font-weight: 800; }
    .by { color:#aaa; font-size: 14px; margin-bottom: 16px; }
    .media { border-radius: 16px; overflow: hidden; border: 1px solid #2a2a2a; background:#111; aspect-ratio: 3/4; display:flex; align-items:center; justify-content:center; color:#666; font-size: 14px; }
    .media img { width:100%; height:100%; object-fit: cover; display:block; }
    .cap { margin-top: 16px; font-size: 15px; line-height: 1.45; color:#ddd; white-space: pre-wrap; }
    .cta { display: block; margin-top: 24px; text-align: center; padding: 16px 20px; border-radius: 999px; background: #5a7a00; color: #fff; font-weight: 800; text-decoration: none; font-size: 15px; }
    .hint { margin-top: 20px; font-size: 12px; color:#666; line-height: 1.4; text-align: center; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">sidekix</div>
    <h1>${challengeHtml}</h1>
    <div class="by">${byline}</div>
    <div class="media">
      ${
        imgPath
          ? `<img src="${esc(publicStorageUrl(supabaseUrl, imgPath)!)}" alt="" width="600" height="800" />`
          : vidPath
            ? '<span>Video — open in the app</span>'
            : cap
              ? `<span style="padding:20px;text-align:center">${esc(cap)}</span>`
              : '<span>Campus take</span>'
      }
    </div>
    ${cap && imgPath ? `<p class="cap">${esc(cap)}</p>` : ''}
    <a class="cta" href="https://joinsidekix.com">post yours →</a>
    <p class="hint">Preview works in Messages and elsewhere. Full feed lives in the Sidekix app.</p>
  </div>
</body>
</html>`;

  res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300').end(html);
}
