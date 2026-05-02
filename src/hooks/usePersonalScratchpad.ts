import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const KEY_WISH = '@sidekix/personal_wishlist_v1';
const KEY_MEM = '@sidekix/personal_memories_v1';

export type ScratchLine = {
  id: string;
  text: string;
  createdAt: string;
};

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function usePersonalScratchpad() {
  const [wantToTry, setWantToTry] = useState<ScratchLine[]>([]);
  const [rememberDone, setRememberDone] = useState<ScratchLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [rawW, rawM] = await Promise.all([AsyncStorage.getItem(KEY_WISH), AsyncStorage.getItem(KEY_MEM)]);
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
  }, []);

  const addWantToTry = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t) return;
    const line: ScratchLine = { id: newId(), text: t.slice(0, 500), createdAt: new Date().toISOString() };
    setWantToTry((prev) => {
      const next = [line, ...prev];
      void AsyncStorage.setItem(KEY_WISH, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeWantToTry = useCallback(async (id: string) => {
    setWantToTry((prev) => {
      const next = prev.filter((x) => x.id !== id);
      void AsyncStorage.setItem(KEY_WISH, JSON.stringify(next));
      return next;
    });
  }, []);

  const addRememberDone = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t) return;
    const line: ScratchLine = { id: newId(), text: t.slice(0, 500), createdAt: new Date().toISOString() };
    setRememberDone((prev) => {
      const next = [line, ...prev];
      void AsyncStorage.setItem(KEY_MEM, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeRememberDone = useCallback(async (id: string) => {
    setRememberDone((prev) => {
      const next = prev.filter((x) => x.id !== id);
      void AsyncStorage.setItem(KEY_MEM, JSON.stringify(next));
      return next;
    });
  }, []);

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
