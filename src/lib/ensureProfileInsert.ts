import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileRow } from '../types/database';
import { generateSidekixUsername } from './generateSidekixUsername';

/** Inserts a profile row when DB trigger / `ensure_my_profile` did not run (e.g. email users). */
export async function insertProfileWithGeneratedUsername(
  sb: SupabaseClient,
  uid: string,
): Promise<ProfileRow | null> {
  for (let i = 0; i < 14; i++) {
    const username = generateSidekixUsername();
    const { data, error } = await sb.from('profiles').insert({ id: uid, username }).select('*').single();
    if (!error && data) return data as ProfileRow;
    const { data: existing } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (existing) return existing as ProfileRow;
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: string }).code) : '';
    if (code !== '23505') break;
  }
  return null;
}
