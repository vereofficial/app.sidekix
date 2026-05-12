import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { tryGetSupabase } from '../lib/supabase';
import type { PersonalScratchpadLineRow } from '../types/database';

export type ScratchLine = {
  id: string;
  text: string;
  createdAt: string;
};

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isServerId(id: string): boolean {
  return UUID_RE.test(id);
}

function rowToLine(r: PersonalScratchpadLineRow): ScratchLine {
  return {
    id: r.id,
    text: r.line_text.slice(0, 500),
    createdAt: r.created_at,
  };
}

export function usePersonalScratchpad(userId?: string | null) {
  const [wantToTry, setWantToTry] = useState<ScratchLine[]>([]);
  const [rememberDone, setRememberDone] = useState<ScratchLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const keys = useMemo(() => {
    if (!userId) return null;
    return {
      wish: `@sidekix/personal_wishlist_v2/${userId}`,
      mem: `@sidekix/personal_memories_v2/${userId}`,
    };
  }, [userId]);

  const persistLocal = useCallback(
    async (wish: ScratchLine[], mem: ScratchLine[]) => {
      if (!keys) return;
      try {
        await AsyncStorage.multiSet([
          [keys.wish, JSON.stringify(wish)],
          [keys.mem, JSON.stringify(mem)],
        ]);
      } catch {
        /* ignore */
      }
    },
    [keys],
  );

  const loadFromServer = useCallback(async (): Promise<{ wish: ScratchLine[]; mem: ScratchLine[] } | null> => {
    if (!userId) return null;
    const sb = tryGetSupabase();
    if (!sb) return null;
    const { data, error } = await sb
      .from('personal_scratchpad_lines')
      .select('id,user_id,bucket,line_text,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return null;
    const rows = (data ?? []) as PersonalScratchpadLineRow[];
    const wish: ScratchLine[] = [];
    const mem: ScratchLine[] = [];
    rows.forEach((r) => {
      const line = rowToLine(r);
      if (r.bucket === 'wish') wish.push(line);
      else mem.push(line);
    });
    return { wish, mem };
  }, [userId]);

  const migrateAsyncToServer = useCallback(
    async (wish: ScratchLine[], mem: ScratchLine[]): Promise<boolean> => {
      const sb = tryGetSupabase();
      if (!sb || !userId) return false;
      const inserts: { user_id: string; bucket: 'wish' | 'mem'; line_text: string }[] = [];
      wish.forEach((l) => inserts.push({ user_id: userId, bucket: 'wish', line_text: l.text }));
      mem.forEach((l) => inserts.push({ user_id: userId, bucket: 'mem', line_text: l.text }));
      if (inserts.length === 0) return true;
      const { error } = await sb.from('personal_scratchpad_lines').insert(inserts);
      if (error) return false;
      return true;
    },
    [userId],
  );

  useEffect(() => {
    if (!keys || !hydrated) return;
    void persistLocal(wantToTry, rememberDone);
  }, [keys, hydrated, wantToTry, rememberDone, persistLocal]);

  useEffect(() => {
    let cancelled = false;
    if (!keys) {
      setWantToTry([]);
      setRememberDone([]);
      setHydrated(true);
      return () => {
        cancelled = true;
      };
    }
    setHydrated(false);
    void (async () => {
      const parse = (raw: string | null): ScratchLine[] => {
        if (!raw) return [];
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (!Array.isArray(parsed)) return [];
          return parsed
            .filter(
              (row): row is ScratchLine =>
                row != null &&
                typeof row === 'object' &&
                typeof (row as ScratchLine).id === 'string' &&
                typeof (row as ScratchLine).text === 'string',
            )
            .map((r) => ({
              id: r.id,
              text: r.text.slice(0, 500),
              createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
            }));
        } catch {
          return [];
        }
      };

      let localWish: ScratchLine[] = [];
      let localMem: ScratchLine[] = [];
      try {
        const [rawW, rawM] = await Promise.all([AsyncStorage.getItem(keys.wish), AsyncStorage.getItem(keys.mem)]);
        localWish = parse(rawW);
        localMem = parse(rawM);
      } catch {
        /* ignore */
      }

      const server = await loadFromServer();
      if (cancelled) return;

      let nextWish = server?.wish ?? [];
      let nextMem = server?.mem ?? [];

      if (server && nextWish.length === 0 && nextMem.length === 0 && (localWish.length > 0 || localMem.length > 0)) {
        const ok = await migrateAsyncToServer(localWish, localMem);
        if (!cancelled && ok) {
          const again = await loadFromServer();
          if (again) {
            nextWish = again.wish;
            nextMem = again.mem;
          }
          await AsyncStorage.multiRemove([keys.wish, keys.mem]).catch(() => {});
        } else if (!cancelled) {
          nextWish = localWish;
          nextMem = localMem;
        }
      } else if (!server) {
        nextWish = localWish;
        nextMem = localMem;
      }

      if (!cancelled) {
        setWantToTry(nextWish);
        setRememberDone(nextMem);
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [keys, loadFromServer, migrateAsyncToServer]);

  const addWantToTry = useCallback(
    async (text: string) => {
      if (!keys || !userId) return;
      const t = text.trim();
      if (!t) return;
      const sb = tryGetSupabase();
      if (sb) {
        const { data, error } = await sb
          .from('personal_scratchpad_lines')
          .insert({ user_id: userId, bucket: 'wish', line_text: t.slice(0, 500) })
          .select('id,line_text,created_at')
          .single();
        if (error) {
          Alert.alert('Could not save', error.message);
          return;
        }
        const row = data as Pick<PersonalScratchpadLineRow, 'id' | 'line_text' | 'created_at'>;
        const line: ScratchLine = {
          id: row.id,
          text: row.line_text,
          createdAt: row.created_at,
        };
        setWantToTry((prev) => {
          const next = [line, ...prev];
          return next;
        });
        return;
      }
      const line: ScratchLine = { id: newId(), text: t.slice(0, 500), createdAt: new Date().toISOString() };
      setWantToTry((prev) => [line, ...prev]);
    },
    [keys, userId],
  );

  const removeWantToTry = useCallback(
    async (id: string) => {
      if (!keys) return;
      const prevW = wantToTry;
      const prevM = rememberDone;
      setWantToTry((prev) => prev.filter((x) => x.id !== id));
      if (isServerId(id)) {
        const sb = tryGetSupabase();
        if (sb) {
          const { error } = await sb.from('personal_scratchpad_lines').delete().eq('id', id).eq('user_id', userId!);
          if (error) {
            setWantToTry(prevW);
            void persistLocal(prevW, prevM);
            Alert.alert('Could not remove', error.message);
          }
        }
      }
    },
    [keys, userId, wantToTry, rememberDone, persistLocal],
  );

  const addRememberDone = useCallback(
    async (text: string) => {
      if (!keys || !userId) return;
      const t = text.trim();
      if (!t) return;
      const sb = tryGetSupabase();
      if (sb) {
        const { data, error } = await sb
          .from('personal_scratchpad_lines')
          .insert({ user_id: userId, bucket: 'mem', line_text: t.slice(0, 500) })
          .select('id,line_text,created_at')
          .single();
        if (error) {
          Alert.alert('Could not save', error.message);
          return;
        }
        const row = data as Pick<PersonalScratchpadLineRow, 'id' | 'line_text' | 'created_at'>;
        const line: ScratchLine = {
          id: row.id,
          text: row.line_text,
          createdAt: row.created_at,
        };
        setRememberDone((prev) => {
          const next = [line, ...prev];
          return next;
        });
        return;
      }
      const line: ScratchLine = { id: newId(), text: t.slice(0, 500), createdAt: new Date().toISOString() };
      setRememberDone((prev) => [line, ...prev]);
    },
    [keys, userId],
  );

  const removeRememberDone = useCallback(
    async (id: string) => {
      if (!keys) return;
      const prevW = wantToTry;
      const prevM = rememberDone;
      setRememberDone((prev) => prev.filter((x) => x.id !== id));
      if (isServerId(id)) {
        const sb = tryGetSupabase();
        if (sb) {
          const { error } = await sb.from('personal_scratchpad_lines').delete().eq('id', id).eq('user_id', userId!);
          if (error) {
            setRememberDone(prevM);
            void persistLocal(prevW, prevM);
            Alert.alert('Could not remove', error.message);
          }
        }
      }
    },
    [keys, userId, wantToTry, rememberDone, persistLocal],
  );

  return {
    hydrated,
    wantToTry,
    rememberDone,
    addWantToTry,
    removeWantToTry,
    addRememberDone,
    removeRememberDone,
  };
}
