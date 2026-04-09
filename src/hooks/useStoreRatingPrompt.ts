import * as SecureStore from 'expo-secure-store';
import * as StoreReview from 'expo-store-review';
import { useCallback, useEffect, useRef, useState } from 'react';

const FIRST_OPEN = 'sidekix_first_open_ms';
const SESSION_COUNT = 'sidekix_app_sessions';
const LAST_REVIEW_PROMPT = 'sidekix_last_review_ms';

/**
 * After sustained use, shows a light-touch “enjoying sidekix?” sheet; tapping a star
 * triggers the system review flow (when available). Heuristic: ≥5 sessions, ≥3 days since
 * first open, ≥120 days since last prompt (OS may still throttle the native UI).
 */
export function useStoreRatingPrompt(enabled: boolean) {
  const [visible, setVisible] = useState(false);
  const sessionBumped = useRef(false);

  useEffect(() => {
    if (!enabled) {
      sessionBumped.current = false;
      return;
    }
    let cancelled = false;

    const run = async () => {
      try {
        const now = Date.now();
        let firstOpenStr = await SecureStore.getItemAsync(FIRST_OPEN);
        if (!firstOpenStr) {
          firstOpenStr = String(now);
          await SecureStore.setItemAsync(FIRST_OPEN, firstOpenStr);
        }
        const firstOpen = parseInt(firstOpenStr, 10);
        const daysSinceFirst = (now - firstOpen) / (86400 * 1000);

        let sessions = parseInt((await SecureStore.getItemAsync(SESSION_COUNT)) || '0', 10);
        if (!sessionBumped.current) {
          sessionBumped.current = true;
          sessions += 1;
          await SecureStore.setItemAsync(SESSION_COUNT, String(sessions));
        }

        const can = await StoreReview.hasAction();
        if (!can || cancelled) return;

        const lastStr = await SecureStore.getItemAsync(LAST_REVIEW_PROMPT);
        const lastPrompt = lastStr ? parseInt(lastStr, 10) : 0;
        const daysSincePrompt = lastPrompt ? (now - lastPrompt) / (86400 * 1000) : 999;

        if (sessions >= 5 && daysSinceFirst >= 3 && daysSincePrompt >= 120) {
          setVisible(true);
        }
      } catch {
        /* ignore */
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const markPrompted = useCallback(async () => {
    try {
      await SecureStore.setItemAsync(LAST_REVIEW_PROMPT, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, []);

  const onRate = useCallback(async () => {
    try {
      await StoreReview.requestReview();
    } catch {
      /* ignore */
    }
    await markPrompted();
    setVisible(false);
  }, [markPrompted]);

  const onNotNow = useCallback(async () => {
    await markPrompted();
    setVisible(false);
  }, [markPrompted]);

  return { visible, onRate, onNotNow };
}
