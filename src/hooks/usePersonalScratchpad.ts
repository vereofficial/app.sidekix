import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type ScratchLine = {
  id: string;
  text: string;
  createdAt: string;
};

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
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
      try {
        const [rawW, rawM] = await Promise.all([AsyncStorage.getItem(keys.wish), AsyncStorage.getItem(keys.mem)]);
        if (cancelled) return;
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
        setWantToTry(parse(rawW));
        setRememberDone(parse(rawM));
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [keys]);

  const addWantToTry = useCallback(async (text: string) => {
    if (!keys) return;
    const t = text.trim();
    if (!t) return;
    const line: ScratchLine = { id: newId(), text: t.slice(0, 500), createdAt: new Date().toISOString() };
    setWantToTry((prev) => {
      const next = [line, ...prev];
      void AsyncStorage.setItem(keys.wish, JSON.stringify(next));
      return next;
    });
  }, [keys]);

  const removeWantToTry = useCallback(async (id: string) => {
    if (!keys) return;
    setWantToTry((prev) => {
      const next = prev.filter((x) => x.id !== id);
      void AsyncStorage.setItem(keys.wish, JSON.stringify(next));
      return next;
    });
  }, [keys]);

  const addRememberDone = useCallback(async (text: string) => {
    if (!keys) return;
    const t = text.trim();
    if (!t) return;
    const line: ScratchLine = { id: newId(), text: t.slice(0, 500), createdAt: new Date().toISOString() };
    setRememberDone((prev) => {
      const next = [line, ...prev];
      void AsyncStorage.setItem(keys.mem, JSON.stringify(next));
      return next;
    });
  }, [keys]);

  const removeRememberDone = useCallback(async (id: string) => {
    if (!keys) return;
    setRememberDone((prev) => {
      const next = prev.filter((x) => x.id !== id);
      void AsyncStorage.setItem(keys.mem, JSON.stringify(next));
      return next;
    });
  }, [keys]);

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
