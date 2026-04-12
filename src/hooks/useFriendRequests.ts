import { useCallback, useEffect, useState } from 'react';
import { tryGetSupabase } from '../lib/supabase';
import type { ProfileRow } from '../types/database';

export type IncomingFriendRequest = {
  id: string;
  requester_id: string;
  profile: ProfileRow | null;
};

export function useFriendRequests(myId: string | undefined) {
  const [incoming, setIncoming] = useState<IncomingFriendRequest[]>([]);
  const [outgoingIds, setOutgoingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!sb || !myId) {
      setIncoming([]);
      setOutgoingIds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [incRes, outRes] = await Promise.all([
      sb.from('friend_requests').select('id, requester_id').eq('addressee_id', myId).eq('status', 'pending'),
      sb.from('friend_requests').select('addressee_id').eq('requester_id', myId).eq('status', 'pending'),
    ]);
    const outIds = (outRes.data ?? []).map((r: { addressee_id: string }) => r.addressee_id);
    setOutgoingIds(outIds);

    const rows = (incRes.data ?? []) as { id: string; requester_id: string }[];
    if (rows.length === 0) {
      setIncoming([]);
      setLoading(false);
      return;
    }
    const ids = rows.map((r) => r.requester_id);
    const { data: profs } = await sb.from('profiles').select('*').in('id', ids);
    const pmap = new Map((profs ?? []).map((p: ProfileRow) => [p.id, p]));
    setIncoming(
      rows.map((r) => ({
        id: r.id,
        requester_id: r.requester_id,
        profile: pmap.get(r.requester_id) ?? null,
      })),
    );
    setLoading(false);
  }, [myId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { incoming, outgoingIds, loading, refresh };
}
