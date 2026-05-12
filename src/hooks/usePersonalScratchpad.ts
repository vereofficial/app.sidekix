import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tryGetSupabase } from '../lib/supabase';

export type ScratchLine = {
  id: string;
  text: string;
  createdAt: string;
};

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

type DbRow = { id: string; bucket: string; line_text: string; created_at: string };

function migrationDoneKey(userId: string) {
  return `sidekix_scratch_cloud_migrated_v1:${userId}`;
}

function rowsFromDb(rows: DbRow[], bucket: 'wish' | 'mem'): ScratchLine[] {
  return rows
    .filter((r) => r.bucket === bucket)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((r) => ({
      id: r.id,
      text: r.line_text.slice(0, 500),
      createdAt: r.created_at,
    }));
}

async function persistLocal(keys: { wish: string; mem: string }, wish: ScratchLine[], mem: ScratchLine[]) {
  await AsyncStorage.multiSet([
    [keys.wish, JSON.stringify(wish)],
    [keys.mem, JSON.stringify(mem)],
  ]);
}

export function usePersonalScratchpad(userId?: string | null) {
  const [wantToTry, setWantToTry] = useState<ScratchLine[]>([]);
  const [rememberDone, setRememberDone] = useState<ScratchLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const wantRef = useRef<ScratchLine[]>([]);
  const memRef = useRef<ScratchLine[]>([]);
  wantRef.current = wantToTry;
  memRef.current = rememberDone;
  const keys = useMemo(() => {
    if (!userId) return null;
    return {
      wish: `@sidekix/personal_wishlist_v2/${userId}`,
      mem: `@sidekix/personal_memories_v2/${userId}`,
    };
  }, [userId]);

  const syncRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!keys) {
        setWantToTry([]);
        setRememberDone([]);
        setHydrated(true);
        return;
      }

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

      setHydrated(false);
      const token = ++syncRef.current;

      try {
        const [rawW, rawM] = await Promise.all([AsyncStorage.getItem(keys.wish), AsyncStorage.getItem(keys.mem)]);
        if (cancelled || token !== syncRef.current) return;
        const localW = parse(rawW);
        const localM = parse(rawM);
        setWantToTry(localW);
        setRememberDone(localM);
      } finally {
        if (!cancelled && token === syncRef.current) setHydrated(true);
      }

      const sb = tryGetSupabase();
      if (!sb || !userId || cancelled || token !== syncRef.current) return;

      try {
        const { data: serverRows, error: qErr } = await sb
          .from('personal_scratchpad_lines')
          .select('id, bucket, line_text, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (cancelled || token !== syncRef.current) return;
        if (qErr) return;

        const srv = (serverRows ?? []) as DbRow[];
        const migrated = (await AsyncStorage.getItem(migrationDoneKey(userId))) === '1';

        if (srv.length > 0) {
          const w = rowsFromDb(srv, 'wish');
          const m = rowsFromDb(srv, 'mem');
          setWantToTry(w);
          setRememberDone(m);
          await persistLocal(keys, w, m);
          if (!migrated) await AsyncStorage.setItem(migrationDoneKey(userId), '1');
          return;
        }

        const localWish = parse(await AsyncStorage.getItem(keys.wish));
        const localMem = parse(await AsyncStorage.getItem(keys.mem));
        if (!migrated && (localWish.length > 0 || localMem.length > 0)) {
          const inserts: { user_id: string; bucket: 'wish' | 'mem'; line_text: string; created_at: string }[] = [];
          for (const line of [...localWish].reverse()) {
            inserts.push({
              user_id: userId,
              bucket: 'wish',
              line_text: line.text,
              created_at: line.createdAt,
            });
          }
          for (const line of [...localMem].reverse()) {
            inserts.push({
              user_id: userId,
              bucket: 'mem',
              line_text: line.text,
              created_at: line.createdAt,
            });
          }
          if (inserts.length > 0) {
            const { error: insErr } = await sb.from('personal_scratchpad_lines').insert(inserts);
            if (!insErr) await AsyncStorage.setItem(migrationDoneKey(userId), '1');
          }
          const { data: again } = await sb
            .from('personal_scratchpad_lines')
            .select('id, bucket, line_text, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          if (cancelled || token !== syncRef.current) return;
          const r2 = (again ?? []) as DbRow[];
          const w = rowsFromDb(r2, 'wish');
          const m = rowsFromDb(r2, 'mem');
          setWantToTry(w);
          setRememberDone(m);
          await persistLocal(keys, w, m);
        }
      } catch {
        /* offline / table missing until migration */
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [keys, userId]);

  const addWantToTry = useCallback(
    async (text: string) => {
      if (!keys || !userId) return;
      const t = text.trim();
      if (!t) return;
      const createdAt = new Date().toISOString();
      const line: ScratchLine = { id: newId(), text: t.slice(0, 500), createdAt };
      setWantToTry((prev) => {
        const next = [line, ...prev];
        void persistLocal(keys, next, memRef.current);
        return next;
      });

      const sb = tryGetSupabase();
      if (sb) {
        const { data: inserted, error } = await sb
          .from('personal_scratchpad_lines')
          .insert({ user_id: userId, bucket: 'wish', line_text: line.text, created_at: createdAt })
          .select('id, created_at')
          .maybeSingle();
        if (!error && inserted) {
          const id = (inserted as { id: string }).id;
          const ca = (inserted as { created_at: string }).created_at ?? createdAt;
          setWantToTry((prev) => {
            const next = prev.map((x) => (x.id === line.id ? { ...x, id, createdAt: ca } : x));
            void persistLocal(keys, next, memRef.current);
            return next;
          });
        }
      }
    },
    [keys, userId],
  );

  const removeWantToTry = useCallback(
    async (id: string) => {
      if (!keys) return;
      setWantToTry((prev) => {
        const next = prev.filter((x) => x.id !== id);
        void persistLocal(keys, next, memRef.current);
        return next;
      });
      const sb = tryGetSupabase();
      if (sb && /^[0-9a-f-]{36}$/i.test(id)) {
        await sb.from('personal_scratchpad_lines').delete().eq('id', id).eq('user_id', userId!);
      }
    },
    [keys, userId],
  );

  const addRememberDone = useCallback(
    async (text: string) => {
      if (!keys || !userId) return;
      const t = text.trim();
      if (!t) return;
      const createdAt = new Date().toISOString();
      const line: ScratchLine = { id: newId(), text: t.slice(0, 500), createdAt };
      setRememberDone((prev) => {
        const next = [line, ...prev];
        void persistLocal(keys, wantRef.current, next);
        return next;
      });

      const sb = tryGetSupabase();
      if (sb) {
        const { data: inserted, error } = await sb
          .from('personal_scratchpad_lines')
          .insert({ user_id: userId, bucket: 'mem', line_text: line.text, created_at: createdAt })
          .select('id, created_at')
          .maybeSingle();
        if (!error && inserted) {
          const id = (inserted as { id: string }).id;
          const ca = (inserted as { created_at: string }).created_at ?? createdAt;
          setRememberDone((prev) => {
            const next = prev.map((x) => (x.id === line.id ? { ...x, id, createdAt: ca } : x));
            void persistLocal(keys, wantRef.current, next);
            return next;
          });
        }
      }
    },
    [keys, userId],
  );

  const removeRememberDone = useCallback(
    async (id: string) => {
      if (!keys) return;
      setRememberDone((prev) => {
        const next = prev.filter((x) => x.id !== id);
        void persistLocal(keys, wantRef.current, next);
        return next;
      });
      const sb = tryGetSupabase();
      if (sb && /^[0-9a-f-]{36}$/i.test(id)) {
        await sb.from('personal_scratchpad_lines').delete().eq('id', id).eq('user_id', userId!);
      }
    },
    [keys, userId],
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
