"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Minimal data hook: runs `fn` on mount and whenever `deps` change; `reload()` re-runs it. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useRef(0);

  const reload = useCallback(async () => {
    const id = ++run.current;
    setLoading(true);
    try {
      const result = await fnRef.current();
      if (id === run.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (id === run.current) setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (id === run.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload };
}

/** Throws the Supabase error if any, returns data otherwise. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}
