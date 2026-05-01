/// <reference path="../deno-edge.d.ts" />
/**
 * Returns a short-lived presigned PUT URL for Cloudflare R2 (S3-compatible).
 *
 * Secrets (Dashboard → Edge Functions → r2-media-presign → Secrets):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *
 * Client: set EXPO_PUBLIC_USE_R2_MEDIA=1 and EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL=https://your-public-host
 *
 * Deploy: npx supabase functions deploy r2-media-presign
 */
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const jwt = authHeader.slice('Bearer '.length).trim();
  const supabase = createClient(supabaseUrl, anonKey);
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(jwt);
  if (userErr || !user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const accountId = Deno.env.get('R2_ACCOUNT_ID') ?? '';
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID') ?? '';
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '';
  const bucket = Deno.env.get('R2_BUCKET_NAME') ?? '';
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return new Response(JSON.stringify({ error: 'R2 not configured on server' }), {
      status: 503,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let body: { objectKey?: string; contentType?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const objectKey = (body.objectKey ?? '').trim();
  const contentType = (body.contentType ?? 'application/octet-stream').trim() || 'application/octet-stream';

  if (!objectKey || objectKey.includes('..') || objectKey.includes('\\') || !objectKey.startsWith(`${user.id}/`)) {
    return new Response(JSON.stringify({ error: 'Invalid object key' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });
  const pathForDb = `r2/${objectKey}`;

  return new Response(JSON.stringify({ uploadUrl, objectKey, pathForDb }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
