"use client";

import { useEffect, useRef, useState } from "react";
import { cleanShares } from "./plan";

const KEY = "epistudent-plan";

export type Saved = { budget: string; savings: string; rent: string; shares: Record<string, number> };
const EMPTY: Saved = { budget: "", savings: "", rent: "", shares: {} };

function clip(v: unknown): string {
  return typeof v === "string" ? v.slice(0, 20) : "";
}

/** Inputs remembered in this browser only (never sent anywhere). */
export function useSaved() {
  const [saved, setSaved] = useState<Saved>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    let next = EMPTY;
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const r = raw as Record<string, unknown>;
        next = { budget: clip(r.budget), savings: clip(r.savings), rent: clip(r.rent), shares: cleanShares(r.shares) };
      }
    } catch {
      // corrupted or blocked storage: start fresh
    }
    // the static HTML is usable before the JS loads: keep anything typed in the meantime
    for (const field of ["budget", "savings", "rent"] as const) {
      const typed = (document.getElementById(field) as HTMLInputElement | null)?.value ?? "";
      if (typed.trim()) next = { ...next, [field]: clip(typed) };
    }
    if (next !== EMPTY) {
      first.current = false; // a merge of typed values must be saved too
      setSaved(next);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      // storage full or blocked: still works for this visit
    }
  }, [saved, loaded]);

  const reset = () => {
    setSaved(EMPTY);
    try {
      localStorage.removeItem(KEY);
    } catch {
      // nothing stored
    }
  };

  return { saved, setSaved, loaded, reset };
}
