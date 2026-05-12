/**
 * Vercel Edge Middleware runs before static files. Without this, `/p/:id` is served by the Expo web
 * bundle (`app/p/[id].tsx`), which queries Supabase with the **anon** key in the browser — RLS often
 * returns no row → “This post could not be found.” The `vercel.json` rewrite never runs because a
 * matching static route exists first. We proxy here to `api/share-html`, where
 * `SUPABASE_SERVICE_ROLE_KEY` can resolve the post.
 */
const POST_SHARE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const config = {
  matcher: ['/p/:path*'],
};

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rest = url.pathname.slice('/p/'.length).split('/').filter(Boolean);
  const id = decodeURIComponent(rest[0] ?? '');
  if (!id || !POST_SHARE_UUID.test(id)) {
    return new Response(
      '<!DOCTYPE html><html><head><title>Invalid link</title></head><body><p>Invalid link.</p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
  const target = new URL('/api/share-html', url.origin);
  target.searchParams.set('postId', id);
  return fetch(target.toString(), { method: request.method, headers: request.headers });
}
