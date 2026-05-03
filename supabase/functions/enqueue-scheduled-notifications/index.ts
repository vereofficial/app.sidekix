/// <reference path="../deno-edge.d.ts" />
/**
 * Scheduled job: enqueue `notification_outbox` rows for sidequest trending + gentle re-engagement.
 * Pair with `deliver-notification-outbox` on a cron (e.g. hourly).
 *
 * Secrets:
 *   SCHEDULED_NOTIFS_SECRET=<long random string>
 *
 * Invoke:
 *   curl -X POST "https://<PROJECT>.supabase.co/functions/v1/enqueue-scheduled-notifications" \
 *     -H "Authorization: Bearer <SCHEDULED_NOTIFS_SECRET>"
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-scheduled-secret',
};

type TrendRow = { sidequest_id: string; creator_id: string; completions: string | number };
type UserRow = { user_id: string; last_post_at?: string | null };
type SavedRow = { user_id: string; saved_count: string | number; last_post_at?: string | null };

function ymdUtc(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const secret = Deno.env.get('SCHEDULED_NOTIFS_SECRET') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  const headerSecret = req.headers.get('x-scheduled-secret') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';

  if (!secret || (bearer !== secret && headerSecret !== secret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRole) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const day = ymdUtc();

  const { data: trending, error: trErr } = await admin.rpc('peek_sidequest_trending_notifications');
  if (trErr) {
    return new Response(JSON.stringify({ error: trErr.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let trendingInserted = 0;
  for (const raw of (trending ?? []) as TrendRow[]) {
    const sidequest_id = raw.sidequest_id;
    const creator_id = raw.creator_id;
    if (!sidequest_id || !creator_id) continue;

    const { error } = await admin.from('notification_outbox').insert({
      user_id: creator_id,
      kind: 'sidequest_trending',
      dedupe_key: `trend:${sidequest_id}:${day}`,
      payload: {
        title: 'Sidekix',
        body: 'your sidequest is taking off 🔥',
        data: {
          kind: 'sidequest_trending',
          sidequest_id,
        },
      },
    });
    if (!error) trendingInserted += 1;
  }

  const { data: gentleUsers, error: gErr } = await admin.rpc('peek_re_engagement_gentle_users');
  if (gErr) {
    return new Response(JSON.stringify({ error: gErr.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let gentleInserted = 0;
  for (const raw of (gentleUsers ?? []) as UserRow[]) {
    const user_id = raw.user_id;
    if (!user_id) continue;

    const { data: pref } = await admin
      .from('notification_preferences')
      .select('social')
      .eq('user_id', user_id)
      .maybeSingle();
    const social = (pref as { social?: boolean } | null)?.social;
    if (social === false) continue;

    const { error } = await admin.from('notification_outbox').insert({
      user_id,
      kind: 're_engagement',
      dedupe_key: `re_gentle:${user_id}:${day}`,
      payload: {
        title: 'Sidekix',
        body: "haven't seen you in a bit. anything good happen lately?",
        data: {
          kind: 're_engagement',
          variant: 'gentle',
        },
      },
    });
    if (!error) gentleInserted += 1;
  }

  const { data: savedUsers, error: sErr } = await admin.rpc('peek_re_engagement_saved_users');
  if (sErr) {
    return new Response(JSON.stringify({ error: sErr.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let savedInserted = 0;
  for (const raw of (savedUsers ?? []) as SavedRow[]) {
    const user_id = raw.user_id;
    const saved_count = Number(raw.saved_count);
    if (!user_id || !Number.isFinite(saved_count) || saved_count < 1) continue;

    const { data: pref } = await admin
      .from('notification_preferences')
      .select('social')
      .eq('user_id', user_id)
      .maybeSingle();
    const social = (pref as { social?: boolean } | null)?.social;
    if (social === false) continue;

    const { error } = await admin.from('notification_outbox').insert({
      user_id,
      kind: 're_engagement',
      dedupe_key: `re_saved:${user_id}:${day}`,
      payload: {
        title: 'Sidekix',
        body: `you've got ${saved_count} saved sidequests. done any of them?`,
        data: {
          kind: 're_engagement',
          variant: 'saved_prompt',
          saved_count: String(saved_count),
        },
      },
    });
    if (!error) savedInserted += 1;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      day,
      trending_candidates: (trending ?? []).length,
      trending_inserted: trendingInserted,
      gentle_candidates: (gentleUsers ?? []).length,
      gentle_inserted: gentleInserted,
      saved_candidates: (savedUsers ?? []).length,
      saved_inserted: savedInserted,
    }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
  );
});
