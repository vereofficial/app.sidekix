/// <reference path="../deno-edge.d.ts" />
/**
 * Broadcast a push notification to every registered Expo push token.
 *
 * Security: set secret in Supabase Dashboard → Edge Functions → Secrets:
 *   BROADCAST_PUSH_SECRET=<long random string>
 *
 * Invoke (after deploy):
 *   curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/broadcast-expo-push" \
 *     -H "Authorization: Bearer <BROADCAST_PUSH_SECRET>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"title":"Sidekix","body":"your message"}'
 *
 * Env (auto): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_PER_REQUEST = 100;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-broadcast-secret',
};

type ExpoPushTicket = { status?: string; message?: string; details?: unknown };

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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

  const secret = Deno.env.get('BROADCAST_PUSH_SECRET') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  const headerSecret = req.headers.get('x-broadcast-secret') ?? '';
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

  let body: { title?: string; body?: string };
  try {
    body = (await req.json()) as { title?: string; body?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const title = typeof body.title === 'string' && body.title.length > 0 ? body.title : 'Sidekix';
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) {
    return new Response(JSON.stringify({ error: 'body is required' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: rows, error: qErr } = await admin.from('user_push_tokens').select('expo_push_token');
  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const tokens = new Set<string>();
  for (const r of rows ?? []) {
    const t = (r as { expo_push_token?: string }).expo_push_token;
    if (typeof t === 'string' && t.startsWith('ExponentPushToken[')) tokens.add(t);
  }

  const list = [...tokens];
  if (list.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, message: 'No push tokens registered' }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let ticketsOk = 0;
  let ticketsErr = 0;
  const errors: string[] = [];

  for (const batch of chunk(list, MAX_PER_REQUEST)) {
    const messages = batch.map((to) => ({
      to,
      title,
      body: text,
      sound: 'default' as const,
      priority: 'high' as const,
      channelId: 'sidekix-default',
      data: { kind: 'broadcast' as const },
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const json = (await res.json()) as { data?: ExpoPushTicket[]; errors?: unknown };
    const data = json.data;
    if (Array.isArray(data)) {
      for (const t of data) {
        if (t?.status === 'ok') ticketsOk += 1;
        else {
          ticketsErr += 1;
          if (t?.message) errors.push(String(t.message));
        }
      }
    } else {
      ticketsErr += batch.length;
      errors.push(`batch http ${res.status}`);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      unique_tokens: list.length,
      tickets_ok: ticketsOk,
      tickets_err: ticketsErr,
      sample_errors: errors.slice(0, 5),
    }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
  );
});
