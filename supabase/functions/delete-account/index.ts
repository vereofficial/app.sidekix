/// <reference path="../deno-edge.d.ts" />
/**
 * Deletes the authenticated user via Auth Admin API.
 *
 * Deploy (Dashboard): Edge Functions → delete-account → paste → Deploy.
 *
 * Env (auto in Supabase): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
} from 'https://esm.sh/jose@5.9.6';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
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

  const jwt = authHeader.slice('Bearer '.length).trim();
  const expectedIssuer = `${supabaseUrl}/auth/v1`;
  const jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string | undefined;

  try {
    const decoded = decodeJwt(jwt);
    const audClaim = decoded.aud;
    const audience =
      typeof audClaim === 'string'
        ? audClaim
        : Array.isArray(audClaim) && typeof audClaim[0] === 'string'
          ? audClaim[0]
          : 'authenticated';

    const { payload } = await jwtVerify(jwt, jwks, {
      issuer: expectedIssuer,
      audience,
      clockTolerance: 30,
    });
    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new Error('Token has no sub');
    }
    userId = payload.sub;
  } catch (e) {
    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(jwt);
    if (userErr || !user) {
      const msg = e instanceof Error ? e.message : 'jwt verify failed';
      const detail = userErr?.message ? `${msg}; getUser: ${userErr.message}` : msg;
      return new Response(JSON.stringify({ error: 'Invalid session', detail }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    userId = user.id;
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Invalid session', detail: 'No user id' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    return new Response(JSON.stringify({ error: delErr.message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
