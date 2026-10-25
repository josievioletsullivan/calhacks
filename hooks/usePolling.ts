import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export interface PollingState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  updatedAt: Date | null;
  refresh: () => Promise<void>;
}

/**
 * Poll an async source on an interval, pausing while the app is backgrounded.
 * 511 keys are limited to 60 requests/hour, so keep intervals ≥ 60s per feed.
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, enabled = true): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      refresh();
      timer = setInterval(refresh, intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    start();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !timer) start();
      else if (state !== 'active') stop();
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [enabled, intervalMs, refresh]);

  return { data, error, loading, updatedAt, refresh };
}
