#!/usr/bin/env node
/**
 * Light Supabase ping to prevent Free-tier inactivity pause (7 days with no API/DB activity).
 *
 * Hits PostgREST with the anon key — same auth the app uses for `app_release_config`.
 * Safe to run from GitHub Actions (no service role required).
 *
 * Env (or .env in repo root):
 *   EXPO_PUBLIC_SUPABASE_URL or SUPABASE_URL — https://xxx.supabase.co
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY — anon/public API key
 *
 * Usage:
 *   npm run supabase:keepalive
 *
 * GitHub Actions: see .github/workflows/supabase-keepalive.yml
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

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Usage: npm run supabase:keepalive`);
  console.log(`Env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY`);
  process.exit(0);
}

const base =
  process.env.SUPABASE_URL?.replace(/\/$/, '') ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const anonKey =
  process.env.SUPABASE_ANON_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!base) {
  console.error(
    'Missing SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL. Add your Supabase project URL to .env.',
  );
  process.exit(1);
}
if (!anonKey) {
  console.error(
    'Missing SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY. Use the anon key from Supabase → Settings → API.',
  );
  process.exit(1);
}

// Public read table (see migration 033_app_release_config.sql) — one row, minimal cost.
const url = `${base}/rest/v1/app_release_config?select=id&limit=1`;

const started = Date.now();
const res = await fetch(url, {
  method: 'GET',
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: 'application/json',
  },
});

const text = await res.text();
const elapsedMs = Date.now() - started;

if (!res.ok) {
  console.error(`Keepalive failed: HTTP ${res.status} (${elapsedMs}ms)`);
  console.error(text.slice(0, 500));
  process.exit(1);
}

let rows;
try {
  rows = JSON.parse(text);
} catch {
  console.error(`Keepalive failed: invalid JSON (${elapsedMs}ms)`);
  console.error(text.slice(0, 500));
  process.exit(1);
}

if (!Array.isArray(rows)) {
  console.error(`Keepalive failed: unexpected response (${elapsedMs}ms)`);
  console.error(text.slice(0, 500));
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    project: base,
    rows: rows.length,
    elapsedMs,
    at: new Date().toISOString(),
  }),
);
