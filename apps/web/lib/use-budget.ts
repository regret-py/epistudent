"use client";

import { useCallback, useEffect, useState } from "react";
import { EMPTY_STATE, parseState, type BudgetState, type Entry } from "./budget";

const STORAGE_KEY = "epistudent-budget";

/** Budget persisted in localStorage (per device, never sent anywhere). */
export function useBudget() {
  const [state, setState] = useState<BudgetState>(EMPTY_STATE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(parseState(JSON.parse(raw)));
    } catch {
      // corrupted or blocked storage: start empty
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full or blocked: keep working in memory
    }
  }, [state, loaded]);

  const add = useCallback((entry: Omit<Entry, "id">) => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random());
    setState((s) => ({ ...s, entries: [...s.entries, { ...entry, id }] }));
  }, []);

  const remove = useCallback((id: string) => {
    setState((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== id) }));
  }, []);

  const replace = useCallback((next: BudgetState) => setState(next), []);

  return { state, loaded, add, remove, replace };
}
