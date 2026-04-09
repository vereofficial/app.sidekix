import { tryGetSupabase } from './supabase';

export function postImagePublicUrl(path: string): string {
  const sb = tryGetSupabase();
  if (!sb) return '';
  return sb.storage.from('post-media').getPublicUrl(path).data.publicUrl;
}
