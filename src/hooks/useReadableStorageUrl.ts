import { useAuth } from '../context/AuthContext';
import { getPublicPostMediaUrl, getReadablePostMediaUrl } from '../lib/storageMediaUrl';
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Resolves storage URLs and retries with the **public** URL if the first load fails
 * (e.g. signed URL blocked by policy). Re-runs when auth session hydrates.
 */
export function useReadableStorageUrl(path: string | null | undefined): {
  displayUri: string | null;
  onLoadError: () => void;
} {
  const { session } = useAuth();
  const publicFallback = useMemo(() => getPublicPostMediaUrl(path), [path]);
  const [primary, setPrimary] = useState<string | null>(null);
  const [preferPublic, setPreferPublic] = useState(false);

  useEffect(() => {
    setPreferPublic(false);
    let cancelled = false;
    const p = path?.trim();
    if (!p) {
      setPrimary(null);
      return;
    }
    void (async () => {
      const u = await getReadablePostMediaUrl(p);
      if (!cancelled) setPrimary(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [path, session?.access_token]);

  const displayUri = preferPublic ? publicFallback : primary ?? publicFallback;

  const onLoadError = useCallback(() => {
    if (publicFallback && !preferPublic) {
      setPreferPublic(true);
    }
  }, [publicFallback, preferPublic]);

  return { displayUri, onLoadError };
}
