import { useAuth } from '../context/AuthContext';
import { getPublicPostMediaUrl, getReadablePostMediaUrl } from '../lib/storageMediaUrl';
import { isR2ObjectPath } from '../lib/r2MediaConfig';
import { readAppExtra } from '../lib/supabaseConfig';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

/**
 * Resolves storage URLs and retries with the **public** URL if the first load fails
 * (e.g. signed URL blocked by policy). Re-runs when auth session hydrates.
 *
 * Public URL is recomputed every render (not memoized on `path` alone): `Constants.expoConfig`
 * can hydrate after the first frame; a stale memo would leave R2 `publicFallback` null forever.
 *
 * `primary` is cleared in `useLayoutEffect` whenever `path` / R2 base / session changes so we never
 * show a previous row’s URL while the new row’s `publicFallback` is different (broken loads / spinners).
 */
export function useReadableStorageUrl(path: string | null | undefined): {
  displayUri: string | null;
  onLoadError: () => void;
} {
  const { session } = useAuth();
  const r2PublicBase = readAppExtra().r2PublicMediaUrl ?? '';
  const publicFallback = getPublicPostMediaUrl(path);
  const [primary, setPrimary] = useState<string | null>(null);
  const [preferPublic, setPreferPublic] = useState(false);

  useLayoutEffect(() => {
    setPrimary(null);
    setPreferPublic(false);
  }, [path, r2PublicBase, session?.access_token]);

  useEffect(() => {
    let cancelled = false;
    const p = path?.trim();
    if (!p) {
      setPrimary(null);
      return;
    }
    void (async () => {
      const u = await getReadablePostMediaUrl(p);
      if (!cancelled) {
        setPrimary(u);
        if (__DEV__ && isR2ObjectPath(p) && !u) {
          const x = readAppExtra();
          console.warn('[Sidekix media][diag] R2 path has no resolvable public URL', {
            pathPreview: `${p.slice(0, 24)}…`,
            mergedR2PublicMediaUrl: x.r2PublicMediaUrl ?? '(empty)',
            useR2Media: x.useR2Media,
            publicFallbackComputed: getPublicPostMediaUrl(p) ?? '(null)',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, session?.access_token, r2PublicBase]);

  const displayUri = preferPublic ? publicFallback : primary ?? publicFallback;

  const onLoadError = useCallback(() => {
    if (publicFallback && !preferPublic) {
      setPreferPublic(true);
    }
  }, [publicFallback, preferPublic]);

  return { displayUri, onLoadError };
}
