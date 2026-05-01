import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase `.in()` filters can fail or truncate on very long URL queries; batch ids.
 * @param maxPerQuery keep ≤ ~50 for comfortable URL size with UUIDs.
 */
export async function queryInChunks<T>(
  sb: SupabaseClient,
  table: string,
  column: string,
  ids: string[],
  select: string,
  maxPerQuery = 40,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += maxPerQuery) {
    const slice = ids.slice(i, i + maxPerQuery);
    const { data, error } = await sb.from(table).select(select).in(column, slice);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
  }
  return out;
}
