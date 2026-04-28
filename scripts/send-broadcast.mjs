#!/usr/bin/env node
/**
 * POST to Supabase Edge Function `broadcast-expo-push` (Expo push to all registered tokens).
 *
 * Prereqs:
 *   - Deploy: npx supabase functions deploy broadcast-expo-push
 *   - Supabase Dashboard → Edge Functions → Secrets: BROADCAST_PUSH_SECRET
 *
 * Env (or .env in repo root):
 *   BROADCAST_PUSH_SECRET   — required; same value as the Edge Function secret
 *   EXPO_PUBLIC_SUPABASE_URL or SUPABASE_URL — project URL (https://xxx.supabase.co)
 *
 * Usage:
 *   npm run broadcast:push
 *   npm run broadcast:push -- --body-file ./message.txt
 *   Set BROADCAST_TITLE / BROADCAST_BODY in .env (avoids PowerShell quoting with emoji/’)
 *
 * 404 → deploy: npx supabase login && npx supabase link --project-ref REF
 *         npm run supabase:functions:deploy:broadcast
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const envPath = resolve(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadDotEnv();

const DEFAULT_TITLE = 'Sidekix';
const DEFAULT_BODY =
  "hey! 👋 there's a small bug blocking photo uploads right now. fix is on the way! we're running today's challenge back tomorrow so you don't miss it 📸";

function parseArgs(argv) {
  let title = process.env.BROADCAST_TITLE?.trim() || DEFAULT_TITLE;
  let body = process.env.BROADCAST_BODY?.trim() || DEFAULT_BODY;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      console.log(`Usage: npm run broadcast:push`);
      console.log(`       npm run broadcast:push -- --title Sidekix --body-file ./msg.txt`);
      console.log(`Env: BROADCAST_TITLE, BROADCAST_BODY (set in .env; avoids PowerShell quoting)`);
      process.exit(0);
    }
    if (a === '--title' && argv[i + 1]) {
      title = argv[++i];
    }
    if (a === '--body' && argv[i + 1]) {
      body = argv[++i];
    }
    if (a === '--body-file' && argv[i + 1]) {
      const p = resolve(process.cwd(), argv[++i]);
      if (!existsSync(p)) {
        console.error('File not found:', p);
        process.exit(1);
      }
      body = readFileSync(p, 'utf8').trim();
    }
  }
  return { title, body };
}

const secret = process.env.BROADCAST_PUSH_SECRET?.trim();
const base =
  process.env.SUPABASE_URL?.replace(/\/$/, '') ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');

const { title, body } = parseArgs(process.argv.slice(2));

if (!secret) {
  console.error(
    'Missing BROADCAST_PUSH_SECRET. Add it to .env (see .env.example) or export it in the shell.',
  );
  process.exit(1);
}
if (!base) {
  console.error(
    'Missing SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL. Add your Supabase project URL to .env.',
  );
  process.exit(1);
}

const url = `${base}/functions/v1/broadcast-expo-push`;

const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json; charset=utf-8',
  },
  body: JSON.stringify({ title, body }),
});

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = text;
}

if (!res.ok) {
  console.error('Request failed:', res.status, json);
  if (res.status === 404) {
    console.error(
      '\nEdge Function not deployed or wrong project URL. Deploy with:\n' +
        '  npx supabase login\n' +
        '  npx supabase link --project-ref YOUR_PROJECT_REF\n' +
        '  npm run supabase:functions:deploy:broadcast\n',
    );
  }
  process.exit(1);
}

console.log(JSON.stringify(json, null, 2));
