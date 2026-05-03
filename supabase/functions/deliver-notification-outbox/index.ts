/// <reference path="../deno-edge.d.ts" />
/**
 * Drain `notification_outbox`: deliver Expo push notifications with deep-link `data`,
 * then set `sent_at`.
 *
 * Secrets (Dashboard → Edge Functions):
 *   DELIVER_OUTBOX_SECRET=<long random string>
 *
 * Invoke (cron every minute or on-demand):
 *   curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/deliver-notification-outbox" \
 *     -H "Authorization: Bearer <DELIVER_OUTBOX_SECRET>"
 *
 * Rows created by SQL triggers include full `{ title, body, data }` in `payload`.
 * Legacy rows use `kind` + minimal `payload` — resolved below.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_PER_REQUEST = 100;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-deliver-secret',
};

type OutboxRow = {
  id: string;
  user_id: string;
  kind: string;
  payload: Record<string, unknown>;
};

type ExpoPushTicket = { status?: string; message?: string; details?: unknown };

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function reactionMilestoneBody(m: number): string {
  const map: Record<number, string> = {
    10: '10 people loved your adventure🔥',
    25: "your adventure hit 25 reactions. this one's getting around 👀",
    50: 'you got 50 reactions to your post! this adventure hit.',
    100: "100 people reacted to your adventure. that's impressive.",
    250: '250 reactions! your adventure is one of the best on the app',
    500: '500 reactions to your post! this is the one.',
  };
  return map[m] ?? `your post hit ${m} reactions.`;
}

async function resolveExpoContent(
  admin: SupabaseClient,
  row: OutboxRow,
): Promise<{ title: string; body: string; data: Record<string, string> } | null> {
  const p = row.payload ?? {};
  const title = p.title;
  const body = p.body;
  const dataRaw = p.data;

  if (
    typeof title === 'string' &&
    typeof body === 'string' &&
    body.trim().length > 0 &&
    dataRaw &&
    typeof dataRaw === 'object' &&
    !Array.isArray(dataRaw)
  ) {
    const data = dataRaw as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined || v === null) continue;
      out[k] = typeof v === 'string' ? v : String(v);
    }
    return { title: title.trim() || 'Sidekix', body: body.trim(), data: out };
  }

  switch (row.kind) {
    case 'friend_request': {
      const requester_id = p.requester_id as string | undefined;
      const request_id = p.request_id as string | undefined;
      if (!requester_id || !request_id) return null;
      const { data: prof } = await admin.from('profiles').select('username').eq('id', requester_id).maybeSingle();
      const u = (prof as { username?: string } | null)?.username ?? 'someone';
      return {
        title: 'Sidekix',
        body: `@${u} wants to be friends`,
        data: { kind: 'friend_request', request_id: request_id },
      };
    }
    case 'friend_accept': {
      const addressee_id = p.addressee_id as string | undefined;
      const request_id = p.request_id as string | undefined;
      if (!addressee_id || !request_id) return null;
      const { data: prof } = await admin.from('profiles').select('username').eq('id', addressee_id).maybeSingle();
      const u = (prof as { username?: string } | null)?.username ?? 'someone';
      return {
        title: 'Sidekix',
        body: `@${u} accepted your friend request`,
        data: { kind: 'friend_accept', request_id: request_id },
      };
    }
    case 'upvote_milestone': {
      const post_id = p.post_id as string | undefined;
      const milestone = Number(p.milestone);
      if (!post_id || !Number.isFinite(milestone)) return null;
      return {
        title: 'Sidekix',
        body: reactionMilestoneBody(milestone),
        data: {
          kind: 'adventure_reaction_milestone',
          post_id,
          milestone: String(milestone),
        },
      };
    }
    default:
      return null;
  }
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

  const secret = Deno.env.get('DELIVER_OUTBOX_SECRET') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  const headerSecret = req.headers.get('x-deliver-secret') ?? '';
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

  const { data: rows, error: qErr } = await admin
    .from('notification_outbox')
    .select('id, user_id, kind, payload')
    .is('sent_at', null)
    .order('created_at', { ascending: true })
    .limit(150);

  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const list = (rows ?? []) as OutboxRow[];
  if (list.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0, pushed: 0 }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  type Msg = { to: string; title: string; body: string; data: Record<string, string> };
  const messages: Msg[] = [];
  const markIds: string[] = [];

  for (const row of list) {
    const content = await resolveExpoContent(admin, row);
    if (!content) {
      markIds.push(row.id);
      continue;
    }

    const { data: tokRows } = await admin
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', row.user_id);

    const tokens = new Set<string>();
    for (const t of tokRows ?? []) {
      const token = (t as { expo_push_token?: string }).expo_push_token;
      if (typeof token === 'string' && token.startsWith('ExponentPushToken[')) tokens.add(token);
    }

    if (tokens.size === 0) {
      markIds.push(row.id);
      continue;
    }

    for (const to of tokens) {
      messages.push({ to, ...content });
    }
    markIds.push(row.id);
  }

  let ticketsOk = 0;
  let ticketsErr = 0;

  for (const batch of chunk(messages, MAX_PER_REQUEST)) {
    const expoMessages = batch.map((m) => ({
      to: m.to,
      title: m.title,
      body: m.body,
      sound: 'default' as const,
      priority: 'high' as const,
      channelId: 'sidekix-default',
      data: m.data,
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(expoMessages),
    });

    const json = (await res.json()) as { data?: ExpoPushTicket[] };
    const arr = json.data;
    if (Array.isArray(arr)) {
      for (const t of arr) {
        if (t?.status === 'ok') ticketsOk += 1;
        else ticketsErr += 1;
      }
    } else {
      ticketsErr += batch.length;
    }
  }

  if (markIds.length > 0) {
    const uniqueIds = [...new Set(markIds)];
    await admin.from('notification_outbox').update({ sent_at: new Date().toISOString() }).in('id', uniqueIds);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      outbox_rows: list.length,
      expo_messages: messages.length,
      tickets_ok: ticketsOk,
      tickets_err: ticketsErr,
      marked_sent: markIds.length,
    }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
  );
});
